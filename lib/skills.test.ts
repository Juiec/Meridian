import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { discoverSkills, indexSkills, readSkillFile, renderSkillsIndex, splitFrontmatter } from "@/lib/skills";
import { makeHome } from "@/lib/test-home";

beforeEach(() => {
  makeHome();
});

describe("skills", () => {
  it("parses frontmatter and leaves the body out of the index", () => {
    const { skills } = discoverSkills();
    const names = skills.map((skill) => skill.name).sort();
    expect(names).toEqual([
      "code-explain",
      "create-skill",
      "cursor-phraser",
      "daily-planning",
      "image",
      "itinerary-day",
      "packing-list",
      "prompt-refine",
      "travel-research",
      "trip-planning",
      "web-research",
    ]);
    const phraser = skills.find((skill) => skill.name === "cursor-phraser");
    expect(phraser?.description.length).toBeGreaterThan(20);
    expect(phraser?.description.length).toBeLessThanOrEqual(1024);
    expect(phraser?.disableModelInvocation).toBe(false);
    expect(phraser?.origin).toBe("project");
    expect(phraser?.rel).toBe(".agents/skills/cursor-phraser");
    expect(phraser?.description).toMatch(/Cursor cloud agent/);
    const index = renderSkillsIndex(skills);
    expect(index).toContain("web-research:");
    expect(index).not.toContain("create-skill:");
    expect(skills.find((skill) => skill.name === "create-skill")?.disableModelInvocation).toBe(true);
    expect(index).toContain(`cursor-phraser: ${phraser?.description}`);
    expect(index).not.toContain("Read `references/source-rubric.md`");
    expect(index).not.toContain("Read `references/brief-examples.md`");
    const parsed = splitFrontmatter(skills[0] ? `---\nname: ${skills[0].name}\ndescription: "${skills[0].description}"\n---\n${skills[0].body}\n` : "");
    expect(parsed?.body.length).toBeGreaterThan(20);
  });

  it("parses Windows CRLF frontmatter", () => {
    const parsed = splitFrontmatter(
      '---\r\nname: windows-skill\r\ndescription: "A skill with Windows line endings."\r\n---\r\nBody',
    );
    expect(parsed?.data).toEqual({
      name: "windows-skill",
      description: "A skill with Windows line endings.",
    });
    expect(parsed?.body).toBe("Body");
  });

  it("loads a reference and refuses path traversal", () => {
    const loaded = readSkillFile("web-research", "references/source-rubric.md");
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.content).toMatch(/Source rubric/);
    const example = readSkillFile("cursor-phraser", "references/brief-examples.md");
    expect(example.ok).toBe(true);
    if (example.ok) expect(example.content).toMatch(/Non-binding guess/);
    const escaped = readSkillFile("web-research", "../SOUL.md");
    expect(escaped.ok).toBe(false);
  });

  it("prefers the repo skill and still loads a global skill", () => {
    const home = process.env.MERIDIAN_HOME ?? "";
    const global = path.join(home, "global-skills");
    writeSkill(path.join(global, "web-research"), "web-research", "Global copy that must not win.", "Global body");
    writeSkill(path.join(global, "fare-notes"), "fare-notes", "Look up a fare the user already has a link for.", "Check the link.");
    const quiet = path.join(global, "quiet-skill");
    writeSkill(quiet, "quiet-skill", "Only when the user names it.", "Stay quiet.");
    mkdirSync(path.join(quiet, "agents"), { recursive: true });
    writeFileSync(path.join(quiet, "agents", "openai.yaml"), "policy:\n  allow_implicit_invocation: false\n");
    process.env.MERIDIAN_GLOBAL_SKILLS = global;

    const { skills, skipped } = discoverSkills();
    expect(skills.find((skill) => skill.name === "web-research")?.description).not.toMatch(/Global copy/);
    expect(skills.find((skill) => skill.name === "web-research")?.origin).toBe("project");
    expect(skills.find((skill) => skill.name === "fare-notes")?.origin).toBe("global");
    expect(skipped.some((item) => item.path.endsWith("/web-research") && item.reason.includes("ignored"))).toBe(true);
    const quietSkill = skills.find((skill) => skill.name === "quiet-skill");
    expect(quietSkill?.disableModelInvocation).toBe(true);
    expect(indexSkills(skills).some((skill) => skill.name === "quiet-skill")).toBe(false);
    expect(readSkillFile("quiet-skill").ok).toBe(true);
  });

  it("still reads a skill left in the old skills folder", () => {
    const home = process.env.MERIDIAN_HOME ?? "";
    writeSkill(
      path.join(home, "skills", "old-note"),
      "old-note",
      "A leftover skill from the old folder.",
      "Use the new folder next time.",
    );
    const found = discoverSkills().skills.find((skill) => skill.name === "old-note");
    expect(found?.origin).toBe("legacy");
    expect(found?.rel).toBe("skills/old-note");
  });
});

function writeSkill(dir: string, name: string, description: string, body: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(dir + "/SKILL.md", `---\nname: ${name}\ndescription: "${description}"\n---\n${body}\n`);
}
