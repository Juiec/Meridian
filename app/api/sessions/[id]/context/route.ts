import { connection } from "next/server";

import { cleanSessionContext, sessionContextUsage } from "@/lib/clean-context";
import { caught, jsonError, readBody } from "@/lib/http";
import { getSession } from "@/lib/sessions";
import { MAX_TRIP_DAYS } from "@/lib/travel-types";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  if (!getSession(id)) return jsonError("Session not found.", 404);
  try {
    return Response.json({ context: await sessionContextUsage(id) });
  } catch (err) {
    return caught(err);
  }
}

export async function POST(request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  if (!getSession(id)) return jsonError("Session not found.", 404);
  const body = await readBody(request);
  if (body instanceof Response) return body;
  let day: number | undefined;
  if (body.day !== undefined && body.day !== null) {
    const parsed = typeof body.day === "number" ? body.day : Number(body.day);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TRIP_DAYS) {
      return jsonError(`Day must be a whole number from 1 to ${MAX_TRIP_DAYS}.`);
    }
    day = parsed;
  }
  try {
    return Response.json(cleanSessionContext(id, day));
  } catch (err) {
    return caught(err, 400);
  }
}
