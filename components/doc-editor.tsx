"use client";

import { useEffect, useState } from "react";

import { readJson } from "@/components/client-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

type Doc = { text: string; used: number; limit: number };

export function DocEditor() {
  const [soul, setSoul] = useState("");
  const [agents, setAgents] = useState("");
  const [limits, setLimits] = useState({ soul: 6000, agents: 8000 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<"soul" | "agents" | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const data = await readJson<{ soul: Doc; agents: Doc }>(await fetch("/api/docs", { signal: ac.signal }));
        if (ac.signal.aborted) return;
        setSoul(data.soul.text);
        setAgents(data.agents.text);
        setLimits({ soul: data.soul.limit, agents: data.agents.limit });
        setLoaded(true);
      } catch (err) {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load identity files.");
      }
    })();
    return () => ac.abort();
  }, []);

  async function save(target: "soul" | "agents") {
    setPending(target);
    setError(null);
    setMessage(null);
    try {
      await readJson(
        await fetch("/api/docs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, text: target === "soul" ? soul : agents }),
        }),
      );
      setMessage(
        target === "soul"
          ? "Identity saved. Open a new session, or let compaction rebuild this one, to use it."
          : "Instructions saved. They enter the prompt on the next session or compaction.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setPending(null);
    }
  }

  if (!loaded && !error) {
    return <p className="text-xs text-muted-foreground">Loading identity…</p>;
  }

  return (
    <div className="space-y-4">
      <Field
        title="Identity"
        hint="agent/SOUL.md. Stable tier. Frozen into a session until the next one, or until compaction rebuilds the prompt."
        value={soul}
        limit={limits.soul}
        pending={pending === "soul"}
        onChange={setSoul}
        onSave={() => void save("soul")}
      />
      <Field
        title="Instructions"
        hint="agent/AGENTS.md. Context tier. Same refresh rule as identity."
        value={agents}
        limit={limits.agents}
        pending={pending === "agents"}
        onChange={setAgents}
        onSave={() => void save("agents")}
      />
      {message ? <p className="text-xs text-sage">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Field({
  title,
  hint,
  value,
  limit,
  pending,
  onChange,
  onSave,
}: {
  title: string;
  hint: string;
  value: string;
  limit: number;
  pending: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const over = value.length > limit;
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{title}</h3>
        <span className={cn("font-mono text-[11px]", over ? "text-destructive" : "text-muted-foreground")}>
          {value.length}/{limit}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={title}
        className="mt-2 min-h-28 font-mono text-[11px]"
      />
      <Button type="button" variant="outline" size="sm" className="mt-2" disabled={pending || over} onClick={onSave}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </section>
  );
}
