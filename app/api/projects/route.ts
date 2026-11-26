import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { addProject, createProject, listProjects } from "@/lib/projects";

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
  if (typeof body.name !== "string") return jsonError("name must be a string.");
  try {
    const project =
      typeof body.root === "string" ? addProject(body.name, body.root) : createProject(body.name);
    return Response.json({ project }, { status: 201 });
  } catch (err) {
    return caught(err, 400);
  }
}
