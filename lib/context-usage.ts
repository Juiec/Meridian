import type { ApiMessage } from "@/lib/lmstudio";
import type { TripPlace } from "@/lib/travel-types";

export type ContextUsage = {
  chars: number;
  tokens: number;
  limitTokens: number | null;
  systemChars: number;
  historyChars: number;
  toolChars: number;
  thinkingChars: number;
};

export const CONTEXT_CLEANED_PREFIX = "Context cleaned.";

export function estimateTokens(chars: number): number {
  if (!Number.isFinite(chars) || chars <= 0) return 0;
  return Math.ceil(chars / 4);
}

function contentChars(content: ApiMessage["content"]): number {
  if (typeof content === "string") return content.length;
  if (!content) return 0;
  return content.reduce((sum, part) => {
    if (part.type === "text") return sum + part.text.length;
    return sum + part.image_url.url.length;
  }, 0);
}

export function apiMessageChars(message: ApiMessage): number {
  let total = contentChars(message.content);
  for (const call of message.tool_calls ?? []) {
    total += call.function.name.length + call.function.arguments.length;
  }
  if (message.tool_call_id) total += message.tool_call_id.length;
  return total;
}

/** Days the model should still see: the focus day, the day before, and at most two after. */
export function refineDayWindow(focus: number): number[] {
  return [focus - 1, focus, focus + 1, focus + 2].filter((day) => day >= 1);
}

export function renderPlanContext(places: TripPlace[], focus: number): string {
  const keep = new Set(refineDayWindow(focus));
  const scheduled = places.filter((place) => place.day !== null);
  const keptDays = [...keep].filter((day) => scheduled.some((place) => place.day === day));
  const omitted = [...new Set(scheduled.map((place) => place.day as number))]
    .filter((day) => !keep.has(day))
    .sort((a, b) => a - b);
  const lines = [
    `Plan kept for refining day ${focus}. Included: that day, the day before it, and at most two days after. Each stop keeps its site description.`,
    "",
  ];
  for (const day of keptDays) {
    const heading =
      day === focus ? `Day ${day} — refine this day` : day === focus - 1 ? `Day ${day} — day before` : `Day ${day}`;
    lines.push(heading);
    for (const place of scheduled.filter((item) => item.day === day)) {
      const note = place.note.trim();
      lines.push(`- ${place.name} (${place.kind})${note ? ` — ${note}` : ""}`);
    }
    lines.push("");
  }
  const loose = places.filter((place) => place.day === null);
  if (loose.length > 0) {
    lines.push("Not assigned to a day");
    for (const place of loose) {
      const note = place.note.trim();
      lines.push(`- ${place.name} (${place.kind})${note ? ` — ${note}` : ""}`);
    }
    lines.push("");
  }
  if (omitted.length > 0) {
    lines.push(`Left on the map only: ${omitted.map((day) => `day ${day}`).join(", ")}.`);
  }
  return lines.join("\n").trim();
}

export function planWindowHasStops(places: TripPlace[], focus: number): boolean {
  const keep = new Set(refineDayWindow(focus));
  return places.some((place) => place.day === null || (place.day !== null && keep.has(place.day)));
}
