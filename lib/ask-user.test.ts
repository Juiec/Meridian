import { describe, expect, it } from "vitest";

import {
  askAnswerPayload,
  findPendingQuestion,
  matchAskOption,
  parseAskUser,
  readAskAnswer,
} from "@/lib/ask-user";
import type { StoredMessage } from "@/lib/types";

const sample = JSON.stringify({
  prompt: "Which launch shape should the plan follow?",
  options: [
    { label: "A quiet beta for the existing users", value: "beta" },
    { label: "A public launch next month", value: "public" },
  ],
});

function message(partial: Partial<StoredMessage> & Pick<StoredMessage, "id" | "seq" | "role">): StoredMessage {
  return {
    sessionId: "s",
    content: "",
    toolCalls: null,
    toolCallId: null,
    toolName: null,
    reasoning: null,
    attachments: [],
    createdAt: partial.seq,
    ...partial,
  };
}

describe("ask_user arguments", () => {
  it("accepts a question with distinct directions", () => {
    const parsed = parseAskUser(sample);
    expect(parsed).toMatchObject({
      ok: true,
      prompt: "Which launch shape should the plan follow?",
    });
    if (parsed.ok) {
      expect(parsed.options).toEqual([
        { label: "A quiet beta for the existing users", value: "beta" },
        { label: "A public launch next month", value: "public" },
      ]);
    }
  });

  it("accepts reply strings and fills the value from the label", () => {
    const parsed = parseAskUser(
      JSON.stringify({
        prompt: "Where should the day start?",
        options: ["Stay in Kyoto", "Add Osaka"],
      }),
    );
    expect(parsed).toMatchObject({
      ok: true,
      options: [
        { label: "Stay in Kyoto", value: "Stay in Kyoto" },
        { label: "Add Osaka", value: "Add Osaka" },
      ],
    });
  });

  it("rejects a question that is not a real choice", () => {
    expect(parseAskUser(JSON.stringify({ prompt: "Which way?", options: [{ label: "Only one" }] }))).toMatchObject({
      ok: false,
      error: "ask_user needs 2 to 4 options.",
    });
    expect(
      parseAskUser(
        JSON.stringify({
          prompt: "Which way?",
          options: [
            { label: "Kyoto", value: "kyoto" },
            { label: "kyoto", value: "Kyoto" },
          ],
        }),
      ),
    ).toMatchObject({ ok: false, error: "Options must be distinct directions." });
    expect(parseAskUser("{")).toMatchObject({ ok: false });
    expect(parseAskUser(JSON.stringify({ prompt: "  ", options: ["A", "B"] }))).toMatchObject({
      ok: false,
      error: "ask_user needs a prompt: one natural question.",
    });
  });

  it("matches a tapped label or a typed value and records a custom reply", () => {
    const parsed = parseAskUser(sample);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(matchAskOption(parsed.options, "A public launch next month")?.value).toBe("public");
    expect(matchAskOption(parsed.options, "BETA")?.label).toBe("A quiet beta for the existing users");
    expect(matchAskOption(parsed.options, "Hold the launch")).toBeNull();
    expect(askAnswerPayload(parsed.options, "beta")).toMatchObject({
      ok: true,
      answer: "A quiet beta for the existing users",
      option: "beta",
    });
    expect(askAnswerPayload(parsed.options, "Hold the launch until the editor is ready")).toMatchObject({
      answer: "Hold the launch until the editor is ready",
      option: null,
    });
  });

  it("finds an unanswered question and ignores one that already has a result", () => {
    const pending = findPendingQuestion([
      message({ id: "u", seq: 1, role: "user", content: "Plan the launch." }),
      message({
        id: "a",
        seq: 2,
        role: "assistant",
        toolCalls: [{ id: "call_ask", name: "ask_user", arguments: sample }],
      }),
    ]);
    expect(pending?.call.id).toBe("call_ask");
    expect(pending?.prompt).toContain("launch shape");

    const settled = readAskAnswer(
      JSON.stringify({ ok: true, answer: "A quiet beta for the existing users", option: "beta" }),
    );
    expect(settled?.option).toBe("beta");
    expect(
      findPendingQuestion([
        message({
          id: "a",
          seq: 2,
          role: "assistant",
          toolCalls: [{ id: "call_ask", name: "ask_user", arguments: sample }],
        }),
        message({
          id: "t",
          seq: 3,
          role: "tool",
          toolCallId: "call_ask",
          toolName: "ask_user",
          content: JSON.stringify({ ok: true, answer: "A quiet beta for the existing users", option: "beta" }),
        }),
      ]),
    ).toBeNull();
  });

  it("still waits when a later question reuses an earlier call id", () => {
    const pending = findPendingQuestion([
      message({
        id: "a1",
        seq: 2,
        role: "assistant",
        toolCalls: [{ id: "call_ask", name: "ask_user", arguments: sample }],
      }),
      message({
        id: "t1",
        seq: 3,
        role: "tool",
        toolCallId: "call_ask",
        toolName: "ask_user",
        content: JSON.stringify({ ok: true, answer: "A quiet beta for the existing users", option: "beta" }),
      }),
      message({
        id: "a2",
        seq: 5,
        role: "assistant",
        toolCalls: [{ id: "call_ask", name: "ask_user", arguments: sample }],
      }),
    ]);
    expect(pending?.call.id).toBe("call_ask");
    expect(pending?.prompt).toContain("launch shape");
  });
});
