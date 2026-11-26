"use client";

import type { LivePart } from "@/components/transcript";
import type { ToolPart } from "@/lib/group-messages";
import type { SessionRecord, StoredMessage } from "@/lib/types";

export type FlightLive = { parts: LivePart[]; status: string };

/** A turn that keeps running after the chat leaves the screen. */
export type Flight = {
  sessionId: string;
  messages: StoredMessage[];
  live: FlightLive | null;
  status: string | null;
  running: boolean;
  streamError: string | null;
  streamedQuestion: ToolPart | null;
  detail: SessionRecord | null;
  abort: AbortController;
  /** Identifies this turn so the thinking decode does not replay when the chat is shown again. */
  startedAt: number;
  round: { n: number; max: number } | null;
};

const flights = new Map<string, Flight>();
const listeners = new Set<() => void>();
const pending = new Set<string>();
const epochs = new Map<string, number>();
let runningKey = "";
const runningListeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
  const next = [...flights.values()]
    .filter((flight) => flight.running)
    .map((flight) => flight.sessionId)
    .sort()
    .join("\n");
  if (next === runningKey) return;
  runningKey = next;
  for (const listener of runningListeners) listener();
}

export function subscribeFlights(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function sessionEpoch(sessionId: string): number {
  return epochs.get(sessionId) ?? 0;
}

function bumpEpoch(sessionId: string) {
  epochs.set(sessionId, (epochs.get(sessionId) ?? 0) + 1);
}

export function flightFor(sessionId: string | null): Flight | null {
  if (!sessionId) return null;
  return flights.get(sessionId) ?? null;
}

export function subscribeRunning(listener: () => void) {
  runningListeners.add(listener);
  return () => runningListeners.delete(listener);
}

export function runningSessionKey(): string {
  return runningKey;
}

/** Stops a second send from starting a turn that is already leaving the station. */
export function claimTurn(sessionId: string): boolean {
  if (pending.has(sessionId) || flights.get(sessionId)?.running) return false;
  pending.add(sessionId);
  return true;
}

export function releaseTurn(sessionId: string) {
  pending.delete(sessionId);
}

export function startFlight(flight: Flight) {
  pending.delete(flight.sessionId);
  flights.set(flight.sessionId, flight);
  bumpEpoch(flight.sessionId);
  emit();
}

export function updateFlight(sessionId: string, recipe: (current: Flight) => Flight) {
  const current = flights.get(sessionId);
  if (!current) return;
  const next = recipe(current);
  if (next === current) return;
  flights.set(sessionId, next);
  emit();
}

export function clearFlight(sessionId: string) {
  if (!flights.delete(sessionId)) return;
  bumpEpoch(sessionId);
  emit();
}
