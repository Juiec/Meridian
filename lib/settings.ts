import { existsSync, readFileSync } from "node:fs";

import { writeAtomic } from "@/lib/atomic";
import { settingsPath } from "@/lib/paths";
import type { PublicSettings } from "@/lib/types";

export type ResolvedSettings = {
  endpointId: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  models: string[];
};

export type EndpointInput = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  clearApiKey?: boolean;
};

type StoredEndpoint = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  models?: string[];
};

type SettingsFile = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  models?: string[];
  endpoints?: StoredEndpoint[];
  activeEndpointId?: string;
};

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Base URL must be an absolute http(s) URL, including the port.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Base URL must start with http:// or https://.");
  }
  if (url.username || url.password) {
    throw new Error("Put the API key in the key field, not inside the base URL.");
  }
  let pathname = url.pathname.replace(/\/+$/, "");
  if (pathname === "") pathname = "/v1";
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function readFile(): SettingsFile | null {
  const file = settingsPath();
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as SettingsFile;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function legacyEndpoint(file: SettingsFile | null): StoredEndpoint {
  const baseUrl = file && "baseUrl" in file
    ? normalizeBaseUrl(file.baseUrl ?? "")
    : normalizeBaseUrl(process.env.LM_STUDIO_BASE_URL ?? "");
  const apiKey = file && "apiKey" in file
    ? (file.apiKey ?? "").trim()
    : (process.env.LM_STUDIO_API_KEY ?? "").trim();
  const model = file && "model" in file
    ? (file.model ?? "").trim()
    : (process.env.MODEL ?? "").trim();
  return {
    id: "default",
    name: "Default endpoint",
    baseUrl,
    apiKey,
    model,
    models: file?.models ?? [],
  };
}

function endpointProfiles(file = readFile()): StoredEndpoint[] {
  if (Array.isArray(file?.endpoints) && file.endpoints.length > 0) {
    return file.endpoints.map((endpoint) => ({
      id: endpoint.id,
      name: endpoint.name,
      baseUrl: normalizeBaseUrl(endpoint.baseUrl ?? ""),
      apiKey: (endpoint.apiKey ?? "").trim(),
      model: (endpoint.model ?? "").trim(),
      models: Array.isArray(endpoint.models) ? endpoint.models : [],
    }));
  }
  return [legacyEndpoint(file)];
}

function activeId(file: SettingsFile | null, endpoints: StoredEndpoint[]): string {
  return endpoints.some((endpoint) => endpoint.id === file?.activeEndpointId)
    ? file!.activeEndpointId!
    : endpoints[0].id;
}

export function endpointSettingsList(): ResolvedSettings[] {
  return endpointProfiles().map((endpoint) => ({
    endpointId: endpoint.id,
    name: endpoint.name,
    baseUrl: endpoint.baseUrl,
    apiKey: endpoint.apiKey,
    model: endpoint.model,
    models: [...new Set((endpoint.models ?? []).filter(Boolean))],
  }));
}

export function getSettings(endpointId?: string): ResolvedSettings {
  const file = readFile();
  const endpoints = endpointProfiles(file);
  const selected = endpointId
    ? endpoints.find((endpoint) => endpoint.id === endpointId)
    : endpoints.find((endpoint) => endpoint.id === activeId(file, endpoints));
  const endpoint = selected ?? endpoints.find((item) => item.id === activeId(file, endpoints)) ?? endpoints[0];
  return {
    endpointId: endpoint.id,
    name: endpoint.name,
    baseUrl: endpoint.baseUrl,
    apiKey: endpoint.apiKey,
    model: endpoint.model,
    models: [...new Set((endpoint.models ?? []).filter(Boolean))],
  };
}

export function modelCatalog(endpointId?: string): string[] {
  return getSettings(endpointId).models;
}

export function rememberModels(models: string[], endpointId?: string) {
  const file = readFile() ?? {};
  const endpoints = endpointProfiles(file);
  const selectedId = endpointId ?? activeId(file, endpoints);
  if (Array.isArray(file.endpoints) && file.endpoints.length > 0) {
    const next = {
      ...file,
      endpoints: endpoints.map((endpoint) =>
        endpoint.id === selectedId
          ? { ...endpoint, models: [...new Set(models.map((item) => item.trim()).filter(Boolean))] }
          : endpoint,
      ),
    };
    writeAtomic(settingsPath(), `${JSON.stringify(next, null, 2)}\n`);
    return;
  }
  writeAtomic(
    settingsPath(),
    `${JSON.stringify({ ...file, models: [...new Set(models.map((item) => item.trim()).filter(Boolean))] }, null, 2)}\n`,
  );
}

function keyHint(key: string): string | null {
  if (!key) return null;
  return key.length <= 4 ? "••••" : `••••${key.slice(-4)}`;
}

export function toPublicSettings(settings: ResolvedSettings): PublicSettings {
  const endpoints = endpointSettingsList().map((endpoint) => ({
    id: endpoint.endpointId,
    name: endpoint.name,
    baseUrl: endpoint.baseUrl,
    model: endpoint.model,
    apiKeySet: endpoint.apiKey.length > 0,
    apiKeyHint: keyHint(endpoint.apiKey),
    models: endpoint.models,
  }));
  return {
    endpointId: settings.endpointId,
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKeySet: settings.apiKey.length > 0,
    apiKeyHint: keyHint(settings.apiKey),
    models: settings.models,
    endpoints,
  };
}

export function saveEndpointProfiles(input: EndpointInput[], selectedEndpointId: string): ResolvedSettings {
  if (input.length < 1 || input.length > 16) throw new Error("Save between 1 and 16 endpoints.");
  const file = readFile();
  const existing = endpointProfiles(file);
  const existingById = new Map(existing.map((endpoint) => [endpoint.id, endpoint]));
  const ids = new Set<string>();
  const endpoints = input.map((item) => {
    const id = item.id.trim();
    const name = item.name.trim();
    if (!/^[\w-]{1,80}$/.test(id)) throw new Error("Endpoint ids may contain letters, numbers, underscores, and hyphens.");
    if (ids.has(id)) throw new Error("Endpoint ids must be unique.");
    ids.add(id);
    if (!name) throw new Error("Every endpoint needs a name.");
    const previous = existingById.get(id);
    return {
      id,
      name: name.slice(0, 80),
      baseUrl: normalizeBaseUrl(item.baseUrl),
      model: item.model.trim().slice(0, 200),
      apiKey: item.clearApiKey ? "" : item.apiKey?.trim() || previous?.apiKey || "",
      models: previous?.models ?? [],
    };
  });
  if (!ids.has(selectedEndpointId)) throw new Error("Choose one of the saved endpoints as the default.");
  writeAtomic(
    settingsPath(),
    `${JSON.stringify({ endpoints, activeEndpointId: selectedEndpointId }, null, 2)}\n`,
  );
  return getSettings(selectedEndpointId);
}

export function saveSettings(input: {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}): ResolvedSettings {
  const file = readFile() ?? {};
  const current = getSettings();
  if (Array.isArray(file.endpoints) && file.endpoints.length > 0) {
    const endpoints = endpointProfiles(file).map((endpoint) => {
      if (endpoint.id !== current.endpointId) return endpoint;
      return {
        ...endpoint,
        baseUrl: input.baseUrl === undefined ? endpoint.baseUrl : normalizeBaseUrl(input.baseUrl),
        apiKey: input.apiKey === undefined ? endpoint.apiKey : input.apiKey.trim(),
        model: input.model === undefined ? endpoint.model : input.model.trim(),
      };
    });
    writeAtomic(
      settingsPath(),
      `${JSON.stringify({ endpoints, activeEndpointId: current.endpointId }, null, 2)}\n`,
    );
    return getSettings(current.endpointId);
  }
  const endpoint = legacyEndpoint(file);
  const next = {
    baseUrl: input.baseUrl === undefined ? endpoint.baseUrl : normalizeBaseUrl(input.baseUrl),
    apiKey: input.apiKey === undefined ? endpoint.apiKey : input.apiKey.trim(),
    model: input.model === undefined ? endpoint.model : input.model.trim(),
    models: endpoint.models,
  };
  writeAtomic(settingsPath(), `${JSON.stringify(next, null, 2)}\n`);
  return getSettings();
}
