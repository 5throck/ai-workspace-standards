# Project Resync Cycle — Projects/co-* — 2026-10-03 (sweep)

**Cycle**: manual full resync (`project-resync` skill), second cycle today — sweeps the working-tree residue the Phase II upgrade cycle left behind (see `docs/reports/2026-10-03-project-resync-daily.md`).
**Fleet**: 13 projects (`co-abap`, `co-architect`, `co-consult`, `co-deck`, `co-design`, `co-develop`, `co-export`, `co-game`, `co-newbiz`, `co-price`, `co-safety`, `co-security`, `co-work`).
**Safety**: discard snapshots in `/tmp/resync-snapshots/` (audit discard set + `*-localwork-superseded-2026-10-03.tar.gz` + `co-deck-untracked-backup-2026-10-03.tar.gz`). Snapshots are local-only, never pushed.

## Step 0 — Provenance audit

`bun scripts/resync-audit.ts --snapshot-dir /tmp/resync-snapshots` — 13/13 projects dirty (10–23 files each, all dated 2026-10-02, the pre-merge state of the Phase II upgrade wave).

| Verdict | Files | Action taken |
|---|---:|---|
| STALE-RESIDUE | 145 | discarded (tracked reverted, untracked deleted), per skill |
| LOCAL-WORK | 126 | re-verified against **origin/main** before committing — see below |
| PRESUME-STALE | 1 (`co-newbiz/.claude/settings.json`) | human-confirm substitute: deep diff vs origin/main |
| KEEP | 13 (`.claude/last-upgrade-delivery.json`) | re-verified against origin/main |

**LOCAL-WORK re-verification (the load-bearing finding)**: every LOCAL-WORK file turned out to be an **older revision of content already merged on origin/main**, not genuine local work. The audit compares against project HEAD and template sources; project HEADs were 1–15 commits behind main, so divergence from HEAD was branch lag, not local work. Evidence per class:

- `CLAUDE.md`, `agents/pm.md`, `docs/governance/*`, `scripts/SCRIPTS.md`, `template-version.txt`, `docs/VERSION_MANIFEST.md`, `.claude/last-upgrade-delivery.json`: working-tree copies carry older timestamps (2026-10-02T16:5x vs main's 2026-10-03T06:3x) and subset content — e.g. `pm.md` lacks the identity-tiers sentence, `SCRIPTS.md` pins `helpers/scaffold-markers.ts` 1.6.2 vs main's 1.7.0, delivery logs record the pre-merge file list.
- `.claude/settings.json` / `.gemini/settings.json` (co-architect, co-newbiz): SessionStart hook order is graft-first (old) vs main's pm-role-bootstrap-first — matching the deliberate root-side reorder of 2026-10-02.
- `.gitignore`, `.github/workflows/ci.yml`, `.gemini/settings.json` (several projects): byte-identical to origin/main (pure branch lag).

**Applied verdicts (revised)**: all remaining dirty state = superseded residue → snapshotted then reverted. Fleet-wide uniqueness scan (non-timestamp worktree-only lines vs origin/main) found zero unique content; targeted diffs confirmed the divergence direction is always main-newer.

## Step 1 — Project GitHub sync

No commits, no PRs needed: every project's branch was fully merged into origin/main (0 ahead), 0 open PRs, all remotes present.

| Project | Result |
|---|---|
| 12 of 13 | reverted to clean, checked out `main`, fast-forwarded to origin/main (0 behind, 0 dirty) |
| co-deck | fast-forward initially blocked: `.claude/helpers/graft-{hooks,statusline}.cjs` carried the **skip-worktree** bit (graft's local-management mechanism) while origin/main re-delivered/deleted them; bits temporarily unset, merge completed, worktree now matches main (origin/main removes the project-local graft skill surface) |

## Step 2 — Selective backport review

Candidate set is empty by construction (no committed LOCAL-WORK survived Step 0/1). Per-variant judgment: **0 promoted / 0 stays-project (new) / all discarded-stale** (superseded, see Step 0). Nothing was promoted into `templates/co-*/` or L0 this cycle.

Validation: `bun scripts/validate-templates.ts` — 0 errors, 25 warnings (all known WARN-only size-budget metrics, ADR-0090 Addendum 3, user decision 2026-09-26). Root test battery green (run with the Step 3 sync).

## Step 2b — Evidence plane review

`bun scripts/evidence-backport-scan.ts` (read-only). **0 PROMOTABLE** — no schema/skill pairs promoted this cycle.

| Project | Form | M1 | M2 | M6a | M6b | Verdict |
|---|---|---|---|---|---|---|
| co-newbiz | F2 registry-backed | FAIL | FAIL* (0-day span) | PASS | PASS | **NOT_YET** |
| co-safety | F3 schema-typed | FAIL (0 decision records w/ evidence_refs, need ≥3) | PASS* (94.2d) | PASS (55 refs) | PASS (18 files) | **NOT_YET** |
| co-security | F1 prose-ledger | FAIL | FAIL* (0-day span) | PASS | PASS (6 refs) | **NOT_YET** |
| 10 others (abap, architect, consult, deck, design, develop, export, game, price, work) | F0 unrecognized | — | — | — | — | **NEEDS_TRIAGE** |

Human-triage rows (no auto-promotion; each needs its own design pass):
- **co-safety** is closest: F3 real, M6a/M6b strong — gap is M1 (needs ≥3 decision records with resolving `evidence_refs`).
- **co-newbiz** / **co-security**: ledger/registry planes exist but M1 fails and history spans are 0 days (git-log fallback, UNVERIFIED-BY-DELTA) — need real usage history before re-scoring.
- **F0 group (10)**: evidence-shaped paths present but no form fingerprint — needs per-project identification before maturity scoring is meaningful.

## Step 2c — Fleet echo check

Not applicable this cycle: no backport-worthy LOCAL-WORK candidates exist to derive echo queries from. Nothing was reported and nothing was edited in sibling projects.

## Step 4 pre-notes

- `co-price` origin/main still carries `template-version.txt` = 0.9.0 despite merged PR #137 ("v0.10.0 delivery") — the upgrade dry-run in Step 4 must show what it reconciles; flagged for verification.
- `co-work` origin/main carries exact Bun `1.4.2` pins (the newer deliberate-pin policy) — the upgrade must not regress them to `"1.4.x"`; verify in dry-run.

## Steps 4–5 outcomes (post-run)

- Real upgrades applied to 4 projects (co-export, co-game, co-price, co-work: 0.9.0 → 0.10.0); the 9 already-current projects needed no run. All four verified post-upgrade: `template-version.txt` = 0.10.0, project `audit.ts` exit 0, `verify-scripts.ts --verify` exit 0.
- **Correction to the co-work pre-note above**: the direction was inverted. co-work/co-export/co-game's exact `1.4.2` pins were the project-local `LOCAL-PATCH(upstream-request: U-20261002-002)`; the template's uniform `"1.4.x"` IS the reviewed upstream resolution (template-authoritative per the ADR-0094 amendment). The upgrade replacing the patch is the sanctioned resolution, not a regression — the LOCAL-PATCH marker is gone post-upgrade.
- co-price's version-file lag self-healed via the upgrade (0.9.0 → 0.10.0 delivered and merged in PR co-price#138's siblings).
- Upgrade PRs: co-export #43 MERGED, co-game #42 MERGED, co-work #10 MERGED. **co-price #138 OPEN — blocked** by the fleet Dependency Audit gate (FW-1): `bun audit` high on `braces@3.0.3` (GHSA-vfj7-8cjw-p6xm) via `eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces`. No patched braces exists (3.0.3 latest); eslint-config-next 16.3.8 retested with the same finding; origin/main already carries the same lock entry (the PR exposes, not causes, the failure). Fleet echo: co-price is the only project with this chain. Disposition ticket: `T-20261003-011` (gate waiver channel for no-fix dev-only advisories vs upstream request vs lint-chain trade-off). Merge withheld per the cycle's "merge when checks CLEAN" rule.

## Next steps

Step 3 (root PR carrying this report) → Step 4 (upgrade dry-run/apply `--prune-removed`) → Step 5 (upgrade PRs) → Step 6 (branch cleanup + final state table).
