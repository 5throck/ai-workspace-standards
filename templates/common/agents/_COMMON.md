---
version: "1.1.0"
last_updated: "2026-11-12"
status: active
---

# Common Agents

This directory contains agent definitions shared across all variant templates.

These agents are **inherited** by all projects scaffolded from any variant. Variant-specific
overrides are declared in each variant's `variant.json` under `agent_overrides`.

## Governance

See `common-contract.json` for:
- Which agents are in the common layer
- Version tracking
- Override type rules (additive vs. replacement)
- Anti-swelling threshold (50% rule)

## Common Agent Roster

This directory holds the agents delivered to every scaffolded project. They are
listed in `common-contract.json` `common_agents`:

| Agent | Kind | Owns / does |
|-------|------|-------------|
| `pm.md` | Orchestrator | Extends the workspace PM; the only agent with an `extends:` chain |
| `i18n-specialist.md` | Promoted specialist | Locale configuration, formatting, layout, parity audit (`i18n-*` skills) |
| `automation-engineer.md` | Common specialist | The `/sync` row, repository automation, platform-layer implementation (`sync` skill owner) |
| `public-data-analyst.md` | Skill-owner agent | The Korean public-data gateway skills `k-ecos`, `k-kosis`, `k-krx`, `k-dart`, `k-law`, `k-opendata` (Korea-scoped; no work in non-KR projects) |
| `design-system-lead.md` | Skill-owner agent | The `design-foundation` skill |
| `contract-gate-engineer.md` | Skill-owner agent | The `zod-contract-gate` skill |

Common agents are generic: they carry no variant-specific or workspace-root-only
text, and they coexist with same-domain variant agents under distinct names (no
`extends:` stub, no replacement). A variant that needs project-specific bindings
for a common agent documents them in its own context document instead of forking
the agent file.

## L0 Agent Non-Propagation

The workspace-root (L0) specialist roster is intentionally **not** propagated here:
architect, auditor, docs-writer, lifecycle-manager, scaffolding-expert,
security-expert, and skill-graph-analyst stay at the workspace root. The one L0
role that is also common, `automation-engineer`, has its own L1-authored body in
this directory (not an `extends:` stub of the root file). Variant projects define
their own domain specialist agents. See docs/context.md §7.5 and ADR-0043 §6.

## Override Types

| Type | Description | Approval |
|------|-------------|---------|
| `additive` | Variant adds sections to this file | Auto-approved |
| `replacement` | Variant modifies this file's content | lifecycle-manager review required |
