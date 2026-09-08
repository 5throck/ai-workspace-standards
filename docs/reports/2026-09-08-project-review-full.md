# Project Review — Workspace Root + templates — 2026-09-08 (v1.2.0 cycle)

**Date**: 2026-09-08
**Scope**: workspace root, templates/common, templates/co-* (full mode) + ecosystem gap analysis (agents / workflows / skills)
**Method**: machine validator battery + 4 parallel review slots (Explore agents) + 3 ecosystem-gap explorations

> Fixes were applied in-session (see Action wiring); this report records findings, classifications, ticket wiring, and verification.

## Baseline (Step 0 — before agent dispatch)

| Validator | Result |
|---|---|
| `audit.ts` | ✅ All checks passed |
| `validate-templates.ts` (incl. new WS-01 L1 parity gate) | ✅ 0 error / 0 warning |
| `verify-scripts.ts --verify` | ✅ 171 registered scripts |
| agent-lifecycle-audit / skill-lifecycle-audit | ✅ 8 agents / 38 skills healthy |
| propagate `--check-drift` | gemini-settings only (intentional) |

## Prior-session fixes verified HOLDING (PRs #821–#825)

All five regression targets verified independently by Slot A: L1 schema sync + parity gate,
phase boilerplate, co-hr/co-price/co-safety phase-definitions, project-review v1.2.0
deployment (8 copies + contract), pm.md extends-stub resolution for empty stubs.

## Review Results — new findings

### 🟡 High (fix immediately)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | pm.md scaffold resolution is a no-op for the 5 variant_overrides variants — ships raw VARIANT-SECTION markers, no base PM content; merge-frontmatter.ts DSL is wired to nothing; validator exempts pm.md from marker check | A + C (deduped) | scripts/new-project.ts:553, scripts/lib/agent-override-merge.ts:62, validate-templates.ts:2308 | systemic + script-gap | **Ticket T-20260908-009** (high) — merge-engine design work |
| H2 | Empty-stub resolution (v1.10.0) left dangling `extends:` and dropped L1 frontmatter (tier/model/color/description/examples) | A | scripts/new-project.ts:559 | script-gap | **Fixed now** — frontmatter merge + extends dropped + missing-L1 warning (new-project v1.11.0); smoke-tested with co-work scaffold (audit 0 FAIL) |

### 🟢 Moderate (fix within 2 weeks)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | dispatch trio is a no-op: parallel/serial spawn `dispatch.ts --task <json>` → help text, exit 0; contract mismatch + recursion risk; SCRIPTS.md documents nonexistent flags | C | scripts/dispatch-parallel.ts:107, dispatch.ts:209 | systemic | **Ticket T-20260908-010** (high) |
| M2 | Lifecycle record template lacks Version field → 12/38 skill records and 8/8 agent records unversioned; script records 3/89 (validate-templates, propagate missing) | B | docs/lifecycle/README.md:256-362 | systemic | **Ticket T-20260908-013** |
| M3 | co-safety three-way phase contradiction (frontmatter [2,6] vs roster '—' vs dispatch table Phase 4) | A | templates/co-safety/agents/*.md:4, AGENTS.md:306,588 | one-time | **Ticket T-20260908-014** (needs domain adjudication) |
| M4 | co-deck phase-definitions.md is a byte-identical copy of common (fractional/H-phases undocumented) | A | templates/co-deck/docs/phase-definitions.md | one-time + script-gap | **Ticket T-20260908-015** |
| M5 | co-safety ships 21 scripts with no script_manifest (B-03 cannot see undeclared) | A | templates/co-safety/variant.json | one-time + script-gap | **Ticket T-20260908-016** |
| M6 | Scaffolded pm.md governance pointer dangles in 10/13 variants | A | scripts/new-project.ts:667 | script-gap | **Ticket T-20260908-017** |
| M7 | audit.ts not wired into any CI workflow (zero automated runs) | C | .github/workflows/ | script-gap | **Ticket T-20260908-011** |
| M8 | Variant project-review copies stale at v1.1.0 (vapor --tasks lives on in 10 Projects + co-safety) | D | Projects/*/skills/project-review/SKILL.md:248 | systemic | **Ticket T-20260908-012** |

### ℹ️ Low / one-time (fixed now)

| # | Issue | Agent | Class | Fix |
|---|-------|-------|-------|-----|
| L1 | Parity check key-order sensitive (JSON.stringify ≠ deep-equal) | C | one-time | **Fixed** — canonical sorted-key compare |
| L2 | Missing L1 schema degraded to warn (contradicting check rationale) | C | script-gap | **Fixed** — warn → fail |
| L3 | Resolver silently no-ops when L1 pm.md missing | C | one-time | **Fixed** — warning added |
| L4 | SCRIPTS.md duplicate row block (9 rows ×2, root + L1 mirror) | C | one-time | **Fixed** — deduped (registry 171→162) |
| L5 | Skill omitted `urgent` from ticket priority enum | D | one-time | **Fixed** |
| L6 | § references without document disambiguation (§9.1/§3.7.5/§10) | D | one-time | **Fixed** — explicit doc names |
| L7 | Command overpromised "wait for user approval" gate | D | one-time | **Fixed** — wording aligned |
| L8 | Design doc: variant-copy byte-identity claim + G3 header misstatement | D | one-time | **Fixed** |
| L9 | promote-variant record 1.2.1 vs SKILL 1.3.0; translate 1.0.0 vs 1.0.1 | B | one-time | **Fixed** |
| L10 | meeting record parity claim false (1.4.0 vs 1.4.1) | B | one-time | **Fixed** — meeting bumped to 1.4.1 |
| L11 | ticket-run self-referential unchecked box; skill-lifecycle-manager `doc/` typo | B | one-time | **Fixed** |
| L12 | docs/index ADR range stale (0049 → 0069); ADR-0040 broken ADR-0030 link | B | one-time | **Fixed** (retired/ link) |
| L13 | new-project script record 8 minors stale; duplicate "2.3b" section labels | B + A | one-time | **Fixed** — record backfilled to 1.11.0; label 2.6a |

### ✅ Strengths

- All prior-session fixes (PRs #821–#825) verified holding by two independent slots
- VERSION_MANIFEST fresh and fully accurate; SCRIPTS.md registry consistent (post-dedupe)
- WS-01 parity gate implemented as designed and already CI-covered (no soak gap)
- CI posture: least-privilege layering, SHA-pinned actions, loud failures, documented guards
- co-news phase-definitions is an exemplary variant-level model (matched frontmatter exactly)

## Ecosystem Gap Analysis (agents / workflows / skills)

Full exploration reports in session memory; headline recommendations:

### Agents — recommendation: **zero new agents**
Seven recurring work types currently lack a dedicated agent (test/QA execution, review-finding
remediation, incident triage, dispatch-blocked audit execution, dependency/release management,
variant role gaps, content freshness). All are addressed by workflow/skill means, respecting:
- 2026-08-29 procedure-coverage design Rule 5: "workflow-shaped, not agent-shaped"
- project-review v1.2.0 already owns dispatch resilience (cap + pairing + fallback)
- Variant role gaps are governed by existing backlog tickets T-20260829-001..020 (do not duplicate)

### Skills — recommendation: **1 new (pilot) + 5 consolidation tickets**
- **Created: `ci-triage` v0.1.0** — codifies the proven failure-triage loop (reproduce → minimize →
  trace → fix → verify+harden) that previously lived only in the 2026-09-07 memory log. Escalates
  to project-review scoped mode when ≥3 domains fail. Design: docs/designs/2026-09-08-ci-triage-skill-design.md
- **Ticketed** (T-20260908-001..005): release-template skill (atomic VERSION bump+tag+CHANGELOG —
  currently three manual prose steps, no script writes VERSION), meeting↔meeting-facilitation
  merge, simulate-* merge, validate-docs-links retirement, update-bun-packages absorption
- Mirror-propagation demand (highest-frequency gap in the exploration) is already mechanized by
  `propagate-to-templates` + the WS-01 parity gate (#825) — no new skill needed

### Workflows — recommendation: **3 tickets**
- T-20260908-006: Projects EOL policy (deprecated state, _archive, remove-project criteria)
- T-20260908-007: postmortem template + persistence convention
- T-20260908-008: ci-failure issue triage owner + onboarding verification

Deliberately-manual steps (release notes §6.6, human archive gates §9.2, skill-review triage)
are left manual by design — not gaps.

## Action wiring

| Route | Items | Tickets |
|-------|-------|---------|
| Fix now (in-session) | H2, L1–L13 (15 items) | — |
| Ticket | H1, M1–M8 | T-20260908-009..017 (9 new) |
| Ticket (ecosystem) | release, consolidations, workflows | T-20260908-001..008 (8 new) |
| Existing backlog | variant role gaps | T-20260829-001..020 (unchanged) |

## Verification

Appended after post-fix validation — see below.

## Verification (post-fix, 2026-09-08)

| Validator | Result |
|---|---|
| `audit.ts` | ✅ 0 FAIL (after skill-graph regeneration for new ci-triage skill) |
| `validate-templates.ts` | ✅ 0 error / 0 warning (canonical parity compare in place) |
| `verify-scripts.ts --verify` | ✅ 162 registered scripts (9 duplicate rows removed) |
| agent/skill lifecycle audits | ✅ 8 agents / 39 skills healthy (ci-triage added) |
| root `bun test` | ✅ 250 tests, 0 fail |
| scaffold smoke test (co-work) | ✅ pm.md frontmatter merged (tier/model/…), no dangling extends, project audit 0 FAIL |
