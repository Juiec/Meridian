import { describe, expect, it } from "vitest";

import { classifyUrl, isBlockedIp } from "@/lib/net";
import { executeTool } from "@/lib/tools";

describe("fetch guard", () => {
  it("blocks private, loopback, link-local, and non-http URLs", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("10.1.2.3")).toBe(true);
    expect(isBlockedIp("192.168.0.4")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("100.64.0.1")).toBe(true);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(classifyUrl("http://127.0.0.1/secret").ok).toBe(false);
    expect(classifyUrl("http://[::1]/").ok).toBe(false);
    expect(classifyUrl("file:///etc/passwd").ok).toBe(false);
    expect(classifyUrl("http://localhost/admin").ok).toBe(false);
    expect(classifyUrl("https://example.com/docs").ok).toBe(true);
    expect(classifyUrl("http://0177.0.0.1/").ok).toBe(false);
    expect(classifyUrl("http://0x7f000001/").ok).toBe(false);
  });

  it("refuses a loopback fetch before connecting", async () => {
    const result = await executeTool("fetch_url", JSON.stringify({ url: "http://127.0.0.1:9/secret" }));
    expect(result.ok).toBe(false);
    expect(String(result.error)).toMatch(/private|loopback|local/i);
  });
});
