import { connection } from "next/server";

import { messageOf } from "@/lib/errors";
import { listModels } from "@/lib/lmstudio";
import { getSettings, modelCatalog, rememberModels } from "@/lib/settings";
import type { HealthResult } from "@/lib/types";

export async function GET() {
  await connection();
  const settings = getSettings();
  const cached = modelCatalog();
  if (!settings.baseUrl) {
    const empty: HealthResult = {
      ok: false,
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
    rememberModels(models);
    const result: HealthResult = {
      ok: true,
      baseUrl: settings.baseUrl,
      model: settings.model,
      latencyMs: Date.now() - started,
      models,
    };
    return Response.json(result);
  } catch (err) {
    const result: HealthResult = {
      ok: false,
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
