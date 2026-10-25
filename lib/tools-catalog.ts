import { buildToolBundle } from "@/lib/agent-tools";
import { listCustomTools } from "@/lib/custom-tools";
import { listMcpServers } from "@/lib/mcp-config";
import { mcpLiveView } from "@/lib/mcp-runtime";
import type { ToolsOverview } from "@/lib/tool-types";

function exposedName(
  routes: ReturnType<typeof buildToolBundle>["routes"],
  source: "mcp" | "custom",
  sourceId: string,
  remoteName: string,
): string | null {
  const match = Object.entries(routes).find(
    ([, route]) => route.source === source && route.sourceId === sourceId && route.remoteName === remoteName,
  );
  return match?.[0] ?? null;
}

export function toolsOverview(): ToolsOverview {
  const servers = listMcpServers();
  const customs = listCustomTools();
  const bundle = buildToolBundle();
  return {
    servers: servers.map((server) => {
      const live = mcpLiveView(server);
      return {
        id: server.id,
        name: server.name,
        enabled: server.enabled,
        transport: server.transport,
        command: server.command,
        args: server.args,
        envKeys: Object.keys(server.env).sort(),
        url: server.url,
        headerKeys: Object.keys(server.headers).sort(),
        status: live.status,
        error: live.error,
        tools: live.tools.flatMap((tool) => {
          const name = exposedName(bundle.routes, "mcp", server.id, tool.name);
          if (!name) return [];
          return [{ name: tool.name, description: tool.description, exposedName: name }];
        }),
      };
    }),
    customTools: customs.map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      enabled: tool.enabled,
      method: tool.method,
      url: tool.url,
      headerKeys: Object.keys(tool.headers).sort(),
      exposedName: tool.enabled ? exposedName(bundle.routes, "custom", tool.id, tool.name) : null,
    })),
    catalog: bundle.definitions.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      source: bundle.routes[tool.function.name]?.source ?? "builtin",
    })),
  };
}
