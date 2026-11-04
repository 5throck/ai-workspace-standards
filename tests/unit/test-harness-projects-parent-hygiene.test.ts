/**
 * T-20261104-003 — regression pin (project-loss hardening design §5.2).
 *
 * The 2026-11-04 `rm -rf Projects` incident was triggered by a deceptive EMPTY
 * `Projects/` parent left at the repo root by a co-workspace test run (a relative-cwd
 * fixture created `Projects/<name>/`, the tenant child was cleaned up, the parent
 * stayed). This pin fails any run that leaves that state behind:
 *
 *   - `Projects/` absent (CI checkout)          → pass
 *   - `Projects/` present with entries (fleet)  → pass
 *   - `Projects/` present but EMPTY             → FAIL (the incident precondition)
 *
 * The fix removes the cause (absolute fixture roots + rmdirIfEmpty sweeps), so an
 * empty parent "cannot recur from tests" (design §5.2 layer 4); this pin makes any
 * silent regression of that class loud instead of invisible.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

describe("test-harness hygiene: no empty Projects/ parent under the repo root (T-20261104-003)", () => {
  test("Projects/, when present at the repo root, is not empty", () => {
    const projectsDir = join(REPO_ROOT, "Projects");
    if (!existsSync(projectsDir)) return; // CI checkouts legitimately have no Projects/
    const entries = readdirSync(projectsDir);
    // A present-but-empty Projects/ is the deceptive state that made `rm -rf Projects`
    // look like a safe cleanup on 2026-11-04. If this fails, a test run (or manual
    // action) left the parent behind: remove it (`rmdir`) and fix the creator.
    expect(entries.length).toBeGreaterThan(0);
  });
});
