# Decision-Write-Integrity Skill Design — Fleet Process Skill Distilled from co-newbiz ADR-0186

- **Spec id**: `2026-10-28-decision-write-integrity-skill`
- **Date**: 2026-10-28
- **Status**: implemented (registry SSOT; retro-marked per T-20261029-002 header-registry reconciliation)
- **Related**: ADR-0074 (Universal Design Gate), ADR-0031 (L1/L2 fork model — fleet propagation stays gated), design 2026-10-07-daily-fleet-learning-extraction (learning-extraction pipeline that filed the ticket), T-20261028-008
- **Scope**: One new L0 skill (`skills/decision-write-integrity/`) + registry row (`skills/SKILLS.md`) + lifecycle record (`docs/lifecycle/skills/decision-write-integrity.md`). No templates/, Projects/, or agents/ changes; no script surface.

---

## 1. Background

Learning ticket T-20261028-008 (filed by project-resync Step 2f, 2026-10-28) requests
distilling the gate-integrity pattern landed in Projects/co-newbiz (ADR-0186, PR #743,
merge d06e25b8) into a fleet-level, domain-neutral process skill. The source pattern
proved six mechanisms on a live decision-write path: enforcement taxonomy
(HARD BLOCK / ACK / DISPLAY), off|shadow|enforce staged rollout, server-recomputed
snapshot-hash propose-then-confirm (409 on stale), deterministic script-aware
rationale substance checks, maker/checker countersign with deny-by-default grants,
and AI-recommendation divergence recording. The pattern is absent from
`templates/common` and `.agents/skills` (verified by the extraction pass); no
workspace skill currently carries it.

## 2. Goals / Non-Goals

**Goals**
- G1: A single L0 process skill (`skills/decision-write-integrity/SKILL.md`, under
  200 lines) that teaches how to design and operate decision-write integrity gates
  for ANY governed decision write (tickets, ADRs, approvals, state transitions).
- G2: Registry and lifecycle at birth: `skills/SKILLS.md` row, lifecycle record,
  VERSION_MANIFEST regeneration, skill-graph projection — so validators pass
  without a follow-up.
- G3: Domain neutrality: generalize the mechanics; carry zero co-newbiz business
  specifics (predicates, discount-rate semantics, track ladders, policy clause
  numbers).

**Non-Goals**
- N1: No fleet propagation — `l2_propagate: false` (L0-only posture, same as
  `project-resync`); propagation to L1/L3 is a later governance decision through
  the standard sync pipeline, not this landing.
- N2: No implementation code. The skill is process guidance; it names no engine,
  writes no scripts, and does not modify validators.
- N3: No changes to `templates/`, `Projects/`, `agents/`, or ticket files beyond
  the T-20261028-008 claim transitions.

## 3. Design Decisions

- **D1 — Distill, do not summarize.** Each ADR-0186 mechanism is reduced to its
  invariant rules (e.g. "the server recomputes", "stop decisions are never
  blocked", "silence is never read as pass") stated as operating guidance;
  co-newbiz identifiers (kill criteria, WACC/hurdle, entity/group IC, neb-policy
  clause numbers) are replaced by neutral terms (binding predicates, mandatory
  numeric assumptions, reviewer roles, governing policy).
- **D2 — Taxonomy-first structure.** The HARD BLOCK / ACK / DISPLAY table is the
  skill's centerpiece because the block-vs-acknowledge split (system never
  decides) is the pattern's load-bearing decision; rollout, snapshot flow,
  rationale, maker/checker, waivers, and divergence hang off it.
- **D3 — Keep the anti-patterns.** ADR-0186's alternatives-considered (LLM-judged
  rationale quality, client-computed snapshots, single-owner bypass) become an
  Anti-Patterns section — they are the reusable part of the review history.
- **D4 — Single-file skill.** Sibling style references (`meeting-facilitation`,
  `project-resync`) are single SKILL.md files; the ~200-line budget holds all six
  mechanisms without a references/ subdir. Provenance is a References section
  citing the source ADR/design paths verbatim.
- **D5 — Frontmatter posture.** `scope: common`, `l2_propagate: false`, `owner: pm`,
  `type: process` — matching `project-resync`'s operator-skill posture; triggers
  cover gate-integrity vocabulary so the skill-graph and VERSION_MANIFEST pick it
  up.

## 4. Verification Plan

1. `bun scripts/validate-skills.ts` — frontmatter and structure gates green.
2. `bun scripts/audit.ts` — full audit green after VERSION_MANIFEST and
   skill-graph regeneration (fix findings per audit output mechanically).
3. `bun scripts/verify-scripts.ts --verify` and `bun test` — unchanged (no
   script surface touched).
4. Content check: grep the skill body for co-newbiz-specific tokens (kill
   criteria, WACC, entity_ic, neb-policy) — must return nothing.

## 5. Accessibility & Preview Verification Statements

- **Accessibility (ADR-0065)**: exempt — markdown process skill, no rendered UI.
- **Preview Verification (ADR-0070)**: exempt — no rendered UI artifact.

## 6. References

- Source pattern: Projects/co-newbiz/docs/adr/0186-gate-integrity.md,
  Projects/co-newbiz/docs/designs/2026-10-26-gate-integrity-design.md
- Ticket: tickets/governance/T-20261028-008.yaml (learning extraction, Step 2f)
- Style references: skills/meeting-facilitation/SKILL.md,
  skills/project-resync/SKILL.md; lifecycle pattern:
  docs/lifecycle/skills/new-project.md
