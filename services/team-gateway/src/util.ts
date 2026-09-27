/** Small shared helpers: ids, directory moves across volumes, JSON persistence, tailing. */

import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function genId(prefix = "gw"): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return prefix ? `${prefix}-${rand}` : rand;
}

/** Move a directory, falling back to copy+delete across filesystem boundaries (scaffold lives in
 * the workspace clone's Projects/, tenants live in the data dir — possibly different volumes). */
export function moveDir(src: string, dest: string): void {
  mkdirSync(dirname(dest), { recursive: true });
  try {
    renameSync(src, dest);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "EXDEV") {
      cpSync(src, dest, { recursive: true });
      rmSync(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

export function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function tail(text: string, max = 2000): string {
  return text.length <= max ? text : `…${text.slice(-max)}`;
}
