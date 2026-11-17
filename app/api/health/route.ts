import { connection } from "next/server";

import { messageOf } from "@/lib/errors";
import { listModels } from "@/lib/lmstudio";
import { getSettings, modelCatalog, rememberModels } from "@/lib/settings";
import type { HealthResult } from "@/lib/types";

export async function GET(request: Request) {
  await connection();
  const endpointId = new URL(request.url).searchParams.get("endpoint") ?? undefined;
  const settings = getSettings(endpointId);
  const cached = modelCatalog(settings.endpointId);
  if (!settings.baseUrl) {
    const empty: HealthResult = {
      ok: false,
      endpointId: settings.endpointId,
      baseUrl: "",
      model: settings.model,
      latencyMs: null,
      models: cached,
      error: "No LM Studio base URL configured.",
    };
    return Response.json(empty);
  }
  const started = Date.now();
  try {
    const models = await listModels({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey || undefined,
      signal: AbortSignal.timeout(8000),
    });
    rememberModels(models, settings.endpointId);
    const result: HealthResult = {
      ok: true,
      endpointId: settings.endpointId,
      baseUrl: settings.baseUrl,
      model: settings.model,
      latencyMs: Date.now() - started,
      models,
    };
    return Response.json(result);
  } catch (err) {
    const result: HealthResult = {
      ok: false,
      endpointId: settings.endpointId,
      baseUrl: settings.baseUrl,
      model: settings.model,
      latencyMs: Date.now() - started,
      models: cached,
      stale: cached.length > 0,
      error: messageOf(err),
    };
    return Response.json(result);
  }
}
