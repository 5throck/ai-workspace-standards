# Decision Chain Standard — Implementation Design

| Field | Value |
|-------|-------|
| Date | 2026-08-24 |
| Status | implemented |
| Governing ADR | [ADR-0061 — Decision Record Standard](../adr/0061-decision-record-standard.md) |
| Related | ADR-0060 (skill relationship graph), ADR-0055/0059 (WARN-first enforcement playbook) |

## Problem

A 2026-08-24 audit of all 11 variants found the decision-critical chain **Agent → Skill → Knowledge → Evidence → Rule → Decision** broken at its last link in every variant: gate rulings, escalations, and go/no-go calls lived only in chat transcripts and vanished when sessions ended. Evidence practice existed (strongest in co-news), rule IDs did not exist anywhere, and there was no decision artifact, format, or location convention. ADR-0061 defined the standard; this design records its first implementation.

## What Was Built

### New common skills (v1.0.0, scope: common)

1. **`evidence-ledger`** — the base fixed-column ledger format (`claim | source | url/ref | verification | status`), the `docs/evidence/ledger.md` + `docs/evidence/findings/` location convention, the variant-overlay contract (variant-specific rules live in variant assets; co-news's 2-source rule is the canonical overlay example), and the append-vs-supersede mutation rule.
2. **`decision-record`** — the `docs/decisions/DEC-YYYYMMDD-NN.md` format with the full frontmatter spec (`id`, `date`, `agent`, `decision`, `alternatives`, `evidence_refs[]`, `rules_applied[]`, `skills_used[]`, `status: proposed|accepted|superseded`), explicit supersession-never-deletion, the gate-moment recording triggers, and the `<DOMAIN>-R<N>` rule-ID citation convention (stable once assigned, registry per variant context.md).

### Rule-ID pilot (co-news)

- The existing 2-source rule in `templates/co-news/docs/co-news.context.md` (Core Principles, Fact-Verified row) is annotated inline with its stable ID **NEWS-R1** — no new section (WS-09 slot order preserved).

### co-news overlay conversion

- `templates/co-news/skills/source-verification-ledger/SKILL.md` (1.0.0 → 1.0.1) now states it follows the common `evidence-ledger` fixed-column discipline, with the 2-source requirement and receipt-number column kept as the co-news overlay.

### PM gate-moment rule

- `agents/pm.md` (L0, 1.0.0 → 1.1.0) and `templates/common/agents/pm.md` (L1 extends-parent, "1.0.0" → "1.1.0") each gain a **Gate-Moment Decision Records (ADR-0061)** section: every Design Gate Row 0 determination, escalation, and go/no-go decision MUST emit a decision record before dispatch continues. No `lifecycle:` frontmatter was added at the L1 layer (forbidden there); no other frontmatter fields were altered.

### Registrations

| Site | Change |
|------|--------|
| `templates/common/skills/` + `.claude/` + `.gemini/` + `.agents/` mirrors | Both skills created at all four roots, mirrors byte-identical |
| `docs/templates/common-contract.json` | `common_skills` entries added (contract 1.2.0 → 1.3.0; `pm` agent version synced to 1.1.0) |
| `templates/common/skills/SKILLS.md` | Two registry rows added |
| `docs/templates/common.lifecycle.json` | History entry + version 1.1.0 → 1.2.0 |
| `docs/skill-graph.json` / `docs/skill-graph.md` | Regenerated: 197 → 199 nodes |

### Scope note

This change intentionally spans workspace root (`agents/`, `docs/`) and `templates/` in one PR, per the PM dispatch for ADR-0061 implementation.

## Verification

| Check | Result |
|-------|--------|
| `bun scripts/audit.ts` | pass |
| `bun scripts/validate-templates.ts` | 0 errors (2 pre-existing co-deck WARNs) |
| `bun scripts/verify-skill-graph.ts` | exit 0 — 199 nodes (197 + 2 new skills) |
| `bun scripts/verify-adr-governance.ts --strict` | pass |
| `bun scripts/verify-scripts.ts --check-drift` | 0 warnings |

## Out of Scope / Follow-ups

- `relates_to` graph wiring between the two new skills is deliberately deferred (per implementation brief); prose-reference edges are partially suppressed by the generator's fence-sensitive backtick pairing (advisory only, ADR-0060).
- `scripts/audit.ts` soft-check for `docs/decisions/` hygiene (ADR-0061 §5 v1) — separate script PR.
- Rule-ID annotations for the other 10 variants — variant-by-variant, per ADR-0061 implementation table.
- Hook-level enforcement — explicitly deferred until after 2 engagements (ADR-0061 §5).
