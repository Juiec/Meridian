import { describe, expect, it } from "vitest";

import { isTransientError, isTransientStatus, withNetworkRetries } from "@/lib/retry";

describe("network retries", () => {
  it("retries a 503 and then returns", async () => {
    let calls = 0;
    const value = await withNetworkRetries(async () => {
      calls += 1;
      if (calls < 3) {
        const error = new Error("busy");
        (error as Error & { status: number }).status = 503;
        throw error;
      }
      return "ok";
    }, { attempts: 3 });
    expect(value).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry a 400", async () => {
    let calls = 0;
    await expect(
      withNetworkRetries(async () => {
        calls += 1;
        const error = new Error("bad");
        (error as Error & { status: number }).status = 400;
        throw error;
      }),
    ).rejects.toThrow("bad");
    expect(calls).toBe(1);
    expect(isTransientStatus(503)).toBe(true);
    expect(isTransientError(new Error("nope"))).toBe(false);
  });
});