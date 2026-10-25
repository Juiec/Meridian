"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAppState } from "@/components/app-state";
import { readJson } from "@/components/client-api";
import { useOpenSidebar } from "@/components/shell";
import { SidebarToggle } from "@/components/sidebar";
import { SkillEditor } from "@/components/skill-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupPlaces } from "@/lib/travel-math";
import type { FareQuote, TravelPublicSettings, TripKind, TripLeg, TripPlace } from "@/lib/travel-types";

const TripMap = dynamic(() => import("@/components/trip-map").then((mod) => mod.TripMap), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted md:h-80" />,
});

const ACTIONS = [
  {
    title: "Plan a trip",
    detail: "Asks for origin, dates, and constraints, then pins the destination.",
    prompt:
      "/skill:trip-planning Plan a trip. Ask for any of these you do not already have: origin, destination, dates, who is going, constraints, and a budget frame. Then geocode the destination, check the weather, and pin it. Do not invent prices.",
  },
  {
    title: "Packing list",
    detail: "Uses the forecast once a destination is known.",
    prompt:
      "/skill:packing-list Make a packing list. If destination, dates, or trip type are missing, ask. Use the weather tool once you know the place.",
  },
  {
    title: "Day-by-day itinerary",
    detail: "Orders the pinned places and measures the legs.",
    prompt:
      "/skill:itinerary-day Build a day-by-day itinerary from the pinned trip. Estimate travel time with the route tool. Do not invent hours you did not look up.",
  },
  {
    title: "Lisbon weekend sample",
    detail: "A filled-in example. It is not your home city.",
    prompt:
      "/skill:trip-planning Plan a long weekend in Lisbon for two people, 30 October to 2 November 2026, starting from New York. Pin Lisbon, check the weather, and compare fares. Say clearly if a fare is illustrative. Do not book.",
  },
];

const TRAVEL_SKILLS = [
  { name: "trip-planning", blurb: "Destination, dates, constraints, and an outline." },
  { name: "packing-list", blurb: "A list shaped by trip type and the forecast." },
  { name: "itinerary-day", blurb: "A day-by-day schedule from the pinned map." },
  { name: "travel-research", blurb: "What to look up for fares, weather, and entry rules." },
];

type TravelPayload = {
  places: TripPlace[];
  legs: TripLeg[];
  settings: TravelPublicSettings;
};

export function TravelScreen() {
  const router = useRouter();
  const openSidebar = useOpenSidebar();
  const { skills, refreshSkills, createSession, setActiveSessionId, queueComposer } = useAppState();
  const [payload, setPayload] = useState<TravelPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [placeDay, setPlaceDay] = useState("");
  const [placeKind, setPlaceKind] = useState<TripKind>("destination");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [quotes, setQuotes] = useState<FareQuote[] | null>(null);
  const [quoteNote, setQuoteNote] = useState<string | null>(null);
  const [priceUrl, setPriceUrl] = useState("");
  const [priceKey, setPriceKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await readJson<TravelPayload>(await fetch("/api/travel"));
        if (cancelled) return;
        setPayload(data);
        setPriceUrl(data.settings.priceUrl);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the trip.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function begin(prompt: string) {
    setBusy("chat");
    setError(null);
    try {
      const id = await createSession();
      setActiveSessionId(id);
      queueComposer(prompt);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open a chat.");
      setBusy(null);
    }
  }

  async function reload(next: TravelPayload) {
    setPayload(next);
    setPriceUrl(next.settings.priceUrl);
  }

  async function addPlace() {
    setBusy("place");
    setError(null);
    try {
      const data = await readJson<TravelPayload>(
        await fetch("/api/travel/places", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: placeName, kind: placeKind, day: placeDay || null }),
        }),
      );
      await reload(data);
      setPlaceName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that place.");
    } finally {
      setBusy(null);
    }
  }

  async function movePlace(id: string, day: string) {
    setError(null);
    try {
      const data = await readJson<TravelPayload>(
        await fetch("/api/travel/places", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, day: day || null }),
        }),
      );
      await reload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move that place.");
    }
  }

  async function removePlace(id: string) {
    setError(null);
    try {
      const data = await readJson<TravelPayload>(await fetch(`/api/travel/places?id=${encodeURIComponent(id)}`, { method: "DELETE" }));
      await reload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that place.");
    }
  }

  async function checkPrices() {
    setBusy("quote");
    setError(null);
    setQuotes(null);
    setQuoteNote(null);
    try {
      const data = await readJson<{ quotes: FareQuote[]; provider: string; text: string }>(
        await fetch("/api/travel/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ from, to, date, passengers: 1 }),
        }),
      );
      setQuotes(data.quotes);
      setQuoteNote(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Price check failed.");
    } finally {
      setBusy(null);
    }
  }

  async function saveProvider() {
    setBusy("settings");
    setError(null);
    try {
      const body: Record<string, string> = { priceUrl };
      if (clearKey) body.priceApiKey = "";
      else if (priceKey.trim()) body.priceApiKey = priceKey;
      const data = await readJson<{ settings: TravelPublicSettings }>(
        await fetch("/api/travel/settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setPayload((current) => (current ? { ...current, settings: data.settings } : current));
      setPriceUrl(data.settings.priceUrl);
      setPriceKey("");
      setClearKey(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the price provider.");
    } finally {
      setBusy(null);
    }
  }

  const places = payload?.places ?? [];
  const groups = groupPlaces(places);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 md:px-6">
        <SidebarToggle onOpen={openSidebar} />
        <div>
          <p className="font-display text-2xl leading-none">Travel Agent</p>
          <p className="mt-1 text-xs text-muted-foreground">Itineraries, public lookups, and the trip map. No checkout.</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-8 pb-16">
          <p className="text-sm leading-6 text-muted-foreground">
            This plans trips with the same agent as the rest of Meridian. Skills are the playbooks. Travel tools look up
            places, weather, nearby spots, routes, and fares. Notes that should last go in memory. Meridian does not book
            or take payment. A fare is illustrative unless you point the price check at your own search API, or you
            connect an MCP server or custom tool that reads a provider you trust.
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <section>
            <h2 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Start in chat</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {ACTIONS.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  disabled={busy === "chat"}
                  onClick={() => void begin(action.prompt)}
                  className="rounded-xl border border-border bg-card px-3 py-3 text-left hover:bg-muted/60"
                >
                  <span className="block text-sm font-medium">{action.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{action.detail}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Travel skills</h2>
            <ul className="mt-3 space-y-2">
              {TRAVEL_SKILLS.map((skill) => {
                const installed = skills.some((item) => item.name === skill.name);
                return (
                  <li key={skill.name} className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2">
                    <div>
                      <p className="font-mono text-[13px] text-copper">{skill.name}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {installed ? skill.blurb : "Not installed."}
                      </p>
                    </div>
                    {installed ? (
                      <button
                        type="button"
                        className="shrink-0 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                        onClick={() => setEditing(skill.name)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <SkillEditor
              key={editing ?? "closed"}
              open={editing !== null}
              skillName={editing}
              onClose={() => setEditing(null)}
              onSaved={refreshSkills}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Map and days</h2>
            <div className="overflow-hidden rounded-xl border border-border">
              {payload ? <TripMap places={places} /> : <div className="h-64 animate-pulse bg-muted md:h-80" />}
            </div>
            <form
              className="grid gap-2 sm:grid-cols-[1fr_8rem_9rem_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void addPlace();
              }}
            >
              <Input
                value={placeName}
                onChange={(event) => setPlaceName(event.target.value)}
                placeholder="City, station, or hotel"
                aria-label="Place to pin"
              />
              <select
                aria-label="Kind of place"
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                value={placeKind}
                onChange={(event) => setPlaceKind(event.target.value as TripKind)}
              >
                <option value="destination">Destination</option>
                <option value="stay">Stay</option>
                <option value="poi">Place</option>
                <option value="transit">Transit</option>
              </select>
              <select
                aria-label="Itinerary day"
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                value={placeDay}
                onChange={(event) => setPlaceDay(event.target.value)}
              >
                <option value="">Unscheduled</option>
                {Array.from({ length: 7 }, (_, index) => (
                  <option key={index + 1} value={String(index + 1)}>
                    Day {index + 1}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={busy === "place" || !placeName.trim()}>
                {busy === "place" ? "Looking up…" : "Pin"}
              </Button>
            </form>
            {places.length === 0 ? (
              <p className="text-sm text-muted-foreground">No places yet. Pin a city, or ask in chat and the agent will.</p>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.day ?? "none"}>
                    <h3 className="text-sm font-medium">{group.day ? `Day ${group.day}` : "Unscheduled"}</h3>
                    <ul className="mt-2 space-y-2">
                      {group.places.map((place) => (
                        <li key={place.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
                          <span className="min-w-0 flex-1 text-sm">
                            {place.name}
                            <span className="ml-2 text-[11px] tracking-wide text-muted-foreground uppercase">{place.kind}</span>
                          </span>
                          <select
                            aria-label={`Day for ${place.name}`}
                            className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs dark:bg-input/30"
                            value={place.day ?? ""}
                            onChange={(event) => void movePlace(place.id, event.target.value)}
                          >
                            <option value="">Unscheduled</option>
                            {Array.from({ length: 7 }, (_, index) => (
                              <option key={index + 1} value={String(index + 1)}>
                                Day {index + 1}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => void removePlace(place.id)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {payload && payload.legs.length > 0 ? (
                  <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                    {payload.legs.map((leg) => (
                      <li key={`${leg.fromId}-${leg.toId}`}>
                        {leg.fromName} → {leg.toName}: {leg.km} km straight
                        {leg.minutes !== null ? `, about ${leg.minutes} min (${leg.roadKm} km by road)` : ", road time unavailable"}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Price check</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {payload?.settings.provider === "custom"
                ? "Using your price URL. Results are whatever that endpoint returns. Meridian still does not book."
                : "No price URL is set, so quotes are distance estimates labeled illustrative. The links open a public search."}
            </p>
            <form
              className="grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void checkPrices();
              }}
            >
              <Input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="From" aria-label="Fare origin" />
              <Input value={to} onChange={(event) => setTo(event.target.value)} placeholder="To" aria-label="Fare destination" />
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Travel date" />
              <Button type="submit" variant="outline" disabled={busy === "quote" || !from.trim() || !to.trim()}>
                {busy === "quote" ? "Checking…" : "Check fares"}
              </Button>
            </form>
            {quoteNote ? <p className="text-sm">{quoteNote}</p> : null}
            {quotes ? (
              <ul className="space-y-2">
                {quotes.map((quote) => (
                  <li key={`${quote.mode}-${quote.price}`} className="rounded-xl border border-border px-3 py-2 text-sm">
                    <span className="font-medium capitalize">{quote.mode}</span>
                    <span className="ml-2">
                      {quote.price} {quote.currency}
                    </span>
                    <span className="ml-2 text-[11px] tracking-wide text-muted-foreground uppercase">
                      {quote.live ? "Live" : "Not live"}
                    </span>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{quote.note}</p>
                    {quote.link ? (
                      <a href={quote.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-copper underline-offset-2 hover:underline">
                        Open search
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <details className="rounded-xl border border-border px-3 py-2">
              <summary className="cursor-pointer text-sm">Price provider</summary>
              <div className="mt-3 space-y-3">
                <label className="block text-sm">
                  Search API URL
                  <Input
                    className="mt-1.5 font-mono"
                    value={priceUrl}
                    onChange={(event) => setPriceUrl(event.target.value)}
                    placeholder="https://example.com/fares"
                    spellCheck={false}
                  />
                </label>
                <label className="block text-sm">
                  API key
                  <Input
                    className="mt-1.5"
                    type="password"
                    value={priceKey}
                    onChange={(event) => setPriceKey(event.target.value)}
                    placeholder={payload?.settings.priceKeySet ? `Saved ${payload.settings.priceKeyHint ?? ""}` : "Optional, sent only to that URL"}
                    autoComplete="off"
                  />
                </label>
                {payload?.settings.priceKeySet ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={clearKey} onChange={(event) => setClearKey(event.target.checked)} />
                    Clear the saved key
                  </label>
                ) : null}
                <Button type="button" size="sm" disabled={busy === "settings"} onClick={() => void saveProvider()}>
                  {busy === "settings" ? "Saving…" : "Save provider"}
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Meridian POSTs from, to, date, and passengers. The key stays in data/travel-settings.json and is not returned to the browser. Leave the URL blank to use illustrative quotes. Private and loopback URLs are refused.
                </p>
              </div>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
