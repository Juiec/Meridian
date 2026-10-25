import { createRequire } from "node:module";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const require = createRequire(import.meta.resolve("@modelcontextprotocol/sdk/package.json"));
const { z } = require("zod");

const server = new McpServer({ name: "meridian-demo", version: "0.1.0" });

server.tool(
  "ping",
  "Return pong plus an optional note. Use this to check that Meridian can call an MCP tool.",
  { note: z.string().optional() },
  async ({ note }) => {
    const text = typeof note === "string" && note.trim() ? `pong ${note.trim()}` : "pong";
    return { content: [{ type: "text", text }] };
  },
);

await server.connect(new StdioServerTransport());
