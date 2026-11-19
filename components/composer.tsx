"use client";

import { ArrowUp, Paperclip, RotateCcw, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMode } from "@/lib/chat-mode";
import { modeLabel } from "@/lib/chat-mode";
import { parseSkillCommand } from "@/lib/skill-command";
import {
  MODE_ITEMS,
  applySlashSelection,
  filterSlashItems,
  setLeadingMode,
  slashTokenAt,
  type SlashItem,
  type SlashKind,
} from "@/lib/slash-menu";

export type ComposerAttachment = {
  name: string;
  mediaType: string;
  text?: string;
  dataUrl?: string;
};

export type ComposerSkill = { name: string; description: string };
export type ComposerTool = { name: string; description: string };

const SECRET = /(^|[\\/])\.env($|\.)|\.pem$|(^|[\\/])id_rsa($|\.)|(^|[\\/])\.npmrc$|(^|[\\/])\.netrc$/i;

const GROUP_LABEL: Record<SlashKind, string> = {
  mode: "Modes",
  skill: "Skills",
  tool: "Tools",
};

export function Composer({
  draft,
  onDraft,
  attachments,
  onAttachments,
  onAttachError,
  onSubmit,
  onStop,
  onRetry,
  canRetry,
  running,
  status,
  disabledReason,
  chatMode,
  skills,
  tools,
}: {
  draft: string;
  onDraft: (value: string) => void;
  attachments: ComposerAttachment[];
  onAttachments: (value: ComposerAttachment[]) => void;
  onAttachError: (message: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onRetry: () => void;
  canRetry: boolean;
  running: boolean;
  status: string | null;
  disabledReason: string | null;
  chatMode: ChatMode;
  skills: ComposerSkill[];
  tools: ComposerTool[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [highlightQuery, setHighlightQuery] = useState("");
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !running && !disabledReason;
  const shownMode = parseSkillCommand(draft)?.mode ?? chatMode;

  const catalog = useMemo<SlashItem[]>(() => {
    const skillItems: SlashItem[] = skills.map((skill) => ({
      kind: "skill",
      name: skill.name,
      description: skill.description,
      insert: `/${skill.name} `,
    }));
    const toolItems: SlashItem[] = tools.map((tool) => ({
      kind: "tool",
      name: tool.name,
      description: tool.description,
      insert: `use \`${tool.name}\` to `,
    }));
    return [...MODE_ITEMS, ...skillItems, ...toolItems];
  }, [skills, tools]);

  const token = slashTokenAt(draft, caret);
  const tokenKey = token ? `${token.start}:${token.query}` : "";
  const matches = token ? filterSlashItems(token.query, catalog) : [];
  const menuOpen = Boolean(token) && !running && closedFor !== tokenKey;

  if (token && token.query !== highlightQuery) {
    setHighlightQuery(token.query);
    setHighlight(0);
  }
  const activeIndex = matches.length === 0 ? 0 : Math.min(highlight, matches.length - 1);

  useEffect(() => {
    if (pendingCaret.current === null) return;
    const place = pendingCaret.current;
    pendingCaret.current = null;
    const area = areaRef.current;
    if (!area) return;
    area.focus();
    area.setSelectionRange(place, place);
    setCaret(place);
  }, [draft]);

  useEffect(() => {
    if (!menuOpen) return;
    document.getElementById(`slash-item-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [menuOpen, activeIndex, tokenKey]);

  function rememberCaret(element: HTMLTextAreaElement) {
    setCaret(element.selectionStart ?? element.value.length);
  }

  function writeDraft(text: string, place: number) {
    pendingCaret.current = place;
    onDraft(text);
  }

  function choose(item: SlashItem) {
    if (!token) return;
    const next = applySlashSelection(draft, token.start, caret, item);
    writeDraft(next.text, next.caret);
  }

  function chooseMode(mode: ChatMode) {
    const item = MODE_ITEMS.find((entry) => entry.name === mode);
    if (token && item) {
      const next = applySlashSelection(draft, token.start, caret, item);
      writeDraft(next.text, next.caret);
      return;
    }
    const text = setLeadingMode(draft, mode);
    const marker = `/${mode} `;
    const at = text.indexOf(marker);
    writeDraft(text, at === -1 ? text.length : at + marker.length);
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...attachments];
    for (const file of Array.from(list)) {
      if (next.length >= 4) {
        onAttachError("Attach at most 4 files.");
        break;
      }
      if (SECRET.test(file.name) || file.name.startsWith(".env")) {
        onAttachError(`${file.name} looks like a secret file. It was not attached.`);
        continue;
      }
      if (file.type.startsWith("image/")) {
        if (file.size > 900_000) {
          onAttachError(`${file.name} is too large to attach.`);
          continue;
        }
        const dataUrl = await readFile(file, "url");
        next.push({ name: file.name, mediaType: file.type, dataUrl });
        continue;
      }
      if (file.size > 400_000) {
        onAttachError(`${file.name} is too large to attach.`);
        continue;
      }
      const text = await readFile(file, "text");
      next.push({ name: file.name, mediaType: file.type || "text/plain", text });
    }
    onAttachments(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  let previousKind: SlashKind | null = null;

  return (
    <form
      className="border-t border-border bg-background/90 px-4 py-3 backdrop-blur md:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (menuOpen) return;
        if (canSend) onSubmit();
      }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <label className="sr-only" htmlFor="composer">
          Message Meridian
        </label>
        <div className="relative rounded-2xl border border-border bg-card p-2">
          {menuOpen ? (
            <div
              id="slash-menu"
              role="listbox"
              aria-label="Modes, skills, and tools"
              className="absolute inset-x-0 bottom-full z-30 mb-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {matches.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">No matches for /{token?.query}</p>
              ) : (
                matches.map((item, index) => {
                  const showHeading = item.kind !== previousKind;
                  previousKind = item.kind;
                  const selected = index === activeIndex;
                  return (
                    <div key={`${item.kind}:${item.name}`}>
                      {showHeading ? (
                        <p className="px-2 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {GROUP_LABEL[item.kind]}
                        </p>
                      ) : null}
                      <button
                        id={`slash-item-${index}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => choose(item)}
                        className={`flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left ${
                          selected ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                        }`}
                      >
                        <span className="shrink-0 font-mono text-sm">
                          {item.kind === "tool" ? item.name : `/${item.name}`}
                        </span>
                        <span className="min-w-0 truncate text-xs text-muted-foreground">{item.description}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
          {attachments.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 px-1 pt-1">
              {attachments.map((file) => (
                <li key={file.name} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                  <span className="max-w-40 truncate font-mono">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => onAttachments(attachments.filter((item) => item !== file))}
                    className="flex size-5 items-center justify-center rounded-full hover:bg-background"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Textarea
            ref={areaRef}
            id="composer"
            value={draft}
            role="combobox"
            aria-expanded={menuOpen}
            aria-controls="slash-menu"
            aria-autocomplete="list"
            aria-activedescendant={menuOpen && matches.length > 0 ? `slash-item-${activeIndex}` : undefined}
            onChange={(event) => {
              onDraft(event.target.value);
              rememberCaret(event.target);
            }}
            onSelect={(event) => rememberCaret(event.currentTarget)}
            onKeyUp={(event) => rememberCaret(event.currentTarget)}
            onClick={(event) => rememberCaret(event.currentTarget)}
            onKeyDown={(event) => {
              if (menuOpen && event.key === "Escape") {
                event.preventDefault();
                setClosedFor(tokenKey);
                return;
              }
              if (menuOpen && matches.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                setHighlight((current) => {
                  const index = Math.min(current, matches.length - 1);
                  if (event.key === "ArrowDown") return (index + 1) % matches.length;
                  return (index - 1 + matches.length) % matches.length;
                });
                return;
              }
              if (menuOpen && matches.length > 0 && (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey))) {
                event.preventDefault();
                const item = matches[activeIndex];
                if (item) choose(item);
                return;
              }
              if (menuOpen && event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSend) onSubmit();
              }
            }}
            rows={2}
            placeholder="Message Meridian. Type / for modes, skills, and tools."
            disabled={running}
            className="min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="flex items-center justify-between gap-3 px-1 pb-1">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Chat mode">
                {(["agent", "ask", "plan"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="xs"
                    variant={shownMode === mode ? "secondary" : "ghost"}
                    aria-pressed={shownMode === mode}
                    disabled={running}
                    onClick={() => chooseMode(mode)}
                  >
                    {modeLabel(mode)}
                  </Button>
                ))}
              </div>
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" aria-live="polite">
                {status || disabledReason || "Enter to send · Shift+Enter for a new line"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                aria-label="Attach files"
                multiple
                accept=".md,.txt,.json,.js,.jsx,.ts,.tsx,.py,.css,.html,.csv,.xml,image/png,image/jpeg,image/gif,image/webp"
                onChange={(event) => void addFiles(event.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Attach a file"
                disabled={running}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip />
              </Button>
              {canRetry && !running ? (
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  <RotateCcw />
                  Retry
                </Button>
              ) : null}
              {running ? (
                <Button type="button" variant="outline" size="sm" onClick={onStop}>
                  <Square />
                  Stop
                </Button>
              ) : (
                <Button type="submit" size="sm" disabled={!canSend} aria-label="Send message">
                  <ArrowUp />
                  Send
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function readFile(file: File, mode: "text"): Promise<string>;
function readFile(file: File, mode: "url"): Promise<string>;
function readFile(file: File, mode: "text" | "url"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    if (mode === "text") reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}
