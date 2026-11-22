# Design: Variant Core-Script Loss Detection — Marker-Registered Local Patches and Upgrade-Time Eviction Transparency

- **Spec id**: `2026-11-23-variant-core-script-loss-detection`
- **Date**: 2026-11-23
- **Author**: Template Architect (Design Gate, ADR-0074; PM Row 0)
- **Source**: upstream ticket `U-20261122-011` (from co-newbiz, suspected L1); secondary tickets `U-20261107-003`, `U-20261108-001`
- **Related doctrine**: AGENTS.md §"Pluggable Variant Audit Hooks and Integrity Protection"; `templates/common/agents/pm.md` §"Upstream Reporting Duty" (ADR-0097); `docs/designs/2026-10-27-sync-overwrite-policy-design.md` (D2 matrix, D5 adjudicated port); `docs/designs/2026-11-10-delivery-gating-hardening-design.md` (E2 marker-loss guard)

---

## 1. Problem

When `upgrade-project` delivers a rewritten core script (`scripts/audit.ts`, `scripts/dev-sync.ts`) over a project copy that carries variant-authored additions, the additions can disappear without any CONFLICT record, any warning, or any durable trace outside git history. In co-newbiz this happened to the ADR-0070 server-boundary gate: the loss went unnoticed for ~3 months, documentation kept claiming the gate was CI-wired, and 5 direct page-level DB imports outside `app/api` accumulated undetected. The same delivery semantics left two unresolved ERROR-severity LOCAL-PATCH CONFLICT dispositions (`U-20261107-003`, `U-20261108-001`) on co-newbiz's core scripts with no promotion tracker.

The ticket asks upstream for: (a) delivery-time detection of variant-local additions disappearing inside delivered core scripts, or (b) hard documentation that variant additions to core scripts are unsupported. This design delivers both, in the form of a policy ruling plus a marker-based detection contract, and verifies the two pending promotion patches against current main.

## 2. Evidence

### 2.1 Git archaeology (Projects/co-newbiz)

| Event | Commit | Date (KST) | Fact |
|---|---|---|---|
| Gate added | `0a701b29` | 2026-08-27 01:00 | co-newbiz bumped `scripts/audit.ts` 2.14.1 → v2.15.0 and wired `scripts/co-newbiz/lint-server-boundary.ts` into the full audit pass (`execFileSync` + `Pass`/`Fail` arms), commented "co-newbiz-specific, not part of the shared workspace template". ADR-0070 documented it as CI-wired. |
| Gate lost | `4d6793e6` | 2026-08-29 20:48 | Upgrade wave ("fix(upgrade): declare variant/country identity …") replaced `scripts/audit.ts`; the boundary-gate block (6 `boundary`-matching lines) was deleted. No CONFLICT row, no warning — none of the current guard machinery existed yet. |
| Rediscovered | manual review | 2026-11-22 | ~3 months of undetected boundary violations (5 direct page-level DB imports outside `app/api`); loss proven by `git show` archaeology. |

**Why nothing caught it in August 2026**: the LOCAL-PATCH marker protocol postdates the incident — `scripts/helpers/local-patch-scan.ts` v1.0.0 landed 2026-10-02 (T-20261002-015); the marker-loss count guard (E2, DEC-20261111-01) and the CORE_LOCKED_SCRIPTS arm landed 2026-11 (upgrade-project v1.101.x). The gate block predates every guard by ~1–2 months and carries no marker, so it is invisible to all of them (`markerLoss` sees 0 → 0).

### 2.2 Present-day guard matrix (what main already covers)

| Project-copy state | Marker present | Default verdict | Under `--disposition adopt-template` grant |
|---|---|---|---|
| No baseline + differs from deliverable | yes | CONFLICT (ERROR), SKIP (`resolveUnbaselinedDisposition`) | ADOPT (INFO), delivers |
| No baseline + differs from deliverable | no | UNBASELINED_OVERWRITE (WARN), **delivers** | ADOPT (INFO), delivers |
| PROJECT_EVOLVED + template changed | any | CONFLICT (ERROR), SKIP | ADOPT (INFO), delivers |
| PROJECT_EVOLVED + template unchanged | any | EVOLVED_PRESERVE (WARN), SKIP | ADOPT (INFO), delivers |
| Fork of CORE_LOCKED_SCRIPTS (`scripts/dev-sync.ts`, `scripts/audit.ts`) | marked | MARKER_LOSS (ERROR), kept | ADOPT (INFO), delivers |
| Any delivery that would lower the marker count | — | MARKER_LOSS (ERROR), SKIP, exit non-zero (`markerLossBlocks`) | ADOPT (INFO), **delivers** |

`scripts/upgrade-project.ts` `markerLossBlocks()` (E2, DEC-20261111-01 D4): delivery lowering the `LOCAL-PATCH\b` count is skipped at ERROR with a PENDING BACKPORT entry; an explicit adopt grant **overrides** and delivers — recording only the marker *count* (`"2 → 0 (2 lost)"`), never the lost ticket ids and never the evicted content lines.

### 2.3 Residual gaps (the ticket's live substance)

- **G1 — loss is count-only under an explicit grant.** The promote-or-lose lever (adopt grant) delivers over marked content with a count-only trace. Which patch (which U-ticket) was lost is not named in the decision log.
- **G2 — unmarked eviction is invisible on deliver paths.** On the two deliver paths that can evict project-authored lines (UNBASELINED_OVERWRITE WARN; any ADOPT grant), the evicted lines are listed nowhere. This is exactly how `0a701b29`'s block would vanish again for a marker-less re-offender.
- **G3 — no legacy discovery surface.** Committed (non-dirty) unmarked variant blocks are invisible to `resync-audit.ts` (dirty-tree classifier) and to `scanLocalPatches` (marker-gated). Nothing scans committed project-authored deltas against delivery baselines.
- **G4 — the policy is implicit.** The rule "variant behavior must not live inside delivered core scripts" is scattered (AGENTS.md hooks section mandates the hook pattern; pm.md mandates markers on local patches) but nowhere states that unmarked variant content inside core scripts is a violation, nor that markers are temporary registration pending promotion.

## 3. Goals / Non-Goals

**Goals**
1. R1: a written policy ruling closing G4.
2. R2: marker-id-granular loss accounting + eviction-line transparency on every deliver path (G1, G2).
3. R3: a deterministic one-time fleet scan for committed unmarked variant content (G3).
4. R4: verified verdicts for the two pending promotion patches, with a retire-on-adoption path that needs no new upstream work.

**Non-Goals**
- No change to default delivery verdicts or severities; no new decision verdict kinds.
- No ownership heuristics of any kind (see §5.3).
- No redesign of the marker protocol, the D2 matrix, or the pending-backport machinery — they are prior art to extend.
- No co-newbiz code changes in this batch (its workaround — `scripts/co-newbiz/audit-variant.ts` via `variant.json script_manifest.local` — is already the destination state of R1).

## 4. R1 — Policy ruling: variant additions inside delivered core scripts are UNSUPPORTED

**Ruling.** Variant-authored additions to template-managed (delivered) files — core scripts in particular — are unsupported as a standing state. Only two forms are legal:

1. **Marker-registered temporary patch** (transitional): the content carries `LOCAL-PATCH(upstream-request: <U-id|pending>)` per `templates/common/agents/pm.md` §"Upstream Reporting Duty" (ADR-0097), with a filed upstream ticket; expected to retire via upstream promotion or template adoption. A marker without a ticket (other than `pending`) is itself a violation of the existing reporting duty.
2. **Variant-owned script** (destination): the behavior lives in a `variant.json` `script_manifest.local` script wired through the documented hook pattern — the `scripts/<variant>/audit-variant.ts` precedent, already mandated by AGENTS.md §"Pluggable Variant Audit Hooks and Integrity Protection" (which also forbids direct modification of `dev-sync.ts`/`audit.ts` in L2 projects).

Unmarked variant content inside a delivered core script is a policy violation regardless of when it was written. The `0a701b29` block violated no rule *at the time* (the machinery did not exist); retroactively it is the canonical violation shape, and its correct remediation — re-implement the gate in `scripts/co-newbiz/audit-variant.ts` — is what co-newbiz already landed on 2026-11-22.

**Doctrine home** (decided): a 2–3 sentence addendum to **AGENTS.md §"Pluggable Variant Audit Hooks and Integrity Protection"** — that section is already the L0 SSOT for exactly this subject (core-script standardization + pluggable hooks), propagates to variants through the existing L1 delivery contract, and needs only the marker-registration clause and the "unmarked = violation" sentence added. Rejected homes: `scripts/README.md` (auto-generated from `SCRIPTS.md` — a catalog, not doctrine); a new standalone ADR (duplicates the hooks section rather than completing it); `templates/common/agents/pm.md` (already correct — it owns the marker mechanics, not the core-script placement rule).

## 5. R2 — Delivery-time detection: marker-based wins

### 5.1 The marker contract (specified)

- **Registration form** (canonical, id-bearing): `LOCAL-PATCH(upstream-request: <U-id|pending>)` on the patch's anchor line or an immediately adjacent comment line. Id extraction grammar is the existing `LOCAL_PATCH_RE` in `scripts/helpers/local-patch-scan.ts` v1.1.0.
- **Loss-guard form** (superset): any `LOCAL-PATCH\b` occurrence counts, per the existing `LOCAL_PATCH_MARKER_RE` / `countLocalPatchMarkers` in `scripts/lib/upgrade-policy.ts` (E2: every form is positive proof of intentional local content).
- **Fleet discovery**: `scanLocalPatches()` (same helper) walks a project tree and reports every id-bearing marker; already imported by `upgrade-project.ts`.

No new marker syntax, no registry, no config. The contract is exactly what co-newbiz's current copies already practice (verified: `Projects/co-newbiz/scripts/dev-sync.ts` lines 1679–1682 and `scripts/audit.ts` lines 3138, 4166–4168 carry well-formed `LOCAL-PATCH(upstream-request: U-20261107-003 / U-20261108-001 / U-20261122-011)` sites).

### 5.2 The delta on top of existing machinery

**(a) Lost-id naming (closes G1).** New pure helper `lostLocalPatchIds(projectText, afterText): string[]` — extract ids from the project copy via `LOCAL_PATCH_RE`, subtract ids present in the deliverable, return the lost ids in deterministic order. Wired into both decision sites in `markerLossBlocks()`:
- MARKER_LOSS row detail appends `lost LOCAL-PATCH ids: U-…, pending` and the promote-or-lose guidance it already prints (adopt grant once the template carries the hunk, or the D5 adjudicated-port procedure, `docs/designs/2026-10-27-sync-overwrite-policy-design.md` §6).
- The adopt-grant override ADOPT row appends the same lost-id list ("superseded by the template copy; lost ids: …"), so a deliberate loss is attributable forever in the decision log.

**(b) Eviction transparency (closes G2).** New pure helper `evictedDelta(projectText, baselineText, afterText): { lines: string[]; truncated: number }` — lines present in the project copy, absent from the recorded delivery baseline (no-op when project bytes equal the baseline: no project-authored content exists, the same UNTOUCHED short-circuit `markerLossBlocks` already applies), and absent from the deliverable. On **every path that delivers over differing project content** — UNBASELINED_OVERWRITE, adopt-override of MARKER_LOSS, ADOPT over PROJECT_EVOLVED (EVOLVED_PRESERVE/CONFLICT), adopt of an unproven fork — the decision detail carries a capped listing (first 10 lines + remaining count) and the exit summary gains an `EVICTED LINES` block grouped by path. This is a *loss-transparency* guarantee, not an ownership claim: the listing says "these project-authored lines disappear", and the human adjudicates.

**(c) Verdict/severity unchanged.** The matrix rows of §2.2 stay byte-identical in outcome. Detection adds attribution, never new blocks — the blocking layer (MARKER_LOSS at ERROR, CONFLICT, EVOLVED_PRESERVE) is already correct.

### 5.3 Alternative rejected: hunk-diff ownership heuristics

Flagging hunks that "look variant-owned" (comment prose, variant-name mentions, diff shape) has no sound oracle: template churn and variant blocks are structurally identical in a diff, so the heuristic is un-adjudicable noise with false negatives exactly on the disciplined cases (a variant block written in house style). Once the delivery baseline is used as the oracle — which the machinery already records per path — the project-authored delta is *exactly computable* (§5.2b), which makes ownership guessing unnecessary even for reporting. Marker-based detection additionally yields ticket-id identity that heuristics can never produce. Rejected; the baseline-delta computation supersedes it.

### 5.4 Why the co-newbiz incident cannot recur post-landing

Same replay under this design: block added unmarked → next wave's evolved/unbaselined classification blocks delivery by default (2026-11 machinery, already landed); if the operator grants adoption, the EVICTED LINES block names every line of the gate wiring at delivery time; if the block is marker-registered instead, MARKER_LOSS names the ticket id. The only remaining silent path is a marker-less block that the operator adopts *after reading the eviction listing and choosing to discard it* — which is adjudication, not loss.

## 6. R3 — Legacy coverage: one-time fleet scan

`upgrade-project --audit-core-deltas [--project <path>]...` (read-only, dry-run-safe): for each project, diff `CORE_LOCKED_SCRIPTS` copies (`scripts/dev-sync.ts`, `scripts/audit.ts` — the existing constant) against their recorded delivery baselines and report per path: PROJECT-AUTHORED DELTA (line count + capped listing) and any marker ids found inside the delta lines. A clean project prints `no project-authored delta`. This finds committed unmarked variant content deterministically — content equal to the last delivered baseline cannot be variant-authored, so there are no false positives by construction. Covers the legacy class R1/R2 cannot see retroactively; run once across `Projects/co-*` at landing, then on demand (it is also the natural post-incident audit surface). Content already lost to a pre-machinery wave (the `0a701b29` case) is unrecoverable by any scanner — for those, git archaeology remains the instrument, which is why R1's one-time migration duty per project ("compare your core scripts against your baseline once") is recorded in the AGENTS.md addendum.

## 7. R4 — Pending promotion verdicts (verification results)

Both tickets are `status: done` upstream with landing evidence verified on workspace main on 2026-11-23. Neither needs promotion work in this batch.

### 7.1 U-20261107-003 (dev-sync scoped staging must commit the regenerated VERSION_MANIFEST) — **ALREADY-UPSTREAM**

- Upstream fix: dev-sync **v1.43.0** (PR 1911) — S0 snapshot gains a per-path content map (`s0Content`, `scripts/dev-sync.ts:984-990`) and step 6.5 re-classifies the S0∩S1 overlap by byte difference: an S0-dirty file whose bytes changed by S1 (step 4.7's regenerated `docs/VERSION_MANIFEST.md`) is pipeline output and joins the commit; byte-identical leftovers stay residual (`scripts/dev-sync.ts:2764-2780`; header lines 214–225 name the U-20261107-003 misclassification).
- Superset property: the upstream classifier is generic (any pipeline-changed bytes), which subsumes co-newbiz's local `ALWAYS_REGENERATED = ["docs/VERSION_MANIFEST.md"]` allowlist exactly.
- Main has since hardened the same area: v1.51.0 `--honor-staged` (T-20261117-015) and step 6.55 (spec-registry dangling-reference gate).
- **Ruling: retire-on-adoption.** The local patch (dev-sync v1.37.1 marker site at line 1679) is functionally superseded; take the template copy at the next adoption wave (template ≥ the v1.43.0-bearing release), which also clears the ERROR CONFLICT disposition.

### 7.2 U-20261108-001 (delivered scripts fail strict biome/typecheck gates) — **ALREADY-UPSTREAM**

- Upstream fix: PR 1942 (merge `ccb897df`), verified as L0 defects (delivered scripts are byte-identical mirrors of a weaker L0 baseline). All four sub-symptoms resolved at source:
  - `biome.json` adopted at L0 root (Biome 2.6.6 profile: double quotes, lineWidth 120, `noAssignInExpressions`/`noImplicitAnyLet` as errors) — present and verified.
  - audit.ts nul-lint self-match invariant eliminated **by construction**: `NUL_REDIRECT_DISPLAY = [">", "nul"].join(" ")` (`scripts/audit.ts:3227`, v2.65.0) — the literal forbidden string no longer exists in source, so the line-scoped ignore marker (`Projects/co-newbiz/scripts/audit.ts:3138` site) is unnecessary.
  - `extractScriptDependencies` rewritten quote-agnostic/shape-complete (generate-version-manifest.ts **v1.12.0**, `scripts/generate-version-manifest.ts:390`).
  - TS2307 sub-symptom already fixed upstream pre-report (ticket text).
- **Ruling: retire-on-adoption.** Both local marker sites (audit.ts lines 3138 and 4166–4168) are superseded; the co-newbiz biome.json override note dies with the L0-native `biome.json`.

### 7.3 Retirement procedure (both tickets)

At co-newbiz's next upgrade adoption: verify the delivered copies carry the upstream fixes (version headers ≥ v1.43.0 / v2.65.0 equivalents), re-run `--disposition adopt-template=scripts/dev-sync.ts,scripts/audit.ts`, confirm `scanLocalPatches` reports zero `U-20261107-003`/`U-20261108-001` markers, and confirm the ADR-0070-equivalent gate lives solely in `scripts/co-newbiz/audit-variant.ts` (already true since 2026-11-22). The retired markers leave the decision-log audit trail; the meta-marker `LOCAL-PATCH(upstream-request: U-20261122-011)` sites retire with them. This is ticket bookkeeping inside the next wave — no promotion batch, no scope expansion.

## 8. Implementation plan (proposal — pending PM dispatch; this ticket lands design only)

| File | Action | Description |
|---|---|---|
| `scripts/lib/upgrade-policy.ts` | modify | Add pure, unit-pinned helpers `lostLocalPatchIds()` and `evictedDelta()` (§5.2); version bump + header entry. |
| `scripts/upgrade-project.ts` | modify | Thread lost ids into MARKER_LOSS and adopt-override ADOPT details; add eviction listing + exit-summary `EVICTED LINES` block on deliver paths; new `--audit-core-deltas` flag (§5.2, §6). |
| `AGENTS.md` | modify | §"Pluggable Variant Audit Hooks and Integrity Protection" addendum: marker-registration requirement, unmarked-addition violation clause, `script_manifest.local` destination (§4). |
| `tests/unit/upgrade-policy-eviction.test.ts` | create | Pin both helpers: id extraction incl. `pending`, eviction against baseline vs deliverable, truncation cap, UNTOUCHED/vintage short-circuits. |
| `docs/designs/2026-11-23-variant-core-script-loss-detection-design.md` | create | This document. |

## 9. Acceptance criteria

- **AC-1** (regression pin, marked loss): project copy of `scripts/audit.ts` carries `LOCAL-PATCH(upstream-request: U-20261122-011)`; deliverable lacks it; default run → MARKER_LOSS (ERROR) row **naming the id** `U-20261122-011`, write skipped, exit non-zero.
- **AC-2** (grant path names the loss): AC-1 fixture + `--disposition adopt-template=scripts/audit.ts` → ADOPT (INFO) row whose detail lists lost ids and carries the evicted-lines listing; exit summary shows the `EVICTED LINES` block.
- **AC-3** (legacy unmarked copy, evolved): project copy has 12 unmarked lines vs its recorded baseline, template changed → default run CONFLICT (ERROR) SKIP unchanged (outcome byte-identical to pre-design); with grant → delivered with the 12-line eviction listing (capped at 10 + "2 more").
- **AC-4** (legacy unmarked copy, no baseline): unbaselined differing unmarked copy → UNBASELINED_OVERWRITE (WARN) delivers **with** the eviction listing (no silent loss).
- **AC-5** (noise floor): byte-identical and vintage-proven copies produce zero eviction listings and no new decision rows; a full fleet dry-run over `Projects/co-*` at landing reports zero EVICTED rows on unchanged projects.
- **AC-6** (legacy scan): `--audit-core-deltas` over the six `Projects/co-*` reports exactly the evolved deltas (co-newbiz: zero after retirement; any seeded divergence: listed with line counts and marker ids); a clean project prints `no project-authored delta`.
- **AC-7** (docs): the AGENTS.md hooks addendum is present, propagated through the L1 contract, and carries the marker clause + violation sentence; `sync-overwrite-policy` §6 reference survives in the MARKER_LOSS guidance text.
- **AC-8** (co-newbiz retirement, next wave): after adoption, `scanLocalPatches(Projects/co-newbiz)` finds zero `U-20261107-003`/`U-20261108-001` markers; boundary gate verified running from `scripts/co-newbiz/audit-variant.ts`.

## 10. Landing requirements

1. Register the spec before `/sync` (ADR-0074): `bun scripts/spec-register.ts --file docs/designs/2026-11-23-variant-core-script-loss-detection-design.md --source manual --status implemented` — use `--status approved` if the doc lands ahead of the implementation PR, then `--update … --status implemented` at merge.
2. Implementation PRs run the unit battery (`bun test tests/unit/upgrade-policy-eviction.test.ts`) plus the fleet dry-run of AC-5/AC-6 as PR evidence.
3. AGENTS.md addendum lands in the same batch as the script changes (the ruling and its enforcement ship together); language policy per CONSTITUTION §4.1 (English only).
4. No `@l2-propagate: false` markers introduced on the modified scripts (delivery-derivation must keep shipping them — the local-patch-scan v1.0.1 lesson, U-20261012-001).

## 11. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None beyond the shared script/doc changes | N/A |
| Antigravity (GEMINI.md) | None — no platform-surface behavior changes; AGENTS.md is shared across surfaces and its addendum propagates by existing sync | N/A (justification: `--audit-core-deltas` and decision-log changes live in platform-neutral `scripts/`) |
| templates/common | Indirect: AGENTS.md addendum flows to scaffolded variants via the existing L1 delivery contract; no `templates/common/` file is edited in this batch | N/A (AGENTS.md edit is L0-root; propagation is the contract's existing behavior) |

## 12. Out of scope / Open questions

**Out of scope**: marker syntax changes; new verdict kinds or severity changes; retrofitting delivery baselines onto pre-manifest projects; co-newbiz code edits; recovering content already lost to pre-machinery waves (git archaeology only); extending `CORE_LOCKED_SCRIPTS` beyond the two core scripts (revisit on evidence).

**Open questions (owner decisions, defaults apply)**:
- **O-1** *(PM)*: eviction listing cap — 10 lines proposed; retune if fleet dry-run noise exceeds one screen per project.
- **O-2** *(PM)*: whether `--audit-core-deltas` should later move under `fleet-script-parity.ts` if a second consumer appears (kept inside `upgrade-project` now: baselines and the decision log already live there).
- **O-3** *(user, co-newbiz)*: timing of the retirement wave (§7.3) — any adoption ≥ the v1.43.0/v2.65.0-bearing release suffices; no deadline is imposed.

## 13. References

- [Source: tickets/governance/U-20261122-011.yaml] — incident report, workaround, promotion-pending inventory
- [Source: tickets/governance/U-20261107-003.yaml] — upstream resolution: dev-sync v1.43.0, PR 1911
- [Source: tickets/governance/U-20261108-001.yaml] — upstream resolution: PR 1942 (ccb897df), L0 disposition
- [Source: Projects/co-newbiz git log 0a701b29 / 4d6793e6] — incident archaeology (§2.1)
- [Source: scripts/lib/upgrade-policy.ts — resolveUnbaselinedDisposition, markerLoss, markerLossDetail] — D2 matrix + E2 guard prior art
- [Source: scripts/upgrade-project.ts — markerLossBlocks, CORE_LOCKED_SCRIPTS, PENDING BACKPORT block] — delivery-time guard prior art
- [Source: scripts/helpers/local-patch-scan.ts v1.1.0 — LOCAL_PATCH_RE, scanLocalPatches] — marker contract prior art
- [Source: templates/common/agents/pm.md §"Upstream Reporting Duty" (ADR-0097)] — marker duty SSOT
- [Source: AGENTS.md §"Pluggable Variant Audit Hooks and Integrity Protection"] — hook-pattern prior art, doctrine home
- [Source: docs/designs/2026-10-27-sync-overwrite-policy-design.md §6 (D5)] — adjudicated-port procedure (the promote path named in guidance)
- [Source: docs/designs/2026-11-10-delivery-gating-hardening-design.md] — E2/E3 guard design lineage
