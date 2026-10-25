import { connection } from "next/server";

import { caught } from "@/lib/http";
import { refreshMcpServer } from "@/lib/mcp-runtime";
import { toolsOverview } from "@/lib/tools-catalog";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  try {
    await refreshMcpServer(id);
    return Response.json(toolsOverview());
  } catch (err) {
    return caught(err, 400);
  }
}
