import { ImageSettingsError, resolveImageTarget } from "@/lib/image-settings";
import { detectImageMediaType, insertGeneratedImage, type GeneratedImage } from "@/lib/image-store";
import { endpointSettingsList, type ResolvedSettings } from "@/lib/settings";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGES = 10;
export const MAX_INPUT_IMAGES = 16;
const MAX_PROMPT_LENGTH = 32_000;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type GeneratedImagePayload = {
  b64_json?: string;
  url?: string;
  revised_prompt?: string;
};

export type ImageGenerationInput = {
  endpointId?: string;
  model?: string;
  prompt: string;
  size: string;
  count: number;
  sessionId?: string | null;
  toolCallId?: string | null;
  image?: File;
  references?: File[];
  source?: "generate" | "edit";
};

export type ImageGenerationResult = {
  data: GeneratedImagePayload[];
  images: GeneratedImage[];
  endpointName: string;
};

export class ImageRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ImageRequestError";
    this.status = status;
  }
}

export function validSize(size: string): boolean {
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

function resolveEndpoint(input: ImageGenerationInput): { endpoint: ResolvedSettings; defaultModel: string } {
  const endpoints = endpointSettingsList();
  const explicit = input.endpointId?.trim();
  if (explicit) {
    const endpoint = endpoints.find((item) => item.endpointId === explicit);
    if (!endpoint) throw new ImageRequestError("Choose a saved image endpoint in Image Studio.");
    if (!endpoint.baseUrl) throw new ImageRequestError(`Add a base URL for ${endpoint.name} in Settings first.`);
    return { endpoint, defaultModel: endpoint.model };
  }
  let target;
  try {
    target = resolveImageTarget();
  } catch (err) {
    if (err instanceof ImageSettingsError) throw new ImageRequestError(err.message);
    throw err;
  }
  const endpoint = endpoints.find((item) => item.endpointId === target.endpointId);
  if (!endpoint) throw new ImageRequestError("Choose a saved image endpoint in Image Studio.");
  if (!endpoint.baseUrl) throw new ImageRequestError(`Add a base URL for ${endpoint.name} in Settings first.`);
  return { endpoint, defaultModel: target.model };
}

async function downloadImage(url: string, signal?: AbortSignal): Promise<{ bytes: Buffer; mediaType?: string } | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const timeout = AbortSignal.timeout(20_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(url, { cache: "no-store", signal: combined });
    if (!response.ok) return null;
    const declared = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (declared && !declared.startsWith("image/")) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_IMAGE_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
    return { bytes, mediaType: declared };
  } catch {
    return null;
  }
}

/** Call the saved image endpoint, then persist bytes and a record for every returned image. */
export async function generateImages(
  input: ImageGenerationInput,
  signal?: AbortSignal,
): Promise<ImageGenerationResult> {
  const resolved = resolveEndpoint(input);
  const endpoint = resolved.endpoint;
  const model = (input.model?.trim() || resolved.defaultModel || endpoint.model || endpoint.models[0] || "").trim();
  if (!model) throw new ImageRequestError("Choose an image model for this endpoint.");
  if (model.length > 200) throw new ImageRequestError("Model name is too long.");
  const prompt = input.prompt.trim();
  if (!prompt) throw new ImageRequestError("Enter a prompt before generating.");
  if (prompt.length > MAX_PROMPT_LENGTH) throw new ImageRequestError("Prompt is too long (max 32000 characters).");
  if (!validSize(input.size)) {
    throw new ImageRequestError("Choose a supported image size (dimensions must be multiples of 16).");
  }
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > MAX_IMAGES) {
    throw new ImageRequestError(`Batch amount must be between 1 and ${MAX_IMAGES}.`);
  }
  const files = collectInputImages(input);

  const headers = new Headers();
  if (endpoint.apiKey) headers.set("Authorization", `Bearer ${endpoint.apiKey}`);
  let body: BodyInit;
  if (files.length > 0) {
    const form = new FormData();
    form.set("model", model);
    form.set("prompt", prompt);
    form.set("size", input.size);
    form.set("n", String(input.count));
    if (files.length === 1) {
      form.set("image", files[0], files[0].name);
    } else {
      for (const file of files) form.append("image[]", file, file.name);
    }
    body = form;
  } else {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify({ model, prompt, size: input.size, n: input.count });
  }

  const baseUrl = endpoint.baseUrl.replace(/\/+$/, "");
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/images/${files.length > 0 ? "edits" : "generations"}`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal,
    });
  } catch (error) {
    throw new ImageRequestError(
      error instanceof Error ? `Could not reach ${endpoint.name}: ${error.message}` : `Could not reach ${endpoint.name}.`,
      502,
    );
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    let message = `${endpoint.name} request failed (${upstream.status}).`;
    try {
      const payload = JSON.parse(text) as { error?: { message?: unknown } };
      if (typeof payload.error?.message === "string") message = payload.error.message;
    } catch {
      /* use the status message */
    }
    throw new ImageRequestError(message, upstream.status);
  }

  let data: GeneratedImagePayload[];
  try {
    const payload = JSON.parse(text) as { data?: unknown };
    if (!Array.isArray(payload.data)) throw new Error("No data array.");
    data = payload.data.filter(
      (item): item is GeneratedImagePayload => Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
  } catch {
    throw new ImageRequestError(`${endpoint.name} returned an unreadable image response.`, 502);
  }
  if (data.length === 0) throw new ImageRequestError(`${endpoint.name} returned no images.`, 502);

  const images: GeneratedImage[] = [];
  for (const item of data) {
    let bytes: Buffer | null = null;
    let mediaType = "image/png";
    let sourceUrl: string | null = null;
    if (typeof item.b64_json === "string" && item.b64_json.trim()) {
      try {
        const encoded = item.b64_json.includes(",") ? item.b64_json.split(",").pop()! : item.b64_json;
        bytes = Buffer.from(encoded, "base64");
        if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) bytes = null;
        else mediaType = detectImageMediaType(bytes);
      } catch {
        bytes = null;
      }
    } else if (typeof item.url === "string") {
      sourceUrl = item.url;
      const downloaded = await downloadImage(item.url, signal);
      if (downloaded) {
        bytes = downloaded.bytes;
        mediaType = downloaded.mediaType?.startsWith("image/")
          ? detectImageMediaType(bytes, downloaded.mediaType)
          : detectImageMediaType(bytes);
      }
    }
    images.push(
      insertGeneratedImage({
        bytes,
        mediaType,
        prompt,
        revisedPrompt: typeof item.revised_prompt === "string" ? item.revised_prompt : null,
        model,
        endpointId: endpoint.endpointId,
        size: input.size,
        sessionId: input.sessionId ?? null,
        toolCallId: input.toolCallId ?? null,
        source: input.source ?? (files.length > 0 ? "edit" : "generate"),
        sourceUrl,
      }),
    );
  }

  return { data, images, endpointName: endpoint.name };
}

function assertImageFile(file: File, role: "edit" | "reference") {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageRequestError(
      role === "edit" ? "Use a PNG, JPEG, or WebP image to edit." : "Use a PNG, JPEG, or WebP image as a reference.",
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageRequestError(
      role === "edit" ? "The edit image must be 20 MB or smaller." : "Each reference image must be 20 MB or smaller.",
    );
  }
}

/** Edit image first, then references. Any of these pictures routes the request to the edits endpoint. */
function collectInputImages(input: ImageGenerationInput): File[] {
  const references = input.references ?? [];
  if (input.image) assertImageFile(input.image, "edit");
  for (const file of references) assertImageFile(file, "reference");
  const files = [...(input.image ? [input.image] : []), ...references];
  if (files.length > MAX_INPUT_IMAGES) {
    throw new ImageRequestError(`Use at most ${MAX_INPUT_IMAGES} pictures in one request.`);
  }
  return files;
}

export function messageOfImageError(error: unknown): string {
  return error instanceof Error ? error.message : "Image generation failed.";
}
