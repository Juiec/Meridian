import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownText } from "@/components/markdown-text";

const IMAGE_ID = "84bf2ce4-95b0-4907-978f-27828893fb55";

function render(text: string): string {
  return renderToStaticMarkup(createElement(MarkdownText, { text }));
}

describe("chat markdown display", () => {
  it("renders fenced code with a copy control and language label", () => {
    const html = render('```ts\nconst answer = 42;\n```');
    expect(html).toContain("Copy");
    expect(html).toContain("ts");
    expect(html).toContain("const answer = 42;");
    expect(html).toContain("<pre");
  });

  it("renders local generated images inline", () => {
    const html = render(`![Moon garden](/api/images/${IMAGE_ID})`);
    expect(html).toContain("<figure");
    expect(html).toContain(`/api/images/${IMAGE_ID}`);
    expect(html).toContain("Moon garden");
  });

  it("does not turn unsafe image URLs into live image tags", () => {
    const html = render("![bad](javascript:alert(1))");
    expect(html).not.toContain("<img");
    expect(html).toContain("bad");
  });
});
