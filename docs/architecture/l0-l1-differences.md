# L0 vs L1: PM Agent Differences

**Status**: Current as of 2026-09-18 (post-ADR-0080 hiring/firing sections; supersedes the post-A-03 snapshot of 2026-06-07)

## Purpose

This document explains the structural and functional differences between the L0 (workspace root) and L1 (common template) PM agent definitions. Understanding these differences is critical for:

1. **Template Maintenance**: Knowing which changes should propagate from L0→L1→L2
2. **Variant Development**: Understanding what L2 variants inherit from L1
3. **Lifecycle Management**: Properly updating agent definitions without breaking the hierarchy
4. **Debugging**: Identifying why L0 and L1 behaviors might differ

## Hierarchy Context

This document assumes familiarity with the L0→L1→L2 hierarchy defined in:

- **[ADR-0031: L1-L2 Fork Model](../adr/0031-l1-l2-fork-model.md)** — L1→L2 relationship ends at scaffold time
- **[ADR-0039: L0→L1→L2 Hierarchy and Extends](../adr/0039-l0-l1-l2-hierarchy-and-extends.md)** — L0→L1→L2 inheritance and governance
- **[ADR-0047/0048](../adr/0047-variant-pm-extends-redundant-body-cleanup.md)** — variant pm.md converted to frontmatter-only extends stubs

**Quick Reference**:

```
L0 (Workspace Root)
  ↓ Continuous publish pipeline (dev-sync.ts)
L1 (Common Template)
  ↓ One-time scaffold (create-l3-scaffold.ts)
L3 (Project drafts: Projects/<name>/ — later promoted to L2 variant templates by l3-to-variant-pipeline.ts)
```

## Current State (2026-09-18)

Both files carry the same body sections (Role, Role Clarification, Governance Workflow, Agent Hiring & Firing, Skill Request Approval, Permission Denial Protocol, Design Gate, Required Tools, …). L1 mirrors the L0 body inside a WORKSPACE-MANAGED block; L2 variants extend L1 frontmatter-only and inherit the body. The meaningful differences are in the frontmatter and the managed-block wrapper:

| Feature | L0 (`agents/pm.md`) | L1 (`templates/common/agents/pm.md`) | Impact |
|---------|---------------------|--------------------------------------|--------|
| **Role Metadata** | Has `role: orchestrator` | Missing role field | L0 declares the orchestrator role explicitly |
| **Lifecycle Section** | Has full `lifecycle` block (`governance: docs/lifecycle/agents/pm.md`) | Missing lifecycle section | L0 tracks governance state; L1 doesn't (L0-only field per the workspace audit) |
| **Extends Field** | None (SSOT) | `extends: ../../../agents/pm.md` | L1 chains to L0; L2 variant pm.md files chain to L1 the same way |
| **Formal Name** | Missing formal_name field | Has `formal_name: Project Manager (PM) Agent` | L1 declares the canonical name for templates/docs |
| **Body Wrapper** | Plain markdown body | Body wrapped in `<!-- WORKSPACE-MANAGED: PM agent body … -->` block | Content inside the block is workspace-managed and replaced on upgrades; content outside is project-owned |

**Key Insight**: L1 is **NOT** a plain copy of L0. It chains to L0 via `extends`, wraps its body in a WORKSPACE-MANAGED block, and adds template-only fields (`formal_name`).

## Detailed Differences

### 1. L0-Exclusive: Role Metadata

```yaml
role: orchestrator
```

Explicitly declares that L0 PM is the workspace orchestrator agent. L1 is a template, not a running orchestrator, so it omits the role declaration.

### 2. L0-Exclusive: Lifecycle Section

```yaml
lifecycle:
  phase: production
  created: 2026-05-29
  last_updated: 2026-09-18
  governance: docs/lifecycle/agents/pm.md
```

Tracks L0 PM's lifecycle state and governance record. L1 is a static template — lifecycle tracking applies to concrete agent instances only (see FAQ Q2 for the L2 specialist-agent rule).

### 3. L1-Exclusive: Extends Field

```yaml
extends: ../../../agents/pm.md
```

L1 chains to the L0 SSOT; variant `pm.md` files chain to L1 identically (`extends: ../../common/agents/pm.md`). The body resolves through this chain, so a body edit at L0 reaches variants through the chain — after the L1 WORKSPACE-MANAGED mirror is updated in the same change.

### 4. L1-Exclusive: Formal Name

```yaml
formal_name: Project Manager (PM) Agent
```

Documentation sugar for templates and generated rosters. L0 identifies itself via the filename and role field.

### 5. L1-Exclusive: WORKSPACE-MANAGED Body Block

```html
<!-- WORKSPACE-MANAGED: PM agent body. Content outside this block is preserved during project upgrades. -->
… PM body (mirrored from L0) …
<!-- /WORKSPACE-MANAGED -->
```

The managed block is what `upgrade-project` (managed-block merge, `lib/managed-block-merge.ts`) replaces during template upgrades — project-owned content outside the block survives. L0 has no wrapper. (The old `<!-- VARIANT-SECTION -->` markers this document once described were removed when the extends chain landed — ADR-0039/0040/0047/0048.)

## Inheritance Implications

### How L0→L1→L2 Inheritance Works

```
L0 (agents/pm.md) — SSOT body + authority sections
  ↓ same-change mirror of the WORKSPACE-MANAGED block (agents are excluded from propagate:apply by design — ADR-0039/0043)
L1 (templates/common/agents/pm.md)
  ↓ frontmatter-only extends (L2 variants carry no body)
L2 (templates/co-*/agents/pm.md) — tier/description overrides only
```

**Key Insight**: L1 is **NOT** a direct copy of L0 — it is the template projection of L0 with template-only frontmatter and a managed body block. L2 variants are pure extends stubs.

### What L2 Variants Inherit from L1

1. ✅ **Full PM body** (governance workflow, hiring/firing authority, skill request approval, permission rules, Design Gate) — via the extends chain resolving L1's WORKSPACE-MANAGED body
2. ❌ **Lifecycle metadata** — not part of the extends chain (L0-only field; see FAQ Q2)
3. ❌ **Role declarations** — L1 doesn't have `role: orchestrator`
4. ✅ **Frontmatter overrides** — variants may re-declare `tier`, `description`, etc. (e.g. the per-variant `tier: high` escape hatch)

### Alignment Strategy

**When L0 changes, should L1 update?**

| Change Type | Propagate to L1? | Reason |
|-------------|-----------------|--------|
| Core workflow logic (incl. new authority sections) | ✅ Yes | L1's job is to provide common workflow to L2 |
| Lifecycle metadata updates | ❌ No | L1 doesn't track lifecycle |
| Role field changes | ❌ No | L1 doesn't need role declarations |
| New governance rules | ✅ Yes | All variants must follow governance |
| Permission denial protocols | ✅ Yes | Critical for PM Gateway enforcement |

**Rule of Thumb**: Propagate **workflow logic** and **governance rules** from L0→L1 (inside the WORKSPACE-MANAGED block). Skip **metadata** (lifecycle, role) that L1 doesn't carry. Note: `propagate:apply` deliberately excludes agents — the pm.md L1 mirror is a same-change manual edit.

## Maintenance Guidelines

### Keeping L0/L1 Aligned

**Do Propagate** (L0 → L1, inside the WORKSPACE-MANAGED block):

- Core workflow sections (execution plans, dispatch protocols, permission denial)
- Governance rules (PM Gateway, gates, ADR-0080 authority sections)
- Bug fixes to workflow logic
- Security policy updates

**Do NOT Propagate** (L0 only):

- Lifecycle metadata (`lifecycle` section)
- Role declarations (`role: orchestrator`)
- L0-specific sections and paths (e.g. workspace-root roster references)

**L1-Specific** (keep in L1 only):

- `formal_name` field
- The `extends:` frontmatter
- The WORKSPACE-MANAGED wrapper itself (not present at L0)

### Update Workflow

**When updating L0 `agents/pm.md`**:

1. Mirror the same body change into L1's WORKSPACE-MANAGED block (same commit)
2. Bump both frontmatter versions; run the lifecycle audits
3. Verify L0→L1 sync: `bun scripts/lifecycle-sync-audit.ts` (Check F covers tier surfaces)

**When updating L1 `templates/common/agents/pm.md`**:

1. Check if the change should apply to L0 (reverse propagation — rare)
2. Variants need no edits — they inherit via the extends chain
3. Projects receive the block through `upgrade-project` managed-block merge at their next upgrade

## FAQ

### Q1: Why doesn't L1 have lifecycle metadata?

**A**: L1 is a static template file, not a running agent instance. Lifecycle tracking (phase, last_updated, governance) is runtime state for concrete agent instances — the L0 workspace and L2/L3 specialist agents — not for the L1 common template (the workspace audit enforces lifecycle as an L0-only field there).

### Q2: Can I add lifecycle metadata to my L2 variant?

**A**: Yes — and for specialist agent files it is **required**. Each variant's own `validate-agents.ts` fails on agent files missing `lifecycle.phase` / `lifecycle.governance` (PR #588 backfilled 59 agents across existing variants; `generate-variant.ts` ≥ 1.12.0 preserves the block during promotion instead of stripping it). The exception is the extends-based `pm.md`: lifecycle is not part of the variant pm.md extends chain — `templates/common/agents/pm.md` must stay lifecycle-free (L0-only field per the workspace audit) — so variant `pm.md` files don't carry it.

### Q3: Why did L1 use a multi-line description in the past?

**A**: Earlier L1 revisions used a YAML folded block scalar (`>`) for readability. Both files now use single-line quoted descriptions; the folded form is no longer used.

### Q4: What happens if L0 and L1 get out of sync?

**A**: Body drift means L2 variants resolve outdated governance rules. Run `bun scripts/lifecycle-sync-audit.ts` to detect drift. L0→L1 is a same-change manual mirror by design (agents are excluded from `propagate:apply` — ADR-0039/0043).

### Q5: Will L1 ever become a direct copy of L0?

**A**: No — by design. L1 is the template projection of L0: `extends` frontmatter + WORKSPACE-MANAGED body + template-only fields. The old A-12 "L1 role redefinition" question was settled by the extends chain (ADR-0039/0040) and the frontmatter-only variant stubs (ADR-0047/0048).

## References

- **[ADR-0031: L1-L2 Fork Model](../adr/0031-l1-l2-fork-model.md)** — L1→L2 scaffold-time relationship
- **[ADR-0039: L0→L1→L2 Hierarchy and Extends](../adr/0039-l0-l1-l2-hierarchy-and-extends.md)** — Full governance inheritance model
- **[ADR-0080: PM Team-Management Authority](../adr/0080-pm-team-management-authority.md)** — the hiring/firing + skill request sections mirrored across L0/L1
- **[ADR-0034: PM.md Architecture Evolution](../adr/0034-pm-md-architecture-evolution.md)** — Infrastructure simplification details
- **[CONSTITUTION.md §5: Multi-Agent Architecture](../../CONSTITUTION.md#5-multi-agent-architecture)** — PM Gateway enforcement
- **[agents/pm.md](../../agents/pm.md)** — L0 production PM agent definition
- **[templates/common/agents/pm.md](../../templates/common/agents/pm.md)** — L1 template PM agent definition

---

**Document Version**: 2.0  
**Last Updated**: 2026-09-18  
**Maintainer**: docs-writer agent  
**Status**: Current (2026-09-18 refresh; v1.0 was the post-A-03 snapshot of 2026-06-07)
