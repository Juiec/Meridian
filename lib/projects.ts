import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

import { isSecretFilename } from "@/lib/attachments";
import { writeAtomic } from "@/lib/atomic";
import { dataDir } from "@/lib/paths";

const SKIPPED = new Set(["node_modules", ".git", ".next", "dist", "coverage", ".turbo"]);
const MAX_ENTRIES = 200;

export type ProjectRecord = {
  id: string;
  name: string;
  root: string;
  /** True when Meridian created the folder under its own data directory. */
  managed: boolean;
};

export type ProjectEntry = {
  name: string;
  path: string;
  kind: "file" | "dir";
};

type Registry = { projects: ProjectRecord[] };

function registryPath(): string {
  return path.join(dataDir(), "projects.json");
}

function isRecord(value: unknown): value is ProjectRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as ProjectRecord;
  return typeof row.id === "string" && typeof row.name === "string" && typeof row.root === "string";
}

function normalize(row: ProjectRecord): ProjectRecord {
  return { id: row.id, name: row.name, root: row.root, managed: row.managed === true };
}

function readAll(): ProjectRecord[] {
  const file = registryPath();
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Registry).projects)) return [];
  return (parsed as Registry).projects.filter(isRecord).map(normalize);
}

function save(projects: ProjectRecord[]) {
  writeAtomic(registryPath(), `${JSON.stringify({ projects }, null, 2)}\n`);
}

function samePath(left: string, right: string): boolean {
  if (process.platform === "win32") return left.toLowerCase() === right.toLowerCase();
  return left === right;
}

function insideRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function cleanName(name: string): string {
  const clean = name.trim();
  if (!clean) throw new Error("Name the project.");
  if (clean.length > 80) throw new Error("Project name must be 80 characters or fewer.");
  return clean;
}

function hiddenEntry(name: string, includeDotfiles: boolean): boolean {
  if (SKIPPED.has(name.toLowerCase()) || name === ".git") return true;
  if (isSecretFilename(name)) return true;
  if (!includeDotfiles && name.startsWith(".")) return true;
  return false;
}

export function projectsHome(): string {
  return path.join(dataDir(), "projects");
}

export function getProject(id: string): ProjectRecord | null {
  return readAll().find((project) => project.id === id) ?? null;
}

export function listProjects(): ProjectRecord[] {
  return readAll();
}

export function createProject(name: string): ProjectRecord {
  const projectName = cleanName(name);
  const id = randomUUID();
  const root = path.join(projectsHome(), id);
  mkdirSync(root, { recursive: true });
  const project: ProjectRecord = { id, name: projectName, root, managed: true };
  save([...readAll(), project]);
  return project;
}

export function addProject(name: string, root: string): ProjectRecord {
  const projectName = cleanName(name);
  const requested = root.trim();
  if (!requested) throw new Error("Give the full folder path.");
  const absolute = path.resolve(requested);
  if (!existsSync(absolute)) throw new Error("That folder does not exist.");
  let real: string;
  try {
    real = realpathSync(absolute);
  } catch {
    throw new Error("That folder could not be opened.");
  }
  if (!lstatSync(real).isDirectory()) throw new Error("That path is not a folder.");
  const projects = readAll();
  if (projects.some((project) => samePath(project.root, real))) {
    throw new Error("That folder is already a project.");
  }
  const project: ProjectRecord = { id: randomUUID(), name: projectName, root: real, managed: false };
  save([...projects, project]);
  return project;
}

export function renameProject(id: string, name: string): ProjectRecord {
  const projectName = cleanName(name);
  const projects = readAll();
  const index = projects.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("Project not found.");
  const next = { ...projects[index], name: projectName };
  const copy = projects.slice();
  copy[index] = next;
  save(copy);
  return next;
}

function entryName(name: string): string {
  const clean = name.trim();
  if (!clean || clean === "." || clean === ".." || /[\\/\u0000]/.test(clean)) {
    throw new Error("That name is not valid.");
  }
  if (clean.length > 255) throw new Error("That name is too long.");
  if (isSecretFilename(clean)) throw new Error("That name is refused.");
  return clean;
}

export function renameProjectEntry(id: string, relativePath: string, nextName: string): ProjectEntry {
  const clean = entryName(nextName);
  const located = resolveProjectPath(id, relativePath);
  if (!located.relative) throw new Error("Give a file or folder inside the project.");
  if (!existsSync(located.absolute)) throw new Error("That file is missing.");
  const listed = lstatSync(located.absolute);
  if (listed.isSymbolicLink()) throw new Error("That path leaves the project.");
  const real = realpathSync(located.absolute);
  if (!insideRoot(located.root, real)) throw new Error("That path leaves the project.");

  const parent = path.posix.dirname(located.relative);
  const nextRelative = parent === "." ? clean : `${parent}/${clean}`;
  const destination = path.resolve(located.root, nextRelative);
  if (!insideRoot(located.root, destination)) throw new Error("That path leaves the project.");
  const sameFile = samePath(real, destination);
  if (!sameFile && existsSync(destination)) throw new Error("That name is already used.");
  if (nextRelative !== located.relative) {
    if (sameFile) {
      const temporary = `${destination}.meridian-rename-tmp`;
      renameSync(real, temporary);
      renameSync(temporary, destination);
    } else {
      renameSync(real, destination);
    }
  }
  return {
    name: clean,
    path: nextRelative,
    kind: listed.isDirectory() ? "dir" : "file",
  };
}

export function removeProject(id: string) {
  const projects = readAll();
  const project = projects.find((item) => item.id === id);
  if (!project) throw new Error("Project not found.");
  save(projects.filter((item) => item.id !== id));
  if (!project.managed) return;
  const expected = path.resolve(projectsHome(), id);
  let real = "";
  try {
    if (!existsSync(project.root)) return;
    real = realpathSync(project.root);
  } catch {
    return;
  }
  if (!samePath(real, expected) && !samePath(path.resolve(project.root), expected)) return;
  rmSync(real, { recursive: true, force: true });
}

export function cleanRelative(relativePath: string): string {
  const requested = relativePath.trim().replaceAll("\\", "/");
  if (!requested) return "";
  const parts = requested.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("That path leaves the project.");
  }
  return parts.join("/");
}

export function resolveProjectPath(
  id: string,
  relativePath = "",
): { project: ProjectRecord; root: string; absolute: string; relative: string } {
  const project = getProject(id);
  if (!project) throw new Error("Project not found.");
  if (!existsSync(project.root)) throw new Error("The project folder is missing.");
  const rootStat = lstatSync(project.root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error("That path is not a folder.");
  const root = realpathSync(project.root);
  const relative = cleanRelative(relativePath);
  const absolute = path.resolve(root, relative);
  if (!insideRoot(root, absolute)) throw new Error("That path leaves the project.");
  return { project, root, absolute, relative };
}

export function listProjectDir(
  id: string,
  relativePath = "",
  options?: { includeDotfiles?: boolean },
): { entries: ProjectEntry[]; truncated: boolean } {
  const located = resolveProjectPath(id, relativePath);
  if (!existsSync(located.absolute)) throw new Error("That folder is missing.");
  const listed = lstatSync(located.absolute);
  if (listed.isSymbolicLink() || !listed.isDirectory()) throw new Error("That path is not a folder.");
  const real = realpathSync(located.absolute);
  if (!insideRoot(located.root, real)) throw new Error("That path leaves the project.");
  const requested = located.relative;

  const entries = readdirSync(real, { withFileTypes: true })
    .filter((entry) => !hiddenEntry(entry.name, options?.includeDotfiles === true) && !entry.isSymbolicLink())
    .map((entry) => ({
      name: entry.name,
      path: requested ? `${requested}/${entry.name}` : entry.name,
      kind: entry.isDirectory() ? ("dir" as const) : ("file" as const),
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return {
    entries: entries.slice(0, MAX_ENTRIES),
    truncated: entries.length > MAX_ENTRIES,
  };
}
