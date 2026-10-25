import { describe, expect, it } from "vitest";

import { extractiveSummary, planCompaction } from "@/lib/compact";
import type { StoredMessage } from "@/lib/types";

function message(partial: Partial<StoredMessage> & Pick<StoredMessage, "seq" | "role" | "content">): StoredMessage {
  return {
    id: `m${partial.seq}`,
    sessionId: "s",
    toolCalls: null,
    toolCallId: null,
    toolName: null,
    reasoning: null,
    attachments: [],
    createdAt: partial.seq,
    ...partial,
  };
}

describe("compaction", () => {
  it("keeps the last two turns and marks the boundary", () => {
    const messages: StoredMessage[] = [];
    for (let turn = 0; turn < 4; turn += 1) {
      messages.push(message({ seq: turn * 2 + 1, role: "user", content: `q${turn} ${"a".repeat(5000)}` }));
      messages.push(message({ seq: turn * 2 + 2, role: "assistant", content: `a${turn} ${"b".repeat(1500)}` }));
    }
    const plan = planCompaction(messages);
    expect(plan).not.toBeNull();
    expect(plan?.throughSeq).toBe(4);
    expect(plan?.source.map((item) => item.seq)).toEqual([1, 2, 3, 4]);
  });

  it("does not compact a short history", () => {
    const messages = [message({ seq: 1, role: "user", content: "hello" })];
    expect(planCompaction(messages)).toBeNull();
  });

  it("clips an extractive summary instead of dropping it silently", () => {
    const summary = extractiveSummary(
      "earlier",
      [message({ seq: 1, role: "user", content: "z".repeat(8000) })],
    );
    expect(summary.endsWith("[summary clipped]") || summary.length <= 4500).toBe(true);
    expect(summary).toContain("earlier");
  });
});
