"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

import { AssistantText } from "@/components/markdown-text";
import { isQuestionPart, QuestionCard } from "@/components/question-card";
import { LiveThinkingText } from "@/components/ui/binary-text";
import { Button } from "@/components/ui/button";
import { CONTEXT_CLEANED_PREFIX } from "@/lib/context-usage";
import { groupMessages, type ToolPart, type TranscriptItem } from "@/lib/group-messages";
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
  thinkingKey,
  compactedSummary,
  foldedThroughSeq = null,
  loading,
  error,
  onRetry,
  onConfirmImage,
  empty,
  pendingToolCallId,
}: {
  messages: StoredMessage[];
  live: { parts: LivePart[]; status: string } | null;
  thinkingKey?: string;
  compactedSummary: string | null;
  foldedThroughSeq?: number | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onConfirmImage?: (toolCallId: string) => Promise<void>;
  empty: React.ReactNode;
  pendingToolCallId?: string | null;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const folded = foldedThroughSeq ?? null;
  const earlier = folded === null ? [] : messages.filter((message) => message.seq <= folded);
  const shown = folded === null ? messages : messages.filter((message) => message.seq > folded);
  const items = groupMessages(shown);
  const earlierItems = groupMessages(earlier);
  const liveParts = live ? visibleLiveParts(live.parts) : [];
  const liveIsOnlyQuestion = Boolean(
    live && liveParts.length === 0 && live.parts.some((part) => part.kind === "tool" && isQuestionPart(part) && !part.result),
  );

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
        {compactedSummary ? (
          <CompactionNote
            summary={compactedSummary}
            earlier={earlierItems}
            onConfirmImage={onConfirmImage}
            pendingToolCallId={pendingToolCallId}
          />
        ) : null}
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
        {items.map((item) => (
          <TranscriptEntry
            key={item.id}
            item={item}
            onConfirmImage={onConfirmImage}
            pendingToolCallId={pendingToolCallId}
          />
        ))}
        {live && !liveIsOnlyQuestion ? (
          <article className="max-w-[46rem] space-y-3 text-[15px]" aria-live="polite">
            {live.parts.some((part) => part.kind === "reasoning") ? null : liveParts.length === 0 ? (
              <Thinking text="" streaming detail={live.status} onceKey={thinkingKey} />
            ) : null}
            {liveParts.map((part, index) => {
              if (part.kind === "reasoning") {
                return <Thinking key={`live-r-${index}`} text={part.text} streaming detail={live.status} onceKey={thinkingKey} />;
              }
              if (part.kind === "text") return <AssistantText key={`live-t-${index}`} text={part.text} />;
              return (
                <ToolOrQuestion
                  key={part.id || `live-tool-${index}`}
                  part={part}
                  onConfirmImage={onConfirmImage}
                />
              );
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

function CompactionNote({
  summary,
  earlier,
  onConfirmImage,
  pendingToolCallId,
}: {
  summary: string;
  earlier: TranscriptItem[];
  onConfirmImage?: (toolCallId: string) => Promise<void>;
  pendingToolCallId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const cleaned = summary.startsWith(CONTEXT_CLEANED_PREFIX);
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
          <span className="font-medium">{cleaned ? "Context cleaned" : "Earlier context was compacted"}</span>
          <span className="mt-1 block text-muted-foreground">
            {cleaned
              ? "Thinking is cleared. The plan below keeps this day, the day before, and at most two days after."
              : "The full transcript stays here. The model continues from a summary."}
          </span>
        </span>
      </button>
      {open ? (
        <div className="mt-3 space-y-4">
          {earlier.length > 0 ? (
            earlier.map((item) => (
              <TranscriptEntry
                key={item.id}
                item={item}
                onConfirmImage={onConfirmImage}
                pendingToolCallId={pendingToolCallId}
              />
            ))
          ) : (
            <p className="whitespace-pre-wrap text-muted-foreground">{summary}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TranscriptEntry({
  item,
  onConfirmImage,
  pendingToolCallId,
}: {
  item: TranscriptItem;
  onConfirmImage?: (toolCallId: string) => Promise<void>;
  pendingToolCallId?: string | null;
}) {
  if (item.kind === "user") {
    return (
      <div className="ml-auto max-w-[40rem] rounded-2xl bg-secondary px-4 py-3 text-[15px] leading-7">
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
    return <p className="text-center text-xs tracking-wide text-muted-foreground">{item.content.split("\n")[0]}</p>;
  }
  const parts = item.parts.filter((part) => !isOpenQuestion(part, pendingToolCallId));
  if (!item.reasoning && parts.length === 0) return null;
  return (
    <article className="max-w-[46rem] space-y-3 text-[15px]">
      {item.reasoning ? <Thinking text={item.reasoning} /> : null}
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <AssistantText key={`${item.id}-text-${index}`} text={part.text} />
        ) : (
          <ToolOrQuestion
            key={part.id || `${item.id}-tool-${index}`}
            part={part}
            onConfirmImage={onConfirmImage}
          />
        ),
      )}
    </article>
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

function thinkingCue(detail?: string): string | undefined {
  const cue = detail?.trim();
  if (!cue || /^thinking$/i.test(cue) || /^pass \d+ of \d+/i.test(cue)) return undefined;
  return cue;
}

function Thinking({
  text,
  streaming = false,
  detail,
  onceKey,
}: {
  text: string;
  streaming?: boolean;
  detail?: string;
  onceKey?: string;
}) {
  const [open, setOpen] = useState(streaming);
  const steps = thinkingSteps(text);
  const cue = thinkingCue(detail);
  const body = steps.length > 0 ? steps : streaming && cue ? [cue] : [];
  return (
    <div className="text-sm" aria-busy={streaming || undefined}>
      <button
        type="button"
        className="group flex w-full items-center gap-3 py-1 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Fold thinking" : "Show thinking"}
      >
        <span
          aria-hidden
          className={cn("h-px min-w-8 flex-1", streaming ? "bg-primary/50" : "bg-border", "group-hover:bg-primary/70")}
        />
        <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
          <span
            className={cn("size-1.5 rounded-full", streaming ? "bg-primary" : "bg-muted-foreground/70")}
            aria-hidden
          />
          {streaming ? <LiveThinkingText onceKey={onceKey} /> : <span>Thinking</span>}
        </span>
        <span
          aria-hidden
          className={cn("h-px min-w-8 flex-1", streaming ? "bg-primary/50" : "bg-border", "group-hover:bg-primary/70")}
        />
      </button>
      {open && body.length > 0 ? (
        <div
          className="cursor-pointer space-y-2 px-6 pt-1 pb-1 text-[13px] leading-6 text-muted-foreground"
          onClick={(event) => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) return;
            setOpen(false);
          }}
        >
          {body.map((step, index) => (
            <p key={index} className="whitespace-pre-wrap">{step}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isOpenQuestion(
  part: { kind: string; id?: string; result?: string },
  pendingToolCallId?: string | null,
): boolean {
  return part.kind === "tool" && Boolean(pendingToolCallId) && part.id === pendingToolCallId && !part.result;
}

function visibleLiveParts(parts: LivePart[]): LivePart[] {
  return parts.filter((part) => !(part.kind === "tool" && isQuestionPart(part) && !part.result));
}

function ToolOrQuestion({
  part,
  onConfirmImage,
}: {
  part: ToolPart;
  onConfirmImage?: (toolCallId: string) => Promise<void>;
}) {
  if (isQuestionPart(part)) return <QuestionCard part={part} />;
  return <ToolCard part={part} onConfirmImage={onConfirmImage} />;
}

function ToolCard({
  part,
  onConfirmImage,
}: {
  part: ToolPart;
  onConfirmImage?: (toolCallId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const summary = toolSummary(part);
  const pendingImage = imagePending(part.result);
  const status = part.pending ? "Running" : pendingImage && part.ok !== false ? "Confirm" : part.ok === false ? "Failed" : "Done";
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
            <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{status}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{summary}</span>
        </span>
        <DisclosureChevron open={open} />
      </button>
      {pendingImage ? (
        <div className="space-y-2 border-t border-border px-3 py-3">
          <p className="text-sm leading-6">{pendingImage.prompt}</p>
          <p className="text-xs text-muted-foreground">
            {pendingImage.endpointName} · {pendingImage.model}
          </p>
          {confirmError || pendingImage.error ? (
            <p className="text-sm text-destructive">{confirmError || pendingImage.error}</p>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={confirming || !onConfirmImage}
            onClick={() => {
              if (!onConfirmImage) return;
              setConfirming(true);
              setConfirmError(null);
              void onConfirmImage(part.id)
                .catch((err: unknown) => {
                  setConfirmError(err instanceof Error ? err.message : "Could not generate the image.");
                })
                .finally(() => setConfirming(false));
            }}
          >
            {confirming ? "Generating…" : pendingImage.error ? "Try again" : "Generate image"}
          </Button>
        </div>
      ) : null}
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
        <AssistantText text={view.text} />
      </div>
      {view.tools.length > 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Worked with {view.tools.join(", ")}. The tool trace stayed in the subagent.
        </p>
      ) : null}
    </div>
  );
}

function imagePending(result?: string): { prompt: string; endpointName: string; model: string; error?: string } | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result) as {
      needsConfirm?: boolean;
      prompt?: string;
      endpointName?: string;
      model?: string;
      error?: string;
    };
    if (parsed.needsConfirm !== true) return null;
    return {
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
      endpointName: typeof parsed.endpointName === "string" ? parsed.endpointName : "Image Studio",
      model: typeof parsed.model === "string" ? parsed.model : "",
      error: typeof parsed.error === "string" ? parsed.error : undefined,
    };
  } catch {
    return null;
  }
}

function argumentHint(raw: string): string {
  if (!raw.trim()) return "";
  try {
    const parsed = JSON.parse(raw) as { path?: unknown; command?: unknown };
    if (typeof parsed.path === "string" && parsed.path.trim()) return parsed.path.trim();
    if (typeof parsed.command === "string" && parsed.command.trim()) return parsed.command.trim().slice(0, 120);
  } catch {
    return "";
  }
  return "";
}

function toolSummary(part: ToolPart): string {
  if (part.pending) return argumentHint(part.arguments) || part.status || "Waiting for the tool to finish";
  if (!part.result) return part.ok === false ? "The tool failed" : "Finished";
  try {
    const parsed = JSON.parse(part.result) as {
      message?: string;
      error?: string;
      usage?: string;
      name?: string;
      path?: string;
      bytes?: number;
      url?: string;
      utc?: string;
      text?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.text === "string" && parsed.text.trim()) return parsed.text.trim().slice(0, 140);
    if (typeof parsed.message === "string") {
      return parsed.usage ? `${parsed.message} ${parsed.usage}` : parsed.message;
    }
    if (typeof parsed.path === "string" && parsed.path) {
      return typeof parsed.bytes === "number" ? `${parsed.path} · ${parsed.bytes} bytes` : parsed.path;
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
