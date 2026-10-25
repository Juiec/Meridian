import { connection } from "next/server";

import { caught, readBody } from "@/lib/http";
import { deleteMcpServer, updateMcpServer, type McpServerDraft } from "@/lib/mcp-config";
import { disconnectMcp, refreshMcpServer } from "@/lib/mcp-runtime";
import { toolsOverview } from "@/lib/tools-catalog";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    const server = updateMcpServer(id, body as McpServerDraft);
    if (server.enabled) await refreshMcpServer(server.id);
    else {
      await disconnectMcp(server.id);
    }
    return Response.json(toolsOverview());
  } catch (err) {
    return caught(err, 400);
  }
}

export async function DELETE(_request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  try {
    await disconnectMcp(id);
    deleteMcpServer(id);
    return Response.json(toolsOverview());
  } catch (err) {
    return caught(err, 400);
  }
}
