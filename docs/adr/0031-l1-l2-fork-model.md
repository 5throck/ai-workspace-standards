# ADR-0031: L1–L2 Fork Model

**Status**: Accepted
**Date**: 2026-06-05
**Deciders**: PM, architect, automation-engineer, auditor
**Supersedes**: Partially supersedes ADR-0026 §5 (manual variant registration requirement)

## Context

The workspace uses a 3-tier template system:

- **L0** — workspace root (`C:\git\`) — source of truth for scripts, agents, and skills. All canonical definitions live here.
- **L1** — `templates/common/` — a snapshot of common infrastructure published from L0. Serves as the baseline from which new L2 variants are scaffolded.
- **L2** — `templates/co-<name>/` (official templates) and `Projects/co-<name>/` (live working projects) — variant-specific environments that diverge from L1 after creation.

### Original approach and problems

Early in the project, automatic propagation from L1 to all existing L2 variants was attempted whenever L0→L1 was published. This created several recurring issues:

1. **Unintended overwrites**: L1 changes (e.g., script bug fixes or renamed agents) were automatically applied to L2 variants that had intentionally diverged, silently reverting their customizations.
2. **Wrong-direction sync**: Some automation pushed changes from L1 back into L0 or across sibling L2 variants, causing non-deterministic state.
3. **Hardcoded variant lists**: Scripts that propagated from L1 to L2 maintained explicit allowlists of variant names (e.g., `["co-consult", "co-develop", "co-safety"]`). Adding a new variant required updating multiple script files, creating a maintenance burden and a source of omission bugs.
4. **Drift ambiguity**: There was no clear distinction between "intentional drift" (a variant deliberately customized) and "accidental drift" (a variant that fell behind due to missed propagation). Automatic propagation made this impossible to reason about.

These problems surfaced during the co-safety variant creation work (June 2026) and the co-consult platform parity audit, where propagation scripts caused conflicts with variant-specific agent rosters and skill configurations.

## Decision

The workspace adopts the **Fork Model** for the L1→L2 relationship, governed by the following five principles:

### Principle 1 — Scaffold-time delivery only

L1 delivers common infrastructure to a new L2 variant exactly once, at scaffold time, via `create-l2-scaffold.ts`. After the scaffold completes, the L1→L2 relationship ends. L1 is a starting point, not an ongoing parent.

### Principle 2 — Independent evolution after fork

After forking, L2 evolves independently. Changes published to L1 (from L0) do **not** automatically propagate to any existing L2 variant. Each L2 variant owns its own files.

### Principle 3 — Explicit promotion via pipeline

To reflect L2 changes back as an official template, `l2-to-variant-pipeline.ts` must be run explicitly. This is a deliberate, operator-driven action — not an automated side effect of L0→L1 publishing.

### Principle 4 — Continuous L0→L1 publishing

The L0→L1 direction is integrated into the continuous pipeline (`dev-sync.ts` via `publish-to-template.ts`). Every sync cycle keeps L1 current with workspace root. This direction remains automated because L0 is the single source of truth and L1 has no independent customizations.

### Principle 5 — Drift reporting only

`publish-to-template.ts --check-drift` compares L1 against each L2 variant and reports differences. This is a **read-only audit**; it never applies changes. Drift between L1 and L2 is expected and normal after fork.

### Flow diagram

```
L0 (workspace root)
  │ L0→L1: publish-to-template.ts (continuous, via dev-sync)
  ▼
L1 (templates/common)
  │ scaffold-time only (1×): create-l2-scaffold.ts
  ▼
L2 (Projects/co-<name> or templates/co-<name>)
  │ evolves independently — NO automatic L1→L2 after fork
  │ explicit promotion: l2-to-variant-pipeline.ts
  ▼
templates/co-<name>/ (official template)
```

## Reconcile Boundary

When `l2-to-variant-pipeline.ts` promotes an L2 variant to an official template, the reconcile step strips files from L2 that are byte-for-byte identical to their L0 counterparts. This keeps official templates lean and avoids redundant copies of workspace-root files.

The following categories are **excluded from reconcile** and must always be present in L2, even if identical to L0:

- **Skills** — `.claude/skills/` and `.gemini/skills/` directories. Skills are execution-environment config and must be explicitly present in every variant for the harness to discover them. Absence causes silent skill resolution failures.

The following categories **are reconcile targets** (stripped if identical to L0):

- **Scripts** — `scripts/*.ts` that are pure L0 copies with no variant modifications.
- **Agent definitions** — `agents/*.md` files matching L0 exactly.

Intentional L2 customizations to these files are preserved during reconcile because they differ from L0.

## Consequences

**Positive**:

- L2 projects can diverge freely from L1 without fear of unexpected overwrites during routine L0→L1 sync cycles.
- The `new-project.sh` / `new-project.ps1` variant allowlist is now dynamic, resolved at runtime from the `templates/` directory listing. No script changes are required when a new variant is added.
- The distinction between intentional and accidental drift is explicit: drift is always intentional after fork, because propagation never happens automatically.
- Reconcile keeps official templates lean without losing variant-specific customizations.

#### Known Exception: Governance Doc Injection Target List

The `governance-*` domains in `propagation-map.json` use an explicit `target_variants` list for `publishDocs()` marker injection. This is a deliberate exception — governance section injection requires explicit opt-in per variant, unlike script propagation which is content-agnostic. Adding a new variant requires updating `propagation-map.json` governance domain lists. This is documented here to distinguish it from the eliminated hardcoded script propagation lists.

**Negative / Trade-offs**:

- L1 improvements (e.g., script bug fixes, new agent capabilities) do **not** automatically reach existing L2 variants. Propagating a fix to an L2 variant requires either re-scaffolding or a manual copy, followed by explicit promotion via `l2-to-variant-pipeline.ts`.
- Operators must be aware that an L2 variant can fall silently behind L1 improvements. The `--check-drift` flag provides visibility but no automation.

**Migration**:

- Existing L2 variants that show drift from L1 are in a valid **"intentional drift"** state. No remediation is required unless the variant maintainer chooses to adopt a specific L1 improvement.
- Running `publish-to-template.ts --check-drift` against existing variants will report differences; these are informational only and do not indicate a broken state.

## Alternatives Considered

### Option A: Continuous L1→L2 propagation with conflict detection

**Approach**: Automatically propagate L1 changes to all L2 variants on each sync, but detect and skip files with local modifications.

**Rejected because**:
- Conflict detection requires heuristics (last-write-wins vs. merge) that are fragile across agent-authored files.
- The mental model is confusing: operators cannot tell whether a variant file is "owned by L1" or "owned by L2".
- Hardcoded variant lists remain a maintenance problem.

### Option B: Git submodule for L1

**Approach**: Represent L1 as a git submodule pinned inside each L2 variant, enabling selective upstream pulls.

**Rejected because**:
- Submodule UX is complex and error-prone, especially with multi-agent automation that rewrites files.
- Submodule pinning requires explicit version management that adds overhead without clear benefit at this project scale.
- Not compatible with the existing `dev-sync.ts` / `publish-to-template.ts` pipeline architecture.

### Option C: Event-driven propagation (opt-in per variant)

**Approach**: L1 publishes a change event; each L2 variant has a config flag indicating whether to auto-accept changes in specific file categories.

**Rejected because**:
- Per-variant config flags add a new layer of governance complexity.
- Testing the interaction matrix (4 variants × N file categories × opt-in/out) is expensive.
- The simpler Fork Model (no automatic propagation) achieves the same safety property without configuration overhead.

## References

**Related Documentation**:
- [CONSTITUTION.md §5 - Multi-Agent Architecture](../../CONSTITUTION.md#5-multi-agent-architecture)
- [CONSTITUTION.md §10 - Platform Documentation Parity](../../CONSTITUTION.md)
- [CLAUDE.md §10 - Lifecycle Management Rules](../../CLAUDE.md#10-lifecycle-management-rules)

**Implementation Files**:
- `scripts/create-l2-scaffold.ts` — scaffold-time L1→L2 delivery
- `scripts/publish-to-template.ts` — L0→L1 continuous publishing and `--check-drift` audit
- `scripts/l2-to-variant-pipeline.ts` — explicit L2→official-template promotion with reconcile
- `scripts/dev-sync.ts` — continuous sync pipeline (integrates L0→L1 publish)

**Related ADRs**:
- [ADR-0026: Variant Creation Procedure](0026-variant-creation-procedure.md) — partially superseded; §5 manual allowlist replaced by dynamic directory resolution
- [ADR-0030: Auto-Mode for Antigravity Platform](0030-auto-mode-architecture.md) — parallel ADR for platform dispatcher pattern
