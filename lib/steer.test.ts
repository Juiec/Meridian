import { beforeEach, describe, expect, it } from "vitest";

import { claimRun, completionSignal, drainSteers, finishRun, steerRun } from "@/lib/runs";

beforeEach(() => {
  finishRun("session-a");
  finishRun("session-b");
});

describe("steer queue", () => {
  it("interrupts the current completion and returns the steer once", async () => {
    const stop = claimRun("session-a");
    expect(stop).not.toBeNull();
    expect(claimRun("session-a")).toBeNull();
    const signal = completionSignal("session-a", stop?.signal);
    const aborted = new Promise<boolean>((resolve) => {
      signal.addEventListener("abort", () => resolve(true), { once: true });
    });

    expect(steerRun("session-a", "  Say pears.  ")).toEqual({ ok: true });
    expect(await aborted).toBe(true);
    expect(drainSteers("session-a")).toEqual(["Say pears."]);
    expect(drainSteers("session-a")).toEqual([]);

    const next = completionSignal("session-a", stop?.signal);
    expect(next.aborted).toBe(false);
    finishRun("session-a");
    expect(steerRun("session-a", "Again")).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses an empty steer and a steer with no running turn", () => {
    claimRun("session-b");
    expect(steerRun("session-b", "   ")).toMatchObject({ ok: false, status: 400 });
    finishRun("session-b");
    expect(steerRun("session-b", "Hello")).toMatchObject({ ok: false, status: 409 });
  });
});
