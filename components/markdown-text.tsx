"use client";

import ReactMarkdown from "react-markdown";

export function MarkdownText({ text }: { text: string }) {
  return (
    <ReactMarkdown
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
        pre: ({ children }) => (
          <pre className="mb-3 overflow-x-auto rounded-lg bg-background/80 p-3 text-[13px] leading-6 last:mb-0">
            {children}
          </pre>
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
