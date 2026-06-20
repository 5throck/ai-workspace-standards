---
version: "1.0.0"
last_updated: "2026-05-28"
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

## Override Types

| Type | Description | Approval |
|------|-------------|---------|
| `additive` | Variant adds sections to this file | Auto-approved |
| `replacement` | Variant modifies this file's content | lifecycle-manager review required |
