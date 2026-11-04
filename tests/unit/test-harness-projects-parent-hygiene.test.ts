/**
 * T-20261104-003 — regression pin (project-loss hardening design §5.2).
 *
 * The 2026-11-04 `rm -rf Projects` incident was triggered by a deceptive EMPTY
 * `Projects/` parent left at the repo root by a test run (a fixture created
 * `Projects/<name>/`, the tenant child was cleaned up, the parent stayed). This pin
 * fails any run that LEAVES that state behind:
 *
 *   - `Projects/` absent (CI checkout)                       → pass
 *   - `Projects/` present with entries (fleet)               → pass
 *   - `Projects/` present but EMPTY, persisting past the
 *     settle window                                          → FAIL (incident precondition)
 *
 * v1.1.0 — CI race fix: under bun's parallel test scheduling a sibling suite can
 * legitimately hold an empty-`Projects/` window mid-run (create → populate → sweep,
 * e.g. the project-target-guards fixtures). A single-shot check false-positives on
 * that transient, so the pin re-observes across a short settle window and fails only
 * when the empty-parent state PERSISTS. A leftover-across-runs leak — the state still
 * present in a quiet repo — fails deterministically on the first poll.
 *
 * @version 1.1.0
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Settle window: 8 re-observations × 250 ms ≈ 2 s of persistent emptiness before failing. */
const SETTLE_POLLS = 8;
const SETTLE_DELAY_MS = 250;

describe("test-harness hygiene: no empty Projects/ parent under the repo root (T-20261104-003)", () => {
  test("Projects/, when present at the repo root, is not empty (past the settle window)", async () => {
    const projectsDir = join(REPO_ROOT, "Projects");
    for (let poll = 0; ; poll++) {
      if (!existsSync(projectsDir)) return; // gone (or never was) — pass
      const entries = readdirSync(projectsDir);
      if (entries.length > 0) return; // populated — pass
      if (poll >= SETTLE_POLLS) break; // empty persisted past the settle window — leak
      await Bun.sleep(SETTLE_DELAY_MS);
    }
    // A present-but-empty Projects/ is the deceptive state that made `rm -rf Projects`
    // look like a safe cleanup on 2026-11-04. If this fails, a test run (or manual
    // action) left the parent behind: remove it (`rmdir`) and fix the creator.
    expect(readdirSync(projectsDir).length).toBeGreaterThan(0);
  });
});
