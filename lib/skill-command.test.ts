import { describe, expect, it } from "vitest";

import { deriveTitle, parseSkillCommand } from "@/lib/skill-command";

describe("skill command", () => {
  it("parses short skill names and retains the legacy prefix", () => {
    expect(parseSkillCommand("/trip-planning plan the route")).toEqual({
      mode: null,
      skills: ["trip-planning"],
      rest: "plan the route",
    });
    expect(parseSkillCommand("/skill:trip-planning plan the route")).toEqual({
      mode: null,
      skills: ["trip-planning"],
      rest: "plan the route",
    });
  });

  it("honors up to five leading skills and derives a title from the request", () => {
    expect(parseSkillCommand("/one /two /three /four /five /six do the work")).toEqual({
      mode: null,
      skills: ["one", "two", "three", "four", "five"],
      rest: "/six do the work",
    });
    expect(deriveTitle("/trip-planning Plan a trip")).toBe("Plan a trip");
  });

  it("takes a leading mode before skills and does not treat the mode as a skill", () => {
    expect(parseSkillCommand("/plan /daily-planning tomorrow")).toEqual({
      mode: "plan",
      skills: ["daily-planning"],
      rest: "tomorrow",
    });
    expect(parseSkillCommand("/ask-mode what time is it")).toEqual({
      mode: "ask",
      skills: [],
      rest: "what time is it",
    });
    expect(parseSkillCommand("/agent")).toEqual({
      mode: "agent",
      skills: [],
      rest: "",
    });
    expect(parseSkillCommand("/ask /plan hello")?.mode).toBe("plan");
    expect(parseSkillCommand("/ask /plan hello")?.skills).toEqual([]);
    expect(deriveTitle("/plan /daily-planning tomorrow")).toBe("tomorrow");
    expect(deriveTitle("/ask-mode")).toBe("Ask mode");
  });
});
