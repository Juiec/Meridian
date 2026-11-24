import { connection } from "next/server";

import { confirmImageGeneration } from "@/lib/image-confirm";
import { caught, jsonError, readBody } from "@/lib/http";

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (typeof body.sessionId !== "string" || typeof body.toolCallId !== "string") {
    return jsonError("Session and tool call are required.");
  }
  try {
    const content = await confirmImageGeneration(body.sessionId, body.toolCallId);
    return Response.json({ content });
  } catch (err) {
    return caught(err, 400);
  }
}
