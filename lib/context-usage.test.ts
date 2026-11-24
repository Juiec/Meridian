import { beforeEach, describe, expect, it } from "vitest";

import { cleanSessionContext, measureSessionContext } from "@/lib/clean-context";
import { contextLimitFromModel } from "@/lib/lmstudio";
import { renderPlanContext, refineDayWindow } from "@/lib/context-usage";
import { buildApiMessages } from "@/lib/agent";
import { createSession, createTripPlan, getSession, insertMessage, listMessages } from "@/lib/sessions";
import { makeHome } from "@/lib/test-home";
import { addTripPlace } from "@/lib/travel-store";

beforeEach(() => {
  makeHome();
});

describe("context usage and cleaning", () => {
  it("reads a loaded context window before the model maximum", () => {
    expect(contextLimitFromModel({ loaded_context_length: 8192, max_context_length: 32768 })).toBe(8192);
    expect(contextLimitFromModel({ max_context_length: 32768 })).toBe(32768);
    expect(contextLimitFromModel({})).toBeNull();
  });

  it("keeps the day before and at most two days after", () => {
    expect(refineDayWindow(3)).toEqual([2, 3, 4, 5]);
    expect(refineDayWindow(1)).toEqual([1, 2, 3]);
    const places = [
      place("Cathedral", 2, "Start on the steps."),
      place("Market", 3, "Buy salmon."),
      place("Suomenlinna", 4, "Ferry out."),
      place("Porvoo", 5, "Old town walk."),
      place("Turku", 8, "Far day, leave it off."),
    ];
    const text = renderPlanContext(places, 3);
    expect(text).toContain("Buy salmon.");
    expect(text).toContain("Start on the steps.");
    expect(text).toContain("Ferry out.");
    expect(text).toContain("Old town walk.");
    expect(text).not.toContain("Far day, leave it off.");
    expect(text).toContain("day 8");
  });

  it("clears thinking and leaves the nearby plan in a trip chat", () => {
    const trip = createTripPlan();
    addTripPlace({ name: "Cathedral", lat: 60.17, lng: 24.95, kind: "poi", day: 2, note: "Start on the steps." }, trip.id);
    addTripPlace({ name: "Market", lat: 60.17, lng: 24.95, kind: "poi", day: 3, note: "Buy salmon." }, trip.id);
    addTripPlace({ name: "Fortress", lat: 60.14, lng: 24.98, kind: "poi", day: 4, note: "Ferry out." }, trip.id);
    addTripPlace({ name: "Turku", lat: 60.45, lng: 22.27, kind: "destination", day: 8, note: "Far day, leave it off." }, trip.id);
    insertMessage({ sessionId: trip.id, role: "user", content: "Plan every day, including Turku." });
    insertMessage({
      sessionId: trip.id,
      role: "assistant",
      content: "Here is the whole week, including the far day in Turku.",
      reasoning: "A long chain of thought about all eight days.",
    });

    const cleaned = cleanSessionContext(trip.id, 3);
    expect(cleaned.plan).toContain("Buy salmon.");
    expect(cleaned.plan).not.toContain("Far day, leave it off.");
    expect(cleaned.context.thinkingChars).toBe(0);
    expect(cleaned.context.tokens).toBeGreaterThan(0);
    expect(listMessages(trip.id).every((message) => message.reasoning === null)).toBe(true);

    const visible = buildApiMessages(trip.id)
      .map((message) => (typeof message.content === "string" ? message.content : ""))
      .join("\n");
    expect(visible).toContain("Buy salmon.");
    expect(visible).toContain("Start on the steps.");
    expect(visible).not.toContain("Far day, leave it off.");
    expect(visible).not.toContain("chain of thought");
    expect(visible).not.toContain("Plan every day");
  });

  it("clears thinking in a regular chat without folding the transcript", () => {
    const chat = createSession();
    insertMessage({ sessionId: chat.id, role: "user", content: "Remember the cedar desk." });
    insertMessage({
      sessionId: chat.id,
      role: "assistant",
      content: "The cedar desk stays.",
      reasoning: "secret thought",
    });
    const cleaned = cleanSessionContext(chat.id);
    expect(cleaned.plan).toBeNull();
    expect(cleaned.context.thinkingChars).toBe(0);
    expect(getSession(chat.id)?.compactedUntilSeq).toBeNull();
    expect(listMessages(chat.id).map((message) => message.content)).toEqual([
      "Remember the cedar desk.",
      "The cedar desk stays.",
    ]);
    expect(measureSessionContext(chat.id).historyChars).toBeGreaterThan(0);
  });
});

function place(name: string, day: number, note: string) {
  return {
    id: name,
    name,
    lat: 60,
    lng: 24,
    kind: "poi" as const,
    day,
    note,
  };
}
