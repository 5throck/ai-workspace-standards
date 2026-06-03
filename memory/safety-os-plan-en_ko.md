---
name: safety-os-execution-plan-en
description: Safety OS (co-safety variant) full execution plan — consolidated from 6 meetings. Self-contained reference document for resuming work in any future session.
metadata:
  type: project
---

# Safety OS Execution Plan
**Created**: 2026-06-03
**Last Updated**: 2026-06-03 (Meeting 6 — Phase 2 detailed)
**Current Status**: Plan confirmed, awaiting execution (S-00 not started)
**Korean version**: [safety-os-plan_ko.md](safety-os-plan_ko.md)

---

## 1. Background & Objectives

### Why

South Korea's EHS sector faces rapidly increasing legal liability since the Serious Accidents Punishment Act took effect in 2022. Safety managers handle 20–40 regulations manually while performing daily tasks such as risk assessments, permit-to-work issuance, and equipment inspections. An AI Agent-based Safety Operating System (Safety OS) automates these workflows and establishes auditable evidence trails.

### What

```
Deliverables:
  v3.0  Safety OS Architecture Blueprint     (Enterprise Reference Architecture, ~25p Draft)
  v3.1  Workflow Catalog                     (Manufacturing complete, 4 industries scaffold)
  v3.2  Skill Catalog                        (4 core skills)
  v3.3  Agent Prompt Pack                    (PM/SGM/SWM + 4 core agents)
  v3.4  GitHub Repository Starter Kit        (Projects/safety-os/ implementation)
  v4.0  Complete Safety OS Playbook          (Phase 2 — auto-assembled via generate-playbook.ts)
```

### How

Follows the existing workspace **Harness Engineering methodology**:
- Discover → Reuse → Adapt → Create
- GitHub-Native: all artifacts version-controlled
- Evidence-Based: every workflow linked to audit evidence
- Platform-Neutral: works on both Claude Code and Antigravity

---

## 2. Overall Architecture

### Governance Hierarchy

```
PM Agent  ←  Chief Safety Officer (CSO) role
  │           Overrides existing workspace pm.md with Safety OS context
  │
  ├── Safety Governance Manager (SGM)  ←  Strategy
  │     - Select Industry Profile
  │     - Define KPIs and compliance objectives
  │     - Approve policies and standards
  │
  └── Safety Workflow Manager (SWM)   ←  Execution
        - Select and execute workflows
        - Dynamically assemble Agent Teams
        - Manage task progress and evidence collection

PM → SGM: when strategic decisions are needed
PM → SWM: for all operational dispatch
PM → SWM direct (skip SGM): emergency scenarios — immediate response
```

### 5-Layer Architecture

```
Layer 1  Agent Pool           15 agents (MVP: 7)
Layer 2  Industry Profile     5 industry definition files (MVP: manufacturing only)
Layer 3  Workflow Library     SSOT — the most critical layer
Layer 4  Scenario Library     Emergency response scenarios
Layer 5  Evidence Graph       Audit traceability — Finding → Corrective Action
```

### Workflow 3-Tier (80:20 Rule)

```
Daily Operations  80%  →  workflows/daily/
  Risk Assessment / Permit to Work / Equipment Inspection
  Contractor Management / Safety Training / Safety Patrol

Compliance  10%  →  workflows/compliance/
  Internal Audit / Compliance Check / Regulatory Update Response

Emergency  10%  →  workflows/emergency/
  Fire Response / Chemical Release / Serious Accident / Typhoon / Earthquake
```

### Agent Prompt 3-Section Structure (Platform-Neutral)

Every agent `.md` file follows this structure:

```markdown
## Section A: Role & Responsibility
# Platform-agnostic — identical for Claude Code and Antigravity
# Role, responsibilities, I/O contract, legal basis

## Section B: Claude Code Integration
# Skill invocation: /risk-assessment
# Agent dispatch: Agent tool
# Tool use: Read, Write, Bash

## Section C: Antigravity Integration
# Skill invocation: activate_skill risk-assessment
# Agent dispatch: agent_manager
# Tool use: read_file, write_file, run_command
```

---

## 3. Development Strategy (2 Phases)

### Phase A — Independent Prototype

**Location**: `Projects/safety-os/`
**Principle**: develop independently without touching workspace root

```
Rationale:
  - Fast experimentation and structural validation
  - No workspace impact on failure
  - Only stable, validated outputs promoted to workspace
```

**Common drift prevention**:
- `_ORIGIN.md`: list of files copied from common
- `_COMMON_VERSION.md`: workspace common version snapshot at copy time

### Phase B — Workspace Promotion

**Condition**: all 7 items in `PROMOTION_CHECKLIST.md` pass
**Location**: create `templates/co-safety/` → propagate to workspace root

```
L1 (Workspace Root)     ←  editing SSOT
      ↓
L2 (templates/co-safety/)  ←  variant definition
      ↓
L3 (Projects/safety-os/)   ←  creation-time snapshot (Phase A output)
```

---

## 4. Full Folder Structure (Phase A MVP)

```
Projects/safety-os/
│
│  # ── Tracking files (new)
├── _ORIGIN.md                     ← list of files copied from common
├── _COMMON_VERSION.md             ← workspace common version + git hash snapshot
├── PROMOTION_CHECKLIST.md         ← 7 Phase B criteria
│
│  # ── Common inherited (copied from workspace root, minimal changes)
├── CLAUDE.md                      ← Safety OS context addition only
├── GEMINI.md                      ← parity with CLAUDE.md
├── AGENTS.md                      ← includes Safety agent roster
├── CHANGELOG.md
├── .gitignore
├── .env.sample
│
│  # ── Memory (Safety OS extended)
├── memory/
│   ├── MEMORY.md
│   ├── incidents/                 ← incident records (Safety OS only)
│   ├── findings/                  ← audit findings
│   └── corrective-actions/        ← corrective action records
│
│  # ── Agent definitions
├── agents/
│   ├── pm.md                      ← [copied + CSO override added]
│   ├── safety-governance-manager.md  ← [new] SGM — strategy
│   ├── safety-workflow-manager.md    ← [new] SWM — execution (Harness Prompt)
│   ├── compliance-agent.md           ← [new] regulatory compliance
│   ├── risk-assessment-agent.md      ← [new] risk assessment specialist
│   ├── emergency-agent.md            ← [new] emergency response
│   └── audit-agent.md                ← [new] audit specialist
│
│  # ── Skill definitions (3-section platform-neutral)
├── skills/
│   ├── risk-assessment/SKILL.md
│   ├── permit-to-work/SKILL.md
│   ├── emergency-response/SKILL.md
│   └── compliance-gap/SKILL.md
│
│  # ── Regulation registry (metadata only — content retrieved via MCP)
├── regulations/
│   ├── _REGISTRY.md               ← master regulation list (human-maintained)
│   └── KR/
│       └── tier1-laws/
│           ├── occupational-safety-health-act.yaml
│           └── serious-accidents-punishment-act.yaml
│
│  # ── Industry profiles
├── industry-profiles/
│   └── manufacturing.yaml         ← MVP: manufacturing only
│
│  # ── Workflow Library (SSOT)
├── workflows/
│   ├── _template/
│   │   ├── README.md              ← 7-section standard format
│   │   └── schema.yaml            ← machine-readable metadata
│   ├── daily/
│   │   └── manufacturing/
│   │       ├── _INDEX.md          ← status/applicability/legal_basis columns
│   │       ├── risk-assessment/
│   │       ├── permit-to-work/
│   │       ├── equipment-inspection/
│   │       ├── contractor-management/
│   │       ├── safety-training/
│   │       └── safety-patrol/
│   ├── compliance/                ← folder structure only
│   └── emergency/                 ← folder structure only
│
│  # ── Audit traceability models
├── evidence-models/
│   └── base/
│       ├── finding.schema.json
│       └── corrective-action.schema.json
│
│  # ── v3.0 Blueprint document (Draft)
├── docs/
│   ├── context.md                 ← existing 10 sections + Safety 4 sections
│   └── blueprint/
│       ├── 01-executive-summary.md
│       ├── 02-architecture.md
│       ├── 03-governance.md       ← HIGHEST PRIORITY (PM/SGM/SWM structure)
│       ├── 04-agent-catalog.md
│       └── 05-implementation-roadmap.md
│
│  # ── Automation scripts
├── scripts/
│   └── safety-audit.ts            ← legal_basis missing check
│
│  # ── MCP configuration
└── .mcp.json                      ← MVP: codegraph only
```

---

## 5. File Authoring Specifications

### 5.1 `_ORIGIN.md`

```markdown
# Origin Tracking
This project is under independent development based on workspace common v[version].
Planned for promotion to templates/co-safety/ in Phase B.

## Files Copied from Common (sync required on change)
- CLAUDE.md (base: workspace root/CLAUDE.md)
- GEMINI.md (base: workspace root/GEMINI.md)
- agents/pm.md (base: workspace root/agents/pm.md + Safety override)
- scripts/audit.ts
- .claude/settings.json
- .gemini/settings.json

## Safety OS Exclusive Files (newly created)
- agents/safety-governance-manager.md
- agents/safety-workflow-manager.md
- agents/compliance-agent.md
- agents/risk-assessment-agent.md
- agents/emergency-agent.md
- agents/audit-agent.md
- skills/, regulations/, industry-profiles/
- workflows/, evidence-models/
- docs/blueprint/
- scripts/safety-audit.ts
```

### 5.2 `_COMMON_VERSION.md`

```markdown
# Common Version Snapshot
based_on_common: 1.0.0
snapshot_date: YYYY-MM-DD
pm_agent_hash: [git hash of agents/pm.md at copy time]
scripts_version: [version from scripts/SCRIPTS.md]
settings_hash: [git hash of .claude/settings.json]
```

### 5.3 `PROMOTION_CHECKLIST.md`

```markdown
# Phase B Promotion Checklist
All items must pass before creating templates/co-safety/.

□ 1. Manufacturing daily 6 workflows fully implemented
      Verify: 6 subdirs in workflows/daily/manufacturing/
              each with README.md + schema.yaml
              legal_basis field populated in schema.yaml

□ 2. PM(CSO) + SGM + SWM agents complete
      Verify: 3 files in agents/ with Section A/B/C structure

□ 3. 4 core skills complete
      Verify: 4 subdirs in skills/ each with SKILL.md (3-section)

□ 4. safety-audit.ts passes (0 errors)
      Verify: bun scripts/safety-audit.ts → exit 0

□ 5. codegraph init + status healthy
      Verify: codegraph status --path ./Projects/safety-os → index ready

□ 6. _COMMON_VERSION.md recorded
      Verify: file exists + based_on_common field populated

□ 7. bun scripts/audit.ts passes
      Verify: bun scripts/audit.ts → exit 0
```

### 5.4 `agents/pm.md` — CSO Override Addition

Prepend to the existing `agents/pm.md`:

```markdown
## Safety OS Context Override
> This section is active only in Safety OS (co-safety variant).

**In this project, PM Agent operates as Chief Safety Officer (CSO).**

### Additional Responsibilities
- Select Industry Profile (manufacturing/chemical/semiconductor/construction/datacenter)
- Verify legal_basis field on all workflows before dispatch
- Maintain evidence chain (audit traceability)

### Dispatch Rules (added to existing PM Gateway)
| Situation | Dispatch Target | Notes |
|-----------|----------------|-------|
| Strategic decision needed | SGM | KPI, policy, industry profile change |
| Workflow execution | SWM | daily ops, audit, training |
| Regulatory compliance query | Compliance Agent (direct) | bypass SWM |
| Emergency scenario | SWM (immediate, skip SGM) | fire/spill/serious accident |

### Pre-Response Checklist
- [ ] Industry Profile confirmed?
- [ ] Request category: daily / compliance / emergency?
- [ ] legal_basis verification required for this workflow?
```

### 5.5 `agents/safety-governance-manager.md`

```markdown
# Safety Governance Manager (SGM)

## Section A: Role & Responsibility

**Role**: Safety strategy lead

**Responsibilities**:
- Select and manage Industry Profile
- Define KPI framework (TRIR, LTIR, Near Miss, training completion rate, etc.)
- Set compliance objectives
- Review and approve policies and standards
- Define regulatory change response strategy

**Inputs**: Executive directives, regulatory changes, incident data, audit results
**Outputs**: Governance Model, Safety Operating Model, KPI Framework, Compliance Framework

**Reporting**: Reports to PM(CSO); provides strategic direction to SWM

**Key Decision Criteria**:
1. Legal obligation (mandatory vs recommended)
2. Industry risk profile
3. PSM applicability (chemical/semiconductor sites)

## Section B: Claude Code Integration
- Strategic documents: Write tool
- Regulatory review: dispatch to Compliance Agent
- KPI reports: dispatch to Reporting Agent

## Section C: Antigravity Integration
- Strategic documents: write_file tool
- Regulatory review: agent_manager → Compliance Agent
```

### 5.6 `agents/safety-workflow-manager.md`

```markdown
# Safety Workflow Manager (SWM)

## Section A: Role & Responsibility

**Role**: Safety OS Execution Lead (Harness Engineering Team Lead)

**Mission**:
Build and execute a reusable, regulatory-compliant, and traceable operational
system for performing safety work consistently across industries.

**Core Principles**:
1. Workflow First — workflows must be defined before agents are deployed
2. Scenario Driven — scenario type determines team composition
3. Evidence Based — every execution must generate evidence
4. Regulation Aware — all workflows require legal_basis
5. Continuously Improve — incorporate incidents and audit results into workflows

**Execution Flow**:
```
Receive user request
    ↓
Confirm Industry Profile
    ↓
Classify request (daily / compliance / emergency)
    ↓
Select workflow (from workflows/_INDEX.md)
    ↓
Assemble Agent Team (from industry-profiles/*.yaml)
    ↓
Execute and manage progress
    ↓
Collect Evidence (from evidence-models/)
    ↓
Report to PM(CSO)
```

**Agent Team Assembly Patterns**:

| Scenario | Leader | Team Members |
|----------|--------|--------------|
| Risk Assessment | Risk Assessment Agent | Compliance Agent |
| Fire Incident | Emergency Agent | Audit Agent, Compliance Agent |
| Regulatory Inspection | Audit Agent | Compliance Agent, Risk Assessment Agent |
| Serious Accident | Compliance Agent | Risk Assessment Agent, Audit Agent |
| Chemical Release | PSM Agent | Emergency Agent, Compliance Agent |

## Section B: Claude Code Integration
## Section C: Antigravity Integration
```

### 5.7 Regulation YAML Format

```yaml
# regulations/KR/tier1-laws/occupational-safety-health-act.yaml
id: KR-OSHA-2024
name: 산업안전보건법
name_en: Occupational Safety and Health Act
tier: 1
revision: 2024-01-01
source_url: https://www.law.go.kr/법령/산업안전보건법
source_mcp: mcp-kr-legislation   # activated in Phase 2
applicable_industries: [manufacturing, chemical, semiconductor, construction, datacenter]
key_articles:
  - id: art-36
    title: 위험성평가
    title_en: Risk Assessment
    workflows: [workflows/daily/manufacturing/risk-assessment]
  - id: art-37
    title: 비상조치계획
    title_en: Emergency Action Plan
    workflows: [workflows/emergency/fire-response]
  - id: art-63
    title: 도급인의 안전조치
    title_en: Safety Measures for Subcontractors
    workflows: [workflows/daily/manufacturing/contractor-management]
psm_related: false
notes: "Base law for occupational safety. Mandates safety manager appointment,
        risk assessment, training, PPE, and work environment management."
```

### 5.8 Industry Profile (`industry-profiles/manufacturing.yaml`)

```yaml
name: Manufacturing
name_ko: 제조업
psm_required: false
psm_elements: 0
core_regulations:
  - KR-OSHA-2024
  - KR-SD-2022
risk_profile:
  high: [entanglement, fall, collision, fire]
  medium: [ergonomic injury, chemical exposure]
primary_agents: [risk-assessment-agent, compliance-agent, audit-agent]
secondary_agents: [emergency-agent, incident-investigation-agent]
optional_agents: [training-agent, reporting-agent]
workflow_priority:
  daily: [risk-assessment, permit-to-work, equipment-inspection,
          contractor-management, safety-training, safety-patrol]
  compliance: [internal-audit, compliance-check]
  emergency: [fire-response, serious-accident]
safety_framework: OHSMS_7_Elements
notes: "Not a PSM site. Requires 7-element OHSMS."
```

### 5.9 Workflow Standard Format (`workflows/_template/schema.yaml`)

```yaml
id: ""                    # e.g. risk-assessment-manufacturing
name: ""                  # display name
name_ko: ""               # Korean name
industry: ""              # manufacturing/chemical/semiconductor/construction/datacenter
category: ""              # daily/compliance/emergency

# Status management — critical for audit risk
status: template          # active | template | deprecated
applicability: optional   # mandatory | recommended | optional
legal_basis: ""           # e.g. Occupational Safety & Health Act Art. 36
framework: ""             # OHSMS_7 | PSM_12 | ISO45001 | internal

# Execution
trigger: ""
owner: ""
actors:
  agents: []
  human: []

inputs: []
outputs: []
evidence:
  - type: ""
    model: ""             # path to evidence-models/
    retention: ""         # e.g. 3 years

kpis: []
review_cycle: ""
last_reviewed: ""
```

### 5.10 `scripts/safety-audit.ts` (MVP)

```typescript
#!/usr/bin/env bun
/**
 * safety-audit.ts — Safety OS QA Gate
 *
 * MVP checks:
 *   1. legal_basis field exists and non-empty in schema.yaml
 *   2. status field valid: active | template | deprecated
 *   3. applicability field valid: mandatory | recommended | optional
 *
 * Phase 2 additions:
 *   4. mcp-kr-legislation revision date freshness check
 *   5. evidence-models link validity
 *   6. index.ts auto-generation
 */
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import * as yaml from 'js-yaml'

const WORKFLOWS_DIR = './workflows'
const VALID_STATUS = ['active', 'template', 'deprecated']
const VALID_APPLICABILITY = ['mandatory', 'recommended', 'optional']
let errors = 0, warnings = 0

async function findSchemaFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) files.push(...await findSchemaFiles(p))
    else if (e.name === 'schema.yaml') files.push(p)
  }
  return files
}

async function validateSchema(filePath: string) {
  const schema = yaml.load(await readFile(filePath, 'utf-8')) as Record<string, unknown>
  if (!schema.legal_basis || schema.legal_basis === '') {
    console.error(`❌ MISSING legal_basis: ${filePath}`); errors++
  }
  if (!VALID_STATUS.includes(schema.status as string)) {
    console.error(`❌ INVALID status "${schema.status}": ${filePath}`); errors++
  }
  if (!VALID_APPLICABILITY.includes(schema.applicability as string)) {
    console.warn(`⚠️  INVALID applicability "${schema.applicability}": ${filePath}`); warnings++
  }
}

for (const f of await findSchemaFiles(WORKFLOWS_DIR)) await validateSchema(f)
console.log(`\nSafety Audit: ${errors} errors, ${warnings} warnings`)
if (errors > 0) process.exit(1)
```

### 5.11 `evidence-models/base/finding.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Finding",
  "description": "Issue identified during audit or inspection",
  "type": "object",
  "required": ["id", "date", "source", "description", "severity", "legal_basis"],
  "properties": {
    "id": { "type": "string", "pattern": "^F-[0-9]{8}-[0-9]{3}$" },
    "date": { "type": "string", "format": "date" },
    "source": { "type": "string", "enum": ["internal_audit","regulatory_inspection","incident","self_assessment"] },
    "description": { "type": "string" },
    "severity": { "type": "string", "enum": ["critical","major","minor","observation"] },
    "legal_basis": { "type": "string" },
    "workflow_ref": { "type": "string" },
    "corrective_action": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "due_date": { "type": "string", "format": "date" },
        "owner": { "type": "string" },
        "status": { "type": "string", "enum": ["open","in_progress","closed","overdue"] }
      }
    }
  }
}
```

### 5.12 `.mcp.json` (MVP)

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "codegraph",
      "args": ["serve", "--mcp", "--path", "./Projects/safety-os"],
      "description": "Code intelligence — symbol graph, impact analysis"
    }
  }
}
```

Phase 2 additions:
```json
"mcp-kr-legislation": {
  "command": "npx",
  "args": ["-y", "mcp-kr-legislation"],
  "description": "Korea legislation API — 130+ legal tools"
},
"k-skill": { "command": "...", "description": "K-Skill repository" }
```

---

## 6. v3.0 Blueprint Draft Specification

### File Priority and Target Content

| File | Target | Core Content | Priority |
|------|--------|-------------|----------|
| `03-governance.md` | 5–6p | **FIRST** — PM/SGM/SWM hierarchy, dispatch rules, team assembly patterns | 1 |
| `01-executive-summary.md` | 4–5p | Vision, Business Drivers, 7 Design Principles | 2 |
| `02-architecture.md` | 6–8p | Layer 0–8 diagram, Technology Stack, Traceability Model | 3 |
| `04-agent-catalog.md` | 4–5p | 15 agents with Priority 1–3 classification | 4 |
| `05-implementation-roadmap.md` | 3–4p | Phase 0–9, MVP scope declaration | 5 |

**Total: ~22–28p — immediately shareable with CIO/CSO**

---

## 7. Execution Sequence (Detailed)

### Phase A — MVP Implementation

#### S-00: Base Structure

```bash
mkdir -p Projects/safety-os && cd Projects/safety-os
mkdir -p agents
mkdir -p skills/{risk-assessment,permit-to-work,emergency-response,compliance-gap}
mkdir -p regulations/KR/tier1-laws
mkdir -p industry-profiles
mkdir -p workflows/{_template,daily/manufacturing,compliance,emergency}
mkdir -p workflows/daily/manufacturing/{risk-assessment,permit-to-work,equipment-inspection,contractor-management,safety-training,safety-patrol}
mkdir -p evidence-models/base
mkdir -p docs/blueprint
mkdir -p scripts
mkdir -p memory/{incidents,findings,corrective-actions}
# Copy common files
cp ../../agents/pm.md agents/pm.md
cp ../../CLAUDE.md CLAUDE.md && cp ../../GEMINI.md GEMINI.md
# Create tracking files: _ORIGIN.md, _COMMON_VERSION.md, PROMOTION_CHECKLIST.md
codegraph init .
# Create .mcp.json (codegraph only)
```
**Done when**: folder structure exists + codegraph init success + _ORIGIN.md written

---

#### S-01: `agents/pm.md` CSO Override
Prepend Section 5.4 content to the top of the copied `agents/pm.md`.
**Done when**: "Safety OS Context Override" section present in pm.md

---

#### S-02: `agents/safety-governance-manager.md`
Write using Section 5.5 specification.
**Done when**: 3-section structure complete, strategic responsibilities clearly defined

---

#### S-03: `agents/safety-workflow-manager.md`
Write using Section 5.6 specification. Section A must include execution flow diagram and team assembly pattern table.
**Done when**: 3-section structure complete, Agent Team Assembly table included

---

#### S-04: `regulations/KR/tier1-laws/` — 2 YAMLs
- `occupational-safety-health-act.yaml` — min 3 key_articles with workflow mappings
- `serious-accidents-punishment-act.yaml`
- `regulations/_REGISTRY.md` — master table

**Done when**: 2 YAML files + _REGISTRY.md exist, key_articles mapped

---

#### S-05: `industry-profiles/manufacturing.yaml`
Write using Section 5.8. All fields populated including primary_agents, workflow_priority, risk_profile.
**Done when**: file exists with all fields complete

---

#### S-06: Manufacturing Daily Workflows (6)

| # | Workflow | Legal Basis | Key Steps |
|---|---------|------------|-----------|
| 1 | Risk Assessment | OSHA Art. 36 | Identify → Analyze → Evaluate → Control → Approve → Apply |
| 2 | Permit to Work | OSHA PTW | Request → Review → Approve → Execute → Close |
| 3 | Equipment Inspection | OSHA Art. 38 | Plan → Execute → Record → Handle Anomalies → Report |
| 4 | Contractor Management | Serious Accidents Act Art. 4 | Register → Qualify → Train → Permit → Monitor |
| 5 | Safety Training | OSHA Art. 29 | Identify → Prepare → Deliver → Confirm → Record |
| 6 | Safety Patrol | OSHA (internal) | Plan → Patrol → Identify Hazards → Issue Directives → Verify |

Each folder: `README.md` (7-section) + `schema.yaml` (legal_basis populated)
**Done when**: 6 folders each with README.md + schema.yaml, legal_basis filled

---

#### S-07: 4 Core Skills

| Skill | Section A Core | Related Workflow |
|-------|--------------|----------------|
| `risk-assessment` | Hazard ID → Analysis → Evaluation → Controls methodology | risk-assessment |
| `permit-to-work` | PTW issue → approve → execute → close cycle | permit-to-work |
| `emergency-response` | Emergency type → response team → procedure → report | emergency/* |
| `compliance-gap` | Regulatory requirements vs current state gap analysis | internal-audit |

**Done when**: 4 SKILL.md files with 3-section structure

---

#### S-08: `evidence-models/base/`
- `finding.schema.json` (Section 5.11)
- `corrective-action.schema.json`
**Done when**: 2 JSON schema files exist

---

#### S-09: `safety-audit.ts` (Basic)
Write using Section 5.10 code.
**Done when**: `bun scripts/safety-audit.ts` → exit 0

---

#### S-10: v3.0 Blueprint Draft (5 files)
Write in order: 03 → 01 → 02 → 04 → 05 (Section 6 specification)
**Done when**: 5 files exist, total ~25p, Document Control Table included

---

#### S-11: PROMOTION_CHECKLIST Validation
Verify all 7 items in `PROMOTION_CHECKLIST.md` pass.

---

### Phase B — Workspace Promotion

| # | Task | Deliverable |
|---|------|------------|
| S-12 | Create `templates/co-safety/` | `variant.json` + full structure |
| S-13 | Propagate to workspace root | `AGENTS.md` + `bun run agent:verify` |
| S-14 | Final validation | `bun scripts/validate-templates.ts` passes |

**`variant.json` core**:
```json
{
  "inherits_common": "1.0.0",
  "variant_type": "domain-specific",
  "domain": "safety-os",
  "name": "co-safety",
  "description": "Enterprise Safety Operating System — AI Agent-based EHS platform",
  "industry_profiles": ["manufacturing","chemical","semiconductor","construction","datacenter"],
  "regulation_scope": ["KR-OSHA","PSM","ISO45001","serious-accidents"],
  "evidence_requirements": "strict",
  "agent_overrides": {
    "pm": {
      "type": "additive",
      "reason": "Safety OS adds CSO role with SGM/SWM dispatch rules",
      "overrides": ["safety-governance-workflow","cso-dispatch-protocol"]
    }
  }
}
```

---

## 8. Phase 2 Plan (Post-MVP — Detailed)

Phase 2 has 4 sub-phases with strict dependency order:

```
Phase 2-A: Knowledge Engineering    (S-20–S-24)  ← Law MCP + CodeGraph deep
      ↓
Phase 2-B: Industry Expansion       (S-25–S-29)  ← 4 industries + scenario library
      ↓
Phase 2-C: Agent & Skill Expansion  (S-30–S-35)  ← 8 more agents + 6 more skills
      ↓
Phase 2-D: Documentation & Automation (S-36–S-40) ← v3.0 Full + v4.0 Playbook
```

---

### Phase 2-A: Knowledge Engineering (S-20–S-24)

**Goal**: Law MCP integration, complete regulation registry, CodeGraph deep integration

#### S-20: mcp-kr-legislation Installation & Integration

```bash
npm search mcp-kr-legislation
npx mcp-kr-legislation --version
# Add to .mcp.json, run integration test (query OSHA Art. 36)
```

Update regulations YAML:
```yaml
source_mcp: mcp-kr-legislation
articles:
  - id: art-36
    mcp_query_template: "산업안전보건법 제{article_number}조"
```
**Done when**: successful query of OSHA Art. 36 via MCP + YAML source_mcp activated

---

#### S-21: `regulations/` tier2–4 Expansion

```
tier2/ (subordinate legislation)
  osha-enforcement-decree.yaml
  osha-enforcement-regulations.yaml
  serious-accidents-decree.yaml

tier3/ (management frameworks)
  psm-ministerial-notice.yaml       ← PSM 12 elements legal basis
  risk-assessment-notice.yaml
  kosha-guide.yaml
  psm-12-elements.yaml              ← 12 elements → workflow mapping table
  ohsms-7-elements.yaml
  iso45001.yaml

tier4/ (industry-specific laws)
  chemical-substances-control-act.yaml
  chemical-substances-evaluation-act.yaml
  high-pressure-gas-safety-act.yaml
  fire-services-act.yaml
  fire-prevention-act.yaml
  hazardous-materials-safety-act.yaml
  electrical-safety-act.yaml
  air-environment-act.yaml
  water-environment-act.yaml
  waste-management-act.yaml
  construction-technology-act.yaml
  construction-industry-act.yaml
  labor-standards-act.yaml
  industrial-accident-compensation-act.yaml
```

**Done when**: tier2 (3) + tier3 (6) + tier4 (14+) = 23+ YAML files

---

#### S-22: `safety-audit.ts` Phase 2 Extension

```typescript
// Check 4: mcp-kr-legislation revision freshness
async function checkRegulationRevision(yamlPath: string) {
  const schema = parseYaml(yamlPath)
  if (!schema.source_mcp) return
  // Query latest revision via MCP, compare with YAML revision field
  // Output warning on mismatch
}

// Check 5: evidence-models link validity
async function checkEvidenceLinks(schemaPath: string) {
  const schema = parseYaml(schemaPath)
  for (const ev of schema.evidence ?? []) {
    if (ev.model && !existsSync(ev.model)) {
      console.error(`❌ BROKEN evidence link: ${ev.model}`); errors++
    }
  }
}
```
**Done when**: Phase 2 version → 0 errors + 0 revision warnings

---

#### S-23: CodeGraph Deep Integration (`index.ts` auto-generation)

Add to `safety-audit.ts`:
```typescript
async function generateIndexTs(workflowPath: string) {
  const schema = parseYaml(`${workflowPath}/schema.yaml`)
  const imports = (schema.legal_basis_ids ?? []).map((id: string) =>
    `import { ${id} } from '../../../regulations/KR/tier1-laws/${id}'`
  ).join('\n')
  const content = `
// AUTO-GENERATED — edit schema.yaml, not this file
${imports}
export const workflow = {
  id: '${schema.id}', status: '${schema.status}',
  legalBasis: '${schema.legal_basis}', industry: '${schema.industry}',
}`
  await writeFile(`${workflowPath}/index.ts`, content)
}
```

Reindex and validate:
```bash
codegraph index Projects/safety-os/
codegraph impact KR_OSHA_art36 --path Projects/safety-os/
# Expected: list of affected workflows/skills/agents
```
**Done when**: all active workflows have index.ts + codegraph impact query succeeds

---

#### S-24: K-Skill Integration

```yaml
# skills/compliance-gap/SKILL.md Section A
extends: k-skill/법령검색
safety_override:
  regulation_scope: [KR-OSHA, PSM, serious-accidents-act]
  industry_filter: [manufacturing, chemical, semiconductor]
  output_format: gap_analysis_report
```
**Done when**: K-Skill legal search call succeeds + compliance-gap extends pattern works

---

### Phase 2-A Completion Checklist
```
□ mcp-kr-legislation query success (OSHA Art. 36 response confirmed)
□ regulations/ tier2–4 complete (23+ law YAMLs)
□ codegraph impact KR_OSHA_art36 → workflow list output
□ safety-audit.ts Phase 2 version passes (0 errors)
□ K-Skill integration confirmed
```

---

### Phase 2-B: Industry Expansion (S-25–S-29)

**Goal**: Complete workflows for all 5 industries

#### S-25: Chemical Industry

`industry-profiles/chemical.yaml`:
```yaml
name: Chemical
psm_required: true
psm_elements: 12
core_regulations: [KR-OSHA-2024, KR-SD-2022, KR-PSM-notice, chemical-substances-control-act, high-pressure-gas-safety-act]
risk_profile:
  high: [explosion, toxic-release, process-failure]
  medium: [fire, environmental-contamination]
```

**PSM 12 Elements — Implementation Priority**:

| Priority | Element | Workflow Path | Legal Basis |
|---------|---------|--------------|------------|
| P1 | Risk Assessment (PSM) | daily/chemical/risk-assessment-psm/ | PSM Notice Art. 3 |
| P1 | Permit to Work | daily/chemical/permit-to-work-psm/ | PSM Notice Art. 11 |
| P1 | Emergency Action Plan | emergency/chemical/emergency-action/ | PSM Notice Art. 8 |
| P2 | Management of Change (MOC) | daily/chemical/management-of-change/ | PSM Notice Art. 5 |
| P2 | Process Safety Data | daily/chemical/process-safety-data/ | PSM Notice Art. 2 |
| P2 | Operating Procedures | daily/chemical/operating-procedures/ | PSM Notice Art. 4 |
| P3 | Mechanical Integrity | daily/chemical/mechanical-integrity/ | PSM Notice Art. 6 |
| P3 | Contractor Management (PSM) | daily/chemical/contractor-management-psm/ | PSM Notice Art. 7 |
| P3 | Training (PSM) | daily/chemical/training-psm/ | PSM Notice Art. 9 |
| P4 | Incident Investigation | daily/chemical/incident-investigation/ | PSM Notice Art. 10 |
| P4 | Compliance Audit | compliance/chemical/compliance-audit/ | PSM Notice Art. 12 |
| P4 | Management Participation | compliance/chemical/management-participation/ | PSM Notice Art. 1 |

**Done when**: chemical/_INDEX.md shows all 12 PSM elements `status: active`

---

#### S-26: Semiconductor Industry

`industry-profiles/semiconductor.yaml`:
```yaml
name: Semiconductor
psm_required: true
psm_elements: 8
core_regulations: [KR-OSHA-2024, KR-SD-2022, chemical-substances-control-act, high-pressure-gas-safety-act]
risk_profile:
  high: [hazardous-chemical-exposure, specialty-gas-release, cleanroom-failure]
  medium: [fire, electrical-accident]
```

8 core workflows:
```
daily/semiconductor/
  chemical-safety-management/    ← MSDS-based handling procedures
  specialty-gas-safety/          ← SiH4, HF, Cl2 management
  cleanroom-safety/              ← access control, ESD
  risk-assessment-fab/           ← PSM P1
  permit-to-work-fab/            ← PSM P1
  mechanical-integrity-fab/      ← PSM P3
  moc-fab/                       ← PSM P2
  emergency-response-chemical/   ← PSM P1
```
**Done when**: semiconductor/_INDEX.md shows 8 PSM elements `status: active`

---

#### S-27: Construction Industry

`industry-profiles/construction.yaml`:
```yaml
name: Construction
psm_required: false
core_regulations: [KR-OSHA-2024, KR-SD-2022, construction-technology-act]
risk_profile:
  high: [fall, falling-objects, heavy-equipment-collision]
  medium: [collapse, electrical, fire]
```

6 core workflows:
```
daily/construction/
  toolbox-meeting/               ← pre-work safety briefing (TBM)
  permit-to-work-construction/   ← elevated/hot-work/confined/excavation
  elevated-work-safety/          ← harness, safety railings
  heavy-equipment-safety/        ← signal person, exclusion zones
  contractor-management-const/   ← multi-tier subcontracting
  falling-object-prevention/     ← safety nets, debris barriers
```
**Done when**: construction/_INDEX.md shows 6 workflows `status: active`

---

#### S-28: Data Center Industry

`industry-profiles/datacenter.yaml`:
```yaml
name: DataCenter
psm_required: false
core_regulations: [KR-OSHA-2024, electrical-safety-act, fire-services-act]
risk_profile:
  high: [power-outage, fire, service-interruption]
  medium: [cooling-failure, security-breach]
```

Workflows:
```
daily/datacenter/
  it-change-management/          ← ITIL-based change management
  electrical-equipment-inspection/  ← UPS, PDU, cooling
  fire-response-idc/
compliance/datacenter/
  business-continuity-plan/      ← BCP
  disaster-recovery/             ← DR
  security-audit/
emergency/datacenter/
  power-outage-response/
  service-recovery/
```
**Done when**: datacenter/_INDEX.md shows BCP/DR/change-management `status: active`

---

#### S-29: Cross-Industry Scenarios + compliance/emergency completion

**5 Cross-Industry Scenarios**:

```yaml
# workflows/emergency/fire-response/schema.yaml
response_team: [emergency-agent, compliance-agent, audit-agent]
workflow:
  - Discovery and notification (119, internal emergency line)
  - Initial evacuation (verify emergency exits)
  - Initial suppression attempt (extinguisher, standpipe)
  - Professional response team support
  - Scene preservation and investigation
  - Labor ministry notification (if fatality/3+ days injury)
  - Root cause analysis and recurrence prevention
legal_basis: OSHA Art. 37, Fire Services Act

# workflows/emergency/chemical-release/schema.yaml
response_team: [psm-agent, emergency-agent, compliance-agent]
workflow:
  - Release detection (sensor, visual)
  - Isolation zone establishment
  - Hazmat team deployment
  - Environmental agency and labor ministry notification
  - Decontamination and cleanup
  - Root cause investigation (PSM Agent)
legal_basis: Chemical Substances Control Act Art. 43, PSM Notice Art. 8

# workflows/emergency/serious-accident/schema.yaml
response_team: [compliance-agent, incident-investigation-agent, reporting-agent]
note: "Immediate labor ministry notification on fatality. Absolutely no scene alteration."
workflow:
  - Scene preservation (NO changes whatsoever)
  - Immediate notification (Labor Ministry, Prosecution)
  - Victim rescue
  - CEO reporting
  - Evidence preservation for investigation
  - RCA and corrective actions
legal_basis: Serious Accidents Punishment Act Art. 4, OSHA Art. 57

# workflows/emergency/typhoon-response/schema.yaml
response_team: [disaster-response-agent, emergency-agent]
workflow:
  - Receive weather service typhoon forecast
  - Equipment securing and protection
  - Outdoor material storage
  - Personnel evacuation plan
  - Post-typhoon damage assessment
  - Recovery priority determination

# workflows/emergency/earthquake-response/schema.yaml
response_team: [disaster-response-agent, asset-integrity-agent]
workflow:
  - Earthquake detection (seismic measurement)
  - Immediate evacuation (under desk, open area outside)
  - 30-min aftershock standby
  - Equipment damage assessment (PSM equipment first)
  - Hazardous material release check
  - Recovery priority determination
```

**Done when**: 5 scenario schema.yaml + README.md files complete

---

### Phase 2-B Completion Checklist
```
□ Chemical: all 12 PSM workflows status: active
□ Semiconductor: 8 PSM-applicable workflows status: active
□ Construction: 6 core workflows status: active
□ DataCenter: BCP + DR + change-management status: active
□ 5 Cross-Industry scenarios complete
□ All 5 industries: compliance/ minimum 2 workflows
□ safety-audit.ts: all industries 0 errors
```

---

### Phase 2-C: Agent & Skill Expansion (S-30–S-35)

**Goal**: 7 → 15 agents, 4 → 10 skills

#### S-30: PSM Agent

```markdown
## Section A
Role: Process Safety Management (PSM) specialist orchestrator

Responsibilities: PSM 12 elements execution / HAZOP analysis / MOC management / PTW operation

⚠️ Legal obligations:
- HAZOP results must be included in Process Safety Report (PSM Notice Art. 3)
- No work commencement before MOC completion
- Immediate labor ministry notification on major industrial accident (OSHA Art. 54)
- Site operation only after labor ministry review and confirmation of safety report

Inputs: process information, hazardous material list, change requests
Outputs: HAZOP report, MOC package, PSM 12-element compliance status
```

---

#### S-31: Asset Integrity Agent

```markdown
## Section A
Role: Asset integrity management specialist
Responsibilities: preventive maintenance planning / inspection scheduling / aging equipment risk assessment
Legal Basis: OSHA Art. 38, PSM Notice Art. 6
Outputs: equipment inspection plan, anomaly report, replacement recommendations
```

---

#### S-32: Incident Investigation Agent

```markdown
## Section A
Role: Incident investigation and root cause analysis specialist
Methods: 5-Why / RCA / Bow-Tie / Tripod Beta

⚠️ Legal obligations:
- Immediate labor ministry notification on fatality or 3+ days injury (OSHA Art. 57)
- Serious accident scene: NO alterations — scene contamination carries legal penalty
- RCA report 3-year retention obligation
- List of documents requiring CEO signature

Outputs: incident investigation report, RCA results, recurrence prevention measures
```

---

#### S-33: Contractor Safety Agent

```markdown
## Section A
Role: Subcontractor / consignment safety specialist
Responsibilities: registration/qualification / pre-work training / monitoring / performance evaluation

⚠️ Legal obligations (Serious Accidents Act core):
- Principal contractor's duty to ensure safety (Serious Accidents Act Art. 4)
- Principal contractor liability possible on subcontractor industrial accident
- Minimum 2 subcontractor safety inspections per year recommended

Outputs: qualification assessment, training completion confirmation, monitoring report
```

---

#### S-34: Training Agent + Reporting Agent

**Training Agent**:
```markdown
## Section A
Statutory training types (OSHA Art. 29):
  New hire: 8+ hours
  Task change: 2+ hours
  Special (high-risk work): 16+ hours
  Supervisors: 16+ hours/year

Outputs: training curriculum, training materials, completion certificates, competency matrix
```

**Reporting Agent**:
```markdown
## Section A
KPI indicators:
  TRIR (Total Recordable Incident Rate)
  LTIR (Lost Time Incident Rate)
  Near Miss count
  Risk assessment completion rate
  Statutory training completion rate
  Corrective action on-time completion rate
  Subcontractor safety inspection completion rate

Reporting cycle: monthly / quarterly / annual
Reporting to: CEO, CSO, Safety & Health Committee
```

---

#### S-35: 6 Additional Skills

| Skill | Purpose | Related Agent | Related Workflow |
|-------|---------|--------------|----------------|
| `hazop-analysis` | HAZOP procedure execution | PSM Agent | daily/chemical/risk-assessment-psm |
| `psm-moc` | MOC package generation | PSM Agent | daily/chemical/management-of-change |
| `root-cause-analysis` | 5-Why / RCA / Bow-Tie execution | Incident Investigation | emergency/*/incident |
| `audit-preparation` | Audit readiness checklist generation | Audit Agent | compliance/*/internal-audit |
| `contractor-onboarding` | Contractor registration-to-training package | Contractor Safety | daily/*/contractor-management |
| `asset-integrity-check` | Equipment inspection plan generation | Asset Integrity | daily/*/equipment-inspection |

---

### Phase 2-C Completion Checklist
```
□ 15 agents: all with 3-section structure complete
□ 10 skills: all complete
□ PSM Agent HAZOP + MOC execution test
□ Incident Investigation Agent 5-Why execution test
□ bun run agent:verify passes (AGENTS.md consistent)
□ safety-audit.ts skill dependency check 0 errors
```

---

### Phase 2-D: Documentation & Automation (S-36–S-40)

**Goal**: v3.0 Full complete, generate-playbook.ts, v4.0 assembly

#### S-36: v3.0 Group 1 — Industry & Workflow (8 files)

Write order:
```
13-workflow-design.md     ← 7-section standard format official definition
14-workflow-library.md    ← complete workflow reference index
07-manufacturing.md       ← expand Draft (PSM N/A noted)
08-chemical.md            ← includes all PSM 12 elements
09-semiconductor.md
10-construction.md
11-datacenter.md
12-scenario-library.md    ← 5 Cross-Industry scenarios
```

`08-chemical.md` core structure:
```markdown
## 8.2 Regulatory Framework — PSM 12 Elements
| Element | Status | Workflow | Legal Basis |
|---------|--------|---------|------------|
| Risk Assessment | mandatory | daily/chemical/risk-assessment-psm | PSM Notice Art. 3 |
... (all 12)
```

---

#### S-37: v3.0 Group 2 — Engineering Standards (10 files)

```
15-skill-design.md         ← 3-section format standard
16-skill-catalog.md        ← all 10 skills
17-script-design.md        ← 6 script type formats
18-knowledge-graph.md      ← Traceability model
19-graph-schema.md         ← Node + Relationship + Governance
20-repository-architecture.md
21-branching-strategy.md
22-pr-governance.md
23-automation-gates.md     ← safety-audit.ts + generate-playbook.ts
24-prompt-engineering.md   ← 3-section format complete reference
```

---

#### S-38: v3.0 Appendix (11 files)

```
A-agent-definitions.md         ← all 15 agents summary
B-workflow-templates.md
C-skill-templates.md
D-script-templates.md          ← SOP/Checklist/Audit/Emergency/Incident/Training
E-governance-templates.md
F-github-templates.md          ← _ORIGIN.md, _COMMON_VERSION.md, PROMOTION_CHECKLIST.md
G-prompt-templates.md          ← complete 3-section examples
H-knowledge-graph-examples.md  ← codegraph impact sample output
I-regulation-registry.md       ← full _REGISTRY.md + YAML format guide
J-codegraph-integration.md     ← init→index→impact workflow guide
K-korean-regulatory-glossary.md ← Korean ↔ English terminology (30+ terms)
```

`Appendix K` sample entries:
```markdown
| Korean | English | Context |
|--------|---------|---------|
| 위험성평가 | Risk Assessment | OSHA Art. 36 |
| 작업허가제 | Permit to Work | PTW |
| 중대재해처벌법 | Serious Accidents Punishment Act | — |
| 공정안전관리 | Process Safety Management | PSM |
| 변경관리 | Management of Change | MOC |
| 안전보건관리체계 | OHSMS | 7-element framework |
| 증적 | Evidence / Audit Trail | audit record |
| 시정조치 | Corrective Action | CA |
| 도급 | Subcontracting | incl. contractors |
| 중대산업사고 | Major Industrial Accident | PSM Notice scope |
```

---

#### S-39: `generate-playbook.ts` Implementation

```typescript
// scripts/generate-playbook.ts
import { readdir, readFile, writeFile } from 'fs/promises'
import { existsSync, statSync } from 'fs'
import * as yaml from 'js-yaml'

const BLUEPRINT_DIR = './docs/blueprint'
const OUTPUT = `./docs/v4.0-playbook-${new Date().toISOString().slice(0,10)}.md`

async function main() {
  let out = `# Safety OS Architecture Blueprint v4.0\n`
  out += `**Generated**: ${new Date().toISOString().slice(0,10)}\n\n---\n\n`

  // 1. Blueprint files in order
  const files = (await readdir(BLUEPRINT_DIR))
    .filter(f => f.endsWith('.md') && !f.includes('appendix'))
    .sort()
  for (const f of files) {
    out += await readFile(`${BLUEPRINT_DIR}/${f}`, 'utf-8') + '\n\n---\n\n'
  }

  // 2. Industry Profile summary (auto-generated)
  out += `\n## Industry Profile Summary\n\n`
  for (const f of await readdir('./industry-profiles').catch(() => [])) {
    if (!f.endsWith('.yaml')) continue
    const d = yaml.load(await readFile(`./industry-profiles/${f}`, 'utf-8')) as Record<string, unknown>
    out += `### ${d.name} — PSM Required: ${d.psm_required}\n`
    out += `Core Regulations: ${(d.core_regulations as string[])?.join(', ')}\n\n`
  }

  // 3. Complete Workflow Index (auto-generated from _INDEX.md files)
  out += `\n## Complete Workflow Index\n\n`
  for (const cat of ['daily', 'compliance', 'emergency']) {
    out += `### ${cat.toUpperCase()}\n\n`
    for (const ind of await readdir(`./workflows/${cat}`).catch(() => [])) {
      const idx = `./workflows/${cat}/${ind}/_INDEX.md`
      if (existsSync(idx)) out += await readFile(idx, 'utf-8') + '\n'
    }
  }

  // 4. Regulation Registry (auto-generated)
  const reg = './regulations/_REGISTRY.md'
  if (existsSync(reg)) out += `\n## Regulation Registry\n\n` + await readFile(reg, 'utf-8')

  // 5. Appendices
  const appDir = `${BLUEPRINT_DIR}/appendix`
  if (existsSync(appDir)) {
    out += '\n\n# Appendices\n\n'
    for (const f of (await readdir(appDir)).filter(f => f.endsWith('.md')).sort()) {
      out += await readFile(`${appDir}/${f}`, 'utf-8') + '\n\n---\n\n'
    }
  }

  await writeFile(OUTPUT, out)
  const size = statSync(OUTPUT).size
  console.log(`✅ v4.0 Playbook: ${OUTPUT} (${Math.round(size/1024)}KB)`)
}

await main()
```
**Done when**: execution succeeds + output file is minimum 100KB

---

#### S-40: v4.0 Playbook Validation

```bash
bun scripts/generate-playbook.ts
wc -l docs/v4.0-playbook-*.md
grep "^# "  docs/v4.0-playbook-*.md | wc -l   # count Parts
grep "^## " docs/v4.0-playbook-*.md | wc -l   # count Sections
```
**Done when**: v4.0-playbook.md exists, 100p+ confirmed

---

### Phase 2-D Completion Checklist
```
□ v3.0 Full: 26 section files + 11 Appendix files complete (~80p)
□ generate-playbook.ts executes successfully (exit 0)
□ v4.0-playbook.md generated + 100p+ confirmed
□ Appendix K: 30+ terminology entries
```

---

### Phase 2 Full Completion Checklist
```
Phase 2-A (Knowledge Engineering):
  □ mcp-kr-legislation query successful
  □ regulations/ 23+ law YAMLs complete
  □ codegraph impact query functional
  □ safety-audit.ts Phase 2 version: 0 errors
  □ K-Skill integration confirmed

Phase 2-B (Industry Expansion):
  □ Chemical: all 12 PSM workflows active
  □ Semiconductor: 8 PSM-applicable workflows active
  □ Construction: 6 core workflows active
  □ DataCenter: BCP/DR/change-management active
  □ 5 Cross-Industry scenarios complete

Phase 2-C (Agent & Skill):
  □ 15 agents with 3-section structure complete
  □ 10 skills complete
  □ bun run agent:verify passes

Phase 2-D (Documentation):
  □ v3.0 Full complete
  □ generate-playbook.ts functional
  □ v4.0 Playbook 100p+ confirmed
```

---

## 9. Korean Regulatory Framework Reference

```
Core Laws (tier1)
  Occupational Safety and Health Act (OSHA)
    → covers: safety manager appointment, risk assessment,
              training, PPE, work environment management
  Serious Accidents Punishment Act
    → covers: employer liability, OHSMS establishment obligations

Management Frameworks
  OHSMS 7 Elements        — all workplaces
  PSM 12 Elements         — chemical/refinery/gas/semiconductor (legally mandated)

PSM 12 Elements (all mandatory for chemical/semiconductor):
  Process Safety Data / Risk Assessment / Operating Procedures
  Mechanical Integrity / Management of Change / Contractor Management
  Training / Emergency Action Plan / Incident Investigation
  Compliance Audit / Permit to Work / Management Participation

Corporate Internal Regulations (20–30 items typical):
  OHSMS Regulation / Risk Assessment Regulation / PTW Regulation
  Contractor Safety Regulation / Emergency Response Regulation
  Incident Investigation Regulation / MOC Regulation / PPE Regulation
  Confined Space Work Regulation / Elevated Work Regulation
  Hot Work Regulation / Chemical Management Regulation / etc.
```

**CodeGraph Killer Use Case (Phase 2)**:
```bash
codegraph impact KR_OSHA_art36 --path Projects/safety-os/
# Output: all workflows/skills/agents/evidence affected by OSHA Art. 36 amendment
# → becomes "Regulatory Change Impact Analysis Report" as audit evidence
```

---

## 10. Progress Tracking

**Phase A — MVP**

| Step | Status | Done | Prerequisite |
|------|--------|------|-------------|
| S-00 Base structure | ⬜ Not started | — | — |
| S-01 pm.md CSO override | ⬜ Not started | — | S-00 |
| S-02 SGM agent | ⬜ Not started | — | S-01 |
| S-03 SWM agent | ⬜ Not started | — | S-01 |
| S-04 Regulation registry tier1 | ⬜ Not started | — | S-00 |
| S-05 industry-profiles/manufacturing | ⬜ Not started | — | S-04 |
| S-06 workflows/daily/manufacturing (6) | ⬜ Not started | — | S-05 |
| S-07 4 core skills | ⬜ Not started | — | S-05 parallel |
| S-08 evidence-models/base | ⬜ Not started | — | S-06 |
| S-09 safety-audit.ts | ⬜ Not started | — | S-06 |
| S-10 v3.0 Blueprint Draft (5 files) | ⬜ Not started | — | S-01–03 |
| S-11 PROMOTION_CHECKLIST validation | ⬜ Not started | — | S-00–10 |

**Phase B — Workspace Promotion**

| Step | Status | Done | Prerequisite |
|------|--------|------|-------------|
| S-12 templates/co-safety/ | ⬜ Not started | — | S-11 pass |
| S-13 workspace root propagation | ⬜ Not started | — | S-12 |
| S-14 final validation | ⬜ Not started | — | S-13 |

**Phase 2-A: Knowledge Engineering**

| Step | Status | Done | Prerequisite |
|------|--------|------|-------------|
| S-20 mcp-kr-legislation setup | ⬜ Not started | — | Phase A done |
| S-21 regulations/ tier2–4 (23+) | ⬜ Not started | — | S-20 |
| S-22 safety-audit.ts Phase 2 extension | ⬜ Not started | — | S-21 |
| S-23 CodeGraph deep (index.ts auto-gen) | ⬜ Not started | — | S-22 |
| S-24 K-Skill integration | ⬜ Not started | — | S-23 |

**Phase 2-B: Industry Expansion**

| Step | Status | Done | Prerequisite |
|------|--------|------|-------------|
| S-25 Chemical (PSM 12 elements) | ⬜ Not started | — | 2-A done |
| S-26 Semiconductor (PSM 8 elements) | ⬜ Not started | — | S-25 |
| S-27 Construction (6 workflows) | ⬜ Not started | — | S-25 parallel |
| S-28 DataCenter (BCP/DR/change-mgmt) | ⬜ Not started | — | S-25 parallel |
| S-29 5 Cross-Industry scenarios + compliance/emergency | ⬜ Not started | — | S-25–28 |

**Phase 2-C: Agent & Skill Expansion**

| Step | Status | Done | Prerequisite |
|------|--------|------|-------------|
| S-30 PSM Agent | ⬜ Not started | — | 2-B done |
| S-31 Asset Integrity Agent | ⬜ Not started | — | S-30 parallel |
| S-32 Incident Investigation Agent | ⬜ Not started | — | S-30 parallel |
| S-33 Contractor Safety Agent | ⬜ Not started | — | S-30 parallel |
| S-34 Training Agent + Reporting Agent | ⬜ Not started | — | S-30 parallel |
| S-35 6 additional skills | ⬜ Not started | — | S-30–34 |

**Phase 2-D: Documentation & Automation**

| Step | Status | Done | Prerequisite |
|------|--------|------|-------------|
| S-36 v3.0 Group 1 — Industry & Workflow (8 files) | ⬜ Not started | — | 2-B done |
| S-37 v3.0 Group 2 — Engineering Standards (10 files) | ⬜ Not started | — | 2-C done |
| S-38 v3.0 Appendix A–K (11 files) | ⬜ Not started | — | S-36–37 |
| S-39 generate-playbook.ts | ⬜ Not started | — | S-36–38 |
| S-40 v4.0 Playbook generation + validation | ⬜ Not started | — | S-39 |

---

_Last updated: 2026-06-03 — English version created from safety-os-plan_ko.md. Full Phase A + Phase B + Phase 2 (S-20–S-40, 21 steps, 4 sub-phases) with detailed specifications, code snippets, and completion criteria._
