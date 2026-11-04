/**
 * T-20261104-003 — empty-parent sweep (project-loss hardening design §5.2, layer 2).
 *
 * Removes `dir` only when it is empty. A test suite that (belt-and-braces) created a
 * `Projects/` parent under its fixture root calls this in its `afterAll` so no empty
 * parent directory is ever left behind — the deceptive empty `Projects/` left at the
 * repo root by a test run was the indirect trigger of the 2026-11-04 `rm -rf Projects`
 * incident.
 *
 * Error contract (cross-platform, v1.1.0): missing target (ENOENT on lstat) and
 * non-empty target (ENOTEMPTY on rmdir) are swallowed; everything else stays loud.
 * The not-a-directory leg is enforced by type (lstat) rather than by errno:
 * `fs.rmdir()` on a file is ENOTDIR on POSIX but ENOENT on win32 (Node docs,
 * nodejs/node#18014 — the CRT's _wrmdir maps ERROR_FILE_NOT_FOUND to ENOENT), so an
 * errno-matched swallow silently ate the loud leg on windows-latest.
 *
 * @version 1.1.0
 */
import { lstatSync, rmdirSync } from "node:fs";

export function rmdirIfEmpty(dir: string): void {
  let isDirectory = false;
  try {
    isDirectory = lstatSync(dir).isDirectory();
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return; // already gone
    throw err;
  }
  if (!isDirectory) {
    throw new Error(`rmdirIfEmpty: refusing to rmdir a non-directory: ${dir}`);
  }
  try {
    rmdirSync(dir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOTEMPTY" || code === "ENOENT") return;
    throw err;
  }
}
