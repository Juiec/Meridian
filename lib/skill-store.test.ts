import { beforeEach, describe, expect, it } from "vitest";

import { createSkill, deleteSkill, readSkillSource, updateSkill } from "@/lib/skill-store";
import { discoverSkills } from "@/lib/skills";
import { makeHome } from "@/lib/test-home";

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
});
