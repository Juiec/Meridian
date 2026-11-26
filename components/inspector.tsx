"use client";

import { PanelRightClose, PanelRightOpen, X } from "lucide-react";
import Link from "next/link";

import { useState } from "react";

import { useAppState } from "@/components/app-state";
import { readJson } from "@/components/client-api";
import { DocEditor } from "@/components/doc-editor";
import { SkillEditor } from "@/components/skill-editor";
import { ToolsDeskSummary } from "@/components/tools-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MemoryStoreView } from "@/lib/types";
import { cn } from "cn";

export function Inspector({
  open,
  collapsed,
  onToggleCollapsed,
  onClose,
  systemPrompt,
  onInsertSkill,
}: {
  open: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
  systemPrompt: string | null;
  onInsertSkill: (name: string) => void;
}) {
  const { skills, skippedSkills, memory, refreshMemory, refreshSkills } = useAppState();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const rail = collapsed && !open;

  return (
    <aside
      className={cn(
        "z-30 flex h-full shrink-0 flex-col overflow-hidden border-l border-border bg-card text-card-foreground transition-[width] duration-200 ease-out motion-reduce:transition-none",
        open
          ? "fixed inset-y-0 right-0 w-[min(100%,24rem)] xl:static xl:w-[24rem]"
          : rail
            ? "hidden w-11 xl:flex"
            : "hidden w-[24rem] xl:flex",
      )}
    >
      {rail ? (
        <button
          type="button"
          className="flex h-full w-full flex-col items-center gap-3 py-3 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Open desk"
          aria-expanded={false}
          onClick={onToggleCollapsed}
        >
          <PanelRightOpen className="size-4" />
          <span className="text-[11px] tracking-[0.18em] uppercase [writing-mode:vertical-rl]">Desk</span>
        </button>
      ) : (
        <div className="flex h-full min-h-0 w-[24rem] max-w-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="font-display text-2xl leading-none tracking-tight">Desk</h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="hidden xl:inline-flex"
            aria-label="Collapse desk"
            aria-expanded
            onClick={onToggleCollapsed}
          >
            <PanelRightClose />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" className="xl:hidden" aria-label="Close desk" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>
      <div className="scroll-hidden min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-5">
        <section>
          <h3 className="text-base font-medium tracking-tight">Skills</h3>
          <p className="mt-2 text-sm leading-6">
            The prompt carries this index. The model loads a body with skill_view, or you can force one with /name. Saving a skill refreshes the index in existing chats on their next message.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setCreating(true)}>
            New skill
          </Button>
          <ul className="mt-3 space-y-2">
            {skills.map((skill) => (
              <li key={skill.name} className="rounded-xl border border-border px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-mono text-sm text-copper">{skill.name}</p>
                  <span className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      className="text-sm underline-offset-2 hover:underline"
                      onClick={() => setEditing(skill.name)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-sm underline-offset-2 hover:underline"
                      onClick={() => onInsertSkill(skill.name)}
                    >
                      Insert
                    </button>
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-6">{skill.description}</p>
              </li>
            ))}
          </ul>
          {skippedSkills.length > 0 ? (
            <p className="mt-2 text-sm text-destructive">
              {skippedSkills.length} skill file{skippedSkills.length === 1 ? "" : "s"} skipped. Check the frontmatter.
            </p>
          ) : null}
          <SkillEditor
            key={creating ? "new" : editing ?? "closed"}
            open={creating || editing !== null}
            skillName={creating ? null : editing}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSaved={refreshSkills}
          />
        </section>
        <section>
          <h3 className="text-base font-medium tracking-tight">Tools</h3>
          <p className="mt-2 text-sm leading-6">
            Skills are playbooks loaded into the prompt. Tools are functions the model can call. delegate gives one task to a subagent with a short summary, so a long lookup stays out of this chat. MCP and custom HTTP tools are registered in settings and show up in the same tool cards as the built-ins.
          </p>
          <ToolsDeskSummary />
        </section>
        <section>
          <h3 className="text-base font-medium tracking-tight">Travel</h3>
          <p className="mt-2 text-sm leading-6">
            Plan visually on the Travel Planner page. It has its own map, itinerary, and fare checks, separate from chat sessions. Nothing is booked from here.
          </p>
          <Link href="/travel" className="mt-3 inline-block text-sm text-copper underline-offset-2 hover:underline">
            Open Travel Planner
          </Link>
        </section>
        <DocEditor />
        <MemoryEditor
          title="User profile"
          target="user"
          store={memory?.user ?? null}
          hint="Who you are. The snapshot freezes at session start and refreshes on the next session or when compaction rebuilds the prompt."
          onChanged={refreshMemory}
        />
        <MemoryEditor
          title="Agent notes"
          target="memory"
          store={memory?.memory ?? null}
          hint="Facts Meridian keeps for every session. Over-limit writes are refused."
          onChanged={refreshMemory}
        />
        <section>
          <h3 className="text-base font-medium tracking-tight">Prompt snapshot</h3>
          <p className="mt-2 text-sm leading-6">
            Identity, project context, memory, and time are captured when the session starts. The skills index refreshes when skill files change; compaction rebuilds the full prompt.
          </p>
          {systemPrompt ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-copper">Show prompt snapshot</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-background p-3 text-sm leading-6 whitespace-pre-wrap">
                {systemPrompt}
              </pre>
            </details>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Open a session to see the snapshot.</p>
          )}
        </section>
      </div>
        </div>
      )}
    </aside>
  );
}

function MemoryEditor({
  title,
  target,
  store,
  hint,
  onChanged,
}: {
  title: string;
  target: "memory" | "user";
  store: MemoryStoreView | null;
  hint: string;
  onChanged: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const used = store?.used ?? 0;
  const limit = store?.limit ?? 1;
  const pct = Math.min(100, Math.round((used / limit) * 100));

  async function addEntry() {
    const content = draft.trim();
    if (!content) return;
    setPending(true);
    setError(null);
    try {
      const data = await readJson<{ result: { ok: boolean; error?: string } }>(
        await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, operations: [{ action: "add", content }] }),
        }),
      );
      if (!data.result.ok) throw new Error(data.result.error || "Memory refused the write.");
      setDraft("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the entry.");
    } finally {
      setPending(false);
    }
  }

  async function removeEntry(content: string) {
    setError(null);
    try {
      const data = await readJson<{ result: { ok: boolean; error?: string } }>(
        await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, operations: [{ action: "remove", old_text: content }] }),
        }),
      );
      if (!data.result.ok) throw new Error(data.result.error || "Could not remove the entry.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the entry.");
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-medium tracking-tight">{title}</h3>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {used}/{limit}
        </span>
      </div>
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`${title} used`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        <div className={cn("h-full bg-copper", pct > 80 && "bg-destructive")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm leading-6">{hint}</p>
      <ul className="mt-3 space-y-2">
        {(store?.entries ?? []).length === 0 ? (
          <li className="text-sm leading-6 text-muted-foreground">Empty.</li>
        ) : (
          store?.entries.map((entry) => (
            <li key={entry} className="rounded-lg bg-background px-3 py-2.5 text-sm leading-6">
              <p className="whitespace-pre-wrap">{entry}</p>
              <button
                type="button"
                className="mt-1.5 text-sm underline-offset-2 hover:underline"
                onClick={() => void removeEntry(entry)}
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Add a fact the next session should already know"
        className="mt-3 min-h-16"
        aria-label={`Add to ${title}`}
      />
      <Button type="button" variant="outline" size="sm" className="mt-2" disabled={pending || !draft.trim()} onClick={() => void addEntry()}>
        Save entry
      </Button>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
