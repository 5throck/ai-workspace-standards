# Design: LLM Interaction Standard L1 Verbatim-Copy Divergence Policy

- **Spec id**: `2026-10-05-llm-standard-layer-scoping-design`
- **Date**: 2026-10-05
- **Status**: Implemented
- **Ticket**: T-20261004-028
- **Related**: `docs/standards/llm-interaction-standard.md` 1.1.0, ADR-0098, `2026-10-04-llm-interaction-standard-design`, `scripts/create-l3-scaffold.ts` v1.18.0, `scripts/helpers/scaffold-markers.ts` v1.8.0

## Problem

The LLM Interaction Standard ships to scaffolded projects (L1:
`templates/common/docs/standards/llm-interaction-standard.md` → project
`docs/standards/`), but two of its references describe workspace-root (L0)
surfaces a project does not have: §2.5's "AGENTS.md glossary roles" registries
and §13.1's gateway implementation path
`services/co-workspace/src/interaction.ts`. The ticket asked for a recorded
policy: genericize the references, or explicitly accept and scope the
divergence.

## Decision

**Accept and scope the divergence.** The L1 copy stays a VERBATIM mirror of L0
(byte-identical, no banner divergence between the copies); a "Layer scoping"
note inside the standard itself (both copies) declares that repo-specific
references describe the origin workspace and binds project readers to their own
local registries. Version bumped 1.0.0 → 1.1.0 (rules unchanged).

### Why this option

- **Consistent with precedent.** Other L1-shipped governance prose (e.g.
  `templates/common/docs/governance/agents/pm-gateway-workflow.md`) keeps L0
  references with inline "(Workspace root only)" scoping annotations rather
  than deleting or rewriting them.
- **No information loss.** Path-neutralization (genericizing §13.1) would erase
  the pointer to the real implementation for L0 readers — the people most
  likely to act on it.
- **No new validator surface.** An L1-only banner would create a permanent
  L0/L1 byte divergence needing a parity-check allowlist; exclusion would
  contradict ADR-0098's delivery intent (the scaffold ships the standard
  deliberately and the project AGENTS.md pointer must resolve). Verbatim +
  in-document scoping needs NO validator skip/allowlist: the flagged paths are
  inline code, not Markdown links, so `validate-docs-links.ts` never sees them.
- **One SSOT.** Because the note lives IN the standard, both layers read the
  same bytes; future parity or freshness checks over `docs/standards/` compare
  equal.

## What Changed

- `docs/standards/llm-interaction-standard.md` 1.1.0: Layer Scoping note after
  the metadata header; version line updated. Rules (§1–§14) untouched — the
  §14 short form pin in `tests/unit/co-workspace-interaction.test.ts` and the
  runtime constant in `services/co-workspace/src/interaction.ts` are unaffected.
- `templates/common/docs/standards/llm-interaction-standard.md`: mirrored
  byte-identically.

## Test plan

- `diff docs/standards/llm-interaction-standard.md templates/common/docs/standards/llm-interaction-standard.md` → identical.
- `bun scripts/validate-md-language.ts` English gate over the standards folder → clean.
- `bun scripts/validate-docs-links.ts` over the touched files → no new findings
  (the scoped paths are inline code, not links).
- Unit suite green (no test pins the standard's header block).

## Non-goals

- No validator allowlist added (not required by the chosen policy).
- No rewrite of §2.5/§13.1 text; the note scopes them instead.
