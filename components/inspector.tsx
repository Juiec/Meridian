"use client";

import { X } from "lucide-react";
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
  onClose,
  systemPrompt,
  onInsertSkill,
}: {
  open: boolean;
  onClose: () => void;
  systemPrompt: string | null;
  onInsertSkill: (name: string) => void;
}) {
  const { skills, skippedSkills, memory, refreshMemory, refreshSkills } = useAppState();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <aside
      className={cn(
        "z-30 flex h-full w-[min(100%,22rem)] shrink-0 flex-col border-l border-border bg-card",
        open ? "fixed inset-y-0 right-0 flex xl:static" : "hidden xl:flex",
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-medium tracking-wide uppercase">Desk</h2>
        <Button type="button" variant="ghost" size="icon-sm" className="xl:hidden" aria-label="Close desk" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-6">
        <section>
          <h3 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Skills</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            The prompt only carries this index. The model loads a body with skill_view, or you can force one. Saving a skill reloads the index immediately.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setCreating(true)}>
            New skill
          </Button>
          <ul className="mt-3 space-y-2">
            {skills.map((skill) => (
              <li key={skill.name} className="rounded-xl border border-border px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-[13px] text-copper">{skill.name}</p>
                  <span className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setEditing(skill.name)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => onInsertSkill(skill.name)}
                    >
                      Insert
                    </button>
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{skill.description}</p>
              </li>
            ))}
          </ul>
          {skippedSkills.length > 0 ? (
            <p className="mt-2 text-xs text-destructive">
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
          <h3 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Tools</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Skills are playbooks loaded into the prompt. Tools are functions the model can call. MCP and custom HTTP tools are registered in settings and show up in the same tool cards as the built-ins.
          </p>
          <ToolsDeskSummary />
        </section>
        <section>
          <h3 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Travel</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Itineraries, weather, and fare comparisons live on the Travel Agent page. Skills are the playbooks. The map and travel tools do the lookups. Nothing is booked from here.
          </p>
          <Link href="/travel" className="mt-2 inline-block text-xs text-copper underline-offset-2 hover:underline">
            Open Travel Agent
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
          <h3 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Prompt snapshot</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Stable identity, then project context, then the volatile index, memory, and time. Captured when the session started. Compaction rebuilds it. Ordinary memory, skill, and identity writes wait for the next session unless compaction runs.
          </p>
          {systemPrompt ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-copper">Show frozen prompt</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-background p-3 text-[11px] leading-5 whitespace-pre-wrap">
                {systemPrompt}
              </pre>
            </details>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Open a session to see the snapshot.</p>
          )}
        </section>
      </div>
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
        <h3 className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{title}</h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {used}/{limit}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full bg-copper", pct > 80 && "bg-destructive")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
      <ul className="mt-2 space-y-2">
        {(store?.entries ?? []).length === 0 ? (
          <li className="text-xs text-muted-foreground">Empty.</li>
        ) : (
          store?.entries.map((entry) => (
            <li key={entry} className="rounded-lg bg-background px-2.5 py-2 text-xs leading-5">
              <p className="whitespace-pre-wrap">{entry}</p>
              <button
                type="button"
                className="mt-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
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
        className="mt-2 min-h-16 text-xs"
        aria-label={`Add to ${title}`}
      />
      <Button type="button" variant="outline" size="sm" className="mt-2" disabled={pending || !draft.trim()} onClick={() => void addEntry()}>
        Save entry
      </Button>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
