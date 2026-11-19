import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { runTurn } from "@/lib/agent";
import type { CompletionDelta, CompletionRequest } from "@/lib/lmstudio";
import { createSkill } from "@/lib/skill-store";
import { createSession, deleteSession, getSession, insertMessage, listMessages, listSessions } from "@/lib/sessions";
import { makeHome } from "@/lib/test-home";
import type { AgentEvent } from "@/lib/types";

beforeEach(() => {
  makeHome();
});

function scripted(handler: (request: CompletionRequest, call: number) => CompletionDelta[]): (
  request: CompletionRequest,
) => AsyncGenerator<CompletionDelta> {
  let call = 0;
  return async function* (request: CompletionRequest) {
    if (String(request.messages[0]?.content ?? "").startsWith("Create a concise, high-level title")) {
      yield { type: "text", text: "A concise chat summary" };
      yield { type: "finish", reason: "stop" };
      return;
    }
    call += 1;
    for (const delta of handler(request, call)) yield delta;
  };
}

describe("agent loop", () => {
  it("names the chat after the first answer is complete", async () => {
    const session = createSession();
    const events: AgentEvent[] = [];
    const requests: CompletionRequest[] = [];
    const complete = async function* (request: CompletionRequest) {
      requests.push(request);
      if (String(request.messages[0]?.content ?? "").startsWith("Create a concise, high-level title")) {
        yield { type: "text" as const, text: "Title: Planning a three-week Japan itinerary" };
        yield { type: "finish" as const, reason: "stop" };
        return;
      }
      yield { type: "text" as const, text: "Let's shape the itinerary." };
      yield { type: "finish" as const, reason: "stop" };
    };

    await runTurn({
      sessionId: session.id,
      content: "I want to travel to Japan for 21 days and need help deciding where to go.",
      emit: (event) => events.push(event),
      complete,
    });

    expect(requests[0]?.tools).toBeDefined();
    expect(requests[0]?.messages[1]?.content).toContain("21 days");
    expect(requests[1]?.tools).toBeUndefined();
    expect(requests[1]?.messages[1]?.content).toContain("21 days");
    expect(getSession(session.id)?.title).toBe("Planning a three-week Japan itinerary");
    const answerIndex = events.findIndex((event) => event.type === "delta" && event.text.includes("itinerary"));
    const titleIndex = events.findIndex((event) => event.type === "title");
    const doneIndex = events.findIndex((event) => event.type === "done");
    expect(answerIndex).toBeGreaterThanOrEqual(0);
    expect(titleIndex).toBeGreaterThan(answerIndex);
    expect(titleIndex).toBeLessThan(doneIndex);
    expect(events[titleIndex]).toMatchObject({ type: "title", title: "Planning a three-week Japan itinerary" });
  });

  it("falls back to the first message when naming fails after the answer", async () => {
    const session = createSession();
    const events: AgentEvent[] = [];
    let call = 0;
    const complete = async function* () {
      call += 1;
      if (call === 2) throw new Error("title service unavailable");
      yield { type: "text" as const, text: "The chat still works." };
      yield { type: "finish" as const, reason: "stop" };
    };

    await runTurn({
      sessionId: session.id,
      content: "Help me compare two apartments for a move next month.",
      emit: (event) => events.push(event),
      complete,
    });

    expect(getSession(session.id)?.title).toBe("Help me compare two apartments for a move next month.");
    expect(events.some((event) => event.type === "title_error" && event.message.includes("title service unavailable"))).toBe(true);
    expect(events.some((event) => event.type === "title" && event.title === "Help me compare two apartments for a move next month.")).toBe(true);
    expect(listMessages(session.id).some((message) => message.content === "The chat still works.")).toBe(true);
  });

  it("runs a tool, keeps the memory snapshot frozen, and writes the file", async () => {
    const session = createSession();
    const events: AgentEvent[] = [];
    const seen: CompletionRequest[] = [];
    await runTurn({
      sessionId: session.id,
      content: "Remember that I prefer short answers.",
      emit: (event) => events.push(event),
      complete: scripted((request, call) => {
        seen.push(request);
        if (call === 1) {
          return [
            {
              type: "tool_delta",
              index: 0,
              id: "call_mem",
              name: "memory",
              arguments: JSON.stringify({
                target: "user",
                operations: [{ action: "add", content: "Prefers short answers." }],
              }),
            },
            { type: "finish", reason: "tool_calls" },
          ];
        }
        return [
          { type: "text", text: "I'll keep that for next time." },
          { type: "finish", reason: "stop" },
        ];
      }),
    });

    const userFile = readFileSync(path.join(process.env.MERIDIAN_HOME ?? "", "data", "memory", "USER.md"), "utf8");
    expect(userFile).toContain("Prefers short answers.");
    const fresh = getSession(session.id);
    expect(fresh?.systemPrompt).not.toContain("Prefers short answers.");
    expect(events.some((event) => event.type === "tool_call" && event.call.name === "memory")).toBe(true);
    expect(events.some((event) => event.type === "tool_result" && event.ok)).toBe(true);
    expect(events.some((event) => event.type === "delta" && event.text.includes("next time"))).toBe(true);
    const second = seen[1];
    expect(second.messages.some((message) => message.role === "tool" && String(message.content).includes("Prefers short answers."))).toBe(true);
  });

  it("inlines /name without storing the body as the user message", async () => {
    const session = createSession();
    let seenUser = "";
    await runTurn({
      sessionId: session.id,
      content: "/code-explain what does `return 1` do?",
      emit: () => undefined,
      complete: scripted((request) => {
        const user = request.messages.find(
          (message) => message.role === "user" && String(message.content).includes("<skill name="),
        );
        seenUser = String(user?.content ?? "");
        return [{ type: "text", text: "It returns 1." }, { type: "finish", reason: "stop" }];
      }),
    });
    expect(seenUser).toContain('<skill name="code-explain">');
    expect(seenUser).toContain("Explain code");
    expect(seenUser).toContain("what does `return 1` do?");
    const stored = listMessages(session.id).find((message) => message.role === "user");
    expect(stored?.content.startsWith("/code-explain")).toBe(true);
    expect(stored?.content).not.toContain("Explain code");
  });

  it("refreshes the skills index in an existing session when a skill is added", async () => {
    const session = createSession();
    createSkill({
      name: "freshly-added",
      description: "A skill added after this session started.",
      body: "Use the newly installed procedure.",
      disableModelInvocation: false,
      references: [],
    });
    const events: AgentEvent[] = [];
    let seenSystem = "";
    await runTurn({
      sessionId: session.id,
      content: "Use the available skills.",
      emit: (event) => events.push(event),
      complete: scripted((request) => {
        seenSystem = String(request.messages[0]?.content ?? "");
        return [{ type: "text", text: "Ready." }, { type: "finish", reason: "stop" }];
      }),
    });
    expect(seenSystem).toContain("freshly-added");
    expect(getSession(session.id)?.systemPrompt).toContain("freshly-added");
    expect(events.some((event) => event.type === "note" && event.message.content.includes("refreshed from disk"))).toBe(true);
  });

  it("stops after the tool budget and answers without tools", async () => {
    const session = createSession();
    let calls = 0;
    await runTurn({
      sessionId: session.id,
      content: "What time is it?",
      emit: () => undefined,
      complete: scripted((request) => {
        calls += 1;
        if (!request.tools) {
          return [{ type: "text", text: "The clock was checked." }, { type: "finish", reason: "stop" }];
        }
        return [
          {
            type: "tool_delta",
            index: 0,
            id: `call_${calls}`,
            name: "current_time",
            arguments: "{}",
          },
          { type: "finish", reason: "tool_calls" },
        ];
      }),
    });
    expect(calls).toBe(6);
    expect(listMessages(session.id).some((message) => message.content.includes("The clock was checked."))).toBe(true);
  });

  it("compacts older turns through the model and rebuilds the prompt", async () => {
    const session = createSession();
    for (let turn = 0; turn < 4; turn += 1) {
      insertMessage({ sessionId: session.id, role: "user", content: `turn ${turn} ${"q".repeat(5000)}` });
      insertMessage({ sessionId: session.id, role: "assistant", content: `reply ${turn} ${"a".repeat(1500)}` });
    }
    const before = getSession(session.id)?.systemPrompt ?? "";
    const events: AgentEvent[] = [];
    await runTurn({
      sessionId: session.id,
      content: "Continue from here.",
      emit: (event) => events.push(event),
      complete: scripted((request) => {
        const system = String(request.messages[0]?.content ?? "");
        if (system.includes("compact chat history")) {
          return [{ type: "text", text: "They discussed four long turns." }, { type: "finish", reason: "stop" }];
        }
        return [{ type: "text", text: "Continuing." }, { type: "finish", reason: "stop" }];
      }),
    });
    const after = getSession(session.id);
    expect(events.some((event) => event.type === "compaction" && event.mode === "model")).toBe(true);
    expect(after?.compactedSummary).toBe("They discussed four long turns.");
    expect(after?.systemPrompt).not.toBe(before);
    expect(after?.systemPrompt).toContain("# Skills index");
  });

  it("keeps Ask mode read-only and rejects a memory write", async () => {
    const session = createSession();
    const events: AgentEvent[] = [];
    const seen: CompletionRequest[] = [];
    await runTurn({
      sessionId: session.id,
      content: "/ask Remember that I prefer short answers.",
      emit: (event) => events.push(event),
      complete: scripted((request, call) => {
        seen.push(request);
        if (call === 1) {
          return [
            {
              type: "tool_delta",
              index: 0,
              id: "call_mem",
              name: "memory",
              arguments: JSON.stringify({
                target: "user",
                operations: [{ action: "add", content: "Prefers short answers." }],
              }),
            },
            { type: "finish", reason: "tool_calls" },
          ];
        }
        return [{ type: "text", text: "Ask mode cannot save that." }, { type: "finish", reason: "stop" }];
      }),
    });

    const names = (seen[0]?.tools ?? []).map((tool) => tool.function.name);
    expect(names).toContain("fetch_url");
    expect(names).toContain("skill_view");
    expect(names).not.toContain("memory");
    expect(names).not.toContain("delegate");
    expect(names).not.toContain("image_generate");
    expect(names).not.toContain("travel_plan");
    expect(String(seen[0]?.messages[0]?.content)).toContain("Mode: Ask");
    expect(getSession(session.id)?.chatMode).toBe("ask");
    expect(getSession(session.id)?.systemPrompt).not.toContain("Mode: Ask");
    const result = events.find((event) => event.type === "tool_result");
    expect(result).toMatchObject({ type: "tool_result", ok: false });
    if (result?.type === "tool_result") expect(result.content).toContain("Ask mode blocked memory");
    const userFile = path.join(process.env.MERIDIAN_HOME ?? "", "data", "memory", "USER.md");
    expect(existsSync(userFile) && readFileSync(userFile, "utf8").includes("Prefers short answers.")).toBe(false);
  });

  it("stops Plan mode before image generation and keeps the mode until /agent", async () => {
    const session = createSession();
    const events: AgentEvent[] = [];
    let planTools: string[] = [];
    await runTurn({
      sessionId: session.id,
      content: "/plan-mode draw a lighthouse",
      emit: (event) => events.push(event),
      complete: scripted((request, call) => {
        planTools = (request.tools ?? []).map((tool) => tool.function.name);
        if (call === 1) {
          return [
            {
              type: "tool_delta",
              index: 0,
              id: "call_img",
              name: "image_generate",
              arguments: JSON.stringify({ prompt: "a lighthouse" }),
            },
            { type: "finish", reason: "tool_calls" },
          ];
        }
        return [{ type: "text", text: "Here is a plan." }, { type: "finish", reason: "stop" }];
      }),
    });

    expect(planTools).not.toContain("image_generate");
    expect(planTools).not.toContain("delegate");
    expect(planTools).toContain("fetch_url");
    expect(getSession(session.id)?.chatMode).toBe("plan");
    const blocked = events.find((event) => event.type === "tool_result");
    expect(blocked).toMatchObject({ type: "tool_result", ok: false });
    if (blocked?.type === "tool_result") expect(blocked.content).toContain("Plan mode blocked image_generate");

    let stillReadOnly = true;
    await runTurn({
      sessionId: session.id,
      content: "What should the next step be?",
      emit: () => undefined,
      complete: scripted((request) => {
        stillReadOnly = !(request.tools ?? []).some((tool) => tool.function.name === "memory");
        return [{ type: "text", text: "Check the forecast first." }, { type: "finish", reason: "stop" }];
      }),
    });
    expect(stillReadOnly).toBe(true);
    expect(getSession(session.id)?.chatMode).toBe("plan");

    let agentTools: string[] = [];
    await runTurn({
      sessionId: session.id,
      content: "/agent Remember that I prefer short answers.",
      emit: () => undefined,
      complete: scripted((request, call) => {
        agentTools = (request.tools ?? []).map((tool) => tool.function.name);
        if (call === 1) {
          return [
            {
              type: "tool_delta",
              index: 0,
              id: "call_mem",
              name: "memory",
              arguments: JSON.stringify({
                target: "user",
                operations: [{ action: "add", content: "Prefers short answers." }],
              }),
            },
            { type: "finish", reason: "tool_calls" },
          ];
        }
        return [{ type: "text", text: "Saved." }, { type: "finish", reason: "stop" }];
      }),
    });
    expect(agentTools).toContain("memory");
    expect(agentTools).toContain("delegate");
    expect(agentTools).toContain("image_generate");
    expect(getSession(session.id)?.chatMode).toBe("agent");
    const userFile = readFileSync(path.join(process.env.MERIDIAN_HOME ?? "", "data", "memory", "USER.md"), "utf8");
    expect(userFile).toContain("Prefers short answers.");
  });

  it("delegates into a clean subagent and leaves the tool trace out of the parent", async () => {
    const session = createSession();
    insertMessage({ sessionId: session.id, role: "user", content: "We are planning Kyoto in April." });
    insertMessage({
      sessionId: session.id,
      role: "assistant",
      content: "Trains only.",
      toolCalls: [{ id: "old", name: "fetch_url", arguments: "{}" }],
    });
    insertMessage({
      sessionId: session.id,
      role: "tool",
      content: `HUGE_TOOL_PAYLOAD_${"z".repeat(9000)}`,
      toolCallId: "old",
      toolName: "fetch_url",
    });

    const events: AgentEvent[] = [];
    const childToolNames: string[][] = [];
    let subCalls = 0;
    let parentCalls = 0;
    await runTurn({
      sessionId: session.id,
      content: "Check the weather without dragging the old page in.",
      emit: (event) => events.push(event),
      complete: scripted((request) => {
        const system = String(request.messages[0]?.content ?? "");
        if (system.includes("You are a Meridian subagent")) {
          subCalls += 1;
          childToolNames.push((request.tools ?? []).map((tool) => tool.function.name));
          if (subCalls === 1) {
            return [
              { type: "tool_delta", index: 0, id: "sub_time", name: "current_time", arguments: "{}" },
              { type: "finish", reason: "tool_calls" },
            ];
          }
          return [{ type: "text", text: "April in Kyoto is mild. Pack a light jacket." }, { type: "finish", reason: "stop" }];
        }
        parentCalls += 1;
        if (parentCalls === 1) {
          return [
            {
              type: "tool_delta",
              index: 0,
              id: "call_del",
              name: "delegate",
              arguments: JSON.stringify({
                title: "Kyoto weather",
                task: "Summarize April weather in Kyoto.",
                context: "Trip is Kyoto in April. Trains only. Do not use the old page.",
              }),
            },
            { type: "finish", reason: "tool_calls" },
          ];
        }
        return [{ type: "text", text: "Kyoto in April is mild." }, { type: "finish", reason: "stop" }];
      }),
    });

    const parentTool = listMessages(session.id).find((message) => message.toolName === "delegate");
    expect(parentTool?.content).toContain("Pack a light jacket");
    expect(parentTool?.content).not.toContain("HUGE_TOOL_PAYLOAD");
    expect(parentTool?.content).not.toContain("epochMs");
    const childId = JSON.parse(parentTool?.content ?? "{}").sessionId as string;
    const child = getSession(childId);
    expect(child?.purpose).toBe("subagent");
    expect(child?.parentId).toBe(session.id);
    expect(child?.systemPrompt).toContain("Summarize April weather in Kyoto.");
    expect(child?.systemPrompt).toContain("Trip is Kyoto in April");
    expect(child?.systemPrompt).not.toContain("HUGE_TOOL_PAYLOAD");
    expect(listSessions().map((item) => item.id)).not.toContain(childId);
    expect(listMessages(childId).some((message) => message.content.includes("epochMs"))).toBe(true);
    expect(childToolNames[0]).toContain("current_time");
    expect(childToolNames[0]).not.toContain("delegate");
    expect(events.some((event) => event.type === "subagent" && event.detail.includes("Kyoto weather"))).toBe(true);

    deleteSession(session.id);
    expect(getSession(childId)).toBeNull();
  });
});
