"use client";

import { useEffect, useRef } from "react";

import { dayLinks } from "@/lib/travel-math";
import type { TripPlace } from "@/lib/travel-types";
import { TRIP_KIND_COLORS } from "@/lib/travel-types";

import "leaflet/dist/leaflet.css";

export function TripMap({ places }: { places: TripPlace[] }) {
  const host = useRef<HTMLDivElement>(null);
  const signature = places.map((place) => `${place.id}:${place.lat}:${place.lng}:${place.day}:${place.kind}:${place.name}`).join("|");

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let map: import("leaflet").Map | null = null;
    let observer: ResizeObserver | null = null;
    let cancelled = false;

    void (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default;
      if (cancelled || !host.current) return;
      map = L.map(host.current, { scrollWheelZoom: true, dragging: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      for (const place of places) {
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:14px;height:14px;border-radius:999px;background:${TRIP_KIND_COLORS[place.kind]};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></span>`,
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
          { color: TRIP_KIND_COLORS.destination, weight: 3, opacity: 0.75 },
        ).addTo(map);
      }
      for (const link of dayLinks(places)) {
        if (!map) continue;
        const from: [number, number] = [link.from.lat, link.from.lng];
        const to: [number, number] = [link.to.lat, link.to.lng];
        L.polyline([from, to], link.air
          ? { color: "#5c5146", weight: 2.5, opacity: 0.9, dashArray: "1 8", lineCap: "round" }
          : { color: "#8a8478", weight: 3, opacity: 0.75 },
        ).addTo(map);
        if (!link.air) continue;
        const label = L.divIcon({
          className: "",
          html: `<span style="display:block;width:48px;text-align:center;font:500 11px/14px sans-serif;letter-spacing:.04em;color:#5c5146;text-shadow:0 0 3px #fff,0 0 3px #fff">by air</span>`,
          iconSize: [48, 14],
          iconAnchor: [24, 7],
        });
        L.marker([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], { icon: label, interactive: false, keyboard: false }).addTo(map);
      }
      if (places.length === 1) map.setView([places[0].lat, places[0].lng], 12);
      else if (places.length > 1) {
        map.fitBounds(
          L.latLngBounds(places.map((place) => [place.lat, place.lng] as [number, number])),
          { padding: [28, 28] },
        );
      } else map.setView([20, 0], 2);
      const redraw = () => map?.invalidateSize();
      redraw();
      observer = new ResizeObserver(redraw);
      observer.observe(node);
      window.setTimeout(redraw, 60);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
    };
  }, [places, signature]);

  return <div ref={host} className="isolate z-0 h-full min-h-72 w-full" />;
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
