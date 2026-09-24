# Codex Managed-Block Merge + Variant Asset-Dir Claim Routing Design (PR B of the Backlog-Processing Program)

- **Date**: 2026-09-25
- **Status**: Implemented (2026-09-25 — D1 COMMON-CODEX pattern + D2 VARIANT ASSET DIRS claim routing delivered per §9 order; AC5a pre-fix failures recorded for T-010 (3 unit + 1 integration merge-verdict) and T-011 (asset-pass UPDATE on a committed procedure edit); D5 matrix diffs show only the permitted differences on fixtures A (co-develop) and B (co-safety); battery green per §10)
- **Owner**: Template Architect (design) → Automation Engineer (implementation)
- **Program context**: PR B of the backlog-processing program. It implements the two upgrade/merge machinery tickets filed as follow-ups of the platform-parity P1 bugfixes PR (merged as PR #1057, spec `2026-09-24-platform-parity-p1-bugfixes-design`): T-20260924-010 (COMMON-CODEX managed-block merge) and T-20260924-011 (VARIANT ASSET DIRS `resolveClaim` routing).
- **Spec id**: `2026-09-25-codex-merge-claim-routing-design` (registry: `docs/specs/registry.json`, source: `architect`)
- **Tickets**: `tickets/governance/T-20260924-010.yaml`, `tickets/governance/T-20260924-011.yaml`
- **Related ADRs**: ADR-0074 (Universal Design Gate), ADR-0079 (ASD-STE100), ADR-0065 (accessibility), ADR-0070 (preview verification), ADR-0036 (TypeScript-only scripts), ADR-0076/ADR-0077 (codex platform policy), ADR-0063 (procedures)

---

## 1. Summary

Make the CODEX.md managed-block merge functional and make the VARIANT ASSET DIRS upgrade pass consult the claim table. Two changes. First, add the `COMMON-CODEX` pattern to `MANAGED_PATTERNS` in `scripts/lib/managed-block-merge.ts`. The merge engine is already pattern-generic; the MERGE pass already lists CODEX.md; the `MERGE_MANAGED_FILES` claim already landed (upgrade-policy 1.13.0, PR #1057). The pattern is the last missing piece, and it activates union-merge for the single COMMON-CODEX zone in project CODEX.md files. Second, route the VARIANT ASSET DIRS pass through `resolveClaim`: the pass currently hash-syncs whole top-level template directories without consulting the claim table. Verification found one live contradiction the P1 audit missed — `procedures/**` rides this pass with overwrite semantics while `resolveClaim` assigns it `ADD_IF_MISSING` (the dedicated PROCEDURES pass preserves project-owned entries). The fix filters every walked file by its claim pass and delivers only files the claim table assigns to this pass.

## 2. Background

### 2.1 Provenance

Both tickets come from the platform-parity P1 bugfixes change set (PR #1057, spec `2026-09-24-platform-parity-p1-bugfixes-design.md`, implementation brief step 13):

- **T-20260924-010** — that spec's D4 added `CODEX.md` to `MERGE_MANAGED_FILES` (`scripts/lib/upgrade-policy.ts:198`) but left the merge itself a documented no-op: `MANAGED_PATTERNS` (`scripts/lib/managed-block-merge.ts:64-72`) knows COMMON-CLAUDE and COMMON-GEMINI but has no COMMON-CODEX entry. §2.3 step 4 of that spec states the contract: "when COMMON-CODEX later joins `MANAGED_PATTERNS` … union-merge starts working with zero further claim work".
- **T-20260924-011** — that spec's D3 added `.codex` to `VARIANT_ASSET_DIR_SKIP` and filed the general bypass: "the asset-dir pass never consults `resolveClaim` for any directory it walks … File a follow-up ticket; do not fix here." The pass comment at `scripts/upgrade-project.ts:2093-2098` records the same follow-up.

All file:line references below were re-verified at commit `812c742e` (branch `main`, clean tree). The P1 spec's line numbers predate #1057 and are corrected here.

### 2.2 Corrected site inventory (verified at `812c742e`)

| # | Site | Current state |
|---|------|---------------|
| 1 | `scripts/lib/managed-block-merge.ts:64-72` (`MANAGED_PATTERNS`) | Seven patterns: WORKSPACE-MANAGED, COMMON-CLAUDE, COMMON-GEMINI, VARIANT-INJECT, COMMON-AGENTS, COMMON-CONTEXT, DYNAMIC_SKILLS. No COMMON-CODEX. Patterns are inline literals in this file — no shared constants module. |
| 2 | `scripts/lib/managed-block-merge.ts:93-105` (`scanPatternBlocks`), `:236-343` (`mergeManagedBlocks`) | Fully pattern-generic. COMMON-* zones are key-less (unlabeled): matched positionally; keys are extracted only for WORKSPACE-MANAGED and VARIANT-INJECT. Adding a pattern requires no engine change. |
| 3 | `scripts/upgrade-project.ts:1265` (MERGE pass) | `if (platform === 'codex' || platform === 'all') MERGE_FILES.push('CODEX.md')` — already lists CODEX.md. The observed "no managed markers — skipping CODEX.md" log comes from `mergeWorkspaceManaged` at `:1061-1063`. |
| 4 | `scripts/lib/upgrade-policy.ts:198` (`MERGE_MANAGED_FILES`) | `['CLAUDE.md', 'GEMINI.md', 'CODEX.md', '.gitignore', 'AGENTS.md', 'agents/pm.md']` — the claim half of the fix is live. |
| 5 | `scripts/lib/upgrade-policy.ts:265` | `resolveClaim('CODEX.md')` → `{ policy: 'MERGE_MANAGED', pass: 'MERGE' }`; the TEMPLATE TREE SYNC pass filter (`upgrade-project.ts:2271-2272`) skips it. The wholesale-overwrite path for CODEX.md is dead since #1057. |
| 6 | `scripts/upgrade-project.ts:2088-2092` (`VARIANT_ASSET_DIR_SKIP`) | Skip set: `agents, skills, scripts, docs, .claude, .gemini, .agents, .codex, .git, .github, .githooks, memory, node_modules`. `.codex` joined in v1.47.0 (#1057). |
| 7 | `scripts/upgrade-project.ts:2099-2138` (pass body) | Discovers every other top-level template directory and hash-syncs it file-by-file: missing project file → `NEW`/`COPIED`; hash diff → `UPDATE` (or `CONFLICT` when `isLocallyModified` — the pre-upgrade dirty set, `:1102-1105`) → overwrite by `copyFileSync`. No `resolveClaim` call anywhere in the pass. |
| 8 | `scripts/lib/upgrade-policy.ts:322-325` | The claim table already anticipates this pass as owner: any top dir outside `KNOWN_TOP_DIRS` (`:214-217`) resolves to `{ policy: 'SYNC', pass: 'VARIANT ASSET DIRS' }`. The pass simply never asks. |

### 2.3 What the VARIANT ASSET DIRS pass actually syncs today (audit correction)

The P1 spec's D3 scope ruling said "no *known* asset dir contradicts an explicit policy claim". Re-verification corrects the premise: the pass walks far more than `procedures` and `.codex`. Fleet scan of `templates/<variant>/` (13 variants, files only):

| Dirs flowing through the pass | Variants | File count |
|-------------------------------|----------|-----------|
| `procedures/` (**overlap** — see below) | all 13 | 5-12 each |
| `decisions/`, `governance/`, `process/` (1 file each) | co-abap, co-consult, co-deck, co-design, co-export, co-game, co-hr, co-price, co-security (9) | 3 each |
| `workflows/`, `regulations/`, `evidence-models/`, `industry-profiles/` | co-safety | 684 |
| `projects/`, `src/`, `tests/` | co-game | 163 |
| `playground/` | co-design | 11 |
| `python/` | co-consult | 7 |
| `presentations/` | co-deck | 2 |

`resolveClaim` classifies all of these except `procedures/**` as `{ policy: 'SYNC', pass: 'VARIANT ASSET DIRS' }` — consistent with the pass's hash-sync semantics. `procedures/**` is the contradiction: `resolveClaim('procedures/…')` returns `{ policy: 'ADD_IF_MISSING', pass: 'PROCEDURES' }` (`upgrade-policy.ts:282`), and the dedicated PROCEDURES SYNC pass (`upgrade-project.ts:2203-2253`) delivers per-entry add-if-missing with "project-owned — preserved" semantics. But the asset-dir pass runs **first** (pass order: `:2077` before `:2203`), is not skipped for `procedures`, and overwrites any changed procedure **file** before the dedicated pass ever runs. A project that edits one file inside an existing `procedures/<name>/` entry loses the edit on the next upgrade (with only a `CONFLICT` warning). The "no known active contradiction" ruling was correct for `.codex` but missed this one: the contradiction is latent (fires only on project modification) and structural.

### 2.4 CODEX.md merge surface (variant dimension ruled out)

- The COMMON-CODEX zone exists in exactly two content files: workspace-root `CODEX.md` (L0, zone at `:86-173`) and `templates/common/CODEX.md` (L1, zone at `:86-173`). Marker names match the COMMON-CLAUDE/GEMINI pattern shape exactly: `<!-- COMMON-CODEX:START -->` … `<!-- COMMON-CODEX:END -->`, single instance per file, zero `WORKSPACE-MANAGED` blocks in either copy.
- **No variant template carries a CODEX.md** (`ls templates/*/CODEX.md` → `templates/common/CODEX.md` only). CODEX.md is an L1-only file, so the upgrade merge surface is L0/L1 → project only. The VARIANT dimension (13 variant AGENTS.md carrying COMMON-AGENTS zones via the `governance-agents` propagation domain) does not apply: no variant CODEX.md exists, and none should be created (WS-07 class: the common copy is the SSOT). This confirms the tasking's earlier verification.
- Merge path once the pattern lands: `resolveTemplate('CODEX.md')` (`upgrade-project.ts:1010-1016`) falls through to the common copy; `mergeWorkspaceManaged` (`:1047-1058`) loads no second common counterpart (`templateFile` is itself the common file, so `commonContent` stays null); `buildMergedTemplateBlocks` finds the template's one COMMON-CODEX block; the project copy carries one unlabeled block → counts match → positional replace → zone refreshed, all prose outside the zone preserved byte-for-byte. This is exactly the delivered COMMON-CLAUDE/GEMINI behavior. Pre-zone project copies (hand-stripped or pre-Codex projects) take the generic `APPENDED` branch; divergent counts take the snapshot-guarded `RECONCILED` branch (T-20260917-010 machinery, pattern-generic).
- Validator cascade: none new. MM-01 (`validate-templates.ts:3798-3799`), VA-05 (`:3828-3830`), and VA-06 already treat COMMON-CODEX as a first-class marker. PM-04 managed-block parity (`:4238`, iterates `MERGE_MANAGED_FILES`) extracts keyed WORKSPACE-MANAGED blocks only; CODEX.md carries none → nothing to compare → no new failures. Variant absence stays compliant.

## 3. Goals

1. Make the CODEX.md MERGE pass deliver the COMMON-CODEX zone: template zone content reaches project copies; prose outside the zone is never touched.
2. Close the structural bypass: the VARIANT ASSET DIRS pass delivers only files whose `resolveClaim` pass is the VARIANT ASSET DIRS pass.
3. End the `procedures/**` double-handling: the dedicated PROCEDURES pass becomes the sole delivery channel for procedure entries.
4. Prove fleet safety: reproducible tests per ticket and dry-run upgrade simulations across representative variants (with and without project CODEX.md customization, with and without the big asset surfaces).
5. Full cascade in one change set: version bumps, SCRIPTS.md rows, L1 snapshot refresh, verification battery.

## 4. Non-goals

1. T-20260925-002 soak promotion (separate program step).
2. New platform surfaces (no new files, markers, or platform dirs).
3. The codex-settings policy split — `.codex/config.toml` / `.codex/hooks.json` JSON_MERGE vs SYNC vs ADD_IF_MISSING adjudication. It shares T-010's ticket title but not its problem class; it is re-filed as a follow-up if surfaced during implementation (the current `.codex/**` ADD_IF_MISSING claim stands).
4. Variant SKILLS.md registry authoring (T-009).
5. Changing any claim classification in `resolveClaim` — the claim table is already correct; only the pass obeys it (see D2).
6. Extending `MANAGED_PATTERNS` beyond COMMON-CODEX (no COMMON-CONTEXT/DYNAMIC_SKILLS changes).

## 5. Requirements (ASD-STE100, ADR-0079)

- R1. Add the `COMMON-CODEX` pattern to `MANAGED_PATTERNS` in `scripts/lib/managed-block-merge.ts`. Use the exact marker pair of L0 `CODEX.md:86`/`:173`. Change no other pattern.
- R2. Change no merge-engine code. `scanPatternBlocks`, `mergeManagedBlocks`, and the snapshot machinery stay untouched.
- R3. Export a `VARIANT_ASSET_DIRS_PASS` pass-id constant from `scripts/lib/upgrade-policy.ts`. Use it in `resolveClaim` and in the asset-dir pass filter. Mirror the `TEMPLATE_TREE_SYNC_PASS` precedent (`upgrade-policy.ts:92`).
- R4. In `scripts/upgrade-project.ts`, make the VARIANT ASSET DIRS pass call `resolveClaim` per file. Deliver only files whose claim pass equals `VARIANT_ASSET_DIRS_PASS`. Keep the existing hash-sync semantics (NEW/UPDATE/CONFLICT/COPIED) for delivered files.
- R5. Keep `.codex` in `VARIANT_ASSET_DIR_SKIP`. The skip set and the claim filter are independent guards.
- R6. Log skipped files at most one line per directory (or a summary count), not per file. Dry-run output must stay readable for co-safety (684-file surface).
- R7. Write each new regression test before its fix. Show the test fail pre-fix and pass post-fix in the task report (house AC5a pattern).
- R8. Bump the `@version` headers and the SCRIPTS.md rows per §8. Refresh the L1 snapshot of `scripts/lib/upgrade-policy.ts` via `bun run propagate:apply`.
- R9. Keep every change minimal. Do not reorder passes, reformat, or touch neighboring code.

## 6. Design decisions

### D1 — T-010: add the COMMON-CODEX pattern; no engine change

The pattern table gains one entry, shaped after its COMMON-CLAUDE/GEMINI siblings:

```ts
{ open: /<!-- COMMON-CODEX:START -->/, close: '<!-- COMMON-CODEX:END -->', label: 'COMMON-CODEX' },
```

- Placement: after the COMMON-GEMINI entry (`managed-block-merge.ts:67`), keeping the platform twins adjacent.
- Why no engine change: the lib is label-generic (`:113-120`, `:256-333`). COMMON-CODEX blocks are key-less, so they take the positional path — identical to COMMON-CLAUDE/GEMINI, byte-identical semantics guaranteed by the T-20260916-012 keyed/unlabeled separation (lib header `:41-44` documents this invariant).
- Claim work: none. `MERGE_MANAGED_FILES` membership and the resulting `resolveClaim` routing landed in #1057 (R: upgrade-policy 1.13.0). T-011's claim-table work is independent — T-010 needs no `resolveClaim` change.
- Alternative rejected: a dedicated CODEX-only merge branch in `mergeWorkspaceManaged`. It would fork the merge semantics for one platform and duplicate machinery that is already pattern-generic.

### D2 — T-011: route the pass through `resolveClaim` with a pass-identity filter

For each file the walk visits, compute the claim and compare passes:

```ts
const claim = resolveClaim(relPath, variant);
if (claim.pass !== VARIANT_ASSET_DIRS_PASS) { skippedClaimed++; continue; }
```

- Why route instead of "document the bypass": the bypass is not legitimate. The pass's generic-asset semantics match exactly what the claim table already says (`policy: 'SYNC'`), so consulting `resolveClaim` costs one call per file and removes the whole inversion class — today's `procedures` contradiction and every future dir-name collision (e.g. a variant growing a top-level `tests/` that a future claim reclassifies). The "justify the bypass" alternative would still require a guard proving no claim collision — the guard and the fix are the same code here.
- Behavior delta, complete: files with `pass === 'VARIANT ASSET DIRS'` (all generic asset dirs in §2.3 except `procedures/**`) keep today's verdicts. `procedures/**` files (pass `PROCEDURES`) drop out of the pass; the dedicated PROCEDURES pass owns them with its documented add-if-missing semantics. `.codex/**` (pass `TEMPLATE TREE SYNC`) is already excluded by the skip set and stays excluded (R5). No other pass-id is reachable from the walked directories at `812c742e` — §2.3 is the complete fleet inventory, and the static guard test in D4 re-proves it at test time.
- Is the `procedures` behavior change intended? Yes — it is the correction. The asset pass's file-level overwrite contradicted the PROCEDURES pass's per-entry project-ownership invariant (`:2207-2211`: "a project that already has `procedures/<name>/` keeps its own"). After the fix, a template-side content update to an already-delivered procedure file no longer reaches projects that own the entry — that is the existing, documented PROCEDURES contract, now actually enforced. Template updates still reach projects that lack the entry.
- Alternative rejected: honoring policies generically inside the pass (execute ADD_IF_MISSING/SYNC/… per claim). It duplicates the delivery machinery that other passes already implement, and no walked file resolves to a policy other than SYNC (other than the now-excluded procedures). Revisit only if a future claim assigns a non-SYNC policy to a generic asset dir.

### D3 — Shared infrastructure between the two tickets

The tickets share the change set, the test conventions, and the verification battery — not code. T-010 touches `lib/managed-block-merge.ts` only. T-011 touches `scripts/upgrade-project.ts` plus one exported constant in `lib/upgrade-policy.ts` (D2). The constant is the single piece of shared claim-table surface: without it the pass filter hard-codes the string `'VARIANT ASSET DIRS'` in a second file, repeating the drift class that `TEMPLATE_TREE_SYNC_PASS` (`:92`) exists to prevent. The order is independent; the brief (§9) sequences T-010 first because its test does not depend on the routing change.

### D4 — Test strategy (reproduce-then-fix, house AC5a pattern)

Fixtures follow `tests/unit/upgrade-tree-sync.test.ts`: `mkdtempSync` + `git init` + `.claude/template-version.txt` seed, spawn the real script with `--dry-run`/apply + `--yes`, assert stdout verdicts and file bytes.

| Ticket | Test home | Reproduce → assert |
|--------|-----------|--------------------|
| T-010 | extend `tests/unit/managed-block-merge.test.ts` (pure lib unit) | Feed project content with one COMMON-CODEX zone plus hand prose before/after the zone, and template content with an updated zone. Pre-fix: `INFO: Template has no managed markers`, prose-only content returned. Post-fix: `MERGED COMMON-CODEX block in:` logged, zone replaced with template content, prose bytes preserved exactly. Add the no-project-zone → `APPENDED` case and the count-mismatch → `RECONCILED` + `snapshots` case for pattern parity with the CLAUDE/GEMINI tests. |
| T-010 | extend `tests/unit/upgrade-tree-sync.test.ts` (integration; new describe beside CODEX OVERWRITE GUARDS at `:365`) | Fixture project (variant co-develop) seeded with a CODEX.md copy whose COMMON-CODEX zone is stale and whose outside-zone prose is customized. Apply run. Assert: `MERGE: CODEX.md` present; `MERGED COMMON-CODEX` verdict present; no `UPDATE`/`COPIED` verdict for `CODEX.md` outside the MERGE section; the customized prose survives byte-identical; the zone matches the L1 template's zone. |
| T-011 | extend `tests/unit/upgrade-policy.test.ts` (pure unit) | `resolveClaim('procedures/x/y.md')` → `{ policy: 'ADD_IF_MISSING', pass: 'PROCEDURES' }`; `resolveClaim('workflows/a.yaml')` → `{ policy: 'SYNC', pass: 'VARIANT ASSET DIRS' }`; exported `VARIANT_ASSET_DIRS_PASS === 'VARIANT ASSET DIRS'`. These already pass pre-fix (the table is correct) — they pin the contract the filter relies on. |
| T-011 | extend `tests/unit/upgrade-tree-sync.test.ts` (integration, co-develop fixture) | Seed `procedures/<entry>/` with one locally modified file and one unchanged file; commit. Apply run. Pre-fix: the modified file gets an asset-dir `UPDATE`/`CONFLICT` verdict and is overwritten. Post-fix: no asset-dir verdict for any `procedures/` path; PROCEDURES pass logs `project-owned — preserved`; file bytes unchanged; a missing entry is still seeded NEW by the dedicated pass. |
| T-011 | extend `tests/unit/upgrade-tree-sync.test.ts` (positive control) | Same fixture shape with a generic asset dir (`decisions/`): project file diverges from template, not locally modified → `UPDATE` verdict still fires post-fix. Proves the filter did not neuter the pass. |
| T-011 | new `tests/unit/variant-asset-claim-collision.test.ts` (fleet static guard) | Walk every `templates/<variant>/<top-level dir outside VARIANT_ASSET_DIR_SKIP>/**` file for all 13 variants. For each rel, assert `resolveClaim(rel, variant).pass` is `'VARIANT ASSET DIRS'` or `'PROCEDURES'`. Assert the PROCEDURES set is exactly the `procedures/**` rels. This is the durable proof that variant assets can never clobber ADD_IF_MISSING/TEMPLATE_ONLY/other claims: any future template dir whose name resolves to a foreign claim fails here before the pass can mis-deliver it. |

### D5 — Dry-run simulation matrix (fleet regression evidence)

Run real `--dry-run --yes` upgrades against fixture projects for at least the two required representative variants; record verdict summaries in the task report.

| Fixture | Variant | Project state | Expected observations |
|---------|---------|--------------|----------------------|
| A | co-develop (minimal: `procedures/` only, no big asset dirs) | CODEX.md with stale zone + customized prose; one modified procedure file | (a) `MERGE: CODEX.md` + `MERGED COMMON-CODEX` verdict, prose preserved (asserted by the T-010 integration test); (b) no CODEX.md overwrite verdict anywhere; (c) zero `procedures/` verdicts from VARIANT ASSET DIRS; CONFLICT/UPDATE lines for procedures gone relative to pre-fix dry-run |
| B | co-safety (largest asset surface: `workflows/`, `regulations/`, `evidence-models/`, `industry-profiles/`, 684 files) | clean checkout of a scaffold-era project; CODEX.md uncustomized | (a) CODEX.md merge verdict present, or byte-identical zone refresh; (b) no wholesale CODEX.md overwrite; (c) asset-dir verdicts for the four big dirs identical pre- vs post-fix (diff the dry-run outputs); `procedures/` verdicts gone |
| C (optional third) | co-game (generic dirs `projects/`, `src/`, `tests/`, 163 files) | clean project | (c) `projects/`/`src/`/`tests/` verdicts identical pre- vs post-fix |

Method: capture the pre-fix dry-run output for each fixture, apply the fix, capture post-fix, and diff. The only permitted differences: CODEX.md merge verdicts (A, B) and vanished `procedures/` asset-dir lines (all fixtures).

### D6 — Fleet blast radius (13 variants)

- T-010: the new pattern only affects files that contain COMMON-CODEX markers. A repo-wide grep shows those are exactly L0 `CODEX.md` and L1 `templates/common/CODEX.md` (§2.4). Every project CODEX.md gains the merge; CLAUDE/GEMINI/AGENTS merges are untouched (per-label scanning). Risk: low.
- T-011: behavior changes only for walked files whose claim belongs to another pass. At `812c742e` that set is exactly `procedures/**` (§2.3), across all 13 variants. The D4 static guard re-proves the set at test time; the D5 dry-run diffs prove per-variant verdict parity. Risk: low, with one intended semantic change (procedure files stop being overwritten).
- Both fixes ride `upgrade-project`, which runs against every variant fleet-wide; the D5 matrix covers the minimal, largest, and generic-dir shapes of that fleet.

## 7. Acceptance criteria

- [ ] AC1. `mergeManagedBlocks` with COMMON-CODEX zones merges the template zone into the project copy, preserves outside-zone prose byte-for-byte, appends when the project lacks the zone, and snapshots on count-mismatch reconcile (D4 unit test; fails pre-fix, passes post-fix).
- [ ] AC2. An apply-mode upgrade of a fixture project with a customized CODEX.md logs `MERGED COMMON-CODEX` for CODEX.md, leaves the customized prose intact, and produces no overwrite verdict for CODEX.md from any pass other than MERGE (D4 integration test).
- [ ] AC3. An apply-mode upgrade never overwrites a modified project file under `procedures/<existing-entry>/`; the PROCEDURES pass reports the entry preserved; a missing entry is still seeded (D4 integration test).
- [ ] AC4. Generic asset dirs keep their verdicts: a divergent, unmodified `decisions/` project file still receives an UPDATE/COPIED verdict and the template content post-fix (D4 positive control).
- [ ] AC5. The fleet static guard passes: for all 13 variants, every walked asset-dir file resolves to the VARIANT ASSET DIRS pass, except `procedures/**` which resolves to PROCEDURES (D4 static test).
- [ ] AC6. `resolveClaim` claims are unchanged: `resolveClaim('CODEX.md')` still returns `{ policy: 'MERGE_MANAGED', pass: 'MERGE' }`; `VARIANT_ASSET_DIRS_PASS` is exported and used by both `resolveClaim` and the pass filter (unit tests).
- [ ] AC7. Dry-run simulation matrix (D5) executed: fixture A (co-develop) and fixture B (co-safety) diffs show only the permitted differences of D5; summaries recorded in the task report.
- [ ] AC8. Full battery green (§10): unit tests, integration tests, typecheck, validate-templates (no new PM-04/MM-01/VA-05/VA-06 findings), audit (spec-check with this registered doc), lifecycle-sync-audit, propagate drift/dry-run (no new drift beyond the pre-existing tolerated overlays), `verify-scripts --verify`.
- [ ] AC9. SCRIPTS.md carries the three version bumps of §8 with one-line change notes; `git diff --stat` shows no files outside §8's list (plus the L1 snapshot, CHANGELOG, memory log, and this design doc).

## 8. Version cascade (verified current at `812c742e`)

| Script | Layer | Current | New | Note |
|--------|-------|---------|-----|------|
| `lib/managed-block-merge.ts` | L0 | 1.1.0 | 1.2.0 | COMMON-CODEX joins MANAGED_PATTERNS (T-20260924-010) |
| `lib/upgrade-policy.ts` | L0+L1 | 1.13.0 | 1.14.0 | export VARIANT_ASSET_DIRS_PASS (T-20260924-011); L1 snapshot refresh via `propagate:apply` |
| `upgrade-project.ts` | L0 | 1.47.0 | 1.48.0 | VARIANT ASSET DIRS pass consults resolveClaim (T-20260924-011) |

Test-file version headers bumped in the same change set where the files carry them (`upgrade-tree-sync.test.ts` 1.2.0 → 1.3.0; `managed-block-merge.test.ts`, `upgrade-policy.test.ts` per their current headers).

## 9. Implementation brief (automation-engineer)

Ordered. Write each D4 regression before its fix; record the pre-fix failure in the task report.

1. **Pin the claim contract** — extend `tests/unit/upgrade-policy.test.ts` (D4 row 3). These pass on current code; they are the contract pins, not reproductions.
2. **T-010 reproduction** — extend `tests/unit/managed-block-merge.test.ts` (D4 row 1). Confirm failure: `INFO: Template has no managed markers` on COMMON-CODEX content.
3. **Fix T-010** — add the COMMON-CODEX pattern to `MANAGED_PATTERNS` (`managed-block-merge.ts:64-72`, after COMMON-GEMINI). Bump `@version` 1.1.0 → 1.2.0 with a header note. Confirm step 2 passes.
4. **T-010 integration** — extend `tests/unit/upgrade-tree-sync.test.ts` with the CODEX merge describe (D4 row 2). Confirm the merge-verdict assertions fail pre-fix only in the `MERGED COMMON-CODEX` expectation (the no-overwrite assertions already pass since #1057), then pass.
5. **T-011 reproduction** — extend `tests/unit/upgrade-tree-sync.test.ts` with the procedures-preservation test (D4 row 4). Confirm failure: modified procedure file overwritten by the asset pass.
6. **Fix T-011** —
   a. `lib/upgrade-policy.ts`: export `VARIANT_ASSET_DIRS_PASS = 'VARIANT ASSET DIRS'`; use it at `:324`. Bump `@version` 1.13.0 → 1.14.0 with a header note.
   b. `upgrade-project.ts` VARIANT ASSET DIRS pass: per file, call `resolveClaim(relPath, variant)`; skip files whose claim pass differs from `VARIANT_ASSET_DIRS_PASS`; log a per-directory summary line per R6. Keep `.codex` in `VARIANT_ASSET_DIR_SKIP` (R5). Bump `@version` 1.47.0 → 1.48.0 with a header note. Confirm step 5 passes.
7. **Positive control + fleet guard** — D4 row 5 (decisions UPDATE still fires) and new `tests/unit/variant-asset-claim-collision.test.ts` (D4 row 6). Both must pass post-fix; the guard documents the fleet invariant.
8. **Dry-run matrix** — D5: capture pre-fix dry-runs (use `git stash` of the working tree or run before step 6 on a second fixture set), apply, capture post-fix, diff. Record fixture A and B summaries (and C if run) in the task report.
9. **L1 snapshot** — `bun run propagate:apply` (delivers the `lib/upgrade-policy.ts` 1.14.0 snapshot; `managed-block-merge.ts` is L0-only, no snapshot).
10. **SCRIPTS.md cascade** — §8 rows with one-line notes (verify current values first).
11. **Verification battery** (§10) and the task report with: pre-fix failures, dry-run diffs, and any surfaced follow-up tickets (do not implement; see §4.3).

## 10. Verification plan

Run in order; all must pass.

| # | Check | Command | Pass state |
|---|-------|---------|------------|
| 1 | Unit tests | `bun run test:unit` | green, incl. extended `managed-block-merge`, `upgrade-policy`, `upgrade-tree-sync` and the new static guard |
| 2 | Integration tests | `bun run test` | green |
| 3 | Typecheck | `bun scripts/typecheck.ts` | green |
| 4 | Template validation | `bun run validate-templates` | green — no new MM-01/VA-05/VA-06/PM-04 findings (CODEX.md parity is a documented no-op, §2.4) |
| 5 | Workspace audit | `bun run audit` | green (spec-check with this registered doc) |
| 6 | Lifecycle sync audit | `bun scripts/lifecycle-sync-audit.ts` | green |
| 7 | Propagation drift | `bun run propagate:drift` | no drift beyond the pre-existing tolerated overlays recorded at `812c742e` |
| 8 | Script registry verify | `bun scripts/verify-scripts.ts --verify` | green |
| 9 | Dry-run matrix | D5 fixture A (co-develop) + B (co-safety) | diffs show only permitted differences |

## 11. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — CLAUDE.md merge path and claims unchanged; the new pattern scans only COMMON-CODEX markers | N/A |
| Antigravity (GEMINI.md) | None — GEMINI.md merge path and claims unchanged; no COMMON-GEMINI code touched | N/A |
| Codex | **Yes** — CODEX.md managed-block merge becomes functional (zone updates deliver through the MERGE pass); `.codex/**` delivery semantics unchanged (skip set + ADD_IF_MISSING claim both hold) | `scripts/lib/managed-block-merge.ts` |
| templates/common | **Yes — propagation required**: L1 snapshot of `scripts/lib/upgrade-policy.ts` refreshed via `propagate:apply`. No content change to `templates/common/CODEX.md` | `templates/common/scripts/lib/upgrade-policy.ts` |

Justification for the "None" rows: this change set adds one marker pattern and one claim-pass filter. Both target the Codex surface and the variant asset machinery; the Claude and Antigravity delivery paths contain no COMMON-CODEX markers and no asset-dir code, so they are untouched by construction (unit tests over CLAUDE/GEMINI patterns must stay green — they are part of the existing battery).

## 12. Exemptions

- **Accessibility (ADR-0065): exempt.** Backend upgrade machinery only. No UI, CLI output format change for end users beyond log lines of the existing pass verbs, and no document surface change.
- **Preview verification (ADR-0070): exempt.** No rendered UI exists or changes. Verification is the executed battery in §10 plus the dry-run output diffs of D5.

## 13. Trade-offs summary

| Decision | Chosen | Main alternative | Why chosen |
|----------|--------|------------------|------------|
| D1 T-010 shape | Add pattern only | Dedicated CODEX merge branch | The engine is pattern-generic; a fork would duplicate CLAUDE/GEMINI machinery |
| D2 T-011 shape | Pass-identity filter via resolveClaim | Document bypass + guard only | The guard and the fix are the same code; routing also removes future collision classes |
| D2 procedures semantics | Dedicated pass ownership (add-if-missing per entry) | Keep asset-pass overwrite | The overwrite contradicts the documented PROCEDURES invariant; the audit missed it, the fix corrects it |
| D3 policy lib change | Export pass-id constant | Hard-code the string twice | TEMPLATE_TREE_SYNC_PASS precedent; prevents the drift class the constant exists to prevent |
| D4 guard depth | Fleet static walk (13 variants) | Per-fixture asserts only | Proves the "never clobber a foreign claim" invariant for future dirs, not just today's |
| D5 evidence | Dry-run diff pre/post per fixture | Fresh assertions only | The diff is the only cheap proof that verdict parity holds fleet-wide |

## 14. Open questions

None blocking. One scope ruling is recorded with its rationale: the codex-settings policy split (`.codex/config.toml`, `.codex/hooks.json`) stays out of T-010 despite sharing the ticket title (§4.3) — it is a claim-classification decision, not merge machinery, and the current ADD_IF_MISSING claim is safe.

## References

- `scripts/lib/managed-block-merge.ts:64-72, :93-105, :236-343` (pattern table; generic engine)
- `scripts/lib/upgrade-policy.ts:92, :198, :214-217, :265, :282, :300, :322-325` (claim SSOT)
- `scripts/upgrade-project.ts:1010-1016, :1047-1078, :1260-1277, :2088-2138, :2203-2253, :2271-2272` (resolveTemplate, merge wrapper, MERGE pass, asset-dir pass, PROCEDURES pass, tree-sync filter)
- `docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md` (provenance; D3/D4; §2.3 mechanics; step 13 follow-up filing)
- `CODEX.md:86-173`, `templates/common/CODEX.md:86-173` (COMMON-CODEX zone)
- `scripts/validate-templates.ts:3792-3830, :4238` (MM-01, VA-05, PM-04 — no cascade)
- `tests/unit/upgrade-tree-sync.test.ts` (fixture/spawn conventions; CODEX OVERWRITE GUARDS block)
- ADR-0074, ADR-0079, ADR-0065, ADR-0070, ADR-0063, ADR-0076, ADR-0077
