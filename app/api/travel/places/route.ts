import { connection } from "next/server";

import { caught, jsonError, readBody } from "@/lib/http";
import { geocodePlace, tripView } from "@/lib/travel";
import { addTripPlace, removeTripPlace, updateTripPlace } from "@/lib/travel-store";
import type { TripKind } from "@/lib/travel-types";

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export async function POST(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    let lat = num(body.lat);
    let lng = num(body.lng);
    let label = name;
    if (lat === null || lng === null) {
      if (!name) return jsonError("Enter a place name.");
      const found = await geocodePlace(name);
      if (!found.ok) return jsonError(found.error);
      lat = found.results[0].lat;
      lng = found.results[0].lng;
      label = found.results[0].label;
    }
    const kind = typeof body.kind === "string" ? (body.kind as TripKind) : "destination";
    addTripPlace({
      name: label,
      lat,
      lng,
      kind,
      day: body.day === undefined || body.day === "" || body.day === null ? null : num(body.day),
      note: typeof body.note === "string" ? body.note : "",
    });
    return Response.json(await tripView());
  } catch (err) {
    return caught(err, 400);
  }
}

export async function PATCH(request: Request) {
  await connection();
  const body = await readBody(request);
  if (body instanceof Response) return body;
  try {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return jsonError("Place id is required.");
    updateTripPlace(id, {
      day: body.day === undefined ? undefined : body.day === null || body.day === "" ? null : num(body.day),
      kind: typeof body.kind === "string" ? (body.kind as TripKind) : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
    });
    return Response.json(await tripView());
  } catch (err) {
    return caught(err, 400);
  }
}

export async function DELETE(request: Request) {
  await connection();
  try {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) return jsonError("Place id is required.");
    removeTripPlace(id);
    return Response.json(await tripView());
  } catch (err) {
    return caught(err, 400);
  }
}
