# HPGSCA Statute-Name Consistency Sweep (PR #97)

**Date**: 2026-08-07
**Agent**: compliance-agent
**Scope**: Convert short-form `고압가스안전관리법` FORMAL CITATION strings (with article numbers, in `legal_basis`/enum/list/table contexts) to the long form `고압가스 안전 관리 및 사업법` across evidence-models, regulations, industry-profiles, agents, and docs — extending the #93–#96 long-form convention to remaining file types. Casual prose, identifier keys, and legalize_kr lookup keys are LEFT as-is.

## Canonical rules applied
- **LONG form (formal citations)**: `고압가스 안전 관리 및 사업법 (HPGSCA) Article N` / `… Art.N`
- **Short form LEFT as-is in**: YAML dict keys / identifiers, legalize_kr lookup keys, casual prose mentions, prose `description`/explanatory fields.
- **Art 14 = DELETED (1999.2.8)** — replaced per industry canonical set → **Art 13** (facility/container safety maintenance, 시설·용기의 안전유지), matching the gasterm workflow precedent and `legal-glossary.yaml` verified topic.

## Area A — evidence-models/*.json (14 files converted)

### gasterm evidence-models (11 files) — name conversion + completion-inspection article alignment
All 11 gasterm record files had `legal_basis.examples` arrays with short-form citation values. Name converted to long form. `description` prose fields (line ~100/120/150/163/208 etc.) LEFT as-is (casual prose).

| File | Action |
|------|--------|
| gasterm-charging-operation-record.json | Name only (Art 22-2 / 28 / 17 → long form) |
| gasterm-completion-inspection-record.json | **Name + article alignment** to schema (Art 28→13, Art 17→13; schema canonical = Art 22-2 + Art 13) |
| gasterm-construction-permit-overview-record.json | Name only |
| gasterm-emergency-preparedness-record.json | Name only |
| gasterm-hazardous-zone-record.json | Name only |
| gasterm-inspection-record.json | Name only |
| gasterm-leak-detection-record.json | Name only |
| gasterm-mid-construction-inspection-record.json | Name only |
| gasterm-pipe-transfer-record.json | Name only |
| gasterm-pre-construction-review-record.json | Name only |
| gasterm-tank-storage-record.json | Name only |

> **Secondary observation (template-vs-schema drift)**: the 10 name-only files above use a generic template (Art 22-2 / 28 / 17) that does NOT match their workflow-specific `schema.yaml` articles (e.g. charging-operation schema = Art 13 only; emergency-preparedness = Art 26; tank-storage = Art 13+15). Art 28 and Art 17 are valid in-force articles (not deleted), so per task rule ("do not change article numbers unless clearly wrong") they were name-converted only. Only completion-inspection was article-aligned (the explicit example in the task). If deeper per-workflow example alignment is desired, a follow-up pass can re-map each evidence-model's example articles to its schema's canonical set.

### Functional / shared evidence-models (3 files) — name conversion
| File | Line | Action |
|------|------|--------|
| _shared/tbm-record.json | 141 | `고압가스안전관리법 Art.17` → long form |
| domains/functional/psm/psm-pssr-record.json | 42 | `고압가스안전관리법 Article 22-2 …` → long form |
| domains/functional/asset-integrity/equipment-integrity-record.json | 91 | `고압가스안전관리법 Article 17` → long form |

## Area B — regulations/KR/*.yaml (1 converted, 2 left-as-key/prose)

| File | Action | Reason |
|------|--------|--------|
| High-Pressure-Gas-Safety.yaml | **Converted** line 33 (`kgs_code_delegation.description`: `…제22조의2에 따라…`) | Formal citation with article number → long form |
| High-Pressure-Gas-Safety.yaml line 23 | LEFT | legalize_kr lookup key in verification comment |
| industry-regulatory-anchors.yaml | LEFT (4 hits) | All legalize_kr lookup keys in `verification.verified_via` comments + 1 `get_law_metadata(...)` call in impact note. Already remediated in #93. |
| legal-glossary.yaml | LEFT (1 hit, line 211) | Top-level dict KEY `고압가스안전관리법:` — canonical glossary identifier AND legalize_kr lookup key. Sub-entries use bare `제N조` (no statute-name prefix), so no formal citation STRING with short name exists. |

## Area C — industry-profiles, agents, docs (13 converted, 3 left-as-prose/identifier)

### industry-profiles/*.yaml (5 files converted)
All hits were formal `legal_basis` array entries with article numbers. Long-form conversion applied; deleted Art 14 → Art 13.

| File | Hit | Action |
|------|-----|--------|
| logistics-port.yaml:13 | Article 14 | → long form + **Art 14 → 13** |
| steelmaking-heavy.yaml:12 | Article 17 | → long form (Art 17 ok) |
| defense-aerospace.yaml:13 | Article 14 | → long form + **Art 14 → 13** |
| defense-aerospace.yaml:23 | Article 14 | → long form + **Art 14 → 13** |
| semicon-cleanroom.yaml:11 | Article 14, 17 | → long form + **Art 14 → 13** (17 kept) |
| semiconductor.yaml:14 | Article 14 | → long form + **Art 14 → 13** |

### agents/domains/industry/*-agent.md (4 converted, 1 left-as-prose)
Formal citation lines (Primary Laws list, with article numbers) converted; prose policy blockquote lines (no article number) LEFT.

| File | Converted (formal) | Left (prose) |
|------|-------------------|--------------|
| defense-agent.md | L23 Art 14→13 | L28 policy blockquote |
| logistics-agent.md | L23 Art 14→13 | L28 policy blockquote |
| semicon-agent.md | L21 Art 14→13 (17 kept) | L29 policy blockquote |
| steelmaking-agent.md | L22 Art 17 (name only) | L28 policy blockquote |
| gasterm-agent.md | — | L11 frontmatter `description` (casual prose, no article) |

### docs/_shared/domain-classification-guide{,_ko}.md (2 files LEFT ENTIRELY)
Both files list the statute name in classification TABLE cells WITHOUT article numbers (e.g. `| semicon | … | 고압가스안전관리법 (HPGSCA), 화학물질관리법 (CCA), … |`). Per task rule ("formal citation lists/tables WITH article numbers"), these statute-name-only identifier cells are NOT formal citations → **left as-is** (identifier-list, no article-number citation).

### docs/domains/industry/*/scope.md (4 files converted)
All 4 scope files had formal "Key Laws & Regulations" citations with deleted Art 14. Converted + Art 14→13.

| File | Action |
|------|--------|
| steelmaking/scope.md:13 | → long form + Art 14 → 13 |
| semicon/scope.md:13 | → long form + Art 14 → 13 |
| logistics/scope.md:14 | → long form + Art 14 → 13 |
| defense/scope.md:14 | → long form + Art 14 → 13 |

## Art 14 residuals — FOUND and remediated (12 citations)

The task noted "the prior passes should have cleared these — flag if found." 12 deleted-Art-14 citations were found across 9 files (these file types were NOT in scope for #93–#96, so the defect persisted). All replaced with **Art 13** (facility/container safety maintenance — the canonical facility-safety article, verified in-force in `legal-glossary.yaml` line 217, and the dominant article in gasterm workflow schemas):

| # | File | Context | Replacement rationale |
|---|------|---------|----------------------|
| 1 | industry-profiles/logistics-port.yaml | Cold-storage NH3 refrigerant HP gas facility | Art 13 (facility safety maintenance) |
| 2 | industry-profiles/defense-aerospace.yaml (legal_basis) | Cryogenic LN2/LOX + HP gas facility | Art 13 |
| 3 | industry-profiles/defense-aerospace.yaml (applicable_laws) | Same | Art 13 |
| 4 | industry-profiles/semicon-cleanroom.yaml | "Article 14, 17" | Art 13 (17 kept) |
| 5 | industry-profiles/semiconductor.yaml | Specialty gas facility | Art 13 |
| 6 | agents/.../defense-agent.md | Cryogenic fuel / HP gas facility | Art 13 |
| 7 | agents/.../logistics-agent.md | Cold-storage NH3 refrigerant | Art 13 |
| 8 | agents/.../semicon-agent.md | "Article 14 & 17" | Art 13 (17 kept) |
| 9 | docs/.../steelmaking/scope.md | Byproduct gas facility | Art 13 |
| 10 | docs/.../semicon/scope.md | Specialty gas facility | Art 13 |
| 11 | docs/.../logistics/scope.md | Cold-storage refrigerant | Art 13 |
| 12 | docs/.../defense/scope.md | Cryogenic / HP gas facility | Art 13 |

No other deleted-Art-14 citations remain in scope (powergen and steelmaking workflow residuals previously flagged in `compliance-2026-08-07-codebase-hpgsca-remediation.md` were verified cleared — no matches in those trees).

## Out-of-scope archival / historical (NOT edited — 3 explicit + historical records)

| File | Reason left |
|------|-------------|
| docs/_meta/archive/code-graph/v4.0-playbook-2026-06-06.md | ARCHIVE |
| docs/superpowers/plans/2026-07-05-gasterm-construction-permit.md | Dated planning doc (historical record) |
| docs/superpowers/specs/2026-07-05-gasterm-construction-permit-design.md | Dated spec (historical record) |
| CHANGELOG.md | Historical changelog record |
| memory/findings/*.md (6 files) | Historical findings records from prior PRs — editing would falsify history |
| workflows/.../silane-gas-leak-response/README{.en,}.md | legalize_kr lookup keys (rule b); workflow files outside this sweep's scope |
| workflows/_shared/tbm/README.md | Casual prose example list (rule c) |
| AGENTS.md:357 | Glossary table identifier row (no article number) |

## Audit results
- `bun scripts/co-safety/safety-audit.ts` → **exit 0** (872 files checked, 0 errors)
- `bun scripts/audit.ts` → **exit 0** (all checks passed: agents, skills, scripts, memory, safety-os, language, parity)

## Counts
- **Files converted** (formal citations → long form): **28**
  - evidence-models: 14 · regulations/KR: 1 · industry-profiles: 5 · agents: 4 · docs/domains/scope: 4
- **Files left as prose/identifier** (in-scope, no formal citation): **5**
  - industry-regulatory-anchors.yaml · legal-glossary.yaml · gasterm-agent.md · domain-classification-guide.md · domain-classification-guide_ko.md
- **Archival/historical skipped**: 3 explicit + CHANGELOG + 6 prior findings files
- **Art-14 residuals remediated**: 12 citations across 9 files
- **Article alignments** (beyond name): completion-inspection evidence-model (Art 28→13, Art 17→13) to match schema
