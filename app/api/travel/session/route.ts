import { connection } from "next/server";

import { caught, jsonError } from "@/lib/http";
import { createTripPlan, getOrCreateTravelSession, getSession, toSummary } from "@/lib/sessions";

function travelSession(id: string | null) {
  if (!id) return getOrCreateTravelSession();
  const session = getSession(id);
  if (!session || session.purpose !== "travel") return null;
  return session;
}

export async function GET(request: Request) {
  await connection();
  try {
    const trip = new URL(request.url).searchParams.get("trip");
    const session = travelSession(trip);
    if (!session) return jsonError("Trip not found.", 404);
    return Response.json({ session: toSummary(session) });
  } catch (err) {
    return caught(err);
  }
}

export async function POST() {
  await connection();
  try {
    return Response.json({ session: toSummary(createTripPlan()) }, { status: 201 });
  } catch (err) {
    return caught(err);
  }
}
