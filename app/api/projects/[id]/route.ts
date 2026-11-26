import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { removeProject, renameProject } from "@/lib/projects";
import { detachProject } from "@/lib/sessions";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (typeof body.name !== "string") return jsonError("name must be a string.");
  try {
    const project = renameProject(decodeURIComponent(id), body.name);
    return Response.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/not found/i.test(message)) return jsonError(message, 404);
    return caught(err, 400);
  }
}

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
