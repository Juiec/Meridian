import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { deleteSkill, draftFromBody, readSkillSource, updateSkill } from "@/lib/skill-store";

type Context = { params: Promise<{ name: string }> };

export async function GET(_request: Request, context: Context) {
  await connection();
  const { name } = await context.params;
  try {
    return Response.json({ skill: readSkillSource(decodeURIComponent(name)) });
  } catch (err) {
    return caught(err, 404);
  }
}

export async function PUT(request: Request, context: Context) {
  await connection();
  const { name } = await context.params;
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    const skill = updateSkill(decodeURIComponent(name), draftFromBody(body, decodeURIComponent(name)));
    return Response.json({ skill });
  } catch (err) {
    return caught(err, 400);
  }
}

export async function DELETE(_request: Request, context: Context) {
  await connection();
  const { name } = await context.params;
  try {
    deleteSkill(decodeURIComponent(name));
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/no skill/i.test(message)) return jsonError(message, 404);
    return caught(err);
  }
}
