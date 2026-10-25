import { describe, expect, it } from "vitest";

import { TOOLS } from "@/lib/tools";
import { mergeToolRegistry, sanitizeToolToken } from "@/lib/tool-registry";

const builtins = TOOLS.map((tool) => tool.function.name);

describe("tool registry", () => {
  it("keeps built-ins and renames collisions", () => {
    const bundle = mergeToolRegistry({
      mcp: [
        {
          serverId: "s1",
          serverSlug: "Desk",
          tools: [
            { name: "memory", description: "Remote memory that must not replace the built-in.", parameters: { type: "object" } },
            { name: "Ping Tool", description: "Ping the demo.", parameters: { type: "object", properties: { note: { type: "string" } } } },
          ],
        },
        {
          serverId: "s2",
          serverSlug: "desk",
          tools: [{ name: "ping_tool", description: "Second ping.", parameters: { type: "object" } }],
        },
      ],
      custom: [
        { id: "c1", name: "memory", description: "Should not replace memory.", parameters: { type: "object" } },
        { id: "c2", name: "current_time", description: "Should not replace current_time.", parameters: { type: "object" } },
        {
          id: "c3",
          name: "echo",
          description: "Echo a note.",
          parameters: { type: "object", properties: { note: { type: "string" } } },
        },
      ],
    });

    const names = bundle.definitions.map((tool) => tool.function.name);
    for (const builtin of builtins) {
      expect(names.filter((name) => name === builtin)).toEqual([builtin]);
    }
    expect(names.slice(0, builtins.length)).toEqual(builtins);
    expect(bundle.routes.mcp_desk_memory).toEqual({ source: "mcp", sourceId: "s1", remoteName: "memory" });
    expect(bundle.routes.mcp_desk_ping_tool).toEqual({ source: "mcp", sourceId: "s1", remoteName: "Ping Tool" });
    expect(bundle.routes.mcp_desk_ping_tool_2).toEqual({ source: "mcp", sourceId: "s2", remoteName: "ping_tool" });
    expect(bundle.routes.custom_memory).toEqual({ source: "custom", sourceId: "c1", remoteName: "memory" });
    expect(bundle.routes.custom_current_time.source).toBe("custom");
    expect(bundle.routes.echo).toEqual({ source: "custom", sourceId: "c3", remoteName: "echo" });
    expect(names.every((name) => /^[a-z0-9_-]{1,64}$/.test(name))).toBe(true);
    expect(bundle.definitions.find((tool) => tool.function.name === "memory")?.function.description).toContain("MEMORY");
  });

  it("drops nothing from an empty extra list and sanitizes tokens", () => {
    const bundle = mergeToolRegistry({ mcp: [], custom: [] });
    expect(bundle.definitions).toHaveLength(builtins.length);
    expect(bundle.routes).toEqual({});
    expect(sanitizeToolToken("  Ping Tool!! ")).toBe("ping_tool");
    expect(sanitizeToolToken("***")).toBe("tool");
    const long = mergeToolRegistry({
      mcp: [
        {
          serverId: "s",
          serverSlug: "n".repeat(80),
          tools: [{ name: "t".repeat(80), description: "x".repeat(2000), parameters: { type: "object" } }],
        },
      ],
      custom: [],
    });
    const extra = long.definitions.at(-1);
    expect(extra?.function.name.length).toBeLessThanOrEqual(64);
    expect(extra?.function.name.startsWith("mcp_")).toBe(true);
    expect(extra?.function.description.length).toBeLessThanOrEqual(1024);
  });
});
