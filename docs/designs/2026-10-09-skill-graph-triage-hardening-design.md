# Skill-graph triage hardening — Design

- **Spec ID**: 2026-10-09-skill-graph-triage-hardening-design
- **Date**: 2026-10-09
- **Status**: implemented
- **Tickets**: T-20261009-008 (primary), T-20261009-007, T-20261008-009, T-20261008-007 (PM ruling)
- **Origin**: 2026-10-09 daily review High-3/Slot-B — the day's "NEW orphans" (standup-synthesizer, architect) were v2 scoped-identity edge-re-attribution artifacts, not real isolation; the triage machinery produced them via (a) a docRef corpus missing HERMES.md, (b) zero triage axes for isolated agents, (c) no same-capability attribution for L0 nodes whose variant copies carry the edges.

## Problem

1. `scripts/skill-graph-fleet-report.ts` `analyzeRootOrphans` scans `["AGENTS.md","CLAUDE.md","GEMINI.md","CODEX.md"]` — HERMES.md missing while `PLATFORM_MIRROR_DIRS` counts 5 bases; stale doc-comment says "4 platform skill bases".
2. Isolated **agents** are reported as a bare name list — no registry/mirror/docRefs axes, so a flag arrives with no triage evidence.
3. Isolation = "zero edges in the root graph", but v2 re-attributed L0 edges to scoped variant copies: `agent:root/architect` and `skill:root/standup-synthesizer` have 0 edges while their scoped copies are fully wired → false isolation flags.
4. `docs/skill-graph.overrides.json` scoped-key resolution has no unit pin; the bare-key fan-out removal (v2) is untested — a stale bare key would now silently stop applying.
5. `normalizeForHash()` strips `scope:` but not the ADR-0033 stub `variant:` token, so extends-stub agent families (i18n-specialist ×14, pm ×15) re-appear as E2 same-version-different-content drift findings every run.
6. **PM ruling (T-20261008-007)**: co-design `storyteller` 2.0.0 (Brand Narrative & Design Principles Lead) and co-work `storyteller` 1.0.0 (Organizational Storyteller & Culture Steward) are same-name, genuinely unrelated. The no-rename rule bars renaming; the 2026-10-08 reconciliation-wave convention declares distinct capabilities via the `capability:` key.

## Decisions

### D1 — Corpus + comment fix (fleet-report 2.0.0 → 2.1.0)

`corpusFiles` gains `HERMES.md`; the v1.1.0 doc-comment now says "5 platform skill bases".

### D2 — Agent triage axes

Isolated L0 agents are reported with the same 4-way axes as skills: `registry` = VERSION_MANIFEST Agents row or `docs/lifecycle/agents/<name>.md` exists; `mirror` = root `agents/<name>.md` exists; `docRefs` = corpus occurrences. Schema: `isolatedAgents` changes from `string[]` to the axes object array (snapshot consumers: the daily review reads it directly; no programmatic consumer pins the array shape — verified 2026-10-09).

### D3 — Same-capability edge attribution (systemic fix)

Before flagging an L0 node isolated, count edges touching its same-name scoped copies (`type:scope/name`). If ≥ 1, the node is **not isolated**; its name goes into a new snapshot field `rootOrphans.carriedByScoped: string[]` (additive) so the attribution is visible. Direct overrides entries remain the manual escape for genuine cross-variant wiring the name-match cannot see.

### D4 — Overrides scoped-key unit pin (T-20261009-007)

New `tests/unit/skill-graph-overrides.test.ts`: fixture tree via `SKILL_GRAPH_ROOT` + `docs/skill-graph.overrides.json` containing (a) a scoped key `skill:co-a/foo` mutating a node field — asserts the mutation lands in the generated graph; (b) an unknown bare key `foo` — asserts a warning is emitted and nothing mutates.

### D5 — normalizeForHash strips `variant:` (T-20261008-009)

The frontmatter strip filter becomes `/^(version|last_updated|last_reviewed|scope|variant)\s*:/` — ADR-0033 extends-stub agents differing only by `variant:` now hash identical, ending the i18n-specialist/pm family false-drift findings. skill-graph-compat header note updated.

### D6 — storyteller capability ruling (T-20261008-007, PM ruling per ADR-0080)

Ruling: **declare distinct capabilities, no renames** (reconciliation-wave convention; zero consumer churn vs a future-wave rename). `templates/co-design/agents/storyteller.md` gains `capability: design-brand-narrative`; `templates/co-work/agents/storyteller.md` gains `capability: org-culture-narrative`. Lifecycle records note the capability key. The graph keys them separately (`capabilityOf`), ending the same-name convergence pairing. If a future wave prefers true renames, this ruling is reversible at zero data loss.

## Test plan

Existing suites cover fleet-report convergence/invariants; new assertions: (a) fleet-convergence test extended? No — D3 verified via a manual run against the live workspace (architect/standup-synthesizer leave the isolated lists, appear in carriedByScoped) and the snapshot diff committed with this change; (b) D4/D5 covered by the new overrides test and an induced-fixture assertion in the compat tests (stub bodies differing only by `variant:` hash equal).

## Verification

`bun test` green; skill-graph regenerated (hash shifts from D5/D6 frontmatter changes) + `verify-skill-graph.ts` invariants pass; fleet-report rerun shows isolated skills `[]` (standup-synthesizer attributed) and isolated agents with full axes; SCRIPTS.md rows cascaded (fleet-report 2.1.0, skill-graph-compat note).
