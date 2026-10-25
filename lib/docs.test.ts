import { beforeEach, describe, expect, it } from "vitest";

import { DOC_LIMITS, readDoc, writeDoc } from "@/lib/docs";
import { makeHome } from "@/lib/test-home";

beforeEach(() => {
  makeHome();
});

describe("identity docs", () => {
  it("writes SOUL.md and refuses an over-limit AGENTS.md", () => {
    const saved = writeDoc("soul", "# Identity\n\nBe brief.");
    expect(saved.used).toBeLessThan(saved.limit);
    expect(readDoc("soul").text).toContain("Be brief.");
    expect(() => writeDoc("agents", "x".repeat(DOC_LIMITS.agents + 1))).toThrow(/Nothing was written/);
    expect(readDoc("agents").text).not.toBe("x".repeat(DOC_LIMITS.agents + 1));
  });
});
