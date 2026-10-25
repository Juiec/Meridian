export type McpTransport = "stdio" | "http" | "sse";

export type McpConnectionStatus = "disabled" | "idle" | "connected" | "error";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type PublicMcpTool = {
  name: string;
  description: string;
  exposedName: string;
};

export type PublicMcpServer = {
  id: string;
  name: string;
  enabled: boolean;
  transport: McpTransport;
  command: string;
  args: string[];
  envKeys: string[];
  url: string;
  headerKeys: string[];
  status: McpConnectionStatus;
  error: string | null;
  tools: PublicMcpTool[];
};

export type PublicCustomTool = {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
  method: HttpMethod;
  url: string;
  headerKeys: string[];
  exposedName: string | null;
};

export type CatalogEntry = {
  name: string;
  description: string;
  source: "builtin" | "mcp" | "custom";
};

export type ToolsOverview = {
  servers: PublicMcpServer[];
  customTools: PublicCustomTool[];
  catalog: CatalogEntry[];
};
