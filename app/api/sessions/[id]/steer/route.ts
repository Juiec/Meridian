import { connection } from "next/server";

import { jsonError, readBody } from "@/lib/http";
import { steerRun } from "@/lib/runs";
import { getSession } from "@/lib/sessions";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (!getSession(id)) return jsonError("Session not found.", 404);
  const content = typeof body.content === "string" ? body.content : "";
  const steered = steerRun(id, content);
  if (!steered.ok) return jsonError(steered.error, steered.status);
  return Response.json({ ok: true });
}
