import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { memoryDir } from "@/lib/paths";

export const MEMORY_LIMITS = {
  memory: 2200,
  user: 1375,
} as const;

export type MemoryTarget = keyof typeof MEMORY_LIMITS;

export type MemoryOp = {
  action: "add" | "patch" | "remove";
  content?: string;
  old_text?: string;
};

export type MemoryResult = {
  ok: boolean;
  target: MemoryTarget;
  message: string;
  error?: string;
  entries: string[];
  current_entries: string[];
  usage: string;
  used: number;
  limit: number;
  changed: boolean;
  closest_entries?: string[];
};

const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/;
const INJECTION =
  /ignore (all |any )?(previous|prior|above) (instructions|prompts)|disregard (the )?(above|previous)|you are now (a |an )?(new|different) (system|assistant)/i;

export function memoryFile(target: MemoryTarget): string {
  return path.join(memoryDir(), target === "memory" ? "MEMORY.md" : "USER.md");
}

export function usageOf(entries: string[]): number {
  return entries.reduce((sum, entry) => sum + entry.length, 0);
}

export function parseEntries(raw: string): string[] {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");
  const hasMarker = lines.some((line) => line.trim().startsWith("§"));
  if (!hasMarker) return [text];
  const entries: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    const value = buf.join("\n").trim();
    if (value) entries.push(value);
    buf = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "§" || trimmed.startsWith("§ ")) {
      flush();
      const inline = trimmed.slice(1).trim();
      if (inline) buf.push(inline);
      continue;
    }
    buf.push(line);
  }
  flush();
  return entries;
}

export function serializeEntries(entries: string[]): string {
  if (entries.length === 0) return "";
  return `${entries.map((entry) => `§\n${entry.trim()}`).join("\n\n")}\n`;
}

export function readEntries(target: MemoryTarget): string[] {
  const file = memoryFile(target);
  if (!existsSync(file)) return [];
  return parseEntries(readFileSync(file, "utf8"));
}

export function writeEntries(target: MemoryTarget, entries: string[]): void {
  writeFileSync(memoryFile(target), serializeEntries(entries), "utf8");
}

function scanEntry(content: string): string | null {
  if (INVISIBLE.test(content)) {
    return "Entry blocked: it contains invisible unicode. Memory is injected into the system prompt, so hidden characters are refused.";
  }
  if (INJECTION.test(content)) {
    return "Entry blocked: it looks like a prompt-injection instruction. Rephrase it as a plain fact.";
  }
  return null;
}

function closest(entries: string[], needle: string): string[] {
  const words = new Set(
    needle
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 2),
  );
  return entries
    .map((entry) => {
      let score = 0;
      const lower = entry.toLowerCase();
      if (needle && (lower.includes(needle.toLowerCase()) || needle.toLowerCase().includes(lower))) {
        score += 5;
      }
      for (const word of lower.split(/\W+/)) {
        if (words.has(word)) score += 1;
      }
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.entry);
}

function findMatch(
  entries: string[],
  oldText: string,
): { index: number } | { error: string; closest_entries: string[] } {
  const exact = entries
    .map((entry, index) => ({ entry, index }))
    .filter((item) => item.entry === oldText);
  if (exact.length === 1) return { index: exact[0].index };
  const partial = entries
    .map((entry, index) => ({ entry, index }))
    .filter((item) => item.entry.includes(oldText));
  if (partial.length === 1) return { index: partial[0].index };
  if (partial.length === 0) {
    return {
      error: "old_text matched no entry. Pass a substring that appears in exactly one entry.",
      closest_entries: closest(entries, oldText),
    };
  }
  return {
    error: `old_text matched ${partial.length} entries. Pass a longer unique substring.`,
    closest_entries: partial.slice(0, 3).map((item) => item.entry),
  };
}

export function applyOps(
  entries: string[],
  operations: MemoryOp[],
  limit: number,
  label: string,
): { entries: string[]; changed: boolean; message: string } | { error: string; closest_entries?: string[] } {
  if (!Array.isArray(operations) || operations.length === 0) {
    return { error: "operations must be a non-empty array of add, patch, or remove." };
  }
  if (operations.length > 20) {
    return { error: "At most 20 operations per call. Split the update." };
  }

  const next = [...entries];
  let changed = false;
  const notes: string[] = [];

  for (const operation of operations) {
    const action = operation?.action;
    if (action !== "add" && action !== "patch" && action !== "remove") {
      return { error: "Each operation needs action add, patch, or remove." };
    }

    if (action === "add") {
      const content = (operation.content ?? "").trim();
      if (!content) return { error: "add requires non-empty content." };
      const blocked = scanEntry(content);
      if (blocked) return { error: blocked };
      if (next.includes(content)) {
        notes.push("no duplicate added");
        continue;
      }
      next.push(content);
      changed = true;
      continue;
    }

    const oldText = (operation.old_text ?? "").trim();
    if (!oldText) return { error: `${action} requires old_text.` };
    const match = findMatch(next, oldText);
    if ("error" in match) return match;

    if (action === "remove") {
      next.splice(match.index, 1);
      changed = true;
      continue;
    }

    const content = operation.content ?? "";
    const blocked = content.trim() ? scanEntry(content) : null;
    if (blocked) return { error: blocked };
    const current = next[match.index];
    if (current !== oldText) {
      const occurrences = current.split(oldText).length - 1;
      if (occurrences !== 1) {
        return {
          error: `old_text appears ${occurrences} times inside the matched entry. Include more surrounding text so the span is unique.`,
        };
      }
    }
    const replaced = current === oldText ? content.trim() : current.replace(oldText, content).trim();
    if (!replaced) {
      next.splice(match.index, 1);
    } else if (next.some((entry, index) => index !== match.index && entry === replaced)) {
      next.splice(match.index, 1);
      notes.push("patch collapsed into an existing entry");
    } else {
      next[match.index] = replaced;
    }
    changed = true;
  }

  const used = usageOf(next);
  if (used > limit) {
    const over = used - limit;
    return {
      error: `${label} would be ${used}/${limit} chars and exceeds the limit by ${over}. Nothing was written. Retry as ONE operations batch that removes or shortens (patch) stale entries from current_entries to free at least ${over} chars AND applies the new content. The limit is checked only on the batch result.`,
    };
  }

  const message = changed
    ? notes.length
      ? `Updated ${label}. ${notes.join(". ")}.`
      : `Updated ${label}.`
    : notes.join(". ") || `No change to ${label}.`;
  return { entries: next, changed, message };
}

export function applyMemory(target: MemoryTarget, operations: MemoryOp[]): MemoryResult {
  const limit = MEMORY_LIMITS[target];
  const label = target === "memory" ? "MEMORY" : "USER";
  const current = readEntries(target);
  const applied = applyOps(current, operations, limit, label);
  const usage = (entries: string[]) => `${usageOf(entries)}/${limit}`;
  if ("error" in applied) {
    return {
      ok: false,
      target,
      message: applied.error,
      error: applied.error,
      entries: current,
      current_entries: current,
      usage: usage(current),
      used: usageOf(current),
      limit,
      changed: false,
      closest_entries: applied.closest_entries,
    };
  }
  if (applied.changed) writeEntries(target, applied.entries);
  return {
    ok: true,
    target,
    message: applied.message,
    entries: applied.entries,
    current_entries: applied.entries,
    usage: usage(applied.entries),
    used: usageOf(applied.entries),
    limit,
    changed: applied.changed,
  };
}

export function renderMemorySnapshot(target: MemoryTarget, entries: string[]): string {
  const limit = MEMORY_LIMITS[target];
  const used = usageOf(entries);
  const pct = Math.round((used / limit) * 100);
  const title = target === "memory" ? "MEMORY" : "USER PROFILE";
  const header = `${title} (frozen at session start) [${pct}% — ${used}/${limit} chars]`;
  if (entries.length === 0) return `${header}\n(empty)`;
  return `${header}\n${entries.join("\n§\n")}`;
}
