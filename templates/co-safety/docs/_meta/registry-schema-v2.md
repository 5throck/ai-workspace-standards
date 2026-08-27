# Regulation Registry Schema v2 (mode: coordinates)

## Purpose

Architecture decision **2026-08-26, user-approved Model A (live-primary)**: law-info
caches must not store substantive content. All content bugs traced that day (phantom
OSHA-KR Art 243, deleted HPGSCA Art 14, wrong SAPA Art 2 summary) were cached-prose
errors. Therefore:

> **Agents cite coordinates only. Content comes from the k-law live API (법제처)
> at point of use.**

`regulations/KR/*.yaml` files are coordinate registries: law ↔ MST ↔ valid article
numbers ↔ official article titles ↔ last-checked date. They answer "does Art N exist
and what is it called?", never "what does Art N say?".

## Field contract

| Field | Type | Meaning |
|-------|------|---------|
| `schema_version` | int | `2` |
| `mode` | string | `coordinates` |
| `law_name` / `law_name_en` / `abbreviation` | string | Official law identity |
| `mst` | string\|null | 법제처 법령일련번호; `null` until first k-law live pull fills it |
| `enforced_from` | string\|null | Effective date if known; `null` otherwise |
| `agency` / `tier` / `framework` / `jurisdiction` / `regulator` | string | Identity + authority metadata (legacy `source_mcp` fields were removed 2026-08-26; `scripts/safety-audit.ts` v4.10.1+ validates `source_verification` on coordinate-mode files instead) |
| `articles[]` | list | `{ no, title, checked_at }` — flow style, one line per article |
| `related_rule` / `related_decree` / `domain_sub_variants` | block | Cross-law pointers and narrowing files (unchanged from v1) |
| `structure_note` | string (optional) | Chapter ↔ article-range map (coordinates, kept) |
| `source_verification` | block | `method` (honest provenance), `checked_at`, optional `next_review` |
| `last_updated` | date | Required — 90-day staleness reader in `scripts/safety-audit.ts` |

## Conversion rules

**Dropped** (git history preserves): all `topic_en` substantive summaries; multi-sentence
요약/설명/verification-note prose in `description`; parenthetical disambiguation clauses on
titles ("NOT X" guards, explanatory lists). Kept only where ≤2 tokens and purely
identifying: scope tags `(건설)`, factual parameters `(3년 보존)`, annex coordinates
`(시행규칙 별표18)`, acronym aliases `(LOTO)`.

**Kept**: article-number sets, official-style Korean titles (shortened to labels),
related_rule/decree mappings, domain_sub_variants, structure_note, machine-read fields
(`last_updated`; legacy `source_mcp` dropped 2026-08-26). Article-level factual remarks (e.g., "deleted 1999.2.8")
may remain as coordinates-adjacent facts.

## Migration status

| Scope | Files | Status |
|-------|-------|--------|
| Pilots (this change) | OSHA-KR.yaml, SAPA.yaml | ✅ Converted 2026-08-26 |
| KR law registries remaining | 44 of 44 tracked by `scripts/safety-audit.ts` (WARN-only progress counter) | ✅ All converted 2026-08-26 (pending OC key for k-law live pulls — Phase 4 fills `mst`) |
| Out of scope | legal-glossary.yaml (terminology), industry-regulatory-anchors.yaml (anchor table), regulations/international/* | Deferred |

## Citation rule

Workflow/evidence `legal_basis` entries cite `LAW-ABBREV Art.N` only. Any agent needing
article text resolves it via k-law live at the moment of use and must not persist the
text or a paraphrase into caches, registries, or evidence records.
