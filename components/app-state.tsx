"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { readJson } from "@/components/client-api";
import type {
  HealthResult,
  MemoryView,
  PublicSettings,
  SessionSummary,
  SkillInfo,
} from "@/lib/types";

type SkillResponse = { skills: SkillInfo[]; skipped: { path: string; reason: string }[] };

type AppState = {
  now: number | null;
  sessions: SessionSummary[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  refreshSessions: () => Promise<void>;
  createSession: () => Promise<string>;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  settings: PublicSettings | null;
  refreshSettings: () => Promise<void>;
  skills: SkillInfo[];
  skippedSkills: { path: string; reason: string }[];
  refreshSkills: () => Promise<void>;
  memory: MemoryView | null;
  refreshMemory: () => Promise<void>;
  health: HealthResult | null;
  healthChecking: boolean;
  checkHealth: () => Promise<void>;
  composerSeed: string | null;
  queueComposer: (text: string | null) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [skippedSkills, setSkippedSkills] = useState<{ path: string; reason: string }[]>([]);
  const [memory, setMemory] = useState<MemoryView | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const [restored, setRestored] = useState(false);
  const [composerSeed, setComposerSeed] = useState<string | null>(null);
  const queueComposer = useCallback((text: string | null) => setComposerSeed(text), []);

  if (!sessionsLoading && !restored) {
    setRestored(true);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("meridian-session");
    } catch {
      stored = null;
    }
    if (stored && sessions.some((session) => session.id === stored)) {
      setActiveSessionIdState(stored);
    } else if (sessions[0]) {
      setActiveSessionIdState(sessions[0].id);
    }
  }

  const setActiveSessionId = useCallback((id: string | null) => {
    setActiveSessionIdState(id);
    try {
      if (id) localStorage.setItem("meridian-session", id);
      else localStorage.removeItem("meridian-session");
    } catch {
      // Storage can be blocked. The in-memory selection still works.
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    const data = await readJson<{ sessions: SessionSummary[] }>(await fetch("/api/sessions"));
    setSessions(data.sessions);
    setSessionsError(null);
  }, []);

  const refreshSettings = useCallback(async () => {
    const data = await readJson<{ settings: PublicSettings }>(await fetch("/api/settings"));
    setSettings(data.settings);
  }, []);

  const refreshSkills = useCallback(async () => {
    const data = await readJson<SkillResponse>(await fetch("/api/skills"));
    setSkills(data.skills);
    setSkippedSkills(data.skipped);
  }, []);

  const refreshMemory = useCallback(async () => {
    setMemory(await readJson<MemoryView>(await fetch("/api/memory")));
  }, []);

  const checkHealth = useCallback(async () => {
    setHealthChecking(true);
    try {
      const result = await readJson<HealthResult>(await fetch("/api/health"));
      setHealth(result);
      if (result.models.length > 0) {
        setSettings((current) => (current ? { ...current, models: result.models } : current));
      }
    } catch (err) {
      setHealth({
        ok: false,
        baseUrl: "",
        model: "",
        latencyMs: null,
        models: [],
        error: err instanceof Error ? err.message : "Could not check LM Studio.",
      });
    } finally {
      setHealthChecking(false);
    }
  }, []);

  useEffect(() => {
    const tick = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(tick);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [sessionData, settingsData, skillData, memoryData] = await Promise.all([
          readJson<{ sessions: SessionSummary[] }>(await fetch("/api/sessions")),
          readJson<{ settings: PublicSettings }>(await fetch("/api/settings")),
          readJson<SkillResponse>(await fetch("/api/skills")),
          readJson<MemoryView>(await fetch("/api/memory")),
        ]);
        if (cancelled) return;
        setSessions(sessionData.sessions);
        setSettings(settingsData.settings);
        setSkills(skillData.skills);
        setSkippedSkills(skillData.skipped);
        setMemory(memoryData);
        setSessionsError(null);
      } catch (err) {
        if (!cancelled) {
          setSessionsError(err instanceof Error ? err.message : "Could not load Meridian.");
        }
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
      if (!cancelled) await checkHealth();
    })();
    return () => {
      cancelled = true;
    };
  }, [checkHealth]);

  const createSession = useCallback(async () => {
    const data = await readJson<{ session: SessionSummary }>(
      await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    await refreshSessions();
    return data.session.id;
  }, [refreshSessions]);

  const renameSession = useCallback(
    async (id: string, title: string) => {
      await readJson(
        await fetch(`/api/sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        }),
      );
      await refreshSessions();
    },
    [refreshSessions],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await readJson(
        await fetch(`/api/sessions/${id}`, { method: "DELETE" }),
      );
      const remaining = sessions.filter((session) => session.id !== id);
      setSessions(remaining);
      if (activeSessionId === id) setActiveSessionId(remaining[0]?.id ?? null);
      await refreshSessions();
    },
    [activeSessionId, refreshSessions, sessions, setActiveSessionId],
  );

  const value = useMemo<AppState>(
    () => ({
      now,
      sessions,
      sessionsLoading,
      sessionsError,
      refreshSessions,
      createSession,
      renameSession,
      deleteSession,
      activeSessionId,
      setActiveSessionId,
      settings,
      refreshSettings,
      skills,
      skippedSkills,
      refreshSkills,
      memory,
      refreshMemory,
      health,
      healthChecking,
      checkHealth,
      composerSeed,
      queueComposer,
    }),
    [
      now,
      sessions,
      sessionsLoading,
      sessionsError,
      refreshSessions,
      createSession,
      renameSession,
      deleteSession,
      activeSessionId,
      setActiveSessionId,
      settings,
      refreshSettings,
      skills,
      skippedSkills,
      refreshSkills,
      memory,
      refreshMemory,
      health,
      healthChecking,
      checkHealth,
      composerSeed,
      queueComposer,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
