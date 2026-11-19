"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

import { MarkdownText } from "@/components/markdown-text";
import { groupMessages, type ToolPart } from "@/lib/group-messages";
import type { StoredMessage } from "@/lib/types";
import { cn } from "cn";

export type LivePart =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string }
  | ToolPart;

type ImageResultItem = { id?: string; url?: string; prompt?: string };

function resultImages(result?: string): ImageResultItem[] {
  if (!result) return [];
  try {
    const parsed = JSON.parse(result) as { ok?: boolean; images?: unknown };
    if (parsed.ok === false || !Array.isArray(parsed.images)) return [];
    return parsed.images
      .filter((item): item is ImageResultItem =>
        Boolean(item) && typeof item === "object" && typeof (item as ImageResultItem).url === "string",
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}

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
      className="scroll-hidden min-h-0 flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">
        {compactedSummary ? <CompactionNote summary={compactedSummary} /> : null}
        {loading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Opening the session…</p>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <p>{error}</p>
            <button
              type="button"
              className="mt-2 rounded-sm font-medium text-destructive underline underline-offset-4"
              onClick={onRetry}
            >
              Retry
            </button>
          </div>
        ) : null}
        {!loading && !error && items.length === 0 && !live ? empty : null}
        {items.map((item) => {
          if (item.kind === "user") {
            return (
              <div key={item.id} className="ml-auto max-w-[40rem] rounded-2xl bg-secondary px-4 py-3 text-[15px] leading-7">
                {item.attachments.some((file) => file.kind === "image" && file.dataUrl) ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {item.attachments.map((file, index) =>
                      file.kind === "image" && file.dataUrl ? (
                        <a
                          key={`${file.name}-${index}`}
                          href={file.dataUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block overflow-hidden rounded-lg border border-border/60"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={file.dataUrl} alt={file.name} loading="lazy" className="size-20 object-cover" />
                        </a>
                      ) : null,
                    )}
                  </div>
                ) : null}
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
            {live.parts.some((part) => part.kind === "reasoning") ? null : live.parts.length === 0 ? (
              <Thinking text="" streaming detail={live.status} />
            ) : null}
            {live.parts.map((part, index) => {
              if (part.kind === "reasoning") {
                return <Thinking key={`live-r-${index}`} text={part.text} streaming detail={live.status} />;
              }
              if (part.kind === "text") return <MarkdownText key={`live-t-${index}`} text={part.text} />;
              return <ToolCard key={part.id || `live-tool-${index}`} part={part} />;
            })}
          </article>
        ) : null}
      </div>
    </div>
  );
}

function DisclosureChevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      aria-hidden
      className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none", open && "rotate-90")}
    />
  );
}

function CompactionNote({ summary }: { summary: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <button
        type="button"
        className="flex w-full items-start gap-2 rounded-sm text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <DisclosureChevron open={open} />
        <span className="min-w-0 flex-1">
          <span className="font-medium">Earlier context was compacted</span>
          <span className="mt-1 block text-muted-foreground">
            The full transcript stays here. The model continues from a summary.
          </span>
        </span>
      </button>
      {open ? <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{summary}</p> : null}
    </div>
  );
}

function thinkingSteps(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((step) => step.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;
  const lines = text
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);
  const marked = lines.filter((line) => /^(?:\d+[.)]|[-*])\s+\S/.test(line));
  if (marked.length >= 2 && marked.length >= lines.length - 1) return lines;
  return text.trim() ? [text.trim()] : [];
}

function Thinking({
  text,
  streaming = false,
  detail,
}: {
  text: string;
  streaming?: boolean;
  detail?: string;
}) {
  const [open, setOpen] = useState(streaming);
  const steps = thinkingSteps(text);
  const body = steps.length > 0 ? steps : streaming ? [detail?.trim() || "Still working."] : [];
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border text-sm",
        streaming ? "border-copper/50 bg-copper/10 text-foreground" : "border-border bg-card text-muted-foreground",
      )}
      aria-busy={streaming || undefined}
    >
      <button
        type="button"
        className={cn("flex w-full items-center gap-2 px-3 py-2.5 text-left", streaming && !open && "think-shine")}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Collapse thinking" : "Expand thinking"}
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", streaming ? "bg-copper" : "bg-muted-foreground")}
          aria-hidden
        />
        <span className={cn("font-medium", streaming && "text-copper")}>Thinking</span>
        {streaming && !open && detail ? (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{detail}</span>
        ) : (
          <span className="flex-1" />
        )}
        <DisclosureChevron open={open} />
      </button>
      {open && body.length > 0 ? (
        <ol className="space-y-1 px-3 pb-3">
          {body.map((step, index) => (
            <li
              key={index}
              className={cn(
                "leading-6 whitespace-pre-wrap",
                streaming
                  ? "think-shine rounded-lg bg-background/70 px-2.5 py-1.5 text-foreground"
                  : "text-muted-foreground",
              )}
              style={streaming ? { animationDelay: `${index * 0.18}s` } : undefined}
            >
              {step}
            </li>
          ))}
        </ol>
      ) : null}
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
        className="flex w-full items-start gap-3 rounded-sm px-3 py-2.5 text-left"
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
        <DisclosureChevron open={open} />
      </button>
      {part.name === "image_generate" && !part.pending ? (
        <GeneratedImages images={resultImages(part.result)} />
      ) : null}
      {part.name === "delegate" && !part.pending ? <DelegateResult result={part.result} /> : null}
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

function GeneratedImages({ images }: { images: ImageResultItem[] }) {
  if (images.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 border-t border-border px-3 py-3 sm:grid-cols-3">
      {images.map((image, index) => (
        <a
          key={image.id ?? `${image.url}-${index}`}
          href={image.url}
          target="_blank"
          rel="noreferrer"
          className="group relative block overflow-hidden rounded-lg border border-border bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.prompt || `Generated image ${index + 1}`}
            loading="lazy"
            className="aspect-square w-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {image.prompt || `Image ${index + 1}`}
          </span>
        </a>
      ))}
    </div>
  );
}

function delegateView(result?: string): { title: string; text: string; tools: string[] } | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result) as { ok?: boolean; title?: string; result?: string; tools?: unknown };
    if (parsed.ok === false || typeof parsed.result !== "string" || !parsed.result.trim()) return null;
    const tools = Array.isArray(parsed.tools) ? parsed.tools.filter((item): item is string => typeof item === "string") : [];
    return { title: parsed.title?.trim() || "Subagent", text: parsed.result, tools };
  } catch {
    return null;
  }
}

function DelegateResult({ result }: { result?: string }) {
  const view = delegateView(result);
  if (!view) return null;
  return (
    <div className="border-t border-border px-3 py-3 text-sm leading-6">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{view.title}</p>
      <div className="mt-1">
        <MarkdownText text={view.text} />
      </div>
      {view.tools.length > 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Worked with {view.tools.join(", ")}. The tool trace stayed in the subagent.
        </p>
      ) : null}
    </div>
  );
}

function toolSummary(part: ToolPart): string {
  if (part.pending) return part.status || "Waiting for the tool to finish";
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
