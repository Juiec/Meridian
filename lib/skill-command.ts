import { LEADING_MODE, type ChatMode } from "@/lib/chat-mode";

const SKILL_TOKEN = /^\/(?:skill:)?([a-z0-9]+(?:-[a-z0-9]+)*)\b\s*/i;

export type SkillCommand = {
  mode: ChatMode | null;
  skills: string[];
  rest: string;
};

/** Parse a leading mode, then up to five `/name` tokens (also `/skill:name`). */
export function parseSkillCommand(input: string): SkillCommand | null {
  let rest = input.trim();
  let mode: ChatMode | null = null;
  let modeGuard = 0;
  while (modeGuard < 5) {
    const match = rest.match(LEADING_MODE);
    if (!match) break;
    const next = match[1].toLowerCase();
    if (next === "ask" || next === "plan" || next === "agent") mode = next;
    rest = rest.slice(match[0].length);
    modeGuard += 1;
  }
  const skills: string[] = [];
  while (skills.length < 5) {
    const match = rest.match(SKILL_TOKEN);
    if (!match) break;
    skills.push(match[1].toLowerCase());
    rest = rest.slice(match[0].length);
  }
  if (!mode && skills.length === 0) return null;
  return { mode, skills, rest };
}

export function deriveTitle(content: string): string {
  const parsed = parseSkillCommand(content);
  const text = (parsed ? parsed.rest : content).replace(/\s+/g, " ").trim();
  if (!text && parsed?.skills.length) return `Skill: ${parsed.skills.join(", ")}`;
  if (!text && parsed?.mode) {
    const label = parsed.mode.charAt(0).toUpperCase() + parsed.mode.slice(1);
    return `${label} mode`;
  }
  if (!text) return "New session";
  return text.length > 56 ? `${text.slice(0, 55)}…` : text;
}
