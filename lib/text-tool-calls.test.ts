import { describe, expect, it } from "vitest";

import { extractTextToolCalls, splitToolCallText } from "@/lib/text-tool-calls";

const file = [
  "/**",
  " * YOLO exporter",
  " */",
  "    const uniqueStem = stem;",
  "    for (let n = 2; usedNames.has(`${stem}`); n += 1) {",
  "      uniqueStem = `${stem}-${n}`;",
  "    }",
  "",
].join("\n");

function qwenWrite(body: string): string {
  return [
    "Wrote the exporter.",
    "",
    "<tool_call>",
    "<function=workspace_write>",
    "<parameter=path>",
    "visiontrainer/services/data-platform/src/domain/yolo-export.ts",
    "</parameter>",
    "<parameter=content>",
    body,
    "</parameter>",
    "</function>",
    "</tool_call>",
    "",
  ].join("\n");
}

describe("text tool calls", () => {
  it("keeps the file body, including the indented end and template strings", () => {
    const extracted = extractTextToolCalls(qwenWrite(file));
    expect(extracted.prose).toBe("Wrote the exporter.");
    expect(extracted.calls).toHaveLength(1);
    expect(extracted.calls[0].name).toBe("workspace_write");
    const args = JSON.parse(extracted.calls[0].arguments) as { path: string; content: string };
    expect(args.path).toBe("visiontrainer/services/data-platform/src/domain/yolo-export.ts");
    expect(args.content).toBe(file);
    expect(args.content).toContain(" * YOLO exporter");
    expect(args.content).toContain("    for (let n = 2; usedNames.has(`${stem}`); n += 1) {");
  });

  it("does not run a tool call that is still open at the end of the reply", () => {
    const text = [
      "Wrote the exporter.",
      "",
      "<tool_call>",
      "<function=workspace_write>",
      "<parameter=path>",
      "visiontrainer/yolo-export.ts",
      "</parameter>",
      "<parameter=content>",
      file,
      "    return { files };",
    ].join("\n");
    const extracted = extractTextToolCalls(text);
    expect(extracted.calls).toHaveLength(0);
    expect(extracted.prose).toContain("<tool_call>");
    const spans = splitToolCallText(text);
    const call = spans.find((span) => span.kind === "call");
    expect(call?.kind).toBe("call");
    if (call?.kind !== "call") return;
    expect(call.closed).toBe(false);
    expect(call.arguments).toBeNull();
    const content = call.parameters.find((param) => param.name === "content");
    expect(content?.partial).toBe(true);
    expect(content?.value).toContain("    for (let n = 2;");
    expect(content?.value.endsWith("    return { files };")).toBe(true);
  });

  it("accepts a JSON tool call and a tool with no parameters", () => {
    const json = extractTextToolCalls(
      '<tool_call>\n{"name":"current_time","arguments":{}}\n</tool_call>',
    );
    expect(json.calls).toEqual([{ name: "current_time", arguments: "{}" }]);

    const xml = extractTextToolCalls("<tool_call>\n<function=current_time>\n</function>\n</tool_call>");
    expect(xml.calls).toEqual([{ name: "current_time", arguments: "{}" }]);
    expect(xml.prose).toBe("");
  });

  it("leaves ordinary replies unchanged", () => {
    const text = "No tools here.\n";
    expect(extractTextToolCalls(text)).toEqual({ prose: text, calls: [] });
  });
});
