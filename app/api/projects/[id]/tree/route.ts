import { connection } from "next/server";

import { caught } from "@/lib/http";
import { listProjectDir } from "@/lib/projects";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  const relative = new URL(request.url).searchParams.get("path") ?? "";
  try {
    return Response.json(listProjectDir(decodeURIComponent(id), relative));
  } catch (err) {
    return caught(err, 404);
  }
}
