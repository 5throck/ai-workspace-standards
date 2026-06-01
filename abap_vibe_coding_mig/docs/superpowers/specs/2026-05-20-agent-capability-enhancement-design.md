# Agent Capability Enhancement Design

**Date**: 2026-05-20
**Session type**: PM-led full-team roundtable
**Scope**: Agent definition quality / Orchestration flow / Skill coverage / Missing agent identification
**Language**: English (project rule: all `.md` files in English; Korean discussion transcript kept in session only)
**Status**: Draft — pending user approval

---

## 1. Executive Summary

A full roundtable with all 15 agents identified 33+ concrete improvement points across four areas.
The most critical gaps are: **(a)** missing tools in existing agent toolkits, **(b)** cross-module orchestration blind spots, and **(c)** no dedicated agents for security auditing and performance analysis.

---

## 2. Area 1 — Agent Definition Quality

### 2.1 Architect (`agents/architect.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| Pattern selection criteria too narrow | Cross-package dependencies, Transport target status, and Cloud Tier not considered | Add Pattern D (Enhancement Framework); expand risk criteria |
| No BAdI/Enhancement design guidance | GetContext tool exists but usage is undefined | Add Enhancement execution plan template |
| Performance tools missing from toolkit | GetSQLTraceState, TraceExecution absent from Architect definition | Add performance review step to Phase 1 parallel block |

### 2.2 Code-Writer (`agents/code-writer.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| No rollback procedure | No procedure defined for WriteSource failure or repeated SyntaxCheck failure | Add Rollback section using GetRevisions/GetRevisionSource |
| PrettyPrint not used | No formatting step in Post-Write chain | Add optional PrettyPrint step to Post-Write chain |
| Coding rules scattered across files | Naming, SQL, and security rules live in three separate files with no single entry point | Add single rule reference link in agent definition |

### 2.3 Test-Runner (`agents/test-runner.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| Code coverage not measured | GetCodeCoverage tool absent from toolkit | Add tool to list; include coverage column in QA Report output |
| ATC P2 threshold undefined | "PM/User review required" has no quantitative threshold | Define MAX_P2_FINDINGS parameter (default: 5) |
| No functional test step | RunReport / RunReportAsync not used | Add optional functional test step after unit tests pass |

### 2.4 DBA (`agents/dba.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| No CDS creation tool | CreateTable absent from toolkit | Add CreateTable to tool list |
| API Release State not checked | GetAPIReleaseState absent; C1/C2 compliance unverified | Add to CDS design checklist |
| No index effectiveness verification loop | No procedure to re-measure performance after index creation | Define DBA → Performance Analyst handoff once Performance Analyst is created (Sprint 3) |

### 2.5 DevOps / Admin (`agents/devops-admin.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| Advanced abapGit tools missing | DeployZip, GitExport, GitTypes absent | Add to tool list |
| No environment Health Check procedure | No periodic system status check defined | Add Health Check workflow section (SAP port, ZADT_VSP, SICF service) |

### 2.6 Interface Expert (`agents/interface-expert.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| No live RFC testing | CallRFC absent from toolkit | Add to tool list |
| Cannot explore function groups | GetFunctionGroup absent | Add to tool list |
| IDoc metadata exploration incomplete | No dedicated tool; currently worked around with SearchObject + GetSource | Document constraint and define workaround procedure explicitly |

### 2.7 Fiori Developer (`agents/fiori-developer.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| Cannot write UI5 files | No tool exists for modifying UI5 views/controllers within vsp | Document constraint (BAS/VS Code required for UI5 writes); add RAP BO design section |
| No RAP workflow | RAP Business Object creation/modification procedure undefined | Add RAP development section; clarify boundary with Interface Expert |

### 2.8 Form Expert (`agents/form-expert.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| Depends on non-functional tool | `browser_subagent` listed as tool but does not operate in this environment | Replace with valid tools; redefine role scope to exclude browser-dependent tasks |

### 2.9 GUI Scripter (`agents/gui-scripter.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| Cannot operate independently | `browser_subagent` and `vsp debug` are not suitable for SAP GUI automation | **Decision required by PM by 2026-06-01**: either redefine the role with valid tools, or suspend the agent and document the gap for future resolution |

### 2.10 SAP Investigator (`agents/sap-investigator.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| Call-graph analysis tools missing | AnalyzeCallGraph, GetCallersOf, GetCalleesOf absent from Phase 1 toolkit | Add to tool list for Phase 1 parallel research block |
| No history tracing capability | GetRevisions, CompareVersions absent | Add to tool list |

### 2.11 Read-Only Analyst (`agents/read-only-analyst.md`)

| Issue | Detail | Fix |
|-------|--------|-----|
| Cannot document field meaning | GetDataElementLabels absent | Add to tool list |
| Cannot look up message texts | GetMessageClassTexts absent | Add to tool list |

### 2.12 Business Analysts — Cross-cutting

| Issue | Detail | Fix |
|-------|--------|-----|
| PRD format misalignment | `docs/prd-template.md` exists but agents do not reference it; AC format inconsistent | Add explicit prd-template.md reference to each analyst agent definition |
| Incomplete trigger keywords | MM missing EKET, EKES; CO missing CE4\* table patterns | Expand trigger keyword lists in each affected analyst definition |
| No QM module coverage | No Quality Management analyst; QM tables (QMEL, QMFE) handled ad hoc by MM/PP | Either create QM Analyst agent or add QM section to MM and PP analyst definitions |

> **Note on cross-module AC ownership**: This issue is a root cause shared with the Orchestration Flow area. See Section 3 for the fix (Module Dependency Matrix in AGENTS.md). Not duplicated here.

---

## 3. Area 2 — Orchestration Flow

| Issue | Impact | Fix |
|-------|--------|-----|
| Cross-module AC ownership undefined | SD-MM and PP-LE cross-module scenarios produce competing AC lists with no defined owner | Add Module Dependency Matrix to AGENTS.md specifying which analyst owns AC for each cross-module scenario |
| High/low risk criteria implicit | Governance approval gate applied inconsistently; "High risk" not quantified | Define risk checklist: callers_count ≥ 5 = High; transport required + callers > 0 = Medium; else Low |
| PM toolkit lacks impact analysis tools | PM cannot run AnalyzeCallGraph or GetCDSImpactAnalysis directly | Add these tools to PM agent definition |
| No parallel subagent failure protocol | A failing Phase 1 subagent blocks the entire workflow with no retry or fallback path | Define timeout (120 s) and single-retry protocol in AGENTS.md dispatch rules |
| PRD-AC format misalignment | Architect receives inconsistent AC formats from different analysts | Standardize AC format in prd-template.md; all analyst agents reference this template |

---

## 4. Area 3 — Skill Coverage

| Skill | Status | Required Action | Definition of Done |
|-------|--------|----------------|-------------------|
| `skills/abap-dev/SKILL.md` | Exists | Add performance tuning section | Section covers SQL Trace, ABAP Trace, index review |
| `skills/post-write-chain/SKILL.md` | Exists | Add PrettyPrint (optional) + GetCodeCoverage steps | Chain updated with new steps; SKILL.md reflects order |
| `skills/sap-fi/` etc. (6 module skills) | Exists | Add S/4HANA ACDOCA / Universal Journal query patterns | Each skill file contains at least one ACDOCA example |
| `skills/sap-security/` | **Missing — create** | Authority-Check patterns, SU24, SOD checklist | SKILL.md created; referenced from security-auditor agent |
| `skills/sap-performance/` | **Missing — create** | SQL Trace analysis, ABAP Trace, index effectiveness | SKILL.md created; referenced from performance-analyst agent |
| `skills/sap-cloud/` | **Missing — create** | ABAP Cloud Tier 1/2/3, CheckBoundaries, C1/C2 API Release State | SKILL.md created; referenced from cloud-advisor agent |
| `skills/sap-enhancement/` | **Missing — create** | BAdI, User Exit, Customer Include, Implicit/Explicit Enhancement | SKILL.md created; referenced from enhancement-expert agent |

---

## 5. Area 4 — Missing Agents

| Agent | Rationale | Priority | Suggested File | Trigger Keywords |
|-------|-----------|:--------:|----------------|-----------------|
| Security / Auth Agent | No agent currently owns Authority-Check auditing, SU24 maintenance, or SOD analysis | High | `agents/security-auditor.md` | AUTHORITY-CHECK, SU24, authorization object, SOD, user role |
| Performance Analyst | Gap between DBA (schema) and Architect (design); no agent owns SQL Trace or ABAP Trace analysis | High | `agents/performance-analyst.md` | slow query, SQL trace, ABAP trace, performance, runtime, index |
| ABAP Cloud / Steampunk Advisor | CheckBoundaries and C1/C2 API compliance verification required for S/4HANA readiness | Medium | `agents/cloud-advisor.md` | ABAP Cloud, Steampunk, tier 1/2/3, CheckBoundaries, released API |
| Enhancement Framework Expert | No agent covers BAdI implementation or Enhancement Spot design; currently falls to Architect | Medium | `agents/enhancement-expert.md` | BAdI, user exit, customer include, enhancement spot, implicit enhancement |
| QM Analyst | Quality Management tables (QMEL, QMFE) not covered; MM/PP cross-scenarios leave QM data unanalyzed | Low | `agents/qm-analyst.md` | inspection lot, quality notification, QMEL, QMFE, QM, QS* |

---

## 6. Priority Matrix

**Axis explanation**: X = implementation effort (creating/rewriting agent files vs. adding lines to existing files); Y = business impact (risk of missed defects or blocked workflows if not fixed).

Security and Performance agents appear in the hard-to-implement / high-impact quadrant because they require new agent files, new skills, and integration into the dispatch protocol — not just a few added tool lines.

```
                        HIGH IMPACT
                             │
   Security Agent ●          │      ● Toolkit fixes (§2.1–2.11)
   Performance Agent ●       │      ● Orchestration flow fixes (§3)
                             │
   ─────────────────────────┼────────────────────────────
   HIGH EFFORT               │              LOW EFFORT
                             │
   ABAP Cloud Advisor ●      │      ● New skills (sap-security/perf/cloud/enhancement)
   Enhancement Expert ●      │      ● Trigger keyword expansion
                             │      ● PRD-AC format alignment
                        LOW IMPACT
```

---

## 7. Proposed Roadmap — v0.6.0

### Sprint 1 — Foundation (Immediate — docs/config edits only, no new files)

| Task | Files to change | Definition of Done |
|------|----------------|-------------------|
| Toolkit additions for 6 agents | agents/code-writer.md, dba.md, interface-expert.md, devops-admin.md, sap-investigator.md, read-only-analyst.md | Each agent file lists all missing tools from Section 2 |
| Post-Write chain update | skills/post-write-chain/SKILL.md | PrettyPrint and GetCodeCoverage steps present with usage guidance |
| AGENTS.md orchestration additions | AGENTS.md | Module Dependency Matrix added; risk level checklist added; parallel subagent failure protocol added |
| PRD template alignment | docs/prd-template.md + all analyst agent files | All analyst agents reference prd-template.md; AC format consistent |
| Trigger keyword expansion | agents/mm-analyst.md, agents/co-analyst.md | EKET/EKES added to MM; CE4\* added to CO |

### Sprint 2 — Skill Expansion (Short-term — new SKILL.md files)

| Task | New file | Definition of Done |
|------|----------|-------------------|
| sap-security skill | skills/sap-security/SKILL.md | Covers Authority-Check, SU24, SOD; peer-reviewed |
| sap-performance skill | skills/sap-performance/SKILL.md | Covers SQL Trace steps, ABAP Trace, index review loop |
| sap-enhancement skill | skills/sap-enhancement/SKILL.md | Covers BAdI, User Exit, Customer Include with examples |
| S/4HANA pattern updates | skills/sap-fi/SKILL.md, skills/sap-co/SKILL.md | At least one ACDOCA/CE4\* example per skill |

### Sprint 3 — New Agents (Medium-term — new agent .md files)

| Task | New file | Definition of Done |
|------|----------|-------------------|
| Security Auditor agent | agents/security-auditor.md | Follows agent .md format; added to AGENTS.md registry; dispatch trigger keywords defined |
| Performance Analyst agent | agents/performance-analyst.md | Same; DBA handoff defined |
| Enhancement Expert agent | agents/enhancement-expert.md | Same; Architect handoff defined |
| Form Expert redefinition | agents/form-expert.md | browser_subagent removed; valid tools only; scope constraint documented |
| GUI Scripter decision | agents/gui-scripter.md | Either rewritten with valid tools OR marked as suspended with rationale |

### Sprint 4 — Advanced (Long-term)

| Task | Files | Definition of Done |
|------|-------|-------------------|
| ABAP Cloud Advisor agent | agents/cloud-advisor.md, skills/sap-cloud/SKILL.md | CheckBoundaries and API Release State integrated into dev workflow |
| RAP BO workflow | agents/fiori-developer.md | RAP development section added; Interface Expert boundary clarified |
| QM Analyst (conditional) | agents/qm-analyst.md | Created if QM scenarios are confirmed as recurring need by PM |

---

## 8. Total Issue Count

| Area | Issues Identified |
|------|:-----------------:|
| Agent Definition Quality | 22 |
| Orchestration Flow | 5 (de-duplicated) |
| Skill Coverage Gaps | 4 new skills needed |
| Missing Agents | 5 new agents proposed |
| **Total** | **33** |

---

*Generated by: PM-led roundtable — 2026-05-20*
*Spec author: Claude Code (claude-sonnet-4-6)*
*Next step: Invoke writing-plans skill to create implementation plan*
