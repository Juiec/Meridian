import { connection } from "next/server";

import { caught, readBody } from "@/lib/http";
import { createMcpServer, type McpServerDraft } from "@/lib/mcp-config";
import { refreshMcpServer } from "@/lib/mcp-runtime";
import { toolsOverview } from "@/lib/tools-catalog";

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    const server = createMcpServer(body as McpServerDraft);
    if (server.enabled) await refreshMcpServer(server.id);
    return Response.json(toolsOverview());
  } catch (err) {
    return caught(err, 400);
  }
}
