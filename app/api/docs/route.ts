import { connection } from "next/server";

import { readDoc, writeDoc, type DocTarget } from "@/lib/docs";
import { caught, jsonError, readBody } from "@/lib/http";

function isTarget(value: unknown): value is DocTarget {
  return value === "soul" || value === "agents";
}

export async function GET() {
  await connection();
  return Response.json({
    soul: readDoc("soul"),
    agents: readDoc("agents"),
  });
}

export async function PUT(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (!isTarget(body.target)) return jsonError('target must be "soul" or "agents".');
  if (typeof body.text !== "string") return jsonError("text must be a string.");
  try {
    const doc = writeDoc(body.target, body.text);
    return Response.json({ target: body.target, doc });
  } catch (err) {
    return caught(err, 400);
  }
}
