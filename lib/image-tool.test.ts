import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirmImageGeneration } from "@/lib/image-confirm";
import { listGeneratedImages } from "@/lib/image-store";
import { createSession, insertMessage } from "@/lib/sessions";
import { makeHome } from "@/lib/test-home";
import { executeTool } from "@/lib/tools";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

const catalogEndpoint = {
  endpointId: "catalog",
  name: "gpt-5.4",
  baseUrl: "https://catalog.example/v1",
  apiKey: "catalog-key",
  model: "gpt-5.4-mini",
  models: ["gpt-5.4-mini", "gpt-image-2", "dall-e-3"],
};

const chatEndpoint = {
  endpointId: "chat",
  name: "Travis",
  baseUrl: "http://chat.example/v1",
  apiKey: "chat-key",
  model: "qwen",
  models: ["qwen"],
};

const imageEndpoint = {
  endpointId: "image-provider",
  name: "Image",
  baseUrl: "https://images.example/v1",
  apiKey: "saved-key",
  model: "gpt-image-2",
  models: ["gpt-image-2"],
};

vi.mock("@/lib/settings", () => ({
  endpointSettingsList: () => [catalogEndpoint, chatEndpoint, imageEndpoint],
  getSettings: () => chatEndpoint,
}));

beforeEach(() => {
  makeHome();
  vi.unstubAllGlobals();
});

async function prepare(prompt: string, toolCallId: string, extra?: Record<string, unknown>) {
  const session = createSession();
  const pending = await executeTool(
    "image_generate",
    JSON.stringify({ prompt, n: 2, size: "1024x1024", ...extra }),
    { sessionId: session.id, toolCallId },
  );
  if (pending.ok !== false) {
    insertMessage({
      sessionId: session.id,
      role: "tool",
      content: JSON.stringify(pending),
      toolCallId,
      toolName: "image_generate",
    });
  }
  return { session, pending };
}

describe("image_generate chat tool", () => {
  it("waits for confirmation, then uses the Image Studio key and default model", async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          { b64_json: PNG.toString("base64"), revised_prompt: "A moonlit greenhouse" },
          { b64_json: PNG.toString("base64") },
        ],
      }),
    );
    vi.stubGlobal("fetch", upstream);
    const { session, pending } = await prepare("A greenhouse on the moon", "call-42");

    expect(session.endpointId).toBe("chat");
    expect(pending).toMatchObject({
      ok: true,
      needsConfirm: true,
      endpointId: "image-provider",
      endpointName: "Image",
      model: "gpt-image-2",
    });
    expect(upstream).not.toHaveBeenCalled();

    const content = JSON.parse(await confirmImageGeneration(session.id, "call-42")) as {
      ok: boolean;
      images: Array<{ id: string; url: string }>;
    };
    expect(content.ok).toBe(true);
    expect(content.images).toHaveLength(2);
    expect(content.images[0].url).toBe(`/api/images/${content.images[0].id}`);
    expect(upstream).toHaveBeenCalledOnce();
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://images.example/v1/images/generations");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer saved-key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gpt-image-2",
      n: 2,
      size: "1024x1024",
    });

    const saved = listGeneratedImages({ sessionId: session.id });
    expect(saved).toHaveLength(2);
    const names = saved.map((item) => item.fileName).sort();
    expect(names[0]).toMatch(/^meridian_\d{12}0\.png$/);
    expect(names[1]).toMatch(/^meridian_\d{12}1\.png$/);
    expect(names[0]?.slice(0, -5)).toBe(names[1]?.slice(0, -5));
    expect(saved[0]).toMatchObject({
      toolCallId: "call-42",
      prompt: "A greenhouse on the moon",
      model: "gpt-image-2",
      mediaType: "image/png",
      byteSize: PNG.length,
    });
    expect(saved.some((item) => item.revisedPrompt === "A moonlit greenhouse")).toBe(true);
  });

  it("keeps the confirmation open when the provider rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "No quota" } }, { status: 429 })));
    const { session, pending } = await prepare("A lighthouse", "call-quota", { n: 1, size: "auto" });
    expect(pending).toMatchObject({ needsConfirm: true, endpointId: "image-provider" });

    const content = JSON.parse(await confirmImageGeneration(session.id, "call-quota")) as {
      ok: boolean;
      needsConfirm: boolean;
      error: string;
    };
    expect(content).toMatchObject({ ok: false, needsConfirm: true, error: "No quota" });
    expect(listGeneratedImages({ sessionId: session.id })).toHaveLength(0);
  });

  it("refuses a chat endpoint, an unknown endpoint, and an empty prompt without calling the provider", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const session = createSession();

    expect(
      await executeTool("image_generate", JSON.stringify({ prompt: "A lighthouse", endpointId: "chat" }), {
        sessionId: session.id,
      }),
    ).toMatchObject({ ok: false, error: "That endpoint is not set up for images. Choose the Image Studio endpoint." });
    expect(
      await executeTool("image_generate", JSON.stringify({ prompt: "A lighthouse", endpointId: "catalog" }), {
        sessionId: session.id,
      }),
    ).toMatchObject({ ok: false, error: "That endpoint is not set up for images. Choose the Image Studio endpoint." });
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
