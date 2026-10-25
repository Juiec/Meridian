import { scrubSecrets } from "@/lib/errors";
import { isTransientError, withNetworkRetries } from "@/lib/retry";
import type { ToolDefinition } from "@/lib/tools";

export type ApiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content:
    | string
    | null
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

export type CompletionRequest = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: ApiMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type CompletionDelta =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool_delta"; index: number; id?: string; name?: string; arguments?: string }
  | { type: "finish"; reason: string | null };

export class LmStudioError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(scrubSecrets(message));
    this.name = "LmStudioError";
    this.status = status;
  }
}

type ToolChunk = {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
};

type ChoiceChunk = {
  delta?: {
    content?: string | null;
    reasoning?: string | null;
    reasoning_content?: string | null;
    tool_calls?: ToolChunk[];
  };
  message?: {
    content?: string | null;
    reasoning?: string | null;
    reasoning_content?: string | null;
    tool_calls?: ToolChunk[];
  };
  finish_reason?: string | null;
};

export function parseSseEvent(raw: string): CompletionDelta[] {
  const data = raw
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  if (!data) return [];
  if (data === "[DONE]") return [{ type: "finish", reason: "stop" }];
  let json: { error?: { message?: string }; choices?: ChoiceChunk[] };
  try {
    json = JSON.parse(data) as { error?: { message?: string }; choices?: ChoiceChunk[] };
  } catch {
    return [];
  }
  if (json.error) {
    throw new LmStudioError(json.error.message || "LM Studio returned an error.");
  }
  return deltasFromChoice(json.choices?.[0]);
}

export function deltasFromChoice(choice: ChoiceChunk | undefined): CompletionDelta[] {
  if (!choice) return [];
  const payload = choice.delta || choice.message;
  const out: CompletionDelta[] = [];
  if (payload) {
    if (typeof payload.content === "string" && payload.content) {
      out.push({ type: "text", text: payload.content });
    }
    const reasoning = payload.reasoning_content || payload.reasoning;
    if (typeof reasoning === "string" && reasoning) {
      out.push({ type: "reasoning", text: reasoning });
    }
    if (Array.isArray(payload.tool_calls)) {
      payload.tool_calls.forEach((call, position) => {
        out.push({
          type: "tool_delta",
          index: call.index ?? position,
          id: call.id,
          name: call.function?.name,
          arguments: call.function?.arguments,
        });
      });
    }
  }
  if (choice.finish_reason) out.push({ type: "finish", reason: choice.finish_reason });
  return out;
}

export function consumeSseBuffer(buffer: string): { events: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  return { events: parts.filter((part) => part.trim().length > 0), rest };
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function headers(apiKey?: string): Headers {
  const result = new Headers({ "Content-Type": "application/json" });
  if (apiKey) result.set("Authorization", `Bearer ${apiKey}`);
  return result;
}

async function errorFromResponse(response: Response): Promise<LmStudioError> {
  const text = await response.text();
  let message = text.slice(0, 800) || `LM Studio returned HTTP ${response.status}.`;
  try {
    const json = JSON.parse(text) as { error?: { message?: string } | string };
    if (typeof json.error === "string") message = json.error;
    else if (json.error?.message) message = json.error.message;
  } catch {
    // body was not JSON
  }
  return new LmStudioError(message, response.status);
}

export async function* streamCompletion(
  request: CompletionRequest,
  fetchImpl: typeof fetch = fetch,
): AsyncGenerator<CompletionDelta> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
    stream: true,
    temperature: request.temperature ?? 0.4,
  };
  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools;
    body.tool_choice = "auto";
  }
  if (request.maxTokens) body.max_tokens = request.maxTokens;

  const send = (payload: Record<string, unknown>) =>
    fetchImpl(endpoint(request.baseUrl), {
      method: "POST",
      headers: headers(request.apiKey),
      body: JSON.stringify(payload),
      signal: request.signal,
    });

  const response = await withNetworkRetries(
    async () => {
      let next = await send(body);
      if (!next.ok && body.tool_choice) {
        const failed = await errorFromResponse(next);
        if (failed.status === 400 && /tool_choice/i.test(failed.message)) {
          delete body.tool_choice;
          next = await send(body);
        } else {
          throw failed;
        }
      }
      if (!next.ok) throw await errorFromResponse(next);
      return next;
    },
    { signal: request.signal, retryIf: isTransientError },
  );

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = (await response.json()) as { choices?: ChoiceChunk[]; error?: { message?: string } };
    if (json.error) throw new LmStudioError(json.error.message || "LM Studio returned an error.");
    yield* deltasFromChoice(json.choices?.[0]);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new LmStudioError("LM Studio returned an empty stream.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const consumed = consumeSseBuffer(buffer);
    buffer = consumed.rest;
    for (const event of consumed.events) {
      yield* parseSseEvent(event);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    const consumed = consumeSseBuffer(`${buffer}\n\n`);
    for (const event of consumed.events) yield* parseSseEvent(event);
  }
}

export async function listModels(input: {
  baseUrl: string;
  apiKey?: string;
  signal?: AbortSignal;
}): Promise<string[]> {
  const response = await withNetworkRetries(
    async () => {
      const next = await fetch(`${input.baseUrl.replace(/\/$/, "")}/models`, {
        headers: input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {},
        signal: input.signal,
      });
      if (!next.ok) throw await errorFromResponse(next);
      return next;
    },
    { signal: input.signal, retryIf: isTransientError },
  );
  const json = (await response.json()) as { data?: Array<{ id?: string }> };
  const ids = (json.data ?? [])
    .map((item) => item.id?.trim() || "")
    .filter((id) => id.length > 0);
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}
