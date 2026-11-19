# Adoption gaps batch (co-quickdl U-20261119-002) — design

**Status:** implemented
**Ticket:** T-20261120-001 (from triaged U-20261119-002; 4 confirmed gaps in scope, phase-definitions instantiation excluded)
**Scope:** scripts/adopt-project.ts, scripts/upgrade-project.ts (one additive prune arm), scripts/helpers/adopt-plan.ts, new scripts/helpers/adoption-provenance.ts. No template changes; new-project flow untouched.

## Problem

Adoption of an external repo into an L3 variant project (adopt-project.ts, upgrade-project engine) leaves four verified gaps:

1. **Unfilled context overlay stub** — `applyContextTemplate` substitutes only `VARIANT_NAME`/`VERSION`/`PM_ROLE_DESCRIPTION` (template-utils.ts:68-78); the `VARIANT-INJECT: tech-stack` rows ship `[e.g., TypeScript 5+]` example cells (variant.context.template.md:17-22) and the `[Domain] Guidelines` section ships its `INSTRUCTION`/`Replace this placeholder` markers (:127-140). adopt-project step 10's substitution map (adopt-project.ts:764-778) has no stack fields and nothing warns on unfilled sections. QuickDL received `docs/co-develop.context.md` as an unfilled stub.
2. **No adoption hygiene pass** — the variant template root legitimately carries L2-only promotion machinery (`PROMOTION_CHECKLIST.md`, B1 requirement per validate-variant-readiness.ts:150-152) that must not survive into an L3 tree; audit.ts:911-925 allowlists it at project root, so nothing ever flags it. QuickDL found one at its root (leak path not reproduced — plausibly pre-existing external content; the check flags residue regardless of origin).
3. **Source-variant skill leak on re-base** — adoption delivers the source variant's own skills (templates/<S>/skills → co-develop: code-review, refactoring, swe-solve, test-driven-development) and the project's variant.json (operator-restored per field evidence) declares them in `skill_manifest.variant_specific`. On re-base (`upgrade-project --variant co-utility`) the VARIANT-SCOPE SKILL PRUNE (upgrade-project.ts:8295-8414) only consults `docs/workspace-schema.json variant_scoped_skills`, which registers only `swe-solve` for co-develop; the manifest-seeded KEEP (:8349-8360) protects it; the other three skills are never checked. All four survived and needed manual `git rm` across skills/ + 5 platform mirrors, and the variant.json identity had to be hand-flipped.
4. **Stale pre-standard context.md never flagged** — docs/context.md is SCAFFOLD_COMMON_OWNED_FILES (upgrade-policy.ts:678) seeded add-if-missing and PRESERVEd on upgrade; adoption's settling touches only the overlay, so a pre-standard docs/context.md (missing the standard version footer or older than the canonical footer version) is never detected or offered alignment.

## Decision

All four fixes are additive and adoption-path-local. Pure logic lives in helpers (unit-testable); the orchestrators consume it.

### Gap 1 — overlay stack substitution + stub WARN (adopt-project.ts, adopt-plan.ts)

- **Input mechanism (ruled: prompt/flag, not variant.json config)** — variant templates carry no stack data and deriving it from project files would be guessing. New `--stack` value flag: comma-separated `key=value` pairs keyed `language`, `framework`, `database`, `libraries`, `package-manager`, `testing` (the six template rows, in order). Interactive mode (no `--yes`): if `--stack` is absent, prompt the six rows in order (empty input = leave placeholder). If rows remain unfilled after prompting, WARN + y/N acknowledgment pre-delivery (decline aborts cleanly before any writes). `--yes`/CI skips prompting; placeholder cells remain and the post-substitution WARN rows are the acknowledgment.
- **Substitution (settling step 5)** — the engine normally delivers the variant template's own overlay (`templates/<variant>/docs/<variant>.context.md`); adopt-project's `applyContextTemplate` generation is the fallback. `applyStackSubstitutions(content, stackValues)` (pure, in adopt-plan.ts) replaces the six label-anchored table cells (`| **Language** | ... |` etc.) for the values provided, keyed on template-fresh provenance this run — overlay generated above OR present in the delivery manifest — so an operator-authored overlay (repair path: present but not delivered this run) is never touched. Template stays unchanged (the `[e.g., …]` examples remain the canonical placeholder text; new-project parity is untouched). Rehearsal correction (2026-11-20): the first implementation keyed substitution on the generation branch only and never fired on the engine-delivered normal path — the delivery-manifest key is the fix.
- **Post-substitution WARN** — `detectContextOverlayStubs(content)` (pure) flags: any `[e.g.,` cell (tech-stack block), the `[Domain]` heading, the `<!-- INSTRUCTION:` marker, and the `Replace this placeholder` line. adopt-project emits one WARN row per class naming the section and remediation. The `[Domain] Guidelines` body is deliberately NOT auto-filled (requires domain judgment; no safe default).

### Gap 2 — adoption hygiene pass, report-only (adopt-plan.ts, adopt-project.ts)

- `ADOPTION_HYGIENE_ROOT_ARTIFACTS` (constant in adopt-plan.ts): files the effective L2 template tree can deliver at the project root that an L3 project must not keep — `PROMOTION_CHECKLIST.md` (B1 promotion-gate artifact) and `variant.json` (L2 identity manifest; scaffold parity removes it post-delivery, so a leftover means the settling removal did not run — flagged as a safety net).
- Settling pass: scan the project root (depth-1 files) for members of the list → report-only WARN rows naming each file with remediation (`git rm` or explicit justification). Never deletes (report-only per dispatch). Findings recorded in `report.hygieneFindings` (flows into `.claude/adopt-project-decisions.json`).

### Gap 3 — source-variant adoption-residue prune on re-base (upgrade-project.ts, helpers/adoption-provenance.ts)

- **Provenance carrier (ruled: existing decisions file, no new marker)** — adopt-project already writes `.claude/adopt-project-decisions.json` on every adoption (step 24) containing the adoption `variant` and `plan.foreignSkills`; it survives the settling pass and is field-proven (Projects/co-utility). A marker inside variant.json would not survive adoption (settling removes it when foreign skills were seeded — the exact QuickDL case). No adopt-project change needed for this gap.
- **Prune arm (VARIANT-SCOPE SKILL PRUNE, L1 core — fail-safe proof chain)** — new leading sub-arm inside the existing pass (before the registry-driven loop, so registry-arm SKIP rows never contradict residue DELETE rows), implemented via pure helper `scripts/helpers/adoption-provenance.ts`:
  - `loadAdoptionProvenance(projectDir)` → `{ sourceVariant, foreignSkills } | null` (guarded parse; any malformed input → null).
  - `selectSourceVariantPruneCandidates(inputs)` → `{ prune, keep, skip }`. The arm enters only when ALL hold: provenance present; `templates/<sourceVariant>/` exists; the project's variant.json parses and `variant.json.name ≠ sourceVariant` (identity flipped post-adoption); target `--variant ≠ sourceVariant`. Identity NOT flipped (name == source) → loud INFO row only, no destructive action (the manifest-seeded KEEP remains the documented adoption-protection behavior).
  - A skill is a prune candidate only when it is simultaneously: (a) declared by the SOURCE variant template (`templates/<S>/variant.json` `skills[].name` ∪ `skill_manifest.variant_specific[].name` — proven source-variant-seeded), (b) present in the project (skills/ SSOT or a platform mirror), (c) NOT in the current project variant.json `skill_manifest.variant_specific` (not PROJECT_STATE-authored post-flip), (d) NOT in `provenance.foreignSkills` (not a project's own adopted skill), (e) NOT declared by the TARGET variant template (when `templates/<T>/variant.json` exists; self-declared target → empty set), (f) NOT in `templates/common/skills/` (common-owned — the common delivery owns it).
  - Action: same mechanics as the registry arm — `deletionMarkerLossBlocks` guard, `git rm -rf` skills/ SSOT + `PLATFORM_SKILL_BASES` mirrors, dry-run aware, `recordDecision` DELETE rows under the same `VARIANT_SCOPE_PRUNE` pass name (loudness rule), summary line.
- Rationale for candidate source (template-declared set, not directory listing): the template's variant.json is the declared authority; a dir listing would prune skills the source variant may have delivered-but-unregistered. Both under-prune and over-prune are avoided by the six-way conjunction — every filter independently blocks guessing.

### Gap 4 — pre-standard context.md detection + `--refresh-context` (adopt-project.ts, adopt-plan.ts)

- `assessContextStandardVersion(projectContent, canonicalContent)` (pure): parses the `*context.md version: X.Y — …` footer from both files; verdicts `fresh` (project ≥ canonical), `stale` (project < canonical), `no-footer` (project missing the standard footer marker). Comparison on major.minor numerically; the footer version is the context.md standard version (2.16-class), independent of templates/VERSION.
- Settling step 5b (after overlay generation): skip when docs/context.md was delivered this run (in the delivery manifest — canonical by construction). Else assess:
  - `fresh` → INFO row.
  - `stale` / `no-footer` → WARN naming the file, the detected vs canonical version, and the remediation. In interactive mode additionally offer regeneration (y/N); `--refresh-context` forces regeneration non-interactively (flag IS the explicit consent — docs/context.md is DOCS_PRESERVE, so auto-regeneration without consent was ruled out).
  - Regeneration: overwrite docs/context.md from `templates/common/docs/context.md`, then apply the standard substitution map (projectName/variant/country) over it; loud console rows + `report.contextRefresh` record. Flag without a stale file → INFO no-op.

## Out of scope

- phase-definitions.md roster instantiation (U-002 gap 5) — separate batch.
- The settling variant.json-removal asymmetry (engine-delivered variant.json survives when no foreign skills were seeded; the `&& plan.foreignSkills.length > 0` condition vs `deliveredThenRemoved: ["variant.json"]`) — covered by the Gap 2 hygiene WARN as a safety net; changing removal semantics could alter existing adoption outcomes and is not minimal.
- audit.ts:947 placeholder-regex extension (does not catch `[e.g., …]` cells) — the adoption WARN is the fix locus; the audit regex family is L0-wide.
- variant_scoped_skills registry growth (e.g. registering all four co-develop skills) — orthogonal owner-curated path; the residue arm removes the dependency on it.

## Tests

- `tests/unit/adopt-plan.test.ts` (extend): `applyStackSubstitutions` (row replacement, label-anchored, no-value no-op, malformed rows), `detectContextOverlayStubs` (each marker class, clean file), `ADOPTION_HYGIENE_ROOT_ARTIFACTS` scan (hit + clean), `assessContextStandardVersion` (fresh/stale/no-footer/project-ahead, malformed footers).
- `tests/unit/adoption-provenance.test.ts` (new): candidate-selection truth table (each filter independently blocks), identity-flip gate, junk/malformed provenance → empty, target-declared and common-owned exclusions.
- `tests/unit/upgrade-prune-residue-arm.test.ts` (new): source-ordering pin — residue arm precedes the registry-driven loop inside VARIANT-SCOPE SKILL PRUNE; decisions-carrier contract pin.
- Battery: `bun run test:unit`, `bun run lint:scripts`, `bun run audit`, `bun run validate-templates` (adopt-project only — new-project E2E untouched).
