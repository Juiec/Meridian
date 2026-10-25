import { connection } from "next/server";

import { deleteCustomTool, updateCustomTool, type CustomToolDraft } from "@/lib/custom-tools";
import { caught, readBody } from "@/lib/http";
import { toolsOverview } from "@/lib/tools-catalog";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    updateCustomTool(id, body as CustomToolDraft);
    return Response.json(toolsOverview());
  } catch (err) {
    return caught(err, 400);
  }
}

export async function DELETE(_request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  try {
    deleteCustomTool(id);
    return Response.json(toolsOverview());
  } catch (err) {
    return caught(err, 400);
  }
}
