import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
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

export function imagesDir(): string {
  const dir = path.join(dataDir(), "images");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function skillsDir(): string {
  return path.join(meridianHome(), ".agents", "skills");
}

/** Older project skills. Still read so an existing checkout keeps working. */
export function legacySkillsDir(): string {
  return path.join(meridianHome(), "skills");
}

/**
 * Shared user skills (`~/.agents/skills`), the folder most agent harnesses
 * install global skills into. "0" scans none. Any other value is a
 * path-delimiter list of directories, used by tests.
 */
export function globalSkillDirs(): string[] {
  const flag = process.env.MERIDIAN_GLOBAL_SKILLS?.trim();
  if (flag === "0") return [];
  if (flag) return flag.split(path.delimiter).map((entry) => entry.trim()).filter(Boolean);
  return [path.join(homedir(), ".agents", "skills")];
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

export function endpointsPath(): string {
  return path.join(dataDir(), "endpoints.json");
}

export function endpointSecretsPath(): string {
  return path.join(dataDir(), "secrets", "endpoints.json");
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

export function tripPlanPath(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Trip id is not valid.");
  }
  return path.join(dataDir(), "trips", `${id}.json`);
}

export function travelSettingsPath(): string {
  return path.join(dataDir(), "travel-settings.json");
}

export function imageSettingsPath(): string {
  return path.join(dataDir(), "image-settings.json");
}
