import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import { writeAtomic } from "@/lib/atomic";
import { dataDir } from "@/lib/paths";

const SKIPPED = new Set(["node_modules", ".git", ".next", "dist", "coverage", ".turbo"]);
const MAX_ENTRIES = 200;

export type ProjectRecord = {
  id: string;
  name: string;
  root: string;
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

function readAll(): ProjectRecord[] {
  const file = registryPath();
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Registry).projects)) return [];
  return (parsed as Registry).projects.filter(isRecord);
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

function ignored(name: string): boolean {
  return name.startsWith(".") || SKIPPED.has(name.toLowerCase());
}

export function listProjects(): ProjectRecord[] {
  return readAll();
}

export function addProject(name: string, root: string): ProjectRecord {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Name the project.");
  if (cleanName.length > 80) throw new Error("Project name must be 80 characters or fewer.");
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
  const project: ProjectRecord = { id: randomUUID(), name: cleanName, root: real };
  save([...projects, project]);
  return project;
}

export function removeProject(id: string) {
  const projects = readAll();
  if (!projects.some((project) => project.id === id)) throw new Error("Project not found.");
  save(projects.filter((project) => project.id !== id));
}

export function listProjectDir(
  id: string,
  relativePath = "",
): { entries: ProjectEntry[]; truncated: boolean } {
  const project = readAll().find((item) => item.id === id);
  if (!project) throw new Error("Project not found.");
  if (!existsSync(project.root)) throw new Error("The project folder is missing.");
  const root = realpathSync(project.root);
  const requested = relativePath.trim().replaceAll("\\", "/");
  if (requested.split("/").some((part) => part === ".." || part === ".")) {
    throw new Error("That path leaves the project.");
  }
  const absolute = path.resolve(root, requested);
  if (!insideRoot(root, absolute)) throw new Error("That path leaves the project.");
  if (!existsSync(absolute)) throw new Error("That folder is missing.");
  const listed = lstatSync(absolute);
  if (listed.isSymbolicLink() || !listed.isDirectory()) throw new Error("That path is not a folder.");
  const real = realpathSync(absolute);
  if (!insideRoot(root, real)) throw new Error("That path leaves the project.");

  const entries = readdirSync(real, { withFileTypes: true })
    .filter((entry) => !ignored(entry.name) && !entry.isSymbolicLink())
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
