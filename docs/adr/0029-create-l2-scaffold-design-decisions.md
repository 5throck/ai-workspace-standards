# ADR-0029: create-l2-scaffold.ts Design Decisions (Retroactive)

**Status**: Accepted
**Date**: 2026-06-05
**Deciders**: architect, automation-engineer
**Supersedes**: —

## Context

`create-l2-scaffold.ts` was implemented to automate Phase A scaffold creation for new workspace variants (L2 / Projects/), replacing the manual process used for co-safety that required 18+ remediation steps. Four design decisions were made during implementation without prior architectural review. This ADR documents them retroactively to correct that governance gap.

---

## Decision 1: Tier 3 Exclusion List — Hardcoded in Script

### Context

`create-l2-scaffold.ts` copies `scripts/` from `templates/common/` into the L2 project. It must exclude L0-only scripts (bootstrap, template-management, setup scripts) that have no meaning inside a variant project. SCRIPTS.md is the source of truth for Tier classification, but the script does not parse it at runtime.

### Decision

The exclusion list (`TIER3_EXCLUDE_SCRIPTS`) is hardcoded as a `Set<string>` constant at the top of the script. SCRIPTS.md remains the authoritative reference; the hardcoded list must be manually kept in sync when new L0-only scripts are added. ADR-0027 governs the process for extending the exclusion list when new L0-only scripts are introduced.

**Platform Impact**: L0-only — this script runs at workspace root only; Antigravity: N/A.

### Consequences

- Positive: Simple, zero-dependency — no SCRIPTS.md parse logic to maintain.
- Negative: Manual sync burden; if a new L0-only script is added to `templates/common/scripts/` without updating the exclusion list, it will be incorrectly copied into L2 variants.
- Future: Task A-05 will refactor the exclusion mechanism to parse SCRIPTS.md at runtime, eliminating the manual sync requirement (tracked separately).

---

## Decision 2: Agent SKILL.md 3-Section Structure

### Context

Domain agents in L2 variants require a standardized format that covers both the agent's domain role and its integration with both supported platforms (Claude Code and Antigravity). This structure was reverse-engineered from Phase A agent files created during co-safety scaffolding.

### Decision

All variant agent files must follow a canonical 3-section structure:

- **Section A** — Role/Domain: agent identity, domain scope, responsibilities.
- **Section B** — Claude Code Integration: tool permissions, session behavior, slash-command wiring.
- **Section C** — Antigravity Integration: agent manifest, capability flags, tool bindings for Antigravity sessions.

Section C is mandatory in every agent file. Agents missing Section C fail `PROMOTION_CHECKLIST` Condition 5 (platform parity). `create-l2-scaffold.ts` generates agent stubs with all three section headers pre-populated so new agents cannot accidentally omit Section C.

**Platform Impact**: Both — Section C is specifically for Antigravity; omitting it breaks Antigravity sessions for that agent.

### Consequences

- Positive: Consistent agent files across all variants; platform parity enforced at scaffold time rather than caught at promotion.
- Negative: Section C stubs require manual completion before the agent is usable in Antigravity sessions.
- Future: `PROMOTION_CHECKLIST` Condition 5 check can be automated via frontmatter scan (see Decision 4).

---

## Decision 3: variant.json Schema

### Context

No `variant.json` schema existed prior to co-safety. The file is read by both Claude Code and Antigravity sessions to determine variant identity, inheritance, and lifecycle state. The schema was designed during co-safety implementation.

### Decision

The canonical `variant.json` schema includes:

| Field | Description |
|-------|-------------|
| `name` | Kebab-case variant identifier |
| `displayName` | Human-readable name |
| `type` | Variant category (e.g., `ehs`, `develop`, `security`) |
| `status` | Lifecycle status (`phase-a`, `promoted`, etc.) |
| `version` | Semver variant version |
| `inherits_common` | Boolean; whether variant inherits `templates/common/` |
| `agent_overrides` | Array of agent identifiers overriding common agents |
| `skill_manifest` | Object with `variant_specific` array; each entry may include `legal_basis` |
| `lifecycle` | Object: `statusSince`, `lastTransition`, `stablePromotedOn` |
| `createdAt` | ISO 8601 creation date |
| `phaseAComplete` | Boolean |
| `promotionChecklist` | Object tracking promotion gate conditions |

The `legal_basis` field in `skill_manifest` entries is mandatory for EHS, legal, and compliance domain variants to document the regulatory basis for each variant-specific skill.

**Platform Impact**: Both — `variant.json` is read by both Claude Code and Antigravity sessions.

### Consequences

- Positive: Single structured file provides variant identity, platform parity state, and lifecycle history in one place.
- Negative: Schema is not validated by a JSON Schema document; drift is possible.
- Future: A JSON Schema file (`variant.schema.json`) should be introduced at workspace root and referenced from `validate-templates.ts` to enforce schema compliance at audit time.

---

## Decision 4: agents/ Frontmatter Scan for Specialist List (Deferred)

### Context

When `create-l2-scaffold.ts` generates `CLAUDE.md` for an L2 variant, it must populate the Specialist Agent List with variant-specific agents rather than L0 workspace agents (architect, automation-engineer, etc.). The correct agent list depends on which `.md` files exist under `agents/` and their YAML frontmatter `tier` field.

### Decision

The intended approach is to scan the `agents/` directory at scaffold time, read the `tier` YAML frontmatter field from each agent file, and auto-generate the Specialist Agent List grouped by tier. This is deferred to task B-05. The current scaffold emits placeholder text in the Specialist Agent List section of the generated `CLAUDE.md`, requiring manual completion after scaffolding.

**Platform Impact**: Both — the generated `CLAUDE.md` is the primary governance document for both Claude Code and Antigravity sessions in the variant.

### Consequences

- Positive (deferred state): Scaffold completes without requiring agents/ to be fully populated first; placeholder makes the gap visible.
- Negative: Manual step required post-scaffold; risk of stale or incomplete Specialist Agent List if the placeholder is not filled in before promotion.
- Future: B-05 implementation will eliminate the manual step by parsing `tier` frontmatter at scaffold time.
