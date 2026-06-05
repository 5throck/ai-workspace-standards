# ADR-0027: --domain Flag Extension Strategy for create-l2-scaffold.ts

**Status**: Accepted
**Date**: 2026-06-05
**Deciders**: architect
**Supersedes**: —

## Context

`scripts/create-l2-scaffold.ts` accepts a `--domain` flag to tailor the generated L2 scaffold for a specific domain. The script currently hardcodes four accepted values: `ehs`, `development`, `legal`, `design`. No documented process exists for adding new domain types, nor is there a canonical registry of all accepted values.

Without a defined extension strategy, new domains may be added ad hoc to the script without review, creating drift between the implemented domain list and the documented contract. This also risks premature abstraction (e.g., a plugin registry or config-file lookup) before the number of domains justifies the complexity.

**Platform Impact**: `create-l2-scaffold.ts` is an L0-only script (runs at workspace root, not deployed to variants). Antigravity: N/A — this script is not executed within Antigravity agent workflows.

## Decision

### Canonical Domain Registry

The accepted domain values are defined here and kept in sync with `create-l2-scaffold.ts`:

| Domain | Description | Introduced |
|--------|-------------|------------|
| `ehs` | Environment, Health & Safety compliance workflows | Initial |
| `development` | Software development lifecycle and code review | Initial |
| `legal` | Legal document review, contract management | Initial |
| `design` | UI/UX design systems and asset management | Initial |

### Extension Procedure

Adding a new domain requires **both** of the following, in order:

1. **Update this ADR** — add the new domain to the registry table above with its description and introduction date/PR reference.
2. **Update `create-l2-scaffold.ts`** — add the value to the accepted domain list in the same PR or commit as the ADR update.

No new domain may be added to the script without a corresponding ADR update. This creates an audit trail and a single edit point for governance review.

### Rationale for Keeping the Hardcoded List

A config-file or plugin-based registry is deferred until at least 8 domain types exist. The current approach keeps the implementation simple: one file to read, one file to update, one ADR to review.

## Consequences

**Positive:**

- Single source of truth for accepted domain values (this document)
- Audit trail: every domain addition is traceable to a PR and ADR update
- No premature abstraction — avoids unnecessary config-file indirection
- Easy to find: `docs/adr/0027` is the canonical registry

**Negative / Trade-offs:**

- Two files must be updated in lockstep (ADR + script) — a contributor could forget the ADR update
- As domain count grows beyond ~8, the hardcoded list will need revisiting

**Future Work:**

- [ ] When domain count reaches 8+, evaluate extracting the list to a JSON/YAML registry file loaded by `create-l2-scaffold.ts`
- [ ] Add a CI check that validates the script's domain list matches this ADR's registry table
