# Variant I18N Consolidation — Implementation Design

| Field | Value |
|-------|-------|
| Date | 2026-08-24 |
| Status | implemented |
| Governing anchor | [Constitution §4.4 — I18N Asset Suite](../constitution/04-i18n.md) |
| Related | [i18n-specialist suite design](2026-08-24-i18n-specialist-suite-design.md) (PR5 of the 5-part series), ADR-0060 (skill relationship graph) |

## Problem

PR5 landed the constitution §4.4 i18n asset suite (the `i18n-specialist` agent plus the `i18n-locale-config`, `i18n-formatting`, and `i18n-layout` common skills) holding the generalized i18n knowledge that previously existed only as scattered variant-local practice. That left two copies of several knowledge areas: the common suite as the intended source of truth, and the variant-local text that PR5 absorbed from. This PR (PR6) completes the series' consolidation step: variant-local copies that duplicate generalized i18n knowledge are slimmed into cross-references naming the owning common skill, while everything jurisdictional or house-style remains variant-local.

## Absorption Table

| Absorbed into common (landed in PR5) | Absorption source (variant) | What remains variant-local (not absorbed) |
|---|---|---|
| Units of measure, currency, notation, print-size rules | co-export skills, co-deck PROMOTION_CHECKLIST | HS classification, FTA origin, duty-refund workflows (jurisdictional) |
| Hangul font selection knowledge, A4/Letter print rules | co-deck | `download-font.ts`, paged-media pipeline (deck-specific tooling references) |
| Korean-scale numeral system (man/eok/jo) | co-news prose | financial-journalism-style house-style application rules |
| General encoding/RTL rules | constitution §4.4 one-line note | hwp-document-processing (co-consult document tool — reciprocal cross-reference only) |

## Per-Variant Decisions

### co-news — slimmed (1 skill)

**`financial-infographic-svg` 1.0.0 → 1.0.1** (`templates/co-news/skills/financial-infographic-svg/SKILL.md`). Step 4 previously carried the Korean-scale numeral system inline (the jo/eok/man definition with its trillion/hundred-million/ten-thousand Western equivalents) — exactly the system definition PR5 formalized in `i18n-formatting`. The step now keeps only the house-style application rule (apply Korean groupings when the article language is Korean, example rendering, never mix grouping conventions within a figure) and defers scale definitions and conversion rules to the common `i18n-formatting` skill via a plain-text constitution §4.4 reference. Mirrored to `.claude/` and `.gemini/` skill copies (co-news ships two platform mirrors), byte-identical.

Untouched by design: `financial-journalism-style` (pure house-style — Sedaily/TheBell register, headline and lead conventions; carries no numeral-scale system text), and the jo/eok/man application mentions in `agents/visual-editor.md`, `docs/co-news.context.md`, `docs/user-guide.md`, and `docs/countries/KR.md` — those are application rules or country-profile content protected by the absorption table.

### co-deck — slimmed (1 skill)

**`design` 1.2.0 → 1.2.1** (`templates/co-deck/skills/design/SKILL.md`). The Fonts subsection's recommended-font list (MaruBuri serif; NanumSquareNeo/Pretendard sans-serif) duplicated the Hangul font selection knowledge absorbed into `i18n-layout`. The list is replaced with a cross-reference to `i18n-layout` (selection knowledge) while explicitly keeping the deck tooling boundary — font download and TTF wiring stay in `prep-pdf` → `download-font.ts`, matching `i18n-layout`'s own boundary note. The unified Korean+English font recommendation and the record-URL/TTF-path step (operational `design_spec.md` content) remain. Mirrored to `.claude/`, `.gemini/`, and `.agents/` skill copies, byte-identical.

Untouched by design: A4/Letter print rules exist in co-deck only as script defaults and `pdf_layout_spec.json` geometry (paged-media pipeline — protected tooling), so there is no skill prose to slim; the PROMOTION_CHECKLIST carries no i18n content; and the UTF-8/CP949/BOM enforcement notes in `html-build` and related files are operational Windows safeguards tied to the deck file pipeline, not the generalized encoding rules absorbed from the constitution §4.4 note.

### co-consult — reciprocal cross-reference (1 skill)

**`hwp-document-processing` 2.0.0 → 2.0.1** (`templates/co-consult/skills/hwp-document-processing/SKILL.md`). Per the absorption table's fourth row, the only change is a reciprocal pointer: `i18n-layout`'s HWP section already routes document procedures here, and this skill's Related Skills section now routes general text encoding, RTL/bidi, and script-font layout rules back to `i18n-layout`. All HWP/HWPX procedure content is unchanged. Mirrored to all three platform skill copies, byte-identical.

### co-hr — surveyed, no-op

The survey (units/currency/paper size, fonts, encoding, RTL, numeral scales, timezone, date/number formats across `skills/`, `docs/`, `agents/`, `AGENTS.md`) found no generalized i18n knowledge duplicated by the common suite. The apparent hits are HR-pipeline metrics (unrelated) and the `docs/countries/KR.md` currency/timezone lines (country-profile jurisdiction content, not generalizable formatting rules). No edits; no version bumps.

### co-export — surveyed, no-op (survey finding)

The absorption table names co-export skills as the absorption source for units-of-measure/currency/notation/print-size practice, but the on-disk survey found no such generalized text anywhere in `skills/`, `agents/`, or `docs/`: the trade skills carry only jurisdictional workflow content (HS/FTA/drawback/Incoterms/L-C terms), and `docs/countries/KR.md`'s date/timezone row is country-profile content. The practice PR5 absorbed ("export documentation per destination country's standard") was implicit variant practice, never documented variant-locally — so there is nothing to slim. No edits; no version bumps. All jurisdictional workflow content is untouched, per the table's must-remain column.

## Registrations

| Site | Change |
|------|--------|
| Variant SKILL.md mirrors | 8 mirror copies updated byte-identical (co-news x2, co-deck x3, co-consult x3) |
| `variant.json` skill manifests | No change — no slimmed skill's description changed materially (bodies only) |
| Variant `SKILLS.md` catalogs | No change — catalogs carry no version column and no changed description text |
| `docs/skill-graph.json` / `docs/skill-graph.md` | Regenerated: 202 nodes (unchanged — no skills added or deleted), 525 → 529 edges (4 new `references` edges from the prose cross-references: design → i18n-layout, design → prep-pdf, financial-infographic-svg → i18n-formatting, hwp-document-processing → i18n-layout) |
| `docs/specs/registry.json` | This design registered (status: implemented) |

## Verification

| Check | Result |
|-------|--------|
| `bun scripts/audit.ts` | pass |
| `bun scripts/validate-templates.ts` | 0 errors (2 pre-existing co-deck WARNs) |
| `bun scripts/verify-skill-graph.ts` | exit 0 — 202 nodes, 529 edges |
| `bun scripts/verify-adr-governance.ts --strict` | pass |
| `bun scripts/verify-scripts.ts --check-drift` | 0 warnings |
| `bun scripts/validate-md-language.ts` | exit 0 |

## Deviations

- **co-export no-op**: expected by the absorption table to be a slimming source; the survey found no generalized duplication on disk (see Per-Variant Decisions). Documented rather than fabricating an edit.
- **No `variant.json` edits**: instruction made manifest sync conditional on a material description change; all three slims changed body text only, so the manifests remain accurate as-is.

## Out of Scope / Follow-ups

- None specific to this PR. The PR7 marker-rewrite engine may later automate propagation of these cross-reference sentences into variant forks; until then the sentences are plain prose, safe under current propagation rules.
