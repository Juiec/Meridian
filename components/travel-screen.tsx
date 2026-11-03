"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { readJson } from "@/components/client-api";
import { ChatScreen } from "@/components/chat-screen";
import { useOpenSidebar } from "@/components/shell";
import { SidebarToggle } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupPlaces } from "@/lib/travel-math";
import { MAX_TRIP_DAYS, type FareQuote, type TravelPublicSettings, type TripKind, type TripLeg, type TripPlace } from "@/lib/travel-types";

const TripMap = dynamic(() => import("@/components/trip-map").then((mod) => mod.TripMap), {
  ssr: false,
  loading: () => <div className="h-[min(52vh,34rem)] min-h-72 animate-pulse rounded-xl bg-muted" />,
});

type TravelPayload = {
  places: TripPlace[];
  legs: TripLeg[];
  settings: TravelPublicSettings;
};

export function TravelScreen() {
  const openSidebar = useOpenSidebar();
  const [payload, setPayload] = useState<TravelPayload | null>(null);
  const [plannerSessionId, setPlannerSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [placeDay, setPlaceDay] = useState("");
  const [placeDayDrafts, setPlaceDayDrafts] = useState<Record<string, string>>({});
  const [placeKind, setPlaceKind] = useState<TripKind>("destination");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [quotes, setQuotes] = useState<FareQuote[] | null>(null);
  const [quoteNote, setQuoteNote] = useState<string | null>(null);
  const [priceUrl, setPriceUrl] = useState("");
  const [priceKey, setPriceKey] = useState("");
  const [clearKey, setClearKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [trip, planner] = await Promise.all([
          readJson<TravelPayload>(await fetch("/api/travel")),
          readJson<{ session: { id: string } }>(await fetch("/api/travel/session")),
        ]);
        if (cancelled) return;
        setPayload(trip);
        setPlannerSessionId(planner.session.id);
        setPriceUrl(trip.settings.priceUrl);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the trip.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setPlaceDayDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
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
  const plannedDays = new Set(places.flatMap((place) => (place.day ? [place.day] : []))).size;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 md:px-6">
        <SidebarToggle onOpen={openSidebar} />
        <div>
          <p className="font-display text-2xl leading-none">Travel Planner</p>
          <p className="mt-1 text-xs text-muted-foreground">Your trip conversation and map, side by side.</p>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="grid min-h-full grid-cols-1 lg:h-full lg:grid-cols-[minmax(20rem,0.92fr)_minmax(0,1.08fr)]">
          <section aria-label="Trip conversation" className="flex min-h-[34rem] min-w-0 flex-col border-b border-border lg:min-h-0 lg:border-b-0 lg:border-r">
            {plannerSessionId ? (
              <ChatScreen embedded embeddedSessionId={plannerSessionId} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground" role="status">
                Opening your trip conversation…
              </div>
            )}
          </section>
          <div className="min-h-[40rem] space-y-5 overflow-y-auto px-4 py-5 lg:min-h-0 lg:px-5">
            <section className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] tracking-[0.18em] text-copper uppercase">Trip desk</p>
                <h1 className="mt-1 font-display text-3xl leading-tight">Your trip, in place.</h1>
              </div>
              <dl className="flex gap-4 text-right">
                <div>
                  <dt className="text-[9px] tracking-wide text-muted-foreground uppercase">Stops</dt>
                  <dd className="font-display text-xl tabular-nums">{places.length}</dd>
                </div>
                <div>
                  <dt className="text-[9px] tracking-wide text-muted-foreground uppercase">Days</dt>
                  <dd className="font-display text-xl tabular-nums">{plannedDays}</dd>
                </div>
              </dl>
            </section>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

            <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl leading-none">Map & itinerary</h2>
                <p className="mt-1 text-xs text-muted-foreground">Scroll to zoom · drag to move</p>
              </div>
              <ul aria-label="Map legend" className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {[
                  ["Destination", "#c47a3a"],
                  ["Stay", "#6a8f72"],
                  ["Place", "#8d7355"],
                  ["Transit", "#9a8f80"],
                ].map(([label, color]) => (
                  <li key={label} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {payload ? <TripMap places={places} /> : <div className="h-[min(52vh,34rem)] min-h-72 animate-pulse bg-muted" />}
            </div>
            <form
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto]"
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
              <Input
                type="number"
                min={1}
                max={MAX_TRIP_DAYS}
                step={1}
                inputMode="numeric"
                aria-label={`Day to schedule, optional, up to ${MAX_TRIP_DAYS}`}
                placeholder="Day (optional)"
                value={placeDay}
                onChange={(event) => setPlaceDay(event.target.value)}
              />
              <Button type="submit" disabled={busy === "place" || !placeName.trim()}>
                {busy === "place" ? "Looking up…" : "Pin"}
              </Button>
            </form>
            {places.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stops yet. Pin a city, station, or stay to start shaping the itinerary.</p>
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
                          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            Day
                            <Input
                              className="h-8 w-20 text-xs"
                              type="number"
                              min={1}
                              max={MAX_TRIP_DAYS}
                              step={1}
                              inputMode="numeric"
                              aria-label={`Day for ${place.name}, up to ${MAX_TRIP_DAYS}`}
                              placeholder="—"
                              value={placeDayDrafts[place.id] ?? (place.day?.toString() ?? "")}
                              onChange={(event) =>
                                setPlaceDayDrafts((current) => ({ ...current, [place.id]: event.target.value }))
                              }
                              onBlur={(event) => {
                                const day = event.currentTarget.value;
                                if (day !== (place.day?.toString() ?? "")) void movePlace(place.id, day);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") event.currentTarget.blur();
                              }}
                            />
                          </label>
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
      </main>
    </div>
  );
}
