import { connection } from "next/server";

import { caught, readBody } from "@/lib/http";
import { createSession, listSessions, toSummary } from "@/lib/sessions";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const archivedParam = url.searchParams.get("archived");
  const archived = archivedParam === "only" || archivedParam === "1" ? "only" : archivedParam === "all" ? "all" : "hide";
  return Response.json({
    sessions: listSessions({ query: url.searchParams.get("q") ?? "", archived }),
  });
}

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    const model = typeof body.model === "string" ? body.model : undefined;
    const session = createSession(model);
    return Response.json({ session: toSummary(session) }, { status: 201 });
  } catch (err) {
    return caught(err, 400);
  }
}
