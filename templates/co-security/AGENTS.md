# AGENTS.md

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

> **Canonical agent index** -auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`. Full project context in `docs/co-security.context.md`.

---

## Multi-Agent Phase Definitions

**co-security follows the standard 7-phase workflow** defined in [`phase-definitions.md`](phase-definitions.md) <!-- path resolves post-scaffolding -->.

**Phase Summary:**
| Phase | Name | PM Facilitation | Specialist Agents |
|-------|------|------------------|-------------------|
| 0 | Project Initiation | Orchestrator | scaffolding-expert |
| 1-2 | Planning & Architecture | Orchestrator | architect |
| 3 | Design Handoff | Orchestrator | threat-modeler (threat modeling, attack surface analysis) |
| 4 | Execution | Orchestrator | automation-engineer, docs-writer |
| 5 | Quality Assurance | Orchestrator | security-expert, auditor |
| 6 | Lifecycle Finalization | Orchestrator | lifecycle-manager |

**PM Facilitation Guidance:**
See [`phase-definitions.md`](phase-definitions.md) <!-- path resolves post-scaffolding --> for detailed PM tasks in each phase:
- Opening the phase (objective, specialist nomination, expectations)
- Progress monitoring (intervene only if standards not met)
- Synthesis of outputs (key findings, decisions)
- Provisional decision with justification
- Follow-up assignment

**Phase-Specific Notes for co-security:**
- **Phase 1-2 (Planning)**: Red Team Lead contributes to attack methodology and MITRE ATT&CK TTPs planning
- **Phase 3 (Design Handoff)**: Threat Modeler conducts STRIDE analysis and ATT&CK mapping; produces threat models and risk scoring
- **Phase 4 (Execution)**: Pentester performs vulnerability discovery and PoC development; Patch Engineer executes Ansible-based cross-platform patch deployment
- **Phase 5 (QA)**: All Red Team (Pentester) and Blue Team (Patch Engineer) outputs must pass security-expert and auditor validation

---

## Agent Roster

### 🛠️ Orchestration

| Agent | File | Role |
|-------|------|------|
| **Security PM** | [`agents/pm.md`](agents/pm.md) | Single entry point — owns authorization, scope, engagement workflow |
| Lifecycle Manager | [`agents/lifecycle-manager.md`](agents/lifecycle-manager.md) | Lifecycle state monitor and governance record keeper; secretary role — records, does not decide; dispatched at Phase 6 |

### 🔴 Red Team (Offense)

| Agent | File | Role |
|-------|------|------|
| Red Team Lead | [`agents/red-team-lead.md`](agents/red-team-lead.md) | Attack methodology, MITRE ATT&CK TTPs, PoC review |
| Pentester | [`agents/pentester.md`](agents/pentester.md) | Vulnerability discovery, PoC development, re-testing |
| Threat Modeler | [`agents/threat-modeler.md`](agents/threat-modeler.md) | STRIDE analysis, ATT&CK mapping, risk scoring |

### 🔵 Blue Team (Defense)

| Agent | File | Role |
|-------|------|------|
| Patch Engineer | [`agents/patch-engineer.md`](agents/patch-engineer.md) | Ansible-based cross-platform patch deployment |

### 📝 Reporting

| Agent | File | Role |
|-------|------|------|
| Report Writer | [`agents/report-writer.md`](agents/report-writer.md) | Pentest reports, executive summaries |

---

## PM Gateway Policy

**Single Point of Entry**: PM is the ONLY agent that users may directly invoke.
All specialist agents require PM dispatch - enforced at 4 levels.

### Enforcement Layers
1. **Tool-Level**: Agent tool rejects non-PM specialist calls (hard enforcement)
2. **System Prompt-Level**: CLAUDE.md/GEMINI.md rules loaded first
3. **Agent File-Level**: All specialists have "PM-ONLY INVOCATION" section
4. **QA Gate-Level**: Auditor detects bypass in Phase 5 QA

### Specialist Agent Dispatch Flow
```
User Request → PM Triage → Design Approval → Specialist Dispatch → QA Gate → Finalization
```

### Specialist Agent Roster (PM-ONLY INVOCATION)

All specialist agents below are dispatched ONLY through PM:

| Agent | Phase | Dispatch Trigger |
|-------|-------|-------------------|
| **scaffolding-expert** | 0 | "Creating new projects", "Template validation", "Scaffolding tasks" |
| **architect** | 1-2 | "Architecture design needed", "Project structure planning", "Technical decision making" |
| **automation-engineer** | 4 | "Creating scripts", "Cross-platform automation", "Implementation tasks" |
| **docs-writer** | 4 | "Updating documentation", "README creation", "CHANGELOG updates" |
| **security-expert** | 5 | "Security review", "Hook configuration", "Secret detection" |
| **auditor** | 5 | "Quality verification", "Documentation consistency check", "QA gate required" |
| **lifecycle-manager** | 6 | "Governance documents update", "Lifecycle state report", "Phase 6 Finalization" |

**⚠️ IMPORTANT**: Do NOT invoke any specialist agent directly. All requests must go through PM.

---

## PM Dispatch Protocol

### Authorization Gate

Before dispatching any Phase 1+ agent, PM **must** run `verify-authorization` skill to confirm:
- Signed authorization document exists
- All required fields present (including signature date and signatory title authority)
- Scope document exists
- Engagement window is active

If `verify-authorization` returns BLOCKED ❌, **do not dispatch any specialist agent**.

### Phase-Based Dispatch

| Phase | Agent(s) | Trigger |
|-------|-----------|---------|
| 0 (Scoping) | PM only | Engagement start |
| 1 (Recon) | Red Team Lead + Threat Modeler | Authorization confirmed |
| 2 (Threat Modeling) | Threat Modeler | Phase 1 complete |
| 3 (Exploitation) | Red Team Lead → Pentester | Threat model approved |
| 4 (Remediation) | Patch Engineer | Findings documented |
| 5 (Reporting) | Report Writer | Patches applied |
| 6 (Verification) | Pentester (re-test) | Report complete |

### Quality Gates

- Phase 1: Authorization required (verify-authorization PASS)
- Phase 3: PoC must be reviewed by Red Team Lead
- Phase 4: All Ansible playbooks must pass `--check` (dry-run) before apply

---

## Skills

See `docs/co-security.context.md § Skills` for the full skill registry including:
- verify-authorization (hard gate for Phase 1+)
- engagement-scoping, threat-modeling, recon-surface, finding-tracker, pentest-report, patch-automation
- meeting-facilitation, agent-lifecycle-manager, skill-lifecycle-manager
