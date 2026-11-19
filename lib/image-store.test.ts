import { existsSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteImagesForSession,
  getGeneratedImage,
  imageFilePath,
  insertGeneratedImage,
  listGeneratedImages,
  readImageBytes,
} from "@/lib/image-store";
import { createSession, deleteSession, updateSession } from "@/lib/sessions";
import { dataDir } from "@/lib/paths";
import { makeHome } from "@/lib/test-home";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

beforeEach(() => {
  makeHome();
});

describe("backend image log", () => {
  it("stores bytes and metadata linked to a chat session", () => {
    const session = createSession();
    updateSession(session.id, { title: "Moon garden" });
    const saved = insertGeneratedImage({
      bytes: PNG,
      mediaType: "image/png",
      prompt: "A greenhouse on the moon",
      model: "gpt-image-2",
      endpointId: "default",
      size: "1024x1024",
      sessionId: session.id,
      toolCallId: "call-1",
    });

    expect(saved.url).toBe(`/api/images/${saved.id}`);
    expect(saved.mediaType).toBe("image/png");
    expect(getGeneratedImage(saved.id)?.sessionTitle).toBe("Moon garden");
    expect(readImageBytes(saved)?.equals(PNG)).toBe(true);
    expect(existsSync(path.join(dataDir(), "images", `${saved.id}.png`))).toBe(true);
    const listed = listGeneratedImages({ sessionId: session.id });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ toolCallId: "call-1", prompt: "A greenhouse on the moon" });
  });

  it("rejects traversal ids and removes files with the session", () => {
    const session = createSession();
    const saved = insertGeneratedImage({
      bytes: PNG,
      mediaType: "image/png",
      prompt: "Temporary image",
      model: "gpt-image-2",
      endpointId: "default",
      size: "auto",
      sessionId: session.id,
    });
    const file = imageFilePath(saved)!;
    expect(getGeneratedImage("../etc/passwd")).toBeNull();
    expect(deleteSession(session.id)).toBe(true);
    expect(existsSync(file)).toBe(false);
    expect(getGeneratedImage(saved.id)).toBeNull();
    expect(deleteImagesForSession(session.id)).toBe(0);
  });
});
