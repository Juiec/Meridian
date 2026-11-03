import { describe, expect, it } from "vitest";

import { deriveTitle, parseSkillCommand } from "@/lib/skill-command";

describe("skill command", () => {
  it("parses short skill names and retains the legacy prefix", () => {
    expect(parseSkillCommand("/trip-planning plan the route")).toEqual({
      skills: ["trip-planning"],
      rest: "plan the route",
    });
    expect(parseSkillCommand("/skill:trip-planning plan the route")).toEqual({
      skills: ["trip-planning"],
      rest: "plan the route",
    });
  });

  it("honors up to five leading skills and derives a title from the request", () => {
    expect(parseSkillCommand("/one /two /three /four /five /six do the work")).toEqual({
      skills: ["one", "two", "three", "four", "five"],
      rest: "/six do the work",
    });
    expect(deriveTitle("/trip-planning Plan a trip")).toBe("Plan a trip");
  });
});
