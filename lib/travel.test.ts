import { beforeEach, describe, expect, it } from "vitest";

import { makeHome } from "@/lib/test-home";
import { haversineKm, illustrativeQuotes, normalizeQuotes } from "@/lib/travel-math";
import { addTripPlace, saveTravelSettings, toPublicTravelSettings } from "@/lib/travel-store";
import { executeTravelTool } from "@/lib/travel";
import { TOOLS } from "@/lib/tools";

beforeEach(() => {
  makeHome();
});

describe("travel math and plan", () => {
  it("measures a long flight and labels illustrative quotes", () => {
    const km = haversineKm({ lat: 40.71, lng: -74 }, { lat: 38.72, lng: -9.14 });
    expect(km).toBeGreaterThan(5300);
    expect(km).toBeLessThan(5600);
    const quotes = illustrativeQuotes({
      from: "New York",
      to: "Lisbon",
      date: "2026-10-30",
      km,
      passengers: 2,
    });
    expect(quotes[0]?.mode).toBe("flight");
    expect(quotes[0]?.live).toBe(false);
    expect(quotes[0]?.note).toMatch(/not a live fare/i);
    expect(quotes[0]?.price).toBeGreaterThan(quotes[0] ? 0 : 1);
    expect(quotes.every((quote) => quote.link && !quote.link.includes("checkout"))).toBe(true);
    expect(quotes.some((quote) => quote.mode === "train")).toBe(false);
  });

  it("normalizes a custom provider payload and hides the stored key", () => {
    const quotes = normalizeQuotes(
      { quotes: [{ mode: "train", price: 40, currency: "EUR", live: false }] },
      { from: "Porto", to: "Lisbon", date: null },
    );
    expect(quotes[0]).toMatchObject({ mode: "train", price: 40, currency: "EUR", live: false, from: "Porto" });
    saveTravelSettings({ priceUrl: "https://fares.example.com/search", priceApiKey: "super-secret-key" });
    const pub = toPublicTravelSettings();
    expect(pub.provider).toBe("custom");
    expect(pub.priceKeyHint).toBe("••••-key");
    expect(JSON.stringify(pub)).not.toContain("super-secret-key");
    expect(() => saveTravelSettings({ priceUrl: "http://127.0.0.1/fares" })).toThrow(/local|private|loopback/i);
  });

  it("pins a place without replacing built-in tools", async () => {
    const place = addTripPlace({ name: "Alfama", lat: 38.71, lng: -9.13, kind: "poi", day: 1 });
    const listed = await executeTravelTool("travel_plan", { action: "list" });
    expect(listed.ok).toBe(true);
    expect(JSON.stringify(listed.places)).toContain(place.id);
    const names = TOOLS.map((tool) => tool.function.name);
    expect(names.filter((name) => name === "memory")).toEqual(["memory"]);
    expect(names).toContain("travel_prices");
    expect(new Set(names).size).toBe(names.length);
  });
});
