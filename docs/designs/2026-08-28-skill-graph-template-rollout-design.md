# Skill Graph Template Rollout: Per-Template Graph Artifacts + Project-Local Generation

| Field | Value |
|-------|-------|
| Date | 2026-08-28 |
| Status | accepted (user-approved integrated roadmap, PR4) |
| Spec ID | `skillgraph` |
| Governing anchor | [ADR-0060](../adr/0060-skill-relationship-graph-generated-projection.md) + Amendment 2 (this PR) |
| Related | `docs/designs/2026-08-24-skill-relationship-graph-infrastructure-design.md`; `docs/designs/2026-08-25-skill-graph-document-layer-design.md`; `docs/designs/2026-08-28-agpl-license-template-rollout-design.md` (#744) |

## Problem

ADR-0060 shipped a single unified graph at L0 (`docs/skill-graph.json`, 294 nodes / 648
edges, template assets tagged `layer: variant:co-*`) and explicitly rejected per-layer
graph files. The 2026-08-25 amendment promoted the scripts to L0+L1 so scaffolded
projects *can* emit their own graph, but in practice:

- No template and no project carries a graph artifact (`docs/skill-graph.json` exists
  only at L0) — a fresh project has no graph until someone discovers the gate exists.
- The generator is ROOT-hardcoded: `discoverNodes()` labels everything under
  `ROOT/skills` as `layer: 'L0'` regardless of what ROOT actually is, so a
  project-local run mislabels the project's own skills as L0 workspace skills.
- The verifier has no way to check a per-template artifact.

The user (ADR-0060's owner) has now decided to adopt per-template graph files for the
template layer and project-local generation for the project layer — overturning the
original rejection for the template layer specifically. ADR-0060 Amendment 2 records
that decision; this design implements it.

## User-Confirmed Decisions

1. **Template layer**: `templates/common` and every `templates/co-*` ship their own
   `docs/skill-graph.json` (generated at L0, committed, drift-gated each /sync).
   JSON only — the human `.md` catalog stays L0-exclusive.
2. **Project layer**: projects generate their **own** graph locally (never a copy of
   the L0 unified graph), so project-specific skills and docs are reflected; each
   project's existing dev-sync step 4.65 gate maintains it automatically.
3. The L0 unified graph remains the workspace SSOT; per-template files are scoped
   views, not replacements.

## Change Design

### D1 — `generate-skill-graph.ts` v1.2.0 → v1.3.0

- **`--scope <common|co-*>` mode**: new `buildScopeGraph(scope)` scans only
  `templates/<scope>/{skills,agents}` (+ `variant.json` skill_manifest for variant
  scopes) and tags scope-local nodes `common` / `variant:<scope>`. Output:
  `templates/<scope>/docs/skill-graph.json` (no `.md`). No overrides, no document
  layer — both are L0-only concerns.
- **Cross-layer edge resolution**: prerequisites / required_skills / prose references
  naming a skill defined upstream (L0 or common) produce the edge and materialize the
  referenced target as a node carrying its upstream layer — the verifier's
  unknown-target invariant stays intact without bloating scope files with the full
  upstream catalog.
- **Run-context auto-detection (L3 fix)**: a module-level `localLayer` is `L0` when
  `ROOT/templates` exists (workspace root) else `L3` (project context). `discoverNodes`
  and the document layer tag local assets with `localLayer`, and the four
  skill/agent path-resolution ternaries now route any non-`common`, non-`variant:`
  layer to `ROOT/skills` / `ROOT/agents` — so a project-local run labels its own
  assets `L3` instead of mislabeling them `L0`.

### D2 — `verify-skill-graph.ts` v1.0.1 → v1.1.0

`--scope <name>` re-derives `buildScopeGraph(scope)` and compares against the
committed `templates/<scope>/docs/skill-graph.json` (same drift-diff format as the
L0 check). Scope mode also runs the unknown-target check (all edge endpoints must be
nodes; `phase*` pseudo-targets exempt, matching L0 behavior) and the country-mark
invariant over the scope's `prerequisites`/`relates_to` fields. Missing committed
file → graceful "first run" pass (parity with L0 behavior).

### D3 — `dev-sync.ts` v1.7.7 → v1.7.8: step 4.65 scope loop

After the existing L0 graph gate passes (and gated on `templates/common` existing, so
scaffolded projects never enter it), the step loops `common` + every `templates/co-*`
running generate+verify per scope. The stale "generator is L0-only" comment is
corrected. Per-template artifacts are therefore regenerated and drift-checked on
every `/sync` — no manual maintenance.

## Registrations

| File | Change |
|------|--------|
| `docs/adr/0060-skill-relationship-graph-generated-projection.md` | Amendment 2 appended |
| `scripts/generate-skill-graph.ts` | v1.3.0 (`--scope`, `buildScopeGraph`, L3 auto-detect) |
| `scripts/verify-skill-graph.ts` | v1.1.0 (`--scope` verify) |
| `scripts/dev-sync.ts` | v1.7.8 (step 4.65 scope loop + comment fix) |
| `scripts/SCRIPTS.md` | three version rows + last-updated note |
| `templates/{common,co-*}/docs/skill-graph.json` | generated (14 artifacts) |
| `docs/designs/2026-08-28-skill-graph-template-rollout-design.md` | this document |
| `CHANGELOG.md`, `memory/2026-08-28.md` | entries |

L1 mirrors of the three scripts propagate via the standard /sync publish step.

## Verification

| Check | Expected |
|-------|----------|
| `generate-skill-graph.ts` (no args) + `verify-skill-graph.ts` | L0 unified graph unchanged/regenerated cleanly (no regression) |
| `generate-skill-graph.ts --scope <S>` for common + 13 variants | 14 files written under `templates/<S>/docs/` |
| `verify-skill-graph.ts --scope <S>` | all pass; deterministic (re-run byte-identical) |
| Scope graph node layers | scope-local nodes carry `common`/`variant:<name>`; only referenced upstream skills appear as external nodes |
| Project-local simulation | generator run in a project context labels local assets `L3` |
| `validate-templates.ts` / `audit.ts` | 0 errors / all pass |
| `/sync` | step 4.65 loop green; PR created |

## Out of Scope

- Shipping graph `.md` catalogs per template (L0-only by decision).
- Frontmatter `relates_to`/`prerequisites` enrichment across template skills (edge
  sources today: prerequisites, manifests, prose — separate future effort).
- Copying the L0 unified graph into projects (rejected: projects generate locally).
- co-newbiz-style procedure/artifact/rule/evidence-var node types (remain
  project-local per the 2026-08-25 amendment).

## References

- ADR-0060 original rejection of per-layer files + owner confirmation now amending it.
- 2026-08-25 amendment: L0+L1 promotion, project-safe-by-construction rationale.
