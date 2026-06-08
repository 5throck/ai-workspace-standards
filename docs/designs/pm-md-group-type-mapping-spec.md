# PM.md Group → Type Mapping Specification

**Document Version**: 1.0.0  
**Last Updated**: 2026-06-08  
**Status**: Active Specification  
**Maintainer**: architect agent

---

## Overview

This specification defines the comprehensive Group → Type mapping rules for all L2 variant templates (co-consult, co-design, co-develop, co-security, co-work). The mapping is used by `merge-frontmatter.ts` to:

1. Dynamically generate **Agent Roster Responsibility** fields
2. Populate **Phase Determination Table** with correct agent types
3. Ensure **MANDATORY Dispatch List** contains only variant-specific agents
4. Prevent **L0 agent leakage** into L2 variants

---

## Core Mapping Rules

### Primary Group → Type Mappings

| Group Category | Group Names | Agent Type | Rationale |
|----------------|-------------|------------|-----------|
| **Design** | Design, Direction, Visual, Typography, Service | `design` | Creative and visual design work |
| **Execution** | Execution, Prototype, Implementation | `execution` | Hands-on implementation and prototyping |
| **Analysis** | Analysis, Research, Subject Matter, SME, Data | `qa` | Analysis, research, and domain expertise |
| **Strategy** | Strategy | `qa` (default) | Strategic analysis (primary) |
| **Coordination** | Coordination, Management, PMO | `pm` or `orchestrator` | Project management and coordination |
| **Infrastructure** | Tools, Office, Tech, Technology, Architecture, Setup | `infrastructure` | Technical infrastructure and tooling |
| **Content** | Content, Narrative, Comm | `documentation` | Content creation and communication |
| **Security** | Security, Red Team, Blue Team, Analysis (security context) | `security` | Security-specific work |
| **Delivery** | Delivery, Workstream | `delivery` | Delivery management |

---

## Ambiguous Group Handling

### Strategy Group (Special Case)

**Ambiguity**: "Strategy" group could be classified as either:
- `qa` type (strategic analysis, planning)
- `design` type (strategic design, product strategy)

**Resolution Rules**:

1. **Default classification**: `qa` type (strategic analysis is primary)
2. **Context-based override**: If variant's primary focus is design-oriented (e.g., co-design), classify as `design` type
3. **Variant-specific analysis**:
   - **co-consult**: Strategy → `qa` (consulting strategy = analysis)
   - **co-design**: Strategy → `design` (design strategy)
   - **co-develop**: Strategy → `qa` (technical strategy)
   - **co-security**: N/A (no Strategy group)
   - **co-work**: N/A (no Strategy group)

**Implementation Note**: When encountering "Strategy" group, check variant context. If variant is design-centric, use `design` type. Otherwise, default to `qa` type.

### Other Ambiguous Groups

| Group | Ambiguity | Resolution Rule |
|-------|-----------|-----------------|
| **Analysis** | Could be `qa` (analysis) or `security` (threat analysis) | Check phase context: If "Threat" phase → `security`, else `qa` |
| **Architecture** | Could be `infrastructure` (technical architecture) or `design` (system design) | Default to `infrastructure` (technical) |
| **Tech** / **Technology** | Could be `infrastructure` or `execution` | Default to `infrastructure` |
| **Domain** / **SME** | Could be `qa` (domain analysis) or specialized type | Default to `qa` |

---

## Fallback Hierarchy

### Missing Agent Type Scenarios

When a variant's agent_roster lacks a specific agent type, use this fallback hierarchy:

| Needed Type | Primary Fallback | Secondary Fallback | Final Fallback |
|-------------|------------------|--------------------|-----------------|
| `design` | designer | architect (workspace) | ❌ Error (critical) |
| `execution` | code-writer | prototype-engineer | automation-engineer (L0) |
| `qa` | analyst | researcher | auditor (L0) |
| `pm` | project-coordinator | delivery-manager | pm (L0) |
| `infrastructure` | technology-specialist | solutions-architect | security-expert (L0) |
| `documentation` | technical-writer | content-writer | docs-writer (L0) |
| `security` | security-monitor | threat-modeler | security-expert (L0) |
| `delivery` | delivery-manager | workstream-lead | pm (L0) |

**Fallback Rules**:

1. **Primary fallback**: Use the most common variant agent for that type
2. **Secondary fallback**: Use workspace-specialist variant agent
3. **Final fallback**: Use L0 agent (workspace governance) - **only in extreme cases**
4. **Error condition**: If `design` type has no fallback, error is critical (design is non-negotiable)

**Implementation Note**: Log fallback usage to audit trail. L0 fallbacks should trigger warnings.

---

## Variant-Specific Analysis

### 1. co-consult

**Agent Roster Structure**:

| Phase | Group | Agents | Type Mapping | Responsibility |
|-------|-------|--------|--------------|-----------------|
| Triage / Analysis | Analysis | auditor | `qa` | Quality assurance and compliance validation |
| Consulting | Client | engagement-leader | `pm` | Client relationship management and engagement coordination |
| Consulting | Strategy | strategy-analyst | `qa` | Strategic analysis and planning |
| Consulting | Domain | industry-expert | `qa` | Domain expertise and business analysis |
| Consulting | Change | change-management-partner | `delivery` | Change management and organizational transformation |
| Consulting | Comm | communications-lead | `documentation` | Communication strategy and stakeholder engagement |
| Technology | Architecture | solutions-architect | `infrastructure` | Technical architecture and solution design |
| Delivery | PMO | workstream-lead, delivery-manager | `pm` / `delivery` | Project management and delivery coordination |
| Subject Matter | SME | sme | `qa` | Subject matter expertise and consultation |
| Analysis | Data | data-analyst | `qa` | Data analysis and business intelligence |
| Technology | Tech | technology-specialist | `infrastructure` | Technology consulting and technical guidance |

**Type Distribution**:
- `qa`: 4 agents (analyst, strategist, domain expert, sme, data analyst)
- `pm`: 2 agents (engagement leader, delivery manager)
- `infrastructure`: 2 agents (solutions architect, technology specialist)
- `delivery`: 1 agent (change management partner)
- `documentation`: 1 agent (communications lead)

**Special Cases**:
- Strategy group → `qa` (consulting strategy = analytical work)
- Architecture group → `infrastructure` (technical solutions)
- PMO group split: workstream-lead → `pm`, delivery-manager → `delivery`

---

### 2. co-design

**Agent Roster Structure**:

| Phase | Group | Agents | Type Mapping | Responsibility |
|-------|-------|--------|--------------|-----------------|
| Research | Research | ux-researcher | `qa` | User research and UX analysis |
| Direction | Design | design-lead | `design` | Design direction and creative leadership |
| Visual | Design | visual-designer | `design` | Visual design and UI/UX execution |
| Prototype | Execution | prototype-engineer | `execution` | Prototyping and interactive mockups |
| Service | Design | service-designer | `design` | Service design and experience strategy |
| Typography | Design | typography-expert | `design` | Typography and visual language systems |
| Narrative | Content | storyteller | `documentation` | Narrative design and content strategy |

**Type Distribution**:
- `design`: 4 agents (design lead, visual designer, service designer, typography expert)
- `qa`: 1 agent (ux researcher)
- `execution`: 1 agent (prototype engineer)
- `documentation`: 1 agent (storyteller)

**Special Cases**:
- Research group → `qa` (UX research = analysis)
- Narrative group → `documentation` (content creation)
- All Design groups → `design` type (consistent design specialization)

---

### 3. co-develop

**Agent Roster Structure**:

| Phase | Group | Agents | Type Mapping | Responsibility |
|-------|-------|--------|--------------|-----------------|
| Design | Design | architect, designer | `design` | Software architecture and design |
| Implementation | Execution | code-writer | `execution` | Code implementation and development |
| QA / Verification | Execution | test-runner | `execution` | Testing and quality assurance |
| Setup (unknown stack) | Setup | stack-setup | `infrastructure` | Development environment setup |
| Triage / Security | Security | security-monitor | `security` | Security monitoring and vulnerability triage |

**Type Distribution**:
- `design`: 2 agents (architect, designer)
- `execution`: 2 agents (code-writer, test-runner)
- `infrastructure`: 1 agent (stack-setup)
- `security`: 1 agent (security-monitor)

**Special Cases**:
- Design group → `design` (software design)
- Execution group appears twice → both map to `execution`
- Setup group → `infrastructure` (dev tooling)
- Security group → `security` (security-focused)

---

### 4. co-security

**Agent Roster Structure**:

| Phase | Group | Agents | Type Mapping | Responsibility |
|-------|-------|--------|--------------|-----------------|
| Threat Modeling | Red Team | red-team-lead | `security` | Red team operations and adversarial simulation |
| Penetration Testing | Red Team | pentester | `security` | Penetration testing and vulnerability exploitation |
| Threat Analysis | Analysis | threat-modeler | `security` | Threat modeling and risk assessment |
| Remediation | Blue Team | patch-engineer | `execution` | Vulnerability remediation and patch deployment |
| Reporting | Documentation | report-writer | `documentation` | Security reporting and documentation |

**Type Distribution**:
- `security`: 3 agents (red team lead, pentester, threat modeler)
- `execution`: 1 agent (patch engineer)
- `documentation`: 1 agent (report writer)

**Special Cases**:
- Analysis group → `security` (threat analysis context)
- Red Team group → `security` (adversarial operations)
- Blue Team group → `execution` (remediation is execution)
- Documentation group → `documentation` (reporting)

---

### 5. co-work

**Agent Roster Structure**:

| Phase | Group | Agents | Type Mapping | Responsibility |
|-------|-------|--------|--------------|-----------------|
| Research | Analysis | analyst | `qa` | Business analysis and research |
| Content | Content | content-writer | `documentation` | Content creation and copywriting |
| Technical | Documentation | technical-writer | `documentation` | Technical documentation and knowledge management |
| Coordination | Management | project-coordinator | `pm` | Project coordination and task management |
| Office | Tools | ms365-expert | `infrastructure` | Microsoft 365 tooling and productivity support |
| Narrative | Content | storyteller | `documentation` | Narrative design and storytelling |

**Type Distribution**:
- `documentation`: 3 agents (content writer, technical writer, storyteller)
- `qa`: 1 agent (analyst)
- `pm`: 1 agent (project coordinator)
- `infrastructure`: 1 agent (ms365 expert)

**Special Cases**:
- Content group appears twice → both map to `documentation`
- Analysis group → `qa` (research and analysis)
- Management group → `pm` (coordination)
- Tools group → `infrastructure` (office productivity tools)

---

## Implementation Examples

### Example 1: co-design Phase Determination Table

**Input**: co-design agent_roster with group → type mapping applied

**Generated Table**:

| Deliverable Type | → Phase | → Required Agent | → Tier |
|-----------------|---------|-----------------|--------|
| New UI design / visual system | Phase 1-2 | design-lead | High |
| Prototype implementation | Phase 4 | prototype-engineer | Low |
| UX research and analysis | Phase 1-2 | ux-researcher | Medium |
| Documentation update | Phase 4 | storyteller | Medium |

**Key Points**:
- No L0 agents (architect, automation-engineer, etc.) in table
- All agents are co-design specific
- Type mapping correctly identifies design-lead as `design` type

### Example 2: co-consult Strategy Group Handling

**Input**: co-consult agent_roster with Strategy group

**Classification Process**:
1. Detect "Strategy" group
2. Check variant context: co-consult (consulting-focused, not design-centric)
3. Apply rule: Strategy → `qa` type (consulting strategy = analysis)
4. Map to agent: strategy-analyst
5. Generate responsibility: "Strategic analysis and planning"

**Result**: Strategy group correctly classified as `qa`, not `design`

### Example 3: co-develop Missing Agent Type Fallback

**Input**: co-develop agent_roster lacks dedicated `qa` type agent

**Scenario**: Need `qa` type for Phase Determination table

**Fallback Process**:
1. Check agent_roster for `qa` type: Not found
2. Apply primary fallback: analyst (not in roster)
3. Apply secondary fallback: researcher (not in roster)
4. Apply final fallback: auditor (L0 agent) - **WARNING LOGGED**
5. Use auditor with warning: "L0 fallback used - consider adding qa-specialist to roster"

**Result**: Table populated but L0 leakage warning triggered

---

## Validation Criteria

### Must-Have Tests

1. **L0 Leakage Prevention Test**:
   ```typescript
   test('Phase Determination table must not contain L0 agents', () => {
     const forbidden = ['automation-engineer', 'docs-writer', 'architect', 'auditor', 'security-expert', 'scaffolding-expert'];
     const generated = generatePhaseDeterminationTable(coWorkOverrides);
     forbidden.forEach(agent => {
       expect(generated).not.toContain(agent);
     });
   });
   ```

2. **Responsibility Completeness Test**:
   ```typescript
   test('All roster entries must have non-empty responsibility', () => {
     const roster = extractRoster(coWorkOverrides);
     roster.forEach(entry => {
       expect(entry.responsibility).toBeTruthy();
       expect(entry.responsibility.length).toBeGreaterThan(0);
     });
   });
   ```

3. **Group → Type Mapping Accuracy Test**:
   ```typescript
   test('Strategy group classification respects variant context', () => {
     const coConsultType = mapGroupToType('Strategy', 'co-consult');
     const coDesignType = mapGroupToType('Strategy', 'co-design');
     expect(coConsultType).toBe('qa');
     expect(coDesignType).toBe('design');
   });
   ```

4. **Fallback Hierarchy Test**:
   ```typescript
   test('Missing agent types trigger correct fallback chain', () => {
     const result = resolveAgentType('design', coDevelopRoster);
     expect(result.agent).toBe('designer');  // Primary fallback
     expect(result.warnings).toHaveLength(0);  // No warnings (valid fallback)
   });
   ```

---

## Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-06-08 | Initial specification creation | architect |

---

## References

- [Meeting Notes: PM.md Variant-Specific Content Injection](/memory/meeting-2026-06-08-pm-md-variant-specific-content-injection.md)
- [CONSTITUTION.md §5 - Multi-Agent Architecture](/CONSTITUTION.md#5-multi-agent-architecture)
- [merge-frontmatter.ts](/scripts/merge-frontmatter.ts) - Implementation target
