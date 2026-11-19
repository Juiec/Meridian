import { describe, expect, it } from "vitest";

import { buildContextSummary, planSubagentFit, summarizeSubagentWork } from "@/lib/context-summary";
import type { StoredMessage } from "@/lib/types";

function message(partial: Partial<StoredMessage> & Pick<StoredMessage, "id" | "seq" | "role" | "content">): StoredMessage {
  return {
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

describe("context summary", () => {
  it("keeps the assigned facts and drops tool payloads", () => {
    const summary = buildContextSummary({
      supplied: "Trip is Kyoto in April. Trains only.",
      compactedSummary: "They already picked a ryokan.",
      messages: [
        message({ id: "u", seq: 1, role: "user", content: "We are planning Kyoto in April." }),
        message({
          id: "a",
          seq: 2,
          role: "assistant",
          content: "Trains only.",
          toolCalls: [{ id: "c", name: "fetch_url", arguments: "{}" }],
        }),
        message({
          id: "t",
          seq: 3,
          role: "tool",
          content: `HUGE_TOOL_PAYLOAD_${"z".repeat(9000)}`,
          toolName: "fetch_url",
        }),
      ],
    });

    expect(summary).toContain("Kyoto in April");
    expect(summary).toContain("Trains only.");
    expect(summary).toContain("ryokan");
    expect(summary).not.toContain("HUGE_TOOL_PAYLOAD");
    expect(summary.length).toBeLessThanOrEqual(1_800);
  });

  it("says when there is nothing to summarize", () => {
    expect(buildContextSummary({ messages: [] })).toBe("(No earlier context. Work only from the task.)");
  });

  it("clips an oversized brief", () => {
    const summary = buildContextSummary({
      supplied: "A".repeat(2_000),
      compactedSummary: "C".repeat(2_000),
      messages: [message({ id: "u", seq: 1, role: "user", content: "B".repeat(2_000) })],
    });
    expect(summary.length).toBeLessThanOrEqual(1_800);
    expect(summary).toContain("[summary clipped]");
  });

  it("summarizes older subagent work and keeps the latest tool result", () => {
    const first = `FIRST_PAGE_${"a".repeat(8_000)}`;
    const messages = [
      message({ id: "u", seq: 1, role: "user", content: "Read both pages." }),
      message({ id: "a1", seq: 2, role: "assistant", content: "", toolCalls: [{ id: "c1", name: "fetch_url", arguments: "{}" }] }),
      message({ id: "t1", seq: 3, role: "tool", toolName: "fetch_url", content: first }),
      message({ id: "a2", seq: 4, role: "assistant", content: "Next page." }),
      message({ id: "t2", seq: 5, role: "tool", toolName: "fetch_url", content: "SECOND_PAGE is the one that matters." }),
    ];
    const plan = planSubagentFit(messages);
    expect(plan?.source.map((item) => item.id)).toEqual(["u", "a1", "t1"]);
    const summary = summarizeSubagentWork(null, plan?.source ?? []);
    expect(summary).toContain("FIRST_PAGE");
    expect(summary).not.toContain("a".repeat(1_000));
    expect(summary.length).toBeLessThanOrEqual(2_200);
  });
});
