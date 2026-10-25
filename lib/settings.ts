import { existsSync, readFileSync } from "node:fs";

import { writeAtomic } from "@/lib/atomic";
import { settingsPath } from "@/lib/paths";
import type { PublicSettings } from "@/lib/types";

export type ResolvedSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type SettingsFile = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  models?: string[];
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

function envBaseUrl(): string {
  const raw = process.env.LM_STUDIO_BASE_URL ?? "";
  if (!raw.trim()) return "";
  return normalizeBaseUrl(raw);
}

export function getSettings(): ResolvedSettings {
  const file = readFile();
  const baseUrl =
    file && "baseUrl" in file ? normalizeBaseUrl(file.baseUrl ?? "") : envBaseUrl();
  const apiKey =
    file && "apiKey" in file
      ? (file.apiKey ?? "").trim()
      : (process.env.LM_STUDIO_API_KEY ?? "").trim();
  const model =
    file && "model" in file
      ? (file.model ?? "").trim()
      : (process.env.MODEL ?? "").trim();
  return { baseUrl, apiKey, model };
}

export function modelCatalog(): string[] {
  const file = readFile();
  const models = file?.models;
  if (!Array.isArray(models)) return [];
  return [...new Set(models.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function rememberModels(models: string[]) {
  const currentFile = readFile() ?? {};
  const next = { ...currentFile, models: [...new Set(models.map((item) => item.trim()).filter(Boolean))] };
  writeAtomic(settingsPath(), `${JSON.stringify(next, null, 2)}\n`);
}

export function toPublicSettings(settings: ResolvedSettings): PublicSettings {
  const hint =
    settings.apiKey.length === 0
      ? null
      : settings.apiKey.length <= 4
        ? "••••"
        : `••••${settings.apiKey.slice(-4)}`;
  return {
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKeySet: settings.apiKey.length > 0,
    apiKeyHint: hint,
    models: modelCatalog(),
  };
}

export function saveSettings(input: {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}): ResolvedSettings {
  const currentFile = readFile() ?? {};
  const current = getSettings();
  const next: SettingsFile = {
    baseUrl:
      input.baseUrl !== undefined
        ? normalizeBaseUrl(input.baseUrl)
        : "baseUrl" in currentFile
          ? (currentFile.baseUrl ?? "")
          : current.baseUrl,
    apiKey:
      input.apiKey !== undefined
        ? input.apiKey.trim()
        : "apiKey" in currentFile
          ? (currentFile.apiKey ?? "")
          : current.apiKey,
    model:
      input.model !== undefined
        ? input.model.trim()
        : "model" in currentFile
          ? (currentFile.model ?? "")
          : current.model,
    models: currentFile.models,
  };
  writeAtomic(settingsPath(), `${JSON.stringify(next, null, 2)}\n`);
  return getSettings();
}
