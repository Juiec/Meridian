import { connection } from "next/server";

import { caught, jsonError } from "@/lib/http";
import { removeProject } from "@/lib/projects";
import { detachProject } from "@/lib/sessions";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  try {
    const projectId = decodeURIComponent(id);
    removeProject(projectId);
    detachProject(projectId);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/not found/i.test(message)) return jsonError(message, 404);
    return caught(err);
  }
}
