import { htmlToText } from "@/lib/html-text";
import { explainUrlBlock } from "@/lib/net";

const MAX_BYTES = 180_000;
const MAX_CHARS = 12_000;
const TIMEOUT_MS = 8_000;

export type FetchUrlResult =
  | { ok: true; url: string; contentType: string; text: string; truncated: boolean }
  | { ok: false; error: string };

async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    return {
      bytes: buffer.slice(0, maxBytes),
      truncated: buffer.byteLength > maxBytes,
    };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > maxBytes) {
      chunks.push(value.slice(0, maxBytes - total));
      truncated = true;
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

export async function fetchPublicUrl(raw: string): Promise<FetchUrlResult> {
  let current = raw.trim();
  for (let hop = 0; hop < 3; hop += 1) {
    const blocked = await explainUrlBlock(current);
    if (blocked) return { ok: false, error: blocked };
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          Accept: "text/html, text/plain, application/json, application/xml;q=0.8",
          "User-Agent": "Meridian/0.1",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "request failed";
      return { ok: false, error: `Fetch failed: ${message}` };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { ok: false, error: "Redirect had no Location header." };
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) return { ok: false, error: `Fetch failed with HTTP ${response.status}.` };
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !/text\/|application\/(json|xml|xhtml\+xml)/i.test(contentType)) {
      return { ok: false, error: `Refusing content type ${contentType}. fetch_url only reads text.` };
    }
    const body = await readLimited(response, MAX_BYTES);
    let text = new TextDecoder().decode(body.bytes);
    if (/html/i.test(contentType) || text.trimStart().startsWith("<")) text = htmlToText(text);
    let truncated = body.truncated;
    if (text.length > MAX_CHARS) {
      text = `${text.slice(0, MAX_CHARS)}\n[truncated]`;
      truncated = true;
    }
    return { ok: true, url: current, contentType, text, truncated };
  }
  return { ok: false, error: "Too many redirects." };
}
