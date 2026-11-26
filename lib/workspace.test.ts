import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { executeAgentTool } from "@/lib/agent-tools";
import { createProject, removeProject } from "@/lib/projects";
import { createSession, detachProject, getSession, updateSession } from "@/lib/sessions";
import { makeHome } from "@/lib/test-home";
import { executeTool } from "@/lib/tools";
import {
  cloneGit,
  cloneIntoProject,
  expandProjectMentions,
  readProjectFile,
  repoDirName,
  runInProject,
  writeProjectFile,
} from "@/lib/workspace";

beforeEach(() => {
  makeHome();
});

function hasGit(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("project workspace", () => {
  it("creates a folder on this machine and keeps the agent inside it", async () => {
    const project = createProject(" Demo ");
    expect(project.name).toBe("Demo");
    expect(project.managed).toBe(true);
    expect(existsSync(project.root)).toBe(true);

    const session = createSession();
    updateSession(session.id, { projectId: project.id });
    expect(getSession(session.id)?.projectName).toBe("Demo");

    expect(writeProjectFile(project.id, "src/app.ts", "export const n = 1;\n").ok).toBe(true);
    expect(readProjectFile(project.id, "src/app.ts").content).toContain("export const n = 1");
    expect(writeProjectFile(project.id, "../outside.txt", "no").ok).toBe(false);
    expect(writeProjectFile(project.id, ".env", "SECRET=1\n").ok).toBe(false);
    expect(existsSync(path.join(project.root, "..", "outside.txt"))).toBe(false);

    const listed = await executeTool("workspace_list", "{}", { sessionId: session.id });
    expect(listed.ok).toBe(true);
    expect(JSON.stringify(listed)).toContain("src");

    const unbound = await executeTool("workspace_read", JSON.stringify({ path: "src/app.ts" }), {});
    expect(unbound.ok).toBe(false);

    const blocked = await executeAgentTool(
      "workspace_run",
      JSON.stringify({ command: "echo hi" }),
      {},
      { sessionId: session.id, mode: "ask" },
    );
    expect(blocked.ok).toBe(false);
    expect(String(blocked.error)).toMatch(/Ask mode/);

    const ran = await runInProject(project.id, process.platform === "win32" ? "cd" : "pwd");
    expect(ran.ok).toBe(true);
    expect(String(ran.output).toLowerCase()).toContain(realpathSync(project.root).toLowerCase());

    const marker = "super-secret-meridian";
    process.env.EXAMPLE_API_KEY = marker;
    const echoed = await runInProject(
      project.id,
      process.platform === "win32" ? "echo %EXAMPLE_API_KEY%" : "echo $EXAMPLE_API_KEY",
    );
    delete process.env.EXAMPLE_API_KEY;
    expect(String(echoed.output)).not.toContain(marker);

    expect(expandProjectMentions("look at [Demo/src/app.ts]", project.id)).toContain("export const n = 1");
    expect(repoDirName("https://github.com/acme/vision-trainer.git")).toBe("vision-trainer");
    await expect(cloneIntoProject(project.id, "file:///tmp/repo")).rejects.toThrow(/https/);

    const root = project.root;
    removeProject(project.id);
    detachProject(project.id);
    expect(existsSync(root)).toBe(false);
    expect(getSession(session.id)?.projectId).toBeNull();
  });

  it("clones a local repository into the project folder", async () => {
    if (!hasGit()) return;
    const project = createProject("Clone");
    const source = mkdtempSync(path.join(tmpdir(), "meridian-repo-"));
    writeFileSync(path.join(source, "hello.txt"), "hi\n");
    const git = (args: string[]) => execFileSync("git", args, { cwd: source, stdio: "ignore" });
    git(["init"]);
    git(["add", "hello.txt"]);
    git(["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", "init"]);
    await cloneGit(realpathSync(project.root), source, "demo");
    expect(readFileSync(path.join(project.root, "demo", "hello.txt"), "utf8").replace(/\r\n/g, "\n")).toBe("hi\n");
  });
});
