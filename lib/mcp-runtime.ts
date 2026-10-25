import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { messageOf } from "@/lib/errors";
import { getMcpServer, listMcpServers, type McpServerRecord } from "@/lib/mcp-config";
import { parseToolArguments } from "@/lib/tools";
import type { McpConnectionStatus } from "@/lib/tool-types";
import { assertToolUrl } from "@/lib/tool-url";

export type LiveTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

type LiveConn = {
  fingerprint: string;
  client: Client;
  transport: Transport;
  tools: LiveTool[];
};

type RuntimeState = {
  live: Map<string, LiveConn>;
  failures: Map<string, { error: string; fingerprint: string }>;
  inflight: Map<string, Promise<void>>;
};

function state(): RuntimeState {
  const g = globalThis as { __meridianMcp?: RuntimeState };
  if (!g.__meridianMcp) {
    g.__meridianMcp = { live: new Map(), failures: new Map(), inflight: new Map() };
  }
  return g.__meridianMcp;
}

function fingerprint(server: McpServerRecord): string {
  return JSON.stringify({
    transport: server.transport,
    command: server.command,
    args: server.args,
    env: server.env,
    url: server.url,
    headers: server.headers,
  });
}

function clip(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function closeClient(client: Client, transport: Transport) {
  try {
    await client.close();
  } catch {
    try {
      await transport.close();
    } catch {
      /* already stopped */
    }
  }
}

function build(server: McpServerRecord): { client: Client; transport: Transport; stderr: () => string } {
  const client = new Client({ name: "meridian", version: "0.1.0" });
  if (server.transport === "stdio") {
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      env: { ...getDefaultEnvironment(), ...server.env },
      stderr: "pipe",
    });
    let buf = "";
    transport.stderr?.on("data", (chunk: Buffer | string) => {
      buf = (buf + chunk.toString()).slice(-2000);
    });
    return { client, transport, stderr: () => buf.trim().slice(-500) };
  }
  const url = assertToolUrl(server.url);
  const requestInit = { headers: server.headers };
  const transport =
    server.transport === "sse"
      ? new SSEClientTransport(url, { requestInit })
      : new StreamableHTTPClientTransport(url, { requestInit });
  return { client, transport, stderr: () => "" };
}

function normalizeTools(value: unknown): LiveTool[] {
  if (!Array.isArray(value)) return [];
  const tools: LiveTool[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as { name?: unknown; description?: unknown; inputSchema?: unknown };
    if (typeof record.name !== "string" || !record.name.trim()) continue;
    const parameters =
      record.inputSchema && typeof record.inputSchema === "object" && !Array.isArray(record.inputSchema)
        ? (record.inputSchema as Record<string, unknown>)
        : { type: "object", additionalProperties: true, properties: {} };
    tools.push({
      name: record.name,
      description: typeof record.description === "string" ? record.description : "",
      parameters,
    });
  }
  return tools;
}

async function openServer(server: McpServerRecord): Promise<void> {
  const fp = fingerprint(server);
  const built = build(server);
  try {
    await withTimeout(built.client.connect(built.transport), 20_000, "Timed out connecting to the MCP server.");
    const listed = (await built.client.listTools({}, { timeout: 15_000 })) as { tools?: unknown };
    const tools = normalizeTools(listed.tools);
    state().failures.delete(server.id);
    state().live.set(server.id, { fingerprint: fp, client: built.client, transport: built.transport, tools });
  } catch (err) {
    await closeClient(built.client, built.transport);
    const extra = built.stderr();
    const message = messageOf(err);
    throw new Error(clip(extra ? `${message}\n${extra}` : message, 800));
  }
}

async function connectServer(server: McpServerRecord): Promise<void> {
  const pending = state().inflight.get(server.id);
  if (pending) {
    await pending;
    return;
  }
  const job = openServer(server).finally(() => {
    state().inflight.delete(server.id);
  });
  state().inflight.set(server.id, job);
  await job;
}

export function mcpLiveView(server: McpServerRecord): {
  status: McpConnectionStatus;
  error: string | null;
  tools: LiveTool[];
} {
  if (!server.enabled) return { status: "disabled", error: null, tools: [] };
  const fp = fingerprint(server);
  const conn = state().live.get(server.id);
  if (conn && conn.fingerprint === fp) return { status: "connected", error: null, tools: conn.tools };
  const failed = state().failures.get(server.id);
  if (failed && failed.fingerprint === fp) return { status: "error", error: failed.error, tools: [] };
  return { status: "idle", error: null, tools: [] };
}

export async function disconnectMcp(id: string): Promise<void> {
  const conn = state().live.get(id);
  state().live.delete(id);
  if (!conn) return;
  await closeClient(conn.client, conn.transport);
}

export async function disconnectAllMcp(): Promise<void> {
  const ids = [...state().live.keys()];
  await Promise.all(ids.map((id) => disconnectMcp(id)));
  state().failures.clear();
}

export async function refreshMcpServer(id: string): Promise<void> {
  const server = getMcpServer(id);
  if (!server) throw new Error("MCP server not found.");
  state().failures.delete(id);
  await disconnectMcp(id);
  if (!server.enabled) return;
  try {
    await connectServer(server);
  } catch (err) {
    state().failures.set(id, { error: clip(messageOf(err), 800), fingerprint: fingerprint(server) });
  }
}

export async function ensureMcpConnections(): Promise<void> {
  let servers: McpServerRecord[] = [];
  try {
    servers = listMcpServers().filter((server) => server.enabled);
  } catch {
    return;
  }
  const ids = new Set(servers.map((server) => server.id));
  for (const id of [...state().live.keys()]) {
    if (!ids.has(id)) {
      try {
        await disconnectMcp(id);
      } catch {
        state().live.delete(id);
      }
    }
  }
  for (const server of servers) {
    const fp = fingerprint(server);
    try {
      const conn = state().live.get(server.id);
      if (conn?.fingerprint === fp) continue;
      if (conn) await disconnectMcp(server.id);
      const failed = state().failures.get(server.id);
      if (failed?.fingerprint === fp) continue;
      await connectServer(server);
    } catch (err) {
      state().failures.set(server.id, { error: clip(messageOf(err), 800), fingerprint: fp });
    }
  }
}

function readMcpResult(result: unknown): { text: string; isError: boolean } {
  if (!result || typeof result !== "object") return { text: "", isError: false };
  const record = result as { isError?: boolean; content?: unknown; toolResult?: unknown };
  const chunks: string[] = [];
  if (Array.isArray(record.content)) {
    for (const item of record.content) {
      if (!item || typeof item !== "object") continue;
      const part = item as { type?: unknown; text?: unknown };
      if (part.type === "text" && typeof part.text === "string") chunks.push(part.text);
    }
  }
  if (chunks.length === 0 && typeof record.toolResult === "string") chunks.push(record.toolResult);
  const joined = chunks.join("\n");
  const text = joined.length > 12_000 ? `${joined.slice(0, 12_000)}\n[truncated]` : joined;
  return { text, isError: Boolean(record.isError) };
}

export async function callMcpTool(serverId: string, remoteName: string, rawArgs: string): Promise<Record<string, unknown>> {
  const parsed = parseToolArguments(rawArgs);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const conn = state().live.get(serverId);
  if (!conn) return { ok: false, error: "MCP server is not connected. Refresh it in settings." };
  try {
    const result: unknown = await conn.client.callTool({ name: remoteName, arguments: parsed.value }, undefined, {
      timeout: 20_000,
    });
    const { text, isError } = readMcpResult(result);
    if (isError) return { ok: false, error: text || "MCP tool returned an error.", text };
    return { ok: true, text };
  } catch (err) {
    const message = clip(messageOf(err), 800);
    if (/timeout|closed|disconnect|EPIPE|connection|aborted/i.test(message)) {
      const server = getMcpServer(serverId);
      state().live.delete(serverId);
      if (server) state().failures.set(serverId, { error: message, fingerprint: fingerprint(server) });
      await closeClient(conn.client, conn.transport);
    }
    return { ok: false, error: message };
  }
}
