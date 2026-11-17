import { jsonError } from "@/lib/http";
import { endpointSettingsList } from "@/lib/settings";

const MAX_PROMPT_LENGTH = 32_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 10;

type ImageRequest = {
  endpointId: string;
  model: string;
  prompt: string;
  size: string;
  count: number;
  image?: File;
};

function validSize(size: string): boolean {
  if (size === "auto") return true;
  const match = /^(\d{2,4})x(\d{2,4})$/.exec(size);
  if (!match) return false;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return (
    width >= 256 &&
    height >= 256 &&
    width <= 4096 &&
    height <= 4096 &&
    width % 16 === 0 &&
    height % 16 === 0 &&
    width * height <= 16_777_216 &&
    Math.max(width, height) <= Math.min(width, height) * 3
  );
}

async function parseRequest(request: Request): Promise<ImageRequest | Response> {
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      if (!body || Array.isArray(body) || typeof body !== "object") return jsonError("Expected a JSON object.");
      if (
        typeof body.endpointId !== "string" ||
        typeof body.model !== "string" ||
        typeof body.prompt !== "string" ||
        typeof body.size !== "string" ||
        typeof body.n !== "number"
      ) {
        return jsonError("Endpoint, model, prompt, size, and batch amount are required.");
      }
      return { endpointId: body.endpointId, model: body.model, prompt: body.prompt, size: body.size, count: body.n };
    } catch {
      return jsonError("Could not read the image request.");
    }
  }

  try {
    const form = await request.formData();
    const endpointId = form.get("endpointId");
    const model = form.get("model");
    const prompt = form.get("prompt");
    const size = form.get("size");
    const rawCount = form.get("n");
    const image = form.get("image");
    if (
      typeof endpointId !== "string" ||
      typeof model !== "string" ||
      typeof prompt !== "string" ||
      typeof size !== "string" ||
      typeof rawCount !== "string"
    ) {
      return jsonError("Endpoint, model, prompt, size, and batch amount are required.");
    }
    const count = Number(rawCount);
    if (image !== null && !(image instanceof File)) return jsonError("The edit image is invalid.");
    return { endpointId, model, prompt, size, count, image: image ?? undefined };
  } catch {
    return jsonError("Could not read the image request.");
  }
}

export async function POST(request: Request) {
  const input = await parseRequest(request);
  if (input instanceof Response) return input;
  const endpoint = endpointSettingsList().find((item) => item.endpointId === input.endpointId);
  if (!endpoint) return jsonError("Choose a saved image endpoint in Image Studio.", 400);
  if (!endpoint.baseUrl) return jsonError(`Add a base URL for ${endpoint.name} in Settings first.`, 400);
  if (!input.model.trim()) return jsonError("Choose an image model for this endpoint.", 400);
  if (input.model.length > 200) return jsonError("Model name is too long.");
  if (!input.prompt.trim()) return jsonError("Enter a prompt before generating.");
  if (input.prompt.length > MAX_PROMPT_LENGTH) return jsonError("Prompt is too long (max 32000 characters).");
  if (!validSize(input.size)) return jsonError("Choose a supported image size (dimensions must be multiples of 16).");
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > MAX_IMAGES) {
    return jsonError(`Batch amount must be between 1 and ${MAX_IMAGES}.`);
  }
  if (input.image) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(input.image.type)) {
      return jsonError("Use a PNG, JPEG, or WebP image to edit.");
    }
    if (input.image.size > MAX_IMAGE_BYTES) return jsonError("The edit image must be 20 MB or smaller.");
  }

  let body: BodyInit;
  const headers = new Headers();
  if (endpoint.apiKey) headers.set("Authorization", `Bearer ${endpoint.apiKey}`);
  if (input.image) {
    const form = new FormData();
    form.set("model", input.model.trim());
    form.set("prompt", input.prompt);
    form.set("size", input.size);
    form.set("n", String(input.count));
    form.set("image", input.image, input.image.name);
    body = form;
  } else {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify({ model: input.model.trim(), prompt: input.prompt, size: input.size, n: input.count });
  }

  const baseUrl = endpoint.baseUrl.replace(/\/+$/, "");
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/images/${input.image ? "edits" : "generations"}`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: request.signal,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? `Could not reach ${endpoint.name}: ${error.message}` : `Could not reach ${endpoint.name}.`, 502);
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    try {
      const payload = JSON.parse(text) as { error?: { message?: unknown } };
      const message = typeof payload.error?.message === "string" ? payload.error.message : `${endpoint.name} request failed (${upstream.status}).`;
      return jsonError(message, upstream.status);
    } catch {
      return jsonError(`${endpoint.name} request failed (${upstream.status}).`, upstream.status);
    }
  }

  try {
    return Response.json(JSON.parse(text), { status: upstream.status });
  } catch {
    return jsonError(`${endpoint.name} returned an unreadable image response.`, 502);
  }
}
