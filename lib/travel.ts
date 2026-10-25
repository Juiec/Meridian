import { messageOf } from "@/lib/errors";
import { classifyUrl, explainUrlBlock } from "@/lib/net";
import { haversineKm, illustrativeQuotes, normalizeQuotes, straightLegs } from "@/lib/travel-math";
import {
  addTripPlace,
  getTravelSettings,
  listTripPlaces,
  removeTripPlace,
  toPublicTravelSettings,
  updateTripPlace,
} from "@/lib/travel-store";
import type { FareQuote, GeoHit, TripKind, TripLeg } from "@/lib/travel-types";

const UA = "MeridianTravel/0.1 (local personal agent)";
const HOSTS = {
  geocode: "geocoding-api.open-meteo.com",
  weather: "api.open-meteo.com",
  nominatim: "nominatim.openstreetmap.org",
  osrm: "router.project-osrm.org",
} as const;

let nominatimAt = 0;
let nominatimChain: Promise<void> = Promise.resolve();

async function fetchTravelJson(url: string, host: string): Promise<unknown> {
  const classified = classifyUrl(url);
  if (!classified.ok) throw new Error(classified.error);
  if (classified.url.hostname !== host) throw new Error("That host is not used for travel lookups.");
  const blocked = await explainUrlBlock(classified.url.toString());
  if (blocked) throw new Error(blocked);
  const response = await fetch(classified.url, {
    headers: {
      accept: "application/json",
      "user-agent": UA,
      referer: "http://127.0.0.1:43123/",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status >= 300 && response.status < 400) throw new Error("Travel lookups do not follow redirects.");
  if (!response.ok) throw new Error(`Travel data returned HTTP ${response.status}.`);
  const text = await response.text();
  if (text.length > 400_000) throw new Error("Travel data response was too large.");
  return JSON.parse(text) as unknown;
}

function nominatim<T>(fn: () => Promise<T>): Promise<T> {
  const run = nominatimChain.then(async () => {
    const wait = 1100 - (Date.now() - nominatimAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    nominatimAt = Date.now();
    return fn();
  });
  nominatimChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function geocodePlace(query: string): Promise<{ ok: true; results: GeoHit[] } | { ok: false; error: string }> {
  const q = query.trim();
  if (!q || q.length > 120) return { ok: false, error: "Query must be 1–120 characters." };
  try {
    const url = `https://${HOSTS.geocode}/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
    const payload = (await fetchTravelJson(url, HOSTS.geocode)) as {
      results?: { name?: string; country?: string; admin1?: string; latitude?: number; longitude?: number }[];
    };
    const results: GeoHit[] = (payload.results ?? [])
      .filter((item) => typeof item.latitude === "number" && typeof item.longitude === "number" && item.name)
      .slice(0, 5)
      .map((item) => {
        const parts = [item.name, item.admin1, item.country].filter((part) => part && part !== item.name);
        return {
          name: item.name ?? q,
          label: [item.name, ...parts].filter(Boolean).join(", "),
          lat: item.latitude as number,
          lng: item.longitude as number,
          country: item.country ?? null,
        };
      });
    if (results.length === 0) return { ok: false, error: `No geocoding match for “${q}”.` };
    return { ok: true, results };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

function weatherPhrase(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "partly cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "showers";
  if (code >= 95) return "thunderstorms";
  return "mixed";
}

async function resolvePoint(input: { place?: string; lat?: number | null; lng?: number | null }): Promise<GeoHit> {
  if (input.lat !== null && input.lat !== undefined && input.lng !== null && input.lng !== undefined) {
    return { name: input.place || "Point", label: input.place || "Point", lat: input.lat, lng: input.lng, country: null };
  }
  if (!input.place) throw new Error("Pass a place name or lat and lng.");
  const found = await geocodePlace(input.place);
  if (!found.ok) throw new Error(found.error);
  return found.results[0];
}

export async function weatherSummary(input: { place?: string; lat?: number | null; lng?: number | null }): Promise<Record<string, unknown>> {
  try {
    const point = await resolvePoint(input);
    const url =
      `https://${HOSTS.weather}/v1/forecast?latitude=${point.lat}&longitude=${point.lng}` +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=auto";
    const payload = (await fetchTravelJson(url, HOSTS.weather)) as {
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_sum?: number[];
      };
    };
    const daily = payload.daily;
    const days = (daily?.time ?? []).slice(0, 7).map((date, index) => ({
      date,
      summary: weatherPhrase(daily?.weather_code?.[index] ?? -1),
      highC: daily?.temperature_2m_max?.[index] ?? null,
      lowC: daily?.temperature_2m_min?.[index] ?? null,
      precipMm: daily?.precipitation_sum?.[index] ?? null,
    }));
    if (days.length === 0) return { ok: false, error: "Weather service returned no days.", text: "No forecast days." };
    const first = days[0];
    const text = `${point.label}: ${first.summary}, ${first.lowC}–${first.highC}°C on ${first.date}. Forecast covers ${days[0].date} to ${days[days.length - 1].date}.`;
    return { ok: true, text, place: point, days };
  } catch (err) {
    const error = messageOf(err);
    return { ok: false, error, text: error };
  }
}

export async function nearbyPlaces(input: {
  place?: string;
  lat?: number | null;
  lng?: number | null;
  query?: string;
}): Promise<Record<string, unknown>> {
  try {
    const point = await resolvePoint(input);
    const query = (input.query || "attraction").trim().slice(0, 60);
    const delta = 0.06;
    const viewbox = `${point.lng - delta},${point.lat + delta},${point.lng + delta},${point.lat - delta}`;
    const url =
      `https://${HOSTS.nominatim}/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=6&bounded=1&viewbox=${viewbox}`;
    const payload = (await nominatim(() => fetchTravelJson(url, HOSTS.nominatim))) as {
      name?: string;
      display_name?: string;
      lat?: string;
      lon?: string;
      type?: string;
    }[];
    const places = (Array.isArray(payload) ? payload : [])
      .map((item) => ({
        name: item.name || item.display_name || query,
        label: item.display_name || item.name || query,
        lat: Number(item.lat),
        lng: Number(item.lon),
        type: item.type || null,
      }))
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
    const text =
      places.length === 0
        ? `No OpenStreetMap matches for “${query}” near ${point.label}.`
        : `${places.length} “${query}” near ${point.label}. First: ${places[0].name}.`;
    return { ok: true, text, around: point, query, places };
  } catch (err) {
    const error = messageOf(err);
    return { ok: false, error, text: error };
  }
}

async function osrmLeg(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  profile: "driving" | "foot",
): Promise<{ roadKm: number; minutes: number } | null> {
  try {
    const url =
      `https://${HOSTS.osrm}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const payload = (await fetchTravelJson(url, HOSTS.osrm)) as {
      code?: string;
      routes?: { distance?: number; duration?: number }[];
    };
    const route = payload.routes?.[0];
    if (payload.code !== "Ok" || !route?.distance || !route.duration) return null;
    return { roadKm: Math.round((route.distance / 1000) * 10) / 10, minutes: Math.round(route.duration / 60) };
  } catch {
    return null;
  }
}

export async function routeBetween(input: {
  from?: string;
  to?: string;
  fromLat?: number | null;
  fromLng?: number | null;
  toLat?: number | null;
  toLng?: number | null;
  profile?: string;
}): Promise<Record<string, unknown>> {
  try {
    const profile = input.profile === "foot" ? "foot" : "driving";
    const start = await resolvePoint({ place: input.from, lat: input.fromLat, lng: input.fromLng });
    const end = await resolvePoint({ place: input.to, lat: input.toLat, lng: input.toLng });
    const straight = Math.round(haversineKm(start, end) * 10) / 10;
    const road = await osrmLeg(start, end, profile);
    const text = road
      ? `${start.label} → ${end.label}: about ${road.minutes} min, ${road.roadKm} km by ${profile}. Straight line ${straight} km.`
      : `${start.label} → ${end.label}: routing unavailable. Straight line ${straight} km.`;
    return { ok: true, text, from: start, to: end, profile, straightKm: straight, roadKm: road?.roadKm ?? null, minutes: road?.minutes ?? null };
  } catch (err) {
    const error = messageOf(err);
    return { ok: false, error, text: error };
  }
}

function quoteText(quotes: FareQuote[], provider: string): string {
  const first = quotes[0];
  if (!first) return "No quotes.";
  const live = first.live ? "Live quote" : "Illustrative";
  return `${live} ${first.mode} ${first.from} → ${first.to}: ${first.price} ${first.currency}. Provider ${provider}. Not a booking.`;
}

export async function checkFares(input: {
  from?: string;
  to?: string;
  date?: string | null;
  passengers?: number | null;
}): Promise<Record<string, unknown>> {
  const from = textOf(input.from);
  const to = textOf(input.to);
  if (!from || !to) return { ok: false, error: "Prices need from and to.", text: "Prices need from and to." };
  const date = textOf(input.date);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Date must be YYYY-MM-DD.", text: "Date must be YYYY-MM-DD." };
  }
  const passengers = Math.min(9, Math.max(1, Math.round(input.passengers ?? 1)));
  const settings = getTravelSettings();
  try {
    if (settings.priceUrl) {
      const blocked = await explainUrlBlock(settings.priceUrl);
      if (blocked) return { ok: false, error: blocked, text: blocked };
      const response = await fetch(settings.priceUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": UA,
          ...(settings.priceApiKey ? { authorization: `Bearer ${settings.priceApiKey}` } : {}),
        },
        body: JSON.stringify({ from, to, date: date || null, passengers }),
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      });
      if (response.status >= 300 && response.status < 400) {
        return { ok: false, error: "The price URL redirected. Refusing to follow it.", text: "The price URL redirected." };
      }
      if (!response.ok) {
        const error = `Price provider returned HTTP ${response.status}.`;
        return { ok: false, error, text: error };
      }
      const payload = JSON.parse((await response.text()).slice(0, 100_000)) as unknown;
      const quotes = normalizeQuotes(payload, { from, to, date: date || null });
      return { ok: true, text: quoteText(quotes, "custom"), provider: "custom", live: quotes.some((quote) => quote.live), quotes };
    }
    const origin = await geocodePlace(from);
    if (!origin.ok) return { ok: false, error: origin.error, text: origin.error };
    const dest = await geocodePlace(to);
    if (!dest.ok) return { ok: false, error: dest.error, text: dest.error };
    const km = haversineKm(origin.results[0], dest.results[0]);
    if (km < 1) return { ok: false, error: "Those two places are the same point.", text: "Those two places are the same point." };
    const quotes = illustrativeQuotes({
      from: origin.results[0].label,
      to: dest.results[0].label,
      date: date || null,
      km,
      passengers,
    });
    return {
      ok: true,
      text: quoteText(quotes, "illustrative"),
      provider: "illustrative",
      live: false,
      km: Math.round(km),
      quotes,
    };
  } catch (err) {
    const error = messageOf(err);
    return { ok: false, error, text: error };
  }
}

export async function enrichLegs(places = listTripPlaces()): Promise<TripLeg[]> {
  const legs = straightLegs(places);
  const enriched = await Promise.all(
    legs.slice(0, 8).map(async (leg) => {
      const from = places.find((place) => place.id === leg.fromId);
      const to = places.find((place) => place.id === leg.toId);
      if (!from || !to) return leg;
      const road = await osrmLeg(from, to, "driving");
      return road ? { ...leg, roadKm: road.roadKm, minutes: road.minutes } : leg;
    }),
  );
  return [...enriched, ...legs.slice(8)];
}

export async function tripView() {
  const places = listTripPlaces();
  const legs = await enrichLegs(places);
  return { places, legs, settings: toPublicTravelSettings() };
}

export async function executeTravelTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (name === "travel_geocode") {
    const found = await geocodePlace(textOf(args.query));
    if (!found.ok) return { ok: false, error: found.error, text: found.error };
    const top = found.results[0];
    return { ok: true, text: `${top.label} · ${top.lat.toFixed(2)}, ${top.lng.toFixed(2)}`, results: found.results };
  }
  if (name === "travel_weather") {
    return weatherSummary({ place: textOf(args.place) || undefined, lat: num(args.lat), lng: num(args.lng) });
  }
  if (name === "travel_places") {
    return nearbyPlaces({
      place: textOf(args.place) || undefined,
      lat: num(args.lat),
      lng: num(args.lng),
      query: textOf(args.query) || undefined,
    });
  }
  if (name === "travel_route") {
    return routeBetween({
      from: textOf(args.from) || undefined,
      to: textOf(args.to) || undefined,
      fromLat: num(args.fromLat),
      fromLng: num(args.fromLng),
      toLat: num(args.toLat),
      toLng: num(args.toLng),
      profile: textOf(args.profile) || undefined,
    });
  }
  if (name === "travel_prices") {
    return checkFares({
      from: textOf(args.from),
      to: textOf(args.to),
      date: textOf(args.date) || null,
      passengers: num(args.passengers),
    });
  }
  if (name === "travel_plan") {
    return planAction(args);
  }
  return { ok: false, error: `Unknown travel tool ${name}.`, text: `Unknown travel tool ${name}.` };
}

async function planAction(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = textOf(args.action);
  try {
    if (action === "list") {
      const places = listTripPlaces();
      return { ok: true, text: places.length ? `${places.length} places on the map.` : "The trip map is empty.", places };
    }
    if (action === "remove") {
      const id = textOf(args.id);
      if (!id) return { ok: false, error: "Remove needs id.", text: "Remove needs id." };
      removeTripPlace(id);
      return { ok: true, text: "Removed from the map.", places: listTripPlaces() };
    }
    if (action === "update") {
      const id = textOf(args.id);
      if (!id) return { ok: false, error: "Update needs id.", text: "Update needs id." };
      const kind = textOf(args.kind);
      const place = updateTripPlace(id, {
        day: args.day === undefined ? undefined : num(args.day),
        kind: kind ? (kind as TripKind) : undefined,
        note: args.note === undefined ? undefined : textOf(args.note),
      });
      return { ok: true, text: `Updated ${place.name}.`, place };
    }
    if (action === "add") {
      let lat = num(args.lat);
      let lng = num(args.lng);
      let name = textOf(args.name);
      if ((lat === null || lng === null) && name) {
        const found = await geocodePlace(name);
        if (!found.ok) return { ok: false, error: found.error, text: found.error };
        lat = found.results[0].lat;
        lng = found.results[0].lng;
        name = found.results[0].label;
      }
      if (!name || lat === null || lng === null) {
        return { ok: false, error: "Add needs a name or coordinates.", text: "Add needs a name or coordinates." };
      }
      const kind = textOf(args.kind) as TripKind;
      const place = addTripPlace({
        name,
        lat,
        lng,
        kind: kind || "destination",
        day: args.day === undefined ? null : num(args.day),
        note: textOf(args.note),
      });
      return { ok: true, text: `Pinned ${place.name}${place.day ? ` on day ${place.day}` : ""}.`, place };
    }
    return { ok: false, error: "Action must be list, add, remove, or update.", text: "Unknown plan action." };
  } catch (err) {
    const error = messageOf(err);
    return { ok: false, error, text: error };
  }
}
