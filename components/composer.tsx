"use client";

import { ArrowUp, Paperclip, RotateCcw, Square, X } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type ComposerAttachment = {
  name: string;
  mediaType: string;
  text?: string;
  dataUrl?: string;
};

const SECRET = /(^|[\\/])\.env($|\.)|\.pem$|(^|[\\/])id_rsa($|\.)|(^|[\\/])\.npmrc$|(^|[\\/])\.netrc$/i;

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
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !running && !disabledReason;

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

  return (
    <form
      className="border-t border-border bg-background/90 px-4 py-3 backdrop-blur md:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <label className="sr-only" htmlFor="composer">
          Message Meridian
        </label>
        <div className="rounded-2xl border border-border bg-card p-2">
          {attachments.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 px-1 pt-1">
              {attachments.map((file) => (
                <li key={file.name} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                  <span className="max-w-40 truncate font-mono">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => onAttachments(attachments.filter((item) => item !== file))}
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Textarea
            id="composer"
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSend) onSubmit();
              }
            }}
            rows={2}
            placeholder="Message Meridian. /skill:daily-planning forces a skill."
            disabled={running}
            className="min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="flex items-center justify-between gap-3 px-1 pb-1">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" aria-live="polite">
              {status || disabledReason || "Enter to send · Shift+Enter for a new line"}
            </p>
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
