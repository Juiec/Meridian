import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { existsSync, readFileSync } from "node:fs";

import { writeAtomic } from "@/lib/atomic";
import { messageOf } from "@/lib/errors";
import { customToolsPath } from "@/lib/paths";
import { cleanStringMap } from "@/lib/mcp-config";
import { parseToolArguments } from "@/lib/tools";
import type { HttpMethod } from "@/lib/tool-types";
import { assertToolUrl, isMetadataAddress } from "@/lib/tool-url";
import { sanitizeToolToken } from "@/lib/tool-registry";

const METHODS = new Set<HttpMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const MAX_TOOLS = 40;
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 100_000;
const MAX_TEXT = 12_000;

export type CustomToolRecord = {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
};

export type CustomToolDraft = {
  name?: unknown;
  description?: unknown;
  parameters?: unknown;
  enabled?: unknown;
  method?: unknown;
  url?: unknown;
  headers?: unknown;
};

function readAll(): CustomToolRecord[] {
  const file = customToolsPath();
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { tools?: unknown }).tools)) {
    throw new Error("Custom tool config is not valid. Fix data/custom-tools.json.");
  }
  return (parsed as { tools: CustomToolRecord[] }).tools;
}

function writeAll(tools: CustomToolRecord[]) {
  writeAtomic(customToolsPath(), `${JSON.stringify({ tools }, null, 2)}\n`);
}

export function assertParameterSchema(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Parameters must be a JSON Schema object.");
  }
  const schema = value as Record<string, unknown>;
  if (schema.type !== undefined && schema.type !== "object") {
    throw new Error('Parameters schema type must be "object".');
  }
  if (
    schema.properties !== undefined &&
    (typeof schema.properties !== "object" || schema.properties === null || Array.isArray(schema.properties))
  ) {
    throw new Error("Parameters properties must be an object.");
  }
  if (schema.required !== undefined) {
    if (!Array.isArray(schema.required) || schema.required.some((item) => typeof item !== "string")) {
      throw new Error("Parameters required must be an array of strings.");
    }
  }
  const encoded = JSON.stringify(schema);
  if (encoded.length > 20_000) throw new Error("Parameters schema is too large.");
  return schema.type === undefined ? { type: "object", ...schema } : schema;
}

function cleanName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Tool name is required.");
  const name = value.trim();
  if (!name || name.length > 64 || /[\r\n\0]/.test(name)) throw new Error("Tool name must be 1–64 characters.");
  if (!/[a-z0-9]/i.test(name)) throw new Error("Tool name needs a letter or number.");
  return name;
}

function cleanDescription(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Description is required.");
  const description = value.trim();
  if (description.length > 1024) throw new Error("Description must be 1024 characters or fewer.");
  return description;
}

function cleanMethod(value: unknown): HttpMethod {
  if (typeof value === "string" && METHODS.has(value.toUpperCase() as HttpMethod)) {
    return value.toUpperCase() as HttpMethod;
  }
  throw new Error("Method must be GET, POST, PUT, PATCH, or DELETE.");
}

function apply(current: CustomToolRecord | null, patch: CustomToolDraft, id: string): CustomToolRecord {
  const name = patch.name !== undefined ? cleanName(patch.name) : (current?.name ?? cleanName(undefined));
  const taken = readAll().some((tool) => tool.id !== id && sanitizeToolToken(tool.name) === sanitizeToolToken(name));
  if (taken) throw new Error("A custom tool with that name already exists.");
  return {
    id,
    name,
    description: patch.description !== undefined ? cleanDescription(patch.description) : (current?.description ?? cleanDescription(undefined)),
    parameters: patch.parameters !== undefined ? assertParameterSchema(patch.parameters) : (current?.parameters ?? assertParameterSchema(undefined)),
    enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : (current?.enabled ?? true),
    method: patch.method !== undefined ? cleanMethod(patch.method) : (current?.method ?? "POST"),
    url: patch.url !== undefined ? assertToolUrl(String(patch.url)).toString() : (current?.url ?? assertToolUrl("").toString()),
    headers: patch.headers !== undefined ? cleanStringMap(patch.headers, "headers") : (current?.headers ?? {}),
  };
}

export function listCustomTools(): CustomToolRecord[] {
  return readAll();
}

export function getCustomTool(id: string): CustomToolRecord | null {
  return readAll().find((tool) => tool.id === id) ?? null;
}

export function createCustomTool(patch: CustomToolDraft): CustomToolRecord {
  const tools = readAll();
  if (tools.length >= MAX_TOOLS) throw new Error("Too many custom tools (40).");
  const record = apply(null, { enabled: true, method: "POST", ...patch }, randomUUID());
  tools.push(record);
  writeAll(tools);
  return record;
}

export function updateCustomTool(id: string, patch: CustomToolDraft): CustomToolRecord {
  const tools = readAll();
  const index = tools.findIndex((tool) => tool.id === id);
  if (index < 0) throw new Error("Custom tool not found.");
  const record = apply(tools[index], patch, id);
  tools[index] = record;
  writeAll(tools);
  return record;
}

export function deleteCustomTool(id: string) {
  const tools = readAll();
  const next = tools.filter((tool) => tool.id !== id);
  if (next.length === tools.length) throw new Error("Custom tool not found.");
  writeAll(next);
}

async function assertResolved(url: URL) {
  assertToolUrl(url.toString());
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isMetadataAddress(host)) throw new Error("That host is blocked.");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return;
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`Could not resolve ${host}.`);
  }
  if (records.some((record) => isMetadataAddress(record.address))) {
    throw new Error("That host resolves to a blocked metadata address.");
  }
}

async function readCap(response: Response): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return { text: text.slice(0, MAX_BYTES), truncated: text.length > MAX_BYTES };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > MAX_BYTES) {
      chunks.push(value.slice(0, MAX_BYTES - total));
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  return { text: Buffer.concat(chunks).toString("utf8"), truncated };
}

function withQuery(url: URL, args: Record<string, unknown>): URL {
  const next = new URL(url.toString());
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    next.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  return next;
}

export async function executeCustomTool(id: string, rawArgs: string): Promise<Record<string, unknown>> {
  const tool = getCustomTool(id);
  if (!tool) return { ok: false, error: "Custom tool is not registered." };
  if (!tool.enabled) return { ok: false, error: "Custom tool is disabled." };
  const parsed = parseToolArguments(rawArgs);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const encoded = JSON.stringify(parsed.value);
  if (encoded.length > MAX_BYTES) return { ok: false, error: "Tool arguments are too large." };

  try {
    let current = new URL(tool.url);
    let method = tool.method;
    let body: string | undefined = method === "GET" || method === "DELETE" ? undefined : encoded;
    if (method === "GET" || method === "DELETE") current = withQuery(current, parsed.value);
    const started = current.hostname;

    for (let hop = 0; hop < 3; hop += 1) {
      await assertResolved(current);
      const headers = new Headers();
      if (current.hostname === started) {
        for (const [key, value] of Object.entries(tool.headers)) headers.set(key, value);
      }
      if (body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
      const response = await fetch(current, {
        method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { ok: false, error: `Redirect ${response.status} had no location.` };
        current = new URL(location, current);
        if (response.status !== 307 && response.status !== 308) {
          method = "GET";
          body = undefined;
        }
        continue;
      }
      const payload = await readCap(response);
      let text = payload.text;
      if (payload.truncated || text.length > MAX_TEXT) {
        text = `${text.slice(0, MAX_TEXT)}\n[truncated]`;
      }
      if (!response.ok) {
        return { ok: false, status: response.status, error: `HTTP ${response.status}`, text };
      }
      return { ok: true, status: response.status, text };
    }
    return { ok: false, error: "Too many redirects." };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}
