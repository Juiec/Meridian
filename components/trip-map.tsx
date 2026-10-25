"use client";

import { useEffect, useRef } from "react";

import type { TripPlace } from "@/lib/travel-types";

import "leaflet/dist/leaflet.css";

const COLORS: Record<TripPlace["kind"], string> = {
  destination: "#c47a3a",
  stay: "#6a8f72",
  poi: "#8d7355",
  transit: "#9a8f80",
};

export function TripMap({ places }: { places: TripPlace[] }) {
  const host = useRef<HTMLDivElement>(null);
  const signature = places.map((place) => `${place.id}:${place.lat}:${place.lng}:${place.day}`).join("|");

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    void (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || !host.current) return;
      map = L.map(host.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      for (const place of places) {
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:14px;height:14px;border-radius:999px;background:${COLORS[place.kind]};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const day = place.day ? `Day ${place.day}` : "Unscheduled";
        L.marker([place.lat, place.lng], { icon }).bindPopup(`${escapeHtml(place.name)}<br>${day}`).addTo(map);
      }
      const groups = new Map<string, TripPlace[]>();
      for (const place of places) {
        const key = place.day === null ? "none" : String(place.day);
        groups.set(key, [...(groups.get(key) ?? []), place]);
      }
      for (const group of groups.values()) {
        if (group.length < 2 || !map) continue;
        L.polyline(
          group.map((place) => [place.lat, place.lng] as [number, number]),
          { color: "#c47a3a", weight: 3, opacity: 0.75 },
        ).addTo(map);
      }
      if (places.length === 1) map.setView([places[0].lat, places[0].lng], 12);
      else if (places.length > 1) {
        map.fitBounds(
          L.latLngBounds(places.map((place) => [place.lat, place.lng] as [number, number])),
          { padding: [28, 28] },
        );
      } else map.setView([20, 0], 2);
      window.setTimeout(() => map?.invalidateSize(), 60);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [places, signature]);

  return <div ref={host} className="isolate z-0 h-64 w-full md:h-80" />;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}
