import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { writeAtomic } from "@/lib/atomic";
import { agentDir } from "@/lib/paths";

export const DOC_LIMITS = {
  soul: 6000,
  agents: 8000,
} as const;

export type DocTarget = keyof typeof DOC_LIMITS;

const FILES: Record<DocTarget, string> = {
  soul: "SOUL.md",
  agents: "AGENTS.md",
};

export function docPath(target: DocTarget): string {
  return path.join(agentDir(), FILES[target]);
}

export function readDoc(target: DocTarget): { text: string; used: number; limit: number } {
  const file = docPath(target);
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  return { text, used: text.length, limit: DOC_LIMITS[target] };
}

export function writeDoc(target: DocTarget, text: string): { text: string; used: number; limit: number } {
  const limit = DOC_LIMITS[target];
  if (text.length > limit) {
    throw new Error(
      `${FILES[target]} would be ${text.length}/${limit} characters. Nothing was written. Shorten it and save again.`,
    );
  }
  writeAtomic(docPath(target), text.endsWith("\n") || text.length === 0 ? text : `${text}\n`);
  return readDoc(target);
}
