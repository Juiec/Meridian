import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { addProject, listProjectDir, listProjects, removeProject } from "@/lib/projects";
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
    expect(listProjects()).toEqual([]);
    expect(() => removeProject(project.id)).toThrow(/not found/);
  });
});
