# Meeting Transcript
**Date**: 2026-06-04
**Topic**: ADR gap analysis and AGENTS.md multilingual policy / Tier rules variant propagation review
**Participants**: architect, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Background (Pre-meeting findings)

- Existing ADRs: 0001, 0012, 0013, 0020, 0021, 0022, 0023
- Missing ADRs: skill scope system, rootAllowlist, SCRIPTS.md L1→L2 propagation, co-consult variant creation, Check A formal-only policy
- AGENTS.md root `### Korean Translation Zones`: absent in ALL 5 variants
- AGENTS.md `**Tier Adjustment Rules**`: present in root AND all variants ✅
- `Language Policy` section: entirely missing from all variants
- `audit.ts` already recognizes 15 language codes; AGENTS.md only mentions Korean

---

## Transcript

**[Architect]** (Round 1)

Two structural problems. First, the ADR gap: skill `scope` system and `rootAllowlist` are governance architecture changes, not bugfixes — both require ADRs. New variant creation also lacks an ADR defining addition criteria, file structure requirements, and template versioning impact. Current `templates/VERSION` has no policy for which semver component a variant addition triggers.

Second, "Korean Translation Zones" is a misnomer — the section needs to be redesigned as `Translation Zones (Locale Exceptions)` with generalized patterns (`<lang-code>/`, `locales/<lang-code>/`) rather than hardcoded `ko/` and `locales/ko/`. To automation-engineer: how does `validate-md-language.ts` implement the current rule? Changing the policy requires the script to change too.

**[Automation-Engineer]** (Round 1)

`validate-md-language.ts` (@version 1.2.0) hardcodes `ko/` and `locales/ko/` as exceptions. For multilingual generalization, the language code list should live in `workspace-schema.json` — matching the pattern already used by `audit.ts`. Key finding: `audit.ts` output already shows `I18N locale files excluded: 15 language codes (ko, ja, zh-CN, zh-TW, de, es, fr, pt, vi, ms, id, th, ru, it, ar)`. The tool already knows 15 languages; only the documentation is wrong.

On ADR batching: grouping related decisions reduces ADR sprawl. Propose: ADR-0024 (skill governance), ADR-0025 (root protection), ADR-0026 (variant creation + template versioning). Check A formal-only → amendment to ADR-0001.

On AGENTS.md propagation: `publish-to-template --docs` propagates CLAUDE.md/GEMINI.md common sections using `<!-- COMMON-X:START/END -->` markers, but AGENTS.md is not in the propagation target list. Design decision needed: marker-based automation vs. manual management?

**[Architect]** (Round 2)

The audit.ts/AGENTS.md mismatch is a "tool knows more than docs" failure — immediate fix category. Agree on three new ADRs.

For AGENTS.md common section automation: apply the same marker pattern. `Language Policy` and `Tier Adjustment Rules` are universal and should be wrapped in `<!-- COMMON-AGENTS:START/END -->` markers. `Agent Roster` and `Skills` sections are variant-specific and excluded from markers. Adding AGENTS.md to `publish-to-template --docs` `docPairs` array targets all 5 variants.

Template version policy for variants: variant addition = `templates/VERSION` minor bump; agent addition within variant = patch; variant deletion = major. Document in ADR-0026 and add validation to `tag-template.ts`.

**[Automation-Engineer]** (Round 2)

AGENTS.md marker approach confirmed feasible: ~15 lines added to `publish-to-template.ts` reusing `replaceCommonSection()`. The `docPairs` array needs AGENTS.md entry targeting all 5 variants (vs. CLAUDE.md's 4). Language Policy change: `workspace-schema.json` needs `i18n.locale_codes` array; `validate-md-language.ts` reads it instead of hardcoding `ko`. Priority order: ①AGENTS.md fixes + propagation, ②ADR writing, ③validate-md-language generalization.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | Medium | Write ADR-0024 — skill governance (scope field, publish-to-template filter, SCRIPTS.md propagation) | Phase 1 |
| A-02 | architect | Medium | Write ADR-0025 — workspace root protection (rootAllowlist, tests/ enforcement) | Phase 1 |
| A-03 | architect | Medium | Write ADR-0026 — variant creation procedure and template version policy | Phase 1 |
| A-04 | architect | Low | Update ADR-0001 — add Check A formal-only policy note | Phase 1 |
| A-05 | automation-engineer | Medium | Update root AGENTS.md Language Policy section: rename to "Translation Zones (Locale Exceptions)", generalize patterns, add `<!-- COMMON-AGENTS -->` markers | Phase 1 |
| A-06 | automation-engineer | Medium | `publish-to-template.ts` — add AGENTS.md to --docs propagation (all 5 variants) | Phase 2 (after A-05) |
| A-07 | automation-engineer | Low | `validate-md-language.ts` — replace hardcoded `ko` with `workspace-schema.json` locale_codes | Phase 2 |
| A-08 | automation-engineer | Low | `workspace-schema.json` — add `i18n.locale_codes` array (15 language codes) | Phase 1 (before A-07) |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | All 5 variants have Language Policy section with multilingual content after A-06 | Run `bun run publish-to-template -- --docs` and inspect variant AGENTS.md |
| C-02 | ADR-0024/0025/0026 exist in docs/adr/ with Status: Accepted | ls docs/adr/ |
| C-03 | `validate-md-language.ts` accepts `ja/`, `zh-CN/` directories without false positives | Place test .md in `ja/` dir, run validate-md-language.ts |
| C-04 | `bun scripts/audit.ts` passes after all changes | Run full audit |
