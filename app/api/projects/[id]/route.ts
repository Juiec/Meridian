import { connection } from "next/server";

import { caught, jsonError } from "@/lib/http";
import { removeProject } from "@/lib/projects";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  try {
    removeProject(decodeURIComponent(id));
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/not found/i.test(message)) return jsonError(message, 404);
    return caught(err);
  }
}
