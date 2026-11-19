"use client";

import Link from "next/link";
import { Plus, Server, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { useAppState } from "@/components/app-state";
import { ToolsPanel } from "@/components/tools-panel";
import { readJson } from "@/components/client-api";
import { useOpenSidebar } from "@/components/shell";
import { SidebarToggle } from "@/components/sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "cn";
import type { PublicEndpoint, PublicSettings } from "@/lib/types";

type EndpointDraft = PublicEndpoint & {
  apiKey: string;
  clearApiKey: boolean;
};

function draftFromEndpoint(endpoint: PublicEndpoint): EndpointDraft {
  return { ...endpoint, apiKey: "", clearApiKey: false };
}

export function SettingsForm() {
  const openSidebar = useOpenSidebar();
  const { settings, refreshSettings, checkHealth, health, healthChecking } = useAppState();
  const [endpoints, setEndpoints] = useState<EndpointDraft[]>([]);
  const [activeEndpointId, setActiveEndpointId] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (settings && !seeded) {
    setSeeded(true);
    setEndpoints(settings.endpoints.map(draftFromEndpoint));
    setActiveEndpointId(settings.endpointId);
  }

  function updateEndpoint(id: string, patch: Partial<EndpointDraft>) {
    setEndpoints((current) => current.map((endpoint) => endpoint.id === id ? { ...endpoint, ...patch } : endpoint));
  }

  function addEndpoint() {
    const id = crypto.randomUUID().replace(/-/g, "");
    setEndpoints((current) => [
      ...current,
      {
        id,
        name: `Endpoint ${current.length + 1}`,
        baseUrl: "",
        model: "",
        apiKeySet: false,
        apiKeyHint: null,
        models: [],
        apiKey: "",
        clearApiKey: false,
      },
    ]);
    setActiveEndpointId(id);
    setMessage(null);
    setError(null);
  }

  function removeEndpoint(id: string) {
    const remaining = endpoints.filter((endpoint) => endpoint.id !== id);
    setEndpoints(remaining);
    if (activeEndpointId === id) setActiveEndpointId(remaining[0]?.id ?? "");
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await readJson<{ settings: PublicSettings }>(
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activeEndpointId,
            endpoints: endpoints.map((endpoint) => ({
              id: endpoint.id,
              name: endpoint.name,
              baseUrl: endpoint.baseUrl,
              model: endpoint.model,
              ...(endpoint.apiKey.trim() ? { apiKey: endpoint.apiKey.trim() } : {}),
              ...(endpoint.clearApiKey ? { clearApiKey: true } : {}),
            })),
          }),
        }),
      );
      setEndpoints(data.settings.endpoints.map(draftFromEndpoint));
      setActiveEndpointId(data.settings.endpointId);
      await refreshSettings();
      setMessage("Saved on this machine. API keys stay in the local settings file and are never sent back to the browser.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save endpoint settings.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function check(endpointId: string) {
    const saved = await save();
    if (!saved) return;
    try {
      await checkHealth(endpointId);
      const data = await readJson<{ settings: PublicSettings }>(await fetch("/api/settings"));
      setEndpoints(data.settings.endpoints.map(draftFromEndpoint));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh endpoint settings.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 md:px-6">
        <SidebarToggle onOpen={openSidebar} />
        <div>
          <p className="font-display text-2xl leading-none">Settings</p>
          <p className="mt-1 text-xs text-muted-foreground">LM Studio, MCP servers, and custom tools. The browser never dials your model endpoints.</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-xl">
              <p className="text-sm leading-6 text-muted-foreground">
                Save a separate URL, API key, and default model for each host. New chats use the default endpoint;
                existing chats keep their selected endpoint and model.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={addEndpoint}>
              <Plus /> Add endpoint
            </Button>
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {endpoints.map((endpoint, index) => (
              <section key={endpoint.id} className="rounded-2xl border border-border bg-card p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-copper">
                    <Server className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="min-w-44 flex-1 text-sm font-medium">
                        Endpoint name
                        <Input
                          className="mt-1.5"
                          value={endpoint.name}
                          onChange={(event) => updateEndpoint(endpoint.id, { name: event.target.value })}
                          placeholder="Office GPU"
                          maxLength={80}
                        />
                      </label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant={activeEndpointId === endpoint.id ? "secondary" : "outline"}
                          size="sm"
                          aria-pressed={activeEndpointId === endpoint.id}
                          onClick={() => setActiveEndpointId(endpoint.id)}
                        >
                          <Star className={activeEndpointId === endpoint.id ? "fill-current" : ""} />
                          {activeEndpointId === endpoint.id ? "Default" : "Make default"}
                        </Button>
                        {endpoints.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${endpoint.name}`}
                            onClick={() => removeEndpoint(endpoint.id)}
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <label className="mt-3 block text-sm">
                      Base URL
                      <Input
                        className="mt-1.5"
                        value={endpoint.baseUrl}
                        onChange={(event) => updateEndpoint(endpoint.id, { baseUrl: event.target.value })}
                        placeholder="http://hostname.tailnet-name.ts.net:1234/v1"
                        autoComplete="url"
                        spellCheck={false}
                      />
                    </label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        API key
                        <Input
                          className="mt-1.5"
                          type="password"
                          value={endpoint.apiKey}
                          onChange={(event) =>
                            updateEndpoint(endpoint.id, {
                              apiKey: event.target.value,
                              clearApiKey: false,
                            })
                          }
                          placeholder={endpoint.apiKeySet ? `Saved ${endpoint.apiKeyHint ?? ""}` : "Optional"}
                          autoComplete="new-password"
                        />
                        {endpoint.apiKeySet ? (
                          <span className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={endpoint.clearApiKey}
                              onChange={(event) =>
                                updateEndpoint(endpoint.id, {
                                  clearApiKey: event.target.checked,
                                  apiKey: "",
                                })
                              }
                            />
                            Clear saved key
                          </span>
                        ) : null}
                      </label>
                      <label className="block text-sm">
                        Default model id
                        <Input
                          className="mt-1.5"
                          value={endpoint.model}
                          onChange={(event) => updateEndpoint(endpoint.id, { model: event.target.value })}
                          placeholder="Model id reported by this server"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={saving || healthChecking} onClick={() => void check(endpoint.id)}>
                        {healthChecking && health?.endpointId === endpoint.id ? "Checking…" : "Save & test connection"}
                      </Button>
                      {endpoint.models.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {endpoint.models.length} model{endpoint.models.length === 1 ? "" : "s"} found
                        </span>
                      ) : null}
                    </div>
                    {health?.endpointId === endpoint.id ? (
                      <p className={cn("mt-3 text-xs", health.ok ? "text-sage" : "text-destructive")}>
                        {health.ok
                          ? `${health.models.length} model${health.models.length === 1 ? "" : "s"} available${health.latencyMs !== null ? ` · ${health.latencyMs} ms` : ""}`
                          : health.error}
                      </p>
                    ) : null}
                    {endpoint.models.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {endpoint.models.map((id) => {
                          const active = endpoint.model === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              aria-pressed={active}
                              className={cn(
                                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                                active
                                  ? "border-copper/60 bg-copper/10 text-copper"
                                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                              onClick={() => updateEndpoint(endpoint.id, { model: id })}
                            >
                              {id}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
                {index === 0 && endpoint.id === "default" ? (
                  <p className="mt-3 pl-12 text-[11px] leading-5 text-muted-foreground">
                    Migrated from your existing single-endpoint settings.
                  </p>
                ) : null}
              </section>
            ))}

            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {message ? <p role="status" className="text-sm text-sage">{message}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || endpoints.length === 0}>
                {saving ? "Saving…" : "Save endpoints"}
              </Button>
              <Link href="/" className={cn(buttonVariants({ variant: "ghost" }))}>Back to chat</Link>
            </div>
          </form>

          <p className="mt-6 text-xs leading-5 text-muted-foreground">
            Keys are stored in <span className="font-mono">data/settings.json</span> on this machine (a local, unencrypted file that is gitignored).
            They are only sent from the server to the endpoint you choose; raw keys are not saved in browser cookies or returned to the browser.
            Environment defaults remain available as the initial endpoint: <span className="font-mono">LM_STUDIO_BASE_URL</span>,
            {" "}<span className="font-mono">LM_STUDIO_API_KEY</span>, and <span className="font-mono">MODEL</span>.
          </p>
        </div>
        <ToolsPanel />
      </div>
    </div>
  );
}
