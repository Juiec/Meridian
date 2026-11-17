import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { getSettings, saveEndpointProfiles, saveSettings, toPublicSettings } from "@/lib/settings";

export async function GET() {
  await connection();
  return Response.json({ settings: toPublicSettings(getSettings()) });
}

export async function PUT(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    if (Array.isArray(body.endpoints)) {
      const endpoints = body.endpoints.map((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error("Every endpoint must be an object.");
        }
        const endpoint = value as Record<string, unknown>;
        if (
          typeof endpoint.id !== "string" ||
          typeof endpoint.name !== "string" ||
          typeof endpoint.baseUrl !== "string" ||
          typeof endpoint.model !== "string"
        ) {
          throw new Error("Each endpoint needs an id, name, base URL, and default model.");
        }
        return {
          id: endpoint.id,
          name: endpoint.name,
          baseUrl: endpoint.baseUrl,
          model: endpoint.model,
          apiKey: typeof endpoint.apiKey === "string" ? endpoint.apiKey : undefined,
          clearApiKey: endpoint.clearApiKey === true,
        };
      });
      const activeEndpointId =
        typeof body.activeEndpointId === "string" ? body.activeEndpointId : "";
      const settings = saveEndpointProfiles(endpoints, activeEndpointId);
      return Response.json({ settings: toPublicSettings(settings) });
    }

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
