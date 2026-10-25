import { beforeEach, describe, expect, it } from "vitest";

import { assembleSystemPrompt } from "@/lib/prompt";
import { discoverSkills } from "@/lib/skills";
import { makeHome } from "@/lib/test-home";

beforeEach(() => {
  makeHome();
});

describe("prompt assembly", () => {
  it("orders stable, context, then volatile and omits skill bodies", () => {
    const { skills } = discoverSkills();
    const { prompt } = assembleSystemPrompt({
      skills,
      memoryEntries: ["Editor is neovim."],
      userEntries: ["Name is glowdening."],
      now: new Date("2026-10-24T18:00:00.000Z"),
      sessionId: "session-1",
      model: "test-model",
    });
    const identity = prompt.indexOf("# Identity");
    const tools = prompt.indexOf("# How to work");
    const context = prompt.indexOf("# Project context");
    const skillsHeading = prompt.indexOf("# Skills index");
    const memory = prompt.indexOf("# Memory snapshot");
    const user = prompt.indexOf("# User profile");
    const runtime = prompt.indexOf("# Runtime");
    expect(identity).toBeGreaterThanOrEqual(0);
    expect(identity).toBeLessThan(tools);
    expect(tools).toBeLessThan(context);
    expect(context).toBeLessThan(skillsHeading);
    expect(skillsHeading).toBeLessThan(memory);
    expect(memory).toBeLessThan(user);
    expect(user).toBeLessThan(runtime);
    expect(prompt).toContain("web-research:");
    expect(prompt).toContain("Editor is neovim.");
    expect(prompt).toContain("Name is glowdening.");
    expect(prompt).toContain("2026-10-24T18:00:00.000Z");
    expect(prompt).not.toContain("Read `references/source-rubric.md`");
    expect(prompt).not.toContain("You are Hermes");
  });
});
