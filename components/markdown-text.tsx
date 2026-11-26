"use client";

import { Check, Copy } from "lucide-react";
import { isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

import { splitToolCallText, type TextSpan } from "@/lib/text-tool-calls";

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

function codeLanguage(node: ReactNode): string {
  let language = "";
  const walk = (value: ReactNode) => {
    if (language) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (isValidElement<{ className?: string; children?: ReactNode }>(value)) {
      const match = /language-([\w+#.-]+)/.exec(value.props.className ?? "");
      if (match) {
        language = match[1];
        return;
      }
      walk(value.props.children);
    }
  };
  walk(node);
  return language;
}

function safeImageSrc(src: string): boolean {
  return (
    /^\/api\/images\/[0-9a-f-]{36}$/i.test(src) ||
    /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(src)
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    const copied = await copyText(code.replace(/\n$/, ""));
    setState(copied ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  };

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border bg-background/80 last:mb-0">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={state === "copied" ? "Code copied" : "Copy code"}
          className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {state === "copied" ? <Check className="size-3 text-sage" /> : <Copy className="size-3" />}
          <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-6">
        <code className="font-mono">{code.replace(/\n$/, "")}</code>
      </pre>
    </div>
  );
}

function TextToolCallBlock({ span }: { span: Extract<TextSpan, { kind: "call" }> }) {
  const parameters = span.parameters.filter((param) => param.value.length > 0 || !param.partial);
  return (
    <div className="space-y-2">
      <p className="font-mono text-[13px] text-copper">{span.name || "tool call"}</p>
      {parameters.length > 0 ? (
        parameters.map((param, index) => (
          <CodeBlock
            key={`${param.name}-${index}`}
            code={param.value}
            language={param.partial ? `${param.name} …` : param.name}
          />
        ))
      ) : (
        <CodeBlock code={span.raw} language={span.closed ? "tool call" : "tool call …"} />
      )}
    </div>
  );
}

/** Model prose. A textual tool call stays literal so its file body is not parsed as markdown. */
export function AssistantText({ text }: { text: string }) {
  const spans = splitToolCallText(text);
  if (spans.length === 1 && spans[0].kind === "prose") return <MarkdownText text={spans[0].text} />;
  return (
    <div className="space-y-3">
      {spans.map((span, index) =>
        span.kind === "prose" ? (
          span.text.trim() ? <MarkdownText key={index} text={span.text} /> : null
        ) : (
          <TextToolCallBlock key={index} span={span} />
        ),
      )}
    </div>
  );
}

export function MarkdownText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      urlTransform={(url) => {
        if (/^(https?:\/\/|\/api\/images\/[0-9a-f-]{36}|data:image\/(png|jpeg|gif|webp);base64,)/i.test(url)) {
          return url;
        }
        return "";
      }}
      components={{
        p: ({ children }) => <p className="mb-3 leading-7 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-7">{children}</li>,
        h1: ({ children }) => <h3 className="mt-4 mb-2 font-display text-2xl leading-tight">{children}</h3>,
        h2: ({ children }) => <h3 className="mt-4 mb-2 text-lg font-medium">{children}</h3>,
        h3: ({ children }) => <h3 className="mt-3 mb-1.5 font-medium">{children}</h3>,
        a: ({ href, children }) => {
          if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>;
          return (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-copper underline underline-offset-2"
            >
              {children}
            </a>
          );
        },
        img: ({ src, alt }) => {
          const url = typeof src === "string" ? src : "";
          if (!safeImageSrc(url)) {
            return (
              <span className="rounded border border-border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {alt || "Image"}
              </span>
            );
          }
          return (
            <figure className="mb-3 overflow-hidden rounded-xl border border-border bg-muted/40 last:mb-0">
              <a href={url} target="_blank" rel="noreferrer noopener" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={alt || "Generated image"}
                  loading="lazy"
                  className="max-h-[28rem] w-full bg-background object-contain"
                />
              </a>
              {alt ? (
                <figcaption className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">{alt}</figcaption>
              ) : null}
            </figure>
          );
        },
        pre: ({ children }) => (
          <CodeBlock code={nodeText(children)} language={codeLanguage(children)} />
        ),
        code: ({ className, children }) =>
          className ? (
            <code className={className}>{children}</code>
          ) : (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.88em]">{children}</code>
          ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-l-2 border-copper/70 pl-3 text-muted-foreground last:mb-0">
            {children}
          </blockquote>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
