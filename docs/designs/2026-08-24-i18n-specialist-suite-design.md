# I18N Specialist Suite — Implementation Design

| Field | Value |
|-------|-------|
| Date | 2026-08-24 |
| Status | implemented |
| Governing anchor | [Constitution §4.4 — I18N Asset Suite](../constitution/04-i18n.md) |
| Related | ADR-0060 (skill relationship graph), ADR-0061 (decision chain), PR4 of the 5-part design series (§4.4 anchor + `translate` trigger removal) |

## Problem

Constitution §4 reserved an i18n asset suite (agent + three skills) in `templates/common/` but shipped none of it in PR4 — PR4 landed only the normative §4.4 anchor and removed the `localize` trigger from the `translate` skill so locale-configuration requests would stop routing to a file-translation helper. Until the suite lands, those requests have no routing target, and locale guidance (collation, Korean-scale numerals, paper sizes, encoding hazards) exists only as scattered variant practice.

## What Was Built

### New common agent (v1.0.0)

**`i18n-specialist`** (`templates/common/agents/i18n-specialist.md`) — localization review, locale configuration, internationalization routing. Contains the three-skill routing table, a Legal & Trade Routing section (jurisdictional workflows route to domain experts: trade compliance → co-export, labor law → co-hr, industry expertise → co-consult; the specialist never owns jurisdictional advice), the country ≠ language principle (§4.3), and the PM-only invocation pattern. Includes the `Meeting Participation` and `Dispatch Protocol` sections required for variant propagation, and declares `required_skills: [i18n-locale-config, i18n-formatting, i18n-layout]`. No `lifecycle:` frontmatter (forbidden at the L1 common layer).

### New common skills (v1.0.0 each, scope: common)

1. **`i18n-locale-config`** — BCP 47 locale ID structure (language/Script/REGION/variant, case rules), the language ≠ country doctrine (`zh-CN`/`zh-TW` warning), per-language collation via `Intl.Collator` (greenfield — no collation guidance existed anywhere in the workspace; Korean ganada order vs code-point order, `numeric` option), timezone handling (IANA names, per-locale display), and the region/language matrix over the 16 supported locales.
2. **`i18n-formatting`** — date/time notation (ISO 8601 interchange, per-locale display), number separators, currency (ISO 4217 interchange vs locale display), units of measure (metric vs imperial, greenfield), Korean-scale numerals (man 10^4 / eok 10^8 / jo 10^12 — formalized from co-news prose practice, fully romanized), print paper sizes (A4 vs US Letter — absorbed from co-deck/co-export practice).
3. **`i18n-layout`** — character encoding (UTF-8 default, CP949/EUC-KR legacy hazards, BOM pitfalls phrased generically from a real ops lesson), line endings, RTL/bidi (`ar`, `dir="rtl"`, logical vs visual ordering, LTR-run isolation), script-specific fonts (Hangul selection knowledge absorbed from co-deck practice; font pipeline/tooling stays in co-deck's `design`/`theme-authoring` skills, cross-referenced), and an hwp pointer to co-consult's `hwp-document-processing` skill (cross-reference, not duplication).

All three skills carry zero Hangul — Korean terms are romanized (ganada, man/eok/jo) per the English-only documentation policy.

### Registrations

| Site | Change |
|------|--------|
| `templates/common/skills/` + `.claude/` + `.gemini/` + `.agents/` mirrors | Three skills created at all four roots, mirrors byte-identical |
| `docs/templates/common-contract.json` | 3 `common_skills` entries + `i18n-specialist` `common_agents` entry (contract 1.3.0 → 1.4.0) |
| `templates/common/skills/SKILLS.md` | Three registry rows |
| `docs/templates/common.lifecycle.json` | History entry + version 1.2.0 → 1.3.0 |
| `templates/common/AGENTS.md` | i18n-specialist rows in §1 Agent Roster and §4.1 Subagent Roster (outside VARIANT markers — common asset, same placement as PM) |
| `docs/skill-graph.json` / `docs/skill-graph.md` | Regenerated: 199 → 202 nodes, 513 → 525 edges |

### Deliberate non-registrations

- **`country_scoped_assets`**: none of the three skills registered — they are language-scoped, and §4.3 forbids language-scoped assets in the country-scoped registry (reserved for jurisdiction-specific data access).
- **Root `AGENTS.md`**: not modified — it indexes L0 workspace agents (`agents/*.md` at root); i18n-specialist is an L1 common agent.
- **`docs/workspace-schema.json`** (both copies): not modified — the schema's `agent_manifest` describes the variant.json extension key, not a roster of common agents; no common-agent registry exists there.
- **Agent platform mirrors**: not created — no `.claude/agents/` mirror convention exists for common agents (skills only).

## Verification

| Check | Result |
|-------|--------|
| `bun scripts/audit.ts` | pass |
| `bun scripts/validate-templates.ts` | 0 errors (2 pre-existing co-deck WARNs) |
| `bun scripts/verify-skill-graph.ts` | exit 0 — 202 nodes |
| `bun scripts/verify-adr-governance.ts --strict` | pass |
| `bun scripts/verify-scripts.ts --check-drift` | 0 warnings |
| `bun scripts/validate-md-language.ts` | exit 0 |

## Deviations

- **203 vs 202 graph nodes**: the suite adds 3 skill nodes; the i18n-specialist agent does not become a node because `generate-skill-graph.ts` discovers agents only from L0 `agents/` and `templates/co-*/agents/` — `templates/common/agents/` is not scanned. Extending the generator is a scripts change (version bump + SCRIPTS.md row) out of this PR's scope; proposed as a PR7 follow-up alongside the marker-rewrite engine.

## Out of Scope / Follow-ups

- Variant integration (absorbing per-variant i18n practice into the suite, slimming variants, `variant.json` skill manifests) — PR6 of the design series.
- Common-agent discovery in the skill graph generator — see Deviations.
