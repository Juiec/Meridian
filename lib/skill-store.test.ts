import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { modeAllowsTool } from "@/lib/chat-mode";
import { createSkill, deleteSkill, readSkillSource, updateSkill } from "@/lib/skill-store";
import { discoverSkills } from "@/lib/skills";
import { makeHome } from "@/lib/test-home";
import { executeTool } from "@/lib/tools";

beforeEach(() => {
  makeHome();
});

describe("skill store", () => {
  it("creates, edits, and deletes a skill without putting the body in the index path", () => {
    createSkill({
      name: "ship-note",
      description: "Write a short shipping note when the user asks what changed.",
      body: "List what changed, what is uncertain, and what is left.",
      disableModelInvocation: false,
      references: [{ name: "tone.md", content: "Keep it short." }],
    });
    const found = discoverSkills().skills.find((skill) => skill.name === "ship-note");
    expect(found?.description).toContain("shipping note");
    expect(found?.files).toContain("references/tone.md");
    const source = readSkillSource("ship-note");
    expect(source.body).toContain("what is left");
    updateSkill("ship-note", {
      ...source,
      description: "Write the shipping note when asked what just landed.",
      references: source.references,
    });
    expect(discoverSkills().skills.find((skill) => skill.name === "ship-note")?.description).toContain("just landed");
    deleteSkill("ship-note");
    expect(discoverSkills().skills.some((skill) => skill.name === "ship-note")).toBe(false);
  });

  it("rejects a missing description before writing", () => {
    expect(() =>
      createSkill({
        name: "broken",
        description: "",
        body: "nope",
        disableModelInvocation: false,
        references: [],
      }),
    ).toThrow(/description/i);
    expect(discoverSkills().skills.some((skill) => skill.name === "broken")).toBe(false);
  });

  it("keeps a global skill on disk and saves an override in the project", () => {
    createSkill({
      name: "ship-note",
      description: "Write a short shipping note when the user asks what changed.",
      body: "List what changed.",
      disableModelInvocation: true,
      references: [],
    });
    const home = process.env.MERIDIAN_HOME ?? "";
    expect(existsSync(path.join(home, ".agents", "skills", "ship-note", "agents", "openai.yaml"))).toBe(false);
    expect(discoverSkills().skills.find((skill) => skill.name === "ship-note")?.disableModelInvocation).toBe(true);

    const global = path.join(home, "global-skills");
    const skillDir = path.join(global, "fare-notes");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      '---\nname: fare-notes\ndescription: "Look up a fare the user already has a link for."\n---\nCheck the link.\n',
    );
    process.env.MERIDIAN_GLOBAL_SKILLS = global;
    expect(() => deleteSkill("fare-notes")).toThrow(/globally/);
    updateSkill("fare-notes", {
      name: "fare-notes",
      description: "Look up a fare the user already has a link for.",
      body: "Project override.",
      disableModelInvocation: false,
      references: [],
    });
    const found = discoverSkills().skills.find((skill) => skill.name === "fare-notes");
    expect(found?.origin).toBe("project");
    expect(found?.body).toContain("Project override");
    expect(existsSync(path.join(skillDir, "SKILL.md"))).toBe(true);
  });

  it("creates and updates a skill through skill_write, and refuses a mode name", async () => {
    expect(modeAllowsTool("ask", "skill_write")).toBe(false);
    expect(modeAllowsTool("plan", "skill_write")).toBe(false);
    expect(modeAllowsTool("agent", "skill_write")).toBe(true);
    const created = await executeTool(
      "skill_write",
      JSON.stringify({
        name: "ship-note",
        description: "Write a short shipping note when the user asks what changed.",
        body: "List what changed.",
        references: [{ name: "tone.md", content: "Keep it short." }],
      }),
    );
    expect(created.ok).toBe(true);
    expect(created.action).toBe("created");
    const updated = await executeTool(
      "skill_write",
      JSON.stringify({
        name: "ship-note",
        description: "Write the shipping note when asked what just landed.",
        body: "List what landed.",
      }),
    );
    expect(updated.ok).toBe(true);
    expect(updated.action).toBe("updated");
    expect(readSkillSource("ship-note").references.map((reference) => reference.name)).toEqual(["tone.md"]);
    const reserved = await executeTool(
      "skill_write",
      JSON.stringify({ name: "ask", description: "Nope.", body: "Nope." }),
    );
    expect(reserved.ok).toBe(false);
  });
});
