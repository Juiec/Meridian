import { connection } from "next/server";

import { caught } from "@/lib/http";
import { getOrCreateTravelSession, toSummary } from "@/lib/sessions";

export async function GET() {
  await connection();
  try {
    return Response.json({ session: toSummary(getOrCreateTravelSession()) });
  } catch (err) {
    return caught(err);
  }
}
