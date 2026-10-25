import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { runTurn } from "@/lib/agent";
import type { CompletionDelta, CompletionRequest } from "@/lib/lmstudio";
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
    call += 1;
    for (const delta of handler(request, call)) yield delta;
  };
}

describe("agent loop", () => {
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

  it("inlines /skill:name without storing the body as the user message", async () => {
    const session = createSession();
    let seenUser = "";
    await runTurn({
      sessionId: session.id,
      content: "/skill:code-explain what does `return 1` do?",
      emit: () => undefined,
      complete: scripted((request) => {
        const user = request.messages.find((message) => message.role === "user");
        seenUser = String(user?.content ?? "");
        return [{ type: "text", text: "It returns 1." }, { type: "finish", reason: "stop" }];
      }),
    });
    expect(seenUser).toContain('<skill name="code-explain">');
    expect(seenUser).toContain("Explain code");
    expect(seenUser).toContain("what does `return 1` do?");
    const stored = listMessages(session.id).find((message) => message.role === "user");
    expect(stored?.content.startsWith("/skill:code-explain")).toBe(true);
    expect(stored?.content).not.toContain("Explain code");
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
