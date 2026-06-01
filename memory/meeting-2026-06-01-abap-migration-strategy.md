# Meeting Transcript
**Date**: 2026-06-01
**Topic**: abap_vibe_coding project co-develop upgrade migration strategy formulation
**Participants**: architect, automation-engineer, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[Architect]**: (Round 1)

Good that PM convened this meeting. Let's clarify the current situation first.

Based on the analysis of the abap_vibe_coding project, this project depends on a **Custom ABAP MCP server** (`./vsp`) and **SAP-specific agent system**. While structurally similar to the current workspace root (C:\git), there are key differences:

1. **Custom MCP Server**: Uses `./vsp` binary — likely the co-develop system
2. **SAP-specific Agents**: sd/mm/fi/co/pp/le-analyst don't exist in workspace root
3. **Scripts difference**: `vsp-sync.sh`/`vsp-sync.ps1` vs workspace root's `dev-sync.ts`

**automation-engineer**, do you know how the `./vsp` MCP server and custom scripts are currently implemented? This could be the core of the co-develop system.

---

**[Automation-engineer]**: (Round 1)

To supplement **architect**'s point:

Current abap_vibe_coding implementation shows:
- **MCP Server config**: `.claude/settings.json` calls `./vsp` binary directly
- **Script structure**: PowerShell/Bash hybrid + Bun/TypeScript orchestration
- **Hook system**: PostToolUse hooks are configured

**Issues identified**:
1. `./vsp` binary is an **external dependency** — not a standard workspace root pattern
2. Custom scripts (`vsp-sync`) may **not be compatible** with workspace root's audit/sync system
3. abap_vibe_coding likely uses its own audit system instead of `scripts/audit.ts`

If co-develop has changed from `./vsp` approach to workspace root's standard approach, we need to:
- Migrate `./vsp` → standard MCP server pattern
- Consolidate custom scripts → workspace root `scripts/` pattern

**docs-writer**, have you reviewed the current documentation state? AGENTS.md structure differs from workspace root.

---

**[Docs-writer]**: (Round 1)

Agreeing with **automation-engineer**'s point, adding from documentation perspective.

**Documentation issues**:
1. **AGENTS.md structure mismatch**: abap_vibe_coding separates Business/Technical Groups, workspace root uses different structure
2. **Documentation overlap**: `CLAUDE.md` + `AGENTS.md` + `docs/context.md` mixed — workspace root centers on `CLAUDE.md`
3. **Translation strategy unclear**: Need to verify if `locales/` exists in abap_vibe_coding

**Terminology consistency**:
- "co-develop" meaning is unclear:
  - Custom MCP server (`./vsp`)?
  - Custom agent dispatch system?
  - Custom workflow (vsp-sync)?

Without clear terminology definition, we cannot create a migration plan. **architect**, this needs to be defined clearly.

---

### Round 2

**[Architect]**: (Round 2)

Synthesizing **docs-writer** and **automation-engineer**'s points, I present my proposal.

**co-develop definition (proposal)**:
- **Custom ABAP Development System** — `./vsp` MCP server + SAP-specific agents + custom workflow
- **Target State**: Workspace root's standardized PM/Agent system + Standardized scripts

**Migration Architecture**:

| Component | Current (abap_vibe_coding) | Target (workspace std) | Action |
|-----------|---------------------------|----------------------|--------|
| MCP Server | `./vsp` binary | Template-based MCP config | Replace with standard pattern |
| Agents | Custom SAP agents | workspace-root style agents | Refactor dispatch logic |
| Scripts | `vsp-sync.*` + hybrid | `scripts/audit.ts` + sync | Consolidate scripts |
| Docs | AGENTS.md + context.md | CLAUDE.md + AGENTS.md | Restructure docs |

**Trade-offs**:
1. **Full Migration**: Completely to workspace root pattern — possible SAP-specific functionality loss
2. **Hybrid**: Workspace root skeleton + SAP extensions maintained — increased complexity
3. **Plugin-based**: Make abap_vibe_coding a **variant template** — integrate into workspace root

**Recommendation**: Option 3 (Plugin/Variant approach) — make abap_vibe_coding a variant of workspace root. This has highest implementation feasibility.

**automation-engineer**, can script compatibility issues be resolved when making it a variant template?

---

**[Automation-engineer]**: (Round 2)

Supporting **architect**'s variant approach, but must reflect implementation reality.

**Script Compatibility Analysis**:

| Script Type | abap_vibe_coding | Workspace Root | Compatibility |
|-------------|------------------|----------------|:-------------:|
| Utility (ps1/sh) | `vsp-sync.*` | `dev-sync.*` | ❌ Different logic |
| Audit | custom | `audit.ts` | ❌ Different pattern |
| Orchestration (ts) | custom scripts | `dispatch.*` | ❌ Different workflow |

**Problems**:
1. abap_vibe_coding's `vsp-sync` handles **SAP transport/git sync** — doesn't exist in workspace root
2. `audit.ts` requires **ABAP-specific validation** — workspace root is general-purpose
3. MCP server `./vsp` uses **ABAP ADT protocol** — no equivalent in workspace root

**Proposal**:
- **Variant approach**: Create `templates/abap-variant/`, keep SAP-specific scripts as-is
- **Shared scripts**: Only copy general-purpose scripts like `audit.ts` from workspace root
- **SAP scripts stay**: `vsp-sync.*`, `./vsp` MCP server exist only in abap-variant

**docs-writer**, how should we organize terminology when documenting the variant approach?

---

**[Docs-writer]**: (Round 2)

Organizing **automation-engineer**'s variant approach from documentation perspective.

**Variant Template Structure (proposal)**:

```
templates/
├── common/              # workspace root standard
│   ├── scripts/
│   ├── agents/
│   └── CLAUDE.md
└── abap-variant/        # abap_vibe_coding specific
    ├── scripts/         # SAP-specific (vsp-sync.*)
    ├── agents/          # SAP-specific (sd/mm/fi... analyst)
    ├── CLAUDE.md        # ABAP-specific overrides
    └── vsp/             # ABAP MCP server binary
```

**Documentation strategy**:
1. **CLAUDE.md (abap-variant)**: Base CLAUDE.md + ABAP-specific extensions
2. **AGENTS.md**: Define SAP agents in separate section
3. **README.md**: Clearly state "ABAP Development Variant"
4. **CHANGELOG.md**: Explain why variant was created in migration commit

**Terminology cleanup**:
- "co-develop" → **"Legacy ABAP Development System"** (historical term)
- "Migration" → **"Variant Template Creation"** (technical term)

**architect**, is this structure compatible with workspace root's template propagation system?

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | **Define co-develop**: Confirm with user what co-develop refers to | Phase 1 (Triage) |
| A-02 | architect | High | **Variant Template Architecture**: Design `templates/abap-variant/` structure + write ADR | Phase 2 (Design) |
| A-03 | automation-engineer | Low | **Script Compatibility Audit**: Analyze abap_vibe_coding scripts and identify what can be shared with workspace root | Phase 2 (Design) |
| A-04 | docs-writer | Medium | **Documentation Restructure Plan**: Plan to restructure AGENTS.md, CLAUDE.md to workspace root pattern | Phase 2 (Design) |
| A-05 | pm | Medium | **Migration Execution Plan**: Synthesize A-02~A-04 results into execution plan | Phase 3 (Governance) |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | co-develop definition is clearly established | User confirmation documented |
| AC-02 | Variant template structure is designed by architect | ADR created and approved |
| AC-03 | Script sharing strategy is proposed by automation-engineer | Audit report completed |
| AC-04 | Documentation restructure plan is created by docs-writer | Plan document exists |
| AC-05 | Execution plan is approved by PM | Plan ready for implementation |

---

*Transcript archived by PM following meeting-facilitation skill protocol*
