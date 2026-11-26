import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { renameProjectEntry } from "@/lib/projects";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (typeof body.path !== "string" || typeof body.name !== "string") {
    return jsonError("path and name must be strings.");
  }
  try {
    const entry = renameProjectEntry(decodeURIComponent(id), body.path, body.name);
    return Response.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/not found/i.test(message)) return jsonError(message, 404);
    return caught(err, 400);
  }
}
