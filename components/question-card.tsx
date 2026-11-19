"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import { parseAskUser, readAskAnswer } from "@/lib/ask-user";
import type { ToolPart } from "@/lib/group-messages";

export function isQuestionPart(part: ToolPart): boolean {
  if (part.name !== "ask_user") return false;
  const parsed = parseAskUser(part.arguments);
  if (!parsed.ok) return false;
  if (part.result && !readAskAnswer(part.result)) return false;
  return true;
}

export function QuestionCard({
  part,
  onAnswer,
}: {
  part: ToolPart;
  onAnswer?: (label: string) => void;
}) {
  const labelId = useId();
  const parsed = parseAskUser(part.arguments);
  if (!parsed.ok) return null;
  const settled = readAskAnswer(part.result);
  const interactive = Boolean(onAnswer) && !settled;

  return (
    <div role="group" aria-labelledby={labelId} className="rounded-xl border border-border bg-card px-4 py-3">
      <p id={labelId} className="text-[15px] leading-7">
        {parsed.prompt}
      </p>
      {settled ? (
        <p className="mt-3 flex items-start gap-2.5 rounded-xl bg-secondary px-3 py-2.5 text-[15px] leading-6">
          <Check className="mt-1 size-3.5 shrink-0 text-sage" aria-hidden />
          <span>
            <span className="sr-only">Chosen. </span>
            {settled.answer}
          </span>
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {parsed.options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={!interactive}
              onClick={() => onAnswer?.(option.label)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-[15px] leading-6 transition-colors hover:bg-secondary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-70"
            >
              {option.label}
            </button>
          ))}
          {interactive ? (
            <p className="px-1 pt-1 text-xs text-muted-foreground">Or type your own answer below.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
