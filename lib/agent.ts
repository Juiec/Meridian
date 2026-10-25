import {
  COMPACT_SYSTEM,
  planCompaction,
  summaryTranscript,
} from "@/lib/compact";
import { isAbortError } from "@/lib/errors";
import { streamCompletion, type ApiMessage, type CompletionDelta, type CompletionRequest } from "@/lib/lmstudio";
import { readEntries } from "@/lib/memory";
import { assembleSystemPrompt, skillsChangedNote } from "@/lib/prompt";
import { getSettings } from "@/lib/settings";
import { deriveTitle, parseSkillCommand } from "@/lib/skill-command";
import { discoverSkills, readSkillFile, skillsIndexHash } from "@/lib/skills";
import {
  getSession,
  insertMessage,
  lastUserMessage,
  listMessages,
  modelVisibleUserText,
  truncateAfter,
  updateSession,
  visibleMessages,
} from "@/lib/sessions";
import { prepareAgentTools, executeAgentTool } from "@/lib/agent-tools";
import { TOOLS } from "@/lib/tools";
import type { ToolRoute } from "@/lib/tool-registry";
import type { AgentEvent, Attachment, ToolCallRecord } from "@/lib/types";

const MAX_PASSES = 6;

type CompleteFn = (request: CompletionRequest) => AsyncGenerator<CompletionDelta>;

async function* defaultComplete(request: CompletionRequest): AsyncGenerator<CompletionDelta> {
  yield* streamCompletion(request);
}

function expandUserContent(content: string): string {
  const parsed = parseSkillCommand(content);
  if (!parsed) return content;
  const blocks = parsed.skills.map((name) => {
    const loaded = readSkillFile(name);
    if (!loaded.ok) {
      return `Skill ${name} was requested but is not installed. Available: ${loaded.available.join(", ") || "none"}.`;
    }
    return `<skill name="${name}">\n${loaded.content}\n</skill>`;
  });
  const request =
    parsed.rest.trim() ||
    "The user invoked this skill without extra instructions. Follow it, and ask one focused question if you cannot proceed.";
  return `${blocks.join("\n\n")}\n\nUser request:\n${request}`;
}

export function buildApiMessages(sessionId: string): ApiMessage[] {
  const session = getSession(sessionId);
  if (!session) return [];
  const api: ApiMessage[] = [];
  if (session.compactedSummary) {
    api.push({
      role: "user",
      content: `[Compacted earlier context]\n${session.compactedSummary}`,
    });
    api.push({
      role: "assistant",
      content: "I'll treat that summary as prior context and continue from the recent messages.",
    });
  }
  for (const message of visibleMessages(session)) {
    if (message.role === "user") {
      const text = modelVisibleUserText(expandUserContent(message.content), message.attachments);
      const images = message.attachments.filter((item) => item.kind === "image" && item.dataUrl);
      api.push({
        role: "user",
        content:
          images.length === 0
            ? text
            : [
                { type: "text", text },
                ...images.map((item) => ({
                  type: "image_url" as const,
                  image_url: { url: item.dataUrl as string },
                })),
              ],
      });
    } else if (message.role === "note") {
      api.push({ role: "user", content: message.content });
    } else if (message.role === "assistant") {
      const calls = message.toolCalls ?? [];
      api.push({
        role: "assistant",
        content: calls.length > 0 ? message.content || null : message.content,
        tool_calls: calls.length
          ? calls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: { name: call.name, arguments: call.arguments || "{}" },
            }))
          : undefined,
      });
    } else if (message.role === "tool") {
      api.push({
        role: "tool",
        tool_call_id: message.toolCallId || "",
        content: message.content,
      });
    }
  }
  return api;
}

function rebuildPrompt(sessionId: string, model: string) {
  const { skills } = discoverSkills();
  const assembled = assembleSystemPrompt({
    skills,
    memoryEntries: readEntries("memory"),
    userEntries: readEntries("user"),
    now: new Date(),
    sessionId,
    model,
  });
  updateSession(sessionId, {
    systemPrompt: assembled.prompt,
    skillsIndexHash: assembled.skillsIndexHash,
  });
}

type Acc = { id: string; name: string; arguments: string };

function accumulate(acc: Acc[], delta: Extract<CompletionDelta, { type: "tool_delta" }>) {
  while (acc.length <= delta.index) acc.push({ id: "", name: "", arguments: "" });
  const slot = acc[delta.index];
  if (delta.id) slot.id = delta.id;
  if (delta.name) slot.name += delta.name;
  if (delta.arguments) slot.arguments += delta.arguments;
}

function finishedCalls(acc: Acc[], pass: number): ToolCallRecord[] {
  return acc
    .map((call, index) => ({
      id: call.id || `call_${pass}_${index}`,
      name: call.name.trim(),
      arguments: call.arguments.trim() || "{}",
    }))
    .filter((call) => call.name.length > 0);
}

async function summarize(input: {
  previous: string | null;
  source: ReturnType<typeof listMessages>;
  complete: CompleteFn;
  request: Pick<CompletionRequest, "baseUrl" | "apiKey" | "model" | "signal">;
}): Promise<{ summary: string; mode: "model" | "extractive" }> {
  const transcript = summaryTranscript(input.previous, input.source);
  try {
    let text = "";
    for await (const delta of input.complete({
      ...input.request,
      messages: [
        { role: "system", content: COMPACT_SYSTEM },
        { role: "user", content: transcript },
      ],
      temperature: 0.2,
      maxTokens: 700,
    })) {
      if (delta.type === "text") text += delta.text;
    }
    const cleaned = text.trim();
    if (!cleaned) return { summary: transcript, mode: "extractive" };
    return {
      summary: cleaned.length > 4500 ? `${cleaned.slice(0, 4500)}\n[summary clipped]` : cleaned,
      mode: "model",
    };
  } catch (err) {
    if (isAbortError(err)) throw err;
    return { summary: transcript, mode: "extractive" };
  }
}

export async function runTurn(input: {
  sessionId: string;
  content: string;
  attachments?: Attachment[];
  replay?: boolean;
  signal?: AbortSignal;
  emit: (event: AgentEvent) => void;
  complete?: CompleteFn;
}): Promise<void> {
  const complete = input.complete ?? defaultComplete;
  const content = input.content.trim();
  const attachments = input.attachments ?? [];
  if (!content && attachments.length === 0) throw new Error("Message is empty.");
  if (content.length > 32_000) throw new Error("Message is too long (max 32000 characters).");

  const session = getSession(input.sessionId);
  if (!session) throw new Error("Session not found.");
  const settings = getSettings();
  if (!settings.baseUrl) {
    throw new Error("Set LM_STUDIO_BASE_URL or save a base URL in Settings.");
  }
  const model = (session.model || settings.model).trim();
  if (!model) throw new Error("Set a model id in Settings before chatting.");

  const { skills } = discoverSkills();
  const hash = skillsIndexHash(skills);
  if (session.skillsIndexHash && hash !== session.skillsIndexHash) {
    const note = insertMessage({
      sessionId: input.sessionId,
      role: "note",
      content: skillsChangedNote(skills),
    });
    input.emit({ type: "note", message: note });
  }
  updateSession(input.sessionId, { skillsIndexHash: hash });

  if (input.replay) {
    const existing = lastUserMessage(input.sessionId);
    if (!existing) throw new Error("Nothing to retry.");
    truncateAfter(input.sessionId, existing.seq);
  } else {
    const user = insertMessage({
      sessionId: input.sessionId,
      role: "user",
      content: content || "Look at the attached files.",
      attachments,
    });
    input.emit({ type: "user", message: user });
    if (session.title === "New session") {
      updateSession(input.sessionId, { title: deriveTitle(content || attachments[0]?.name || "Attachment") });
    }
  }

  const baseRequest = {
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey || undefined,
    model,
    signal: input.signal,
  };

  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    if (input.signal?.aborted) {
      const note = insertMessage({
        sessionId: input.sessionId,
        role: "note",
        content: "Generation stopped.",
      });
      input.emit({ type: "note", message: note });
      input.emit({ type: "done", iterations: pass - 1, aborted: true });
      return;
    }
    const forceText = pass === MAX_PASSES;
    input.emit({
      type: "iteration",
      n: pass,
      max: MAX_PASSES,
      phase: forceText ? "answer" : "tools",
    });

    if (pass === 1) {
      const current = getSession(input.sessionId);
      if (!current) throw new Error("Session not found.");
      const plan = planCompaction(visibleMessages(current));
      if (plan) {
        const summarized = await summarize({
          previous: current.compactedSummary,
          source: plan.source,
          complete,
          request: baseRequest,
        });
        updateSession(input.sessionId, {
          compactedSummary: summarized.summary,
          compactedUntilSeq: plan.throughSeq,
        });
        rebuildPrompt(input.sessionId, model);
        input.emit({ type: "compaction", summary: summarized.summary, mode: summarized.mode });
        const note = insertMessage({
          sessionId: input.sessionId,
          role: "note",
          content:
            summarized.mode === "model"
              ? "Earlier turns were compacted into a model summary. The full transcript is still stored."
              : "Earlier turns were compacted with an extractive summary. The full transcript is still stored.",
        });
        input.emit({ type: "note", message: note });
      }
    }

    const current = getSession(input.sessionId);
    if (!current) throw new Error("Session not found.");
    const messages: ApiMessage[] = [
      { role: "system", content: current.systemPrompt },
      ...buildApiMessages(input.sessionId),
    ];
    if (forceText) {
      messages.push({
        role: "user",
        content: "Tool iteration limit reached. Answer now from the results you have. Do not call tools.",
      });
    }

    let definitions = TOOLS;
    let routes: Record<string, ToolRoute> = {};
    if (!forceText) {
      try {
        const bundle = await prepareAgentTools();
        definitions = bundle.definitions;
        routes = bundle.routes;
      } catch {
        definitions = TOOLS;
        routes = {};
      }
    }

    let text = "";
    let reasoning = "";
    const acc: Acc[] = [];
    let saved = false;
    const savePartial = () => {
      if (saved || (!text.trim() && !reasoning.trim())) return;
      insertMessage({
        sessionId: input.sessionId,
        role: "assistant",
        content: text,
        reasoning: reasoning || null,
      });
      saved = true;
    };

    try {
      for await (const delta of complete({
        ...baseRequest,
        messages,
        tools: forceText ? undefined : definitions,
        temperature: forceText ? 0.3 : 0.4,
      })) {
        if (input.signal?.aborted) break;
        if (delta.type === "text") {
          text += delta.text;
          input.emit({ type: "delta", text: delta.text });
        } else if (delta.type === "reasoning") {
          reasoning += delta.text;
          input.emit({ type: "reasoning", text: delta.text });
        } else if (delta.type === "tool_delta" && !forceText) {
          accumulate(acc, delta);
        }
      }
    } catch (err) {
      if (isAbortError(err) || input.signal?.aborted) {
        savePartial();
        const note = insertMessage({
          sessionId: input.sessionId,
          role: "note",
          content: "Generation stopped.",
        });
        input.emit({ type: "note", message: note });
        input.emit({ type: "done", iterations: pass, aborted: true });
        return;
      }
      throw err;
    }

    if (input.signal?.aborted) {
      savePartial();
      const note = insertMessage({
        sessionId: input.sessionId,
        role: "note",
        content: "Generation stopped.",
      });
      input.emit({ type: "note", message: note });
      input.emit({ type: "done", iterations: pass, aborted: true });
      return;
    }

    const toolCalls = forceText ? [] : finishedCalls(acc, pass);
    if (text.trim() || reasoning.trim() || toolCalls.length > 0) {
      insertMessage({
        sessionId: input.sessionId,
        role: "assistant",
        content: text,
        toolCalls: toolCalls.length ? toolCalls : null,
        reasoning: reasoning || null,
      });
      saved = true;
    }

    if (toolCalls.length === 0) {
      if (forceText && !text.trim()) {
        const note = insertMessage({
          sessionId: input.sessionId,
          role: "note",
          content: "Stopped after 6 passes. Ask Meridian to continue from the tool results above.",
        });
        input.emit({ type: "note", message: note });
      }
      input.emit({ type: "done", iterations: pass });
      return;
    }

    for (let index = 0; index < toolCalls.length; index += 1) {
      const call = toolCalls[index];
      if (input.signal?.aborted) {
        for (const skipped of toolCalls.slice(index)) {
          insertMessage({
            sessionId: input.sessionId,
            role: "tool",
            content: JSON.stringify({ ok: false, error: "Stopped before this tool ran." }),
            toolCallId: skipped.id,
            toolName: skipped.name,
          });
        }
        const note = insertMessage({
          sessionId: input.sessionId,
          role: "note",
          content: "Generation stopped.",
        });
        input.emit({ type: "note", message: note });
        input.emit({ type: "done", iterations: pass, aborted: true });
        return;
      }
      input.emit({ type: "tool_call", call });
      const result = await executeAgentTool(call.name, call.arguments, routes);
      const payload = JSON.stringify(result, null, 2);
      insertMessage({
        sessionId: input.sessionId,
        role: "tool",
        content: payload,
        toolCallId: call.id,
        toolName: call.name,
      });
      input.emit({
        type: "tool_result",
        toolCallId: call.id,
        name: call.name,
        content: payload,
        ok: result.ok !== false,
      });
    }
  }
}
