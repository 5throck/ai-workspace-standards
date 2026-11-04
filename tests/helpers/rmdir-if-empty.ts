/**
 * T-20261104-003 — empty-parent sweep (project-loss hardening design §5.2, layer 2).
 *
 * Removes `dir` only when it is empty. A test suite that (belt-and-braces) created a
 * `Projects/` parent under its fixture root calls this in its `afterAll` so no empty
 * parent directory is ever left behind — the deceptive empty `Projects/` left at the
 * repo root by a test run was the indirect trigger of the 2026-11-04 `rm -rf Projects`
 * incident.
 *
 * Swallows ENOTEMPTY (dir has content — leave it alone) and ENOENT (already gone);
 * rethrows anything else so real filesystem errors stay loud.
 *
 * @version 1.0.0
 */
import { rmdirSync } from "node:fs";

export function rmdirIfEmpty(dir: string): void {
  try {
    rmdirSync(dir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOTEMPTY" || code === "ENOENT") return;
    throw err;
  }
}
