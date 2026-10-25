import { describe, expect, it } from "vitest";

import { looksLikeEnvFile, prepareAttachments } from "@/lib/attachments";

describe("attachments", () => {
  it("refuses env files and keeps ordinary text", () => {
    expect(looksLikeEnvFile(".env", "A=1\nB=2")).toBe(true);
    expect(
      prepareAttachments([{ name: ".env.local", mediaType: "text/plain", text: "LM_STUDIO_API_KEY=secret\nMODEL=x" }]).ok,
    ).toBe(false);
    const notes = prepareAttachments([
      { name: "notes.md", mediaType: "text/markdown", text: "# Plan\n\nShip the desk." },
    ]);
    expect(notes.ok).toBe(true);
    if (notes.ok) {
      expect(notes.attachments[0]?.kind).toBe("text");
      expect(notes.attachments[0]?.text).toContain("Ship the desk.");
    }
  });

  it("accepts a small png data URL and rejects a fake one", () => {
    const png = prepareAttachments([
      { name: "shot.png", mediaType: "image/png", dataUrl: "data:image/png;base64,aGVsbG8=" },
    ]);
    expect(png.ok).toBe(true);
    const bad = prepareAttachments([{ name: "shot.png", mediaType: "image/png", dataUrl: "http://example.com/a.png" }]);
    expect(bad.ok).toBe(false);
  });
});
