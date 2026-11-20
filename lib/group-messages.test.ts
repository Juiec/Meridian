import { describe, expect, it } from "vitest";

import { groupMessages } from "@/lib/group-messages";
import type { StoredMessage } from "@/lib/types";

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

describe("groupMessages", () => {
  it("folds a tool call and its result into one assistant turn", () => {
    const items = groupMessages([
      message({ id: "u", seq: 1, role: "user", content: "Remember this" }),
      message({
        id: "a",
        seq: 2,
        role: "assistant",
        content: "Saving it.",
        toolCalls: [{ id: "c1", name: "memory", arguments: "{}" }],
      }),
      message({
        id: "t",
        seq: 3,
        role: "tool",
        toolCallId: "c1",
        toolName: "memory",
        content: JSON.stringify({ ok: true, message: "Updated USER." }),
      }),
      message({ id: "a2", seq: 4, role: "assistant", content: "Done." }),
    ]);
    expect(items).toHaveLength(2);
    expect(items[1]?.kind).toBe("assistant");
    if (items[1]?.kind === "assistant") {
      expect(items[1].parts.map((part) => part.kind)).toEqual(["text", "tool", "text"]);
      const tool = items[1].parts[1];
      expect(tool?.kind).toBe("tool");
      if (tool?.kind === "tool") expect(tool.ok).toBe(true);
    }
  });

  it("keeps an unanswered plan question waiting instead of running", () => {
    const items = groupMessages([
      message({
        id: "a",
        seq: 1,
        role: "assistant",
        toolCalls: [
          {
            id: "q1",
            name: "ask_user",
            arguments: JSON.stringify({
              prompt: "Which way?",
              options: [
                { label: "Stay in Kyoto", value: "kyoto" },
                { label: "Add Osaka", value: "osaka" },
              ],
            }),
          },
        ],
      }),
    ]);
    expect(items[0]?.kind).toBe("assistant");
    if (items[0]?.kind !== "assistant") return;
    const part = items[0].parts[0];
    expect(part?.kind).toBe("tool");
    if (part?.kind === "tool") {
      expect(part.pending).toBe(false);
      expect(part.awaitingUser).toBe(true);
    }
  });
});
