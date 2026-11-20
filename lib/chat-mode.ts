import { ASK_USER_NAME, ASK_USER_TOOL } from "@/lib/ask-user";

export type ChatMode = "agent" | "ask" | "plan";

export const CHAT_MODES: ChatMode[] = ["agent", "ask", "plan"];

/** Leading `/ask`, `/plan`, `/agent`, plus the `-mode` aliases. */
export const LEADING_MODE = /^\/(ask|plan|agent)(?:-mode)?\b\s*/i;

export const READONLY_TOOLS = new Set([
  "skill_view",
  "list_skills",
  "fetch_url",
  "current_time",
  "travel_geocode",
  "travel_weather",
  "travel_places",
  "travel_route",
  "travel_prices",
]);

export function isChatMode(value: unknown): value is ChatMode {
  return value === "agent" || value === "ask" || value === "plan";
}

export function modeAllowsTool(mode: ChatMode, name: string): boolean {
  if (name === ASK_USER_NAME) return mode === "plan";
  if (mode === "agent") return true;
  return READONLY_TOOLS.has(name);
}

export function filterToolsForMode<T extends { function: { name: string } }>(definitions: T[], mode: ChatMode): T[] {
  const base = definitions.filter((tool) => tool.function.name !== ASK_USER_NAME);
  if (mode === "agent") return base;
  const readOnly = base.filter((tool) => READONLY_TOOLS.has(tool.function.name));
  if (mode !== "plan") return readOnly;
  return [...readOnly, ASK_USER_TOOL as unknown as T];
}

export function modeRefusal(mode: ChatMode, name: string): string {
  if (name === ASK_USER_NAME) return "ask_user is only available in Plan mode.";
  const label = mode === "plan" ? "Plan" : "Ask";
  return `${label} mode blocked ${name}. Switch to Agent with /agent to use tools that write or call other services.`;
}

export function modeLabel(mode: ChatMode): string {
  if (mode === "ask") return "Ask";
  if (mode === "plan") return "Plan";
  return "Agent";
}

/** Appended on each turn. It is not stored in the frozen system prompt. */
export function modeInstructions(mode: ChatMode): string {
  if (mode === "ask") {
    return `# Mode: Ask

You are in Ask mode. Answer the question. You may call only read-only tools: skill_view, list_skills, fetch_url, current_time, travel_geocode, travel_weather, travel_places, travel_route, and travel_prices. Do not write memory, generate images, change the trip, delegate, or call MCP or custom tools. If that work is needed, say the user can switch to Agent with /agent.`;
  }
  if (mode === "plan") {
    return `# Mode: Plan

You are in Plan mode. Use the same read-only tools as Ask mode, then stop. Reply with a short plan: what you found, the steps you would take, and any open question. Do not carry the plan out, and do not claim you changed memory, images, or the trip. The user switches to Agent with /agent when they want it done.

When a missing choice would change the plan, and you cannot look it up or reasonably assume it, call ask_user and stop. One question. Two to four options, each a real direction written as a reply the user might type. Do not ask about details you can decide. The tool result is their choice — write the plan with it. Ask again only if that answer opened a new choice that would change the plan.`;
  }
  return `# Mode: Agent

You are in Agent mode. Use the tools you need, including ones that write memory, generate images, or update the trip. When a side task would fill this chat with tool output, call delegate so a subagent works from a short summary and returns only the result.`;
}
