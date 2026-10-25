import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import { writeAtomic } from "@/lib/atomic";
import { skillsDir } from "@/lib/paths";
import { discoverSkills, splitFrontmatter } from "@/lib/skills";

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REF_RE = /^[a-z0-9][a-z0-9._-]{0,80}\.(md|txt)$/;
const MAX_BODY = 20_000;
const MAX_DESCRIPTION = 1024;

export type SkillReferenceInput = { name: string; content: string };

export type SkillDraft = {
  name: string;
  description: string;
  body: string;
  disableModelInvocation: boolean;
  references: SkillReferenceInput[];
};

export type SkillSource = SkillDraft & {
  path: string;
  files: string[];
};

function assertName(name: string) {
  if (!NAME_RE.test(name) || name.length > 64) {
    throw new Error("Skill name must be 1–64 chars of lowercase letters, numbers, and single hyphens.");
  }
}

function skillRoot(): string {
  const root = path.resolve(skillsDir());
  mkdirSync(root, { recursive: true });
  return root;
}

function directoryFor(name: string): string {
  assertName(name);
  const dir = path.resolve(skillRoot(), name);
  const root = skillRoot();
  if (dir !== path.join(root, name)) throw new Error("Skill path is not allowed.");
  return dir;
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function renderSkillMarkdown(draft: Pick<SkillDraft, "name" | "description" | "body" | "disableModelInvocation">): string {
  const lines = ["---", `name: ${draft.name}`, `description: ${quote(draft.description.trim())}`];
  if (draft.disableModelInvocation) lines.push("disable-model-invocation: true");
  lines.push("---", "", draft.body.trim(), "");
  return lines.join("\n");
}

function validateDraft(draft: SkillDraft) {
  assertName(draft.name);
  const description = draft.description.trim();
  if (!description || description.length > MAX_DESCRIPTION) {
    throw new Error("Description is required and must be 1024 characters or fewer.");
  }
  if (draft.body.trim().length > MAX_BODY) {
    throw new Error(`Skill body is ${draft.body.trim().length} characters. The limit is ${MAX_BODY}. Nothing was written.`);
  }
  const seen = new Set<string>();
  for (const reference of draft.references) {
    if (!REF_RE.test(reference.name)) {
      throw new Error(`Reference names must look like notes.md. "${reference.name}" was refused.`);
    }
    if (seen.has(reference.name)) throw new Error(`Duplicate reference ${reference.name}.`);
    seen.add(reference.name);
    if (reference.content.length > MAX_BODY) {
      throw new Error(`${reference.name} is over ${MAX_BODY} characters. Nothing was written.`);
    }
  }
}

function existingDir(name: string): string | null {
  const { skills } = discoverSkills();
  return skills.find((skill) => skill.name === name)?.dir ?? null;
}

export function readSkillSource(name: string): SkillSource {
  const dir = existingDir(name);
  if (!dir) throw new Error(`No skill named "${name}".`);
  const raw = readFileSync(path.join(dir, "SKILL.md"), "utf8");
  const parsed = splitFrontmatter(raw);
  if (!parsed || typeof parsed.data.name !== "string" || typeof parsed.data.description !== "string") {
    throw new Error("SKILL.md frontmatter is invalid.");
  }
  const references: SkillReferenceInput[] = [];
  const refDir = path.join(dir, "references");
  if (existsSync(refDir) && statSync(refDir).isDirectory()) {
    for (const entry of readdirSync(refDir)) {
      if (!REF_RE.test(entry)) continue;
      references.push({ name: entry, content: readFileSync(path.join(refDir, entry), "utf8") });
    }
  }
  const skill = discoverSkills().skills.find((item) => item.name === name);
  return {
    name: parsed.data.name,
    description: parsed.data.description,
    body: parsed.body.trim(),
    disableModelInvocation: parsed.data["disable-model-invocation"] === true,
    references,
    path: skill?.rel ?? `skills/${name}`,
    files: skill?.files ?? ["SKILL.md"],
  };
}

function writeReferences(dir: string, references: SkillReferenceInput[]) {
  const refDir = path.join(dir, "references");
  if (existsSync(refDir)) {
    for (const entry of readdirSync(refDir)) {
      if (!references.some((reference) => reference.name === entry)) {
        rmSync(path.join(refDir, entry), { force: true });
      }
    }
  }
  if (references.length === 0) return;
  mkdirSync(refDir, { recursive: true });
  for (const reference of references) {
    writeAtomic(path.join(refDir, reference.name), reference.content.endsWith("\n") ? reference.content : `${reference.content}\n`);
  }
}

export function draftFromBody(body: Record<string, unknown>, fallbackName?: string): SkillDraft {
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : fallbackName || "";
  const references: SkillReferenceInput[] = [];
  if (Array.isArray(body.references)) {
    for (const item of body.references) {
      if (!item || typeof item !== "object") throw new Error("Each reference must be an object.");
      const record = item as Record<string, unknown>;
      references.push({
        name: typeof record.name === "string" ? record.name.trim() : "",
        content: typeof record.content === "string" ? record.content : "",
      });
    }
  }
  return {
    name,
    description: typeof body.description === "string" ? body.description : "",
    body: typeof body.body === "string" ? body.body : "",
    disableModelInvocation: body.disableModelInvocation === true,
    references,
  };
}

export function createSkill(draft: SkillDraft): SkillSource {
  validateDraft(draft);
  if (existingDir(draft.name)) throw new Error(`A skill named "${draft.name}" already exists.`);
  const dir = directoryFor(draft.name);
  mkdirSync(dir, { recursive: true });
  writeAtomic(path.join(dir, "SKILL.md"), renderSkillMarkdown(draft));
  writeReferences(dir, draft.references);
  return readSkillSource(draft.name);
}

export function updateSkill(name: string, draft: SkillDraft): SkillSource {
  validateDraft(draft);
  const current = existingDir(name);
  if (!current) throw new Error(`No skill named "${name}".`);
  if (draft.name !== name) {
    assertName(draft.name);
    if (existingDir(draft.name)) throw new Error(`A skill named "${draft.name}" already exists.`);
    const next = directoryFor(draft.name);
    mkdirSync(path.dirname(next), { recursive: true });
    rmSync(next, { recursive: true, force: true });
    mkdirSync(next, { recursive: true });
    writeAtomic(path.join(next, "SKILL.md"), renderSkillMarkdown(draft));
    writeReferences(next, draft.references);
    rmSync(current, { recursive: true, force: true });
    return readSkillSource(draft.name);
  }
  writeAtomic(path.join(current, "SKILL.md"), renderSkillMarkdown(draft));
  writeReferences(current, draft.references);
  return readSkillSource(name);
}

export function deleteSkill(name: string): void {
  const dir = existingDir(name);
  if (!dir) throw new Error(`No skill named "${name}".`);
  const root = skillRoot();
  const resolved = path.resolve(dir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Refusing to delete a path outside the skills directory.");
  }
  rmSync(resolved, { recursive: true, force: true });
}
