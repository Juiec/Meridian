import { beforeEach, describe, expect, it } from "vitest";

import { discoverSkills, readSkillFile, renderSkillsIndex, splitFrontmatter } from "@/lib/skills";
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
      "cursor-phraser",
      "daily-planning",
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
    expect(phraser?.description).toMatch(/Cursor cloud agent/);
    const index = renderSkillsIndex(skills);
    expect(index).toContain("web-research:");
    expect(index).toContain(`cursor-phraser: ${phraser?.description}`);
    expect(index).not.toContain("Read `references/source-rubric.md`");
    expect(index).not.toContain("Read `references/brief-examples.md`");
    const parsed = splitFrontmatter(skills[0] ? `---\nname: ${skills[0].name}\ndescription: "${skills[0].description}"\n---\n${skills[0].body}\n` : "");
    expect(parsed?.body.length).toBeGreaterThan(20);
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
});
