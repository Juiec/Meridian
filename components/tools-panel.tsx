"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { readJson } from "@/components/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { HttpMethod, McpTransport, PublicCustomTool, PublicMcpServer, ToolsOverview } from "@/lib/tool-types";
import { cn } from "cn";

const selectClass =
  "mt-1.5 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function statusLabel(status: PublicMcpServer["status"]): string {
  if (status === "connected") return "Connected";
  if (status === "error") return "Error";
  if (status === "disabled") return "Disabled";
  return "Not connected";
}

function statusClass(status: PublicMcpServer["status"]): string {
  if (status === "connected") return "text-sage";
  if (status === "error") return "text-destructive";
  if (status === "idle") return "text-copper";
  return "text-muted-foreground";
}

function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) throw new Error(`Environment line needs KEY=value (${trimmed}).`);
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1);
  }
  return env;
}

function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) throw new Error(`Header line needs Name: value (${trimmed}).`);
    headers[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return headers;
}

export function ToolsPanel() {
  const [catalog, setCatalog] = useState<ToolsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mcpForm, setMcpForm] = useState<"new" | string | null>(null);
  const [customForm, setCustomForm] = useState<"new" | string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await readJson<ToolsOverview>(await fetch("/api/tools"));
        if (!cancelled) setCatalog(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load tools.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function mutate(key: string, path: string, init: RequestInit) {
    setBusy(key);
    setError(null);
    try {
      const data = await readJson<ToolsOverview>(await fetch(path, init));
      setCatalog(data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const editingMcp = catalog?.servers.find((server) => server.id === mcpForm) ?? null;
  const editingCustom = catalog?.customTools.find((tool) => tool.id === customForm) ?? null;

  return (
    <div id="tools" className="mx-auto mt-10 max-w-2xl scroll-mt-6 space-y-8 border-t border-border pt-8 pb-16">
      <div>
        <h2 className="font-display text-2xl leading-none">Tools</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Skills are prompt playbooks the model reads with skill_view. Tools are functions it can call. An MCP server
          lends its tools. A custom tool is an HTTP request Meridian makes from this machine. Environment variables and
          header values stay on the server; this page only shows their names.
        </p>
      </div>

      {error ? <p className="text-sm whitespace-pre-wrap text-destructive">{error}</p> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">MCP servers</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => setMcpForm(mcpForm === "new" ? null : "new")}>
            Add server
          </Button>
        </div>
        {mcpForm === "new" ? (
          <McpForm
            key="new-mcp"
            initial={null}
            busy={busy === "mcp-form"}
            onCancel={() => setMcpForm(null)}
            onSubmit={async (body) => {
              const ok = await mutate("mcp-form", "/api/mcp", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              });
              if (ok) setMcpForm(null);
            }}
          />
        ) : null}
        {catalog && catalog.servers.length === 0 && mcpForm !== "new" ? (
          <p className="text-sm text-muted-foreground">
            No MCP servers yet. A stdio server can be <span className="font-mono">node</span> with argument{" "}
            <span className="font-mono">scripts/demo-mcp.mjs</span>.
          </p>
        ) : null}
        <ul className="space-y-3">
          {catalog?.servers.map((server) => (
            <li key={server.id} className="rounded-xl border border-border bg-card px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{server.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {server.transport}
                    {server.transport === "stdio" ? ` · ${server.command}` : ` · ${server.url}`}
                  </p>
                </div>
                <span className={cn("text-[11px] tracking-wide uppercase", statusClass(server.status))}>
                  {statusLabel(server.status)}
                </span>
              </div>
              {server.error ? <p className="mt-2 text-xs whitespace-pre-wrap text-destructive">{server.error}</p> : null}
              {server.envKeys.length > 0 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Saved env: {server.envKeys.join(", ")}</p>
              ) : null}
              {server.headerKeys.length > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">Saved headers: {server.headerKeys.join(", ")}</p>
              ) : null}
              {server.tools.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {server.tools.map((tool) => (
                    <li key={tool.exposedName} className="font-mono text-[12px] text-copper">
                      {tool.exposedName}
                      <span className="ml-2 font-sans text-[11px] text-muted-foreground">{tool.name}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === server.id}
                  onClick={() => void mutate(server.id, `/api/mcp/${server.id}/refresh`, { method: "POST" })}
                >
                  {busy === server.id ? "Working…" : "Refresh"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === server.id}
                  onClick={() =>
                    void mutate(server.id, `/api/mcp/${server.id}`, {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ enabled: !server.enabled }),
                    })
                  }
                >
                  {server.enabled ? "Disable" : "Enable"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setMcpForm(server.id)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy === server.id}
                  onClick={() => {
                    if (!window.confirm(`Remove MCP server ${server.name}?`)) return;
                    void mutate(server.id, `/api/mcp/${server.id}`, { method: "DELETE" });
                  }}
                >
                  Remove
                </Button>
              </div>
              {mcpForm === server.id ? (
                <McpForm
                  key={server.id}
                  initial={editingMcp}
                  busy={busy === "mcp-form"}
                  onCancel={() => setMcpForm(null)}
                  onSubmit={async (body) => {
                    const ok = await mutate("mcp-form", `/api/mcp/${server.id}`, {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify(body),
                    });
                    if (ok) setMcpForm(null);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Custom tools</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCustomForm(customForm === "new" ? null : "new")}
          >
            Add tool
          </Button>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Each tool is a webhook. Meridian posts the model’s arguments to the URL, or appends them as a query string for
          GET and DELETE. Local and private addresses are allowed here. The public fetch_url tool still refuses them.
        </p>
        {customForm === "new" ? (
          <CustomForm
            key="new-custom"
            initial={null}
            busy={busy === "custom-form"}
            onCancel={() => setCustomForm(null)}
            onSubmit={async (body) => {
              const ok = await mutate("custom-form", "/api/custom-tools", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              });
              if (ok) setCustomForm(null);
            }}
          />
        ) : null}
        {catalog && catalog.customTools.length === 0 && customForm !== "new" ? (
          <p className="text-sm text-muted-foreground">No custom tools yet.</p>
        ) : null}
        <ul className="space-y-3">
          {catalog?.customTools.map((tool) => (
            <li key={tool.id} className="rounded-xl border border-border bg-card px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] text-copper">{tool.exposedName || tool.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.description}</p>
                </div>
                <span className={cn("text-[11px] tracking-wide uppercase", tool.enabled ? "text-sage" : "text-muted-foreground")}>
                  {tool.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                {tool.method} {tool.url}
              </p>
              {tool.headerKeys.length > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">Saved headers: {tool.headerKeys.join(", ")}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === tool.id}
                  onClick={() =>
                    void mutate(tool.id, `/api/custom-tools/${tool.id}`, {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ enabled: !tool.enabled }),
                    })
                  }
                >
                  {tool.enabled ? "Disable" : "Enable"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setCustomForm(tool.id)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy === tool.id}
                  onClick={() => {
                    if (!window.confirm(`Delete custom tool ${tool.name}?`)) return;
                    void mutate(tool.id, `/api/custom-tools/${tool.id}`, { method: "DELETE" });
                  }}
                >
                  Delete
                </Button>
              </div>
              {customForm === tool.id ? (
                <CustomForm
                  key={tool.id}
                  initial={editingCustom}
                  busy={busy === "custom-form"}
                  onCancel={() => setCustomForm(null)}
                  onSubmit={async (body) => {
                    const ok = await mutate("custom-form", `/api/custom-tools/${tool.id}`, {
                      method: "PUT",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify(body),
                    });
                    if (ok) setCustomForm(null);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {catalog ? (
        <details className="rounded-xl border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm">Names the model can call</summary>
          <ul className="mt-2 space-y-1">
            {catalog.catalog.map((entry) => (
              <li key={`${entry.source}-${entry.name}`} className="flex items-baseline gap-2 text-xs">
                <span className="font-mono text-copper">{entry.name}</span>
                <span className="tracking-wide text-muted-foreground uppercase">{entry.source}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="text-sm text-muted-foreground">Loading tools…</p>
      )}
    </div>
  );
}

function McpForm({
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  initial: PublicMcpServer | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [transport, setTransport] = useState<McpTransport>(initial?.transport ?? "stdio");
  const [command, setCommand] = useState(initial?.command ?? "");
  const [args, setArgs] = useState(initial?.args.join("\n") ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [envText, setEnvText] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [clearEnv, setClearEnv] = useState(false);
  const [clearHeaders, setClearHeaders] = useState(false);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 space-y-3 rounded-xl border border-border bg-background p-3"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const body: Record<string, unknown> = {
            name,
            transport,
            command,
            args: args.split(/\r?\n/),
            url,
            enabled,
          };
          if (clearEnv) body.env = {};
          else if (envText.trim()) body.env = parseEnv(envText);
          if (clearHeaders) body.headers = {};
          else if (headerText.trim()) body.headers = parseHeaders(headerText);
          setFormError(null);
          void onSubmit(body);
        } catch (err) {
          setFormError(err instanceof Error ? err.message : "Check the form.");
        }
      }}
    >
      <label className="block text-sm">
        Name
        <Input className="mt-1.5" value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="block text-sm">
        Transport
        <select className={selectClass} value={transport} onChange={(event) => setTransport(event.target.value as McpTransport)}>
          <option value="stdio">stdio</option>
          <option value="http">HTTP (streamable)</option>
          <option value="sse">SSE</option>
        </select>
      </label>
      {transport === "stdio" ? (
        <>
          <label className="block text-sm">
            Command
            <Input
              className="mt-1.5 font-mono"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="node"
              spellCheck={false}
            />
          </label>
          <label className="block text-sm">
            Arguments, one per line
            <Textarea
              className="mt-1.5 font-mono"
              value={args}
              onChange={(event) => setArgs(event.target.value)}
              placeholder={"scripts/demo-mcp.mjs"}
              spellCheck={false}
            />
          </label>
        </>
      ) : (
        <label className="block text-sm">
          URL
          <Input
            className="mt-1.5 font-mono"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="http://127.0.0.1:3001/mcp"
            spellCheck={false}
          />
        </label>
      )}
      <label className="block text-sm">
        Environment
        <Textarea
          className="mt-1.5 font-mono"
          value={envText}
          onChange={(event) => setEnvText(event.target.value)}
          placeholder={initial?.envKeys.length ? `Saved: ${initial.envKeys.join(", ")}. Leave blank to keep.` : "API_TOKEN=…"}
          spellCheck={false}
        />
      </label>
      {initial?.envKeys.length ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={clearEnv} onChange={(event) => setClearEnv(event.target.checked)} />
          Clear saved environment
        </label>
      ) : null}
      {transport !== "stdio" ? (
        <>
          <label className="block text-sm">
            Headers
            <Textarea
              className="mt-1.5 font-mono"
              value={headerText}
              onChange={(event) => setHeaderText(event.target.value)}
              placeholder={
                initial?.headerKeys.length ? `Saved: ${initial.headerKeys.join(", ")}. Leave blank to keep.` : "Authorization: Bearer …"
              }
              spellCheck={false}
            />
          </label>
          {initial?.headerKeys.length ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={clearHeaders} onChange={(event) => setClearHeaders(event.target.checked)} />
              Clear saved headers
            </label>
          ) : null}
        </>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Enabled
      </label>
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save server"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const DEFAULT_SCHEMA = `{
  "type": "object",
  "properties": {
    "note": { "type": "string", "description": "Text to send." }
  },
  "required": ["note"]
}`;

function CustomForm({
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  initial: PublicCustomTool | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [parameters, setParameters] = useState(
    initial ? JSON.stringify(initial.parameters, null, 2) : DEFAULT_SCHEMA,
  );
  const [method, setMethod] = useState<HttpMethod>(initial?.method ?? "POST");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [headerText, setHeaderText] = useState("");
  const [clearHeaders, setClearHeaders] = useState(false);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 space-y-3 rounded-xl border border-border bg-background p-3"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const schema = JSON.parse(parameters) as unknown;
          if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
            throw new Error("Parameters must be a JSON object.");
          }
          const body: Record<string, unknown> = {
            name,
            description,
            parameters: schema,
            method,
            url,
            enabled,
          };
          if (clearHeaders) body.headers = {};
          else if (headerText.trim()) body.headers = parseHeaders(headerText);
          setFormError(null);
          void onSubmit(body);
        } catch (err) {
          setFormError(err instanceof Error ? err.message : "Check the form.");
        }
      }}
    >
      <label className="block text-sm">
        Name
        <Input className="mt-1.5 font-mono" value={name} onChange={(event) => setName(event.target.value)} placeholder="echo_note" required />
      </label>
      <label className="block text-sm">
        Description
        <Textarea className="mt-1.5" value={description} onChange={(event) => setDescription(event.target.value)} required />
      </label>
      <label className="block text-sm">
        JSON Schema parameters
        <Textarea className="mt-1.5 font-mono" value={parameters} onChange={(event) => setParameters(event.target.value)} spellCheck={false} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <label className="block text-sm">
          Method
          <select className={selectClass} value={method} onChange={(event) => setMethod(event.target.value as HttpMethod)}>
            {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          URL
          <Input className="mt-1.5 font-mono" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="http://127.0.0.1:8787/hook" spellCheck={false} />
        </label>
      </div>
      <label className="block text-sm">
        Headers
        <Textarea
          className="mt-1.5 font-mono"
          value={headerText}
          onChange={(event) => setHeaderText(event.target.value)}
          placeholder={initial?.headerKeys.length ? `Saved: ${initial.headerKeys.join(", ")}. Leave blank to keep.` : "Authorization: Bearer …"}
          spellCheck={false}
        />
      </label>
      {initial?.headerKeys.length ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={clearHeaders} onChange={(event) => setClearHeaders(event.target.checked)} />
          Clear saved headers
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Enabled
      </label>
      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save tool"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ToolsDeskSummary() {
  const [catalog, setCatalog] = useState<ToolsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await readJson<ToolsOverview>(await fetch("/api/tools"));
        if (!cancelled) setCatalog(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load tools.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="mt-2 text-xs text-destructive">{error}</p>;
  if (!catalog) return <p className="mt-2 text-xs text-muted-foreground">Loading tools…</p>;
  if (catalog.servers.length === 0 && catalog.customTools.length === 0) {
    return <p className="mt-2 text-xs text-muted-foreground">None registered yet.</p>;
  }
  return (
    <ul className="mt-2 space-y-1.5">
      {catalog.servers.map((server) => (
        <li key={server.id} className="flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate">{server.name}</span>
          <span className={cn("shrink-0 tracking-wide uppercase", statusClass(server.status))}>{statusLabel(server.status)}</span>
        </li>
      ))}
      {catalog.customTools.map((tool) => (
        <li key={tool.id} className="flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate font-mono text-copper">{tool.name}</span>
          <span className={cn("shrink-0 tracking-wide uppercase", tool.enabled ? "text-sage" : "text-muted-foreground")}>
            {tool.enabled ? "Enabled" : "Disabled"}
          </span>
        </li>
      ))}
      <li>
        <Link href="/settings#tools" className="text-xs text-copper underline-offset-2 hover:underline">
          Manage tools
        </Link>
      </li>
    </ul>
  );
}
