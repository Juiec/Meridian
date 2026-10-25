import type { FareQuote, TripLeg, TripPlace } from "@/lib/travel-types";

const EARTH_KM = 6371;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function roundFare(amount: number): number {
  return Math.max(15, Math.round(amount / 5) * 5);
}

function searchLink(mode: FareQuote["mode"], from: string, to: string, date: string | null): string {
  if (mode === "flight") {
    const q = date ? `Flights from ${from} to ${to} on ${date}` : `Flights from ${from} to ${to}`;
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
  }
  return `https://www.rome2rio.com/map/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
}

const ILLUSTRATIVE =
  "Illustrative distance quote, not a live fare. Meridian does not book or take payment.";

export function illustrativeQuotes(input: {
  from: string;
  to: string;
  date: string | null;
  km: number;
  passengers: number;
}): FareQuote[] {
  const people = input.passengers;
  const km = input.km;
  const flight = roundFare(40 + km * 0.09) * people;
  const quotes: FareQuote[] = [
    {
      mode: "flight",
      from: input.from,
      to: input.to,
      date: input.date,
      price: flight,
      currency: "USD",
      carrier: null,
      link: searchLink("flight", input.from, input.to, input.date),
      live: false,
      note: ILLUSTRATIVE,
    },
  ];
  if (km <= 1500) {
    quotes.push({
      mode: "train",
      from: input.from,
      to: input.to,
      date: input.date,
      price: roundFare(12 + km * 0.11) * people,
      currency: "USD",
      carrier: null,
      link: searchLink("train", input.from, input.to, input.date),
      live: false,
      note: ILLUSTRATIVE,
    });
  }
  if (km <= 900) {
    quotes.push({
      mode: "bus",
      from: input.from,
      to: input.to,
      date: input.date,
      price: roundFare(8 + km * 0.06) * people,
      currency: "USD",
      carrier: null,
      link: searchLink("bus", input.from, input.to, input.date),
      live: false,
      note: ILLUSTRATIVE,
    });
  }
  return quotes;
}

export function normalizeQuotes(
  value: unknown,
  fallback: { from: string; to: string; date: string | null },
): FareQuote[] {
  if (!value || typeof value !== "object") throw new Error("Price provider returned data that is not JSON.");
  const record = value as { quotes?: unknown; price?: unknown; currency?: unknown; link?: unknown; live?: unknown; mode?: unknown; carrier?: unknown };
  const rows = Array.isArray(record.quotes) ? record.quotes : [record];
  const quotes: FareQuote[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const price = typeof item.price === "number" ? item.price : Number(item.price);
    if (!Number.isFinite(price)) continue;
    const mode = item.mode === "train" || item.mode === "bus" || item.mode === "flight" ? item.mode : "flight";
    quotes.push({
      mode,
      from: typeof item.from === "string" && item.from.trim() ? item.from.trim() : fallback.from,
      to: typeof item.to === "string" && item.to.trim() ? item.to.trim() : fallback.to,
      date: typeof item.date === "string" && item.date.trim() ? item.date.trim() : fallback.date,
      price: Math.round(price * 100) / 100,
      currency: typeof item.currency === "string" && item.currency.trim() ? item.currency.trim().slice(0, 8) : "USD",
      carrier: typeof item.carrier === "string" && item.carrier.trim() ? item.carrier.trim().slice(0, 80) : null,
      link: typeof item.link === "string" && /^https?:\/\//i.test(item.link) ? item.link : null,
      live: item.live === true,
      note:
        item.live === true
          ? "Quote from the configured price URL. Meridian did not book or take payment."
          : "Quote from the configured price URL. Not marked live. Meridian did not book or take payment.",
    });
    if (quotes.length >= 8) break;
  }
  if (quotes.length === 0) throw new Error("Price provider returned no numeric quotes.");
  return quotes;
}

export function groupPlaces(places: TripPlace[]): { day: number | null; places: TripPlace[] }[] {
  const groups = new Map<string, TripPlace[]>();
  for (const place of places) {
    const key = place.day === null ? "none" : String(place.day);
    const list = groups.get(key) ?? [];
    list.push(place);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => {
      if (a[0] === "none") return 1;
      if (b[0] === "none") return -1;
      return Number(a[0]) - Number(b[0]);
    })
    .map(([key, list]) => ({ day: key === "none" ? null : Number(key), places: list }));
}

export function straightLegs(places: TripPlace[]): TripLeg[] {
  const legs: TripLeg[] = [];
  for (const group of groupPlaces(places)) {
    for (let i = 1; i < group.places.length; i += 1) {
      const from = group.places[i - 1];
      const to = group.places[i];
      legs.push({
        fromId: from.id,
        toId: to.id,
        fromName: from.name,
        toName: to.name,
        day: group.day,
        km: Math.round(haversineKm(from, to) * 10) / 10,
        roadKm: null,
        minutes: null,
      });
    }
  }
  return legs;
}
