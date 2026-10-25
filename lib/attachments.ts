import { randomUUID } from "node:crypto";

import type { Attachment } from "@/lib/types";

const MAX_FILES = 4;
const MAX_TEXT_CHARS = 80_000;
const MAX_IMAGE_CHARS = 1_200_000;
const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/css",
  "text/html",
  "text/csv",
  "text/javascript",
  "text/x-python",
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/xml",
]);
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const SECRET_NAME =
  /(^|[\\/])\.env($|\.)|(^|[\\/])id_rsa($|\.)|\.pem$|(^|[\\/])\.npmrc$|(^|[\\/])\.netrc$|credentials|secrets?\.(json|ya?ml|txt|env)$/i;

export type IncomingAttachment = {
  name?: unknown;
  mediaType?: unknown;
  text?: unknown;
  dataUrl?: unknown;
};

export function isSecretFilename(name: string): boolean {
  const base = name.trim().replace(/\\/g, "/").split("/").pop() || name;
  return SECRET_NAME.test(base) || base.startsWith(".env");
}

export function looksLikeEnvFile(name: string, text: string): boolean {
  if (isSecretFilename(name)) return true;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (lines.length < 2) return false;
  const assigns = lines.filter((line) => /^[A-Z][A-Z0-9_]{2,}=/.test(line));
  return assigns.length >= 2 && assigns.length / lines.length >= 0.6;
}

function mediaTypeFor(name: string, given: string): string {
  const type = given.toLowerCase().split(";")[0].trim();
  if (type && type !== "application/octet-stream") return type;
  const ext = name.toLowerCase().split(".").pop() || "";
  const byExt: Record<string, string> = {
    md: "text/markdown",
    markdown: "text/markdown",
    txt: "text/plain",
    json: "application/json",
    js: "text/javascript",
    jsx: "text/javascript",
    ts: "application/typescript",
    tsx: "application/typescript",
    py: "text/x-python",
    css: "text/css",
    html: "text/html",
    csv: "text/csv",
    xml: "application/xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  return byExt[ext] || type || "application/octet-stream";
}

function parseImage(dataUrl: string, mediaType: string): string | null {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const declared = match[1].toLowerCase();
  if (!IMAGE_TYPES.has(declared) || declared !== mediaType) return null;
  const payload = match[2].replace(/\s/g, "");
  if (!payload || payload.length > MAX_IMAGE_CHARS) return null;
  return `data:${declared};base64,${payload}`;
}

export function prepareAttachments(input: IncomingAttachment[]): { ok: true; attachments: Attachment[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "Attachments must be a list." };
  if (input.length > MAX_FILES) return { ok: false, error: `Attach at most ${MAX_FILES} files.` };
  const attachments: Attachment[] = [];
  for (const item of input) {
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name || name.length > 180 || name.includes("\0") || name.includes("/") || name.includes("\\")) {
      return { ok: false, error: "Each attachment needs a plain file name." };
    }
    if (isSecretFilename(name)) {
      return { ok: false, error: `${name} looks like a secret file. It was not attached.` };
    }
    const mediaType = mediaTypeFor(name, typeof item.mediaType === "string" ? item.mediaType : "");
    if (typeof item.text === "string") {
      if (looksLikeEnvFile(name, item.text)) {
        return { ok: false, error: `${name} looks like an environment file. It was not attached.` };
      }
      if (item.text.length > MAX_TEXT_CHARS) {
        return { ok: false, error: `${name} is ${item.text.length} characters. The limit is ${MAX_TEXT_CHARS}.` };
      }
      if (!TEXT_TYPES.has(mediaType) && !mediaType.startsWith("text/")) {
        return { ok: false, error: `${name} is not a text file Meridian can attach.` };
      }
      attachments.push({
        id: randomUUID(),
        name,
        mediaType,
        kind: "text",
        text: item.text,
      });
      continue;
    }
    if (typeof item.dataUrl === "string") {
      if (!IMAGE_TYPES.has(mediaType)) {
        return { ok: false, error: `${name} is not a PNG, JPEG, GIF, or WebP image.` };
      }
      const dataUrl = parseImage(item.dataUrl, mediaType);
      if (!dataUrl) {
        return {
          ok: false,
          error: `${name} is not a valid image, or it is larger than the attachment limit.`,
        };
      }
      attachments.push({ id: randomUUID(), name, mediaType, kind: "image", dataUrl });
      continue;
    }
    return { ok: false, error: `${name} has no text or image data.` };
  }
  return { ok: true, attachments };
}

export function parseStoredAttachments(raw: string | null): Attachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Attachment[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.name === "string" && (item.kind === "text" || item.kind === "image"));
  } catch {
    return [];
  }
}

export function attachmentNote(attachments: Attachment[]): string {
  if (attachments.length === 0) return "";
  const blocks = attachments.map((item) => {
    if (item.kind === "text") {
      return `[Attached file ${item.name}]\n${item.text ?? ""}`;
    }
    return `[Attached image ${item.name}]`;
  });
  return blocks.join("\n\n");
}
