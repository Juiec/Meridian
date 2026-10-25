import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { getSettings, saveSettings, toPublicSettings } from "@/lib/settings";

export async function GET() {
  await connection();
  return Response.json({ settings: toPublicSettings(getSettings()) });
}

export async function PUT(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : undefined;
    const model = typeof body.model === "string" ? body.model : undefined;
    const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
    if (baseUrl === undefined && model === undefined && apiKey === undefined) {
      return jsonError("Nothing to save.");
    }
    const settings = saveSettings({ baseUrl, model, apiKey });
    return Response.json({ settings: toPublicSettings(settings) });
  } catch (err) {
    return caught(err, 400);
  }
}
