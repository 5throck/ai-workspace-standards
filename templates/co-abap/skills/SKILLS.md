# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-abap skills (T-20260925-005). One row per skill directory; values come from each skill's SKILL.md frontmatter. The auto-generated index this file replaces was produced by verify-skills.ts — converting this file to a curated registry opts the variant out of legacy-index regeneration.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `abap-code-review` | 1.0.0 | active | code-writer | 2026-08-25 | — | co-abap only — Use when reviewing ABAP source for Clean ABAP conformance before object activation, transport… |
| `abap-dev` | 1.1.0 | active | code-writer | 2026-08-15 | — | co-abap only — Use when working on SAP ABAP development tasks — provides specialized workflows for BAPI… |
| `desktop-app-fallback` | 1.0.0 | active | test-runner | 2026-08-15 | — | co-abap only — Manual Post-Write QA chain for Claude Code Desktop App (hooks don't fire) |
| `dump-monitor` | 1.0.0 | active | devops-admin | 2026-08-15 | — | co-abap only — Use when checking SAP system health, investigating reported errors, or performing a periodic… |
| `performance-tuning` | 1.0.0 | active | dba | 2026-08-15 | — | co-abap only — Use when investigating slow ABAP programs, expensive SQL statements, or reviewing performance risk… |
| `post-write-chain` | 1.1.0 | active | test-runner | 2026-08-15 | — | co-abap only — Use after ANY WriteSource, EditSource, or Activate operation on SAP ABAP objects |
| `sap-co` | 1.0.0 | active | co-analyst | 2026-08-15 | — | co-abap only — Use when working on CO module tasks — cost center accounting, internal orders, CO-PA profitability… |
| `sap-fi` | 1.0.0 | active | fi-analyst | 2026-08-15 | — | co-abap only — Use when working on FI module tasks — journal entries, account determination, G/L, accounts… |
| `sap-le` | 1.0.0 | active | le-analyst | 2026-08-15 | — | co-abap only — Use when working on LE module tasks — shipping, transport, warehouse management, delivery… |
| `sap-mm` | 1.0.0 | active | mm-analyst | 2026-08-15 | — | co-abap only — Use when working on MM module tasks — purchasing, goods receipt, material master, inventory, or… |
| `sap-pp` | 1.0.0 | active | pp-analyst | 2026-08-15 | — | co-abap only — Use when working on PP module tasks — BOM, routing, production orders, MRP, or work center… |
| `sap-sd` | 1.0.0 | active | sd-analyst | 2026-08-15 | — | co-abap only — Use when working on SD module tasks — sales orders, deliveries, billing, pricing, or order-to-cash… |
| `source-command-celebrate` | 1.0.0 | active | pm | 2026-08-15 | — | co-abap only — Celebrate the successful completion of a task to boost team morale |

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each SKILL.md file. Fleet-common skills (handbook, handbook-sync-audit, the lifecycle managers, sync, translate, and the rest of the common contract) are not listed here — they resolve from templates/common/skills/ at scaffold time.
