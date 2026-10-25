const METADATA_HOSTS = new Set(["169.254.169.254", "metadata.google.internal", "metadata", "fd00:ec2::254"]);

export function isMetadataAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  return normalized === "169.254.169.254" || normalized === "fd00:ec2::254";
}

export function assertToolUrl(raw: string): URL {
  const text = raw.trim();
  if (!text || /[\s\\]/.test(text) || text.includes("\0")) {
    throw new Error("URL is not valid.");
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("URL is not valid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must be http or https.");
  }
  if (url.username || url.password) {
    throw new Error("URL must not include credentials. Put secrets in headers.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (METADATA_HOSTS.has(host) || host.endsWith(".metadata.google.internal") || isMetadataAddress(host)) {
    throw new Error("That host is blocked.");
  }
  return url;
}
