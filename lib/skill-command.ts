const SKILL_TOKEN = /^\/skill:([a-z0-9]+(?:-[a-z0-9]+)*)\b\s*/i;

export type SkillCommand = {
  skills: string[];
  rest: string;
};

/** Parse leading `/skill:name` tokens. Later text is the user request. */
export function parseSkillCommand(input: string): SkillCommand | null {
  let rest = input.trim();
  const skills: string[] = [];
  while (skills.length < 5) {
    const match = rest.match(SKILL_TOKEN);
    if (!match) break;
    skills.push(match[1].toLowerCase());
    rest = rest.slice(match[0].length);
  }
  if (skills.length === 0) return null;
  return { skills, rest };
}

export function deriveTitle(content: string): string {
  const parsed = parseSkillCommand(content);
  const text = (parsed ? parsed.rest : content).replace(/\s+/g, " ").trim();
  if (!text && parsed) return `Skill: ${parsed.skills.join(", ")}`;
  if (!text) return "New session";
  return text.length > 56 ? `${text.slice(0, 55)}…` : text;
}
