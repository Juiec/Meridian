import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/images/route";
import { makeHome } from "@/lib/test-home";

vi.mock("@/lib/settings", () => ({
  endpointSettingsList: () => [
    {
      endpointId: "image-provider",
      name: "Image provider",
      baseUrl: "https://images.example/v1",
      apiKey: "saved-provider-key",
      model: "gpt-image-2",
      models: ["gpt-image-2"],
    },
  ],
}));

beforeEach(() => {
  makeHome();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function request(body: unknown) {
  return new Request("http://localhost/api/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("image generation route", () => {
  it("uses the selected endpoint and its server-side key", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ data: [{ b64_json: "image-data" }] }));
    vi.stubGlobal("fetch", upstream);

    const response = await POST(request({
      endpointId: "image-provider",
      model: "gpt-image-2",
      prompt: "A moonlit greenhouse",
      size: "1536x1024",
      n: 3,
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as { data: Array<{ b64_json?: string; fileName?: string | null }> };
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.b64_json).toBe("image-data");
    expect(payload.data[0]?.fileName).toMatch(/^meridian_\d{12}0\.png$/);
    expect(upstream).toHaveBeenCalledOnce();
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://images.example/v1/images/generations");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer saved-provider-key");
    expect(JSON.parse(String(init.body))).toEqual({
      model: "gpt-image-2",
      prompt: "A moonlit greenhouse",
      size: "1536x1024",
      n: 3,
    });
  });

  it("uploads an edit image to the selected endpoint", async () => {
    const upstream = vi.fn().mockResolvedValue(Response.json({ data: [{ b64_json: "edited-image" }] }));
    vi.stubGlobal("fetch", upstream);
    const body = new FormData();
    body.set("endpointId", "image-provider");
    body.set("model", "gpt-image-2");
    body.set("prompt", "Add a small red kite");
    body.set("size", "1024x1024");
    body.set("n", "1");
    body.set("image", new Blob(["png-data"], { type: "image/png" }), "source.png");

    const response = await POST(new Request("http://localhost/api/images", {
      method: "POST",
      body,
    }));

    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://images.example/v1/images/edits");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer saved-provider-key");
    const sent = init.body as FormData;
    expect(sent.get("model")).toBe("gpt-image-2");
    expect(sent.get("prompt")).toBe("Add a small red kite");
    expect(sent.get("image")).toBeInstanceOf(File);
  });

  it("rejects unsupported dimensions without making a provider request", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await POST(request({
      endpointId: "image-provider",
      model: "gpt-image-2",
      prompt: "A still life",
      size: "1000x1000",
      n: 1,
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Choose a supported image size (dimensions must be multiples of 16).",
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects an unknown endpoint without making a provider request", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await POST(request({
      endpointId: "missing",
      model: "gpt-image-2",
      prompt: "A still life",
      size: "1024x1024",
      n: 1,
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Choose a saved image endpoint in Image Studio.",
    });
    expect(upstream).not.toHaveBeenCalled();
  });
});
