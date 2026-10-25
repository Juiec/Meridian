import { TOOLS, type ToolDefinition } from "@/lib/tools";

export const BUILTIN_TOOL_NAMES = new Set(TOOLS.map((tool) => tool.function.name));

const MAX_NAME = 64;

export type ToolRoute = {
  source: "mcp" | "custom";
  sourceId: string;
  remoteName: string;
};

export type RegistryTool = {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
};

export type McpRegistryInput = {
  serverId: string;
  serverSlug: string;
  tools: RegistryTool[];
};

export type CustomRegistryInput = {
  id: string;
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
};

export type ToolBundle = {
  definitions: ToolDefinition[];
  routes: Record<string, ToolRoute>;
};

export function sanitizeToolToken(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, MAX_NAME) || "tool";
}

function uniqueName(base: string, taken: Set<string>): string {
  const root = (base || "tool").slice(0, MAX_NAME);
  if (!taken.has(root)) return root;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${root.slice(0, MAX_NAME - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `tool_${taken.size}`.slice(0, MAX_NAME);
}

function clip(text: string, max: number): string {
  const trimmed = text.replace(/\u0000/g, "").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function schemaOrEmpty(schema: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!schema || Array.isArray(schema)) {
    return { type: "object", additionalProperties: true, properties: {} };
  }
  const encoded = JSON.stringify(schema);
  if (encoded.length > 8_000) {
    return { type: "object", additionalProperties: true, properties: {} };
  }
  if (schema.type === undefined) return { type: "object", ...schema };
  return schema;
}

export function mergeToolRegistry(input: { mcp: McpRegistryInput[]; custom: CustomRegistryInput[] }): ToolBundle {
  const taken = new Set(BUILTIN_TOOL_NAMES);
  const routes: Record<string, ToolRoute> = {};
  const extras: ToolDefinition[] = [];

  for (const server of input.mcp) {
    const slug = sanitizeToolToken(server.serverSlug);
    for (const tool of server.tools) {
      const remote = sanitizeToolToken(tool.name);
      const base = `mcp_${slug}_${remote}`.slice(0, MAX_NAME);
      const exposed = uniqueName(base, taken);
      taken.add(exposed);
      routes[exposed] = { source: "mcp", sourceId: server.serverId, remoteName: tool.name };
      const description = tool.description.trim()
        ? clip(tool.description, 900)
        : `MCP tool ${tool.name} from ${server.serverSlug}.`;
      extras.push({
        type: "function",
        function: {
          name: exposed,
          description: clip(`MCP server ${server.serverSlug}. ${description}`, 1024),
          parameters: schemaOrEmpty(tool.parameters),
        },
      });
    }
  }

  for (const tool of input.custom) {
    const wanted = sanitizeToolToken(tool.name);
    const exposed = taken.has(wanted) ? uniqueName(`custom_${wanted}`.slice(0, MAX_NAME), taken) : wanted;
    taken.add(exposed);
    routes[exposed] = { source: "custom", sourceId: tool.id, remoteName: tool.name };
    extras.push({
      type: "function",
      function: {
        name: exposed,
        description: clip(tool.description || tool.name, 1024),
        parameters: schemaOrEmpty(tool.parameters),
      },
    });
  }

  return { definitions: [...TOOLS, ...extras], routes };
}
