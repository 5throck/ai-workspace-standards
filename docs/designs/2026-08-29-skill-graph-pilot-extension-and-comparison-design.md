# Skill Graph Pilot Extension (co-price, co-deck) + Phase-Inference Comparison Experiment

| Field | Value |
|-------|-------|
| Date | 2026-08-29 |
| Status | accepted (user-directed, iterative session) |
| Spec ID | `skillgraph` |
| Governing anchor | [ADR-0060](../adr/0060-skill-relationship-graph-generated-projection.md) Amendment 3 (declarative) + Amendment 4 (inferential) |
| Related | `docs/designs/2026-08-28-skill-graph-typed-relations-design.md` (Amendment 3, original co-consult pilot); `docs/designs/2026-08-29-inference-derived-graph-strategy-design.md` (Amendment 4) |

## Problem

After Amendment 3's declarative typed-`relates_to` pilot on co-consult (4 skills),
the user asked to extend the same pilot to two more templates and then evaluate
whether it was actually adding value.

## What was done

### 1. co-price pilot (5 skills)

Mapped the real "Commercial Operating Cycle" workflow
(`docs/co-price.context.md`) onto: `gabor-granger` `composes_with`
`van-westendorp-psm` (declared once, on `gabor-granger` only — both `enables`
`pricing-playbook`, which `enables` `scenario-comparison`, which `enables`
`pricing-governance`. `inputs`/`outputs` labels reuse each skill's own existing
output-contract vocabulary (`optimal-price`, `price-corridor`,
`pricing-policy-set`, `guardrail-status`, etc.).

### 2. co-deck pilot (6 skills)

Mapped the real 11-stage lecture pipeline: `research` `follows` `storyline`
`follows` `design` `enables` `html-build` `follows` `pdf-export`;
`slide-layout-gate` `composes_with` `pdf-export` (declared once, on
`slide-layout-gate`). First use of the `follows` edge type — most of this
chain is pure sequencing already covered by `prerequisites`→`requires`, with
`design`→`html-build` being the one genuine producer/consumer `enables`
relation (design's locked spec is what unlocks HTML generation).

### 3. Phase-inference comparison experiment

After reviewing the co-deck result, the user observed the hand-declared edges
mostly restate what `prerequisites`/`variant.json` phases already imply —
low marginal signal, the same failure mode Amendment 4's normative rule warns
about (duplicate declaration of already-authoritative facts), just against a
shallower SSOT than co-newbiz's procedure schemas.

Built `scripts/experiments/infer-graph-from-phases.ts` — a standalone,
read-only comparison tool, registered in `scripts/SCRIPTS.md` as
`status: experimental` / `layer: L0` (the workspace's script-registry gate
requires every script under `scripts/` to be registered; `experimental`
status, matching the `helpers/agent-promote.ts` precedent, keeps it out of
`dev-sync.ts` wiring and template propagation — a one-off experiment, not a
production feature) that derives edges for a template purely
from `variant.json`'s `skill_manifest.phases[]` + existing `prerequisites`,
with zero new frontmatter, for direct comparison against the hand-declared
pilot on the same workflow.

**v1** (naive phase-adjacency: `inferred_follows` for consecutive min-phases,
`inferred_composes_with` for any shared phase) produced 34 edges vs. 5
hand-declared — dominated by noise from a cross-cutting skill (`version`,
spanning phases 0-6) and an over-broad `follows` fan-out (`design` "follows"
into all 6 phase-4 skills, when only `html-build` is a real direct relation).
One genuine win: `inferred_composes_with` surfaced the real phase-4 cluster
(`html-build`/`measure`/`prep-pdf`/`pdf-export`/`slide-layout-gate`/
`presenter-mode`) that the hand-declared pilot had only partially captured
(1 pair vs. the full 6-skill cluster).

**v2** (excludes cross-cutting skills — phases[] spanning more than half the
scope's distinct phase count; drops `inferred_follows` entirely as redundant/
noisy) reduced this to 16 edges — but 15 of those are the pairwise
combination of the same phase-4 cluster, which is already expressible via the
graph's existing `phase` edge type (skill→phaseN) without combinatorial
blow-up. Net finding: **on templates without a co-newbiz-style structured
procedure schema, phase-adjacency-only inference doesn't clearly outperform
the declarative approach** — the underlying data (`phases[]`, a bare integer
array) is too coarse to reconstruct real workflow structure either way.

## Decision

No promotion. Both the declarative pilots (co-consult/co-price/co-deck) and
the inferential experiment are recorded as-is; no new default extraction mode
is adopted. This maps to Amendment 4's own three-stage revisit criterion —
the comparison confirms the parent workspace's templates are not yet a
"second independent implementation with a confirmed common extraction
contract" against co-newbiz; they simply lack sufficiently structured SSOTs
for either strategy to shine. A follow-up investment (building a
co-newbiz-style procedure schema for at least one parent template) would be
required before either approach could be expected to add real signal — out of
scope for this pass.

## Registrations

| File | Change |
|------|--------|
| `templates/co-price/skills/{gabor-granger,van-westendorp-psm,pricing-playbook,scenario-comparison,pricing-governance}/SKILL.md` | typed `relates_to`/`inputs`/`outputs` (5 skills) |
| `templates/co-deck/skills/{research,storyline,design,html-build,pdf-export,slide-layout-gate}/SKILL.md` | typed `relates_to`/`inputs`/`outputs` (6 skills) |
| `scripts/experiments/infer-graph-from-phases.ts` | new, unregistered, read-only comparison experiment |
| `docs/skill-graph.json` / `.md` (L0), `templates/{co-price,co-deck}/docs/skill-graph.json` | regenerated |
| `CHANGELOG.md`, `memory/2026-08-29.md` | entries |
| `docs/designs/2026-08-29-skill-graph-pilot-extension-and-comparison-design.md` | this document |

## Verification

| Check | Result |
|-------|--------|
| `verify-skill-graph.ts` (L0 + `--scope co-price` + `--scope co-deck`) | 0 drift |
| Generated JSON inspected for both scopes | correct edge types/directions; single-side `composes_with` declarations confirmed (no duplicate-declaration bug from the co-consult review) |
| `bun scripts/audit.ts` / `bun scripts/validate-templates.ts` | 0 errors |
| Experiment script `git status` after running | 0 files changed (read-only) |

## Out of Scope

- Any promotion of the phase-inference approach into `generate-skill-graph.ts`.
- Building a richer, co-newbiz-style procedure schema for any parent template
  (the prerequisite for either strategy to meaningfully improve, per the
  comparison's finding).
- Reverting the 3 declarative pilots — kept as documented, verified
  experiments even though their marginal value is now understood to be low.
