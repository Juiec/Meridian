import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { addProject, listProjects } from "@/lib/projects";

export async function GET() {
  await connection();
  try {
    return Response.json({ projects: listProjects() });
  } catch (err) {
    return caught(err);
  }
}

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (typeof body.name !== "string" || typeof body.root !== "string") {
    return jsonError("name and root must be strings.");
  }
  try {
    const project = addProject(body.name, body.root);
    return Response.json({ project }, { status: 201 });
  } catch (err) {
    return caught(err, 400);
  }
}
