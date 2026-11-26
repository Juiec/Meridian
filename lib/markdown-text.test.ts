import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssistantText, MarkdownText } from "@/components/markdown-text";

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

  it("keeps a textual tool call literal, including the indented end of the file", () => {
    const file = [
      "/**",
      " * YOLO exporter",
      " */",
      "    for (let n = 2; usedNames.has(`${stem}`); n += 1) {",
      "      uniqueStem = `${stem}-${n}`;",
      "    }",
    ].join("\n");
    const text = [
      "Wrote the exporter.",
      "",
      "<tool_call>",
      "<function=workspace_write>",
      "<parameter=content>",
      file,
      "</parameter>",
      "</function>",
      "</tool_call>",
    ].join("\n");
    const html = renderToStaticMarkup(createElement(AssistantText, { text }));
    expect(html).toContain("Wrote the exporter.");
    expect(html).toContain("workspace_write");
    expect(html).toContain("for (let n = 2; usedNames.has(");
    expect(html).toContain("<pre");
    expect(html).not.toContain("<li");
    expect(html).not.toContain("&lt;tool_call&gt;");
  });

  it("does not turn unsafe image URLs into live image tags", () => {
    const html = render("![bad](javascript:alert(1))");
    expect(html).not.toContain("<img");
    expect(html).toContain("bad");
  });
});
