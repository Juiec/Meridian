import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

import { writeAtomic } from "@/lib/atomic";
import { endpointSecretsPath, endpointsPath, settingsPath } from "@/lib/paths";
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

type Profile = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  models: string[];
};

type LegacyEndpoint = Profile & { apiKey?: string };

type LegacyFile = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  models?: string[];
  endpoints?: LegacyEndpoint[];
  activeEndpointId?: string;
};

type EndpointsFile = {
  activeEndpointId?: string;
  endpoints?: LegacyEndpoint[];
};

type SecretMap = Record<string, string>;

type Loaded = {
  profiles: Profile[];
  secrets: SecretMap;
  activeEndpointId: string;
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

function readJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as T;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function modelList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function profileFrom(raw: LegacyEndpoint, fallbackId = "default"): Profile {
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : fallbackId;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Default endpoint";
  return {
    id,
    name,
    baseUrl: normalizeBaseUrl(raw.baseUrl ?? ""),
    model: (raw.model ?? "").trim(),
    models: modelList(raw.models),
  };
}

function writeProfiles(profiles: Profile[], activeEndpointId: string) {
  const endpoints = profiles.map(({ id, name, baseUrl, model, models }) => ({ id, name, baseUrl, model, models }));
  writeAtomic(endpointsPath(), `${JSON.stringify({ activeEndpointId, endpoints }, null, 2)}\n`);
}

function writeSecrets(secrets: SecretMap) {
  const file = endpointSecretsPath();
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const kept: SecretMap = {};
  for (const [id, key] of Object.entries(secrets)) {
    const trimmed = key.trim();
    if (trimmed) kept[id] = trimmed;
  }
  writeAtomic(file, `${JSON.stringify(kept, null, 2)}\n`, 0o600);
  chmodSync(dir, 0o700);
}

function readSecrets(): SecretMap {
  const parsed = readJson<SecretMap>(endpointSecretsPath());
  if (!parsed) return {};
  const secrets: SecretMap = {};
  for (const [id, key] of Object.entries(parsed)) {
    if (typeof key === "string" && key.trim()) secrets[id] = key.trim();
  }
  return secrets;
}

function splitLegacy(file: LegacyFile): { profiles: Profile[]; secrets: SecretMap; activeEndpointId: string } {
  if (Array.isArray(file.endpoints) && file.endpoints.length > 0) {
    const secrets: SecretMap = {};
    const profiles = file.endpoints.map((endpoint) => {
      const profile = profileFrom(endpoint);
      const key = typeof endpoint.apiKey === "string" ? endpoint.apiKey.trim() : "";
      if (key) secrets[profile.id] = key;
      return profile;
    });
    const activeEndpointId = profiles.some((endpoint) => endpoint.id === file.activeEndpointId)
      ? file.activeEndpointId!
      : profiles[0].id;
    return { profiles, secrets, activeEndpointId };
  }
  const baseUrl = "baseUrl" in file
    ? normalizeBaseUrl(file.baseUrl ?? "")
    : normalizeBaseUrl(process.env.LM_STUDIO_BASE_URL ?? "");
  const apiKey = "apiKey" in file ? (file.apiKey ?? "").trim() : (process.env.LM_STUDIO_API_KEY ?? "").trim();
  const model = "model" in file ? (file.model ?? "").trim() : (process.env.MODEL ?? "").trim();
  return {
    profiles: [{ id: "default", name: "Default endpoint", baseUrl, model, models: modelList(file.models) }],
    secrets: apiKey ? { default: apiKey } : {},
    activeEndpointId: "default",
  };
}

function envBootstrap(): Loaded {
  const apiKey = (process.env.LM_STUDIO_API_KEY ?? "").trim();
  return {
    profiles: [
      {
        id: "default",
        name: "Default endpoint",
        baseUrl: normalizeBaseUrl(process.env.LM_STUDIO_BASE_URL ?? ""),
        model: (process.env.MODEL ?? "").trim(),
        models: [],
      },
    ],
    secrets: apiKey ? { default: apiKey } : {},
    activeEndpointId: "default",
  };
}

/** Move data/settings.json into the profile file and the secrets file, then delete it. */
function migrateLegacy() {
  const legacyPath = settingsPath();
  if (!existsSync(legacyPath)) return;
  const legacy = readJson<LegacyFile>(legacyPath);
  if (!legacy) return;
  try {
    const split = splitLegacy(legacy);
    if (!existsSync(endpointsPath())) writeProfiles(split.profiles, split.activeEndpointId);
    if (!existsSync(endpointSecretsPath())) writeSecrets(split.secrets);
  } catch {
    return;
  }
  if (existsSync(endpointsPath()) && existsSync(endpointSecretsPath())) {
    unlinkSync(legacyPath);
  }
}

function load(): Loaded {
  migrateLegacy();
  const file = readJson<EndpointsFile>(endpointsPath());
  if (file && Array.isArray(file.endpoints) && file.endpoints.length > 0) {
    const profiles = file.endpoints.map((endpoint) => profileFrom(endpoint));
    const activeEndpointId = profiles.some((endpoint) => endpoint.id === file.activeEndpointId)
      ? file.activeEndpointId!
      : profiles[0].id;
    return { profiles, secrets: readSecrets(), activeEndpointId };
  }
  return envBootstrap();
}

function resolved(loaded: Loaded): ResolvedSettings[] {
  return loaded.profiles.map((profile) => ({
    endpointId: profile.id,
    name: profile.name,
    baseUrl: profile.baseUrl,
    apiKey: loaded.secrets[profile.id] ?? "",
    model: profile.model,
    models: [...new Set(profile.models.filter(Boolean))],
  }));
}

function persist(loaded: Loaded) {
  writeProfiles(loaded.profiles, loaded.activeEndpointId);
  writeSecrets(loaded.secrets);
  if (existsSync(settingsPath())) unlinkSync(settingsPath());
}

export function endpointSettingsList(): ResolvedSettings[] {
  return resolved(load());
}

export function getSettings(endpointId?: string): ResolvedSettings {
  const loaded = load();
  const endpoints = resolved(loaded);
  const selected = endpointId
    ? endpoints.find((endpoint) => endpoint.endpointId === endpointId)
    : endpoints.find((endpoint) => endpoint.endpointId === loaded.activeEndpointId);
  const endpoint =
    selected ??
    endpoints.find((item) => item.endpointId === loaded.activeEndpointId) ??
    endpoints[0];
  return endpoint;
}

export function modelCatalog(endpointId?: string): string[] {
  return getSettings(endpointId).models;
}

export function rememberModels(models: string[], endpointId?: string) {
  const loaded = load();
  const selectedId = endpointId ?? loaded.activeEndpointId;
  const nextModels = [...new Set(models.map((item) => item.trim()).filter(Boolean))];
  persist({
    ...loaded,
    profiles: loaded.profiles.map((profile) =>
      profile.id === selectedId ? { ...profile, models: nextModels } : profile,
    ),
  });
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
  const loaded = load();
  const existingById = new Map(loaded.profiles.map((profile) => [profile.id, profile]));
  const ids = new Set<string>();
  const profiles: Profile[] = [];
  const secrets: SecretMap = {};
  for (const item of input) {
    const id = item.id.trim();
    const name = item.name.trim();
    if (!/^[\w-]{1,80}$/.test(id)) throw new Error("Endpoint ids may contain letters, numbers, underscores, and hyphens.");
    if (ids.has(id)) throw new Error("Endpoint ids must be unique.");
    ids.add(id);
    if (!name) throw new Error("Every endpoint needs a name.");
    const previous = existingById.get(id);
    const apiKey = item.clearApiKey ? "" : item.apiKey?.trim() || loaded.secrets[id] || "";
    profiles.push({
      id,
      name: name.slice(0, 80),
      baseUrl: normalizeBaseUrl(item.baseUrl),
      model: item.model.trim().slice(0, 200),
      models: previous?.models ?? [],
    });
    if (apiKey) secrets[id] = apiKey;
  }
  if (!ids.has(selectedEndpointId)) throw new Error("Choose one of the saved endpoints as the default.");
  persist({ profiles, secrets, activeEndpointId: selectedEndpointId });
  return getSettings(selectedEndpointId);
}

export function saveSettings(input: {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}): ResolvedSettings {
  const loaded = load();
  const currentId = loaded.activeEndpointId;
  const secrets = { ...loaded.secrets };
  if (input.apiKey !== undefined) {
    const key = input.apiKey.trim();
    if (key) secrets[currentId] = key;
    else delete secrets[currentId];
  }
  persist({
    activeEndpointId: currentId,
    secrets,
    profiles: loaded.profiles.map((profile) => {
      if (profile.id !== currentId) return profile;
      return {
        ...profile,
        baseUrl: input.baseUrl === undefined ? profile.baseUrl : normalizeBaseUrl(input.baseUrl),
        model: input.model === undefined ? profile.model : input.model.trim(),
      };
    }),
  });
  return getSettings(currentId);
}
