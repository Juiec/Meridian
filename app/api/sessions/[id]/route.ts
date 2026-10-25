import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { deleteSession, getSession, listMessages, toSummary, updateSession } from "@/lib/sessions";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  const session = getSession(id);
  if (!session) return jsonError("Session not found.", 404);
  return Response.json({ session, messages: listMessages(id), summary: toSummary(session) });
}

export async function PATCH(request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (!getSession(id)) return jsonError("Session not found.", 404);
  const patch: { title?: string; model?: string; pinned?: boolean; archived?: boolean } = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return jsonError("Title cannot be empty.");
    if (title.length > 80) return jsonError("Title must be 80 characters or fewer.");
    patch.title = title;
  }
  if (typeof body.model === "string") patch.model = body.model.trim();
  if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
  if (typeof body.archived === "boolean") patch.archived = body.archived;
  if (Object.keys(patch).length === 0) return jsonError("Nothing to update.");
  try {
    const session = updateSession(id, patch);
    if (!session) return jsonError("Session not found.", 404);
    return Response.json({ session: toSummary(session) });
  } catch (err) {
    return caught(err);
  }
}

export async function DELETE(_request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  if (!deleteSession(id)) return jsonError("Session not found.", 404);
  return Response.json({ ok: true });
}
