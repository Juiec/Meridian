import type { ToolCallRecord } from "@/lib/types";

export type TextToolParameter = {
  name: string;
  value: string;
  /** The closing tag has not arrived yet. The value is whatever has been written so far. */
  partial: boolean;
};

export type TextSpan =
  | { kind: "prose"; text: string }
  | {
      kind: "call";
      closed: boolean;
      name: string;
      /** JSON arguments when the block is complete enough to run. */
      arguments: string | null;
      parameters: TextToolParameter[];
      raw: string;
    };

/**
 * Qwen-style tool calls arrive as text instead of API tool_calls:
 *
 *   <tool_call>
 *   <function=workspace_write>
 *   <parameter=path>
 *   ...
 *   </parameter>
 *   </function>
 *   </tool_call>
 *
 * A JSON object in the same tags is accepted too. An unclosed block at the
 * end of a stream is kept intact for display and is not executed.
 */
export function splitToolCallText(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const openRe = /<tool_call>/gi;
  let match: RegExpExecArray | null;
  let cursor = 0;
  while ((match = openRe.exec(text))) {
    const start = match.index;
    if (start > cursor) spans.push({ kind: "prose", text: text.slice(cursor, start) });
    const closeRe = /<\/tool_call>/gi;
    closeRe.lastIndex = openRe.lastIndex;
    const close = closeRe.exec(text);
    if (!close) {
      spans.push(toCall(text.slice(start), false));
      cursor = text.length;
      break;
    }
    const end = close.index + close[0].length;
    spans.push(toCall(text.slice(start, end), true));
    cursor = end;
    openRe.lastIndex = end;
  }
  if (cursor < text.length) spans.push({ kind: "prose", text: text.slice(cursor) });
  return spans.filter((span) => span.kind !== "prose" || span.text.length > 0);
}

export function extractTextToolCalls(text: string): {
  prose: string;
  calls: Array<{ name: string; arguments: string }>;
} {
  if (!/<tool_call>/i.test(text)) return { prose: text, calls: [] };
  const calls: Array<{ name: string; arguments: string }> = [];
  let prose = "";
  for (const span of splitToolCallText(text)) {
    if (span.kind === "prose") {
      prose += span.text;
      continue;
    }
    if (!span.arguments || !span.name) {
      prose += span.raw;
      continue;
    }
    calls.push({ name: span.name, arguments: span.arguments });
  }
  return { prose: prose.trim(), calls };
}

/** Merge native tool deltas with complete text tool calls from the reply. */
export function resolveTurnCalls(
  text: string,
  native: ToolCallRecord[],
  pass: number,
  allowTextCalls: boolean,
): { prose: string; calls: ToolCallRecord[] } {
  if (!allowTextCalls) return { prose: text, calls: native };
  const extracted = extractTextToolCalls(text);
  return {
    prose: extracted.prose,
    calls: [
      ...native,
      ...extracted.calls.map((call, index) => ({
        id: `call_${pass}_xml_${index}`,
        name: call.name,
        arguments: call.arguments,
      })),
    ],
  };
}

function toCall(raw: string, closed: boolean): TextSpan {
  const inner = raw.replace(/^<tool_call>/i, "").replace(/<\/tool_call>$/i, "");
  const json = closed ? parseJsonCall(inner.trim()) : null;
  if (json) {
    return {
      kind: "call",
      closed,
      name: json.name,
      arguments: json.arguments,
      parameters: parametersFromArguments(json.arguments),
      raw,
    };
  }
  const name = /<function\s*=\s*([^\s>]+)>/i.exec(inner)?.[1] ?? "";
  const parameters = readParameters(inner);
  const executable = closed && name.length > 0 && parameters.every((param) => !param.partial);
  const args: Record<string, string> = {};
  if (executable) {
    for (const param of parameters) args[param.name] = param.value;
  }
  return {
    kind: "call",
    closed,
    name,
    arguments: executable ? (parameters.length > 0 ? JSON.stringify(args) : "{}") : null,
    parameters,
    raw,
  };
}

function parseJsonCall(inner: string): { name: string; arguments: string } | null {
  if (!inner.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(inner) as { name?: unknown; arguments?: unknown };
    if (typeof parsed.name !== "string" || !parsed.name.trim()) return null;
    const args = parsed.arguments ?? {};
    if (typeof args === "string") {
      try {
        const nested = JSON.parse(args) as unknown;
        if (nested && typeof nested === "object") return { name: parsed.name.trim(), arguments: args };
      } catch {
        return null;
      }
      return null;
    }
    if (!args || typeof args !== "object") return null;
    return { name: parsed.name.trim(), arguments: JSON.stringify(args) };
  } catch {
    return null;
  }
}

function parametersFromArguments(json: string): TextToolParameter[] {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.entries(parsed).map(([name, value]) => ({
      name,
      value: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      partial: false,
    }));
  } catch {
    return [];
  }
}

function readParameters(inner: string): TextToolParameter[] {
  const parameters: TextToolParameter[] = [];
  const closed = /<parameter\s*=\s*([^\s>]+)>([\s\S]*?)<\/parameter>/gi;
  let match: RegExpExecArray | null;
  let last = 0;
  while ((match = closed.exec(inner))) {
    parameters.push({ name: match[1], value: unwrapClosed(match[2]), partial: false });
    last = closed.lastIndex;
  }
  const rest = inner.slice(last);
  const partial = /<parameter\s*=\s*([^\s>]+)>([\s\S]*)$/i.exec(rest);
  if (partial) {
    parameters.push({ name: partial[1], value: unwrapOpen(partial[2]), partial: true });
  }
  return parameters;
}

/** Drop the newline the format inserts after the open tag and before the close tag. */
function unwrapClosed(value: string): string {
  return stripEdge(stripEdge(value, "start"), "end");
}

function unwrapOpen(value: string): string {
  return stripEdge(value, "start");
}

function stripEdge(value: string, edge: "start" | "end"): string {
  if (edge === "start") {
    if (value.startsWith("\r\n")) return value.slice(2);
    if (value.startsWith("\n")) return value.slice(1);
    return value;
  }
  if (value.endsWith("\r\n")) return value.slice(0, -2);
  if (value.endsWith("\n")) return value.slice(0, -1);
  return value;
}
