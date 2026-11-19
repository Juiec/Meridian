import type { StoredMessage, ToolCallRecord } from "@/lib/types";

export const ASK_USER_NAME = "ask_user";

const PROMPT_MAX = 400;
const LABEL_MAX = 180;

export type AskOption = {
  label: string;
  value: string;
};

export const ASK_USER_TOOL = {
  type: "function" as const,
  function: {
    name: ASK_USER_NAME,
    description:
      "Plan mode only. Ask one clarifying question when a missing choice would change the plan and you cannot look it up or reasonably assume it. Call this alone, then stop. The prompt is one natural question. Provide 2 to 4 options, each a distinct direction written as a reply the user might type. Do not use this for facts a read-only tool can fetch, or for details you can decide.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        prompt: {
          type: "string",
          description: "One natural question. Ask only what would change the plan.",
        },
        options: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: {
                type: "string",
                description: "A direction written as a reply the user might type.",
              },
              value: {
                type: "string",
                description: "Short id for this direction. Omit to reuse the label.",
              },
            },
            required: ["label"],
          },
        },
      },
      required: ["prompt", "options"],
    },
  },
};

export type PendingQuestion = {
  call: ToolCallRecord;
  prompt: string;
  options: AskOption[];
};

function clipLabel(value: string): string | null {
  const label = value.trim();
  if (!label || label.length > LABEL_MAX) return null;
  return label;
}

function readOption(item: unknown): AskOption | null {
  if (typeof item === "string") {
    const label = clipLabel(item);
    return label ? { label, value: label } : null;
  }
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;
  if (typeof record.label !== "string") return null;
  const label = clipLabel(record.label);
  if (!label) return null;
  const rawValue = typeof record.value === "string" ? record.value.trim() : "";
  if (rawValue.length > LABEL_MAX) return null;
  return { label, value: rawValue || label };
}

function sameText(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

export function parseAskUser(
  raw: string,
): { ok: true; prompt: string; options: AskOption[] } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Arguments were not valid JSON." };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "ask_user arguments must be an object with prompt and options." };
  }
  const record = value as Record<string, unknown>;
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  if (!prompt) return { ok: false, error: "ask_user needs a prompt: one natural question." };
  if (prompt.length > PROMPT_MAX) {
    return { ok: false, error: `ask_user prompt must be ${PROMPT_MAX} characters or fewer.` };
  }
  if (!Array.isArray(record.options)) return { ok: false, error: "ask_user needs 2 to 4 options." };
  const options: AskOption[] = [];
  for (const item of record.options) {
    const option = readOption(item);
    if (!option) {
      return { ok: false, error: "Each option needs a label written as a reply the user might type." };
    }
    options.push(option);
  }
  if (options.length < 2 || options.length > 4) return { ok: false, error: "ask_user needs 2 to 4 options." };
  for (let i = 0; i < options.length; i += 1) {
    for (let j = i + 1; j < options.length; j += 1) {
      if (sameText(options[i].label, options[j].label) || sameText(options[i].value, options[j].value)) {
        return { ok: false, error: "Options must be distinct directions." };
      }
    }
  }
  return { ok: true, prompt, options };
}

export function matchAskOption(options: AskOption[], answerText: string): AskOption | null {
  const text = answerText.trim();
  if (!text) return null;
  return options.find((option) => sameText(option.label, text) || sameText(option.value, text)) ?? null;
}

export function askAnswerPayload(options: AskOption[], answerText: string): {
  ok: true;
  answer: string;
  option: string | null;
  message: string;
} {
  const matched = matchAskOption(options, answerText);
  const answer = matched?.label ?? answerText.trim();
  return {
    ok: true,
    answer,
    option: matched?.value ?? null,
    message: `The user chose: ${answer}`,
  };
}

export function readAskAnswer(result?: string | null): { answer: string; option: string | null } | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result) as { ok?: boolean; answer?: unknown; option?: unknown };
    if (parsed.ok === false || typeof parsed.answer !== "string" || !parsed.answer.trim()) return null;
    return {
      answer: parsed.answer.trim(),
      option: typeof parsed.option === "string" && parsed.option.trim() ? parsed.option : null,
    };
  } catch {
    return null;
  }
}

/** The latest ask_user call that still has no later tool result. */
export function findPendingQuestion(messages: StoredMessage[]): PendingQuestion | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant" || !message.toolCalls) continue;
    for (let j = message.toolCalls.length - 1; j >= 0; j -= 1) {
      const call = message.toolCalls[j];
      if (call.name !== ASK_USER_NAME) continue;
      const answered = messages.some(
        (item) => item.role === "tool" && item.toolCallId === call.id && item.seq > message.seq,
      );
      if (answered) continue;
      const parsed = parseAskUser(call.arguments);
      if (!parsed.ok) continue;
      return { call, prompt: parsed.prompt, options: parsed.options };
    }
  }
  return null;
}
