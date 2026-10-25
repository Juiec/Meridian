import { connection } from "next/server";

import { caught } from "@/lib/http";
import { tripView } from "@/lib/travel";

export async function GET() {
  await connection();
  try {
    return Response.json(await tripView());
  } catch (err) {
    return caught(err);
  }
}
