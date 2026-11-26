import { cpSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export function makeHome(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "meridian-"));
  cpSync(path.join(process.cwd(), "agent"), path.join(dir, "agent"), { recursive: true });
  cpSync(path.join(process.cwd(), ".agents", "skills"), path.join(dir, ".agents", "skills"), { recursive: true });
  process.env.MERIDIAN_GLOBAL_SKILLS = "0";
  mkdirSync(path.join(dir, "data"), { recursive: true });
  process.env.MERIDIAN_HOME = dir;
  process.env.LM_STUDIO_BASE_URL = "http://127.0.0.1:9/v1";
  process.env.LM_STUDIO_API_KEY = "";
  process.env.MODEL = "test-model";
  return dir;
}
