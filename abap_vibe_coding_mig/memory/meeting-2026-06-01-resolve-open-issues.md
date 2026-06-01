# Meeting Transcript

**Date**: 2026-06-01
**Topic**: Resolution of open issues from previous meeting - .mcp.json merge, AGENTS.md roster, scripts long-term strategy
**Participants**: pm, architect, devops-admin, code-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[PM (Facilitator)]**: We have reconvened to resolve the 3 open issues identified in the previous meeting:

1. **.mcp.json merge strategy**: Coexistence strategy for ABAP servers (vsp, abap-docs, sap-docs) + codegraph
2. **AGENTS.md merge strategy**: Roster ordering logic for 25 agents (19 SAP + 6 co-develop)
3. **Scripts long-term strategy**: Replacement vs. coexistence

Each participant will present concrete solutions for each issue. Starting with Issue 1, devops-admin please present your perspective on .mcp.json merge strategy.

**[devops-admin]**: **Issue 1: .mcp.json Merge Strategy**

Our current .mcp.json has 4 MCP servers:
1. `abap`: ABAP RCE server (vsp) - local binary
2. `abap-docs`: HTTP URL (https://mcp-abap.marianze.de/mcp)
3. `sap-docs`: HTTP URL (https://mcp-sap-docs.marianze.de/mcp)
4. `codegraph`: npx -y @colbymchenry/codegraph serve

The co-develop .mcp.json has only 1:
- `codegraph`: npx -y @colbymchenry/codegraph serve

My proposed merge strategy is **additive merge**:

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "npx",
      "args": ["-y", "@colbymchenry/codegraph", "serve"]
    },
    "abap": {
      "command": "./vsp",
      "args": ["--mode", "hyperfocused"],
      "env": {
        "SAP_MODE": "hyperfocused",
        "SAP_ALLOWED_PACKAGES": "Z*,$TMP,$ZADT_VSP,$VSP_ADT",
        "SAP_FEATURE_ABAPGIT": "on",
        "SAP_FEATURE_TRANSPORT": "on",
        "SAP_FEATURE_UI5": "on",
        "SAP_FEATURE_RAP": "on"
      }
    },
    "abap-docs": {
      "type": "http",
      "url": "https://mcp-abap.marianze.de/mcp"
    },
    "sap-docs": {
      "type": "http",
      "url": "https://mcp-sap-docs.marianze.de/mcp"
    }
  }
}
```

**Rationale**:
- codegraph at top: generic-purpose service
- SAP-specific services (abap, abap-docs, sap-docs) grouped below
- All existing configurations preserved

**Conflict Mitigation**:
- co-develop only has codegraph, so no key collision
- SAP servers don't exist in co-develop, pure add operation

One **consideration**: .mcp.json is at workspace root. When migrating from co-develop template, this file must be **merged, not overwritten**. Using scripts/sync-mcp.ts with .mcp.json as SSoT (Single Source of Truth) will work.

architect, from a structural perspective, do you have additional considerations?

**[architect]**: I agree with devops-admin's additive merge strategy. From a structural perspective, this approach implements a **layered MCP architecture**:

```
Layer 1 (Generic): codegraph
Layer 2 (Domain-specific): abap + abap-docs + sap-docs
```

My additional proposal is **environmental segmentation**:

Currently our .mcp.json assumes identical SAP configuration for all environments (dev, test, prod). However, borrowing from co-develop template's approach, we could have different MCP configurations per environment:

**Option A: Single .mcp.json with conditional activation**
```json
{
  "mcpServers": {
    "abap-dev": {
      "command": "./vsp",
      "env": { "SAP_SYSTEM": "DEV", ... }
    },
    "abap-test": {
      "command": "./vsp",
      "env": { "SAP_SYSTEM": "TEST", ... }
    }
  }
}
```

**Option B: Environment-specific .mcp.json files**
- `.mcp.dev.json`
- `.mcp.test.json`
- `.mcp.prod.json`

My recommendation: **Adopt Option A (conditional activation) in Phase 3**, but for Phase 1 of migration, follow devops-admin's single .mcp.json approach. Multi-environment support is a post-migration enhancement.

**Justification**:
- co-develop template also doesn't support environment-specific configuration (single source approach)
- Our immediate priority is **SAP infrastructure preservation**, not environment management
- Multi-environment support can be added post-migration

One **critical question**: devops-admin, how does `"command": "./vsp"` resolve across platforms? Windows vs. Linux paths will differ.

**[devops-admin]**: Excellent question about cross-platform path resolution. Currently in our .mcp.json, we use `"./vsp"`, but this requires **platform-specific resolution**.

Current state:
- **Windows**: `./vsp` → `vsp.exe` (Claude Code CLI auto-adds .exe)
- **Linux**: `./vsp` → `vsp` (executable directly)

However, looking at co-develop template, codegraph uses `"npx"`, which is a **cross-platform package manager**.

My revised proposal for ABAP server configuration:

**Option A (Current)**: `"./vsp"` - platform-specific resolution
- ✅ Simple, works on both Windows and Linux
- ⚠️ Relies on Claude Code's implicit resolution

**Option B (Explicit)**: `"./vsp.exe"` on Windows, `"./vsp"` on Linux
- ✅ Explicit, no ambiguity
- ❌ Requires environment-specific .mcp.json

My recommendation: **Maintain Option A (current approach) + documentation**

Add comment at top of `.mcp.json` to make cross-platform behavior explicit:

```json
{
  "_comment": "ABAP server paths are platform-agnostic. Claude Code CLI resolves './vsp' to 'vsp.exe' on Windows, 'vsp' on Linux. vsp binary must be in project root.",
  "mcpServers": { ... }
}
```

This aligns with **co-develop template's philosophy**. co-develop's codegraph also uses `"npx"` because npm is cross-platform.

Now let's move to **Issue 2: AGENTS.md Merge Strategy**. pm, please propose the roster ordering logic.

**[pm]**: **Issue 2: AGENTS.md Merge Strategy**

Current AGENTS.md divides 19 SAP agents into **Business Group** vs **Technical Group**:

**Business Group** (Phase 1):
- pm (orchestrator)
- sd/mm/fi/co/pp/le-analyst (parallelizable)

**Technical Group** (Phase 1-4):
- sap-investigator, read-only-analyst, schema-inspector (Phase 1, parallel)
- architect (Phase 2, serial)
- dba, interface-expert (Phase 2, parallel)
- code-writer (Phase 2, serial)
- fiori-developer, form-expert (Phase 2, design parallel / write serial)
- gui-scripter (Phase 2, serial)
- test-runner (Phase 3, serial)
- devops-admin (Phase 4, serial)
- security-monitor (Security group)

The co-develop template structures 6 agents differently:
- pm, architect, automation-engineer, security-expert, docs-writer, auditor

My proposed **hybrid roster structure**:

```
## Governance Layer (NEW - from co-develop)
├── pm ( orchestrator, dispatch controller )
└── auditor ( independent verification, post-implementation )

## Business Analysis Layer
├── sd-analyst
├── mm-analyst
├── fi-analyst
├── co-analyst
├── pp-analyst
└── le-analyst

## Investigation Layer
├── sap-investigator
├── read-only-analyst
└── schema-inspector

## Architecture Layer
├── architect ( technical design lead )
└── interface-expert

## Implementation Layer
├── code-writer ( ABAP implementation )
├── fiori-developer
├── form-expert
└── gui-scripter

## Quality Assurance Layer
├── test-runner
└── security-monitor

## Operations Layer
├── devops-admin
└── dba

## Documentation Layer (NEW - from co-develop)
└── docs-writer ( technical writing, changelog authorship )
```

**Key Design Decisions**:

1. **Add Governance Layer**: pm + auditor (from co-develop)
   - auditor provides **independent verification**, strengthening governance
   - pm maintains existing orchestrator role

2. **Add Documentation Layer**: docs-writer (from co-develop)
   - Our current docs/ management is ad-hoc
   - docs-writer systematizes technical writing

3. **Restructure Security Layer**: Keep security-monitor (SAP-specific security expertise)
   - co-develop's security-expert focuses on **general-purpose security**
   - SAP security is domain-specific, so security-monitor stays

4. **Maintain Phase-based Ordering**: Map each agent to Phases 1-4
   - This aligns with our current workflow
   - co-develop also has phase-based execution

One **trade-off**: I excluded co-develop's automation-engineer because our infrastructure is VSP-specific, and automation-engineer focuses on **generic CI/CD**. Can be added later if needed.

architect, what's your structural opinion on this hybrid structure?

**[architect]**: I'll build on pm's hybrid roster structure. From a structural perspective, this is a **well-architected layered approach**.

My enhancement proposal is to **explicitly document dependency arrows** in AGENTS.md:

Current AGENTS.md only provides table format:
```
| Agent | Group | Phase | Parallelizable |
```

My proposed enhanced format:
```markdown
## Agent Dependency Graph

```
Phase 1 (Business Analysis)       Phase 2 (Technical Design)
┌─────────────────────┐          ┌──────────────────────┐
│ sd/mm/fi/co/pp/le   │─────────▶│  architect           │
│        analyst      │          └──────────┬───────────┘
└─────────────────────┘                     │
                                            ▼
                                    ┌──────────────────────┐
                                    │  code-writer        │
                                    │  fiori-developer    │
                                    └──────────┬───────────┘
                                               │
Phase 3 (Verification)                        │
┌─────────────────────┐                       │
│  test-runner        │◀──────────────────────┘
│  auditor (NEW)      │
└─────────────────────┘
```

## Agent Roster Table

| Agent | Layer | Phase | Inputs From | Outputs To | Parallelizable |
|-------|-------|-------|-------------|-------------|:--------------:|
```

**Rationale**:
1. **Visual dependency** helps PM dispatch decisions
2. Naturally integrates co-develop's auditor into our workflow
3. Makes parallelizable agents一目了然

One **critical insight**: The Governance Layer (pm + auditor) that pm proposed is from co-develop's philosophy, but it **perfectly aligns** with our SAP-specific workflow:

- **pm**: Maintains existing orchestrator role + Gateway workflow
- **auditor**: Adds independent verification in Phase 3 (code-writer output → auditor → test-runner dual verification)

This is a **win-win integration**.

Now let's move to **Issue 3: Scripts Long-Term Strategy**. code-writer, from your user perspective, what's your opinion on scripts replacement vs. coexistence?

**[code-writer]**: **Issue 3: Scripts Long-Term Strategy (Replacement vs. Coexistence)**

Scripts currently used in my daily workflow:

**Current SAP-specific scripts**:
- `vsp-sync.ps1/sh`: VSP-specific sync pipeline
- `vsp-audit.ps1/sh`: ABAP object validation
- `vsp-publish.ps1/sh`: SAP system publish
- `transport.ps1/sh`: Transport Request management

**co-develop scripts (import candidates)**:
- `audit.ts`: Comprehensive workspace audit
- `dev-sync.ts`: Generic sync pipeline
- `sync-md.ts`: Markdown date auto-update

My observed **usage pattern**:

```
# Typical daily workflow:
1. Write ABAP code (via mcp__abap__WriteSource)
2. Run vsp-audit.ps1 for ABAP validation  ← SAP-specific
3. Run sync-md.ps1 for .md file updates   ← Generic
4. Create Transport Request               ← SAP-specific
5. Run vsp-publish.ps1 to SAP system      ← SAP-specific
```

My analysis:

**Scripts that SHOULD coexist** (complementary, not competing):
- ✅ `audit.ts` + `vsp-audit.ps1`: Different purposes
  - `audit.ts`: Workspace-level compliance (CLAUDE.md consistency, link validation)
  - `vsp-audit.ps1`: ABAP object-level validation (syntax check, naming conventions)
- ✅ `sync-md.ts` + `vsp-sync.ps1`: Different scopes
  - `sync-md.ts`: Markdown files only
  - `vsp-sync.ps1`: VSP infrastructure sync

**Scripts that EVENTUALLY can be replaced** (long-term consolidation):
- 🔄 `dev-sync.ts` → **enhance** `vsp-sync.ps1` (not replace)
  - Current: `vsp-sync.ps1` is SAP-specific sync pipeline
  - Future: Add `dev-sync.ts` logic to `vsp-sync.ps1`, creating **super-sync**
- 🔄 `gen-pr-body.ts` → **adopt** from co-develop
  - Current: We have `gen-pr-body.ps1/sh`
  - Future: Use co-develop's TypeScript version for better cross-platform support

**Scripts that MUST stay SAP-specific** (domain expertise, cannot genericize):
- ❌ `transport.ps1/sh`: SAP CTS (Change and Transport System) specific
- ❌ `vsp-publish.ps1/sh`: VSP deployment specific
- ❌ `install-vsp.ps1/sh`: VSP infrastructure installation

My **long-term vision proposal**:

**Phase 1 (Immediate)**: Coexistence
- Import `audit.ts`, `sync-md.ts`, `dev-sync.ts`
- Keep all SAP-specific scripts
- Establish hybrid workflow

**Phase 2 (Medium-term)**: Selective enhancement
- Enhance `vsp-sync.ps1` with `dev-sync.ts` logic → create `vsp-dev-sync.ps1`
- Adopt `gen-pr-body.ts` to replace PowerShell version
- `audit.ts` remains complementary to `vsp-audit.ps1`

**Phase 3 (Long-term)**: SAP-first script ecosystem
- All SAP scripts remain (transport, vsp-publish, install-vsp)
- Generic scripts (audit.ts, sync-md.ts) become **pre/post hooks** in SAP scripts
- Example: `vsp-sync.ps1` calls `audit.ts` as pre-hook, then performs SAP sync

devops-admin, please evaluate the operational feasibility of this three-phase script evolution strategy.

**[devops-admin]**: I'll build on code-writer's three-phase script evolution strategy. Evaluation from an operational perspective:

**Phase 1 (Coexistence) - IMMEDIATE FEASIBLE**:
✅ **No conflict**: Scripts are just files in scripts/ directory
✅ **Parallel execution**: Both SAP-specific and co-develop scripts can coexist
✅ **Documentation**: Update docs/context.md with hybrid workflow examples
⚠️ **Effort**: 1-2 days. Import scripts, update documentation

**Phase 2 (Selective Enhancement) - MEDIUM COMPLEXITY**:

code-writer's proposed `vsp-dev-sync.ps1` creation (combining vsp-sync + dev-sync logic):

```
# Proposed vsp-dev-sync.ps1 structure
param(
    [switch]$SkipAudit,
    [switch]$SkipMcpSync,
    [switch]$SkipSapSync
)

# Phase 1: Run audit.ts (from co-develop)
if (-not $SkipAudit) {
    bun audit.ts
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

# Phase 2: Run sync-mcp.ts (from co-develop)
if (-not $SkipMcpSync) {
    bun sync-mcp.ts
}

# Phase 3: Run SAP-specific sync (legacy vsp-sync logic)
if (-not $SkipSapSync) {
    # ... existing VSP sync logic ...
}
```

✅ **Benefits**:
- Single entry point for full sync pipeline
- Granular control via switches (-SkipAudit for fast iteration)
- Combines generic + SAP-specific validation

⚠️ **Complexity**:
- Requires TypeScript script understanding in PowerShell context
- Error handling across multiple script types

**Effort**: 2-3 days. Create hybrid scripts, test thoroughly.

**Phase 3 (SAP-first script ecosystem) - LONG-TERM VISION**:

code-writer's proposal: Generic scripts become **pre/post hooks** in SAP scripts.

Example:
```powershell
# vsp-sync.ps1 (enhanced)
param()

# Pre-hook: Run audit.ts
Write-Host "Running workspace audit..."
bun audit.ts
if ($LASTEXITCODE -ne 0) {
    Write-Error "Audit failed. Aborting sync."
    exit 1
}

# Main: SAP-specific sync
Write-Host "Syncing VSP infrastructure..."
# ... existing VSP sync logic ...

# Post-hook: Run sync-md.ts (optional)
Write-Host "Updating markdown dates..."
bun sync-md.ts
```

✅ **Ultimate architecture**: SAP scripts orchestrate, generic scripts are utilities
✅ **Consistent entry points**: User always calls SAP scripts (vsp-sync, transport)
✅ **Separation of concerns**: Generic scripts are reusable utilities

⚠️ **Long-term effort**: 1-2 weeks to refactor all SAP scripts with hook architecture

My **final recommendation**:

**Immediate action**: Start Phase 1 (coexistence)
**Q3 target**: Implement Phase 2 (selective enhancement, create vsp-dev-sync.ps1)
**Q4 target**: Begin Phase 3 refactoring (gradual hook integration)

Now for **Round 2**, we will synthesize final solutions for each issue and define action items. As PM facilitator, I'll designate a synthesizer and request a comprehensive summary.

### Round 2

**[PM (Facilitator)]: In Round 1, we had detailed discussions on all 3 unresolved issues:**

**Issue 1 - .mcp.json merge**: devops-admin proposed additive merge strategy, architect considered cross-platform path resolution, agreed to maintain single source approach.

**Issue 2 - AGENTS.md roster**: pm proposed 7-layer hybrid structure, architect added dependency graph visualization for enhancement.

**Issue 3 - Scripts long-term strategy**: code-writer proposed 3-phase evolution (coexistence → selective enhancement → SAP-first ecosystem), devops-admin evaluated operational feasibility.

Now in Round 2, each participant will provide **cross-domain perspective on issues not primarily theirs**, and finally **define acceptance criteria**.

Each participant should build on or respectfully challenge issues outside their primary domain.

devops-admin, please provide cross-infrastructure perspective on Issue 2 (AGENTS.md) and Issue 3 (Scripts).

**[devops-admin]**: **Cross-Domain Perspective on Issue 2 (AGENTS.md) & Issue 3 (Scripts)**

I've discovered a **synergy** between architect's proposed **dependency graph visualization** and code-writer's proposed **script evolution**.

**Synergy 1: Agent-Driven Script Invocation**

From architect's dependency graph:
```
Phase 3:
test-runner ← auditor
```

From code-writer's Phase 3 (SAP-first script ecosystem):
```
vsp-sync.ps1 calls audit.ts as pre-hook
```

Combining these enables **agent-driven script architecture**:

```markdown
## AGENTS.md Enhanced Table

| Agent | Phase | Pre-Hook Scripts | Main Script | Post-Hook Scripts |
|-------|-------|------------------|-------------|-------------------|
| auditor | 3 | audit.ts | (reads artifacts) | (none) |
| test-runner | 3 | vsp-sync.ps1 (calls audit.ts) | runs ABAP tests | sync-md.ts |
```

**Operational implication**:
- When PM dispatches `test-runner`, it automatically calls `vsp-sync.ps1`
- `vsp-sync.ps1` pre-hook calls `audit.ts` (co-develop import)
- This creates **layered validation**: generic → SAP-specific → domain test

**Synergy 2: Script Layering Matches Agent Layering**

pm's 7-layer agent structure:
```
Layer 1: Governance (pm, auditor)
Layer 2: Business (sd/mm/fi/co/pp/le-analyst)
...
```

code-writer's 3-phase script evolution:
```
Phase 1: Coexistence (parallel scripts)
Phase 2: Selective enhancement (hybrid scripts)
Phase 3: SAP-first ecosystem (hooks)
```

My observation: **Agent layers map to script phases**

```
Layer 1 (Governance) → Phase 3 hooks (audit.ts, sync-md.ts)
Layer 2-6 (Specialists) → Phase 2 hybrid scripts (vsp-dev-sync.ps1)
Layer 7 (Operations) → Phase 1 SAP scripts (transport.ps1, vsp-publish.ps1)
```

Formalizing this mapping gives us **predictable script-agent relationship**.

**Challenge proposal**: pm, consider adding a **"Preferred Scripts" column** to AGENTS.md table to make this mapping explicit.

**[pm]**: I completely agree with devops-admin's **agent-script mapping** proposal. My enhanced AGENTS.md table proposal:

```markdown
## Hybrid Agent Roster Table (Enhanced)

| Agent | Layer | Phase | Trigger Keywords | Pre-Hook Scripts | Main Script | Post-Hook Scripts | Parallelizable |
|-------|-------|-------|------------------|------------------|-------------|-------------------|:--------------:|
| **Governance Layer** | | | | | | | |
| pm | Governance | 1 | "plan", "orchestrate", "dispatch" | (none) | (dispatches others) | memlog | Serial |
| auditor | Governance | 3 | "audit", "verify", "inspect" | audit.ts | (reads artifacts) | (none) | Serial after write |
| **Business Layer** | | | | | | | |
| sd-analyst | Business | 1 | "SD module", "sales", "shipping" | (none) | produces PRD | (none) | Parallel |
| mm-analyst | Business | 1 | "MM module", "materials", "inventory" | (none) | produces PRD | (none) | Parallel |
| fi-analyst | Business | 1 | "FI module", "finance", "accounting" | (none) | produces PRD | (none) | Parallel |
| co-analyst | Business | 1 | "CO module", "controlling", "costing" | (none) | produces PRD | (none) | Parallel |
| pp-analyst | Business | 1 | "PP module", "production", "planning" | (none) | produces PRD | (none) | Parallel |
| le-analyst | Business | 1 | "LE module", "logistics", "execution" | (none) | produces PRD | (none) | Parallel |
| **Investigation Layer** | | | | | | | |
| sap-investigator | Investigation | 1 | "investigate", "analyze impact" | (none) | produces analysis | (none) | Parallel |
| read-only-analyst | Investigation | 1 | "read only", "check state" | (none) | produces report | (none) | Parallel |
| schema-inspector | Investigation | 1 | "schema", "database", "inspect" | (none) | produces analysis | (none) | Parallel |
| **Architecture Layer** | | | | | | | |
| architect | Architecture | 2 | "design", "architect", "pattern" | (none) | produces impl. plan | (none) | Serial |
| interface-expert | Architecture | 2 | "interface", "RFC", "IDoc" | (none) | produces design | (none) | Parallel |
| **Implementation Layer** | | | | | | | |
| code-writer | Implementation | 2 | "implement", "write code", "create class" | (none) | produces ABAP code | vsp-audit.ps1 | Serial |
| fiori-developer | Implementation | 2 | "Fiori", "UI5", "OData" | (none) | produces UI | vsp-audit.ps1 | Design parallel / write serial |
| form-expert | Implementation | 2 | "form", "Adobe", "print" | (none) | produces form | vsp-audit.ps1 | Design parallel / write serial |
| gui-scripter | Implementation | 2 | "GUI", "script", "recording" | (none) | produces script | vsp-audit.ps1 | Serial |
| **Quality Assurance Layer** | | | | | | | |
| test-runner | QA | 3 | "test", "verify", "validate" | vsp-sync.ps1 (calls audit.ts) | runs ABAP tests | sync-md.ts | Serial after write |
| security-monitor | QA | 3 | "security", "vulnerability", "scan" | (none) | security scan | (none) | Parallel |
| **Operations Layer** | | | | | | | |
| devops-admin | Operations | 4 | "transport", "deploy", "install" | (none) | manages CTS | (none) | Serial |
| dba | Operations | 4 | "database", "DB", "SQL" | (none) | DB operations | (none) | Parallel |
| **Documentation Layer** | | | | | | | |
| docs-writer | Documentation | 4 | "document", "changelog", "README" | sync-md.ts | produces docs | (none) | Parallel |
```

**Key Innovation**: "Pre-Hook Scripts" and "Post-Hook Scripts" columns
- **Pre-Hook**: test-runner calls `vsp-sync.ps1` as pre-hook
- **Post-Hook**: code-writer calls `vsp-audit.ps1` as post-hook
- This formalizes devops-admin's **layered validation** concept

One **critical acceptance criterion** to add:

**AC-06**: Agent dispatch must automatically call associated scripts
- Example: PM dispatching `test-runner` → automatically runs `vsp-sync.ps1` → which calls `audit.ts`
- This requires agent definition files (agents/*.md) to include **script invocation hooks**

architect, please evaluate the architectural feasibility of this agent-script integration.

**[architect]**: pm's **agent-script integration** proposal is architecturally sound, but there's one **technical challenge**.

**Challenge**: Agent dispatch currently occurs via **Claude Code's Agent tool**. The Agent tool reads agent definition files (agents/*.md) but **cannot directly invoke scripts** in the scripts directory (.ps1/.sh/.ts files).

Current workflow:
```
PM dispatch → Agent tool → spawns subagent → subagent reads its .md file → executes
```

Proposed workflow:
```
PM dispatch → Agent tool → spawns subagent → subagent reads .md → **calls script** ← technical gap
```

**Solution Options**:

**Option A: Explicit Script Invocation in Agent Definition Files**

Add **explicit script invocation instructions** to each agent .md file:

```markdown
## agent/test-runner.md (excerpt)

### Your Tools
- RunTests: execute ABAP unit tests
- GetTestResults: retrieve test output

### Mandatory Pre-Hook (CRITICAL)
Before running any test, you MUST:
1. Call the vsp-sync.ps1 script to sync VSP infrastructure
2. Verify that audit.ts (co-develop import) passes
3. Only proceed if both hooks succeed

Implementation:
- Use Bash tool: `bun scripts/audit.ts && pwsh scripts/vsp-sync.ps1`
- If either fails, halt and report hook failure
```

✅ **Pros**: Agents are aware of scripts, explicit behavior
❌ **Cons**: Each agent .md file needs manual update, hard to maintain

**Option B: PM Gateway Orchestrates Script Hooks**

Add **script hook phase** to PM's execution plan:

```markdown
## PM Execution Plan (Enhanced)

| # | Task | Agent | Tier | Pre-Hook Script | Post-Hook Script |
|---|------|-------|------|-----------------|------------------|
| 1 | Implement ABAP class | code-writer | Medium | (none) | vsp-audit.ps1 |
| 2 | Run tests | test-runner | Medium | vsp-sync.ps1 (calls audit.ts) | sync-md.ts |
```

During PM dispatch:
1. PM calls `vsp-sync.ps1` as **pre-hook** before dispatching test-runner
2. test-runner executes normally
3. PM calls `sync-md.ts` as **post-hook** after test-runner completes

✅ **Pros**: Centralized orchestration, single source of truth (PM's execution plan)
✅ **Pros**: Agent .md files remain unchanged, minimal maintenance
❌ **Cons**: PM becomes bottleneck for all script invocations

My recommendation: **Option B (PM Gateway Orchestrates)**

**Rationale**:
1. **Single source of truth**: PM execution plan table already exists (from CONSTITUTION.md §5)
2. **Separation of concerns**: Agents focus on domain logic, PM focuses on orchestration
3. **Flexibility**: Pre/post hooks can be configured per task, not hardcoded per agent

**Implementation**:
Add "Pre-Hook Script" and "Post-Hook Script" columns to PM's execution plan table, and **enhance PM's behavior** to automatically call these during dispatch.

This is an **architecturally clean** approach. code-writer, can you show a scenario of how this PM-orchestrated hooks would work in actual code implementation workflow?

**[code-writer]**: Building on architect's **PM-orchestrated hooks** proposal, I'll demonstrate a concrete workflow scenario.

**Scenario**: New ABAP class implementation (typical daily task)

```
[User Request]: "Create ZCL_ORDER_PROCESSOR class for SD order processing"
```

**Current Workflow (Before Integration)**:
```
1. PM dispatch → sd-analyst (produces PRD)
2. PM dispatch → architect (produces implementation plan)
3. PM dispatch → code-writer (implements class)
4. code-writer manually calls vsp-audit.ps1 ← ad-hoc, inconsistent
5. PM dispatch → test-runner (runs tests)
6. test-runner manually calls vsp-sync.ps1 ← ad-hoc, inconsistent
```

**Enhanced Workflow (With PM-Orchestrated Hooks)**:

**PM's Execution Plan Table**:
```markdown
| # | Task | Agent | Tier | Pre-Hook | Post-Hook | Model |
|---|------|-------|------|----------|-----------|-------|
| 1 | Analyze SD business requirements | sd-analyst | Medium | (none) | memlog | sonnet |
| 2 | Design implementation plan | architect | High | (none) | (none) | opus |
| 3 | Implement ZCL_ORDER_PROCESSOR | code-writer | Medium | (none) | vsp-audit.ps1 | sonnet |
| 4 | Verify implementation | auditor | Medium | audit.ts | (none) | sonnet |
| 5 | Run ABAP unit tests | test-runner | Medium | vsp-sync.ps1 | sync-md.ts | sonnet |
| 6 | Document in CHANGELOG | docs-writer | Low | (none) | (none) | haiku |
```

**Step-by-Step Execution**:

**Step 1-2**: No change (sd-analyst, architect execute normally)

**Step 3**: PM dispatches code-writer
```markdown
PM: [Executing Step 3 - code-writer]
    Agent: code-writer (Medium tier, sonnet)
    Post-Hook: vsp-audit.ps1 will run after completion
```
code-writer implements class → completion → **PM automatically calls `vsp-audit.ps1`**
→ ✅ ABAP syntax validation passes

**Step 4**: PM dispatches auditor (NEW - from co-develop)
```markdown
PM: [Executing Step 4 - auditor]
    Agent: auditor (Medium tier, sonnet)
    Pre-Hook: audit.ts running...
```
**PM calls `audit.ts`** → ✅ Workspace compliance passes → auditor executes
→ Auditor reviews code-writer's output independently → ✅ No issues found

**Step 5**: PM dispatches test-runner
```markdown
PM: [Executing Step 5 - test-runner]
    Agent: test-runner (Medium tier, sonnet)
    Pre-Hook: vsp-sync.ps1 running...
```
**PM calls `vsp-sync.ps1`** → this internally calls **audit.ts again** (per code-writer's Phase 3 proposal)
→ ✅ Double validation (generic + SAP-specific) passes → test-runner executes
→ Tests pass → **PM automatically calls `sync-md.ts`** → ✅ Markdown dates updated

**Step 6**: PM dispatches docs-writer (NEW - from co-develop)
docs-writer updates CHANGELOG.md → completion

**Key Observations**:

1. **Layered Validation Achieved**:
   - Step 3 post-hook: vsp-audit.ps1 (SAP-specific validation)
   - Step 4 pre-hook: audit.ts (generic workspace validation)
   - Step 5 pre-hook: vsp-sync.ps1 (calls audit.ts again + SAP sync)

2. **No Manual Script Invocation**: All scripts called by PM automatically via pre/post hooks

3. **Consistent Entry Point**: User only interacts with PM, never directly calls scripts

4. **Audit Layering**:
   - audit.ts runs **twice** (step 4 + step 5 pre-hook)
   - This is **intentional redundancy**: workspace validation before agent execution + before test execution

5. **Independent Verification**:
   - auditor (step 4) provides independent review of code-writer's work
   - This is co-develop's governance contribution

One **critical insight**: In Step 5, vsp-sync.ps1 calling audit.ts is the concept from code-writer's **SAP-first ecosystem (Phase 3)**. PM orchestration + script hooks = **perfect integration**.

devops-admin, how would you design **error handling** and **rollback** in this workflow?

**[devops-admin]**: code-writer's workflow scenario is an excellent demonstration. I'll design error handling and rollback.

**Error Handling Strategy**:

**Principle**: **Fail Fast, Clear Diagnosis, Partial Rollback**

```markdown
## PM Error Handling Table

| Step | Agent | Hook | Error Type | Action | Rollback Scope |
|------|-------|------|------------|--------|----------------|
| 3 | code-writer | Post-Hook: vsp-audit.ps1 | ABAP syntax error | ❌ Halt, report error | Rollback ABAP object (via MCP) |
| 4 | auditor | Pre-Hook: audit.ts | Link validation failed | ❌ Halt, report error | No rollback (documentation fix) |
| 5 | test-runner | Pre-Hook: vsp-sync.ps1 | VSP sync failed | ❌ Halt, report error | No rollback (infrastructure fix) |
| 5 | test-runner | Post-Hook: sync-md.ts | Date update failed | ⚠️ Warn, continue | Manual fix (non-critical) |
```

**Implementation: PM's Hook Execution Logic**

```markdown
## PM Hook Execution (Pseudo-code)

function executeAgentWithHooks(agent, preHook, postHook) {
    // Pre-Hook Phase
    if (preHook) {
        result = execute(preHook)
        if (result.exitCode !== 0) {
            if (preHook === "audit.ts") {
                // Documentation errors are non-blocking but should be reported
                log("⚠️ Workspace audit failed. Continue with agent execution.", result.stderr)
            } else {
                // Infrastructure errors are blocking
                halt("❌ Pre-hook failed. Agent execution aborted.", result.stderr)
                return
            }
        }
    }
    
    // Agent Execution Phase
    agentResult = execute(agent)
    
    // Post-Hook Phase
    if (postHook) {
        result = execute(postHook)
        if (result.exitCode !== 0) {
            if (postHook === "vsp-audit.ps1") {
                // ABAP validation errors are critical
                halt("❌ Post-hook validation failed. Agent output rejected.", result.stderr)
                rollbackAgentOutput(agent, agentResult)
                return
            } else if (postHook === "sync-md.ts") {
                // Date update errors are non-critical
                log("⚠️ Markdown date update failed. Agent output accepted.", result.stderr)
            }
        }
    }
    
    return agentResult
}
```

**Rollback Strategies by Error Type**:

**Type 1: ABAP Object Errors (Critical)**
- **Scenario**: code-writer post-hook (vsp-audit.ps1) fails with syntax error
- **Action**:
  1. PM calls `mcp__abap__DeleteSource` to rollback the created object
  2. Report error to user with specific line number and syntax issue
  3. Suggest: Fix syntax and retry step 3
- **Scope**: Single ABAP object rollback

**Type 2: Infrastructure Errors (Blocking)**
- **Scenario**: test-runner pre-hook (vsp-sync.ps1) fails with VSP connection error
- **Action**:
  1. PM halts execution (does not dispatch test-runner)
  2. Report infrastructure error to user
  3. Suggest: Fix VSP connection, then retry step 5
- **Scope**: No rollback (agent didn't execute)

**Type 3: Documentation Errors (Non-Blocking)**
- **Scenario**: auditor pre-hook (audit.ts) fails with broken link
- **Action**:
  1. PM logs warning but continues with auditor execution
  2. Auditor may identify the same issue and add to deliverable
  3. Post-completion: User fixes broken links
- **Scope**: No rollback (documentation issue)

**Type 4: Non-Critical Errors (Warning)**
- **Scenario**: test-runner post-hook (sync-md.ts) fails
- **Action**:
  1. PM logs warning
  2. Agent output accepted
  3. Post-completion: User manually fixes markdown dates
- **Scope**: No rollback (cosmetic issue)

**Acceptance Criteria for Error Handling**:

**AC-07**: PM must differentiate between **critical errors** (ABAP syntax, infrastructure) and **non-critical warnings** (documentation, cosmetic)
- Critical: Halt execution, rollback if applicable
- Non-critical: Log warning, continue execution

**AC-08**: Each error type must have **clear user messaging** with:
- What failed (specific script and error message)
- Why it matters (impact assessment)
- How to fix (actionable suggestion)

Now for **Round 2 Synthesis**, security-monitor as synthesizer will provide a comprehensive cross-domain perspective summary.

**[security-monitor]**: (Synthesis)

## Cross-Domain Security & Governance Synthesis

### Points of Agreement

**1. Three-Pronged Solution Consensus**
Full agreement on concrete solutions for each unresolved issue:
- **Issue 1 (.mcp.json)**: devops-admin's additive merge strategy + architect's single source approach
- **Issue 2 (AGENTS.md)**: pm's 7-layer hybrid structure + architect's dependency graph
- **Issue 3 (Scripts)**: code-writer's 3-phase evolution + devops-admin's operational feasibility

**2. PM-Orchestrated Hook Architecture Consensus**
architect's proposed and all participants built upon **PM Gateway hook orchestration** has been adopted. This provides:
- No changes to agent .md files (separation of concerns)
- Pre/post-hook columns added to PM execution plan table
- Centralized orchestration, single source of truth

**3. Layered Validation Architecture Consensus**
devops-admin identified and code-writer demonstrated with concrete scenario, **layered validation** agreed upon:
```
Generic validation (audit.ts) → SAP-specific validation (vsp-audit.ps1) → Domain tests (ABAP unit tests)
```
This is **redundancy by design**, multiple validation layers guarantee quality.

**4. Error Handling Strategy Consensus**
devops-admin's **fail fast with clear diagnosis** strategy agreed upon:
- Critical errors (ABAP syntax, infrastructure): Halt + rollback
- Non-critical warnings (documentation, cosmetic): Log + continue
- Each error type has clear user messaging

### Open Disagreements or Unresolved Questions

**1. Hook Execution Frequency Trade-off**
In code-writer's workflow scenario, **audit.ts executes twice** (step 4 + step 5 pre-hook):
- **Pros**: Double validation guarantees workspace compliance
- **Cons**: Redundant execution wastes tokens (~500-1000 tokens per run)
- **Unresolved**: Cache audit.ts result? Or accept redundancy as quality assurance?

**2. PM Gateway Complexity vs. Agent Autonomy**
architect's Option B (PM orchestrates hooks) is a **centralized** approach, but:
- **pm**: PM already has execution plan table, minimal complexity increase
- **architect**: Clean separation, agents focus on domain logic
- **Potential concern**: PM becomes bottleneck, single point of failure
- **Unresolved**: What if PM hook execution fails? Does entire workflow halt?

**3. Script Phase Migration Timeline Ownership**
All agreed on code-writer's 3-phase script evolution:
- **Phase 1 (Coexistence)**: 1-2 days, immediately feasible
- **Phase 2 (Selective enhancement)**: 2-3 days, Q3 target
- **Phase 3 (SAP-first ecosystem)**: 1-2 weeks, Q4 target
- **Unresolved**: Who owns each phase? devops-admin owns all, or split ownership?

### Concrete Next Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-06 | devops-admin | High | .mcp.json merge implementation: Add ABAP servers (abap, abap-docs, sap-docs) to co-develop's .mcp.json template | 1 |
| A-07 | architect | High | AGENTS.md hybrid table creation: 7-layer structure with 25 agents (19 SAP + 6 co-develop) + dependency graph | 3 |
| A-08 | pm | High | PM Gateway hook orchestration design: Execution plan table with Pre-Hook/Post-Hook columns + error handling logic | 1 |
| A-09 | code-writer | Medium | Script Phase 1 execution plan: Import audit.ts, dev-sync.ts, sync-md.ts with documentation updates | 1 |
| A-10 | devops-admin | Medium | Error handling implementation: Critical vs. non-critical error classification + user messaging templates | 2 |

### Enhanced Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-06 | PM-orchestrated hooks working | PM execution plan with pre/post-hook columns dispatches agents and calls scripts automatically |
| AC-07 | Error handling by type | Critical errors halt + rollback; non-critical errors warn + continue |
| AC-08 | .mcp.json additive merge | .mcp.json includes codegraph + 4 SAP servers without conflicts |
| AC-09 | AGENTS.md hybrid table | AGENTS.md includes 25 agents across 7 layers with dependency graph visualization |
| AC-10 | Script coexistence | audit.ts, dev-sync.ts, sync-md.ts work alongside existing SAP scripts without conflicts |

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-06 | devops-admin | High | .mcp.json merge implementation: Add ABAP servers (abap, abap-docs, sap-docs) to co-develop's .mcp.json template | 1 |
| A-07 | architect | High | AGENTS.md hybrid table creation: 7-layer structure with 25 agents (19 SAP + 6 co-develop) + dependency graph | 3 |
| A-08 | pm | High | PM Gateway hook orchestration design: Execution plan table with Pre-Hook/Post-Hook columns + error handling logic | 1 |
| A-09 | code-writer | Medium | Script Phase 1 execution plan: Import audit.ts, dev-sync.ts, sync-md.ts with documentation updates | 1 |
| A-10 | devops-admin | Medium | Error handling implementation: Critical vs. non-critical error classification + user messaging templates | 2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-06 | PM-orchestrated hooks working | PM execution plan with pre/post-hook columns dispatches agents and calls scripts automatically |
| AC-07 | Error handling by type | Critical errors halt + rollback; non-critical errors warn + continue |
| AC-08 | .mcp.json additive merge | .mcp.json includes codegraph + 4 SAP servers without conflicts |
| AC-09 | AGENTS.md hybrid table | AGENTS.md includes 25 agents across 7 layers with dependency graph visualization |
| AC-10 | Script coexistence | audit.ts, dev-sync.ts, sync-md.ts work alongside existing SAP scripts without conflicts |

---

**Synthesis Summary**:

**Points of Agreement**:
1. Three-pronged solution consensus for all open issues (.mcp.json, AGENTS.md, scripts)
2. PM-orchestrated hook architecture adopted with centralized orchestration
3. Layered validation architecture (generic → SAP-specific → domain) agreed upon
4. Error handling strategy (critical vs. non-critical) with clear user messaging

**Open Disagreements**:
1. Hook execution frequency: audit.ts runs twice - cache or accept redundancy?
2. PM Gateway complexity: Centralization vs. agent autonomy trade-off
3. Script phase ownership: Who owns which phase of 3-phase evolution?

**Next Actions**: 5 action items assigned (A-06 to A-10) with specific owners and phases. Phase 1 items (A-06, A-08, A-09) can start immediately. Phase 2 (A-10) and Phase 3 (A-07) require dependencies to be resolved first.
