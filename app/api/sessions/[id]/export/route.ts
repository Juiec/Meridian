import { connection } from "next/server";

import { jsonError } from "@/lib/http";
import { exportSession, getSession, listMessages, sessionMarkdown } from "@/lib/sessions";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  await connection();
  const { id } = await context.params;
  const session = getSession(id);
  if (!session) return jsonError("Session not found.", 404);
  const format = new URL(request.url).searchParams.get("format") === "md" ? "md" : "json";
  const filename = `${session.title.replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "") || "session"}`;
  if (format === "md") {
    return new Response(sessionMarkdown(session, listMessages(id)), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.md"`,
      },
    });
  }
  const payload = exportSession(id);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.json"`,
    },
  });
}
