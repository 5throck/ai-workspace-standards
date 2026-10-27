# Design: Sync/Upgrade Overwrite Policy — Merge-or-Preserve Semantics and Delivery-Decision Observability

- **Spec ID**: `2026-10-27-sync-overwrite-policy`
- **Date**: 2026-10-27
- **Author**: Template Architect (Design Gate Row 0)
- **Ticket**: T-20261027-004 (manual) — provenance: U-20261026-005 (co-design restoration clobbered by upgrade/sync commits; reconciled via root PR #1640)
- **Status**: implemented — landed 2026-10-27 per DEC-20261027-01 (user approval 2026-10-27; the Korean directive "proceed with the remaining work" is quoted verbatim, with its source-language exception, in DEC-20261027-01; protective defaults upheld — ERROR→SKIP, adopt-template opt-in, green-by-construction rollout). Engine: upgrade-project.ts 1.76.0 + lib/upgrade-policy.ts 1.25.0 + dev-sync 1.32.0 (D3.1); §9 rows 1–4 landed as PR-1 (engine + gate + tests + L0→L1 publish in one PR); §9 row 5 follow-up tickets (D6a lint, D6c forensic baseline) remain open. §11 acceptance evidence lives in the landing PR description and tests/unit/upgrade-decision-log.test.ts.
- **Original status**: draft — design-only, for user review. No engine code was changed by the design ticket; §9 was the proposal pending PM dispatch.

## 0. Conclusion

The U-20261026-005 incident class is not caused by a missing preservation flag — the fleet audit (docs/reports/2026-10-27-u005-class-fleet-drift-audit.md) shows 0 current overwrite conflicts and 0 unrecovered losses, because the existing deny-list classification (ADR-0073) already routes project-owned content to PRESERVE/MERGE/ADD_IF_MISSING. The root cause is narrower: **committed project-side divergence is invisible to the upgrade engine's conflict detection**. `isLocallyModified()` gates on uncommitted git state, so a committed project restoration (co-design PRs #54/#56) is overwritten cleanly by a version-gated SYNC pass — no CONFLICT verdict, no ERROR, gates green, content reverted. The genus of the failure is therefore *observability*, not classification.

This design fixes the class with three moves: (1) a **delivered-baseline provenance record** in the delivery manifest, so "the project evolved this file since the last delivery" becomes mechanically detectable instead of git-state-dependent; (2) a **disposition matrix** that escalates project-evolved + template-changed deliveries from silent overwrite to an explicit recorded disposition; and (3) a **unified delivery-decision log** (manifest v2) in which every non-delivery decision carries a severity, and ERROR-severity decisions block silent landing. It rejects a project-owned claim manifest (YAGNI + deny-list philosophy; §4 D4) and codifies the PR #1640 adjudicated port as the sanctioned reconciliation procedure (§6).

## 1. Context

### 1.1 Incident (U-20261026-005)

co-design's registered design expansion was clobbered by upgrade/sync commits (commits `faf0798` / `ded4749`; `tokens.json`, `docs/screen-patterns.md`, `docs/design-foundation.md`, `playground/*`), restored project-side (PRs #54/#56), re-clobbered by the next upgrade wave, and finally reconciled by porting the adjudicated content INTO the template side (root PR #1640), making the template canonical. The clobber was undetected because gates were `test.skip`-green.

### 1.2 Fleet state (2026-10-27 audit)

The U-005-class audit over the other 15 projects found: 0 current CONFLICT entries, 0 unrecovered historical losses, and three systemic near-misses — mirror-only LOCAL-PATCH edits erased ungated, skeleton-insert silent skips on heading collision (SKELETON DRIFT `claude-s2`, 5 projects), and drift forensics lacking commit-SHA baselines (template evolution reads as project loss). All current customization lives in paths the current policy already preserves (DRIFT-preserve, MERGE, PRESERVE, PROJECT_STATE).

### 1.3 Current engine semantics (verified against code)

`scripts/lib/upgrade-policy.ts` (v1.23.0) classifies every path deny-list-style; fallback claim is `SYNC` on the TEMPLATE TREE SYNC pass — coverage is deliver-by-default, so a template file added without a governance decision still reaches projects. `scripts/upgrade-project.ts` delivery passes:

| Policy class | Pass | Behavior on project-side modification today |
|---|---|---|
| PRESERVE / PROJECT_STATE / TEMPLATE_ONLY / REGENERATED | (none / regenerate) | Untouched — never a clobber vector |
| ADD_IF_MISSING / WORKSPACE | GOVERNANCE, PROCEDURES, REGION PROFILES, TREE SYNC | Silent seed-skip when present |
| MERGE_MANAGED | MERGE / DOCS_MERGE / JSON_MERGE | Managed-zone union; in-zone replaces snapshotted (`.pre-skeleton.bak`); out-of-zone project content preserved |
| OVERWRITE | DOCS_OVERWRITE | Plain overwrite (only `docs/phase-definitions.md`, `docs/security.md`) |
| SYNC (TREE SYNC, VARIANT ASSET DIRS, ENV_SAMPLE) | respective passes | Version-gate or hash-gate decides; `isLocallyModified()` → `⚠️ CONFLICT` warning, **overwrite proceeds anyway** (recovery = pre-upgrade stash / `--rollback`) |
| SYNC_IF_NEWER (agents/, skills/, scripts/) | respective passes | Version-gt delivers (frontmatter-preserving for agents/); equal-version content drift = DRIFT (restored-to-canonical for agents/, preserved for skills/ per ADR-0085 D3) |

The critical gap: **conflict detection keys on git-dirty state only.** A committed, divergent project file is treated as canonical-template content and overwritten by any version bump with zero verdicts beyond `UPDATE`. The pre-upgrade stash cannot help — the divergence was committed, so the stash is clean. This is exactly the U-005 shape, and it is why the fleet can be audit-clean today and still re-clobber co-design tomorrow if the project side ever re-evolves a delivered file.

Related in-flight work: T-20261027-005 (another agent) will normalize legacy tier frontmatter via delivery passes — the first targeted instance of template-authoritative frontmatter propagation, and itself a case where the engine's only verdicts today are silent (`STUB (resolved at scaffold)` skips, DRIFT restores). The decision log (§5) is designed to make such deliveries observable.

## 2. Problem statement

The upgrade engine cannot distinguish "project file is untouched since the template delivered it" from "project file was deliberately evolved after delivery" for committed content. Consequently:

1. A template version bump overwrites committed project evolution with no CONFLICT verdict and no recovery artifact (U-005 genus).
2. Non-delivery decisions (seed skips, skeleton-collision skips, DRIFT preserves, stub skips) are printed to stdout and forgotten — no persistent, severity-classified record exists, so "gates green" can coexist with "content silently skipped or reverted".
3. Drift forensics have no baseline: the audit's PASS 2 had to reconstruct "what the delivery put there" from git history, producing systematic false positives (current-template baseline over-reports project loss).

## 3. Decision record

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Delivered-baseline provenance.** The delivery manifest (`.claude/last-upgrade-delivery.json`) records, per delivered file, the SHA-256 of the content written and the template revision (version + template git SHA) it came from. The next upgrade run compares project content against this baseline to classify each candidate as `UNTOUCHED` (== baseline hash), `PROJECT_EVOLVED` (≠ baseline, ≠ current template), or `IN_SYNC` (== current template). Provenance replaces `isLocallyModified()` as the primary conflict signal; git-dirty state remains a secondary signal (it also covers non-delivered modifications). | Makes committed divergence mechanically detectable; directly answers audit finding 2 (commit-SHA baselines); enables the disposition matrix without new classification |
| D2 | **Disposition matrix per policy class** (§4). Project-evolved files under a content-delivering class (SYNC, OVERWRITE, SYNC_IF_NEWER, MERGE in-zone) escalate to an explicit recorded disposition when the template also changed; the default disposition in non-interactive mode is `SKIP` for ERROR-severity classes and `ADOPT-TEMPLATE` for WARN-severity classes, each written to the decision log. | Converts the silent overwrite into a visible, resumable decision |
| D3 | **Unified delivery-decision log (manifest v2).** Every pass writes verdicts into one collector persisted in the manifest: `{path, policy, pass, verdict, severity, baseline?, detail}` with verdicts NEW / UPDATE / ADOPT / SKIP / MERGE / CONTEXT_PRESERVE / DRIFT_PRESERVE / DRIFT_RESTORED / STUB_SKIP / SEED_SKIP / SKELETON_COLLISION / CONFLICT, and severities INFO / WARN / ERROR. Manifest v2 keeps the top-level `files` array (all existing consumers — dev-sync step 3.9 `isDeliveredDiff()`, PR-body compose — accept both shapes). | One observability SSOT; the U-005 genus (gates green while content reverted/skipped) cannot recur because ERROR-severity deliveries cannot land silently (D3.1) |
| D3.1 | **Landing gate on ERROR.** A delivery whose decision log contains ERROR-severity entries (unresolved CONFLICT dispositions) is written to the manifest, and the run exits non-zero with the dispositions listed; dev-sync step 3.9 refuses auto-E5 attribution for any diff containing a delivery with unresolved ERROR entries. | Makes "delivered but wrong" impossible to hide behind a green run |
| D4 | **No project-owned claim manifest.** Rejected (§5). The sanctioned path for "project wants to keep locally-evolved state" is a governance decision that changes the template-side classification (or an ADD_IF_MISSING/PRESERVE claim at L0/L1), plus the adjudicated port procedure (D5) — not a per-project policy fork. | Deny-list philosophy (ADR-0073 D1); manifests rot; a project-side manifest would be invisible to `check-upgrade-coverage.ts` and would have *masked* co-design rather than surfaced it |
| D5 | **Adjudicated port procedure** (§6): the PR #1640 pattern codified with acceptance criteria — bidirectional superset diff, dry-run no-op proof, protected-file hash table, post-wave verification ticket. | The porting loop worked; it needs to be a procedure, not an improvisation |
| D6 | **Mirror and marker hygiene (recommendations, not engine changes in this ticket):** (a) a lint candidate requiring LOCAL-PATCH markers to exist in the `skills/` SSOT copy (closes the mirror-only erasure class); (b) skeleton-collision skips become persistent `SKELETON_COLLISION` WARN entries in the decision log (engine, small); (c) drift forensics tooling must diff against the template at the delivery's recorded template SHA, not HEAD-of-template. | Audit systemic findings 2–4; each is small and independently ticketable |

## 4. D2 — Disposition matrix (current vs proposed)

Key: `UNTOUCHED` = project content == delivered baseline hash; `PROJECT_EVOLVED` = differs from baseline and from current template; `IN_SYNC` = == current template. "Git-clean" is the existing `isLocallyModified()` signal; under provenance it demotes to a secondary check (a git-clean file can still be PROJECT_EVOLVED — the U-005 case).

| Policy class | Project state | Template state | Current behavior | Proposed behavior | Disposition (severity) |
|---|---|---|---|---|---|
| PRESERVE / PROJECT_STATE / TEMPLATE_ONLY / REGENERATED | any | any | untouched, silent | unchanged; log `SKIP` (INFO) once per run in the decision log | SKIP (INFO) |
| ADD_IF_MISSING / WORKSPACE (GOVERNANCE, PROCEDURES, REGION PROFILES, docs/project.md, workspace seeds) | present | changed | silent seed-skip | unchanged semantics; log `SEED_SKIP` (INFO) | SEED_SKIP (INFO) |
| MERGE_MANAGED — MERGE / DOCS_MERGE / JSON_MERGE | out-of-zone edits | changed | preserved by union | unchanged; log `MERGE` (INFO) naming preserved regions | MERGE (INFO) |
| MERGE_MANAGED — in-zone | in-zone edits | changed | replaced, `.pre-skeleton.bak` snapshot | unchanged; log `MERGE` (WARN) with snapshot pointer | MERGE (WARN) |
| MERGE_MANAGED — skeleton insert | heading collision | insert pending | silent skip (SKELETON DRIFT) | unchanged; log `SKELETON_COLLISION` (WARN) — persistent record replaces stdout-only drift note | SKELETON_COLLISION (WARN) |
| SYNC / OVERWRITE (TREE SYNC, VARIANT ASSET DIRS, DOCS_OVERWRITE, ENV_SAMPLE) | UNTOUCHED or IN_SYNC | changed | overwrite | unchanged — `UPDATE`/`ADOPT` (INFO) | ADOPT (INFO) |
| SYNC / OVERWRITE | PROJECT_EVOLVED | unchanged | DRIFT-preserve or overwrite per sub-pass (inconsistent) | `PROJECT_EVOLVED` logged (WARN); deliver only on explicit version gate as today | EVOLVED (WARN) |
| SYNC / OVERWRITE | PROJECT_EVOLVED | changed | ⚠️ CONFLICT warning, **overwrite proceeds** (the U-005 vector) | **CONFLICT disposition (ERROR)**: default `SKIP` + decision entry; delivery proceeds only with explicit `--disposition adopt-template[=glob]` (whole-run) or interactive resolution. Pre-upgrade stash and `--rollback` guarantees unchanged. | CONFLICT (ERROR) |
| SYNC_IF_NEWER — agents/ | PROJECT_EVOLVED, same version | unchanged | `DRIFT (restored to canonical)` — overwrite | reclassified **CONFLICT disposition (ERROR)** — the v1.35.0 equal-version reconciliation already clobbered pm.md once (ADR-0085 D3 history); restoring "canonical" over evolved content is not self-evidently right | CONFLICT (ERROR) |
| SYNC_IF_NEWER — skills/, scripts/ | PROJECT_EVOLVED, same version | unchanged | `DRIFT (preserved)` | unchanged semantics; log `DRIFT_PRESERVE` (WARN) | DRIFT_PRESERVE (WARN) |
| SYNC_IF_NEWER — agents/ | UNTOUCHED | version-gt | deliver preserving `lifecycle:` block; re-stamp `last_updated` | unchanged; `ADOPT` (INFO) | ADOPT (INFO) |
| agents/ — extends-stub templates | resolved body | any | `STUB (resolved at scaffold)` silent skip | unchanged; log `STUB_SKIP` (INFO) — makes the T-20261027-005-class delivery surface visible | STUB_SKIP (INFO) |
| Platform mirrors (.claude/.gemini/.agents/.codex/.hermes skills) | any | regenerated by sync-skills.ts | regenerated away | unchanged (mirrors are derived state by design); the LOCAL-PATCH SSOT lint (D6a) is the guard, tracked as a separate ticket | (no per-file decision; run-level entry) |

Escalation semantics: ERROR-severity dispositions do not abort the whole run — earlier passes' deliveries stand — but the run exits non-zero, the manifest lists every unresolved disposition, and a follow-up run with `--disposition` flags (or manual merge) resolves them. `SKIP` is the safe default because it preserves the project side, requires no recovery, and is loud.

## 5. D4 — Why no project-owned claim manifest (position)

A first-class "project declares paths project-owned" manifest was considered and rejected:

1. **It recreates the bug ADR-0073 D1 removed.** The classification SSOT moved from hand-maintained allowlists to a deny-list resolver precisely because enumerated manifests go stale. A per-project claims file is a third copy of policy truth (after the L0 resolver and L1 mirrors) with the worst maintenance position — project-side, unaudited, invisible to `check-upgrade-coverage.ts --strict`.
2. **It would have masked co-design, not fixed it.** Had co-design claimed `docs/design-foundation.md` as project-owned, the template would never have re-delivered the v1.3 content, and the divergence would have persisted silently — the opposite of what the incident needed. What actually resolved it was adjudication: deciding which side is canonical, then making the template side carry it (PR #1640).
3. **The legitimate need already has sanctioned channels.** General "project owns this path" is a template-side classification decision (PRESERVE_FILES / ADD_IF_MISSING — e.g. `docs/project.md`, region-profiles), decided once and enforced fleet-wide with coverage-gate visibility. Incident-level local patches are tracked by LOCAL-PATCH markers with the SSOT-anchor lint (D6a) closing the mirror-only hole.
4. **YAGNI.** The fleet audit shows 0 current overwrite conflicts: no project currently sits in a wholesale-overwrite path. Adding a per-project policy fork now buys capacity for a state that does not exist, at the cost of a new drift surface.

Position: **reject the claim manifest; keep claim authority template-side.** If a project persistently evolves a delivered file, the D2 matrix forces the conversation (CONFLICT ERROR every wave) until either the content is ported template-side (D5) or a classification claim is granted — both visible, both auditable.

## 6. D5 — Adjudicated port procedure (the PR #1640 pattern, codified)

When adjudication determines the project side is canonical (post-incident restoration, recovered relocation, project-evolved content superior to template):

1. **Trigger & freeze.** Record the adjudication (ticket + decision reference). Until the port lands, upgrade waves against the affected project are deferred for the affected paths (the D2 CONFLICT ERROR makes running the wave loud anyway).
2. **Inventory.** Diff the project copy against the current template copy; classify every delta as project-only / template-only / divergent. Diff against the template **at the last delivery's recorded template SHA** (D6c baseline), so template evolution is not misread as project loss.
3. **Adjudicate.** Each project-only delta is accepted into the template or explicitly rejected with a one-line reason in the port PR. Nothing is silently dropped.
4. **Port PR.** Land accepted content into the template side (L1 `templates/common/` or L2 `templates/<variant>/` as ownership dictates) with a version bump so the wave re-delivers; update managed-block parity where applicable.
5. **Acceptance criteria** (all must hold before the port PR merges):
   - **Bidirectional superset**: the new template copy ⊇ the project copy — a line-level diff shows zero project-only lines that are not either ported or explicitly rejected with a reason.
   - **Dry-run no-op proof**: `bun scripts/upgrade-project.ts Projects/<p> --dry-run` on the affected project reports zero `UPDATE`/`CONFLICT` decisions on the ported paths (byte-identical or version-superset).
   - **Protected-file hash table**: the port PR description records SHA-256 of each ported file (template copy and project copy); post-wave verification is a hash comparison, not a manual read.
   - **Post-wave verification ticket**: after the delivery wave, a check confirms project == template at the ported paths and the drift watchlist entry is closed.
6. **Guard rails.** The port never deletes project-only content from the project side; the template side is the write target. If the project copy carries scaffold substitutions (project name renders), port the template-form (tokens), not the rendered bytes.

## 7. D3 — Decision log schema (manifest v2)

```jsonc
// .claude/last-upgrade-delivery.json — v2
{
  "schemaVersion": 2,
  "timestamp": "…",
  "project": "co-design",
  "templateVersion": "0.20.2",
  "templateSha": "<git sha of templates/ at delivery>",
  "baseSha": "<project git HEAD at delivery>",
  "files": ["<existing array — preserved verbatim for all current consumers>"],
  "baselines": { "docs/design-foundation.md": { "hash": "<sha256>", "templateVersion": "0.20.1" } },
  "decisions": [
    { "path": "…", "policy": "SYNC", "pass": "TEMPLATE TREE SYNC",
      "verdict": "CONFLICT", "severity": "ERROR",
      "baseline": { "hash": "…", "templateVersion": "…" },
      "detail": "project-evolved since 0.20.1 delivery; template changed → disposition required" }
  ]
}
```

Severity contract: INFO = expected mechanics (NEW/UPDATE/ADOPT/SEED_SKIP/STUB_SKIP/uncontested MERGE); WARN = divergence worth reading (DRIFT_PRESERVE, SKELETON_COLLISION, in-zone MERGE, EVOLVED); ERROR = requires explicit disposition before the delivery can be considered clean (CONFLICT). Consumers: dev-sync step 3.9 (auto-E5 blocked while ERROR entries are unresolved), the upgrade PR body (adds a Decisions section: counts by severity, ERROR items listed verbatim), and the project-resync wave report. Manifest v2 is written by apply mode only, as today; v1-shaped manifests remain valid until the next delivery rewrites them (graceful migration — no fleet-wide red, §8).

## 8. Rollout

| Layer | Change | Notes |
|---|---|---|
| Engine code (L0) | `scripts/lib/upgrade-policy.ts` v1.24.0: export the decision-log types + severity contract (data only, no claim changes). `scripts/upgrade-project.ts` v1.74.0: decision collector threaded through all passes; provenance baselines (write at delivery, compare at next run); D2 disposition matrix; `--disposition` flag; manifest v2. | No classification change — the deny-list resolver is untouched |
| Gate code (L0) | `scripts/dev-sync.ts` step 3.9: refuse auto-E5 when the referenced manifest has unresolved ERROR decisions. `scripts/audit.ts` unchanged. | Small, fail-closed |
| L1 mirror | `templates/common/scripts/upgrade-project.ts` + `upgrade-policy.ts` twins republished via the L0→L1 publish step; `docs/context.md` 2.x wording for the disposition flag. | Standard publish path |
| Policy data | **None.** No new claims, no PRESERVE additions — explicitly out of scope (D4). | |
| Docs | D6a LOCAL-PATCH SSOT lint and D6c forensic-baseline rule are ticketed follow-ups, not part of this change set. | |
| Migration / compat (16-project fleet) | (1) Projects' existing v1 manifests stay valid; baselines accrue from the first post-upgrade delivery onward — before a baseline exists, PROJECT_EVOLVED detection degrades to today's `isLocallyModified()` behavior (no behavior change, no red). (2) The first wave after landing will surface a WARN/ERROR census — expected, that is the point; co-design's ported paths verify as IN_SYNC (PR #1640 acceptance already proved dry-run no-op). (3) `files` array preserved, so `isDeliveredDiff()` and PR-body compose need only tolerate the extra keys. | Fleet-wide green is the sequencing invariant, as in the tier-normalization design |

Sequencing: PR-1 (engine + tests + gate) → L0→L1 publish → next upgrade wave (writes v2 manifests, produces the census) → census review ticket. The disposition matrix's ERROR rows only change behavior for files that are both project-evolved and template-changed — dry-run evidence from the 2026-10-27 audit says that set is empty today, so the rollout is a no-op for the current fleet and protective for the next divergence.

## 9. Implementation plan (proposal — pending PM dispatch; this ticket lands design only)

| # | Task | Agent | Tier |
|---|------|-------|------|
| 0 | Design Gate Row 0: this design + spec registration | architect | High |
| 1 | PR-1a: decision collector + manifest v2 + provenance baselines in `upgrade-project.ts`; unit tests (baseline classify, matrix rows, severity contract, v1-manifest compat) | automation-engineer | Low |
| 2 | PR-1b: disposition matrix + `--disposition` flag + CONFLICT ERROR semantics; integration test (temp project, evolved committed file + template bump → SKIP + ERROR; `--disposition adopt-template` → ADOPT) | automation-engineer | Low |
| 3 | PR-1c: dev-sync step 3.9 ERROR block; PR-body Decisions section | automation-engineer | Low |
| 4 | PR-1d: L0→L1 publish of engine twins; lifecycle records | lifecycle-manager | Medium |
| 5 | Follow-up tickets: D6a LOCAL-PATCH SSOT lint; D6c forensic baseline; skeleton-collision census review after first wave | pm (creation) | — |

## 10. Consequences

- **Positive**: the U-005 genus (committed divergence silently overwritten; skips invisible behind green gates) becomes mechanically impossible to land silently; drift forensics gain a durable per-delivery baseline; the porting loop becomes a repeatable procedure with hash-verifiable acceptance.
- **Costs**: manifest grows (baselines + decisions — bounded by delivered-file count); one more consumer (dev-sync 3.9) couples to the manifest schema (mitigated by keeping `files` stable and versioning the schema); ERROR dispositions add friction to waves that legitimately want to adopt template over evolved content — paid once per divergence via `--disposition`, and that friction is the feature.
- **Risks & mitigations**: (i) baseline hash false-positives if a project legitimately regenerates a delivered file — REGENERATED/PROJECT_STATE classes never enter baselines; (ii) schema drift between L0 and L1 twins — the existing drift-guard test pattern covers the new exports; (iii) census noise on the first wave — WARN items are informational and triaged once.
- **Explicitly out of scope**: project-owned claim manifests (D4), classification changes, mirror-distribution redesign, drift-forensics tooling (ticketed).

## 11. Acceptance criteria (for the future implementation PRs)

- [ ] Every delivery pass writes verdicts into the unified decision log; a unit test asserts each pass emits at least its matrix rows' verdicts.
- [ ] A committed project-evolved file with a template version bump produces a CONFLICT (ERROR) decision, default SKIP, and non-zero exit — unit + integration fixtures prove it; `--disposition adopt-template` produces ADOPT and a clean exit.
- [ ] Manifest v2 retains the `files` array; `isDeliveredDiff()` passes both a v1 and a v2 fixture; step 3.9 blocks auto-E5 on unresolved ERROR entries.
- [ ] Baselines are absent-tolerant: a project with no prior manifest behaves exactly as today (dry-run parity test).
- [ ] Fleet dry-run evidence: all 16 Projects/co-* dry-runs after PR-1 show zero ERROR dispositions (the audit's 0-CONFLICT state preserved).
- [ ] The D5 procedure is executable as written: a rehearsal port (even a trivial one) satisfies bidirectional superset, dry-run no-op, and the hash table.

## 12. References

- Ticket: T-20261027-004 (`tickets/governance/T-20261027-004.yaml`)
- Incident & reconciliation: U-20261026-005; co-design commits `faf0798`/`ded4749`; root PR #1640 (`cdbfec7c0`)
- Fleet audit: `docs/reports/2026-10-27-u005-class-fleet-drift-audit.md` (systemic findings 2–4 → D6)
- Existing policy model: `docs/designs/2026-09-11-upgrade-policy-coverage-design.md` (ADR-0073); `scripts/lib/upgrade-policy.ts` v1.23.0; `scripts/upgrade-project.ts` v1.73.0 (MERGE/skeleton: ADR-0101, `scripts/lib/platform-skeleton-merge.ts`; CONFLICT/stash semantics: v1.39.0/v1.42.0; delivery manifest: v1.38.0)
- Related in-flight: T-20261027-005 (legacy tier-frontmatter normalization — first template-authoritative frontmatter delivery)
- Historical clobber precedents: pm.md 349→8-line stub restore (T-20260924-003, ADR-0085 D3); co-newbiz ci.yml job loss (ADR-0094, upgrade-policy v1.20.0); co-abap `78adacd4` relocation (audit §2)
