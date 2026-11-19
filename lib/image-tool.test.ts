import { beforeEach, describe, expect, it, vi } from "vitest";

import { listGeneratedImages } from "@/lib/image-store";
import { createSession } from "@/lib/sessions";
import { makeHome } from "@/lib/test-home";
import { executeTool } from "@/lib/tools";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

vi.mock("@/lib/settings", () => ({
  endpointSettingsList: () => [
    {
      endpointId: "image-provider",
      name: "Image provider",
      baseUrl: "https://images.example/v1",
      apiKey: "saved-key",
      model: "gpt-image-2",
      models: ["gpt-image-2"],
    },
  ],
  getSettings: () => ({
    endpointId: "image-provider",
    name: "Image provider",
    baseUrl: "https://images.example/v1",
    apiKey: "saved-key",
    model: "gpt-image-2",
    models: ["gpt-image-2"],
  }),
}));

beforeEach(() => {
  makeHome();
  vi.unstubAllGlobals();
});

describe("image_generate chat tool", () => {
  it("generates images, stores them, and returns backend links", async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          { b64_json: PNG.toString("base64"), revised_prompt: "A moonlit greenhouse" },
          { b64_json: PNG.toString("base64") },
        ],
      }),
    );
    vi.stubGlobal("fetch", upstream);
    const session = createSession();

    const result = await executeTool(
      "image_generate",
      JSON.stringify({ prompt: "A greenhouse on the moon", n: 2, size: "1024x1024" }),
      { sessionId: session.id, toolCallId: "call-42" },
    );

    expect(result.ok).toBe(true);
    const images = result.images as Array<{ id: string; url: string }>;
    expect(images).toHaveLength(2);
    expect(images[0].url).toBe(`/api/images/${images[0].id}`);
    expect(upstream).toHaveBeenCalledOnce();
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://images.example/v1/images/generations");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer saved-key");
    expect(JSON.parse(String(init.body))).toMatchObject({ n: 2, size: "1024x1024" });

    const saved = listGeneratedImages({ sessionId: session.id });
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({
      toolCallId: "call-42",
      prompt: "A greenhouse on the moon",
      model: "gpt-image-2",
      mediaType: "image/png",
      byteSize: PNG.length,
    });
    expect(saved.some((item) => item.revisedPrompt === "A moonlit greenhouse")).toBe(true);
  });

  it("reports provider errors without writing an image record", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "No quota" } }, { status: 429 })));
    const session = createSession();

    const result = await executeTool(
      "image_generate",
      JSON.stringify({ prompt: "A lighthouse" }),
      { sessionId: session.id },
    );

    expect(result).toMatchObject({ ok: false, error: "No quota" });
    expect(listGeneratedImages({ sessionId: session.id })).toHaveLength(0);
  });

  it("refuses an unknown endpoint and an empty prompt", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const session = createSession();

    expect(
      await executeTool("image_generate", JSON.stringify({ prompt: "A lighthouse", endpointId: "missing" }), {
        sessionId: session.id,
      }),
    ).toMatchObject({ ok: false, error: "Choose a saved image endpoint in Image Studio." });
    expect(
      await executeTool("image_generate", JSON.stringify({ prompt: "   " }), { sessionId: session.id }),
    ).toMatchObject({ ok: false, error: "image_generate requires a prompt." });
    expect(upstream).not.toHaveBeenCalled();
  });
});
