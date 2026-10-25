import { executeCustomTool, listCustomTools } from "@/lib/custom-tools";
import { messageOf } from "@/lib/errors";
import { listMcpServers } from "@/lib/mcp-config";
import { callMcpTool, ensureMcpConnections, mcpLiveView } from "@/lib/mcp-runtime";
import { executeTool } from "@/lib/tools";
import { mergeToolRegistry, type ToolBundle, type ToolRoute } from "@/lib/tool-registry";

function safeList<T>(read: () => T[]): T[] {
  try {
    return read();
  } catch {
    return [];
  }
}

export function buildToolBundle(): ToolBundle {
  const servers = safeList(listMcpServers);
  const customs = safeList(listCustomTools);
  const mcp = servers
    .filter((server) => server.enabled)
    .map((server) => {
      const live = mcpLiveView(server);
      return {
        serverId: server.id,
        serverSlug: server.name,
        tools: live.status === "connected" ? live.tools : [],
      };
    })
    .filter((server) => server.tools.length > 0);

  return mergeToolRegistry({
    mcp,
    custom: customs
      .filter((tool) => tool.enabled)
      .map((tool) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
  });
}

export async function prepareAgentTools(): Promise<ToolBundle> {
  try {
    await ensureMcpConnections();
  } catch {
    /* a failed server is recorded and skipped */
  }
  return buildToolBundle();
}

export async function executeAgentTool(
  name: string,
  rawArgs: string,
  routes: Record<string, ToolRoute>,
): Promise<Record<string, unknown>> {
  const route = routes[name];
  try {
    if (!route) return await executeTool(name, rawArgs);
    if (route.source === "mcp") return await callMcpTool(route.sourceId, route.remoteName, rawArgs);
    return await executeCustomTool(route.sourceId, rawArgs);
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}
