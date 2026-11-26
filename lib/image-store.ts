import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { db } from "@/lib/db";
import { batchFileStamp, batchImageBaseName } from "@/lib/image-names";
import { imagesDir } from "@/lib/paths";

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GeneratedImage = {
  id: string;
  sessionId: string | null;
  sessionTitle: string | null;
  toolCallId: string | null;
  prompt: string;
  revisedPrompt: string | null;
  model: string;
  endpointId: string;
  size: string;
  fileName: string | null;
  mediaType: string;
  byteSize: number;
  source: "generate" | "edit";
  sourceUrl: string | null;
  createdAt: number;
  url: string;
};

type ImageRow = {
  id: string;
  session_id: string | null;
  session_title: string | null;
  tool_call_id: string | null;
  prompt: string;
  revised_prompt: string | null;
  model: string;
  endpoint_id: string;
  size: string;
  file_name: string | null;
  media_type: string;
  byte_size: number | bigint;
  source: "generate" | "edit";
  source_url: string | null;
  created_at: number | bigint;
};

const IMAGE_COLUMNS = `i.id, i.session_id, s.title AS session_title, i.tool_call_id, i.prompt,
  i.revised_prompt, i.model, i.endpoint_id, i.size, i.file_name, i.media_type,
  i.byte_size, i.source, i.source_url, i.created_at`;

function num(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function mapImage(row: ImageRow): GeneratedImage {
  return {
    id: row.id,
    sessionId: row.session_id,
    sessionTitle: row.session_title,
    toolCallId: row.tool_call_id,
    prompt: row.prompt,
    revisedPrompt: row.revised_prompt,
    model: row.model,
    endpointId: row.endpoint_id,
    size: row.size,
    fileName: row.file_name,
    mediaType: row.media_type,
    byteSize: num(row.byte_size),
    source: row.source,
    sourceUrl: row.source_url,
    createdAt: num(row.created_at),
    url: `/api/images/${row.id}`,
  };
}

export function imageExtension(mediaType: string): string {
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/webp") return "webp";
  if (mediaType === "image/gif") return "gif";
  if (mediaType === "image/png") return "png";
  return "bin";
}

export function detectImageMediaType(bytes: Buffer, fallback = "image/png"): string {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return fallback;
}

function writeBytesAtomic(file: string, bytes: Buffer) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, file);
}

const STORED_EXTENSIONS = ["png", "jpg", "webp", "gif", "bin"] as const;

function batchSlotTaken(stamp: string, index: number): boolean {
  const base = batchImageBaseName(stamp, index);
  return STORED_EXTENSIONS.some((ext) => existsSync(path.join(imagesDir(), `${base}.${ext}`)));
}

/** One stamp for a batch. If that second is already used, take the next free second. */
export function reserveBatchStamp(count: number, now = new Date()): string {
  const slots = Math.min(100, Math.max(1, Math.floor(count)));
  let cursor = now.getTime();
  for (let attempt = 0; attempt < 120; attempt++) {
    const stamp = batchFileStamp(new Date(cursor));
    let free = true;
    for (let index = 0; index < slots; index++) {
      if (batchSlotTaken(stamp, index)) {
        free = false;
        break;
      }
    }
    if (free) return stamp;
    cursor += 1000;
  }
  return batchFileStamp(new Date(cursor));
}

export function insertGeneratedImage(input: {
  bytes: Buffer | null;
  mediaType: string;
  prompt: string;
  revisedPrompt?: string | null;
  model: string;
  endpointId: string;
  size: string;
  sessionId?: string | null;
  toolCallId?: string | null;
  source?: "generate" | "edit";
  sourceUrl?: string | null;
  batchStamp?: string;
  batchIndex?: number;
}): GeneratedImage {
  const id = crypto.randomUUID();
  const fileName = input.bytes && input.bytes.length > 0
    ? `${batchImageBaseName(input.batchStamp ?? reserveBatchStamp(1), input.batchIndex ?? 0)}.${imageExtension(input.mediaType)}`
    : null;
  if (fileName && input.bytes) writeBytesAtomic(path.join(imagesDir(), fileName), input.bytes);
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO images
        (id, session_id, tool_call_id, prompt, revised_prompt, model, endpoint_id, size,
         file_name, media_type, byte_size, source, source_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.sessionId ?? null,
      input.toolCallId ?? null,
      input.prompt.slice(0, 32_000),
      input.revisedPrompt?.slice(0, 32_000) ?? null,
      input.model,
      input.endpointId,
      input.size,
      fileName,
      input.mediaType,
      input.bytes?.length ?? 0,
      input.source ?? "generate",
      input.sourceUrl ?? null,
      now,
    );
  const saved = getGeneratedImage(id);
  if (!saved) throw new Error("The image record was not saved.");
  return saved;
}

export function getGeneratedImage(id: string): GeneratedImage | null {
  if (!ID_RE.test(id)) return null;
  const row = db()
    .prepare(`SELECT ${IMAGE_COLUMNS} FROM images i LEFT JOIN sessions s ON s.id = i.session_id WHERE i.id = ?`)
    .get(id) as ImageRow | undefined;
  return row ? mapImage(row) : null;
}

export function imageFilePath(image: GeneratedImage): string | null {
  if (!image.fileName) return null;
  const file = path.resolve(imagesDir(), image.fileName);
  const root = path.resolve(imagesDir());
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return null;
  return file;
}

export function readImageBytes(image: GeneratedImage): Buffer | null {
  const file = imageFilePath(image);
  if (!file || !existsSync(/*turbopackIgnore: true*/ file)) return null;
  return readFileSync(/*turbopackIgnore: true*/ file);
}

export function listGeneratedImages(options?: { sessionId?: string; limit?: number }): GeneratedImage[] {
  const limit = Math.min(100, Math.max(1, Math.floor(options?.limit ?? 50)));
  const sessionId = options?.sessionId?.trim();
  const where = sessionId ? "WHERE i.session_id = ?" : "";
  const rows = db()
    .prepare(
      `SELECT ${IMAGE_COLUMNS} FROM images i LEFT JOIN sessions s ON s.id = i.session_id
       ${where} ORDER BY i.created_at DESC, i.id DESC LIMIT ?`,
    )
    .all(...(sessionId ? [sessionId] : []), limit) as ImageRow[];
  return rows.map(mapImage);
}

export function deleteImagesForSession(sessionId: string): number {
  const images = listGeneratedImages({ sessionId, limit: 100 });
  for (const image of images) {
    const file = imageFilePath(image);
    if (file && existsSync(/*turbopackIgnore: true*/ file)) unlinkSync(/*turbopackIgnore: true*/ file);
  }
  return Number(db().prepare("DELETE FROM images WHERE session_id = ?").run(sessionId).changes);
}
