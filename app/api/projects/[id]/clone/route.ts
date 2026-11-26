import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { cloneIntoProject } from "@/lib/workspace";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (typeof body.url !== "string") return jsonError("url must be a string.");
  try {
    const cloned = await cloneIntoProject(decodeURIComponent(id), body.url);
    return Response.json({ clone: cloned }, { status: 201 });
  } catch (err) {
    return caught(err, 400);
  }
}
