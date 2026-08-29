# Skill Relation Graph Evolution + Decision Chain Validator + I18N Audit Consolidation

| Field | Value |
|-------|-------|
| Date | 2026-08-29 |
| Status | accepted (user-approved plan; items re-scoped after re-exploration) |
| Spec ID | `reledgev` |
| Governing anchors | [ADR-0060](../adr/0060-skill-relationship-graph-generated-projection.md) (+ Amendments 3–6), [ADR-0061](../adr/0061-decision-record-standard.md), [ADR-0063](../adr/0063-procedure-schema-canonical-workflow-source.md) |
| Related designs | `2026-08-28-skill-graph-typed-relations-design.md`, `2026-08-29-procedure-schema-design.md`, `2026-08-29-procedure-coverage-and-l0-design.md`, `2026-08-24-decision-chain-standard-design.md` |

## 1. Problem Statement

Five user-requested areas were re-examined after the Procedure Schema v1.0 and typed
relations work landed. The current graph (542 nodes / 1,343 edges; node types
skill/agent/adr/decision/procedure/output_type) already covers most of the original
vision. The remaining gaps, per area:

1. **Relation flexibility (ADR-0060 evolution).** The typed relation vocabulary
   (`follows`/`enables`/`composes_with`) is piloted on only 4 co-consult skills.
   L0 `skills/` (28 skills) carries **zero** explicit relation metadata.
   `schemas/skill.schema.json` tolerates `relates_to`/`inputs`/`outputs` only via
   `additionalProperties: true` — they are not defined, so tooling cannot rely on
   them. The user's core constraint: **relations are not permanent** — they must be
   addable/removable without frontmatter churn.
2. **Decision chain (ADR-0061).** The Agent→Skill→Knowledge→Evidence→Rule→Decision
   structure is defined and partially operating (4 DEC records, evidence ledger with
   4 rows, `audit.ts` soft-check). Gaps: no fail-closed validator; `rules_applied`
   registries exist only in co-news (`NEWS-R1`); DEC→graph linkage is thin
   (`cites_skill` 3 edges).
3. **Variant commonization** — **explicitly excluded from this PR** by user decision.
   Recorded in §7 Deferred.
4. **Doc auto-regeneration** — design-only in this PR (§6); implementation deferred.
5. **I18N consolidation.** `templates/common` already owns `i18n-specialist` +
   `i18n-locale-config`/`i18n-formatting`/`i18n-layout`, which cover the requested
   areas (encoding, collation, notation, currency, timezone, paper size, units).
   co-price independently grew `i18n-audit` (16-locale parity, glossary, parity
   certificate) — duplicative audit capability that belongs in common, with co-price
   retaining a variant-specific override.

## 2. Design Principles (carried forward)

- **INV-1 (derived artifact)**: `docs/skill-graph.json` is generated; YAML/markdown
  frontmatter + overrides are canonical. Never edit the graph to change relations.
- **All edges advisory** (ADR-0060): relations inform routing/planning; they never
  gate execution by themselves.
- **Adopt incrementally**: mass migration of ~160 variant skills remains a separate
  future effort (per the typed-relations design); this PR extends adoption to L0 and
  formalizes the contract, not the migration.

## 3. Relation Flexibility — Three-Layer Model (Normative)

> **Implementation status (2026-08-29, same-day follow-up)**: this section is fully
> implemented — per-scope overrides files (`generate-skill-graph.ts` v1.7.0 reads
> `templates/<scope>/docs/skill-graph.overrides.json`), `suppress: true` removal
> markers, and fail-closed `reason`/`since` enforcement with the 90-day warning
> (`verify-skill-graph.ts` v1.5.0). Recorded as ADR-0060 Amendment 6 §D.

| Layer | Location | Persistence | Use for |
|-------|----------|-------------|---------|
| L-A Explicit | `relates_to` in SKILL.md frontmatter (typed `{skill, type}` form) | Permanent by intent | Stable, reviewed relations; `provenance` on derived edges |
| L-B Experimental | `docs/skill-graph.overrides.json` `edges[]` | Ephemeral by intent | Candidate relations under evaluation; cross-layer edges that would create ownership coupling; **removal** of an unwanted frontmatter-derived edge during a transition |
| L-C Projection | `docs/skill-graph.json` | Always regenerated | Read-only consumers; determinism-checked by `verify-skill-graph.ts --determinism` |

**Override rules (L-B, normative):**
1. An override edge may add an edge not derivable from frontmatter, or suppress a
   frontmatter-derived edge (marker: `{"suppress": true, ...target edge identity}`).
2. Every override entry MUST carry `reason` and `since` (date). Overrides without a
   reason are a verifier error.
3. Promotion path: experimental override → reviewed → either promoted into
   frontmatter (L-A) and the override deleted, or dropped. Overrides are a waiting
   room, not a second home; the verifier warns when an override is older than 90 days.
4. Never edit the graph JSON to realize an override (INV-1).

### 3.1 Schema formalization

`schemas/skill.schema.json` gains explicit definitions (still optional):

- `relates_to`: array; entries are either **all** strings (legacy) or **all**
  objects `{skill: string, type: enum[relates_to, composes_with, follows, enables]}`
  — mixed arrays are rejected by `parseRelatesTo()` (schema layer notes the rule;
  JSON-Schema draft-07 cannot express "homogeneous array of union", so the
  validator enforces it).
- `inputs`, `outputs`: arrays of opaque label strings (per typed-relations design).

### 3.2 L0 adoption (this PR)

Typed `relates_to` is added to L0 lifecycle/governance skills, centered on the L0
procedure chain (`create-variant → promote-variant → project-to-variant →
upgrade-project`, per `2026-08-29-procedure-coverage-and-l0-design.md`), plus
high-confidence governance pairings. Skills without a defensible relation get none —
relations are earned, not distributed for coverage optics. See §8 for the exact set.

### 3.3 Deferred (Phase 2+)

- Mass migration of variant skills to typed form (4 co-consult skills remain the
  variant-side proof-of-concept).
- `suggest-skill-relations.ts`: similarity/heuristic candidate edges proposed **into
  overrides** with confidence, human-curated into frontmatter. Design sketch:
  inputs = SKILL.md descriptions + triggers + produces/consumed output labels +
  procedure co-occurrence; outputs = override-file patch proposals; never writes
  frontmatter directly.

## 4. Decision Chain Hardening

**Current state re-verified**: 4 DEC records (2 new on 2026-08-29), all `accepted`
with complete frontmatter; `audit.ts` soft-check implemented; evidence ledger static
at 4 rows; only co-news has a Rule ID registry.

This PR adds **`scripts/validate-decisions.ts`** (fail-closed), complementing — not
replacing — the `audit.ts` soft-check:

| Check | Level |
|-------|-------|
| Required frontmatter: `id`, `date`, `agent`, `decision`, `alternatives`, `status` | error |
| `status` ∈ {proposed, accepted, superseded}; `id` matches `DEC-YYYYMMDD-NN` and equals filename stem | error |
| `evidence_refs[]` ⊆ ledger row IDs in `docs/evidence/ledger.md` | error |
| `knowledge_refs[]` files/dirs exist | error |
| `rules_applied[]` match `^[A-Z0-9]+-R\d+$` (known-registry match is a warning until registries roll out) | warn |
| `skills_used[]` resolves to a known skill (L0 `skills/` or any `templates/*/skills/`); unresolved → warn (variant-scoped skills are legitimately unknown at L0) | warn |
| DEC without any of `evidence_refs`/`rules_applied`/`skills_used` → warn (encourages chain completeness, does not block rulings that genuinely cite none) | warn |

Parsing: `js-yaml` `load()` with fallback to the shared legacy line parser on
`YAMLException` (same pattern as `parseFrontmatter()` in the graph generator, which
already tolerates the two 08-25 DEC records' non-strict YAML prose).

**Deferred**: Rule-ID registry rollout across the other 12 variants and evidence-ledger
operating cadence — variant-by-variant per ADR-0061's implementation table; not a
mechanical change this PR can make safely.

## 5. I18N Audit Consolidation

Coverage matrix against the user's requested areas (all in `templates/common`):

| Area | Covered by |
|------|-----------|
| 문자 인코딩/레이아웃 (UI/UX), RTL | `i18n-layout` |
| 언어(국가/지역), 언어별 정렬(collation), 타임존 | `i18n-locale-config` |
| 표기법(날짜/숫자/통화), 도량형, 종이 사이즈(A4/Letter) | `i18n-formatting` |
| 번역 | `translate` |
| 법률/규제, 무역/통상 | routing only — `i18n-specialist` → jurisdiction agents (co-export/co-hr), country-scoped skills (`k-law`, `k-dart`, `k-kosis`) per ADR-0057/0058 |
| 감사(parity/glossary) | **gap → new common `i18n-audit`** (this PR) |

Changes:
1. **New common skill** `templates/common/skills/i18n-audit/SKILL.md` — generalized
   from co-price's: master-locale key parity, glossary adherence, drift report +
   parity certificate. Locale-agnostic (N locales), owner `i18n-specialist`.
2. **co-price `i18n-audit` becomes a variant specialization** of the common skill:
   keeps its 16-locale matrix, Vitest harness specifics, and `l10n-auditor` owner;
   description notes the common base. Version retained.
3. **`i18n-specialist.md`**: `required_skills` gains `i18n-audit`; routing table gains
   an audit row; a coverage matrix section is added summarizing the table above so
   dispatch decisions are one-hop.

## 6. Doc Auto-Regeneration (design only — deferred implementation)

Marker-based regeneration extending the WORKSPACE-MANAGED pattern (ADR-0062 domains):

- **`generate-governance-docs.ts`** (future): regenerates marked roster sections —
  `templates/<v>/docs/<v>.context.md` Agents/Skills tables, variant README
  agent/skill tables, user-guide roster appendix — from `variant.json` +
  SKILL.md/agent frontmatter. Merge mode: positional matching per ADR-0056.
- **CONSTITUTION hub↔spoke checker** (future): validates that each
  `docs/constitution/NN-*.md` heading has its hub summary and vice versa (audit.ts
  currently checks one direction only); no generation — summaries stay human-written.

## 7. Deferred (recorded, not implemented)

- **Variant commonization** (user-excluded from this PR): co-safety's 12 stale
  common-skill copies; co-develop/co-game scope-only duplicates (`code-review`,
  `refactoring`, `test-driven-development`); co-consult/co-hr shared consulting
  skills; co-price `pdf-export` divergence. Candidate mechanism: promotion to
  `templates/common` + `context-commonization-review` cadence.
- Rule-ID registries for 12 variants; evidence-ledger cadence.
- `suggest-skill-relations.ts`; relation lifecycle state machines (ADR-0060
  Amendment 3 roadmap Phases 2–5).

## 8. Delivery (this PR)

| File | Change |
|------|--------|
| `docs/designs/2026-08-29-relation-graph-evolution-and-decision-chain-design.md` | this document |
| `schemas/skill.schema.json` | define `relates_to` (two homogeneous forms), `inputs`, `outputs` |
| `scripts/validate-skills.ts` | v1.2.0 — Part 1c: relation validation (form homogeneity, type vocabulary, target existence, self-reference) |
| `scripts/validate-decisions.ts` | NEW — fail-closed DEC chain validator |
| `scripts/SCRIPTS.md` (+ L1 mirror) | rows for validate-decisions; validate-skills version bump |
| `skills/*/SKILL.md` (~12 L0 skills) | typed `relates_to` per §3.2 |
| `templates/common/skills/i18n-audit/SKILL.md` | NEW common skill |
| `templates/co-price/skills/i18n-audit/SKILL.md` | re-anchored as variant specialization of common base |
| `templates/common/agents/i18n-specialist.md` | required_skills + routing row + coverage matrix |
| `docs/skill-graph.json` / `.md` + per-template scopes | regenerated |
| `docs/lifecycle/skills/i18n-audit.md` | lifecycle record |
| `CHANGELOG.md`, `memory/2026-08-29.md` | entries |

### L0 relations to add (§3.2 concrete set)

| Skill | relates_to |
|-------|-----------|
| create-variant | enables: promote-variant |
| promote-variant | follows: create-variant |
| project-to-variant | composes_with: promote-variant |
| upgrade-project | follows: promote-variant |
| variant-feature | composes_with: upgrade-project |
| context-commonization-review | follows: promote-variant |
| simulate-l3-to-variant-promotion | follows: project-to-variant |
| team-builder | enables: create-variant |
| agent-lifecycle-manager | composes_with: skill-lifecycle-manager |
| skill-lifecycle-manager | composes_with: script-lifecycle-manager |
| audit-workspace | composes_with: security-scan |
| sync | composes_with: audit-workspace |
| validate-docs-links | composes_with: audit-workspace |
| research-analysis | enables: documentation-writing |
| translate | composes_with: documentation-writing |

## 9. Acceptance Test

1. `bun scripts/validate-skills.ts` → 0 errors (new Part 1c passes on all L0 skills).
2. `bun scripts/validate-decisions.ts` → 0 errors on the 4 existing DEC records.
3. `bun scripts/generate-skill-graph.ts` then `bun scripts/verify-skill-graph.ts --determinism` → 0 drift.
4. `bun scripts/audit.ts` → 0 errors.
5. `/sync` opens the PR with regenerated manifests.

## Addendum (2026-08-29, same day): Variant Mass-Adoption Wave

User approved extending typed `relates_to` to all variant templates
(`templates/co-*/skills/`), ending the §3.3 mass-migration deferral early.

**Derivation instead of hand-authoring.** 74 additional skills / 201 edges were
derived mechanically from the Procedure Schema corpus (`tests/add-variant-relations.ts`,
idempotent — re-runnable as new procedures are authored):

| Rule | Relation |
|------|----------|
| Consecutive distinct steps `i → i+1` in a procedure | `follows` (pure sequencing — no dependency implication, per Amendment 3 semantics) |
| Two skills co-used in one procedure, non-consecutive | `composes_with` (symmetric; declared once from the alphabetically-first source) |
| Skill already declares `relates_to` | append only edges not already present; keep all pre-existing declarations |

**Direction policy (user-corrected):** relations flow **variant skill → L1
(`templates/common/skills/`) or same-variant targets**. Sources are variant-local
skills only — variant-specific edges are never written into L1 common skills.
Procedures that reference L0-only skills as sources are skipped.

**Validator scope widened.** `validate-skills.ts` 1.2.0 → 1.3.0: Part 1c now scans
every `templates/*/skills/` tree in addition to L0 `skills/`, with recursive
discovery (co-safety's nested `daily/<name>`, `domains/<name>` skills are checked
and targeted as slash-relative names).

**Result:** 175 skills now carry typed `relates_to` (15 L0 + 4 prior co-consult
pilot + 74 derived variant + appended entries); graph at 542 nodes / 1,548 edges,
determinism-verified; `audit.ts` passes.

**Remaining deferral:** `suggest-skill-relations.ts` (similarity-based candidates
into overrides) — unchanged from §3.3.

### Addendum 2 (2026-08-29): Propagation-Coupling Rule

Project-level verification (Projects/co-* adoption wave) surfaced a fourth
constraint, now enforced as a validator warning (`validate-skills.ts` Part 1c,
`relation-target-not-in-l1`): **a skill published to L1 (`templates/common/skills`)
must not relate to targets absent from L1** — the edge would dangle in every
propagated L1/L2 copy. Three edges from the L0 wave were removed for this reason
(`sync→audit-workspace`, `validate-docs-links→audit-workspace`,
`team-builder→create-variant`; targets are L0-only skills). L0-only skills may
still relate among themselves — their frontmatter never propagates.
