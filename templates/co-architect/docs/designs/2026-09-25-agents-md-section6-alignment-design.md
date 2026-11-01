# Normalize AGENTS.md §6/§7 headings so the skill-table integrity check runs

- **Date**: 2026-09-25
- **Status**: Implemented (was approved pre-gate; header flipped to match registry per T-20261029-002)
- **Spec**: 2026-09-25-agents-md-section6-alignment

Background: this project's AGENTS.md carried `## Skills` and un-numbered `## Universal Baseline Behaviors`; audit #29 matches exactly `^## §6: Skills` with a `^## §7:` terminator, so the check silently skipped — a false negative (the section existed). Evidence: docs/analysis/2026-09-25-agents-md-duplication-audit.md F7.
Change: heading-only normalization (`## Skills` → `## §6: Skills`, `## Universal Baseline Behaviors` → `## §7:`). No content change.

## Verification

- Rescan: every project AGENTS.md carries `^## §6: Skills` with a following `^## §7:` heading (checker span).
- Workspace gates: `bun scripts/audit.ts`, `bun scripts/validate-templates.ts` green after the batch lands.
