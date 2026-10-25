import type { StoredMessage, ToolCallRecord } from "@/lib/types";

export type ToolPart = {
  kind: "tool";
  id: string;
  name: string;
  arguments: string;
  result?: string;
  pending?: boolean;
  ok?: boolean;
};

export type TranscriptItem =
  | { kind: "user"; id: string; content: string; attachments: { name: string; kind: "text" | "image" }[] }
  | { kind: "note"; id: string; content: string }
  | {
      kind: "assistant";
      id: string;
      reasoning: string;
      parts: Array<{ kind: "text"; text: string } | ToolPart>;
    };

export function groupMessages(messages: StoredMessage[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  let current: Extract<TranscriptItem, { kind: "assistant" }> | null = null;

  const flush = () => {
    if (current && (current.parts.length > 0 || current.reasoning)) items.push(current);
    current = null;
  };

  for (const message of messages) {
    if (message.role === "user") {
      flush();
      items.push({
        kind: "user",
        id: message.id,
        content: message.content,
        attachments: (message.attachments ?? []).map((item) => ({ name: item.name, kind: item.kind })),
      });
      continue;
    }
    if (message.role === "note") {
      flush();
      items.push({ kind: "note", id: message.id, content: message.content });
      continue;
    }
    if (!current) {
      current = { kind: "assistant", id: message.id, reasoning: "", parts: [] };
    }
    if (message.role === "assistant") {
      if (message.reasoning) current.reasoning = `${current.reasoning}${message.reasoning}`;
      if (message.content.trim()) current.parts.push({ kind: "text", text: message.content });
      for (const call of message.toolCalls ?? []) {
        current.parts.push(toolPart(call));
      }
      continue;
    }
    const part = [...current.parts].reverse().find((item) => item.kind === "tool" && item.id === message.toolCallId);
    if (part && part.kind === "tool") {
      part.result = message.content;
      part.pending = false;
      part.ok = toolOk(message.content);
    } else {
      current.parts.push({
        kind: "tool",
        id: message.toolCallId || message.id,
        name: message.toolName || "tool",
        arguments: "",
        result: message.content,
        pending: false,
        ok: toolOk(message.content),
      });
    }
  }
  flush();
  return items;
}

function toolPart(call: ToolCallRecord): ToolPart {
  return {
    kind: "tool",
    id: call.id,
    name: call.name,
    arguments: call.arguments,
    pending: true,
  };
}

function toolOk(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as { ok?: boolean };
    return parsed.ok !== false;
  } catch {
    return true;
  }
}
