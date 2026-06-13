# L0 vs L1: PM Agent Differences After Auto-Mode Removal

**Status**: Current as of 2026-06-07 (Post-A-03 Auto-Mode Removal)

## Purpose

This document explains the structural and functional differences between the L0 (workspace root) and L1 (common template) PM agent definitions. Understanding these differences is critical for:

1. **Template Maintenance**: Knowing which changes should propagate from L0→L1→L2
2. **Variant Development**: Understanding what L2 variants inherit from L1
3. **Lifecycle Management**: Properly updating agent definitions without breaking the hierarchy
4. **Debugging**: Identifying why L0 and L1 behaviors might differ

## Hierarchy Context

This document assumes familiarity with the L0→L1→L2 hierarchy defined in:

- **[ADR-0031: L1-L2 Fork Model](./adr/0031-l1-l2-fork-model.md)** — L1→L2 relationship ends at scaffold time
- **[ADR-0039: L0→L1→L2 Hierarchy and Extends](../adr/0039-l0-l1-l2-hierarchy-and-extends.md)** — L0→L1→L2 inheritance and governance
- **[ADR-0034: PM.md Architecture Evolution](../adr/0034-pm-md-architecture-evolution.md)** — Automation infrastructure simplification

**Quick Reference**:

```
L0 (Workspace Root)
  ↓ Continuous publish pipeline (dev-sync.ts)
L1 (Common Template)
  ↓ One-time scaffold (create-l2-scaffold.ts)
L2 (Variant Templates: co-design, co-develop, co-security, co-work, co-consult)
```

## Current State: Post-A-03 Auto-Mode Removal

After removing Auto-Mode infrastructure (A-03), both L0 and L1 PM agent definitions were simplified:

| Level | Path | Lines | Removed | Notes |
|-------|------|-------|---------|-------|
| L0 | `agents/pm.md` | 350 | -160 | Production PM, full lifecycle metadata |
| L1 | `templates/common/agents/pm.md` | 356 | -152 | Simplified template, variant-like structure |

**Key Insight**: Despite removing similar content, **L1 is NOT a simple copy of L0**. Four key structural differences remain (see below).

## Detailed Differences: L0 vs L1

### Structural Comparison Table

| Feature | L0 (Workspace Root) | L1 (Common Template) | Impact |
|---------|-------------------|---------------------|--------|
| **Role Metadata** | Has `role: orchestrator` (3 lines) | Missing role field | L0 declares orchestrator role explicitly |
| **Lifecycle Section** | Has full `lifecycle` block (3 lines) | Missing lifecycle section | L0 tracks governance state; L1 doesn't |
| **Formal Name** | Missing formal_name field | Has `formal_name: Project Manager (PM) Agent` | L1 declares canonical name |
| **Description Format** | Single-line description | Multi-line description with `>` prefix (2 lines) | L1 uses folded YAML block scalar |
| **Variant Markers** | No variant markers | Has `<!-- VARIANT-SECTION: governance-workflow -->` (1 line) | L1 marks extendable sections (to be deprecated) |

**Total Difference**: 4 key structural elements (approx. 10 lines of content)

### Specific Line-by-Line Differences

#### 1. L0-Exclusive: Role Metadata (3 lines)

**Location**: L0 preamble (lines 5-7)

```yaml
role: orchestrator
```

**Purpose**: Explicitly declares that L0 PM is the workspace orchestrator agent.

**Why L1 Doesn't Have It**: L1 is a template, not a running orchestrator. It doesn't need role declarations.

---

#### 2. L0-Exclusive: Lifecycle Section (3 lines)

**Location**: L0 preamble (lines 8-10)

```yaml
lifecycle:
  phase: production
  created: 2026-04-10
  last_updated: 2026-06-07
  governance: pm-gateway
```

**Purpose**: Tracks L0 PM's lifecycle state, last update timestamp, and governance model.

**Why L1 Doesn't Have It**: L1 is a static template. It doesn't have runtime lifecycle state — only the L0 instance needs lifecycle tracking.

---

#### 3. L1-Exclusive: Formal Name (1 line)

**Location**: L1 preamble (line 5)

```yaml
formal_name: Project Manager (PM) Agent
```

**Purpose**: Declares the canonical human-readable name for documentation purposes.

**Why L0 Doesn't Have It**: L0 uses the filename (`agents/pm.md`) and role field for identification. Formal name is documentation sugar for templates.

---

#### 4. L1-Exclusive: Multi-line Description (2 lines)

**Location**: L1 preamble (lines 6-7)

```yaml
description: >
  The PM agent orchestrates multi-agent development workflows with mandatory
  execution plans, specialist dispatch, and lifecycle governance.
```

**Purpose**: Uses YAML folded block scalar (`>`) for multi-line readability.

**Why L0 Doesn't Have It**: L0 uses a single-line description for simplicity. The folded syntax is template documentation sugar.

---

#### 5. L1-Exclusive: Variant Section Marker (1 line)

**Location**: L1 governance-workflow section

```yaml
<!-- VARIANT-SECTION: governance-workflow -->
```

**Purpose**: Marks sections that L2 variants can extend or override (to be deprecated per A-12).

**Why L0 Doesn't Have It**: L0 is the base definition — it doesn't extend anything. Variant markers are template-specific.

## Inheritance Implications

### How L0→L1→L2 Inheritance Works

**Current Model**:

```
L0 (agents/pm.md)
  ↓ Continuous publish (dev-sync.ts)
L1 (templates/common/agents/pm.md) — Simplified template variant
  ↓ One-time scaffold (create-l2-scaffold.ts)
L2 (templates/co-*/agents/pm.md) — Full-featured variants
```

**Key Insight**: L1 is **NOT** a direct copy of L0. It's a **simplified template variant** with structural differences.

### Impact on Extends Pattern

**What L2 Variants Inherit from L1**:

1. ✅ **Core workflow logic** (governance, execution plans, specialist dispatch)
2. ✅ **Permission rules** (PM Gateway enforcement)
3. ❌ **Lifecycle metadata** (L1 doesn't have it — L2 variants don't inherit)
4. ❌ **Role declarations** (L1 doesn't have `role: orchestrator`)
5. ✅ **Variant markers** (L2 inherits extendable section markers)

**What L2 Variants DON'T Inherit from L0**:

- L2 variants **NEVER** directly inherit from L0
- L0→L1 is a publish pipeline (continuous), not inheritance
- L1→L2 is a one-time scaffold (fork model per ADR-0031)

### Alignment Strategy

**When L0 changes, should L1 update?**

| Change Type | Propagate to L1? | Reason |
|-------------|-----------------|--------|
| Core workflow logic | ✅ Yes | L1's job is to provide common workflow to L2 |
| Lifecycle metadata updates | ❌ No | L1 doesn't track lifecycle |
| Role field changes | ❌ No | L1 doesn't need role declarations |
| New governance rules | ✅ Yes | All variants must follow governance |
| Permission denial protocols | ✅ Yes | Critical for PM Gateway enforcement |

**Rule of Thumb**: Propagate **workflow logic** and **governance rules** from L0→L1. Skip **metadata** (lifecycle, role) that only L0 uses.

## Migration Notes

### For Existing L2 Variants

**If you have an L2 variant created before A-03**:

1. **Check for orphaned Auto-Mode references**:
   ```bash
   grep -r "Antigravity\|Auto-Mode\|gemini-only" templates/co-*/agents/pm.md
   ```
2. **Verify L2 has L1-style structure** (formal_name, multi-line description)
3. **Remove L0-only fields** if present (role, lifecycle sections)

**Migration Command**:
```bash
# Re-scaffold L2 from latest L1 (WARNING: overwrites local changes)
bun scripts/create-l2-scaffold.ts --variant co-design --force
```

### For New L2 Variants

**When creating a new variant template**:

1. Start from latest L1: `templates/common/agents/pm.md`
2. Add variant-specific customizations (project type, specialist agents)
3. Run `bun scripts/audit.ts` to verify lifecycle compliance
4. Test scaffold process: `bun scripts/create-l2-scaffold.ts --variant <your-variant>`

## Maintenance Guidelines

### Keeping L0/L1 Aligned

**Do Propagate** (L0 → L1):

- Core workflow sections (execution plans, specialist dispatch, permission denial)
- Governance rules (PM Gateway, Tier ceilings, Mandatory Execution Plan)
- Bug fixes to workflow logic
- Security policy updates

**Do NOT Propagate** (L0 only):

- Lifecycle metadata (`lifecycle` section)
- Role declarations (`role: orchestrator`)
- L0-specific settings (workspace root only)

**L1-Specific** (keep in L1 only):

- `formal_name` field (template documentation)
- Multi-line description format (template readability)
- `<!-- VARIANT-SECTION -->` markers (until deprecated per A-12)

### Update Workflow

**When updating L0 `agents/pm.md`**:

1. Classify change type (workflow logic vs metadata)
2. If workflow logic: update L1 manually after L0 commit
3. Run lifecycle checks: `bun scripts/audit.ts`
4. Verify L0→L1 sync: `bun scripts/lifecycle-sync-audit.ts`

**When updating L1 `templates/common/agents/pm.md`**:

1. Check if change should apply to L0 (reverse propagation)
2. Update L0 if needed (rare — mostly L0→L1)
3. Re-publish to all L2 variants: `bun scripts/create-l2-scaffold.ts --all`

### Deprecation Notice

**Variant Markers (`<!-- VARIANT-SECTION -->`)**:

- Currently used in L1 to mark extendable sections
- To be deprecated per A-12 (L1 role redefinition)
- Future: L1 may become pure content-less template
- Action: Don't add new variant markers; existing ones will be removed

## FAQ

### Q1: Why doesn't L1 have lifecycle metadata?

**A**: L1 is a static template file, not a running agent instance. Lifecycle tracking (phase, last_updated, governance) is runtime state for L0 only. Templates don't have lifecycle state.

### Q2: Can I add lifecycle metadata to my L2 variant?

**A**: Technically yes, but not recommended. L2 variants are templates too. If you need lifecycle tracking, track it in your project's `memory/` logs or ADRs, not in agent frontmatter.

### Q3: Why does L1 use multi-line description but L0 doesn't?

**A**: L1 uses YAML folded block scalar (`>`) for documentation readability. L0 prioritizes simplicity (single-line). This is a stylistic difference, not functional.

### Q4: What happens if L0 and L1 get out of sync?

**A**: Workflow logic drift causes L2 variants to have outdated governance rules. Run `bun scripts/lifecycle-sync-audit.ts` to detect drift. Manual sync required — L0→L1 is manual by design.

### Q5: Will L1 ever become a direct copy of L0?

**A**: Unclear. A-12 may redefine L1's role entirely. Current consensus: L1 is a **simplified template variant**, not a direct copy. Future direction depends on A-12 decisions.

## References

- **[ADR-0031: L1-L2 Fork Model](./adr/0031-l1-l2-fork-model.md)** — L1→L2 scaffold-time relationship
- **[ADR-0039: L0→L1→L2 Hierarchy and Extends](../adr/0039-l0-l1-l2-hierarchy-and-extends.md)** — Full governance inheritance model
- **[ADR-0034: PM.md Architecture Evolution](../adr/0034-pm-md-architecture-evolution.md)** — Infrastructure simplification details
- **[CONSTITUTION.md §5: Multi-Agent Architecture](../CONSTITUTION.md#5-multi-agent-architecture)** — PM Gateway enforcement
- **[agents/pm.md](../agents/pm.md)** — L0 production PM agent definition
- **[templates/common/agents/pm.md](../templates/common/agents/pm.md)** — L1 template PM agent definition

---

**Document Version**: 1.0  
**Last Updated**: 2026-06-07  
**Maintainer**: docs-writer agent  
**Status**: Current (post-A-03)
