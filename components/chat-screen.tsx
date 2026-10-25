"use client";

import { Download, PanelRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAppState } from "@/components/app-state";
import { readJson } from "@/components/client-api";
import { Composer, type ComposerAttachment } from "@/components/composer";
import { Inspector } from "@/components/inspector";
import { useOpenSidebar } from "@/components/shell";
import { SidebarToggle } from "@/components/sidebar";
import { Transcript, type LivePart } from "@/components/transcript";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readSse } from "@/lib/sse";
import type { AgentEvent, SessionRecord, StoredMessage } from "@/lib/types";

type DetailResponse = {
  session: SessionRecord;
  messages: StoredMessage[];
};

export function ChatScreen() {
  const openSidebar = useOpenSidebar();
  const {
    activeSessionId,
    setActiveSessionId,
    createSession,
    settings,
    health,
    sessions,
    refreshSessions,
    refreshMemory,
    composerSeed,
    queueComposer,
  } = useAppState();
  const [focusTick, setFocusTick] = useState(0);
  const [appliedSeed, setAppliedSeed] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionRecord | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [running, setRunning] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [live, setLive] = useState<{ parts: LivePart[]; status: string } | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [modelDraft, setModelDraft] = useState("");
  const [modelFor, setModelFor] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runFor = useRef<string | null>(null);
  const localId = useRef(0);

  if (composerSeed && composerSeed !== appliedSeed) {
    setAppliedSeed(composerSeed);
    setDraft(composerSeed);
    setFocusTick((value) => value + 1);
  }

  useEffect(() => {
    if (composerSeed) queueComposer(null);
  }, [composerSeed, queueComposer]);

  useEffect(() => {
    if (focusTick === 0) return;
    document.getElementById("composer")?.focus();
  }, [focusTick]);

  const load = useCallback(async (id: string) => {
    setThreadError(null);
    try {
      const data = await readJson<DetailResponse>(await fetch(`/api/sessions/${id}`));
      setDetail(data.session);
      setMessages(data.messages);
      setModelDraft(data.session.model);
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Could not open the session.");
    }
  }, []);

  useEffect(() => {
    if (!activeSessionId || runFor.current === activeSessionId) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/sessions/${activeSessionId}`, { signal: ac.signal });
        const data = await readJson<DetailResponse>(response);
        if (ac.signal.aborted) return;
        setThreadError(null);
        setDetail(data.session);
        setMessages(data.messages);
      } catch (err) {
        if (ac.signal.aborted) return;
        setThreadError(err instanceof Error ? err.message : "Could not open the session.");
      }
    })();
    return () => ac.abort();
  }, [activeSessionId]);

  function applyEvent(event: AgentEvent) {
    if (event.type === "iteration") {
      const label = event.phase === "answer" ? "Writing the answer" : "Tools allowed";
      setStatus(`Pass ${event.n} of ${event.max} · ${label}`);
      setLive((current) => ({ parts: current?.parts ?? [], status: `Pass ${event.n} of ${event.max}` }));
    } else if (event.type === "user") {
      setMessages((current) => {
        const index = current.findIndex((message) => message.id.startsWith("local-"));
        if (index === -1) return [...current, event.message];
        const next = [...current];
        next[index] = event.message;
        return next;
      });
    } else if (event.type === "note") {
      setMessages((current) => [...current, event.message]);
    } else if (event.type === "delta") {
      setLive((current) => appendText(current, event.text));
    } else if (event.type === "reasoning") {
      setLive((current) => appendReasoning(current, event.text));
    } else if (event.type === "tool_call") {
      setLive((current) => ({
        parts: [
          ...(current?.parts ?? []),
          {
            kind: "tool",
            id: event.call.id,
            name: event.call.name,
            arguments: event.call.arguments,
            pending: true,
          },
        ],
        status: current?.status ?? "Running a tool",
      }));
      setStatus(`Running ${event.call.name}`);
    } else if (event.type === "tool_result") {
      setLive((current) => {
        if (!current) return current;
        return {
          ...current,
          parts: current.parts.map((part) =>
            part.kind === "tool" && part.id === event.toolCallId
              ? { ...part, result: event.content, pending: false, ok: event.ok }
              : part,
          ),
        };
      });
    } else if (event.type === "compaction") {
      setStatus(event.mode === "model" ? "Compacting earlier context" : "Compacting without the model");
      setDetail((current) => (current ? { ...current, compactedSummary: event.summary } : current));
    } else if (event.type === "error") {
      setStreamError(event.message);
    }
  }

  async function runChat(sessionId: string, body: Record<string, unknown>, optimistic?: StoredMessage) {
    const abort = new AbortController();
    abortRef.current = abort;
    if (optimistic) setMessages((current) => [...current, optimistic]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...body }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      await readSse(response, (name, data) => {
        const event = data as AgentEvent;
        if (event && typeof event === "object" && "type" in event) applyEvent(event);
        else if (name === "error") setStreamError("The stream returned an unreadable event.");
      });
      await load(sessionId);
      await refreshSessions();
      await refreshMemory();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("Stopped");
        if (sessionId) await load(sessionId).catch(() => undefined);
      } else {
        setMessages((current) => current.filter((message) => !message.id.startsWith("local-")));
        setStreamError(err instanceof Error ? err.message : "The turn failed.");
        if (sessionId) await load(sessionId).catch(() => undefined);
      }
    } finally {
      const stopped = abortRef.current?.signal.aborted ?? false;
      abortRef.current = null;
      runFor.current = null;
      setStreamingId(null);
      setLive(null);
      setRunning(false);
      if (!stopped) setStatus(null);
    }
  }

  async function begin(sessionId: string | null) {
    let id = sessionId;
    if (!id) {
      id = await createSession();
      setActiveSessionId(id);
    }
    runFor.current = id;
    setStreamingId(id);
    return id;
  }

  async function send() {
    const content = draft.trim();
    if ((!content && attachments.length === 0) || running) return;
    setStreamError(null);
    setRunning(true);
    setStatus("Sending");
    setLive({ parts: [], status: "Sending" });
    let sessionId = activeSessionId;
    try {
      sessionId = await begin(sessionId);
      localId.current += 1;
      const optimistic: StoredMessage = {
        id: `local-${localId.current}`,
        sessionId,
        seq: -1,
        role: "user",
        content: content || "Look at the attached files.",
        toolCalls: null,
        toolCallId: null,
        toolName: null,
        reasoning: null,
        attachments: attachments.map((file, index) => ({
          id: `local-file-${index}`,
          name: file.name,
          mediaType: file.mediaType,
          kind: file.dataUrl ? "image" : "text",
        })),
        createdAt: 0,
      };
      const files = attachments;
      setDraft("");
      setAttachments([]);
      await runChat(sessionId, { content, attachments: files }, optimistic);
    } catch (err) {
      setRunning(false);
      setLive(null);
      setStreamError(err instanceof Error ? err.message : "The turn failed.");
    }
  }

  async function retryLast() {
    if (!activeSessionId || running) return;
    setStreamError(null);
    setRunning(true);
    setStatus("Retrying");
    setLive({ parts: [], status: "Retrying" });
    setMessages((current) => {
      const lastUser = [...current].reverse().find((message) => message.role === "user");
      if (!lastUser) return current;
      return current.filter((message) => message.seq <= lastUser.seq || message.seq < 0);
    });
    try {
      const sessionId = await begin(activeSessionId);
      await runChat(sessionId, { retry: true });
    } catch (err) {
      setRunning(false);
      setLive(null);
      setStreamError(err instanceof Error ? err.message : "Could not retry.");
    }
  }

  async function download(format: "md" | "json", title: string) {
    if (!activeSessionId) return;
    const response = await fetch(`/api/sessions/${activeSessionId}/export?format=${format}`);
    if (!response.ok) {
      setStreamError("Could not export this session.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safe = title.replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "") || "session";
    link.download = `${safe}.${format === "md" ? "md" : "json"}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveModel(nextModel?: string) {
    if (!detail) return;
    const model = (nextModel ?? modelDraft).trim();
    if (model === detail.model) return;
    try {
      await readJson(
        await fetch(`/api/sessions/${detail.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model }),
        }),
      );
      setDetail({ ...detail, model });
      await refreshSessions();
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : "Could not change the model.");
    }
  }

  const ownsThread =
    Boolean(activeSessionId) &&
    (detail?.id === activeSessionId || streamingId === activeSessionId);
  const threadDetail = detail?.id === activeSessionId ? detail : null;
  const activeSummary = sessions.find((session) => session.id === activeSessionId);
  const headerSource =
    activeSummary && (!threadDetail || activeSummary.updatedAt >= threadDetail.updatedAt)
      ? activeSummary.title
      : threadDetail?.title;
  const headerTitle = headerSource && headerSource !== "New session" ? headerSource : "Meridian";
  const threadMessages = ownsThread ? messages : [];
  if (threadDetail && modelFor !== threadDetail.id) {
    setModelFor(threadDetail.id);
    setModelDraft(threadDetail.model);
  }

  const modelChoices = [...new Set([...(settings?.models ?? []), ...(health?.models ?? [])])].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const canRetry = threadMessages.some((message) => message.role === "user");
  const offline = Boolean(settings?.baseUrl) && health !== null && !health.ok;

  const disabledReason = !settings
    ? null
    : !settings.baseUrl
      ? "Set the LM Studio URL in settings before sending."
      : !(threadDetail?.model || settings.model || modelDraft)
        ? "Set a model id before sending."
        : null;

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 md:px-4">
          <SidebarToggle onOpen={openSidebar} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl leading-none">
              {headerTitle}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {threadDetail ? "Prompt snapshot frozen for this session" : "Sessions, skills, and a short memory"}
            </p>
          </div>
          {threadDetail ? (
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Export markdown" onClick={() => void download("md", headerTitle)}>
                <Download />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => void download("json", headerTitle)}>
                JSON
              </Button>
            </div>
          ) : null}
          <label className="flex min-w-0 items-center gap-2">
            <span className="hidden text-[11px] tracking-wide text-muted-foreground uppercase sm:inline">Model</span>
            {modelChoices.length > 0 ? (
              <select
                aria-label="Model for this session"
                className="h-8 max-w-40 rounded-lg border border-input bg-background px-2 text-xs md:max-w-56"
                value={modelDraft || settings?.model || ""}
                disabled={!threadDetail || running}
                onChange={(event) => {
                  setModelDraft(event.target.value);
                  void saveModel(event.target.value);
                }}
              >
                {!modelDraft || modelChoices.includes(modelDraft) ? null : <option value={modelDraft}>{modelDraft}</option>}
                {modelChoices.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={modelDraft}
                onChange={(event) => setModelDraft(event.target.value)}
                onBlur={() => void saveModel()}
                placeholder={settings?.model || "model id"}
                aria-label="Model id for this session"
                className="w-32 md:w-56"
                disabled={!threadDetail || running}
              />
            )}
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open skills and memory"
            onClick={() => setInspectorOpen(true)}
            className="xl:hidden"
          >
            <PanelRight />
          </Button>
        </header>
        {offline ? (
          <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="status">
            LM Studio is offline{health?.error ? `: ${health.error}` : "."}
            {health?.stale ? " The last model list is still available." : ""}
          </p>
        ) : null}
        <Transcript
          messages={threadMessages}
          live={ownsThread ? live : null}
          compactedSummary={threadDetail?.compactedSummary ?? null}
          loading={Boolean(activeSessionId) && !ownsThread && !threadError}
          error={threadError}
          onRetry={() => {
            if (activeSessionId) void load(activeSessionId);
          }}
          empty={
            activeSessionId ? (
              <EmptySession />
            ) : (
              <Welcome
                onStart={() =>
                  void createSession()
                    .then((id) => setActiveSessionId(id))
                    .catch((err) =>
                      setStreamError(err instanceof Error ? err.message : "Could not start a session."),
                    )
                }
              />
            )
          }
        />
        {streamError ? (
          <p className="mx-auto w-full max-w-3xl px-4 pb-2 text-sm text-destructive md:px-6">{streamError}</p>
        ) : null}
        <Composer
          draft={draft}
          onDraft={setDraft}
          attachments={attachments}
          onAttachments={setAttachments}
          onAttachError={setStreamError}
          onSubmit={() => void send()}
          onStop={() => abortRef.current?.abort()}
          onRetry={() => void retryLast()}
          canRetry={canRetry}
          running={running}
          status={status}
          disabledReason={disabledReason}
        />
      </section>
      <Inspector
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        systemPrompt={threadDetail?.systemPrompt ?? null}
        onInsertSkill={(name) => {
          setDraft((current) => {
            const prefix = `/skill:${name} `;
            return current.startsWith(prefix) ? current : `${prefix}${current}`;
          });
          setInspectorOpen(false);
        }}
      />
      {inspectorOpen ? (
        <button
          type="button"
          aria-label="Close skills and memory"
          className="fixed inset-0 z-20 bg-black/40 xl:hidden"
          onClick={() => setInspectorOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto max-w-lg pt-16">
      <p className="font-display text-5xl leading-none tracking-tight">Meridian</p>
      <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
        A personal agent for the model running on your machine. Point it at LM Studio — a Tailscale MagicDNS
        URL works — then keep sessions, a skill index, and two short memory files here.
      </p>
      <Button type="button" className="mt-6" onClick={onStart}>
        Start a session
      </Button>
    </div>
  );
}

function EmptySession() {
  return (
    <div className="max-w-lg pt-10 text-[15px] leading-7 text-muted-foreground">
      <p>This session is empty. Its prompt snapshot is already frozen.</p>
      <ul className="mt-4 list-disc space-y-1 pl-5">
        <li>Tell it something it should still know next time.</li>
        <li>Paste a function and ask what it actually does.</li>
        <li>
          Type <span className="font-mono text-foreground">/skill:daily-planning</span> and name the day.
        </li>
      </ul>
    </div>
  );
}

function appendText(
  current: { parts: LivePart[]; status: string } | null,
  text: string,
): { parts: LivePart[]; status: string } {
  const parts = current?.parts ?? [];
  const last = parts[parts.length - 1];
  if (last?.kind === "text") {
    return {
      status: current?.status ?? "Writing",
      parts: [...parts.slice(0, -1), { kind: "text", text: last.text + text }],
    };
  }
  return { status: current?.status ?? "Writing", parts: [...parts, { kind: "text", text }] };
}

function appendReasoning(
  current: { parts: LivePart[]; status: string } | null,
  text: string,
): { parts: LivePart[]; status: string } {
  const parts = current?.parts ?? [];
  const last = parts[parts.length - 1];
  if (last?.kind === "reasoning") {
    return {
      status: current?.status ?? "Thinking",
      parts: [...parts.slice(0, -1), { kind: "reasoning", text: last.text + text }],
    };
  }
  return { status: current?.status ?? "Thinking", parts: [...parts, { kind: "reasoning", text }] };
}
