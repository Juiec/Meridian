import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export function writeAtomic(file: string, contents: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, file);
}
