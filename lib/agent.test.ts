import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { runTurn } from "@/lib/agent";
import type { CompletionDelta, CompletionRequest } from "@/lib/lmstudio";
import { createSkill } from "@/lib/skill-store";
import { createSession, getSession, insertMessage, listMessages } from "@/lib/sessions";
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
  it("generates a high-level chat title before answering the first request", async () => {
    const session = createSession();
    const events: AgentEvent[] = [];
    const requests: CompletionRequest[] = [];
    const complete = async function* (request: CompletionRequest) {
      requests.push(request);
      if (requests.length === 1) {
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

    expect(requests[0]?.tools).toBeUndefined();
    expect(requests[0]?.messages[1]?.content).toContain("21 days");
    expect(requests[1]?.messages.some((message) => message.role === "user" && String(message.content).includes("21 days"))).toBe(true);
    expect(getSession(session.id)?.title).toBe("Planning a three-week Japan itinerary");
    expect(events.findIndex((event) => event.type === "title")).toBeGreaterThan(events.findIndex((event) => event.type === "user"));
    expect(events.findIndex((event) => event.type === "title")).toBeLessThan(events.findIndex((event) => event.type === "iteration"));
  });

  it("reports title generation errors without blocking the chat response", async () => {
    const session = createSession();
    const events: AgentEvent[] = [];
    let call = 0;
    const complete = async function* () {
      call += 1;
      if (call === 1) throw new Error("title service unavailable");
      yield { type: "text" as const, text: "The chat still works." };
      yield { type: "finish" as const, reason: "stop" };
    };

    await runTurn({
      sessionId: session.id,
      content: "Help me compare two apartments for a move next month.",
      emit: (event) => events.push(event),
      complete,
    });

    expect(getSession(session.id)?.title).toBe("New session");
    expect(events.some((event) => event.type === "title_error" && event.message.includes("title service unavailable"))).toBe(true);
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
});
