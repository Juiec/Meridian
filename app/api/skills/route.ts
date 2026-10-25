import { connection } from "next/server";

import { caught, readBody } from "@/lib/http";
import { createSkill, draftFromBody } from "@/lib/skill-store";
import { discoverSkills } from "@/lib/skills";
import type { SkillInfo } from "@/lib/types";

export async function GET() {
  await connection();
  const { skills, skipped } = discoverSkills();
  const listed: SkillInfo[] = skills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    path: skill.rel,
    disableModelInvocation: skill.disableModelInvocation,
    files: skill.files,
  }));
  return Response.json({ skills: listed, skipped });
}

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    const skill = createSkill(draftFromBody(body));
    return Response.json({ skill }, { status: 201 });
  } catch (err) {
    return caught(err, 400);
  }
}
