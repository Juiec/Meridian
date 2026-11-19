import type { StoredMessage } from "@/lib/types";

/** Facts handed to a subagent. Stays short so a local model can start clean. */
export const CONTEXT_SUMMARY_MAX = 1_800;

/** Working set for one subagent. Older tool output is summarized past this. */
export const SUBAGENT_CHAR_LIMIT = 7_000;
export const SUBAGENT_KEEP_TAIL = 2;
export const SUBAGENT_WORK_MAX = 2_200;

function clip(value: string, max: number): string {
  const clean = value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1))}…`;
}

function weight(message: StoredMessage): number {
  return message.content.length + (message.reasoning?.length ?? 0);
}

export function buildContextSummary(input: {
  supplied?: string;
  compactedSummary?: string | null;
  messages: StoredMessage[];
}): string {
  const parts: string[] = [];
  const supplied = input.supplied?.trim() ?? "";
  if (supplied) parts.push(`Assigned context:\n${clip(supplied, 900)}`);

  const earlier = input.compactedSummary?.trim() ?? "";
  if (earlier) parts.push(`Earlier chat:\n${clip(earlier, 700)}`);

  const recent: string[] = [];
  const spoken = input.messages.filter((message) => message.role === "user" || message.role === "assistant");
  for (const message of spoken.slice(-4)) {
    const text = message.content.trim();
    if (!text) continue;
    const label = message.role === "user" ? "User" : "Assistant";
    recent.push(`${label}: ${clip(text.replace(/\s+/g, " "), 280)}`);
  }
  if (recent.length > 0) parts.push(`Recent exchange:\n${recent.join("\n")}`);

  const summary = parts.join("\n\n").trim();
  if (!summary) return "(No earlier context. Work only from the task.)";
  if (summary.length <= CONTEXT_SUMMARY_MAX) return summary;
  return `${summary.slice(0, CONTEXT_SUMMARY_MAX - 18).trimEnd()}\n[summary clipped]`;
}

export function planSubagentFit(
  messages: StoredMessage[],
  limit = SUBAGENT_CHAR_LIMIT,
): { throughSeq: number; source: StoredMessage[] } | null {
  const total = messages.reduce((sum, message) => sum + weight(message), 0);
  if (total <= limit) return null;
  if (messages.length <= SUBAGENT_KEEP_TAIL) return null;
  const source = messages.slice(0, messages.length - SUBAGENT_KEEP_TAIL);
  if (source.length === 0) return null;
  return { throughSeq: source[source.length - 1].seq, source };
}

export function summarizeSubagentWork(previous: string | null, messages: StoredMessage[]): string {
  const lines: string[] = [];
  if (previous?.trim()) lines.push(`Earlier work:\n${clip(previous, 800)}`);
  for (const message of messages) {
    if (message.role === "tool") {
      lines.push(`Tool ${message.toolName ?? "result"}: ${clip(message.content.replace(/\s+/g, " "), 700)}`);
    } else if (message.role === "assistant") {
      const tools = message.toolCalls?.map((call) => call.name).join(", ");
      const text = message.content.trim();
      if (text) lines.push(`Assistant: ${clip(text.replace(/\s+/g, " "), 400)}`);
      if (tools) lines.push(`Called: ${tools}`);
    } else if (message.role === "user") {
      lines.push(`Instruction: ${clip(message.content.replace(/\s+/g, " "), 300)}`);
    }
  }
  const summary = lines.join("\n").trim();
  if (!summary) return "(No earlier subagent work.)";
  if (summary.length <= SUBAGENT_WORK_MAX) return summary;
  return `${summary.slice(0, SUBAGENT_WORK_MAX - 18).trimEnd()}\n[summary clipped]`;
}
