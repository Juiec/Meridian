import { LEADING_MODE, type ChatMode } from "@/lib/chat-mode";
import { parseSkillCommand } from "@/lib/skill-command";

export type SlashKind = "mode" | "skill" | "tool";

export type SlashItem = {
  kind: SlashKind;
  name: string;
  description: string;
  insert: string;
};

export const MODE_ITEMS: SlashItem[] = [
  {
    kind: "mode",
    name: "agent",
    description: "Use every tool, including ones that write.",
    insert: "/agent ",
  },
  {
    kind: "mode",
    name: "ask",
    description: "Answer with read-only tools. No writes.",
    insert: "/ask ",
  },
  {
    kind: "mode",
    name: "plan",
    description: "Read, then stop with a plan. No writes.",
    insert: "/plan ",
  },
];

const SLASH_AT_CARET = /(?:^|\s)\/(\S*)$/;

/** The `/token` touching the caret, if the caret is still inside it. */
export function slashTokenAt(text: string, caret: number): { start: number; query: string } | null {
  if (caret < 0 || caret > text.length) return null;
  const before = text.slice(0, caret);
  const match = before.match(SLASH_AT_CARET);
  if (!match || match.index === undefined) return null;
  const query = match[1] ?? "";
  const slashOffset = match[0].lastIndexOf("/");
  return { start: match.index + slashOffset, query };
}

export function compileSlashQuery(query: string): RegExp {
  if (!query) return /(?:)/;
  try {
    return new RegExp(query, "i");
  } catch {
    return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
}

export function filterSlashItems(query: string, items: SlashItem[]): SlashItem[] {
  if (!query) return items;
  const pattern = compileSlashQuery(query);
  return items.filter((item) => pattern.test(item.name) || pattern.test(item.description));
}

/** Replace a leading mode token, or add one, without touching the rest of the draft. */
export function setLeadingMode(draft: string, mode: ChatMode): string {
  const indent = draft.match(/^\s*/)?.[0] ?? "";
  let rest = draft.slice(indent.length);
  let guard = 0;
  while (guard < 5) {
    const match = rest.match(LEADING_MODE);
    if (!match) break;
    rest = rest.slice(match[0].length);
    guard += 1;
  }
  const body = rest.replace(/^\s+/, "");
  return body ? `${indent}/${mode} ${body}` : `${indent}/${mode} `;
}

export function applySlashSelection(
  draft: string,
  tokenStart: number,
  caret: number,
  item: SlashItem,
): { text: string; caret: number } {
  if (item.kind === "mode" && (item.name === "agent" || item.name === "ask" || item.name === "plan")) {
    const without = draft.slice(0, tokenStart) + draft.slice(caret);
    const text = setLeadingMode(without, item.name);
    const marker = `/${item.name} `;
    const at = text.indexOf(marker);
    return { text, caret: at === -1 ? text.length : at + marker.length };
  }
  const text = draft.slice(0, tokenStart) + item.insert + draft.slice(caret);
  return { text, caret: tokenStart + item.insert.length };
}

/** Prepend a skill token, keeping a leading mode command in front of it. */
export function insertSkillToken(draft: string, name: string): string {
  const parsed = parseSkillCommand(draft);
  if (parsed?.skills.includes(name)) return draft;
  const skills = [name, ...(parsed?.skills ?? [])].slice(0, 5);
  const skillText = skills.map((skill) => `/${skill}`).join(" ");
  const body = (parsed?.rest ?? draft).trim();
  if (parsed?.mode) {
    return body ? `/${parsed.mode} ${skillText} ${body}` : `/${parsed.mode} ${skillText} `;
  }
  return body ? `${skillText} ${body}` : `${skillText} `;
}
