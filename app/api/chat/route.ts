import { connection } from "next/server";

import { runTurn } from "@/lib/agent";
import { prepareAttachments, type IncomingAttachment } from "@/lib/attachments";
import { messageOf } from "@/lib/errors";
import { jsonError, readBody } from "@/lib/http";
import { finishRun, claimRun } from "@/lib/runs";
import { getSession, lastUserMessage } from "@/lib/sessions";
import { getSettings } from "@/lib/settings";
import { encodeSse } from "@/lib/sse";
import type { AgentEvent } from "@/lib/types";

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const replay = body.retry === true;
  let content = typeof body.content === "string" ? body.content : "";
  if (!sessionId) return jsonError("sessionId is required.");
  const prepared = prepareAttachments(Array.isArray(body.attachments) ? (body.attachments as IncomingAttachment[]) : []);
  if (!prepared.ok) return jsonError(prepared.error);
  if (replay) {
    const previous = lastUserMessage(sessionId);
    if (!previous) return jsonError("Nothing to retry.");
    content = previous.content;
  } else if (!content.trim() && prepared.attachments.length === 0) {
    return jsonError("Message is empty.");
  }
  if (content.length > 32_000) return jsonError("Message is too long (max 32000 characters).");

  const session = getSession(sessionId);
  if (!session) return jsonError("Session not found.", 404);
  const settings = getSettings();
  if (!settings.baseUrl) {
    return jsonError("Set LM_STUDIO_BASE_URL or save a base URL in Settings.");
  }
  if (!(session.model || settings.model).trim()) {
    return jsonError("Set a model id in Settings before chatting.");
  }

  const controller = claimRun(sessionId);
  if (!controller) return jsonError("This session is already running.", 409);
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(streamController) {
      const emit = (event: AgentEvent) => {
        streamController.enqueue(encoder.encode(encodeSse(event.type, event)));
      };
      try {
        await runTurn({
          sessionId,
          content,
          attachments: replay ? undefined : prepared.attachments,
          replay,
          signal: controller.signal,
          emit,
        });
      } catch (err) {
        emit({ type: "error", message: messageOf(err) });
      } finally {
        request.signal.removeEventListener("abort", abort);
        finishRun(sessionId);
        try {
          streamController.close();
        } catch {
          // The client already hung up.
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
