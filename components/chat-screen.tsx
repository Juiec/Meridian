"use client";

import { Download, PanelRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { useAppState } from "@/components/app-state";
import { readJson } from "@/components/client-api";
import { Composer, type ComposerAttachment, type ComposerTool } from "@/components/composer";
import { Inspector } from "@/components/inspector";
import { QuestionCard } from "@/components/question-card";
import { useOpenSidebar } from "@/components/shell-context";
import { SidebarToggle } from "@/components/sidebar";
import { Transcript, type LivePart } from "@/components/transcript";
import type { ToolPart } from "@/lib/group-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAnswerPayload, findPendingQuestion } from "@/lib/ask-user";
import { CONTEXT_CLEANED_PREFIX, type ContextUsage } from "@/lib/context-usage";
import { insertSkillToken } from "@/lib/slash-menu";
import { readSse } from "@/lib/sse";
import type { AgentEvent, SessionRecord, StoredMessage } from "@/lib/types";
import type { ToolsOverview } from "@/lib/tool-types";

type DetailResponse = {
  session: SessionRecord;
  messages: StoredMessage[];
};

function readStoredDesk(): boolean {
  try {
    return localStorage.getItem("meridian-desk-collapsed") === "1";
  } catch {
    return false;
  }
}

let deskCollapsedValue = false;
const deskListeners = new Set<() => void>();

function subscribeDesk(listener: () => void) {
  deskListeners.add(listener);
  return () => {
    deskListeners.delete(listener);
  };
}

function getDeskCollapsed() {
  return deskCollapsedValue;
}

function writeDeskCollapsed(next: boolean) {
  deskCollapsedValue = next;
  try {
    localStorage.setItem("meridian-desk-collapsed", next ? "1" : "0");
  } catch {
    /* The choice still applies for this visit. */
  }
  for (const listener of deskListeners) listener();
}

if (typeof window !== "undefined") deskCollapsedValue = readStoredDesk();

export function ChatScreen({
  embedded = false,
  embeddedSessionId,
  headerPortal = null,
  companion = false,
}: {
  embedded?: boolean;
  embeddedSessionId?: string | null;
  headerPortal?: HTMLElement | null;
  /** Chat column kept beside Image Studio or Travel Planner. */
  companion?: boolean;
} = {}) {
  const openSidebar = useOpenSidebar();
  const {
    activeSessionId: selectedSessionId,
    setActiveSessionId,
    createSession,
    settings,
    health,
    sessions,
    refreshSessions,
    refreshMemory,
    composerSeed,
    queueComposer,
    skills,
  } = useAppState();
  const activeSessionId = embedded ? embeddedSessionId ?? null : selectedSessionId;
  const [focusTick, setFocusTick] = useState(0);
  const [appliedSeed, setAppliedSeed] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionRecord | null>(null);
  const [titleOverride, setTitleOverride] = useState<{ sessionId: string; title: string } | null>(null);
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
  const [streamedQuestion, setStreamedQuestion] = useState<ToolPart | null>(null);
  const deskCollapsed = useSyncExternalStore(subscribeDesk, getDeskCollapsed, () => false);
  const [toolCatalog, setToolCatalog] = useState<ComposerTool[]>([]);
  const [modelDraft, setModelDraft] = useState("");
  const [modelFor, setModelFor] = useState<string | null>(null);
  const [endpointDraft, setEndpointDraft] = useState("");
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const [tripDayState, setTripDayState] = useState<{ id: string; days: number[]; focus: number | null } | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const runFor = useRef<string | null>(null);
  const roundRef = useRef<{ n: number; max: number } | null>(null);
  const localId = useRef(0);

  if (!embedded && composerSeed && composerSeed !== appliedSeed) {
    setAppliedSeed(composerSeed);
    setDraft((current) => {
      if (!current.trim()) return composerSeed;
      if (current.includes(composerSeed)) return current;
      return `${current.replace(/\s+$/, "")}\n${composerSeed}`;
    });
    setFocusTick((value) => value + 1);
  }

  useEffect(() => {
    if (!embedded && composerSeed) queueComposer(null);
  }, [composerSeed, embedded, queueComposer]);

  useEffect(() => {
    if (focusTick === 0) return;
    document.getElementById("composer")?.focus();
  }, [focusTick]);

  function toggleDesk() {
    writeDeskCollapsed(!deskCollapsed);
  }

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const data = await readJson<ToolsOverview>(await fetch("/api/tools", { signal: ac.signal }));
        if (ac.signal.aborted) return;
        setToolCatalog(data.catalog.map((item) => ({ name: item.name, description: item.description })));
      } catch {
        /* Modes and skills still appear in the slash menu. */
      }
    })();
    return () => ac.abort();
  }, []);

  const contextTicket = useRef(0);
  const refreshContext = useCallback(async (id: string) => {
    const ticket = ++contextTicket.current;
    try {
      const data = await readJson<{ context: ContextUsage }>(await fetch(`/api/sessions/${id}/context`));
      if (contextTicket.current === ticket) setContextUsage(data.context);
    } catch {
      if (contextTicket.current === ticket) setContextUsage(null);
    }
  }, []);

  const load = useCallback(async (id: string): Promise<StoredMessage[] | null> => {
    setThreadError(null);
    try {
      const data = await readJson<DetailResponse>(await fetch(`/api/sessions/${id}`));
      setDetail(data.session);
      setMessages(data.messages);
      setModelDraft(data.session.model);
      setEndpointDraft(data.session.endpointId);
      void refreshContext(id);
      return data.messages;
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : "Could not open the session.");
      return null;
    }
  }, [refreshContext]);

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
        setModelDraft(data.session.model);
        void refreshContext(activeSessionId);
        setEndpointDraft(data.session.endpointId);
        setStatus(findPendingQuestion(data.messages) ? "Waiting for your answer" : null);
      } catch (err) {
        if (ac.signal.aborted) return;
        setThreadError(err instanceof Error ? err.message : "Could not open the session.");
      }
    })();
    return () => ac.abort();
  }, [activeSessionId, refreshContext]);

  const travelPlanId = detail?.purpose === "travel" && detail.id === activeSessionId ? detail.id : null;
  const tripDays = tripDayState?.id === travelPlanId ? tripDayState.days : [];
  const focusDay = tripDayState?.id === travelPlanId ? tripDayState.focus : null;

  useEffect(() => {
    if (!travelPlanId) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const data = await readJson<{ places: Array<{ day: number | null }> }>(
          await fetch(`/api/travel?trip=${encodeURIComponent(travelPlanId)}`, { signal: ac.signal }),
        );
        if (ac.signal.aborted) return;
        const days = [...new Set(data.places.map((place) => place.day).filter((day): day is number => typeof day === "number"))]
          .sort((a, b) => a - b);
        setTripDayState((current) => ({
          id: travelPlanId,
          days,
          focus: current?.id === travelPlanId && current.focus && days.includes(current.focus)
            ? current.focus
            : days[days.length - 1] ?? null,
        }));
      } catch {
        if (!ac.signal.aborted) setTripDayState({ id: travelPlanId, days: [], focus: null });
      }
    })();
    return () => ac.abort();
  }, [travelPlanId]);

  function applyEvent(event: AgentEvent, sessionId: string) {
    if (event.type === "title") {
      setTitleOverride({ sessionId, title: event.title });
      setDetail((current) =>
        current?.id === sessionId ? { ...current, title: event.title, updatedAt: Date.now() } : current,
      );
      void refreshSessions().catch((err) => {
        setStreamError(err instanceof Error ? `Could not refresh chat list: ${err.message}` : "Could not refresh chat list.");
      });
    } else if (event.type === "title_error") {
      setStreamError(event.message);
    } else if (event.type === "iteration") {
      roundRef.current = { n: event.n, max: event.max };
      if (event.phase === "answer") {
        setStatus("Writing the answer");
        setLive((current) => ({ parts: current?.parts ?? [], status: "Writing" }));
      } else {
        setStatus("Thinking");
        setLive((current) => ({ parts: current?.parts ?? [], status: "Thinking" }));
      }
    } else if (event.type === "partial") {
      setMessages((current) => [...current, event.message]);
      setLive((current) =>
        current ? { parts: current.parts.filter((part) => part.kind === "tool"), status: "Steering" } : current,
      );
      setStatus("Steering");
    } else if (event.type === "user") {
      setMessages((current) => {
        const index = current.findIndex((message) => message.role === "user" && message.id.startsWith("local-"));
        if (index === -1) return [...current, event.message];
        const next = [...current];
        next[index] = event.message;
        return next;
      });
    } else if (event.type === "question") {
      setStatus("Waiting for your answer");
      setStreamedQuestion({
        kind: "tool",
        id: event.toolCallId,
        name: "ask_user",
        arguments: JSON.stringify({ prompt: event.prompt, options: event.options }),
        awaitingUser: true,
      });
      setLive((current) => {
        const parts = (current?.parts ?? []).map((part) =>
          part.kind === "tool" && part.id === event.toolCallId
            ? { ...part, pending: false, awaitingUser: true }
            : part,
        );
        return { parts, status: "Waiting for your answer" };
      });
    } else if (event.type === "note") {
      setMessages((current) => [...current, event.message]);
    } else if (event.type === "delta") {
      setLive((current) => appendText(current, event.text));
    } else if (event.type === "reasoning") {
      setLive((current) => appendReasoning(current, event.text));
    } else if (event.type === "tool_call") {
      const round = roundRef.current;
      const running = `Running ${event.call.name}`;
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
        status: running,
      }));
      setStatus(round && round.n > 1 ? `Pass ${round.n} of ${round.max} · ${running}` : running);
    } else if (event.type === "subagent") {
      setStatus(event.detail);
      setLive((current) => {
        if (!current) return { parts: [], status: event.detail };
        return {
          ...current,
          status: event.detail,
          parts: current.parts.map((part) =>
            part.kind === "tool" && part.pending && part.name === "delegate" ? { ...part, status: event.detail } : part,
          ),
        };
      });
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

  async function runChat(sessionId: string, body: Record<string, unknown>, optimistic?: StoredMessage[]) {
    let waiting = false;
    const abort = new AbortController();
    abortRef.current = abort;
    if (optimistic && optimistic.length > 0) setMessages((current) => [...current, ...optimistic]);
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
        if (event && typeof event === "object" && "type" in event) {
          if (event.type === "done" && event.awaiting === "question") waiting = true;
          applyEvent(event, sessionId);
        } else if (name === "error") setStreamError("The stream returned an unreadable event.");
      });
      const loaded = await load(sessionId);
      if (loaded) waiting = findPendingQuestion(loaded) !== null;
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
      if (!waiting) setStreamedQuestion(null);
      if (!stopped) setStatus(waiting ? "Waiting for your answer" : null);
    }
  }

  async function begin(sessionId: string | null) {
    let id = sessionId;
    if (!id) {
      if (embedded) throw new Error("The travel conversation is not ready yet.");
      id = await createSession();
      runFor.current = id;
      setStreamingId(id);
      setActiveSessionId(id);
      await load(id);
      return id;
    }
    runFor.current = id;
    setStreamingId(id);
    return id;
  }

  async function cleanContext() {
    if (!activeSessionId || running || cleaning) return;
    setCleaning(true);
    setStreamError(null);
    try {
      const body = detail?.purpose === "travel" && focusDay ? { day: focusDay } : {};
      const data = await readJson<{ context: ContextUsage }>(
        await fetch(`/api/sessions/${activeSessionId}/context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setContextUsage(data.context);
      await load(activeSessionId);
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : "Could not clean context.");
    } finally {
      setCleaning(false);
    }
  }

  async function submit(text: string, files: ComposerAttachment[]) {
    const content = text.trim();
    if (sendingRef.current || running) return;
    if (!content && files.length === 0) return;
    sendingRef.current = true;
    setStreamError(null);
    setRunning(true);
    setStatus("Sending");
    setLive({ parts: [], status: "Sending" });
    let sessionId = activeSessionId;
    try {
      sessionId = await begin(sessionId);
      localId.current += 1;
      const pending = findPendingQuestion(messages);
      const answerText = content || "Look at the attached files.";
      const answered = pending ? askAnswerPayload(pending.options, answerText) : null;
      const optimistic: StoredMessage[] = [];
      if (pending && answered) {
        optimistic.push({
          id: `local-tool-${localId.current}`,
          sessionId,
          seq: -1,
          role: "tool",
          content: JSON.stringify(answered, null, 2),
          toolCalls: null,
          toolCallId: pending.call.id,
          toolName: "ask_user",
          reasoning: null,
          attachments: [],
          createdAt: Date.now(),
        });
      }
      if (!pending || files.length > 0) {
        optimistic.push({
          id: `local-${localId.current}`,
          sessionId,
          seq: -1,
          role: "user",
          content: answered?.answer ?? answerText,
          toolCalls: null,
          toolCallId: null,
          toolName: null,
          reasoning: null,
          attachments: files.map((file, index) => ({
            id: `local-file-${index}`,
            name: file.name,
            mediaType: file.mediaType,
            kind: file.dataUrl ? "image" : "text",
            text: file.text,
            dataUrl: file.dataUrl,
          })),
          createdAt: Date.now(),
        });
      }
      await runChat(sessionId, { content, attachments: files }, optimistic);
    } catch (err) {
      setRunning(false);
      setLive(null);
      setStreamError(err instanceof Error ? err.message : "The turn failed.");
    } finally {
      sendingRef.current = false;
    }
  }

  function send() {
    const content = draft.trim();
    const files = attachments;
    if ((!content && files.length === 0) || running) return;
    setDraft("");
    setAttachments([]);
    void submit(content, files);
  }

  function chooseDirection(label: string) {
    if (running || sendingRef.current) return;
    setDraft("");
    document.getElementById("composer")?.focus();
    void submit(label, []);
  }

  async function steer() {
    const content = draft.trim();
    if (!content || !activeSessionId || !running || attachments.length > 0) return;
    setStreamError(null);
    setDraft("");
    localId.current += 1;
    const optimistic: StoredMessage = {
      id: `local-${localId.current}`,
      sessionId: activeSessionId,
      seq: -1,
      role: "user",
      content,
      toolCalls: null,
      toolCallId: null,
      toolName: null,
      reasoning: null,
      attachments: [],
      createdAt: Date.now(),
    };
    setMessages((current) => [...current, optimistic]);
    setStatus("Steering");
    try {
      const response = await fetch(`/api/sessions/${activeSessionId}/steer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not steer.");
      }
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setDraft(content);
      setStreamError(err instanceof Error ? err.message : "Could not steer.");
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

  async function saveModel(nextModel?: string, nextEndpointId?: string) {
    if (!detail) return;
    const model = (nextModel ?? modelDraft).trim();
    const endpointId = nextEndpointId ?? endpointDraft ?? detail.endpointId;
    if (model === detail.model && endpointId === detail.endpointId) return;
    try {
      await readJson(
        await fetch(`/api/sessions/${detail.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, endpointId }),
        }),
      );
      setDetail({ ...detail, model, endpointId });
      setEndpointDraft(endpointId);
      await refreshSessions();
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : "Could not change the endpoint or model.");
    }
  }

  const ownsThread =
    Boolean(activeSessionId) &&
    (detail?.id === activeSessionId || streamingId === activeSessionId);
  const threadDetail = detail?.id === activeSessionId ? detail : null;
  const activeSummary = sessions.find((session) => session.id === activeSessionId);
  const headerSource =
    titleOverride?.sessionId === activeSessionId
      ? titleOverride.title
      : activeSummary && (!threadDetail || activeSummary.updatedAt >= threadDetail.updatedAt)
        ? activeSummary.title
        : threadDetail?.title;
  const headerTitle = headerSource && headerSource !== "New session" ? headerSource : "Meridian";
  const threadMessages = ownsThread ? messages : [];
  const pendingQuestion = ownsThread ? findPendingQuestion(threadMessages) : null;
  const pendingId = pendingQuestion?.call.id ?? null;
  if (pendingId && streamedQuestion) setStreamedQuestion(null);
  const pinnedQuestion: ToolPart | null = pendingQuestion
    ? {
        kind: "tool",
        id: pendingQuestion.call.id,
        name: "ask_user",
        arguments: pendingQuestion.call.arguments,
        awaitingUser: true,
      }
    : streamedQuestion;
  if (threadDetail && modelFor !== threadDetail.id) {
    setModelFor(threadDetail.id);
    setModelDraft(threadDetail.model);
    setEndpointDraft(threadDetail.endpointId);
  }

  const preferredEndpointId =
    threadDetail?.endpointId ||
    endpointDraft ||
    (settings?.endpoints.some((endpoint) => endpoint.id === "default") ? "default" : settings?.endpointId) ||
    "";
  const selectedEndpoint =
    settings?.endpoints.find((endpoint) => endpoint.id === preferredEndpointId) ??
    settings?.endpoints.find((endpoint) => endpoint.id === settings.endpointId);
  const selectedEndpointId = selectedEndpoint?.id ?? preferredEndpointId;
  const modelChoices = selectedEndpoint?.models ?? settings?.models ?? [];
  const canRetry = threadMessages.some((message) => message.role === "user");
  const offline = Boolean(selectedEndpoint?.baseUrl) && health?.endpointId === selectedEndpointId && !health.ok;

  const disabledReason = !settings
    ? null
    : !selectedEndpoint?.baseUrl
      ? "Set this endpoint’s URL in settings before sending."
      : !(threadDetail?.model || selectedEndpoint.model || modelDraft)
        ? "Set a model id before sending."
        : null;
  const foldedThroughSeq =
    threadDetail?.compactedSummary?.startsWith(CONTEXT_CLEANED_PREFIX) ? threadDetail.compactedUntilSeq : null;
  const cleanControls = threadDetail ? (
    <div className="flex items-center gap-1.5">
      {threadDetail.purpose === "travel" && tripDays.length > 0 ? (
        <label className="flex items-center gap-1.5">
          <span className="hidden text-[11px] tracking-wide text-muted-foreground uppercase sm:inline">Day</span>
          <select
            aria-label="Day to keep in context"
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
            value={focusDay ?? tripDays[tripDays.length - 1]}
            disabled={running || cleaning}
            onChange={(event) => {
              const next = Number(event.target.value);
              setTripDayState((current) =>
                current && current.id === travelPlanId ? { ...current, focus: next } : current,
              );
            }}
          >
            {tripDays.map((day) => (
              <option key={day} value={day}>
                Day {day}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        disabled={running || cleaning}
        onClick={() => void cleanContext()}
      >
        {cleaning ? "Cleaning" : "Clean context"}
      </Button>
    </div>
  ) : null;
  const endpointControls = companion ? null : (
    <>
      {(settings?.endpoints.length ?? 0) > 1 ? (
        <label className="flex items-center gap-1.5">
          <span className="hidden text-[11px] tracking-wide text-muted-foreground uppercase sm:inline">Host</span>
          <select
            aria-label="Endpoint for this session"
            className="h-8 max-w-36 rounded-lg border border-input bg-background px-2 text-xs md:max-w-48"
            value={selectedEndpointId}
            disabled={!threadDetail || running}
            onChange={(event) => {
              const nextEndpointId = event.target.value;
              const nextEndpoint = settings?.endpoints.find((endpoint) => endpoint.id === nextEndpointId);
              const nextModel =
                nextEndpoint?.models.includes(modelDraft)
                  ? modelDraft
                  : nextEndpoint?.model || nextEndpoint?.models[0] || "";
              setEndpointDraft(nextEndpointId);
              setModelDraft(nextModel);
              void saveModel(nextModel, nextEndpointId);
            }}
          >
            {settings?.endpoints.map((endpoint) => (
              <option key={endpoint.id} value={endpoint.id}>{endpoint.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex min-w-0 items-center gap-2">
        <span className="hidden text-[11px] tracking-wide text-muted-foreground uppercase sm:inline">Model</span>
        {modelChoices.length > 0 ? (
          <select
            aria-label="Model for this session"
            className="h-8 w-44 rounded-lg border border-input bg-background px-2 text-xs md:w-80"
            value={modelDraft || threadDetail?.model || selectedEndpoint?.model || ""}
            disabled={!threadDetail || running}
            onChange={(event) => {
              setModelDraft(event.target.value);
              void saveModel(event.target.value);
            }}
          >
            {!modelDraft || modelChoices.includes(modelDraft) ? null : <option value={modelDraft}>{modelDraft}</option>}
            {modelChoices.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        ) : (
          <Input
            value={modelDraft}
            onChange={(event) => setModelDraft(event.target.value)}
            onBlur={() => void saveModel()}
            placeholder={selectedEndpoint?.model || "model id"}
            aria-label="Model id for this session"
            className="w-32 md:w-56"
            disabled={!threadDetail || running}
          />
        )}
      </label>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
{embedded && headerPortal ? createPortal(
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl leading-none">Trip conversation</p>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <p className="truncate text-xs text-muted-foreground">Separate from your chat sessions</p>
                <ContextMeter usage={threadDetail ? contextUsage : null} />
              </div>
            </div>
            {cleanControls}
            {endpointControls}
          </div>,
          headerPortal,
        ) : (
          <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 md:px-4">
            {embedded ? null : companion ? (
              <Link href="/" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                All chats
              </Link>
            ) : (
              <SidebarToggle onOpen={openSidebar} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl leading-none">
                {embedded ? "Trip conversation" : headerTitle}
              </p>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <p className="truncate text-xs text-muted-foreground">
                  {embedded
                    ? "Separate from your chat sessions"
                    : threadDetail
                      ? "Prompt snapshot frozen for this session"
                      : "Sessions, skills, and a short memory"}
                </p>
                <ContextMeter usage={threadDetail ? contextUsage : null} />
              </div>
            </div>
            {cleanControls}
            {threadDetail && !embedded && !companion ? (
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Export markdown" onClick={() => void download("md", headerTitle)}>
                  <Download />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => void download("json", headerTitle)}>
                  JSON
                </Button>
              </div>
            ) : null}
            {endpointControls}
            {!embedded && !companion ? (
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
            ) : null}
          </header>
        )}
        {offline ? (
          <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="status">
            LM Studio is offline{health?.error ? `: ${health.error}` : "."}
            {health?.stale ? " The last model list is still available." : ""}
          </p>
        ) : null}
        {pinnedQuestion ? (
          <div className="border-b border-border bg-background px-4 py-3 md:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <QuestionCard part={pinnedQuestion} onAnswer={!running ? chooseDirection : undefined} />
            </div>
          </div>
        ) : null}
        <Transcript
          messages={threadMessages}
          live={ownsThread ? live : null}
          compactedSummary={threadDetail?.compactedSummary ?? null}
          foldedThroughSeq={foldedThroughSeq}
          loading={Boolean(activeSessionId) && !ownsThread && !threadError}
          error={threadError}
          pendingToolCallId={pendingId}
          onRetry={() => {
            if (activeSessionId) void load(activeSessionId);
          }}
          onConfirmImage={async (toolCallId) => {
            if (!activeSessionId) return;
            const data = await readJson<{ content: string }>(
              await fetch("/api/images/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: activeSessionId, toolCallId }),
              }),
            );
            setMessages((current) =>
              current.map((message) =>
                message.role === "tool" && message.toolCallId === toolCallId ? { ...message, content: data.content } : message,
              ),
            );
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
          onSteer={() => void steer()}
          onStop={() => abortRef.current?.abort()}
          onRetry={() => void retryLast()}
          canRetry={canRetry}
          running={running}
          status={status}
          disabledReason={disabledReason}
          awaitingQuestion={Boolean(pinnedQuestion)}
          chatMode={detail?.chatMode ?? "agent"}
          skills={skills}
          tools={toolCatalog}
        />
      </section>
      {!embedded && !companion ? (
        <Inspector
          open={inspectorOpen}
          collapsed={deskCollapsed}
          onToggleCollapsed={toggleDesk}
          onClose={() => setInspectorOpen(false)}
          systemPrompt={threadDetail?.systemPrompt ?? null}
          onInsertSkill={(name) => {
            setDraft((current) => insertSkillToken(current, name));
            setInspectorOpen(false);
          }}
        />
      ) : null}
      {!embedded && !companion && inspectorOpen ? (
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
          Type <span className="font-mono text-foreground">/daily-planning</span> and name the day.
        </li>
      </ul>
    </div>
  );
}

function formatCount(value: number): string {
  if (value < 1000) return String(value);
  const scaled = value / 1000;
  return `${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1)}k`;
}

function ContextMeter({ usage }: { usage: ContextUsage | null }) {
  if (!usage) return null;
  const limit = usage.limitTokens;
  const pct = limit ? Math.min(100, Math.round((usage.tokens / limit) * 100)) : null;
  const label = limit
    ? `~${formatCount(usage.tokens)} / ${formatCount(limit)} tokens`
    : `~${formatCount(usage.tokens)} tokens`;
  const thinking = usage.thinkingChars > 0 ? ` · ${formatCount(usage.thinkingChars)} thinking` : "";
  return (
    <div
      className="flex shrink-0 items-center gap-2"
      title="Approximate size of the prompt, history, and tools on the next turn. Thinking is stored with the chat and is not sent."
    >
      {pct !== null ? (
        <div
          className="h-1 w-14 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Context used"
          aria-valuemin={0}
          aria-valuemax={limit ?? 0}
          aria-valuenow={Math.min(usage.tokens, limit ?? usage.tokens)}
        >
          <div className={`h-full ${pct > 80 ? "bg-destructive" : "bg-copper"}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      <span className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
        {label}
        {thinking}
      </span>
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
      status: "Thinking",
      parts: [...parts.slice(0, -1), { kind: "reasoning", text: last.text + text }],
    };
  }
  return { status: "Thinking", parts: [...parts, { kind: "reasoning", text }] };
}
