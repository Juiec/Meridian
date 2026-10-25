import { connection } from "next/server";

import { jsonError, readBody } from "@/lib/http";
import { checkFares } from "@/lib/travel";

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  const from = typeof body.from === "string" ? body.from : "";
  const to = typeof body.to === "string" ? body.to : "";
  const date = typeof body.date === "string" ? body.date : "";
  const passengers = typeof body.passengers === "number" ? body.passengers : Number(body.passengers ?? 1);
  const result = await checkFares({ from, to, date: date || null, passengers });
  if (result.ok === false) return jsonError(String(result.error || result.text || "Price check failed."));
  return Response.json(result);
}
