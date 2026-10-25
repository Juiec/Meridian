import { messageOf } from "@/lib/errors";

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonError("Expected a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch {
    return jsonError("Expected JSON.");
  }
}

export function caught(err: unknown, status = 500): Response {
  const message = messageOf(err);
  const code = /not found/i.test(message) ? 404 : status;
  return jsonError(message, code);
}
