"use client";

import { useEffect, useRef, useState } from "react";

import { MarkdownText } from "@/components/markdown-text";
import { groupMessages, type ToolPart } from "@/lib/group-messages";
import type { StoredMessage } from "@/lib/types";
import { cn } from "cn";

export type LivePart =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string }
  | ToolPart;

export function Transcript({
  messages,
  live,
  compactedSummary,
  loading,
  error,
  onRetry,
  empty,
}: {
  messages: StoredMessage[];
  live: { parts: LivePart[]; status: string } | null;
  compactedSummary: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  empty: React.ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const items = groupMessages(messages);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, live]);

  return (
    <div
      ref={scrollerRef}
      onScroll={() => {
        const el = scrollerRef.current;
        if (!el) return;
        stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">
        {compactedSummary ? <CompactionNote summary={compactedSummary} /> : null}
        {loading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Opening the session…</p>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <p>{error}</p>
            <button type="button" className="mt-2 underline underline-offset-2" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : null}
        {!loading && !error && items.length === 0 && !live ? empty : null}
        {items.map((item) => {
          if (item.kind === "user") {
            return (
              <div key={item.id} className="ml-auto max-w-[40rem] rounded-2xl bg-secondary px-4 py-3 text-[15px] leading-7">
                {item.attachments.length > 0 ? (
                  <ul className="mb-2 flex flex-wrap gap-1.5">
                    {item.attachments.map((file) => (
                      <li key={file.name} className="rounded-full bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {file.kind === "image" ? "Image" : "File"} · {file.name}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="whitespace-pre-wrap">{item.content}</p>
              </div>
            );
          }
          if (item.kind === "note") {
            return (
              <p key={item.id} className="text-center text-xs tracking-wide text-muted-foreground">
                {item.content.split("\n")[0]}
              </p>
            );
          }
          return (
            <article key={item.id} className="max-w-[46rem] space-y-3 text-[15px]">
              {item.reasoning ? <Thinking text={item.reasoning} /> : null}
              {item.parts.map((part, index) =>
                part.kind === "text" ? (
                  <MarkdownText key={`${item.id}-text-${index}`} text={part.text} />
                ) : (
                  <ToolCard key={part.id || `${item.id}-tool-${index}`} part={part} />
                ),
              )}
            </article>
          );
        })}
        {live ? (
          <article className="max-w-[46rem] space-y-3 text-[15px]" aria-live="polite">
            {live.parts.map((part, index) => {
              if (part.kind === "reasoning") return <Thinking key={`live-r-${index}`} text={part.text} streaming />;
              if (part.kind === "text") return <MarkdownText key={`live-t-${index}`} text={part.text} />;
              return <ToolCard key={part.id || `live-tool-${index}`} part={part} />;
            })}
            {live.parts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{live.status}</p>
            ) : null}
          </article>
        ) : null}
      </div>
    </div>
  );
}

function CompactionNote({ summary }: { summary: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <button type="button" className="text-left" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="font-medium">Earlier context was compacted</span>
        <span className="mt-1 block text-muted-foreground">
          The full transcript stays here. The model continues from a summary.
        </span>
      </button>
      {open ? <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{summary}</p> : null}
    </div>
  );
}

function Thinking({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-sm text-muted-foreground">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {streaming ? "Thinking…" : "Thinking"}
      </button>
      {open ? <p className="mt-2 whitespace-pre-wrap">{text}</p> : null}
    </div>
  );
}

function ToolCard({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false);
  const summary = toolSummary(part);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span
          className={cn(
            "mt-1.5 size-1.5 shrink-0 rounded-full",
            part.pending ? "animate-pulse bg-copper" : part.ok === false ? "bg-destructive" : "bg-sage",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[13px] text-copper">{part.name}</span>
            <span className="text-[11px] tracking-wide text-muted-foreground uppercase">
              {part.pending ? "Running" : part.ok === false ? "Failed" : "Done"}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border px-3 py-2 font-mono text-[11px] leading-5">
          {part.arguments ? (
            <pre className="overflow-x-auto whitespace-pre-wrap">{pretty(part.arguments)}</pre>
          ) : null}
          {part.result ? <pre className="overflow-x-auto whitespace-pre-wrap text-muted-foreground">{part.result}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}

function toolSummary(part: ToolPart): string {
  if (part.pending) return "Waiting for the tool to finish";
  if (!part.result) return part.ok === false ? "The tool failed" : "Finished";
  try {
    const parsed = JSON.parse(part.result) as {
      message?: string;
      error?: string;
      usage?: string;
      name?: string;
      url?: string;
      utc?: string;
      text?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.text === "string" && parsed.text.trim()) return parsed.text.trim().slice(0, 140);
    if (typeof parsed.message === "string") {
      return parsed.usage ? `${parsed.message} ${parsed.usage}` : parsed.message;
    }
    if (typeof parsed.utc === "string") return parsed.utc;
    if (typeof parsed.url === "string") return parsed.url;
    if (typeof parsed.name === "string") return parsed.name;
  } catch {
    return part.result.slice(0, 140);
  }
  return part.ok === false ? "The tool failed" : "Finished";
}

function pretty(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value) as unknown, null, 2);
  } catch {
    return value;
  }
}
