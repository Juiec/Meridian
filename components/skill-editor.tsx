"use client";

import { useEffect, useState } from "react";

import { readJson } from "@/components/client-api";
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
import { Textarea } from "@/components/ui/textarea";

type Reference = { name: string; content: string };

type Source = {
  name: string;
  description: string;
  body: string;
  disableModelInvocation: boolean;
  references: Reference[];
};

export function SkillEditor({
  open,
  skillName,
  onClose,
  onSaved,
}: {
  open: boolean;
  skillName: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [disableModelInvocation, setDisableModelInvocation] = useState(false);
  const [references, setReferences] = useState<Reference[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(skillName === null);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    if (!skillName) {
      return () => ac.abort();
    }
    void (async () => {
      try {
        const data = await readJson<{ skill: Source }>(
          await fetch(`/api/skills/${encodeURIComponent(skillName)}`, { signal: ac.signal }),
        );
        if (ac.signal.aborted) return;
        setName(data.skill.name);
        setDescription(data.skill.description);
        setBody(data.skill.body);
        setDisableModelInvocation(data.skill.disableModelInvocation);
        setReferences(data.skill.references);
        setError(null);
        setReady(true);
      } catch (err) {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not open the skill.");
      }
    })();
    return () => ac.abort();
  }, [open, skillName]);

  function resetBlank() {
    setName("");
    setDescription("");
    setBody("");
    setDisableModelInvocation(false);
    setReferences([]);
    setError(null);
  }

  async function save() {
    setPending(true);
    setError(null);
    const payload = { name, description, body, disableModelInvocation, references };
    try {
      const response = await fetch(skillName ? `/api/skills/${encodeURIComponent(skillName)}` : "/api/skills", {
        method: skillName ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readJson(response);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the skill.");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!skillName) return;
    setPending(true);
    setError(null);
    try {
      await readJson(await fetch(`/api/skills/${encodeURIComponent(skillName)}`, { method: "DELETE" }));
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the skill.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
        else if (!skillName) resetBlank();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{skillName ? `Edit ${skillName}` : "New skill"}</DialogTitle>
          <DialogDescription>
            Only the name and description enter the skills index. The body loads when the model calls skill_view or you type /skill:name.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            Name
            <Input className="mt-1.5" value={name} onChange={(event) => setName(event.target.value)} aria-label="Skill name" spellCheck={false} />
          </label>
          <label className="block text-sm">
            Description
            <Textarea
              className="mt-1.5 min-h-16 text-sm"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              aria-label="Skill description"
            />
          </label>
          <label className="block text-sm">
            Procedure
            <Textarea
              className="mt-1.5 min-h-40 font-mono text-xs"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-label="Skill procedure"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={disableModelInvocation}
              onChange={(event) => setDisableModelInvocation(event.target.checked)}
            />
            Hide from the model index. /skill:name can still load it.
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm">References</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReferences((current) => [...current, { name: "", content: "" }])}
              >
                Add reference
              </Button>
            </div>
            {references.map((reference, index) => (
              <div key={index} className="space-y-1.5 rounded-lg border border-border p-2">
                <Input
                  value={reference.name}
                  placeholder="notes.md"
                  aria-label={`Reference ${index + 1} file name`}
                  onChange={(event) =>
                    setReferences((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)),
                    )
                  }
                />
                <Textarea
                  className="min-h-20 font-mono text-xs"
                  value={reference.content}
                  aria-label={`Reference ${index + 1} contents`}
                  onChange={(event) =>
                    setReferences((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, content: event.target.value } : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReferences((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove reference
                </Button>
              </div>
            ))}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          {skillName ? (
            <Button type="button" variant="destructive" disabled={pending} onClick={() => void remove()}>
              Delete
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !ready} onClick={() => void save()}>
            {pending ? "Saving…" : "Save skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
