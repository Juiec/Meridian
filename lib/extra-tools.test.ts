import { createServer, type Server } from "node:http";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prepareAgentTools, executeAgentTool } from "@/lib/agent-tools";
import { runTurn } from "@/lib/agent";
import { createCustomTool, updateCustomTool } from "@/lib/custom-tools";
import type { CompletionDelta, CompletionRequest } from "@/lib/lmstudio";
import { createMcpServer, updateMcpServer } from "@/lib/mcp-config";
import { disconnectAllMcp } from "@/lib/mcp-runtime";
import { createSession } from "@/lib/sessions";
import { makeHome } from "@/lib/test-home";
import { toolsOverview } from "@/lib/tools-catalog";
import type { AgentEvent } from "@/lib/types";

beforeEach(() => {
  makeHome();
});

afterEach(async () => {
  await disconnectAllMcp();
});

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

describe("mcp and custom tools", () => {
  it("hides secrets, keeps headers on edit, and calls a local webhook", async () => {
    const hits: { body: string; auth: string | undefined }[] = [];
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        hits.push({
          body: Buffer.concat(chunks).toString("utf8"),
          auth: typeof req.headers.authorization === "string" ? req.headers.authorization : undefined,
        });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ echoed: true }));
      });
    });
    const port = await listen(server);
    try {
      const tool = createCustomTool({
        name: "echo_hook",
        description: "Send a note to the local webhook.",
        parameters: { type: "object", properties: { note: { type: "string" } }, required: ["note"] },
        method: "POST",
        url: `http://127.0.0.1:${port}/hook`,
        headers: { Authorization: "Bearer local-secret" },
      });
      updateCustomTool(tool.id, { description: "Send a note to the local webhook." });
      const bundle = await prepareAgentTools();
      expect(bundle.routes.echo_hook).toEqual({ source: "custom", sourceId: tool.id, remoteName: "echo_hook" });
      const result = await executeAgentTool("echo_hook", JSON.stringify({ note: "hi" }), bundle.routes);
      expect(result.ok).toBe(true);
      expect(String(result.text)).toContain("echoed");
      expect(hits[0]?.auth).toBe("Bearer local-secret");
      expect(hits[0]?.body).toContain("hi");
      const overview = toolsOverview();
      expect(JSON.stringify(overview)).not.toContain("local-secret");
      expect(overview.customTools[0]?.headerKeys).toEqual(["Authorization"]);

      createCustomTool({
        name: "memory",
        description: "Must not replace the built-in.",
        parameters: { type: "object", properties: {} },
        url: `http://127.0.0.1:${port}/other`,
        enabled: true,
      });
      const renamed = await prepareAgentTools();
      expect(renamed.routes.custom_memory.source).toBe("custom");
      expect(renamed.definitions.filter((item) => item.function.name === "memory")).toHaveLength(1);

      expect(() =>
        createCustomTool({
          name: "bad_schema",
          description: "nope",
          parameters: { type: "string" },
          url: `http://127.0.0.1:${port}/x`,
        }),
      ).toThrow(/object/);
      expect(() =>
        createCustomTool({
          name: "meta",
          description: "nope",
          parameters: { type: "object" },
          url: "http://169.254.169.254/latest",
        }),
      ).toThrow(/blocked/);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("refuses a webhook redirect to the metadata address", async () => {
    const server = createServer((_req, res) => {
      res.writeHead(302, { location: "http://169.254.169.254/latest" });
      res.end();
    });
    const port = await listen(server);
    try {
      const tool = createCustomTool({
        name: "redir",
        description: "Redirects.",
        parameters: { type: "object", properties: {} },
        url: `http://127.0.0.1:${port}/go`,
      });
      const result = await executeAgentTool("redir", "{}", { redir: { source: "custom", sourceId: tool.id, remoteName: "redir" } });
      expect(result.ok).toBe(false);
      expect(String(result.error)).toMatch(/blocked/i);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("connects the demo stdio server and still runs when another server fails", async () => {
    createMcpServer({
      name: "broken",
      transport: "stdio",
      command: "no-such-meridian-bin",
      args: [],
      enabled: true,
    });
    const server = createMcpServer({
      name: "demo",
      transport: "stdio",
      command: process.execPath,
      args: [path.join(process.cwd(), "scripts/demo-mcp.mjs")],
      env: { SUPER_SECRET: "should-not-leak" },
      enabled: true,
    });
    const bundle = await prepareAgentTools();
    expect(bundle.routes.mcp_demo_ping).toEqual({ source: "mcp", sourceId: server.id, remoteName: "ping" });
    expect(Object.keys(bundle.routes).some((name) => name.startsWith("mcp_broken"))).toBe(false);
    const result = await executeAgentTool("mcp_demo_ping", JSON.stringify({ note: "desk" }), bundle.routes);
    expect(result).toMatchObject({ ok: true, text: "pong desk" });
    const clock = await executeAgentTool("current_time", "{}", bundle.routes);
    expect(clock.ok).toBe(true);
    const overview = toolsOverview();
    expect(JSON.stringify(overview)).not.toContain("should-not-leak");
    expect(overview.servers.find((item) => item.name === "demo")?.envKeys).toEqual(["SUPER_SECRET"]);
    expect(overview.servers.find((item) => item.name === "broken")?.status).toBe("error");

    updateMcpServer(server.id, { enabled: false });
    const again = await prepareAgentTools();
    expect(again.routes.mcp_demo_ping).toBeUndefined();
    const second = toolsOverview();
    expect(second.servers.find((item) => item.id === server.id)?.status).toBe("disabled");
    expect(second.servers.find((item) => item.name === "broken")?.status).toBe("error");
  });

  it("runs a custom tool inside the agent loop", async () => {
    const server = createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("hook-ok");
      });
    });
    const port = await listen(server);
    try {
      createCustomTool({
        name: "echo_hook",
        description: "Local hook.",
        parameters: { type: "object", properties: { note: { type: "string" } } },
        url: `http://127.0.0.1:${port}/hook`,
      });
      const session = createSession();
      const events: AgentEvent[] = [];
      const seen: string[][] = [];
      await runTurn({
        sessionId: session.id,
        content: "Call the hook.",
        emit: (event) => events.push(event),
        complete: scripted((request, call) => {
          seen.push((request.tools ?? []).map((tool) => tool.function.name));
          if (call === 1) {
            return [
              {
                type: "tool_delta",
                index: 0,
                id: "call_hook",
                name: "echo_hook",
                arguments: JSON.stringify({ note: "desk" }),
              },
              { type: "finish", reason: "tool_calls" },
            ];
          }
          return [{ type: "text", text: "The hook answered." }, { type: "finish", reason: "stop" }];
        }),
      });
      expect(seen[0]).toContain("echo_hook");
      expect(seen[0]).toContain("memory");
      expect(events.some((event) => event.type === "tool_call" && event.call.name === "echo_hook")).toBe(true);
      expect(events.some((event) => event.type === "tool_result" && event.name === "echo_hook" && event.ok)).toBe(true);
      const result = events.find((event) => event.type === "tool_result");
      expect(result && result.type === "tool_result" ? result.content : "").toContain("hook-ok");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

function scripted(handler: (request: CompletionRequest, call: number) => CompletionDelta[]): (
  request: CompletionRequest,
) => AsyncGenerator<CompletionDelta> {
  let call = 0;
  return async function* (request: CompletionRequest) {
    call += 1;
    for (const delta of handler(request, call)) yield delta;
  };
}
