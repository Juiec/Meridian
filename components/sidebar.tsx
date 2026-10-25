"use client";

import { Archive, Compass, Menu, Pencil, Plus, Settings, Star, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAppState } from "@/components/app-state";
import { readJson } from "@/components/client-api";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { relativeStamp } from "@/lib/format";
import type { SessionSummary } from "@/lib/types";
import { cn } from "cn";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sessions,
    sessionsLoading,
    sessionsError,
    refreshSessions,
    createSession,
    renameSession,
    deleteSession,
    activeSessionId,
    setActiveSessionId,
    now,
    health,
    healthChecking,
  } = useAppState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SessionSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SessionSummary[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSessions, setArchivedSessions] = useState<SessionSummary[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  async function startNew() {
    setBusy(true);
    setActionError(null);
    try {
      const id = await createSession();
      setActiveSessionId(id);
      onClose();
      if (pathname !== "/") router.push("/");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not start a session.");
    } finally {
      setBusy(false);
    }
  }

  function selectSession(id: string) {
    setActiveSessionId(id);
    onClose();
    if (pathname !== "/") router.push("/");
  }

  async function saveTitle(id: string) {
    const title = titleDraft.trim();
    setEditingId(null);
    if (!title) return;
    try {
      await renameSession(id, title);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not rename the session.");
    }
  }

  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await readJson<{ sessions: SessionSummary[] }>(
            await fetch(`/api/sessions?q=${encodeURIComponent(term)}&archived=all`, { signal: ac.signal }),
          );
          if (!ac.signal.aborted) setMatches(data.sessions);
        } catch (err) {
          if (!ac.signal.aborted) {
            setActionError(err instanceof Error ? err.message : "Search failed.");
          }
        }
      })();
    }, 200);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!showArchived) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const data = await readJson<{ sessions: SessionSummary[] }>(
          await fetch("/api/sessions?archived=only", { signal: ac.signal }),
        );
        if (!ac.signal.aborted) setArchivedSessions(data.sessions);
      } catch {
        if (!ac.signal.aborted) setArchivedSessions([]);
      }
    })();
    return () => ac.abort();
  }, [showArchived, sessions]);

  async function patchSession(id: string, body: { pinned?: boolean; archived?: boolean }) {
    setActionError(null);
    await readJson(
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    await refreshSessions();
  }

  async function importFile(file: File) {
    setBusy(true);
    setActionError(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const data = await readJson<{ session: SessionSummary }>(
        await fetch("/api/sessions/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        }),
      );
      await refreshSessions();
      selectSession(data.session.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not import that file.");
    } finally {
      setBusy(false);
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteSession(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete the session.");
    } finally {
      setBusy(false);
    }
  }

  const visible = query.trim() ? (matches ?? []) : sessions;
  const statusLabel = healthChecking
    ? "Checking LM Studio"
    : health?.ok
      ? `Reachable · ${health.models.length} model${health.models.length === 1 ? "" : "s"}`
      : health?.error
        ? "Unreachable"
        : "Not checked";

  return (
    <aside
      className={cn(
        "z-30 flex h-full w-[min(100%,18.5rem)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        open ? "fixed inset-y-0 left-0 flex md:static" : "hidden md:flex",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <Link href="/" className="group" onClick={onClose}>
          <span className="font-display text-[1.65rem] leading-none tracking-tight">Meridian</span>
          <span className="mt-1 block text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            Personal agent
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Close sessions"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>
      <div className="space-y-2 px-3 pb-3">
        <Button type="button" className="w-full" onClick={() => void startNew()} disabled={busy}>
          <Plus />
          New session
        </Button>
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setMatches(null);
          }}
          placeholder="Search title or transcript"
          aria-label="Search sessions"
        />
      </div>
      <nav aria-label="Sessions" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {sessionsLoading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Loading sessions…</p>
        ) : sessionsError ? (
          <div className="px-2 py-3">
            <p className="text-sm text-destructive">{sessionsError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void refreshSessions().catch((err) => setActionError(err.message))}
            >
              Retry
            </Button>
          </div>
        ) : query.trim() && matches === null ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Searching…</p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            {query.trim() ? "No sessions match that search." : "No sessions yet. Start one and the transcript stays on this machine."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((session) => {
              const active = session.id === activeSessionId && pathname === "/";
              return (
                <li key={session.id}>
                  {editingId === session.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveTitle(session.id);
                      }}
                    >
                      <Input
                        aria-label="Session title"
                        value={titleDraft}
                        autoFocus
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onBlur={() => void saveTitle(session.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setEditingId(null);
                        }}
                      />
                    </form>
                  ) : (
                    <div
                      className={cn(
                        "group flex items-center gap-1 rounded-lg pr-1",
                        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectSession(session.id)}
                        aria-current={active ? "page" : undefined}
                        className="min-w-0 flex-1 px-2 py-2 text-left"
                      >
                        <span className="block truncate text-sm">
                          {session.pinned ? "★ " : ""}
                          {session.title}
                          {session.archived ? " · archived" : ""}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {relativeStamp(session.updatedAt, now)}
                          {session.compacted ? " · compacted" : ""}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className={cn("opacity-100 md:opacity-0 md:group-hover:opacity-100", session.pinned && "opacity-100")}
                        aria-label={session.pinned ? `Unpin ${session.title}` : `Pin ${session.title}`}
                        onClick={() => void patchSession(session.id, { pinned: !session.pinned }).catch((err) => setActionError(err.message))}
                      >
                        <Star className={session.pinned ? "fill-current" : ""} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        aria-label={`Rename ${session.title}`}
                        onClick={() => {
                          setEditingId(session.id);
                          setTitleDraft(session.title);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        aria-label={session.archived ? `Unarchive ${session.title}` : `Archive ${session.title}`}
                        onClick={() =>
                          void patchSession(session.id, { archived: !session.archived }).catch((err) =>
                            setActionError(err instanceof Error ? err.message : "Could not archive the session."),
                          )
                        }
                      >
                        <Archive />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        aria-label={`Delete ${session.title}`}
                        onClick={() => setPendingDelete(session)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {actionError ? <p className="px-2 pt-2 text-xs text-destructive">{actionError}</p> : null}
        <button
          type="button"
          className="mt-3 px-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setShowArchived((value) => !value)}
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </button>
        {showArchived ? (
          archivedSessions.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No archived sessions.</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {archivedSessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    className="w-full truncate px-2 py-1.5 text-left text-sm text-muted-foreground"
                    onClick={() => selectSession(session.id)}
                  >
                    {session.title}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </nav>
      <div className="space-y-2 border-t border-sidebar-border p-3">
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import a session JSON file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-sidebar-accent/60"
          onClick={() => importRef.current?.click()}
        >
          <Upload className="size-4" />
          Import JSON
        </button>
        <Link
          href="/travel"
          onClick={onClose}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-2 text-sm",
            pathname === "/travel" ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
          )}
        >
          <Compass className="size-4" />
          Travel Agent
        </Link>
        <Link
          href="/settings"
          onClick={onClose}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-2 text-sm",
            pathname === "/settings" ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
          )}
        >
          <Settings className="size-4" />
          Settings
        </Link>
        <p className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              health?.ok ? "bg-sage" : health?.error ? "bg-destructive" : "bg-copper",
            )}
            aria-hidden
          />
          <span className="truncate" title={health?.error}>
            {statusLabel}
          </span>
        </p>
      </div>
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this session?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `“${pendingDelete.title}” and its transcript are removed. MEMORY and USER stay on disk.`
                : "The transcript is removed. Memory files stay."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

export function SidebarToggle({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="md:hidden"
      aria-label="Open sessions"
      onClick={onOpen}
    >
      <Menu />
    </Button>
  );
}
