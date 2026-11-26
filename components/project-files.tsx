"use client";

import { ChevronRight, File, Folder, FolderPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { readJson } from "@/components/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectEntry, ProjectRecord } from "@/lib/projects";
import { cn } from "cn";

export function ProjectFiles({
  onMention,
  onUse,
  onChanged,
  activeProjectId,
}: {
  onMention: (line: string) => void;
  onUse: (projectId: string) => Promise<void>;
  onChanged?: () => void;
  activeProjectId: string | null;
}) {
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [linkExisting, setLinkExisting] = useState(false);
  const [name, setName] = useState("");
  const [root, setRoot] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [treeNonce, setTreeNonce] = useState(0);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [cloneUrl, setCloneUrl] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const data = await readJson<{ projects: ProjectRecord[] }>(
          await fetch("/api/projects", { signal: ac.signal }),
        );
        if (!ac.signal.aborted) {
          setProjects(data.projects);
          setLoadError(null);
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          setLoadError(err instanceof Error ? err.message : "Could not load projects.");
        }
      }
    })();
    return () => ac.abort();
  }, [reloadKey]);

  async function saveProject() {
    setPending(true);
    setFormError(null);
    try {
      const data = await readJson<{ project: ProjectRecord }>(
        await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(linkExisting ? { name, root } : { name }),
        }),
      );
      setName("");
      setRoot("");
      setAdding(false);
      setLinkExisting(false);
      setOpenId(data.project.id);
      setReloadKey((value) => value + 1);
      await onUse(data.project.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add that folder.");
    } finally {
      setPending(false);
    }
  }

  async function clone(projectId: string) {
    setFormError(null);
    setCloningId(projectId);
    try {
      await readJson(
        await fetch(`/api/projects/${encodeURIComponent(projectId)}/clone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: cloneUrl }),
        }),
      );
      setCloneUrl("");
      setTreeNonce((value) => value + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not clone that repository.");
    } finally {
      setCloningId(null);
    }
  }

  async function forget(project: ProjectRecord) {
    const message = project.managed
      ? `Delete ${project.name} and the folder Meridian created for it? Cloned files in that folder will be removed.`
      : `Forget ${project.name}? The folder stays on this machine.`;
    if (!window.confirm(message)) return;
    setFormError(null);
    try {
      await readJson(await fetch(`/api/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" }));
      if (openId === project.id) setOpenId(null);
      setReloadKey((value) => value + 1);
      onChanged?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not forget that project.");
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full" onClick={() => setAdding((value) => !value)}>
        <FolderPlus />
        {adding ? "Close form" : "New project"}
      </Button>
      {adding ? (
        <form
          className="space-y-2 rounded-lg border border-sidebar-border px-2 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProject();
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Project name"
            aria-label="Project name"
          />
          {linkExisting ? (
            <Input
              value={root}
              onChange={(event) => setRoot(event.target.value)}
              placeholder="Full folder path"
              aria-label="Project folder path"
              spellCheck={false}
            />
          ) : null}
          <p className="text-xs leading-5 text-muted-foreground">
            {linkExisting
              ? "The folder must already be on this machine. Forgetting it drops the path and leaves the files."
              : "Meridian creates an empty folder on this machine. Clone a repository into it, then this chat can add files and run tests there."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending || !name.trim() || (linkExisting && !root.trim())}>
              {linkExisting ? "Link folder" : "Create project"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setLinkExisting((value) => !value);
                setFormError(null);
              }}
            >
              {linkExisting ? "Create a new folder" : "Link an existing folder"}
            </Button>
          </div>
          {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
        </form>
      ) : null}
      {loadError ? (
        <div className="px-1">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setReloadKey((value) => value + 1)}>
            Retry
          </Button>
        </div>
      ) : projects === null ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="px-1 py-2 text-sm leading-5 text-muted-foreground">
          No projects yet. Create one and Meridian will keep its files on this machine.
        </p>
      ) : (
        <ul className="space-y-1">
          {projects.map((project) => {
            const open = openId === project.id;
            const active = activeProjectId === project.id;
            return (
              <li key={project.id}>
                <div className={cn("flex items-center gap-1 rounded-lg pr-1", (open || active) && "bg-sidebar-accent/60")}>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-left"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : project.id)}
                  >
                    <ChevronRight
                      aria-hidden
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none",
                        open && "rotate-90",
                      )}
                    />
                    <Folder aria-hidden className="size-3.5 shrink-0 text-copper" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{project.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground" title={project.root}>
                        {active ? "In this chat" : project.managed ? "Folder on this machine" : project.root}
                      </span>
                    </span>
                  </button>
                  {active ? null : (
                    <button
                      type="button"
                      className="shrink-0 rounded-sm px-1.5 py-1 text-[11px] text-copper underline-offset-2 hover:underline"
                      onClick={() => void onUse(project.id)}
                    >
                      Work here
                    </button>
                  )}
                  <button
                    type="button"
                    className="shrink-0 rounded-sm px-1.5 py-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => void forget(project)}
                  >
                    {project.managed ? "Delete" : "Forget"}
                  </button>
                </div>
                {open ? (
                  <div className="space-y-1">
                    <form
                      className="flex gap-1 px-2 pt-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void clone(project.id);
                      }}
                    >
                      <Input
                        value={openId === project.id ? cloneUrl : ""}
                        onChange={(event) => setCloneUrl(event.target.value)}
                        placeholder="https://github.com/org/repo.git"
                        aria-label={`Clone into ${project.name}`}
                        spellCheck={false}
                        className="h-8 text-xs"
                      />
                      <Button type="submit" size="sm" variant="outline" disabled={cloningId === project.id || !cloneUrl.trim()}>
                        {cloningId === project.id ? "Cloning" : "Clone"}
                      </Button>
                    </form>
                    <ProjectDir
                      key={`${project.id}:${treeNonce}`}
                      projectId={project.id}
                      projectName={project.name}
                      relativePath=""
                      depth={0}
                      onMention={onMention}
                      onUse={onUse}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {formError && !adding ? <p className="px-1 text-xs text-destructive">{formError}</p> : null}
    </div>
  );
}

function ProjectDir({
  projectId,
  projectName,
  relativePath,
  depth,
  onMention,
  onUse,
}: {
  projectId: string;
  projectName: string;
  relativePath: string;
  depth: number;
  onMention: (line: string) => void;
  onUse: (projectId: string) => Promise<void>;
}) {
  const [state, setState] = useState<{ entries: ProjectEntry[]; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const query = relativePath ? `?path=${encodeURIComponent(relativePath)}` : "";
        const data = await readJson<{ entries: ProjectEntry[]; truncated: boolean }>(
          await fetch(`/api/projects/${encodeURIComponent(projectId)}/tree${query}`, { signal: ac.signal }),
        );
        if (!ac.signal.aborted) {
          setState(data);
          setError(null);
        }
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : "Could not read that folder.");
        }
      }
    })();
    return () => ac.abort();
  }, [projectId, relativePath]);

  if (error) {
    return <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>;
  }
  if (state === null) {
    return <p className="px-2 py-1.5 text-xs text-muted-foreground">Reading folder…</p>;
  }
  if (state.entries.length === 0) {
    return (
      <p className="px-2 py-1.5 text-xs leading-5 text-muted-foreground">
        {depth === 0
          ? "This folder is empty. Clone a repository, or let the agent create files here."
          : "This folder is empty."}
      </p>
    );
  }

  return (
    <ul className="pb-1">
      {state.entries.map((entry) =>
        entry.kind === "dir" ? (
          <DirRow
            key={entry.path}
            projectId={projectId}
            projectName={projectName}
            entry={entry}
            depth={depth}
            onMention={onMention}
            onUse={onUse}
          />
        ) : (
          <li key={entry.path}>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm hover:bg-sidebar-accent/60"
              style={{ paddingLeft: `${12 + depth * 14}px` }}
              title={`Open ${projectName}/${entry.path} in this chat`}
              onClick={() => {
                void (async () => {
                  await onUse(projectId);
                  onMention(`[${projectName}/${entry.path}]`);
                })();
              }}
            >
              <File aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{entry.name}</span>
            </button>
          </li>
        ),
      )}
      {state.truncated ? (
        <li className="px-2 py-1 text-[11px] text-muted-foreground">Showing the first 200 entries.</li>
      ) : null}
    </ul>
  );
}

function DirRow({
  projectId,
  projectName,
  entry,
  depth,
  onMention,
  onUse,
}: {
  projectId: string;
  projectName: string;
  entry: ProjectEntry;
  depth: number;
  onMention: (line: string) => void;
  onUse: (projectId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm hover:bg-sidebar-accent/60"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
        <Folder aria-hidden className="size-3.5 shrink-0 text-copper" />
        <span className="truncate">{entry.name}</span>
      </button>
      {open ? (
        <ProjectDir
          projectId={projectId}
          projectName={projectName}
          relativePath={entry.path}
          depth={depth + 1}
          onMention={onMention}
          onUse={onUse}
        />
      ) : null}
    </li>
  );
}
