"use client";

import Link from "next/link";
import { useState } from "react";

import { useAppState } from "@/components/app-state";
import { ToolsPanel } from "@/components/tools-panel";
import { readJson } from "@/components/client-api";
import { useOpenSidebar } from "@/components/shell";
import { SidebarToggle } from "@/components/sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "cn";
import type { PublicSettings } from "@/lib/types";

export function SettingsForm() {
  const openSidebar = useOpenSidebar();
  const { settings, refreshSettings, checkHealth, health, healthChecking } = useAppState();
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (settings && !seeded) {
    setSeeded(true);
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: { baseUrl: string; model: string; apiKey?: string } = { baseUrl, model };
      if (clearKey) payload.apiKey = "";
      else if (apiKey.trim()) payload.apiKey = apiKey.trim();
      const data = await readJson<{ settings: PublicSettings }>(
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      await refreshSettings();
      setApiKey("");
      setClearKey(false);
      setBaseUrl(data.settings.baseUrl);
      setModel(data.settings.model);
      setMessage("Saved on this machine. The key is not sent back to the browser.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function check() {
    setError(null);
    setMessage(null);
    const dirty = baseUrl !== settings?.baseUrl || model !== settings?.model || apiKey.trim().length > 0 || clearKey;
    if (dirty) {
      const saved = await save();
      if (!saved) return;
    }
    await checkHealth();
  }

  const shown = health;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 md:px-6">
        <SidebarToggle onOpen={openSidebar} />
        <div>
          <p className="font-display text-2xl leading-none">Settings</p>
          <p className="mt-1 text-xs text-muted-foreground">LM Studio, MCP servers, and custom tools. The browser never dials them.</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-xl">
          <p className="text-sm leading-6 text-muted-foreground">
            Meridian calls the OpenAI-compatible API from the server. A MagicDNS address looks like{" "}
            <span className="font-mono text-foreground">http://machine.tailnet-name.ts.net:1234/v1</span>.
            If you omit <span className="font-mono">/v1</span>, it is added. Leave the key blank when LM Studio
            has none.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label className="block text-sm">
              Base URL
              <Input
                className="mt-1.5"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="http://hostname.tailnet-name.ts.net:1234/v1"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="block text-sm">
              API key
              <Input
                className="mt-1.5"
                type="password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  if (event.target.value) setClearKey(false);
                }}
                placeholder={settings?.apiKeySet ? `Saved ${settings.apiKeyHint ?? ""}` : "Optional"}
                autoComplete="off"
              />
            </label>
            {settings?.apiKeySet ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={clearKey}
                  onChange={(event) => setClearKey(event.target.checked)}
                />
                Clear the saved key
              </label>
            ) : null}
            <label className="block text-sm">
              Default model id
              <Input
                className="mt-1.5"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="The id LM Studio lists for the loaded model"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="outline" disabled={healthChecking || saving} onClick={() => void check()}>
                {healthChecking ? "Checking…" : "Check connection"}
              </Button>
              <Link href="/" className={cn(buttonVariants({ variant: "ghost" }))}>
                Back to chat
              </Link>
            </div>
          </form>
          {message ? <p className="mt-4 text-sm text-sage">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          {shown ? (
            <div className="mt-6 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium">{shown.ok ? "LM Studio responded" : "Could not reach LM Studio"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {shown.ok
                  ? `${shown.models.length} model${shown.models.length === 1 ? "" : "s"}${
                      shown.latencyMs !== null ? ` · ${shown.latencyMs} ms` : ""
                    }`
                  : shown.error}
              </p>
              {shown.models.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {shown.models.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-2 py-1.5 text-left font-mono text-xs hover:bg-muted"
                        onClick={() => setModel(id)}
                      >
                        {id}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {shown.models.length > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">Choose a model, then save. New sessions use it.</p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-8 text-xs leading-5 text-muted-foreground">
            Environment defaults are <span className="font-mono">LM_STUDIO_BASE_URL</span>,{" "}
            <span className="font-mono">LM_STUDIO_API_KEY</span>, and <span className="font-mono">MODEL</span>.
            Saving here writes <span className="font-mono">data/settings.json</span> and overrides them. That
            file is gitignored.
          </p>
        </div>
        <ToolsPanel />
      </div>
    </div>
  );
}
