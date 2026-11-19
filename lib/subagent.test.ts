import { beforeEach, describe, expect, it } from "vitest";

import { runTurn } from "@/lib/agent";
import type { CompletionDelta, CompletionRequest } from "@/lib/lmstudio";
import {
  compactSubagentSession,
  readDelegateRequest,
  runSubagent,
} from "@/lib/subagent";
import { createSession, createSubagentSession, getSession, insertMessage, listMessages, visibleMessages } from "@/lib/sessions";
import { makeHome } from "@/lib/test-home";

beforeEach(() => {
  makeHome();
});

describe("subagent", () => {
  it("refuses an empty task and a nested delegate", async () => {
    expect(readDelegateRequest("{}")).toEqual({ ok: false, error: "delegate requires task." });
    const parent = createSession();
    const child = createSubagentSession({
      parentId: parent.id,
      title: "Nested",
      endpointId: parent.endpointId,
      model: parent.model,
      systemPrompt: "task",
    });
    const refused = await runSubagent({
      parentSessionId: child.id,
      rawArgs: JSON.stringify({ task: "Do more." }),
      complete: async function* () {
        yield { type: "text", text: "should not run" };
      },
    });
    expect(refused.ok).toBe(false);
    expect(String(refused.error)).toContain("cannot delegate");
    expect(listMessages(child.id)).toHaveLength(0);
  });

  it("compacts the child transcript once the working set grows", () => {
    const parent = createSession();
    const child = createSubagentSession({
      parentId: parent.id,
      title: "Pages",
      endpointId: parent.endpointId,
      model: parent.model,
      systemPrompt: "Read the pages.",
    });
    insertMessage({ sessionId: child.id, role: "user", content: "Read both pages." });
    insertMessage({
      sessionId: child.id,
      role: "assistant",
      content: "",
      toolCalls: [{ id: "c1", name: "fetch_url", arguments: "{}" }],
    });
    insertMessage({
      sessionId: child.id,
      role: "tool",
      toolCallId: "c1",
      toolName: "fetch_url",
      content: `FIRST_PAGE_${"a".repeat(8_000)}`,
    });
    insertMessage({ sessionId: child.id, role: "assistant", content: "Next page." });
    insertMessage({
      sessionId: child.id,
      role: "tool",
      toolCallId: "c2",
      toolName: "fetch_url",
      content: "SECOND_PAGE is the one that matters.",
    });

    expect(compactSubagentSession(child.id)).toBe(true);
    const saved = getSession(child.id);
    const visible = visibleMessages(saved!, listMessages(child.id)).map((message) => message.content).join("\n");
    expect(saved?.compactedSummary).toContain("FIRST_PAGE");
    expect(visible).not.toContain("FIRST_PAGE");
    expect(visible).toContain("SECOND_PAGE");
  });

  it("stops the parent after three subagents in one turn", async () => {
    const session = createSession();
    let subagents = 0;
    let parentCalls = 0;
    const complete = async function* (request: CompletionRequest): AsyncGenerator<CompletionDelta> {
      const system = String(request.messages[0]?.content ?? "");
      if (system.startsWith("Create a concise, high-level title")) {
        yield { type: "text", text: "Weather checks" };
        yield { type: "finish", reason: "stop" };
        return;
      }
      if (system.includes("You are a Meridian subagent")) {
        subagents += 1;
        yield { type: "text", text: `Finding ${subagents}.` };
        yield { type: "finish", reason: "stop" };
        return;
      }
      parentCalls += 1;
      if (parentCalls > 1 || !request.tools) {
        yield { type: "text", text: "Three findings are enough." };
        yield { type: "finish", reason: "stop" };
        return;
      }
      yield {
        type: "tool_delta",
        index: 0,
        id: "d1",
        name: "delegate",
        arguments: JSON.stringify({ task: "One", context: "A" }),
      };
      yield {
        type: "tool_delta",
        index: 1,
        id: "d2",
        name: "delegate",
        arguments: JSON.stringify({ task: "Two", context: "B" }),
      };
      yield {
        type: "tool_delta",
        index: 2,
        id: "d3",
        name: "delegate",
        arguments: JSON.stringify({ task: "Three", context: "C" }),
      };
      yield {
        type: "tool_delta",
        index: 3,
        id: "d4",
        name: "delegate",
        arguments: JSON.stringify({ task: "Four", context: "D" }),
      };
      yield { type: "finish", reason: "tool_calls" };
    };

    await runTurn({
      sessionId: session.id,
      content: "Split this four ways.",
      emit: () => undefined,
      complete,
    });

    const results = listMessages(session.id).filter((message) => message.toolName === "delegate");
    expect(subagents).toBe(3);
    expect(results).toHaveLength(4);
    expect(results.slice(0, 3).every((message) => message.content.includes('"ok": true'))).toBe(true);
    expect(results[3]?.content).toContain("already ran 3 subagents");
  });

  it("gives a running subagent the steer before its next pass", async () => {
    const parent = createSession();
    const queued: string[] = [];
    const steered: string[] = [];
    let calls = 0;
    const result = await runSubagent({
      parentSessionId: parent.id,
      rawArgs: JSON.stringify({ task: "Look up trains to Kyoto.", context: "April trip." }),
      pullSteers: () => queued.splice(0, queued.length),
      onSteered: (text) => steered.push(text),
      complete: async function* (request) {
        calls += 1;
        if (calls === 1) {
          yield { type: "text", text: "Checking trains." };
          queued.push("Skip the lookup. Just say pears.");
          throw new DOMException("Aborted", "AbortError");
        }
        const blob = request.messages.map((message) => String(message.content ?? "")).join("\n");
        expect(blob).toContain("The user steered:");
        expect(blob).toContain("Just say pears.");
        expect(blob.indexOf("Checking trains.")).toBeLessThan(blob.indexOf("Just say pears."));
        yield { type: "text", text: "Pears." };
        yield { type: "finish", reason: "stop" };
      },
    });

    expect(result.ok).toBe(true);
    expect(result.result).toBe("Pears.");
    expect(steered).toEqual(["Skip the lookup. Just say pears."]);
    expect(calls).toBe(2);
  });
});
