import { buildContextSummary, planSubagentFit, summarizeSubagentWork } from "@/lib/context-summary";
import { isAbortError, messageOf } from "@/lib/errors";
import type { ApiMessage, CompletionDelta, CompletionRequest } from "@/lib/lmstudio";
import { readEntries, renderMemorySnapshot } from "@/lib/memory";
import { prepareAgentTools, executeAgentTool } from "@/lib/agent-tools";
import { getSettings } from "@/lib/settings";
import { discoverSkills, indexSkills, renderSkillsIndex } from "@/lib/skills";
import {
  createSubagentSession,
  getSession,
  insertMessage,
  listMessages,
  updateSession,
  visibleMessages,
} from "@/lib/sessions";
import { parseToolArguments, TOOLS, type ToolDefinition } from "@/lib/tools";
import type { ToolRoute } from "@/lib/tool-registry";
import type { StoredMessage, ToolCallRecord } from "@/lib/types";

export const SUBAGENT_MAX_PASSES = 4;
export const SUBAGENT_RESULT_MAX = 3_200;
const TASK_MAX = 4_000;

type CompleteFn = (request: CompletionRequest) => AsyncGenerator<CompletionDelta>;

function clip(value: string, max: number): string {
  const clean = value.replace(/\u0000/g, "").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1))}…`;
}

function cleanTitle(title: string, task: string): string {
  const raw = (title.trim() || task.trim().split("\n")[0] || "Subagent").replace(/\s+/g, " ");
  return clip(raw, 80);
}

export function readDelegateRequest(
  raw: string,
): { ok: true; task: string; context: string; title: string } | { ok: false; error: string } {
  const parsed = parseToolArguments(raw);
  if (!parsed.ok) return parsed;
  const task = typeof parsed.value.task === "string" ? parsed.value.task.trim() : "";
  if (!task) return { ok: false, error: "delegate requires task." };
  if (task.length > TASK_MAX) {
    return { ok: false, error: `task is ${task.length} characters. Keep it under ${TASK_MAX}. Nothing was delegated.` };
  }
  const context = typeof parsed.value.context === "string" ? parsed.value.context.trim() : "";
  const title = typeof parsed.value.title === "string" ? parsed.value.title : "";
  return { ok: true, task, context, title: cleanTitle(title, task) };
}

function background(entries: string[], target: "memory" | "user"): string {
  if (entries.length === 0) return "";
  return clip(renderMemorySnapshot(target, entries), 600);
}

export function subagentSystemPrompt(input: {
  task: string;
  summary: string;
  now: Date;
}): string {
  const { skills } = discoverSkills();
  const memory = background(readEntries("memory"), "memory");
  const user = background(readEntries("user"), "user");
  const backgroundBlocks = [memory, user].filter(Boolean);
  return [
    "You are a Meridian subagent. You see only this assignment, not the parent chat. Finish the task and stop.",
    "# Task",
    input.task,
    "# Context summary",
    input.summary,
    "# How to work",
    "Use tools when you need data the summary does not contain. Load a skill with skill_view only when one index entry matches. Do not invent facts. Do not delegate. Do not write memory unless the task tells you to save a lasting fact. travel_plan changes the shared trip map. When you finish, reply with the result itself: what you found or did, the useful details, and anything unfinished. Do not narrate tool calls.",
    backgroundBlocks.length > 0 ? `# Background\n\n${backgroundBlocks.join("\n\n")}` : "",
    "# Skills index",
    "Descriptions are routing hints. Load a body with skill_view before following a procedure.",
    renderSkillsIndex(indexSkills(skills)),
    `Now: ${input.now.toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function withoutDelegate(definitions: ToolDefinition[]): ToolDefinition[] {
  return definitions.filter((tool) => tool.function.name !== "delegate");
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
      id: call.id || `sub_${pass}_${index}`,
      name: call.name.trim(),
      arguments: call.arguments.trim() || "{}",
    }))
    .filter((call) => call.name.length > 0);
}

function toApi(sessionId: string): ApiMessage[] {
  const session = getSession(sessionId);
  if (!session) return [];
  const api: ApiMessage[] = [];
  if (session.compactedSummary) {
    api.push({
      role: "user",
      content: `[Compacted earlier subagent work]\n${session.compactedSummary}`,
    });
    api.push({
      role: "assistant",
      content: "I'll continue from that summary and finish the task.",
    });
  }
  for (const message of visibleMessages(session)) {
    if (message.role === "user" || message.role === "note") {
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

export function compactSubagentSession(sessionId: string): boolean {
  const session = getSession(sessionId);
  if (!session) return false;
  const plan = planSubagentFit(visibleMessages(session));
  if (!plan) return false;
  updateSession(sessionId, {
    compactedSummary: summarizeSubagentWork(session.compactedSummary, plan.source),
    compactedUntilSeq: plan.throughSeq,
  });
  return true;
}

function toolNames(messages: StoredMessage[]): string[] {
  const names: string[] = [];
  for (const message of messages) {
    for (const call of message.toolCalls ?? []) {
      if (call.name && !names.includes(call.name)) names.push(call.name);
    }
  }
  return names.slice(0, 12);
}

function finalAnswer(messages: StoredMessage[]): string {
  const answers = messages.filter((message) => message.role === "assistant" && message.content.trim());
  return answers[answers.length - 1]?.content.trim() ?? "";
}

export async function runSubagent(input: {
  parentSessionId: string;
  rawArgs: string;
  signal?: AbortSignal;
  complete: CompleteFn;
  pullSteers?: () => string[];
  completionSignal?: () => AbortSignal;
  onSteered?: (text: string) => void;
  onStatus?: (detail: string) => void;
}): Promise<Record<string, unknown>> {
  const request = readDelegateRequest(input.rawArgs);
  if (!request.ok) return request;

  const parent = getSession(input.parentSessionId);
  if (!parent) return { ok: false, error: "Session not found." };
  if (parent.purpose === "subagent") {
    return { ok: false, error: "Subagents cannot delegate. Finish the task and return the result." };
  }
  const settings = getSettings(parent.endpointId || "default");
  const model = (parent.model || settings.model).trim();
  if (!settings.baseUrl) return { ok: false, error: "Set LM_STUDIO_BASE_URL or save a base URL in Settings." };
  if (!model) return { ok: false, error: "Set a model id in Settings before chatting." };

  const summary = buildContextSummary({
    supplied: request.context,
    compactedSummary: parent.compactedSummary,
    messages: visibleMessages(parent),
  });
  const prompt = subagentSystemPrompt({ task: request.task, summary, now: new Date() });
  const child = createSubagentSession({
    parentId: parent.id,
    title: request.title,
    endpointId: parent.endpointId,
    model,
    systemPrompt: prompt,
  });
  insertMessage({
    sessionId: child.id,
    role: "user",
    content: "Do the task in your instructions. Use tools only when the context summary is not enough.",
  });

  const status = (detail: string) => input.onStatus?.(detail);
  status(`Subagent · ${request.title}`);

  let passes = 0;
  let budget = SUBAGENT_MAX_PASSES;
  const applySteers = (texts: string[]) => {
    if (texts.length === 0) return false;
    for (const text of texts) {
      insertMessage({
        sessionId: child.id,
        role: "user",
        content: `The user steered:\n${text}`,
      });
      input.onSteered?.(text);
    }
    if (passes >= budget) budget = Math.min(passes + 1, SUBAGENT_MAX_PASSES + 1);
    return true;
  };
  try {
    for (let pass = 1; pass <= budget; pass += 1) {
      if (input.signal?.aborted) {
        return { ok: false, error: "Stopped before the subagent finished.", title: request.title, sessionId: child.id };
      }
      passes = pass;
      applySteers(input.pullSteers?.() ?? []);
      const forceText = pass >= budget;
      status(`Subagent pass ${pass} of ${budget} · ${request.title}`);
      compactSubagentSession(child.id);
      const current = getSession(child.id);
      if (!current) return { ok: false, error: "Subagent session disappeared.", sessionId: child.id };

      const messages: ApiMessage[] = [{ role: "system", content: current.systemPrompt }, ...toApi(child.id)];
      if (forceText) {
        messages.push({
          role: "user",
          content: "Answer now from the results you have. Do not call tools.",
        });
      }

      let definitions = withoutDelegate(TOOLS);
      let routes: Record<string, ToolRoute> = {};
      if (!forceText) {
        try {
          const bundle = await prepareAgentTools();
          definitions = withoutDelegate(bundle.definitions);
          routes = bundle.routes;
        } catch {
          definitions = withoutDelegate(TOOLS);
          routes = {};
        }
      }

      let text = "";
      let reasoning = "";
      const acc: Acc[] = [];
      try {
        for await (const delta of input.complete({
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey || undefined,
          model,
          messages,
          tools: forceText ? undefined : definitions,
          temperature: forceText ? 0.3 : 0.4,
          signal: input.completionSignal?.() ?? input.signal,
        })) {
          if (input.signal?.aborted) break;
          if (delta.type === "text") text += delta.text;
          else if (delta.type === "reasoning") reasoning += delta.text;
          else if (delta.type === "tool_delta" && !forceText) accumulate(acc, delta);
        }
      } catch (err) {
        if (isAbortError(err) || input.signal?.aborted) {
          const texts = input.signal?.aborted ? [] : (input.pullSteers?.() ?? []);
          if (texts.length > 0) {
            const spoken = text.trim() || reasoning.trim();
            if (spoken) insertMessage({ sessionId: child.id, role: "assistant", content: spoken });
            applySteers(texts);
            continue;
          }
          return { ok: false, error: "Stopped before the subagent finished.", title: request.title, sessionId: child.id };
        }
        return { ok: false, error: messageOf(err), title: request.title, sessionId: child.id };
      }

      if (input.signal?.aborted) {
        return { ok: false, error: "Stopped before the subagent finished.", title: request.title, sessionId: child.id };
      }

      const toolCalls = forceText ? [] : finishedCalls(acc, pass);
      const spoken = text.trim() || (toolCalls.length === 0 ? reasoning.trim() : "");
      if (spoken || toolCalls.length > 0) {
        insertMessage({
          sessionId: child.id,
          role: "assistant",
          content: spoken,
          reasoning: reasoning.trim() && spoken !== reasoning.trim() ? reasoning.trim() : null,
          toolCalls: toolCalls.length ? toolCalls : null,
        });
      }

      if (toolCalls.length === 0) break;

      for (const call of toolCalls) {
        if (input.signal?.aborted) {
          return { ok: false, error: "Stopped before the subagent finished.", title: request.title, sessionId: child.id };
        }
        status(`Subagent running ${call.name} · ${request.title}`);
        const result = await executeAgentTool(call.name, call.arguments, routes, {
          sessionId: child.id,
          toolCallId: call.id,
          mode: "agent",
        });
        insertMessage({
          sessionId: child.id,
          role: "tool",
          content: JSON.stringify(result),
          toolCallId: call.id,
          toolName: call.name,
        });
      }
    }
  } catch (err) {
    if (isAbortError(err) || input.signal?.aborted) {
      return { ok: false, error: "Stopped before the subagent finished.", title: request.title, sessionId: child.id };
    }
    return { ok: false, error: messageOf(err), title: request.title, sessionId: child.id };
  }

  const messages = listMessages(child.id);
  const answer = finalAnswer(messages);
  if (!answer) {
    return {
      ok: false,
      error: "The subagent finished without an answer.",
      title: request.title,
      sessionId: child.id,
      passes,
    };
  }
  const result =
    answer.length > SUBAGENT_RESULT_MAX
      ? `${answer.slice(0, SUBAGENT_RESULT_MAX - 18).trimEnd()}\n[result clipped]`
      : answer;
  status(`Subagent finished · ${request.title}`);
  return {
    ok: true,
    title: request.title,
    message: clip(answer.split("\n").find((line) => line.trim()) ?? answer, 160),
    result,
    tools: toolNames(messages),
    sessionId: child.id,
    passes,
  };
}
