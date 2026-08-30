# co-price AGENTS.md Realignment Design

| Field | Value |
|-------|-------|
| Date | 2026-08-30 |
| Status | accepted |
| Spec ID | `copxalign` |
| Related designs | `2026-08-30-project-review-remediation-design.md` (deferred item), variant AGENTS.md audit (2026-08-30) |

## 1. Problem

`templates/co-price/AGENTS.md` passes the Phase 3.5 structural prerequisites (H1 `# AGENTS.md`, `## §1:`, `## §3:`) and — on implementation-time verification — **already contains all 6 `VARIANT-*` marker pairs** (initially misreported as missing by the review audit, which only flagged the missing COMMON-AGENTS block). The sole hard failure against the hardened Phase 3.5 check (`l3-to-variant-pipeline.ts` 1.15.0) is the absent `COMMON-AGENTS:START/END` Language Policy block.

co-price is deliberately different from sibling variants: it carries a consulting-domain workflow (§3 Engineering Workflows with Commercial Operating Cycle, Dual Lifecycle Phase Gates, Governance Operating Model) and its own validation toolchain (`scripts/validate-agents.ts` + `schemas/agent.schema.json`, both present at L0). Its `variant.json` declares a legitimate `agent_overrides` entry (additive PM override, reviewed 2026-08-25).

## 2. Decision

**Option (b): incremental insertion** — keep the custom body; the only required edit is appending the COMMON-AGENTS block (marker insertions 1–6 in the original spec were dropped after verification showed the pairs already present). Option (a) (full regeneration from `templates/common/AGENTS.md` via `regenerate-agents-md.ts`) is rejected for now: it would discard the domain-specific §3 workflows or force them into `variant_overrides` bodies, a large and risky rewrite with no functional gain. Full commonization of §5–§10 remains open and is deferred to the periodic `context-commonization-review` cadence.

## 3. Fix Specification (as implemented)

Target: `templates/co-price/AGENTS.md`. All insertions are additive; no existing line is modified or removed.

| # | Edit | Result |
|---|------|--------|
| 1–6 | Insert `VARIANT-*` marker pairs | **N/A** — all 6 pairs verified already present in the file (implementation-time check superseded the spec) |
| 7 | Append the `COMMON-AGENTS:START … COMMON-AGENTS:END` Language Policy block verbatim from `templates/common/AGENTS.md` at end of file | Applied (+47 lines) |

## 4. Explicitly Deferred

- Renaming co-price §3/§5 to match common's section titles (§3 PM Gateway Workflow, §5 Execution Plan Templates) and adding §6–§10 — Phase 3.5 only enforces §1/§3 presence, title, markers, COMMON-AGENTS block, and roster-link validity.
- Migrating co-price's roster to the common table-row format — its 14-agent roster uses plain-text rows, all files verified present.
- The co-price validation toolchain (`schemas/agent.schema.json`, `validate-agents.ts`) stays as-is; it is additive to, not in conflict with, the common structure.

## 5. Verification Plan

1. `bun scripts/audit.ts` → exit 0
2. `bun run validate-templates` → 0 errors across 8 stable variants
3. Phase 3.5 simulation: all 6 markers + COMMON-AGENTS block + H1 present in `templates/co-price/AGENTS.md`
4. Roster links: every `agents/*.md` reference resolves relative to `templates/co-price/` (verified clean in the 2026-08-30 audit; re-check after edits)
5. `bun scripts/validate-agents.ts Projects/co-price` (if a project exists) → unchanged behavior
