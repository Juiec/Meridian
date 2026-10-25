import type { StoredMessage } from "@/lib/types";

export const COMPACT_CHAR_LIMIT = 18_000;
export const COMPACT_KEEP_TURNS = 2;

export type CompactionPlan = {
  throughSeq: number;
  source: StoredMessage[];
};

function messageWeight(message: StoredMessage): number {
  const toolWeight = (message.toolCalls?.length ?? 0) * 80;
  return message.content.length + toolWeight + (message.reasoning?.length ?? 0);
}

export function groupTurns(messages: StoredMessage[]): StoredMessage[][] {
  const turns: StoredMessage[][] = [];
  for (const message of messages) {
    const startsTurn = message.role === "user" || message.role === "note" || turns.length === 0;
    if (startsTurn) turns.push([message]);
    else turns[turns.length - 1].push(message);
  }
  return turns;
}

export function planCompaction(
  messages: StoredMessage[],
  limit = COMPACT_CHAR_LIMIT,
): CompactionPlan | null {
  const total = messages.reduce((sum, message) => sum + messageWeight(message), 0);
  if (total <= limit) return null;
  const turns = groupTurns(messages);
  if (turns.length <= COMPACT_KEEP_TURNS) return null;
  const source = turns.slice(0, turns.length - COMPACT_KEEP_TURNS).flat();
  if (source.length === 0) return null;
  return { throughSeq: source[source.length - 1].seq, source };
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

export function extractiveSummary(previous: string | null, messages: StoredMessage[]): string {
  const lines: string[] = [];
  if (previous?.trim()) lines.push(`Earlier summary:\n${previous.trim()}`);
  for (const message of messages) {
    if (message.role === "tool") {
      lines.push(`Tool ${message.toolName ?? "result"}: ${clip(message.content, 280)}`);
    } else if (message.role === "assistant") {
      const tools = message.toolCalls?.map((call) => call.name).join(", ");
      const text = message.content.trim();
      lines.push(
        `Assistant: ${clip(text || "(no text)", 420)}${tools ? ` [tools: ${tools}]` : ""}`,
      );
    } else if (message.role === "note") {
      lines.push(`Note: ${clip(message.content, 300)}`);
    } else {
      lines.push(`User: ${clip(message.content, 500)}`);
    }
  }
  const summary = lines.join("\n");
  if (summary.length <= 4500) return summary;
  return `${summary.slice(0, 4500)}\n[summary clipped]`;
}

export const COMPACT_SYSTEM = `You compact chat history for a personal agent named Meridian. Write a dense factual summary the agent can continue from. Preserve decisions, preferences, names, paths, constraints, tool outcomes, and unfinished work. Omit pleasantries and tool-call narration. Use short paragraphs. Do not invent facts. Do not call tools.`;

export function summaryTranscript(previous: string | null, messages: StoredMessage[]): string {
  return extractiveSummary(previous, messages);
}
