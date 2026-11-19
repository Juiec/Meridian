import { chmodSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Write via a temp file in the same directory. `mode` is applied to the temp file and the final file. */
export function writeAtomic(file: string, contents: string, mode?: number) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, contents, mode === undefined ? "utf8" : { encoding: "utf8", mode });
  if (mode !== undefined) chmodSync(tmp, mode);
  renameSync(tmp, file);
  if (mode !== undefined) chmodSync(file, mode);
}
