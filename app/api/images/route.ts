import { connection } from "next/server";

import { jsonError } from "@/lib/http";
import { generateImages, ImageRequestError, type GeneratedImagePayload } from "@/lib/image-generator";
import { listGeneratedImages } from "@/lib/image-store";

type ImageRequest = {
  endpointId: string;
  model: string;
  prompt: string;
  size: string;
  count: number;
  image?: File;
};

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

/** Saved image records: the backend counterpart of the chat message log. */
export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const rawLimit = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
  return Response.json({ images: listGeneratedImages({ sessionId, limit }) });
}

export async function POST(request: Request) {
  const input = await parseRequest(request);
  if (input instanceof Response) return input;
  try {
    const result = await generateImages(
      {
        endpointId: input.endpointId,
        model: input.model,
        prompt: input.prompt,
        size: input.size,
        count: input.count,
        image: input.image,
      },
      request.signal,
    );
    const data: GeneratedImagePayload[] = result.data;
    return Response.json({ data });
  } catch (error) {
    if (error instanceof ImageRequestError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Image generation failed.", 502);
  }
}
