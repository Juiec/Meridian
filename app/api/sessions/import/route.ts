import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { importSession, toSummary } from "@/lib/sessions";

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    const session = importSession(body);
    return Response.json({ session: toSummary(session) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    if (/secret|environment file/i.test(message)) return jsonError(message, 400);
    return caught(err, 400);
  }
}
