import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.internal",
]);

export function isBlockedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (net.isIP(mapped) === 4) return isBlockedIp(mapped);
  }
  if (net.isIP(normalized) === 6) {
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    return false;
  }
  if (net.isIP(normalized) !== 4) return false;
  const [a, b] = normalized.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

export function classifyUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "That is not a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "fetch_url only reads http and https URLs." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "URLs with embedded credentials are refused." };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return { ok: false, error: "URL is missing a host." };
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, error: "That host is local or internal. fetch_url only reads public pages." };
  }
  if (/^\d+$/.test(host) || host.includes("0x") || host.includes("%") || host.includes("\\")) {
    return { ok: false, error: "Numeric or encoded hostnames are blocked." };
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    const parts = host.split(".");
    if (parts.some((part) => part.length > 1 && part.startsWith("0"))) {
      return { ok: false, error: "Ambiguous numeric addresses are blocked." };
    }
  }
  if (net.isIP(host) && isBlockedIp(host)) {
    return { ok: false, error: "That address is private, loopback, or link-local." };
  }
  return { ok: true, url };
}

export async function explainUrlBlock(raw: string): Promise<string | null> {
  const classified = classifyUrl(raw);
  if (!classified.ok) return classified.error;
  const host = classified.url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return null;
  try {
    const records = await lookup(host, { all: true, verbatim: true });
    if (records.length === 0) return "DNS returned no addresses.";
    if (records.some((record) => isBlockedIp(record.address))) {
      return "That host resolves to a private or local address.";
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "DNS lookup failed";
    return `Could not resolve host: ${message}`;
  }
  return null;
}
