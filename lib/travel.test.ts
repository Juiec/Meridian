import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "1.1.1.1", family: 4 }]),
}));

import { createTripPlan } from "@/lib/sessions";
import { makeHome } from "@/lib/test-home";
import { dayLinks, haversineKm, illustrativeQuotes, normalizeQuotes } from "@/lib/travel-math";
import type { TripPlace } from "@/lib/travel-types";
import { addTripPlace, saveTravelSettings, toPublicTravelSettings } from "@/lib/travel-store";
import { executeTravelTool } from "@/lib/travel";
import { TOOLS } from "@/lib/tools";

beforeEach(() => {
  makeHome();
});

function pin(name: string, day: number | null): TripPlace {
  return { id: name, name, lat: 60, lng: 24, kind: "destination", day, note: "" };
}

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
    const place = addTripPlace({ name: "Alfama", lat: 38.71, lng: -9.13, kind: "poi", day: 21 });
    expect(place.day).toBe(21);
    const listed = await executeTravelTool("travel_plan", { action: "list" });
    expect(listed.ok).toBe(true);
    expect(JSON.stringify(listed.places)).toContain(place.id);
    const names = TOOLS.map((tool) => tool.function.name);
    expect(names.filter((name) => name === "memory")).toEqual(["memory"]);
    expect(names).toContain("travel_prices");
    expect(new Set(names).size).toBe(names.length);
  });

  it("draws a flight hop as air and a city hop as ground", () => {
    const places: TripPlace[] = [
      pin("Helsinki", 1),
      pin("Market", 1),
      pin("Rovaniemi", 2),
      { ...pin("Flight HEL to CPH", 3), kind: "transit" },
      pin("Loose", null),
    ];
    const links = dayLinks(places);
    expect(links.map((link) => [link.from.name, link.to.name, link.air])).toEqual([
      ["Market", "Rovaniemi", false],
      ["Rovaniemi", "Flight HEL to CPH", true],
    ]);
  });

  it("keeps a new trip empty when the original already has places", async () => {
    const original = createTripPlan();
    addTripPlace({ name: "Helsinki", lat: 60.17, lng: 24.94 }, original.id);
    const next = createTripPlan();
    const fresh = await executeTravelTool("travel_plan", { action: "list" }, next.id);
    const kept = await executeTravelTool("travel_plan", { action: "list" }, original.id);
    expect(JSON.stringify(fresh.places)).not.toContain("Helsinki");
    expect(JSON.stringify(kept.places)).toContain("Helsinki");
  });

  it("geocodes through OpenStreetMap when Open-Meteo is unreachable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("geocoding-api.open-meteo.com")) throw new TypeError("fetch failed");
      if (url.includes("nominatim.openstreetmap.org")) {
        return Response.json([
          {
            name: "Nyhavn",
            display_name: "Nyhavn, Copenhagen, Denmark",
            lat: "55.6798",
            lon: "12.5912",
            address: { country: "Denmark" },
          },
        ]);
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const found = await executeTravelTool("travel_geocode", { query: "Nyhavn, København" });
    expect(found.ok).toBe(true);
    expect(found.text).toContain("Nyhavn");
    expect(JSON.stringify(found.results)).toContain("55.6798");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("nominatim.openstreetmap.org"))).toBe(true);
    vi.unstubAllGlobals();
  });
});
