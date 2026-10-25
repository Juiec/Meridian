import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { skillsDir } from "@/lib/paths";

export type SkillMeta = {
  name: string;
  description: string;
  dir: string;
  rel: string;
  disableModelInvocation: boolean;
  files: string[];
};

export type LoadedSkill = SkillMeta & {
  body: string;
};

export type SkippedSkill = {
  path: string;
  reason: string;
};

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SKILL_CHARS = 20_000;

export function splitFrontmatter(raw: string): {
  data: Record<string, string | boolean>;
  body: string;
} | null {
  const text = raw.replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const block = text.slice(4, end).replace(/^\r?\n/, "");
  const after = text.slice(end + 4).replace(/^\r?\n/, "");
  const data: Record<string, string | boolean> = {};
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    let value: string | boolean = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value === "true") value = true;
    else if (value === "false") value = false;
    data[match[1]] = value;
  }
  return { data, body: after };
}

function listFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

function loadSkill(dir: string, root: string): { skill?: SkillMeta & { body: string }; skipped?: SkippedSkill } {
  const file = path.join(dir, "SKILL.md");
  const rel = path.relative(root, dir).split(path.sep).join("/") || path.basename(dir);
  let raw = "";
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return { skipped: { path: rel, reason: "SKILL.md could not be read." } };
  }
  const parsed = splitFrontmatter(raw);
  if (!parsed) {
    return { skipped: { path: rel, reason: "SKILL.md is missing YAML frontmatter." } };
  }
  const name = typeof parsed.data.name === "string" ? parsed.data.name.trim() : "";
  const description =
    typeof parsed.data.description === "string" ? parsed.data.description.trim() : "";
  if (!NAME_RE.test(name) || name.length > 64) {
    return {
      skipped: {
        path: rel,
        reason: "name must be 1–64 chars of lowercase letters, numbers, and single hyphens.",
      },
    };
  }
  if (!description || description.length > 1024) {
    return { skipped: { path: rel, reason: "description is missing or longer than 1024 characters." } };
  }
  return {
    skill: {
      name,
      description,
      dir,
      rel: `skills/${rel}`,
      disableModelInvocation: parsed.data["disable-model-invocation"] === true,
      files: listFiles(dir),
      body: parsed.body.trim(),
    },
  };
}

function walk(dir: string, root: string, found: Array<SkillMeta & { body: string }>, skipped: SkippedSkill[]) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const child = path.join(dir, entry.name);
    if (existsSync(path.join(child, "SKILL.md"))) {
      const loaded = loadSkill(child, root);
      if (loaded.skill) found.push(loaded.skill);
      if (loaded.skipped) skipped.push(loaded.skipped);
    } else {
      walk(child, root, found, skipped);
    }
  }
}

export function discoverSkills(root = skillsDir()): { skills: LoadedSkill[]; skipped: SkippedSkill[] } {
  const found: LoadedSkill[] = [];
  const skipped: SkippedSkill[] = [];
  walk(root, root, found, skipped);
  found.sort((a, b) => a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const skills: LoadedSkill[] = [];
  for (const skill of found) {
    if (seen.has(skill.name)) {
      skipped.push({ path: skill.rel, reason: `Duplicate skill name "${skill.name}" ignored.` });
      continue;
    }
    seen.add(skill.name);
    skills.push(skill);
  }
  return { skills, skipped };
}

export function indexSkills(skills: SkillMeta[]): SkillMeta[] {
  return skills.filter((skill) => !skill.disableModelInvocation);
}

export function skillsIndexHash(skills: SkillMeta[]): string {
  const canon = indexSkills(skills)
    .map((skill) => `${skill.name}\n${skill.description}\n${skill.rel}`)
    .join("\n---\n");
  return createHash("sha256").update(canon).digest("hex").slice(0, 16);
}

export function renderSkillsIndex(skills: SkillMeta[]): string {
  const visible = indexSkills(skills);
  if (visible.length === 0) {
    return "<available_skills>\n(none)\n</available_skills>";
  }
  const lines = visible.map(
    (skill) => `- ${skill.name}: ${skill.description} (${skill.rel})`,
  );
  return `<available_skills>\n${lines.join("\n")}\n</available_skills>`;
}

export function readSkillFile(
  name: string,
  relPath?: string,
):
  | {
      ok: true;
      name: string;
      description: string;
      path: string;
      content: string;
      files: string[];
    }
  | { ok: false; error: string; available: string[] } {
  const { skills } = discoverSkills();
  const skill = skills.find((item) => item.name === name);
  if (!skill) {
    return {
      ok: false,
      error: `No skill named "${name}".`,
      available: skills.map((item) => item.name),
    };
  }
  const requested = (relPath?.trim() || "SKILL.md").replace(/^\/+/, "");
  if (requested.includes("\0")) {
    return { ok: false, error: "Invalid path.", available: skills.map((item) => item.name) };
  }
  const full = path.resolve(skill.dir, requested);
  const root = path.resolve(skill.dir);
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) {
    return { ok: false, error: "Path escapes the skill directory.", available: [skill.name] };
  }
  if (!existsSync(full) || !statSync(full).isFile()) {
    return {
      ok: false,
      error: `No file ${requested} in ${skill.name}. Files: ${skill.files.join(", ") || "(none)"}`,
      available: [skill.name],
    };
  }
  const raw = readFileSync(full, "utf8");
  if (raw.length > MAX_SKILL_CHARS) {
    return {
      ok: false,
      error: `${requested} is ${raw.length} chars. Split it into a smaller reference and load that path. Nothing was silently truncated.`,
      available: [skill.name],
    };
  }
  const content =
    requested === "SKILL.md"
      ? splitFrontmatter(raw)?.body.trim() || raw.trim()
      : raw.trim();
  return {
    ok: true,
    name: skill.name,
    description: skill.description,
    path: `${skill.rel}/${requested}`,
    content,
    files: skill.files,
  };
}
