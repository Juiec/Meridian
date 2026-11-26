"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { readJson } from "@/components/client-api";
import { ChatScreen } from "@/components/chat-screen";
import { SidebarToggle } from "@/components/sidebar";
import { useOpenSidebar } from "@/components/shell-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupPlaces } from "@/lib/travel-math";
import { MAX_TRIP_DAYS, TRIP_KIND_COLORS, type FareQuote, type TravelPublicSettings, type TripKind, type TripLeg, type TripPlace } from "@/lib/travel-types";
import { cn } from "cn";

const TripMap = dynamic(() => import("@/components/trip-map").then((mod) => mod.TripMap), {
  ssr: false,
  loading: () => <div className="h-full min-h-72 animate-pulse bg-muted" />,
});

const KIND_OPTIONS = [
  ["destination", "Destination"],
  ["stay", "Stay"],
  ["poi", "Place"],
  ["transit", "Transit"],
] as const;

const fieldClass =
  "mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type ItineraryRow =
  | { kind: "day"; day: number | null; places: TripPlace[] }
  | { kind: "gap"; start: number; end: number };

function itineraryRows(groups: { day: number | null; places: TripPlace[] }[]): ItineraryRow[] {
  const rows: ItineraryRow[] = [];
  let previous: number | null = null;
  for (const group of groups) {
    if (group.day !== null && previous !== null && group.day > previous + 1) {
      rows.push({ kind: "gap", start: previous + 1, end: group.day - 1 });
    }
    rows.push({ kind: "day", day: group.day, places: group.places });
    if (group.day !== null) previous = group.day;
  }
  return rows;
}

function planStatus(places: TripPlace[], plannedDays: number): string {
  if (places.length === 0) return "Add the first stop to start the plan.";
  const loose = places.filter((place) => place.day === null).length;
  const stops = places.length === 1 ? "1 stop" : `${places.length} stops`;
  if (plannedDays === 0) return `${stops}, none on a day yet.`;
  const days = plannedDays === 1 ? "1 day" : `${plannedDays} days`;
  const base = `${stops} across ${days}.`;
  if (loose === 0) return base;
  return `${base} ${loose === 1 ? "1 is" : `${loose} are`} not on a day yet.`;
}

function gapLabel(start: number, end: number): string {
  if (start === end) return `Day ${start} has no stops.`;
  return `Days ${start}–${end} have no stops.`;
}

function legLabel(leg: TripLeg): string {
  const road = leg.minutes !== null ? `about ${leg.minutes} min (${leg.roadKm} km by road)` : "road time unavailable";
  return `${leg.km} km straight, ${road}`;
}

type TravelPayload = {
  places: TripPlace[];
  legs: TripLeg[];
  settings: TravelPublicSettings;
};

export function TravelScreen() {
  const openSidebar = useOpenSidebar();
  const tripQuery = useSearchParams().get("trip");
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
  const [desk, setDesk] = useState<"plan" | "fares">("plan");
  const [headerHost, setHeaderHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const query = tripQuery ? `?trip=${encodeURIComponent(tripQuery)}` : "";
        const [trip, planner] = await Promise.all([
          readJson<TravelPayload>(await fetch(`/api/travel${query}`)),
          readJson<{ session: { id: string } }>(await fetch(`/api/travel/session${query}`)),
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
  }, [tripQuery]);

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
          body: JSON.stringify({ name: placeName, kind: placeKind, day: placeDay || null, trip: plannerSessionId }),
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
          body: JSON.stringify({ id, day: day || null, trip: plannerSessionId }),
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
      const trip = plannerSessionId ? `&trip=${encodeURIComponent(plannerSessionId)}` : "";
      const data = await readJson<TravelPayload>(await fetch(`/api/travel/places?id=${encodeURIComponent(id)}${trip}`, { method: "DELETE" }));
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
  const rows = itineraryRows(groups);
  const legsByPair = new Map((payload?.legs ?? []).map((leg) => [`${leg.fromId}:${leg.toId}`, leg]));
  const scheduled = groups.filter((group) => group.day !== null);
  const firstStop = scheduled[0]?.places[0];
  const lastStop = scheduled.at(-1)?.places.at(-1);
  const fareEnds = firstStop && lastStop && firstStop.id !== lastStop.id ? { from: firstStop.name, to: lastStop.name } : null;
  const status = payload ? planStatus(places, plannedDays) : error ? "The trip did not load." : "Loading the trip…";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2 md:px-4">
        <SidebarToggle onOpen={openSidebar} />
        <div ref={setHeaderHost} className="flex min-w-0 flex-1 flex-wrap items-center gap-2" />
      </header>
      <main className="@container/travel min-h-0 flex-1 overflow-y-auto @min-[860px]/travel:overflow-hidden">
        <div className="grid min-h-full grid-cols-1 @min-[860px]/travel:h-full @min-[860px]/travel:grid-cols-[minmax(18rem,0.92fr)_minmax(0,1.08fr)]">
          <section aria-label="Trip conversation" className="flex min-h-[34rem] min-w-0 flex-col border-b border-border @min-[860px]/travel:min-h-0 @min-[860px]/travel:border-b-0 @min-[860px]/travel:border-r">
            {plannerSessionId ? (
              <ChatScreen embedded embeddedSessionId={plannerSessionId} headerPortal={headerHost} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground" role="status">
                Opening your trip conversation…
              </div>
            )}
          </section>
          <div className="flex min-h-[40rem] min-w-0 flex-col lg:h-full lg:min-h-0">
            <div className="flex shrink-0 items-end justify-between gap-3 border-b border-border px-4 py-3 lg:px-5">
              <div className="min-w-0">
                <h1 className="font-display text-2xl leading-none">{desk === "plan" ? "Map" : "Fares"}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {desk === "plan"
                    ? status
                    : payload?.settings.provider === "custom"
                      ? "Quotes come from your price URL. Meridian does not book."
                      : "Quotes are distance estimates until you set a price URL. Meridian does not book."}
                </p>
              </div>
              <div className="flex shrink-0 rounded-lg border border-border p-0.5" role="tablist" aria-label="Trip desk">
                {(["plan", "fares"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={desk === item}
                    className={cn(
                      "h-7 rounded-md px-2.5 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      desk === item ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setDesk(item)}
                  >
                    {item === "plan" ? "Plan" : "Fares"}
                  </button>
                ))}
              </div>
            </div>
            {error ? <p className="shrink-0 px-4 py-2 text-sm text-destructive lg:px-5" role="alert">{error}</p> : null}

            {desk === "plan" ? (
              <>
                <div className="flex min-h-80 flex-1 flex-col">
                  <div className="relative min-h-0 flex-1">
                    <div className="absolute inset-0">
                      {payload ? <TripMap places={places} /> : <div className="h-full min-h-72 animate-pulse bg-muted" role="status" />}
                    </div>
                  </div>
                  <ul aria-label="Map legend" className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-b border-border px-4 py-2 text-[11px] text-muted-foreground lg:px-5">
                    {KIND_OPTIONS.map(([kind, label]) => (
                      <li key={kind} className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ backgroundColor: TRIP_KIND_COLORS[kind] }} aria-hidden />
                        {label}
                      </li>
                    ))}
                    <li className="flex items-center gap-1.5">
                      <span className="inline-block w-5 border-t-2 border-dotted border-current" aria-hidden />
                      By air
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="inline-block w-5 border-t-2" style={{ borderColor: "#8a8478" }} aria-hidden />
                      Not by air
                    </li>
                    <li className="ml-auto">Scroll to zoom, drag to move</li>
                  </ul>
                </div>
                <form
                  className="grid shrink-0 gap-2 border-b border-border px-4 py-3 lg:px-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void addPlace();
                  }}
                >
                  <label className="text-xs text-muted-foreground">
                    Place
                    <Input
                      className="mt-1"
                      value={placeName}
                      onChange={(event) => setPlaceName(event.target.value)}
                      placeholder="City, station, or hotel"
                    />
                  </label>
                  <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-end gap-2">
                    <label className="text-xs text-muted-foreground">
                      Kind
                      <select
                        className={fieldClass}
                        value={placeKind}
                        onChange={(event) => setPlaceKind(event.target.value as TripKind)}
                      >
                        {KIND_OPTIONS.map(([kind, label]) => (
                          <option key={kind} value={kind}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Day
                      <Input
                        className="mt-1"
                        type="number"
                        min={1}
                        max={MAX_TRIP_DAYS}
                        step={1}
                        inputMode="numeric"
                        aria-label={`Day to schedule, optional, up to ${MAX_TRIP_DAYS}`}
                        placeholder="Any"
                        value={placeDay}
                        onChange={(event) => setPlaceDay(event.target.value)}
                      />
                    </label>
                    <Button type="submit" disabled={busy === "place" || !placeName.trim()}>
                      {busy === "place" ? "Looking up…" : "Add stop"}
                    </Button>
                  </div>
                </form>
                <div className="plan-well scroll-hidden shrink-0 overflow-y-auto px-4 py-4 lg:px-5">
                      {places.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No stops yet. Add a city, station, or stay under the map. Leave the day blank until you know when you will be there.</p>
                      ) : (
                        <div className="space-y-6">
                          {rows.map((row) =>
                            row.kind === "gap" ? (
                              <p key={`gap-${row.start}`} className="text-sm text-muted-foreground">{gapLabel(row.start, row.end)}</p>
                            ) : (
                              <section key={row.day ?? "none"}>
                                <h2 className="font-display text-2xl leading-none">{row.day ? `Day ${row.day}` : "Not on a day"}</h2>
                                <ul className="mt-2">
                                  {row.places.map((place, index) => {
                                    const previous = row.places[index - 1];
                                    const leg = previous ? legsByPair.get(`${previous.id}:${place.id}`) : undefined;
                                    return (
                                      <li key={place.id} className="border-b border-border py-3">
                                        {leg ? <p className="pb-2 text-xs text-muted-foreground">{legLabel(leg)}</p> : null}
                                        <div className="flex flex-wrap items-center gap-3">
                                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: TRIP_KIND_COLORS[place.kind] }} aria-hidden />
                                          <span className="plan-name min-w-0 flex-1 leading-5">
                                            {place.name}
                                            <span className="ml-2 text-xs text-muted-foreground">{KIND_OPTIONS.find(([kind]) => kind === place.kind)?.[1]}</span>
                                          </span>
                                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                            Day
                                            <Input className="h-8 w-16 text-xs" type="number" min={1} max={MAX_TRIP_DAYS} step={1} inputMode="numeric" aria-label={`Day for ${place.name}, up to ${MAX_TRIP_DAYS}`} placeholder="—" value={placeDayDrafts[place.id] ?? (place.day?.toString() ?? "")} onChange={(event) => setPlaceDayDrafts((current) => ({ ...current, [place.id]: event.target.value }))} onBlur={(event) => { const day = event.currentTarget.value; if (day !== (place.day?.toString() ?? "")) void movePlace(place.id, day); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
                                          </label>
                                          <Button type="button" variant="ghost" size="sm" onClick={() => void removePlace(place.id)}>Remove</Button>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </section>
                            ),
                          )}
                        </div>
                      )}
                    </div>
              </>
            ) : (
              <div className="scroll-hidden min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 lg:px-5">
                <form
                  className="grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void checkPrices();
                  }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-muted-foreground">
                      From
                      <Input className="mt-1" value={from} onChange={(event) => setFrom(event.target.value)} placeholder="City" />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      To
                      <Input className="mt-1" value={to} onChange={(event) => setTo(event.target.value)} placeholder="City" />
                    </label>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="min-w-0 flex-1 text-xs text-muted-foreground">
                      Date
                      <Input className="mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                    </label>
                    <Button type="submit" variant="outline" disabled={busy === "quote" || !from.trim() || !to.trim()}>
                      {busy === "quote" ? "Checking…" : "Check fares"}
                    </Button>
                  </div>
                  {fareEnds ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-start px-0"
                      onClick={() => {
                        setFrom(fareEnds.from);
                        setTo(fareEnds.to);
                      }}
                    >
                      Use {fareEnds.from} to {fareEnds.to}
                    </Button>
                  ) : null}
                </form>
                {quoteNote ? <p className="text-sm">{quoteNote}</p> : null}
                {quotes ? (
                  <ul className="space-y-2">
                    {quotes.map((quote) => (
                      <li key={`${quote.mode}-${quote.price}`} className="border-b border-border py-2 text-sm">
                        <span className="font-medium capitalize">{quote.mode}</span>
                        <span className="ml-2 tabular-nums">
                          {quote.price} {quote.currency}
                        </span>
                        <span
                          className={cn(
                            "ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                            quote.live ? "bg-sage/15 text-sage" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {quote.live ? "Live" : "Illustrative"}
                        </span>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{quote.note}</p>
                        {quote.link ? (
                          <a href={quote.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-copper underline-offset-4 hover:underline">
                            Open search
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <details className="border-t border-border pt-3">
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
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
