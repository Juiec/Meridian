import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import {
  MEMORY_LIMITS,
  applyMemory,
  readEntries,
  usageOf,
  type MemoryOp,
  type MemoryTarget,
} from "@/lib/memory";
import type { MemoryView } from "@/lib/types";

function view(): MemoryView {
  const memory = readEntries("memory");
  const user = readEntries("user");
  return {
    memory: { entries: memory, used: usageOf(memory), limit: MEMORY_LIMITS.memory },
    user: { entries: user, used: usageOf(user), limit: MEMORY_LIMITS.user },
  };
}

export async function GET() {
  await connection();
  return Response.json(view());
}

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  const target = body.target;
  if (target !== "memory" && target !== "user") {
    return jsonError('target must be "memory" or "user".');
  }
  if (!Array.isArray(body.operations)) return jsonError("operations must be an array.");
  const operations: MemoryOp[] = [];
  for (const item of body.operations) {
    if (!item || typeof item !== "object") return jsonError("Each operation must be an object.");
    const record = item as Record<string, unknown>;
    const action = record.action;
    if (action !== "add" && action !== "patch" && action !== "remove") {
      return jsonError("Each operation needs action add, patch, or remove.");
    }
    operations.push({
      action,
      content: typeof record.content === "string" ? record.content : undefined,
      old_text: typeof record.old_text === "string" ? record.old_text : undefined,
    });
  }
  try {
    const result = applyMemory(target as MemoryTarget, operations);
    return Response.json({ result, memory: view() });
  } catch (err) {
    return caught(err);
  }
}
