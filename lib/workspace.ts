import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { isSecretFilename } from "@/lib/attachments";
import type { ChatMode } from "@/lib/chat-mode";
import { modeInstructions } from "@/lib/chat-mode";
import {
  getProject,
  listProjectDir,
  listProjects,
  resolveProjectPath,
  type ProjectRecord,
} from "@/lib/projects";
import { getSession } from "@/lib/sessions";

const READ_MAX = 40_000;
const WRITE_MAX = 200_000;
const RUN_MAX = 16_000;
const RUN_TIMEOUT_MS = 60_000;
const CLONE_TIMEOUT_MS = 180_000;
const MENTION_FILE_MAX = 12_000;
const MENTION_TOTAL_MAX = 24_000;

const MENTION = /\[([^\[\]/\r\n]{1,80})\/([^\[\]\r\n]{1,300})\]/g;

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[truncated]`;
}

function scrubEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/(api[_-]?key|token|secret|password|credential|passwd)/i.test(key)) delete env[key];
  }
  return env;
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  shell = false,
): Promise<{ code: number; output: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    const finish = (result: { code: number; output: string; timedOut: boolean }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const child = spawn(command, args, {
      cwd,
      shell,
      windowsHide: true,
      env: scrubEnv(),
    });
    const timer = setTimeout(() => {
      child.kill();
      finish({ code: 1, output: clip(output, RUN_MAX), timedOut: true });
    }, timeoutMs);
    const push = (chunk: Buffer) => {
      if (output.length >= RUN_MAX) return;
      output += chunk.toString("utf8");
      if (output.length > RUN_MAX) output = clip(output, RUN_MAX);
    };
    child.stdout?.on("data", push);
    child.stderr?.on("data", push);
    child.on("error", (err) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish({ code: code ?? 1, output: output.trim(), timedOut: false });
    });
  });
}

function assertInside(root: string, absolute: string) {
  if (!existsSync(absolute)) {
    const parent = path.dirname(absolute);
    if (!existsSync(parent)) return;
    const realParent = realpathSync(parent);
    const relative = path.relative(root, realParent);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("That path leaves the project.");
    return;
  }
  const listed = lstatSync(absolute);
  if (listed.isSymbolicLink()) throw new Error("That path leaves the project.");
  const real = realpathSync(absolute);
  const relative = path.relative(root, real);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("That path leaves the project.");
}

export function sessionProject(sessionId: string | undefined): ProjectRecord {
  if (!sessionId) throw new Error("This chat is not bound to a project.");
  const session = getSession(sessionId);
  if (!session?.projectId) {
    throw new Error("This chat is not bound to a project. Choose Work here on a project in the sidebar.");
  }
  const project = getProject(session.projectId);
  if (!project) throw new Error("That project was forgotten. Choose another one.");
  if (!existsSync(project.root)) throw new Error("The project folder is missing.");
  return project;
}

export function workspaceInstructions(project: ProjectRecord | null): string {
  if (!project) return "";
  const where = project.managed
    ? "Meridian created this folder on this machine."
    : "This folder was linked from this machine.";
  return `# Workspace

This chat is bound to the project "${project.name}". ${where} Cloned repositories and new files live here. Commands start in this folder.

Use workspace_list to see files, workspace_read to open one, workspace_write to create or replace one, and workspace_run to run a command such as a test. Paths are relative to the project, like README.md or a cloned folder name. Stay inside the project. Do not claim a file was written or a command ran unless the tool result says so.

A mention like [${project.name}/README.md] is a file in a saved project. If its contents are already in the user message, use them. Otherwise read the file.

Ignore the line that says there is no working directory. This project is the working directory.`;
}

export function turnInstructions(session: { chatMode: ChatMode; projectId: string | null }): string {
  const project = session.projectId ? getProject(session.projectId) : null;
  return [modeInstructions(session.chatMode), workspaceInstructions(project)].filter(Boolean).join("\n\n");
}

export function expandProjectMentions(content: string, preferredId: string | null): string {
  const projects = listProjects();
  const blocks: string[] = [];
  let added = 0;
  const seen = new Set<string>();
  for (const match of content.matchAll(MENTION)) {
    const name = match[1].trim();
    const rel = match[2].trim();
    const key = `${name}/${rel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const candidates = projects.filter((project) => project.name === name);
    if (candidates.length === 0) continue;
    const project = candidates.find((item) => item.id === preferredId) ?? candidates[0];
    if (added >= MENTION_TOTAL_MAX) {
      blocks.push(`<file project="${project.name}" path="${rel}">\nNot included. The mention budget is full. Use workspace_read.\n</file>`);
      continue;
    }
    const read = readProjectFile(project.id, rel);
    const body = read.ok ? clip(String(read.content ?? ""), MENTION_FILE_MAX) : String(read.error ?? "Could not read that file.");
    added += body.length;
    blocks.push(`<file project="${project.name}" path="${rel}">\n${body}\n</file>`);
  }
  if (blocks.length === 0) return content;
  return `${content}\n\n${blocks.join("\n\n")}`;
}

export function readProjectFile(id: string, relativePath: string): Record<string, unknown> {
  const requested = relativePath.trim();
  if (!requested) return { ok: false, error: "Give a file path inside the project." };
  let located: ReturnType<typeof resolveProjectPath>;
  try {
    located = resolveProjectPath(id, requested);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read that file." };
  }
  if (isSecretFilename(located.relative)) return { ok: false, error: "That file is refused." };
  if (!existsSync(located.absolute)) return { ok: false, error: "That file is not in the project." };
  try {
    assertInside(located.root, located.absolute);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "That path leaves the project." };
  }
  const info = lstatSync(located.absolute);
  if (info.isDirectory()) return { ok: false, error: "That path is a folder. Use workspace_list." };
  if (!info.isFile()) return { ok: false, error: "That path is not a file." };
  if (info.size > 200_000) return { ok: false, error: `That file is ${info.size} bytes. It is too large to read.` };
  const bytes = readFileSync(located.absolute);
  if (bytes.includes(0)) return { ok: false, error: "That file is binary." };
  const text = bytes.toString("utf8");
  return {
    ok: true,
    path: located.relative,
    content: clip(text, READ_MAX),
    truncated: text.length > READ_MAX,
  };
}

export function writeProjectFile(id: string, relativePath: string, content: string): Record<string, unknown> {
  const requested = relativePath.trim();
  if (!requested) return { ok: false, error: "Give a file path inside the project." };
  if (content.length > WRITE_MAX) return { ok: false, error: `Content is ${content.length} characters. Keep it under ${WRITE_MAX}. Nothing was written.` };
  if (content.includes("\0")) return { ok: false, error: "That content is not valid text." };
  let located: ReturnType<typeof resolveProjectPath>;
  try {
    located = resolveProjectPath(id, requested);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not write that file." };
  }
  if (isSecretFilename(located.relative)) return { ok: false, error: "That file is refused." };
  if (existsSync(located.absolute)) {
    try {
      assertInside(located.root, located.absolute);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "That path leaves the project." };
    }
    if (lstatSync(located.absolute).isDirectory()) return { ok: false, error: "That path is a folder." };
  }
  mkdirSync(path.dirname(located.absolute), { recursive: true });
  try {
    assertInside(located.root, path.dirname(located.absolute));
    if (existsSync(located.absolute)) assertInside(located.root, located.absolute);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "That path leaves the project." };
  }
  writeFileSync(located.absolute, content);
  return { ok: true, path: located.relative, bytes: statSync(located.absolute).size };
}

export async function runInProject(id: string, command: string): Promise<Record<string, unknown>> {
  const trimmed = command.trim();
  if (!trimmed) return { ok: false, error: "workspace_run requires a command." };
  if (trimmed.length > 2_000) return { ok: false, error: "Command is too long." };
  if (trimmed.includes("\0")) return { ok: false, error: "Command is not valid." };
  let root = "";
  let name = "";
  try {
    const located = resolveProjectPath(id, "");
    root = located.root;
    name = located.project.name;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The project folder is missing." };
  }
  try {
    const result = await runProcess(trimmed, [], root, RUN_TIMEOUT_MS, true);
    if (result.timedOut) {
      return { ok: false, timedOut: true, project: name, output: result.output, error: "The command timed out after 60 seconds." };
    }
    return {
      ok: result.code === 0,
      exitCode: result.code,
      project: name,
      output: result.output || (result.code === 0 ? "" : "The command failed with no output."),
      ...(result.code === 0 ? {} : { error: `The command exited with code ${result.code}.` }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The command could not start." };
  }
}

export function assertHttpsRepo(url: string): URL {
  const trimmed = url.trim();
  if (!trimmed || /[\s\u0000]/.test(trimmed)) throw new Error("Give an https repository URL.");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("That repository URL is not valid.");
  }
  if (parsed.protocol !== "https:") throw new Error("Clone only https repository URLs.");
  if (parsed.username || parsed.password) throw new Error("Remove the username and password from the URL.");
  if (!parsed.hostname) throw new Error("That repository URL is not valid.");
  return parsed;
}

export function repoDirName(url: string): string {
  const parsed = assertHttpsRepo(url);
  const segment = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
  const base = segment.replace(/\.git$/i, "");
  const clean = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  if (!clean || clean === "." || clean === "..") throw new Error("That repository URL has no usable name.");
  return clean;
}

export async function cloneGit(root: string, source: string, folderName: string): Promise<void> {
  const dest = path.join(root, folderName);
  if (existsSync(dest)) throw new Error(`${folderName} is already in this project.`);
  let result: { code: number; output: string; timedOut: boolean };
  try {
    result = await runProcess("git", ["clone", "--depth", "1", "--", source, dest], root, CLONE_TIMEOUT_MS);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
    if (code === "ENOENT") throw new Error("Git is not installed on this machine.");
    throw new Error(err instanceof Error ? err.message : "Git could not start.");
  }
  if (result.timedOut) {
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    throw new Error("The clone timed out after 3 minutes. Nothing was kept.");
  }
  if (result.code !== 0) {
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    const detail = result.output.replace(/\s+/g, " ").trim().slice(0, 400);
    throw new Error(detail ? `Clone failed. ${detail}` : "Clone failed.");
  }
  const realRoot = realpathSync(root);
  const realDest = realpathSync(dest);
  const relative = path.relative(realRoot, realDest);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    rmSync(dest, { recursive: true, force: true });
    throw new Error("The clone left the project. It was removed.");
  }
}

export async function cloneIntoProject(id: string, url: string): Promise<{ path: string; name: string }> {
  const project = getProject(id);
  if (!project) throw new Error("Project not found.");
  if (!existsSync(project.root)) throw new Error("The project folder is missing.");
  const folder = repoDirName(url);
  const root = realpathSync(project.root);
  await cloneGit(root, url.trim(), folder);
  return { path: folder, name: folder };
}

export async function executeWorkspaceTool(
  name: string,
  args: Record<string, unknown>,
  sessionId: string | undefined,
): Promise<Record<string, unknown>> {
  let project: ProjectRecord;
  try {
    project = sessionProject(sessionId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "This chat is not bound to a project." };
  }
  if (name === "workspace_list") {
    const relative = typeof args.path === "string" ? args.path : "";
    try {
      const listed = listProjectDir(project.id, relative, { includeDotfiles: true });
      return { ok: true, project: project.name, path: relative.trim() || ".", ...listed };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not list that folder." };
    }
  }
  if (name === "workspace_read") {
    const relative = typeof args.path === "string" ? args.path : "";
    return readProjectFile(project.id, relative);
  }
  if (name === "workspace_write") {
    const relative = typeof args.path === "string" ? args.path : "";
    const content = typeof args.content === "string" ? args.content : "";
    if (typeof args.content !== "string") return { ok: false, error: "workspace_write requires content." };
    return writeProjectFile(project.id, relative, content);
  }
  if (name === "workspace_run") {
    const command = typeof args.command === "string" ? args.command : "";
    return runInProject(project.id, command);
  }
  return { ok: false, error: `Unknown tool "${name}".` };
}
