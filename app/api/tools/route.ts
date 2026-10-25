import { connection } from "next/server";

import { caught } from "@/lib/http";
import { toolsOverview } from "@/lib/tools-catalog";

export async function GET() {
  await connection();
  try {
    return Response.json(toolsOverview());
  } catch (err) {
    return caught(err);
  }
}
