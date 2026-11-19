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
  if (mode === "agent") return true;
  return READONLY_TOOLS.has(name);
}

export function filterToolsForMode<T extends { function: { name: string } }>(definitions: T[], mode: ChatMode): T[] {
  if (mode === "agent") return definitions;
  return definitions.filter((tool) => READONLY_TOOLS.has(tool.function.name));
}

export function modeRefusal(mode: ChatMode, name: string): string {
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

You are in Plan mode. Use the same read-only tools as Ask mode, then stop. Reply with a short plan: what you found, the steps you would take, and any open question. Do not carry the plan out, and do not claim you changed memory, images, or the trip. The user switches to Agent with /agent when they want it done.`;
  }
  return `# Mode: Agent

You are in Agent mode. Use the tools you need, including ones that write memory, generate images, or update the trip. When a side task would fill this chat with tool output, call delegate so a subagent works from a short summary and returns only the result.`;
}
