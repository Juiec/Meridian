import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { writeAtomic } from "@/lib/atomic";
import { mcpConfigPath } from "@/lib/paths";
import type { McpTransport } from "@/lib/tool-types";
import { assertToolUrl } from "@/lib/tool-url";

const MAX_SERVERS = 24;

export type McpServerRecord = {
  id: string;
  name: string;
  enabled: boolean;
  transport: McpTransport;
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
  headers: Record<string, string>;
};

export type McpServerDraft = {
  name?: unknown;
  enabled?: unknown;
  transport?: unknown;
  command?: unknown;
  args?: unknown;
  env?: unknown;
  url?: unknown;
  headers?: unknown;
};

function readAll(): McpServerRecord[] {
  const file = mcpConfigPath();
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { servers?: unknown }).servers)) {
    throw new Error("MCP config is not valid. Fix data/mcp-servers.json.");
  }
  return (parsed as { servers: McpServerRecord[] }).servers.map(normalizeStored);
}

function writeAll(servers: McpServerRecord[]) {
  writeAtomic(mcpConfigPath(), `${JSON.stringify({ servers }, null, 2)}\n`);
}

function normalizeStored(value: McpServerRecord): McpServerRecord {
  return {
    id: String(value.id),
    name: String(value.name ?? "server"),
    enabled: Boolean(value.enabled),
    transport: value.transport === "http" || value.transport === "sse" ? value.transport : "stdio",
    command: typeof value.command === "string" ? value.command : "",
    args: Array.isArray(value.args) ? value.args.filter((item): item is string => typeof item === "string") : [],
    env: stringMap(value.env),
    url: typeof value.url === "string" ? value.url : "",
    headers: stringMap(value.headers),
  };
}

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") out[key] = item;
  }
  return out;
}

function cleanName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Server name is required.");
  const name = value.trim();
  if (!name || name.length > 80 || /[\r\n\0]/.test(name)) throw new Error("Server name must be 1–80 characters.");
  return name;
}

function cleanTransport(value: unknown): McpTransport {
  if (value === "stdio" || value === "http" || value === "sse") return value;
  throw new Error("Transport must be stdio, http, or sse.");
}

function cleanCommand(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error("Command must be a string.");
  const command = value.trim();
  if (!command) return "";
  if (command.length > 500 || /[\r\n\0]/.test(command)) throw new Error("Command is not valid.");
  return command;
}

function cleanArgs(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : null;
  if (!list) throw new Error("Arguments must be a list of strings.");
  const args: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") throw new Error("Each argument must be a string.");
    if (item.includes("\0")) throw new Error("An argument is not valid.");
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > 500) throw new Error("An argument is too long.");
    args.push(trimmed);
  }
  if (args.length > 40) throw new Error("Too many arguments.");
  return args;
}

const BLOCKED_HEADERS = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "te",
  "trailer",
]);

export function cleanStringMap(
  value: unknown,
  kind: "env" | "headers",
): Record<string, string> {
  if (value === undefined) throw new Error(`${kind} is missing.`);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${kind} must be an object.`);
  }
  const out: Record<string, string> = {};
  const entries = Object.entries(value);
  if (entries.length > 40) throw new Error(`Too many ${kind} entries.`);
  for (const [key, item] of entries) {
    if (typeof item !== "string") throw new Error(`${kind} values must be strings.`);
    if (item.length > 4_000) throw new Error(`A ${kind} value is too long.`);
    if (kind === "env") {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid environment name ${key}.`);
    } else {
      if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(key) || key.length > 80) {
        throw new Error(`Invalid header name ${key}.`);
      }
      if (BLOCKED_HEADERS.has(key.toLowerCase())) throw new Error(`Header ${key} is not allowed.`);
    }
    out[key] = item;
  }
  return out;
}

function cleanUrl(value: unknown, transport: McpTransport): string {
  if (typeof value !== "string" || !value.trim()) {
    if (transport === "stdio") return "";
    throw new Error("HTTP and SSE servers need a URL.");
  }
  return assertToolUrl(value).toString();
}

function assertRunnable(server: McpServerRecord) {
  if (server.transport === "stdio") {
    if (!server.command) throw new Error("stdio servers need a command.");
    return;
  }
  if (!server.url) throw new Error("HTTP and SSE servers need a URL.");
}

function apply(current: McpServerRecord | null, patch: McpServerDraft, id: string): McpServerRecord {
  const transport = patch.transport !== undefined ? cleanTransport(patch.transport) : (current?.transport ?? "stdio");
  const next: McpServerRecord = {
    id,
    name: patch.name !== undefined ? cleanName(patch.name) : (current?.name ?? cleanName(patch.name)),
    enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : (current?.enabled ?? true),
    transport,
    command: patch.command !== undefined ? cleanCommand(patch.command) : (current?.command ?? ""),
    args: patch.args !== undefined ? cleanArgs(patch.args) : (current?.args ?? []),
    env: patch.env !== undefined ? cleanStringMap(patch.env, "env") : (current?.env ?? {}),
    url: patch.url !== undefined ? cleanUrl(patch.url, transport) : current?.url ?? "",
    headers: patch.headers !== undefined ? cleanStringMap(patch.headers, "headers") : (current?.headers ?? {}),
  };
  if (patch.url === undefined && current && transport !== "stdio" && next.url) {
    next.url = assertToolUrl(next.url).toString();
  }
  if (patch.url === undefined && transport !== "stdio" && !next.url) {
    throw new Error("HTTP and SSE servers need a URL.");
  }
  assertRunnable(next);
  return next;
}

export function listMcpServers(): McpServerRecord[] {
  return readAll();
}

export function getMcpServer(id: string): McpServerRecord | null {
  return readAll().find((server) => server.id === id) ?? null;
}

export function createMcpServer(patch: McpServerDraft): McpServerRecord {
  const servers = readAll();
  if (servers.length >= MAX_SERVERS) throw new Error("Too many MCP servers (24).");
  const record = apply(null, { enabled: true, ...patch }, randomUUID());
  servers.push(record);
  writeAll(servers);
  return record;
}

export function updateMcpServer(id: string, patch: McpServerDraft): McpServerRecord {
  const servers = readAll();
  const index = servers.findIndex((server) => server.id === id);
  if (index < 0) throw new Error("MCP server not found.");
  const record = apply(servers[index], patch, id);
  servers[index] = record;
  writeAll(servers);
  return record;
}

export function deleteMcpServer(id: string) {
  const servers = readAll();
  const next = servers.filter((server) => server.id !== id);
  if (next.length === servers.length) throw new Error("MCP server not found.");
  writeAll(next);
}
