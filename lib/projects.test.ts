import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { addProject, listProjectDir, listProjects, removeProject, renameProject, renameProjectEntry } from "@/lib/projects";
import { makeHome } from "@/lib/test-home";

beforeEach(() => {
  makeHome();
});

describe("project folders", () => {
  it("lists a folder, hides hidden files, and refuses a path that leaves it", () => {
    const root = mkdtempSync(path.join(tmpdir(), "meridian-project-"));
    mkdirSync(path.join(root, "src"));
    writeFileSync(path.join(root, "src", "a.ts"), "export {}\n");
    writeFileSync(path.join(root, "notes.txt"), "hello\n");
    writeFileSync(path.join(root, ".env"), "SECRET=1\n");

    const project = addProject(" Demo ", root);
    expect(project.name).toBe("Demo");
    expect(listProjects().map((item) => item.id)).toEqual([project.id]);
    expect(listProjectDir(project.id).entries.map((entry) => entry.name)).toEqual(["src", "notes.txt"]);
    expect(listProjectDir(project.id, "src").entries.map((entry) => entry.name)).toEqual(["a.ts"]);
    expect(() => listProjectDir(project.id, "../")).toThrow(/leaves the project/);
    expect(() => listProjectDir(project.id, "src/../../outside")).toThrow(/leaves the project/);
    expect(() => addProject("Missing", path.join(root, "nope"))).toThrow(/does not exist/);
    expect(() => addProject("Again", root)).toThrow(/already a project/);

    removeProject(project.id);
    expect(existsSync(path.join(root, "notes.txt"))).toBe(true);
    expect(listProjects()).toEqual([]);
    expect(() => removeProject(project.id)).toThrow(/not found/);
  });

  it("renames the project label and the file on disk", () => {
    const root = mkdtempSync(path.join(tmpdir(), "meridian-rename-"));
    mkdirSync(path.join(root, "src"));
    writeFileSync(path.join(root, "src", "a.ts"), "export {}\n");
    const project = addProject("Demo", root);

    expect(renameProject(project.id, " Vision ").name).toBe("Vision");
    expect(listProjects()[0]?.name).toBe("Vision");

    const file = renameProjectEntry(project.id, "src/a.ts", "app.ts");
    expect(file).toEqual({ name: "app.ts", path: "src/app.ts", kind: "file" });
    expect(existsSync(path.join(root, "src", "app.ts"))).toBe(true);
    expect(existsSync(path.join(root, "src", "a.ts"))).toBe(false);

    const folder = renameProjectEntry(project.id, "src", "lib");
    expect(folder.path).toBe("lib");
    expect(existsSync(path.join(root, "lib", "app.ts"))).toBe(true);

    expect(() => renameProjectEntry(project.id, "lib/app.ts", "../outside.ts")).toThrow(/not valid/);
    expect(() => renameProjectEntry(project.id, "lib/app.ts", "app/ts")).toThrow(/not valid/);
    expect(() => renameProjectEntry(project.id, "lib/app.ts", ".env")).toThrow(/refused/);
    writeFileSync(path.join(root, "lib", "taken.ts"), "x\n");
    expect(() => renameProjectEntry(project.id, "lib/app.ts", "taken.ts")).toThrow(/already used/);
    expect(existsSync(path.join(root, "lib", "app.ts"))).toBe(true);
    if (process.platform === "win32") {
      const cased = renameProjectEntry(project.id, "lib/app.ts", "App.ts");
      expect(cased.name).toBe("App.ts");
      expect(listProjectDir(project.id, "lib").entries.map((entry) => entry.name)).toContain("App.ts");
    }
  });
});
