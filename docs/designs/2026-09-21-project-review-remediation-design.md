# Project Review Remediation — Design

- **Spec ID**: 2026-09-21-project-review-remediation
- **Date**: 2026-09-21
- **Source**: docs/reports/2026-09-21-project-review-full.md (4-slot parallel review; machine baseline 6/6 green)
- **Status**: implemented
- **Owners**: pm (orchestration), automation-engineer domain (scripts), docs-writer domain (docs)

## 1. Problem Statement

The 2026-09-21 full project review verified that the machine baseline is green while
specialist review found defect classes the validators cannot see, concentrated in the
four workflows under review (new-project creation, upgrade, variant-ization, template
promotion). This design covers the batch of findings with clear, non-design-gated fixes.
Findings requiring an architectural decision (H-1, H-2, H-3, H-4, M-1, M-2, M-15..M-18,
M-20, M-21) are out of scope here and are wired to tickets.

## 2. Goals

1. **C-1 — stop workspace-only skill leaks in both directions** (scaffold out, upgrade in) and self-heal already-leaked projects.
2. Fix broken/stale workflow documentation (C-2, H-5, H-6, H-8, H-10, M-6, M-9).
3. Fix the country-prune context-scrub dead path (H-7) and deliver `workspace-schema.json` to L3 drafts (M-22).
4. Backfill 7 missing skill lifecycle records (H-9) without breaking delivery-parity tests.
5. Small hardening: MEMORY.md stub on the new-project path (M-13), encoding gate on governance/docs apply modes (M-14), Phase 2 back-sync to `.codex` (M-19).

## 3. Non-Goals

- Locale plumbing in creation scripts (H-2) — needs an ADR-level decision (agent-driven vs `--locale` flag).
- Upgrade contract-skill gating policy (H-1), promotion platform blindness (H-3), core-script fork semantics (H-4) — tickets with precise specs.
- Language-policy text alignment for the suffix zone and locale-code list renderings (M-1, M-2) — touches managed blocks across 13 variants; ticket.

## 4. Design Decisions

### D1 — C-1 leak fix (defense in depth, four layers)

- **L0 SSOT**: add `l2_propagate: false` to `skills/simulate-pipeline/SKILL.md` frontmatter (scope: workspace; its prerequisites reference L0-only scripts). Bump to 1.0.2.
- **Orphan removal**: delete `templates/common/.{claude,gemini,agents}/skills/swe-solve/` — stale `scope: common` forks of the co-develop-scoped skill; the owning copy lives in `templates/co-develop/skills/`. Workspace platform mirrors do not contain `swe-solve`, so propagation will not resurrect them.
- **Scaffold sweep parity**: add `.agents/skills` to the flag-based sweep base list (`scripts/new-project.ts:1169`) and to the static derivation (`collectL2PropagateFalseSkills` `scripts/helpers/scaffold-markers.ts:720`, `isLegacyL0SkillRel` :757); add `.agents/skills`/`.codex/skills` to the LEGACY sweep bases (`new-project.ts:1160`). Derivation and runtime stay consistent, keeping Test 26 (`verifyActualTreeMatchesDerivation`) green.
- **Upgrade re-delivery**: move the `.codex/skills` + `.codex/prompts` claim in `scripts/lib/upgrade-policy.ts` from `TEMPLATE_TREE_SYNC` to the `sync-skills.ts (platform mirror)` pass, matching `.claude/.gemini/.agents`. Safe because project-side `sync-skills.ts` Phase 1 covers all four mirrors and Phase 1b mirrors commands → `.codex/prompts`. Ordering before the blanket `.codex/**` rule is preserved.
- **Self-heal**: new `WORKSPACE-ONLY SKILL SWEEP` pass in `scripts/upgrade-project.ts` (after COUNTRY-SCOPED SKILL PRUNE, before the post-upgrade sync-skills invoke): remove any skill whose project-mirror `SKILL.md` carries `l2_propagate: false` (plus `NEW_PROJECT_LEGACY_L0_SKILLS`), across the five bases. Stock-copy hash check + `isLocallyModified` CONFLICT guard, mirroring the country-prune safety model. Dry-run aware.
- Also add the missing `.codex/skills` base to the upgrade country-prune bases (consistency with the scaffold prune's five bases).

### D2 — H-7 prune context scrub

`prune-country-scoped-assets.ts` derives the context path from `basename(targetDir)`, but projects name it `docs/<variant>.context.md` (dir name may differ) and L3 drafts use `docs/context.md`. Fix: accept an optional third positional arg `<variant>`; scrub every candidate that exists: `docs/context.md`, `docs/<basename>.context.md`, `docs/<variant>.context.md`. Both callers pass the variant (`new-project.ts` step 2.4, `create-l3-scaffold.ts` step 4.5). Helper `@version` 0.3.2 → 0.3.3; SCRIPTS.md row updated.

### D3 — H-9 lifecycle records

Follow sibling precedent: `k-ecos` record at L0 `docs/lifecycle/skills/k-ecos.md` (k-dart style); six L1 records under `templates/common/docs/lifecycle/skills/` (i18n-audit lean style): decision-record, evidence-ledger, handbook, i18n-formatting, i18n-layout, i18n-locale-config. The six L1 files widen the new-project↔L3 delivery gap, so each is added to `REVIEWED_DELIVERY_EXCLUSIONS` with the established H13 reason (mirrors the `i18n-audit.md` entry), keeping `test-scaffold-delivery-parity` exact-match green.

### D4 — H-6 via the governance propagation chain

`templates/common/AGENTS.md` is generated from root `AGENTS.md` by `publishGovernanceL1`. Fix at the source: annotate the three L0-only skill rows in root `AGENTS.md` §6 ("Workspace-root (L0) only — not shipped in scaffolds"), then re-run `propagate-to-templates.ts --governance-l1 --apply` so L1 is regenerated, not hand-edited. Same for the CONSTITUTION.md marker-count correction (M-9; L0-only — no L1 copy exists).

### D5 — M-22 schema delivery to L3

`create-l3-scaffold.ts` docs step explicitly copies `docs/workspace-schema.json` next to `docs/context.md`; remove the corresponding `REVIEWED_DELIVERY_EXCLUSIONS` entry (gap disappears; exact-parity test stays green). This clears the validator's degraded ko-only locale mode on fresh drafts. The broader locale-plumbing decision (H-2) remains ticketed.

### D6 — M-13 / M-14 / M-19

- `new-project.ts`: after clearing `memory/*.md`, write the canonical `memory/MEMORY.md` stub (same structure as `create-l3-scaffold.ts` — prevents the sync-md legacy-migration branch from firing).
- `propagate-to-templates.ts`: drop `!GOVERNANCE_L1 && !DOCS` from the encoding-gate condition so the CP949-corruption scan runs on every apply mode (these modes write the Korean-heavy governance docs).
- `sync-skills.ts` Phase 2: add `codexSkills` to the back-sync target list (four-mirror parity, ADR-0077 W1).

### D7 — Documentation batch

- `skills/upgrade-project/SKILL.md`: `--platform` values `claude|antigravity|codex|all` (default `all`), version pin v1.39.0, frontmatter 1.5.0→1.5.1, `last_reviewed` 2026-09-21 (C-2, H-10).
- `docs/project-upgrade-guide.md`: script pin → v1.39.0 (§2), repoint two promotion-guide links from `.agents` mirrors to `../skills/` (H-10, M-6).
- `docs/constitution/07-new-project.md` + `docs/variant-creation-workflow.md`: canonical `--variant` command form (H-5).
- `skills/create-variant/SKILL.md`: registry-accurate domain lists (`abap-development`, `safety`; drop `(custom)`, document the `collaboration` fallback), `--domain safety` example, OS-agnostic workspace-root wording, fix `docs/country-profiles.md` citation, all-six k-* wording, dedupe trigger, frontmatter 1.4.1→1.4.2 (H-8, M-7 partial, M-10 partial).
- Lifecycle records for touched skills: append phase-history rows (upgrade-project, create-variant, simulate-pipeline).

## 5. Acceptance Criteria

1. `grep -r "l2_propagate: false" templates/common/.claude/skills/simulate-pipeline/SKILL.md` matches; `swe-solve` absent from all `templates/common/` mirrors; `swe-solve` still present in `templates/co-develop/skills/`.
2. Fresh scaffold (E2E) contains no `l2_propagate: false` skill in any of the five skill bases; derivation and actual tree match (Test 26 green).
3. `bun scripts/test-runner.ts scripts` passes (incl. `test-scaffold-delivery-parity`, `test-new-project`).
4. Full baseline battery green: `review-baseline.ts` 6/6 (drift limited to tolerated gemini-settings overlays).
5. Upgrade `--dry-run` on an existing project runs the new sweep without errors; leaked skills are reported for removal.
6. All edited docs use the canonical `--variant` command form; `bun scripts/audit.ts` passes (language policy, links).
7. `bun scripts/spec-register.ts` shows this spec registered before `/sync`.

## 6. Accessibility & Preview Verification

Backend/scripts and CLI documentation only — no user-facing web/app UI is modified.
Accessibility section (ADR-0065) and rendered-preview verification (ADR-0070) are
**exempt** for this change set.

## 7. Risks

- Governance propagation may surface unrelated L0→L1 drift when regenerating `templates/common/AGENTS.md`; mitigated by dry-run inspection before apply.
- Moving the `.codex` mirror upgrade claim shifts delivery responsibility to the post-upgrade sync-skills run; mitigated by Phase 1/1b coverage (verified in `sync-skills.ts`) and the pre-existing 30s-timeout ticket (M-18).
- Deleting mirror orphans relies on propagation not re-adding non-SSOT skills; verified for `swe-solve` (absent from workspace mirrors and propagation sources).
