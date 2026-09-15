# Project Review — ai_workspace — 2026-09-15
**Date**: 2026-09-15
**Scope**: workspace root — scoped review of the four template-fleet feature areas: template-based new project creation, project upgrade, variant-ization (project → variant), template registration
**Method**: 3 parallel review agents (Architecture+Scaffolding · Automation · Standards+Lifecycle) + machine battery
**Commissioned by**: owner request, PM-led per the PM Gateway

## Baseline

`review-baseline.ts`: 6/6 green — audit.ts PASS · validate-templates 0 err · verify-scripts PASS · agent/skill lifecycle PASS · propagate --check-drift exit 1 (documented tolerated class, gemini-settings only). All findings below are therefore agent-discovered, not machine-caught — which is itself the review's headline: **the four feature areas' regression tests never run in CI** (Critical-1).

## Findings — consolidated & deduplicated

Cross-slot dedup: B/M-4 = A/M2 (C-CM-03/03a silent-skip on missing frontmatter version, same shape at 2 sites). C/M3 (l3-pipeline cwd degradation) and A/C1 (create-l3-scaffold cwd-relative path) are the same cwd-dependence class in different scripts — kept separate, fix coordinated.

### 🔴 Critical (fix immediately)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| C1 | Incident-regression and upgrade-engine test suites never run in CI: `bun run test:unit` is invoked nowhere; `scripts/test-*.ts` E2E suite (test-new-project, test-l3-to-variant-promotion, test-platform-parity) invoked by nothing; `check-upgrade-coverage.ts --strict` referenced only by docs; `tests/scenarios/` empty. A regression to the 2026-09-12 root guard would pass CI today. | C | .github/workflows/test.yml:122–124 | script-gap | Wire `test:unit` + scripts suite + upgrade-coverage gate into test.yml (fix now) |
| C2 | Pre-upgrade stash omits `-u`, so untracked files are not in the rollback snapshot, while CONFLICT branches claim "the pre-upgrade stash covers rollback" — an untracked CONFLICT file is overwritten with no copy anywhere. | C | scripts/upgrade-project.ts:489 vs :2123 (also 1437, 1494, 1651, 1699, 1856, 2074) | systemic | `stash push -u`; loud failure on stash errors (fix now) |
| C3 | create-l3-scaffold graft injection is silently dead: script searches `templates/common/AGENTS.md` for `WORKSPACE-MANAGED: graft repo context graph` markers that don't exist there (only `graft:start/end`); `indexOf` miss → no block, no warning. All 13 variant AGENTS.md carry the wrapped block. | A | scripts/create-l3-scaffold.ts:649–654 vs templates/common/AGENTS.md:681 | one-time + script-gap | Re-wrap the graft block in L1 AGENTS.md (fix now); marker-reference validator ticketed |
| C4 | `workspace-schema.json` has zero registration for co-price and co-safety (2 of 13 variants), and no validator consumes `variant_extensions` at all — the next variant repeats the omission. | B | docs/workspace-schema.json (variant_extensions keys: 11 of 13) | systemic + script-gap | Register the 2 variants now; reverse-check ticketed |
| C5 | create-l3-scaffold reads `templates/common/AGENTS.md` relative to caller cwd — crash mid-scaffold (after Steps 3–4 copied content), and the script has no rollback, leaving a partial `Projects/<name>/`. | A | scripts/create-l3-scaffold.ts:638 (+ missing M13-equivalent) | one-time + systemic | Anchor to WORKSPACE_ROOT + add rollback via existing helper (fix now) |

### 🟡 High (fix within 1 week)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | Dry-run vs apply parity break: apply stashes before the passes, so dry-run's CONFLICT verdicts silently become UPDATE on the run that matters. | C | upgrade-project.ts:486–496 vs :980–984 | systemic | Pre-scan locally-modified set before stash (fix now) |
| H2 | `--prune-removed` prunes in the log but not on disk for untracked files (`git rm` fails silently, `prunedCount++` anyway); sibling pass already has the `rmSync` fallback. | C | upgrade-project.ts:2333–2345 (vs :2251–2253) | one-time | Mirror the fallback (fix now) |
| H3 | `--rollback` exits 0 on failed restore and ignores `--dry-run` (performs a real stash pop). | C | upgrade-project.ts:468–483 | one-time | exit 1 on failure; no-op in dry-run (fix now) |
| H4 | l3-to-variant-pipeline marker gates (Phases 3.5, 4.5) are fail-open on exception — a transient read error bypasses the gates whose whole purpose is catching silent wrong output (Phase 4.7 is correctly fail-closed). | C | l3-to-variant-pipeline.ts:670–673, 1075–1079 | systemic | Fail-closed in gate catches (fix now) |
| H5 | Variant-ization can overlay an existing live variant template with no guard; failure after Phase 4 leaves orphaned state (contrast new-project's rollbackPartialProject). | C | l3-to-variant-pipeline.ts:1440–1451; helpers/generate-variant.ts:1599–1605; project-to-variant.ts:223–234 | systemic | Ticket (needs design: exists-guard flag + state rollback) |
| H6 | new-project `--version <tag>` mixes tag content with working-tree content: pm.md stub resolution and variant.context.template.md read HEAD paths; readiness gate validates workspace templates while `template-version.txt` claims `<tag>`. | A | new-project.ts:614, 915, 259, 349–373, 939 | recurring | Resolve from tag extraction dir + pass `--dir` (fix now) |
| H7 | Path-like project names can scaffold into managed dirs (`templates/co-evil` → auto-detected as a variant forever). | A | new-project.ts:109–119, 82, 133–135 | recurring | Managed-prefix denylist (fix now) |
| H8 | L1 SCRIPTS.md registry rows stale vs L0 for all five feature scripts (upgrade-project 1.26.0≠1.27.0, new-project 1.15.0≠1.16.0, project-to-variant 1.2.0≠1.3.0, generate-variant 1.13.1≠1.14.0, l3-to-variant-pipeline 1.13.0≠1.17.1) — three consecutive bump rounds skipped them; L0-only rows in the L1 registry are invisible to every gate. | B | templates/common/scripts/SCRIPTS.md:225, 194, 197, 109, 176 | systemic + script-gap | Reconcile rows now; cross-registry parity check ticketed |
| H9 | Check E silently skips lifecycle records with no Version/Owner field — exactly the variant-ization records (project-to-variant, variant-feature), recreating the stale-record class Check E was built to close. | B | lifecycle-sync-audit.ts Check E; docs/lifecycle/skills/{project-to-variant,variant-feature}.md | script-gap | Backfill records + WARN on absent field (fix now) |
| H10 | `common_platform_skills` contract versions unchecked (Check H is exists-only); 9 skills double-registered in common_skills + common_platform_skills with no equality check; `.gemini` tree lacks reverse exists→listed coverage. | B | common-contract.json:288–372; verify-platform-lifecycle.ts:144–181; validate-templates.ts:2355, 2717 | systemic | C-CM-03b platform version check (fix now); .gemini reverse arm ticketed |
| H11 | create-l3-scaffold has no partial-failure rollback (the defect class M13 fixed for new-project). | A | create-l3-scaffold.ts (no exit-guard) vs new-project.ts:452–460 | systemic | Reuse rollbackPartialProject (fix now) |
| H12 | new-project discards extends-stub bodies with no check that they are actually stubs — a variant author writing real content + keeping `extends:` loses it silently. (Latent: current 5 stubs are canonical.) | A | new-project.ts:613, 655–660 | systemic risk | Scaffold-time warn ticketed; validator ticketed |
| H13 | Docs/.agents delivery drift between the two scaffold paths (create-l3-scaffold excludes top-level `docs/` beyond `_common` and all of `.agents/`); every new templates/common/docs file widens the gap silently. | A | create-l3-scaffold.ts:214–226, 675–690 | systemic | Ticket (needs a reviewed-exemption constant + parity test) |
| H14 | Root-incident guard uses `resolve` (no symlink canonicalization) and outside-Projects targets only WARN — the same whole-tree delivery as the incident, just elsewhere. | C | upgrade-project.ts:252, 258–261 | one-time residual | realpath fix ticketed (guard semantics change) |

### 🟢 Moderate (fix within 2 weeks)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | upgrade-project exit code never reflects failure (securityPass false → exit 0). | C | upgrade-project.ts:2448–2450 | one-time | Fix now |
| M2 | Skill-doc drift: upgrade-project SKILL.md pins v1.23.0 (script 1.27.0), omits new flags/passes; project-to-variant example command exits 1 run verbatim. | C | .agents/skills/upgrade-project/SKILL.md:40–88; project-to-variant/SKILL.md:89 | systemic | Fix broken example now; full refresh ticketed |
| M3 | l3-pipeline silently degrades off workspace-root cwd (Phases 1.6, 2.5, 4, 3.5-autofix). | C | l3-to-variant-pipeline.ts:404–427, 223, 897, 639–646 | systemic | Root-cwd guard (fix now) |
| M4 | Stash failure misreported as "working tree clean". | C | upgrade-project.ts:490 | one-time | Fix now (with C2) |
| M5 | C-CM-03/03a skip comparison when artifact frontmatter has no `version:` (guard `fmVersion &&`). | B+A | validate-templates.ts:2265, 2291 | script-gap | Invert to fail on contractVersion-without-fmVersion (fix now) |
| M6 | new-project script lifecycle record frozen at v1.10.0 (script 1.16.0); recurred once before. | B | docs/lifecycle/scripts/new-project.md | systemic | Ticket (gate script records or drop double-SSOT) |
| M7 | VERSION_MANIFEST generated with no reconciliation gate; generator counts scripts/experiments/ CLI-less file ("Scripts: 93" vs 92). | B | VERSION_MANIFEST.md:13,123; generate-version-manifest.ts | script-gap | Ticket (--check mode + exclusion) |
| M8 | New-variant registration needs ~7 manual edits (6 READMEs are WS-12-checked; propagation-map ×2 lists, common.lifecycle.json propagatedTo, VERSION_REGISTRY partially; lifecycle/templates record unchecked). | B | propagation-map.json; PM-01 schema | systemic | Ticket (PM-01 amendment: target_variants ≡ variant dirs) |
| M9 | new-project unchecked helper spawns (5 sites) — failed placeholder substitution ships live `{{markers}}` with success printed. | A | new-project.ts:826–946 | recurring | Fix now |
| M10 | create-l3-scaffold layout guard compares raw arg vs toVariantSlug (latent false-flag/miss). | A | create-l3-scaffold.ts:1137 | one-time | Fix now (trivial) |
| M11 | Scaffold provenance version parsed from SCRIPTS.md with silent 1.0.0 fallback; SSOT is templates/VERSION. | A | create-l3-scaffold.ts:118–130 | one-time | Ticket |
| M12 | Stale `L1_ONLY_AGENTS` exclusions reference non-existent files (masks future drift). | A | new-project.ts:501 | one-time | Ticket |
| M13 | DEFAULT_PM_ROLE_DESCRIPTIONS covers 5 of 13 variants; rest get generic fallback in context.md. | A | template-utils.ts:88–94 | systemic | Ticket |
| M14 | docs/index.md mentions only 2 variants — navigation hub outside WS-12 scope; mark non-normative or extend. | B | docs/index.md:113–115 | one-time | Ticket (low) |

### ✅ Strengths

- Root-target guard + pinning test shipped post-incident (gap is CI execution, not the guard); new-project M13 rollback helper is side-effect-free and unit-tested.
- Phase 4.7 context-purification gate is genuinely fail-closed with exported pure function + recorded outcome; v1.17.1 exit-code honesty landed.
- ENV_SAMPLE engine idempotent by construction, shared with scaffold-time pruner; deny-list-by-default upgrade policy kills silent non-delivery; `check-upgrade-coverage.ts` exists (needs CI wiring — C1).
- Contract coverage bidirectional and clean today: all 30 common_skills versions match, common_commands 8/8 both directions, C-CM-03a verified landed, VERSION_REGISTRY B-07 machine-reconciled (13/13), propagation-map L0↔L1 byte-parity, WS-12 green across all 6 indexes.
- new-project Windows hardening (device-name purge, mkdtempSync, tar tag extraction), l0-ref-policy shared module, docs/context.md SSOT dual-path protection, pm.md extends resolution regression-pinned (Test 25 + --all-variants).

## Action wiring (Step 5)

**Fix now (this session, PM Gateway executor)**: C1, C2, C3, C4, C5, H1, H2, H3, H4, H6, H7, H8(rows), H9, H11, M1, M3, M4, M5, M9, M10, M2(broken example only)
**Ticket (deferred)**: H5, H10(both arms), H12, H13, H14, H8(validator), M2(full refresh), M6, M7, M8, M11, M12, M13, M14

Ticket IDs created (auto-enrolled in §3.7.5 governance-backlog triage):

| Ticket | Finding | Title |
|--------|---------|-------|
| T-20260915-001 | H8 validator | validator-hardening: add cross-registry SCRIPTS.md version parity check (L0 vs L1 rows for same-named scripts) |
| T-20260915-002 | C3 validator | validator-hardening: validate scaffolder marker references exist in source templates (graft/COMMON-AGENTS silent no-op class) |
| T-20260915-003 | H13 | validator-hardening: parity test between new-project and create-l3-scaffold delivery trees with one shared exemption constant |
| T-20260915-004 | M7 | validator-hardening: add VERSION_MANIFEST --check reconciliation gate and exclude scripts/experiments from the CLI script count |
| T-20260915-005 | M8 | validator-hardening: PM-01 derive propagation target_variants and propagatedTo from the actual variant directory set |
| T-20260915-006 | H5 | design: guard variant-ization against overlaying an existing live variant template and add post-Phase-4 state rollback |
| T-20260915-007 | H14 | design: harden upgrade-project target guard with realpath canonicalization and confirm targets outside Projects |
| T-20260915-008 | M2 | docs: refresh upgrade-project SKILL.md to v1.28 behavior (flags, passes, managed markers) across all platform mirrors |
| T-20260915-009 | M6 | governance: gate or retire docs/lifecycle/scripts records so new-project version history cannot silently lapse |
| T-20260915-010 | H12 | new-project: warn before discarding non-canonical extends-stub bodies and validate stub prose in validate-templates |
| T-20260915-011 | M11 | chore: create-l3-scaffold provenance version should read templates/VERSION not SCRIPTS.md with silent 1.0.0 fallback |
| T-20260915-012 | M12/M13 | chore: drop stale L1_ONLY_AGENTS exclusions and complete DEFAULT_PM_ROLE_DESCRIPTIONS for all 13 variants |
| T-20260915-013 | H10 | validator-hardening: extend version parity to common_platform_skills across .claude/.gemini trees and enforce cross-section equality with common_skills (C-CM-03b) |

**In-session fixes landed** (versions): upgrade-project 1.27.0 → 1.28.0 (C2/H1/H2/H3/M1/M4 + dry-run security-verification semantics) · create-l3-scaffold 1.13.0 → 1.14.0 (C5/C3-cleanup/H11/M10) · new-project 1.16.0 → 1.17.0 (H6/H7/M9) · l3-to-variant-pipeline 1.17.1 → 1.18.0 (H4/M3) · lifecycle-sync-audit 1.12.0 → 1.13.0 (H9) · validate-templates 1.27.0 → 1.28.0 (M5) · test-runner 1.1.1 → 1.2.0 + test-new-project 1.1.1 + test-l3-to-variant-promotion 1.2.1 (C1 runner/suite repairs) · templates/common/AGENTS.md graft re-wrap + VARIANT-ROLE-BOUNDARY marker restoration (C3, E2E red root cause) · workspace-schema.json co-price/co-safety registration (C4) · L1 SCRIPTS.md 5-row + 3 test-row reconciliation (H8) · 2 lifecycle records backfilled (H9) · project-to-variant SKILL example command corrected (M2 partial) · CI test.yml wiring (C1) · 2 dead MEMORY.md links → tombstones.

## Verification

Re-run after fixes (Step 6):

- `bun scripts/test-runner.ts scripts` — 5/5 PASSED (was 0/5: runner executed standalone harnesses under `bun test`)
- `bun scripts/test-l3-to-variant-promotion.ts` — 14/14 PASSED (was 9/14; root cause = the VARIANT-ROLE-BOUNDARY marker loss this review traced)
- `bun run test:unit` — 44 files PASSED (2 pre-existing failures found and fixed en route: upgrade-tree-sync dry-run exit semantics, verify-memory-dead-links tombstones)
- `bun scripts/validate-templates.ts` — 0 errors, 1 pre-existing warning
- `bun scripts/review-baseline.ts` — 6/6 green
- `bun scripts/check-upgrade-coverage.ts --strict` — PASS (now wired into CI)
- `bun scripts/upgrade-project.ts --dry-run <project>` — exit 0 with honest CONFLICT reporting

**Ratchet outcome**: script-gap findings C1 (CI wiring), H8 (L1 registry parity — rows fixed, standing check ticketed T-001), H9 (Check E tighten — landed), M5 (landed), C3 (marker validator ticketed T-002) — the found-by-agent class is scheduled to become caught-by-script.
