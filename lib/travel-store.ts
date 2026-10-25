import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { writeAtomic } from "@/lib/atomic";
import { travelPlanPath, travelSettingsPath } from "@/lib/paths";
import { classifyUrl } from "@/lib/net";
import type { TravelPublicSettings, TripKind, TripPlace } from "@/lib/travel-types";

const KINDS = new Set<TripKind>(["destination", "stay", "poi", "transit"]);
const MAX_PLACES = 40;

type SettingsFile = {
  priceUrl?: string;
  priceApiKey?: string;
};

function readPlan(): TripPlace[] {
  const file = travelPlanPath();
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { places?: TripPlace[] };
  if (!parsed || !Array.isArray(parsed.places)) throw new Error("Trip plan file is not valid.");
  return parsed.places.filter((place) => place && typeof place.id === "string" && typeof place.name === "string");
}

function writePlan(places: TripPlace[]) {
  writeAtomic(travelPlanPath(), `${JSON.stringify({ places }, null, 2)}\n`);
}

export function listTripPlaces(): TripPlace[] {
  return readPlan();
}

export function addTripPlace(input: {
  name: string;
  lat: number;
  lng: number;
  kind?: TripKind;
  day?: number | null;
  note?: string;
}): TripPlace {
  const places = readPlan();
  if (places.length >= MAX_PLACES) throw new Error("The trip map is full (40 places). Remove one first.");
  const name = input.name.trim();
  if (!name || name.length > 120) throw new Error("Place name must be 1–120 characters.");
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) throw new Error("Coordinates are not valid.");
  if (Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) throw new Error("Coordinates are out of range.");
  const kind = input.kind && KINDS.has(input.kind) ? input.kind : "destination";
  const day = input.day === null || input.day === undefined ? null : input.day;
  if (day !== null && (!Number.isInteger(day) || day < 1 || day > 14)) throw new Error("Day must be from 1 to 14.");
  const place: TripPlace = {
    id: randomUUID(),
    name,
    lat: Math.round(input.lat * 1e5) / 1e5,
    lng: Math.round(input.lng * 1e5) / 1e5,
    kind,
    day,
    note: (input.note ?? "").trim().slice(0, 280),
  };
  places.push(place);
  writePlan(places);
  return place;
}

export function updateTripPlace(id: string, patch: { day?: number | null; kind?: TripKind; note?: string }): TripPlace {
  const places = readPlan();
  const index = places.findIndex((place) => place.id === id);
  if (index < 0) throw new Error("That place is not on the trip.");
  const current = places[index];
  if (patch.day !== undefined) {
    if (patch.day !== null && (!Number.isInteger(patch.day) || patch.day < 1 || patch.day > 14)) {
      throw new Error("Day must be from 1 to 14.");
    }
    current.day = patch.day;
  }
  if (patch.kind !== undefined) {
    if (!KINDS.has(patch.kind)) throw new Error("Kind must be destination, stay, poi, or transit.");
    current.kind = patch.kind;
  }
  if (patch.note !== undefined) current.note = patch.note.trim().slice(0, 280);
  places[index] = current;
  writePlan(places);
  return current;
}

export function removeTripPlace(id: string) {
  const places = readPlan();
  const next = places.filter((place) => place.id !== id);
  if (next.length === places.length) throw new Error("That place is not on the trip.");
  writePlan(next);
}

function readSettingsFile(): SettingsFile | null {
  const file = travelSettingsPath();
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, "utf8")) as SettingsFile;
  if (!parsed || typeof parsed !== "object") return null;
  return parsed;
}

export function getTravelSettings(): { priceUrl: string; priceApiKey: string } {
  const file = readSettingsFile();
  const priceUrl = file && "priceUrl" in file ? (file.priceUrl ?? "").trim() : (process.env.TRAVEL_PRICE_URL ?? "").trim();
  const priceApiKey = file && "priceApiKey" in file ? (file.priceApiKey ?? "") : (process.env.TRAVEL_PRICE_API_KEY ?? "");
  return { priceUrl, priceApiKey };
}

export function toPublicTravelSettings(settings = getTravelSettings()): TravelPublicSettings {
  const hint = settings.priceApiKey ? `••••${settings.priceApiKey.slice(-4)}` : null;
  return {
    priceUrl: settings.priceUrl,
    priceKeySet: settings.priceApiKey.length > 0,
    priceKeyHint: hint,
    provider: settings.priceUrl ? "custom" : "illustrative",
  };
}

export function saveTravelSettings(input: { priceUrl?: string; priceApiKey?: string }): TravelPublicSettings {
  const current = getTravelSettings();
  let priceUrl = input.priceUrl !== undefined ? input.priceUrl.trim() : current.priceUrl;
  if (priceUrl) {
    const classified = classifyUrl(priceUrl);
    if (!classified.ok) throw new Error(classified.error);
    priceUrl = classified.url.toString();
  }
  const priceApiKey = input.priceApiKey !== undefined ? input.priceApiKey : current.priceApiKey;
  writeAtomic(travelSettingsPath(), `${JSON.stringify({ priceUrl, priceApiKey }, null, 2)}\n`);
  return toPublicTravelSettings({ priceUrl, priceApiKey });
}
