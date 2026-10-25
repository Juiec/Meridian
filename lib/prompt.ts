import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { agentDir } from "@/lib/paths";
import { renderMemorySnapshot, type MemoryTarget } from "@/lib/memory";
import {
  indexSkills,
  renderSkillsIndex,
  skillsIndexHash,
  type SkillMeta,
} from "@/lib/skills";

const FALLBACK_IDENTITY = `You are Meridian, a personal agent beside the user. Their model runs on a server they control.

Be direct. Match the length of the reply to the weight of the ask. No filler, no restating the request, and no narrating tool calls the user can already see. When you are unsure, say so. Remember only what you write with the memory tool.`;

const TOOL_GUIDANCE = `# How to work

Tools are how you act. Call them. Do not claim you saved a memory, loaded a skill, or read a page unless the tool result says so.

## Skills
The skills index later in this prompt lists names, descriptions, and paths. It does not include the procedures. Before you follow a procedure, if one skill clearly matches the task, load it with skill_view and follow it. Load a reference file only when the skill points at one. If the user message already contains a <skill> block, that skill was forced with /skill:name — follow it and do not load it again unless you need a reference file.

Do not load every skill. Do not invent skills that are not in the index. Procedures belong in skills. Facts that should apply in every session belong in memory.

## Memory
MEMORY is your notes: environment, conventions, and lessons that should still matter next session.
USER is the person: name, role, preferences, and communication style.

Save when you learn something that should survive this chat. Skip one-off details, raw dumps, and anything already written in these instructions.

The memory blocks below were frozen when this session started. Writes land on disk immediately and the tool result shows the live entries, but this prompt will not change until a new session. There is no read action.

Character limits are strict. If a write would exceed the limit, the tool returns an error and writes nothing. Do not retry the same add. Send one operations batch that removes or shortens stale entries and adds the new one. The limit is checked on the batch result. Above 80% full, consolidate before you add.

Use patch to change a span inside an entry. Pass old_text as the whole entry only when you mean to rewrite that entry.

## Other tools
fetch_url reads a public http(s) page as text. It refuses private, loopback, link-local, and encoded numeric addresses, and it truncates long pages. Use it when the user gives a link or a skill tells you to open a source. current_time reports the server clock when the answer depends on the actual time.

Skills are playbooks: the index lists them, and skill_view loads the procedure. Tools are callable functions. Besides the built-ins, this request may include extra tools. Names that start with mcp_ come from an MCP server the user connected. Any other extra name is an HTTP tool they registered. Call one when its description matches the task. Do not invent tool names that are not in the tool list. A server that failed to connect is simply absent.

## Travel
travel_geocode, travel_weather, travel_places, travel_route, travel_prices, and travel_plan read public travel data and the trip map. Do not invent coordinates, weather, distances, or fares. If travel_prices says the quote is not live, call it illustrative and share the link. Never book or collect payment. Do not assume a home city. Ask when origin or destination is missing. A lasting preference can go in USER memory; a one-off date should not.

The user may attach text files or images. Attached text is part of their message. Do not ask them to paste a file that is already attached.

Keep tool arguments small and valid JSON. If a tool result is an error, fix the arguments or consolidate memory. Do not pretend it succeeded.`;

function readCapped(file: string, fallback: string, cap = 20_000): string {
  if (!existsSync(file)) return fallback;
  const text = readFileSync(file, "utf8").trim();
  if (!text) return fallback;
  if (text.length <= cap) return text;
  const name = path.basename(file);
  return `${text.slice(0, cap)}\n[${name} truncated at ${cap} characters]`;
}

export function loadIdentity(): string {
  return readCapped(path.join(agentDir(), "SOUL.md"), FALLBACK_IDENTITY);
}

export function loadProjectContext(): string {
  const file = path.join(agentDir(), "AGENTS.md");
  const text = readCapped(file, "");
  if (!text) return "# Project context\n\n(no AGENTS.md)";
  return `# Project context\n\nThe following project instructions were loaded and should be followed:\n\n${text}`;
}

export function assembleSystemPrompt(input: {
  skills: SkillMeta[];
  memoryEntries: string[];
  userEntries: string[];
  now: Date;
  sessionId: string;
  model: string;
}): { prompt: string; skillsIndexHash: string } {
  const visible = indexSkills(input.skills);
  const hash = skillsIndexHash(input.skills);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const stable = [loadIdentity(), TOOL_GUIDANCE].join("\n\n");
  const context = loadProjectContext();
  const volatile = [
    "# Skills index",
    "Scan this list before you reply. If one skill clearly matches, load it with skill_view before you do the work. Descriptions are routing hints, not the procedure.",
    renderSkillsIndex(visible),
    "# Memory snapshot",
    renderMemorySnapshot("memory" satisfies MemoryTarget, input.memoryEntries),
    "# User profile",
    renderMemorySnapshot("user", input.userEntries),
    "# Runtime",
    `Time: ${input.now.toISOString()}`,
    `Session: ${input.sessionId}`,
    `Model at session start: ${input.model || "(unset)"}`,
    `Host timezone: ${timeZone}`,
  ].join("\n\n");

  return {
    prompt: [stable, context, volatile].join("\n\n"),
    skillsIndexHash: hash,
  };
}

export function skillsChangedNote(skills: SkillMeta[]): string {
  return [
    "Skills index changed since this session's prompt was frozen. Use this list for the rest of the session. The system prompt itself updates on the next session (or after compaction rebuilds it).",
    renderSkillsIndex(indexSkills(skills)),
  ].join("\n\n");
}
