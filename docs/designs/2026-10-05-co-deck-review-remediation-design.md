# Design: co-deck Review Remediation (2026-10-05 review, T-20261005-006..018)

**Date**: 2026-10-05
**Status**: implemented (this document governs the remediation of all 39 findings in `docs/reports/2026-10-05-project-review-scoped-co-deck.md`)
**Scope**: `templates/co-deck/**` (L2 template), root `scripts/` (new validator + battery), root `docs/lifecycle/templates/co-deck.md`
**Out of scope**: `/sync` commit/PR pipeline (run separately), `Projects/*` fleet propagation (delivered by the next upgrade wave), upstream co-deck content features.

## Context

The scoped project review found the machine battery green but 39 agent-level findings: 2 Critical code defects, a beta-era metadata cluster that survived the 2026-08-30 stable promotion, a governance scaffold disconnected from the real 11-stage pipeline, stale theme/roster/skill claims, and a script robustness/hygiene cluster. 24 of 39 findings are `script-gap` — this design lands both the fixes and the standing checks (ratchet).

## Decisions

- **D1 — Template-local package.json** (T-007): add `templates/co-deck/package.json` declaring `pdf-lib`, `@pdf-lib/fontkit`, `fflate`, `@resvg/resvg-js`, `puppeteer-core` (dependencies) and `playwright` (devDependencies), plus `test` / `test:visual` / `test:smoke` script entries. Template-local, not common: these deps are co-deck-specific and common is shared by 14 variants. Verify the scaffold pipeline delivers the file to projects.
- **D2 — betaLifecycleSummary: null for stable** (T-008): co-design convention. Grep consumers (`scripts/l3-to-variant-pipeline.ts`, `scripts/helpers/beta-lifecycle.ts`) first; null only if no consumer requires the object for a stable variant.
- **D3 — theme_manifest schema** (T-011/T-016): replace `available`/`default` (which held style names) with `themes: [6]`, `styles: [6]`, `default_theme: "pitch-enhanced"`, `default_style: "premium-dark"`; notes regenerated to current facts (6 themes incl. outlook, 6 styles incl. zen-only white-bubble, gen-slides-pdf v1.9.0). `validate-templates.ts` must tolerate both old and new shapes (backward-compatible).
- **D4 — Process model unification** (T-010): `process/stages.yaml` regenerates as S1–S11 mirroring `agents/README.md`'s pipeline; gate authority = `docs/user-guide.md` §4 (Gates 2 and 5 mandatory; 1.5, 3, 4 optional); gates re-bound to real stages/deciders with full (untruncated) titles from their criteria; RACI owners real; `docs/phase-definitions.md` rewritten with real agent names plus an explicit **phase (0–6) ↔ stage (1–11) mapping table**; agent frontmatter `phases:` values are NOT renumbered (they are the skill_manifest contract) — the mapping table reconciles them; `docs/skill-graph.json` stage/gate nodes regenerated (or hand-edited consistently if no generator exists).
- **D5 — Claims de-hardcoding**: volatile counts in prose ("all 27 decks") are rephrased to registry-relative wording; single sources are disk scans + THEMES.md.
- **D6 — Standing validator** (T-011..014): new `scripts/validate-variant-claims.ts` (v1 scope: `--template` arg, default `co-deck`; fleet sweep is a follow-up). Checks: numeric roster/skill/theme claims vs manifests; status wording + betaLifecycleSummary-null-if-stable; process_manifest path existence; owner_agent ∈ roster in stages/gates/raci/phase-definitions; PENDING_REVIEW + criteria-confirmed truncated titles; phantom `skills/<name>/SKILL.md` mentions (inherits_common-aware); deprecated-script references in active skills; undeclared bare imports vs resolvable package.json files. Registered in `scripts/SCRIPTS.md` and appended to the `scripts/review-baseline.ts` battery.
- **D7 — AGENTS.md boilerplate** (T-015): adopt templates/common's current §6–§10 (thin-dispatcher form, incl. §7 "Encoding Vigilance" + "Abuse Pattern Detection", retired `/meeting` phrasing) verbatim where variant-agnostic; delete §3.5 placeholder rows; fix §3 subsection ordering; variant managed zones untouched.
- **D8 — download-font hardening**: pin Pretendard to a release tag (no `releases/latest`), add optional `expected_sha256` verification (error only when a checksum is declared; checksums populated on a networked follow-up), fail when saved files don't cover `spec.files`, out-of-project font-dir writes become opt-in, console messages English.
- **D9 — Config hygiene** (M16): `.claude/settings.json` duplicate hook entries removed; graft-dependent hook commands wrapped in file-existence guards; unknown keys (e.g. `asyncRewake`) preserved.

## File ownership (exclusive, to avoid parallel-edit conflicts)

| Cluster | Files |
|---|---|
| S scripts | `templates/co-deck/scripts/co-deck/**`, NEW `templates/co-deck/package.json`, `templates/co-deck/.claude/settings.json` |
| C contract/claims | `templates/co-deck/variant.json`, `PROMOTION_CHECKLIST.md`, `README.md`, `README_ko.md`, `docs/co-deck.context.md`, `docs/lecture-profile.md`, root `docs/lifecycle/templates/co-deck.md`, preview deck regeneration |
| P process model | `process/stages.yaml`, `decisions/gates.yaml`, `governance/raci.yaml`, `docs/phase-definitions.md`, `docs/skill-graph.json` (+overrides), `agents/design.md`, `agents/README.md`, `agents/README_ko.md` |
| U docs surface | `AGENTS.md`, `docs/user-guide.md`, `docs/user-guide_ko.md`, `skills/theme-authoring/SKILL.md` + 5 platform mirrors; read-only: `docs/templates/common-contract.json` scaffold verification (L1) |
| V validator | root `scripts/validate-variant-claims.ts` (new), `scripts/SCRIPTS.md`, `scripts/review-baseline.ts`, `scripts/validate-templates.ts` (D3 tolerance only) |

## Verification plan

1. `bun scripts/review-baseline.ts` → expect 7/7 green (battery incl. new validator).
2. `bun test templates/co-deck/scripts/co-deck/tests/` → offline suites pass.
3. Spot checks: no "13 agents" claims; no `/meeting` in co-deck AGENTS.md; gates titles complete; `theme_manifest` new shape; betaLifecycleSummary null.
4. Tickets T-20261005-006..018 moved to `review` with results; report gets a Verification section.
