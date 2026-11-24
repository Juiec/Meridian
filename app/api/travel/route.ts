import { connection } from "next/server";

import { caught } from "@/lib/http";
import { tripView } from "@/lib/travel";

export async function GET(request: Request) {
  await connection();
  try {
    const trip = new URL(request.url).searchParams.get("trip") ?? undefined;
    return Response.json(await tripView(trip || undefined));
  } catch (err) {
    return caught(err);
  }
}
