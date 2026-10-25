import { connection } from "next/server";

import { createCustomTool, type CustomToolDraft } from "@/lib/custom-tools";
import { caught, readBody } from "@/lib/http";
import { toolsOverview } from "@/lib/tools-catalog";

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    createCustomTool(body as CustomToolDraft);
    return Response.json(toolsOverview());
  } catch (err) {
    return caught(err, 400);
  }
}
