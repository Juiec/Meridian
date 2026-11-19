import { describe, expect, it } from "vitest";

import {
  MODE_ITEMS,
  applySlashSelection,
  filterSlashItems,
  insertSkillToken,
  setLeadingMode,
  slashTokenAt,
  type SlashItem,
} from "@/lib/slash-menu";

const catalog: SlashItem[] = [
  ...MODE_ITEMS,
  { kind: "skill", name: "daily-planning", description: "Plan the day.", insert: "/daily-planning " },
  { kind: "tool", name: "fetch_url", description: "Fetch a public page.", insert: "use `fetch_url` to " },
];

describe("slash menu", () => {
  it("finds the slash token at the caret", () => {
    expect(slashTokenAt("hello /pl", "hello /pl".length)).toEqual({ start: 6, query: "pl" });
    expect(slashTokenAt("/ask", 4)).toEqual({ start: 0, query: "ask" });
    expect(slashTokenAt("hello /pl more", "hello /pl".length)).toEqual({ start: 6, query: "pl" });
    expect(slashTokenAt("hello /pl more", "hello /pl more".length)).toBeNull();
    expect(slashTokenAt("hello", 0)).toBeNull();
  });

  it("filters with a regex and falls back to a literal when the pattern is invalid", () => {
    expect(filterSlashItems("", catalog).map((item) => item.name)).toEqual(catalog.map((item) => item.name));
    expect(filterSlashItems("pla.", catalog).map((item) => item.name)).toEqual(["plan", "daily-planning"]);
    expect(filterSlashItems("(", catalog).map((item) => item.name)).toEqual([]);
    expect(filterSlashItems("fetch", catalog).map((item) => item.name)).toEqual(["fetch_url"]);
  });

  it("inserts a mode at the start and a skill or tool at the caret", () => {
    expect(applySlashSelection("see /pl", 4, 7, MODE_ITEMS[2])).toEqual({ text: "/plan see ", caret: 6 });
    const skill = catalog.find((item) => item.name === "daily-planning");
    expect(skill).toBeDefined();
    expect(applySlashSelection("/da", 0, 3, skill!)).toEqual({ text: "/daily-planning ", caret: 16 });
    expect(setLeadingMode("/ask keep this", "agent")).toBe("/agent keep this");
    expect(insertSkillToken("/ask hello", "daily-planning")).toBe("/ask /daily-planning hello");
    expect(insertSkillToken("hello", "daily-planning")).toBe("/daily-planning hello");
    expect(insertSkillToken("/daily-planning hello", "daily-planning")).toBe("/daily-planning hello");
  });
});
