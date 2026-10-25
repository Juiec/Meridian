import { mkdirSync } from "node:fs";
import path from "node:path";

export function meridianHome(): string {
  const configured = process.env.MERIDIAN_HOME?.trim();
  return configured || process.cwd();
}

export function dataDir(): string {
  const dir = path.join(meridianHome(), "data");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function memoryDir(): string {
  const dir = path.join(dataDir(), "memory");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function skillsDir(): string {
  return path.join(meridianHome(), "skills");
}

export function agentDir(): string {
  return path.join(meridianHome(), "agent");
}

export function dbPath(): string {
  return path.join(dataDir(), "meridian.sqlite");
}

export function settingsPath(): string {
  return path.join(dataDir(), "settings.json");
}

export function mcpConfigPath(): string {
  return path.join(dataDir(), "mcp-servers.json");
}

export function customToolsPath(): string {
  return path.join(dataDir(), "custom-tools.json");
}

export function travelPlanPath(): string {
  return path.join(dataDir(), "travel-plan.json");
}

export function travelSettingsPath(): string {
  return path.join(dataDir(), "travel-settings.json");
}
