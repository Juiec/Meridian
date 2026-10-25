import { attachmentNote, parseStoredAttachments, prepareAttachments, type IncomingAttachment } from "@/lib/attachments";
import { db } from "@/lib/db";
import { readEntries } from "@/lib/memory";
import { assembleSystemPrompt } from "@/lib/prompt";
import { getSettings } from "@/lib/settings";
import { discoverSkills } from "@/lib/skills";
import type { Attachment, SessionRecord, SessionSummary, StoredMessage, ToolCallRecord } from "@/lib/types";

type SessionRow = {
  id: string;
  title: string;
  model: string;
  system_prompt: string;
  skills_index_hash: string;
  compacted_summary: string | null;
  compacted_until_seq: number | bigint | null;
  pinned: number | bigint | null;
  archived: number | bigint | null;
  created_at: number | bigint;
  updated_at: number | bigint;
};

type MessageRow = {
  id: string;
  session_id: string;
  seq: number | bigint;
  role: string;
  content: string;
  tool_calls: string | null;
  tool_call_id: string | null;
  tool_name: string | null;
  reasoning: string | null;
  attachments: string | null;
  created_at: number | bigint;
};

function num(value: number | bigint | null): number | null {
  if (value === null) return null;
  return typeof value === "bigint" ? Number(value) : value;
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    title: row.title,
    model: row.model,
    systemPrompt: row.system_prompt,
    skillsIndexHash: row.skills_index_hash,
    compactedSummary: row.compacted_summary,
    compactedUntilSeq: num(row.compacted_until_seq),
    pinned: Number(row.pinned ?? 0) === 1,
    archived: Number(row.archived ?? 0) === 1,
    createdAt: num(row.created_at) ?? 0,
    updatedAt: num(row.updated_at) ?? 0,
  };
}

function mapMessage(row: MessageRow): StoredMessage {
  let toolCalls: ToolCallRecord[] | null = null;
  if (row.tool_calls) {
    try {
      const parsed = JSON.parse(row.tool_calls) as ToolCallRecord[];
      if (Array.isArray(parsed)) toolCalls = parsed;
    } catch {
      toolCalls = null;
    }
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    seq: num(row.seq) ?? 0,
    role: row.role as StoredMessage["role"],
    content: row.content,
    toolCalls,
    toolCallId: row.tool_call_id,
    toolName: row.tool_name,
    reasoning: row.reasoning,
    attachments: parseStoredAttachments(row.attachments),
    createdAt: num(row.created_at) ?? 0,
  };
}

export function toSummary(session: SessionRecord): SessionSummary {
  return {
    id: session.id,
    title: session.title,
    model: session.model,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    compacted: Boolean(session.compactedSummary),
    pinned: session.pinned,
    archived: session.archived,
  };
}

const SESSION_COLUMNS = `id, title, model, system_prompt, skills_index_hash, compacted_summary,
              compacted_until_seq, pinned, archived, created_at, updated_at`;

function likeTerm(query: string): string {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function listSessions(options?: { query?: string; archived?: "hide" | "only" | "all" }): SessionSummary[] {
  const archived = options?.archived ?? "hide";
  const query = options?.query?.trim() ?? "";
  const where: string[] = [];
  const params: string[] = [];
  if (archived === "hide") where.push("archived = 0");
  if (archived === "only") where.push("archived = 1");
  if (query) {
    where.push(
      `(title LIKE ? ESCAPE '\\' OR id IN (SELECT session_id FROM messages WHERE content LIKE ? ESCAPE '\\'))`,
    );
    const term = likeTerm(query);
    params.push(term, term);
  }
  const sql = `SELECT ${SESSION_COLUMNS} FROM sessions${where.length ? ` WHERE ${where.join(" AND ")}` : ""}
       ORDER BY pinned DESC, updated_at DESC`;
  const rows = db().prepare(sql).all(...params) as SessionRow[];
  return rows.map((row) => toSummary(mapSession(row)));
}

export function getSession(id: string): SessionRecord | null {
  const row = db()
    .prepare(
      `SELECT ${SESSION_COLUMNS} FROM sessions WHERE id = ?`,
    )
    .get(id) as SessionRow | undefined;
  return row ? mapSession(row) : null;
}

export function listMessages(sessionId: string): StoredMessage[] {
  const rows = db()
    .prepare(
      `SELECT id, session_id, seq, role, content, tool_calls, tool_call_id, tool_name, reasoning, attachments, created_at
       FROM messages WHERE session_id = ? ORDER BY seq ASC`,
    )
    .all(sessionId) as MessageRow[];
  return rows.map(mapMessage);
}

export function visibleMessages(session: SessionRecord, messages = listMessages(session.id)): StoredMessage[] {
  if (session.compactedUntilSeq === null) return messages;
  return messages.filter((message) => message.seq > session.compactedUntilSeq!);
}

export function createSession(model?: string): SessionRecord {
  const settings = getSettings();
  const chosen = (model ?? settings.model).trim();
  const { skills } = discoverSkills();
  const id = crypto.randomUUID();
  const now = Date.now();
  const assembled = assembleSystemPrompt({
    skills,
    memoryEntries: readEntries("memory"),
    userEntries: readEntries("user"),
    now: new Date(now),
    sessionId: id,
    model: chosen,
  });
  db()
    .prepare(
      `INSERT INTO sessions
        (id, title, model, system_prompt, skills_index_hash, compacted_summary, compacted_until_seq, created_at, updated_at)
       VALUES (?, 'New session', ?, ?, ?, NULL, NULL, ?, ?)`,
    )
    .run(id, chosen, assembled.prompt, assembled.skillsIndexHash, now, now);
  const session = getSession(id);
  if (!session) throw new Error("Session was not saved.");
  return session;
}

export function updateSession(
  id: string,
  patch: Partial<{
    title: string;
    model: string;
    skillsIndexHash: string;
    compactedSummary: string | null;
    compactedUntilSeq: number | null;
    systemPrompt: string;
    pinned: boolean;
    archived: boolean;
  }>,
): SessionRecord | null {
  const current = getSession(id);
  if (!current) return null;
  const next = {
    title: patch.title ?? current.title,
    model: patch.model ?? current.model,
    skillsIndexHash: patch.skillsIndexHash ?? current.skillsIndexHash,
    compactedSummary:
      patch.compactedSummary === undefined ? current.compactedSummary : patch.compactedSummary,
    compactedUntilSeq:
      patch.compactedUntilSeq === undefined ? current.compactedUntilSeq : patch.compactedUntilSeq,
    systemPrompt: patch.systemPrompt ?? current.systemPrompt,
    pinned: patch.pinned ?? current.pinned,
    archived: patch.archived ?? current.archived,
    updatedAt: Date.now(),
  };
  db()
    .prepare(
      `UPDATE sessions
       SET title = ?, model = ?, skills_index_hash = ?, compacted_summary = ?,
           compacted_until_seq = ?, system_prompt = ?, pinned = ?, archived = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.title,
      next.model,
      next.skillsIndexHash,
      next.compactedSummary,
      next.compactedUntilSeq,
      next.systemPrompt,
      next.pinned ? 1 : 0,
      next.archived ? 1 : 0,
      next.updatedAt,
      id,
    );
  return getSession(id);
}

export function deleteSession(id: string): boolean {
  const result = db().prepare("DELETE FROM sessions WHERE id = ?").run(id);
  return result.changes > 0;
}

export function insertMessage(input: {
  sessionId: string;
  role: StoredMessage["role"];
  content: string;
  toolCalls?: ToolCallRecord[] | null;
  toolCallId?: string | null;
  toolName?: string | null;
  reasoning?: string | null;
  attachments?: Attachment[] | null;
}): StoredMessage {
  const id = crypto.randomUUID();
  const now = Date.now();
  const seqRow = db()
    .prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM messages WHERE session_id = ?")
    .get(input.sessionId) as { seq: number | bigint };
  const seq = (typeof seqRow.seq === "bigint" ? Number(seqRow.seq) : seqRow.seq) + 1;
  db()
    .prepare(
      `INSERT INTO messages
        (id, session_id, seq, role, content, tool_calls, tool_call_id, tool_name, reasoning, attachments, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.sessionId,
      seq,
      input.role,
      input.content,
      input.toolCalls ? JSON.stringify(input.toolCalls) : null,
      input.toolCallId ?? null,
      input.toolName ?? null,
      input.reasoning ?? null,
      input.attachments && input.attachments.length > 0 ? JSON.stringify(input.attachments) : null,
      now,
    );
  db().prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, input.sessionId);
  const messages = listMessages(input.sessionId);
  const saved = messages.find((message) => message.id === id);
  if (!saved) throw new Error("Message was not saved.");
  return saved;
}

export function lastUserMessage(sessionId: string): StoredMessage | null {
  const users = listMessages(sessionId).filter((message) => message.role === "user");
  return users[users.length - 1] ?? null;
}

export function truncateAfter(sessionId: string, seq: number) {
  db().prepare("DELETE FROM messages WHERE session_id = ? AND seq > ?").run(sessionId, seq);
  db().prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(Date.now(), sessionId);
}

export function sessionMarkdown(session: SessionRecord, messages: StoredMessage[]): string {
  const lines = [`# ${session.title}`, "", `Model: ${session.model || "(default)"}`, ""];
  if (session.compactedSummary) {
    lines.push("## Compacted earlier context", "", session.compactedSummary, "");
  }
  for (const message of messages) {
    if (message.role === "user") {
      lines.push("## You", "", message.content || "(empty)");
      for (const attachment of message.attachments) {
        lines.push("", `### Attachment: ${attachment.name}`);
        if (attachment.kind === "text") lines.push("", attachment.text || "");
        else lines.push("", `_(image ${attachment.mediaType})_`);
      }
      lines.push("");
    } else if (message.role === "assistant") {
      lines.push("## Meridian", "");
      if (message.content.trim()) lines.push(message.content, "");
      for (const call of message.toolCalls ?? []) {
        lines.push(`Tool \`${call.name}\``, "", "```json", call.arguments || "{}", "```", "");
      }
    } else if (message.role === "tool") {
      lines.push(`### Result: ${message.toolName || "tool"}`, "", "```json", message.content, "```", "");
    } else if (message.role === "note") {
      lines.push(`> ${message.content.split("\n")[0]}`, "");
    }
  }
  return lines.join("\n");
}

export type SessionExport = {
  meridian: 1;
  exportedAt: number;
  session: {
    title: string;
    model: string;
    pinned: boolean;
    archived: boolean;
    compactedSummary: string | null;
    messages: Array<{
      role: StoredMessage["role"];
      content: string;
      toolCalls: ToolCallRecord[] | null;
      toolCallId: string | null;
      toolName: string | null;
      reasoning: string | null;
      attachments: Attachment[];
    }>;
  };
};

export function exportSession(id: string): SessionExport | null {
  const session = getSession(id);
  if (!session) return null;
  return {
    meridian: 1,
    exportedAt: Date.now(),
    session: {
      title: session.title,
      model: session.model,
      pinned: session.pinned,
      archived: false,
      compactedSummary: session.compactedSummary,
      messages: listMessages(id).map((message) => ({
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls,
        toolCallId: message.toolCallId,
        toolName: message.toolName,
        reasoning: message.reasoning,
        attachments: message.attachments,
      })),
    },
  };
}

export function importSession(payload: unknown): SessionRecord {
  if (!payload || typeof payload !== "object") throw new Error("Import must be a JSON object.");
  const root = payload as { meridian?: unknown; session?: unknown };
  if (root.meridian !== 1 || !root.session || typeof root.session !== "object") {
    throw new Error("This file is not a Meridian session export.");
  }
  const body = root.session as {
    title?: unknown;
    model?: unknown;
    pinned?: unknown;
    compactedSummary?: unknown;
    messages?: unknown;
  };
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : "Imported session";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!Array.isArray(body.messages)) throw new Error("Export is missing messages.");
  if (body.messages.length > 2000) throw new Error("Export has too many messages.");
  const created = createSession(model || undefined);
  updateSession(created.id, {
    title,
    model: model || created.model,
    pinned: body.pinned === true,
  });
  for (const item of body.messages) {
    if (!item || typeof item !== "object") throw new Error("A message in the export is invalid.");
    const message = item as Record<string, unknown>;
    const role = message.role;
    if (role !== "user" && role !== "assistant" && role !== "tool" && role !== "note") {
      throw new Error("A message has an unknown role.");
    }
    const content = typeof message.content === "string" ? message.content : "";
    let attachments: Attachment[] = [];
    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
      const incoming: IncomingAttachment[] = message.attachments.map((attachment) => {
        const record = attachment as Attachment;
        return record.kind === "image"
          ? { name: record.name, mediaType: record.mediaType, dataUrl: record.dataUrl }
          : { name: record.name, mediaType: record.mediaType, text: record.text ?? "" };
      });
      const prepared = prepareAttachments(incoming);
      if (!prepared.ok) throw new Error(prepared.error);
      attachments = prepared.attachments;
    }
    insertMessage({
      sessionId: created.id,
      role,
      content,
      toolCalls: Array.isArray(message.toolCalls) ? (message.toolCalls as ToolCallRecord[]) : null,
      toolCallId: typeof message.toolCallId === "string" ? message.toolCallId : null,
      toolName: typeof message.toolName === "string" ? message.toolName : null,
      reasoning: typeof message.reasoning === "string" ? message.reasoning : null,
      attachments,
    });
  }
  const saved = getSession(created.id);
  if (!saved) throw new Error("Imported session was not saved.");
  return saved;
}

export function modelVisibleUserText(content: string, attachments: Attachment[]): string {
  const note = attachmentNote(attachments);
  if (!note) return content;
  return `${content}\n\n${note}`;
}
