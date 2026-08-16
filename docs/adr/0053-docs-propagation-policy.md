# ADR-0053: docs Domain Propagation Policy

**Status**: Accepted
**Date**: 2026-08-16
**Deciders**: pm, architect

## Context

The `docs` domain in `propagation-map.json` has been disabled since 2026-07-08 (39 days). Two distinct problems triggered the disable:

1. **Pattern bug (now fixed)**: The original `include_pattern` of `**/*.md` was reduced by the old `globFiles()` implementation to the literal basename `*.md`, which never matched any file. This was silently fixed in `propagate-to-templates.ts` v2.1.0 by the new `globToRegExp()` function.

2. **Policy gap (this ADR)**: Even after the pattern fix, enabling the domain would copy ~143 of the 195 files under `docs/` into `templates/common/docs/` — including `docs/constitution/` (L0 SSOT content that `scripts/audit.ts`'s L0-leakage check explicitly forbids under `templates/`), `docs/lifecycle/` records, `docs/designs/` history, and variant-specific governance phase files.

Meanwhile, L1 `templates/common/docs/` has 28 independently-authored files that serve a **different purpose**: project scaffolding templates (`context.md`, `variant.context.template.md`, `README.template.md`), example docs, and variant-specific reference material (`phase-definitions.md`, `variants/pm-yaml-schema.md`). These are not mirrors of L0 content.

The 39-day disable period has created a manual sync burden for the governance files that *should* propagate (e.g., `docs/governance/platform-parity-rules.md`, `docs/governance/branch-strategy.md`), since changes at L0 must be manually replicated to L1.

## Decision

**The `docs` domain will NOT be enabled as a bulk mirror.** Instead, a **selective allowlist approach** classifies `docs/` content into three tiers:

### Tier 1 — Propagate (allowlist in propagation-map.json)

Files that define shared governance rules referenced by L0 `CLAUDE.md`/`GEMINI.md` sections that are already propagated to L1 via `--governance-l1` and `--docs` (marker-inject). These files need L1 copies so variant projects can resolve cross-references.

| File / Pattern | Rationale |
|-----------------|-----------|
| `docs/governance/platform-parity-rules.md` | Referenced by ADR-0033 sections propagated to all variants |
| `docs/governance/branch-strategy.md` | Shared git workflow rules for all projects |
| `docs/governance/pr-workflow.md` | Shared PR standards for all projects |
| `docs/governance/script-quality-gate.md` | Audit standards referenced by propagated scripts |
| `docs/governance/variant-contract.md` | Variant compliance contract referenced by all variants |

**Mechanism**: New propagation-map domain `docs-governance` with an explicit `include` allowlist (not a glob). Only the files listed above propagate. `recursive: false` with a flat allowlist array replaces the broken `**/*.md` glob.

### Tier 2 — L0-Only (never propagate)

Content that is workspace-root governance, historical records, or L0-specific operational material.

| Directory / Files | Rationale |
|--------------------|-----------|
| `docs/constitution/` | L0 SSOT — already transformed into `docs/context.md` for L1 by `scrubConstitutionRefs()` |
| `docs/adr/` | Architectural decisions are L0 governance artifacts; variants don't maintain their own ADRs |
| `docs/lifecycle/` | Workspace-root lifecycle records for agents, skills, scripts, templates |
| `docs/designs/` | Historical design documents — L0 decision history, not project scaffolding |
| `docs/reports/`, `docs/security/`, `docs/superpowers/` | L0-only operational content |
| `docs/architecture/` | L0-specific architecture analysis |
| `docs/governance/variant/*/phases.md` | Variant-specific phase definitions — managed per variant, not shared |
| `docs/governance/LIFECYCLE_GOVERNANCE.md` | References L0-specific lifecycle manager — L0-only |
| Root-level `.md` files | Getting-started, variant roadmaps, review reports — all L0-specific |

### Tier 3 — L1-Independent (already correct, no action)

Files in `templates/common/docs/` that are authored specifically for the L1 template layer and have no L0 counterpart.

| File | Purpose |
|------|---------|
| `docs/context.md` | Project context template (generated, not mirrored) |
| `docs/phase-definitions.md` | Variant phase reference (variant-specific) |
| `docs/variant.context.template.md` | Variant context scaffolding template |
| `docs/README.template.md` | Project README scaffolding template |
| `docs/_common/`, `docs/_examples/`, `docs/_templates/`, `docs/variants/` | Template scaffolding resources |

These remain independently maintained. No propagation from L0.

## Consequences

**Positive:**

- Unblocks propagation of the 5 governance files that currently require manual sync whenever L0 changes them.
- Eliminates the 39-day disable with a clear, auditable policy.
- Prevents L0-leakage violations (constitution, lifecycle, ADRs) that `scripts/audit.ts` would flag.
- L1 template docs remain purpose-built for project scaffolding — no pollution from L0 operational content.

**Negative / Trade-offs:**

- Allowlist is manual: new governance files that should propagate require a propagation-map.json update and a minor ADR amendment. This is acceptable because governance files change infrequently (~1-2 per quarter).
- The 5 Tier 1 files still need `CONSTITUTION.md` reference scrubbing (already handled by existing `scrubConstitutionRefs()` in propagate-to-templates.ts).
- L1 `templates/common/docs/` continues to diverge structurally from L0 `docs/` — they serve different purposes. This is intentional, not drift.

## Implementation

### 1. Update `propagation-map.json`

Add a new `docs-governance` domain replacing the disabled `docs` domain:

```json
"docs-governance": {
  "description": "Shared governance rule files — L0 docs/governance/ → L1 templates/common/docs/governance/",
  "source": "docs/governance",
  "target": "templates/common/docs/governance",
  "include_pattern": "*.md",
  "recursive": false,
  "include_allowlist": [
    "platform-parity-rules.md",
    "branch-strategy.md",
    "pr-workflow.md",
    "script-quality-gate.md",
    "variant-contract.md"
  ],
  "l2_drift_eligible": false,
  "note": "Allowlist-based — only shared governance rules propagate. L0-only content (constitution/, adr/, lifecycle/, designs/) excluded. ADR-0053 defines the three-tier policy."
}
```

Remove the old disabled `docs` domain entry (or mark it `deprecated` with a reference to this ADR).

### 2. Update `propagate-to-templates.ts`

Add support for an optional `include_allowlist` field in domain config. When present, a file's basename must match an entry in the allowlist to be included (applied after the glob match and existing exclude checks). This is a narrow addition to `collectDiffs()`:

```typescript
// After exclude_prefixes check, before skill/script layer checks:
const allowlist = domain.include_allowlist as string[] | undefined;
if (allowlist && !allowlist.includes(fileBasename)) continue;
```

### 3. Verify L1 Target Directory

Confirm `templates/common/docs/governance/` does not yet exist (it doesn't — L1 governance docs are flat under `templates/common/docs/`). The target path in the new domain creates this subdirectory, which is the correct location for governance rule files that variants may reference.

### 4. Dry-Run Validation

After implementation:
```bash
bun scripts/propagate-to-templates.ts --domain docs-governance --dry-run
```

Expect exactly 5 files listed (or fewer if any are already in-sync). Verify no `docs/constitution/`, `docs/adr/`, or `docs/lifecycle/` files appear.

**References:**

- ADR-0022: Governance Document Sync Strategy (marker-inject mechanism for CLAUDE.md/GEMINI.md)
- ADR-0031: L1-L2 Fork Model (variant content management)
- ADR-0037: propagate-to-templates consolidation
- `propagation-map.json` `docs` domain history note (2026-07-08 disable rationale)
