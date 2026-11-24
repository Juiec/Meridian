import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { ImageSettingsError, resolveImageTarget, saveImageSettings } from "@/lib/image-settings";

export async function GET() {
  await connection();
  try {
    const target = resolveImageTarget();
    return Response.json(target);
  } catch (err) {
    if (err instanceof ImageSettingsError) {
      return Response.json({ endpointId: "", endpointName: "", model: "", apiKeySet: false, error: err.message });
    }
    return caught(err);
  }
}

export async function PATCH(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (typeof body.endpointId !== "string" || typeof body.model !== "string") {
    return jsonError("Endpoint and model are required.");
  }
  try {
    return Response.json(saveImageSettings({ endpointId: body.endpointId, model: body.model }));
  } catch (err) {
    if (err instanceof ImageSettingsError) return jsonError(err.message);
    return caught(err);
  }
}
