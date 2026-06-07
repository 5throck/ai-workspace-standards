# AGENTS.md

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

> **Canonical agent index** - auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`.
> **Agent architecture and governance rules**: See [CONSTITUTION.md §5 - Multi-Agent Architecture](CONSTITUTION.md#5-multi-agent-architecture).

---

## Multi-Agent Phase Definitions

**co-security uses a 6-phase engagement model** (deviation from standard 7-phase). Phases are security-engagement-specific and do not map 1:1 to the common phase-definitions.md workflow.

**Phase Summary:**
| Phase | Name | PM Facilitation | Specialist Agents |
|-------|------|-----------------|-------------------|
| 0 | Authorization & Scope | Orchestrator | — (PM only) |
| 1-2 | Reconnaissance & Threat Modeling | Observer | red-team-lead, threat-modeler |
| 3 | Attack Execution | Coordinator | red-team-lead, pentester |
| 4 | Remediation | Coordinator | patch-engineer |
| 5 | Reporting | Coordinator | report-writer |
| 6 | PR & Handoff | Owner | — (PM only) |

**PM Facilitation Guidance:**
See [`phase-definitions.md`](docs/phase-definitions.md) <!-- path resolves post-scaffolding --> for detailed PM tasks in each phase:
- Opening the phase (objective, specialist nomination, expectations)
- Progress monitoring (intervene only if standards not met)
- Synthesis of outputs (key findings, decisions)
- Provisional decision with justification
- Follow-up assignment

**Phase-Specific Notes for co-security:**
- **Phase 1-2 (Recon & Threat Modeling)**: Red Team Lead contributes to attack methodology and MITRE ATT&CK TTPs planning; Threat Modeler conducts STRIDE analysis and ATT&CK mapping, producing threat models and risk scoring
- **Phase 3 (Exploitation)**: Pentester performs vulnerability discovery and PoC development
- **Phase 4 (Remediation)**: Patch Engineer executes Ansible-based cross-platform patch deployment
- **Phase 5 (Reporting & QA)**: All Red Team (Pentester) and Blue Team (Patch Engineer) outputs must pass security-expert and auditor validation

---

## Agent Roster

### 🛠️ Orchestration

| Agent | File | Role |
|-------|------|------|
| **Security PM** | [`agents/pm.md`](agents/pm.md) | Single entry point — owns authorization, scope, engagement workflow |

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

### PM Direct Execution Scope

PM is an escalation gateway, not an executor. The following whitelist defines what PM may execute directly.

| Category | Tools | Scope |
|----------|-------|-------|
| Unconditional | Read, Glob, Grep, Agent, TaskCreate, TaskUpdate, AskUserQuestion, Skill, ToolSearch | Always allowed |
| Conditional | Write, Edit | `memory/*.md` and `CHANGELOG.md` only |
| Conditional | Bash | Read-only: `git status/diff/log`, `bun scripts/audit.ts`, `ls`, `cat` |
| Forbidden | Write, Edit (other paths), Bash (write/execute) | Must delegate to specialist |

When a specialist agent's required tool is denied, PM applies the [Permission Denial Protocol](agents/pm.md#permission-denial-protocol) — never substitutes for the specialist.

### Specialist Agent Roster (PM-ONLY INVOCATION)

All specialist agents below are dispatched ONLY through PM:

| Agent | Phase | Dispatch Trigger |
|-------|-------|-------------------|
| **red-team-lead** | 1-2, 3 | "Recon needed", "Attack methodology", "PoC review" |
| **threat-modeler** | 1-2 | "STRIDE analysis", "ATT&CK mapping", "Risk scoring" |
| **pentester** | 3, 6 | "Vulnerability discovery", "PoC development", "Re-testing" |
| **patch-engineer** | 4, 6 | "Ansible playbooks", "Patch deployment", "Sign-off" |
| **report-writer** | 5, 6 | "Pentest reports", "Executive summaries" |
| **security-expert** | 5 | "Security review", "Hook configuration", "Secret detection" |
| **auditor** | 5 | "Quality verification", "Documentation consistency check", "QA gate required" |

**⚠️ IMPORTANT**: Do NOT invoke any specialist agent directly. All requests must go through PM.

---

## PM Dispatch Protocol

### Superpowers Plugin & Cost Optimization (3-Tier Strategy)

The PM agent MUST leverage the **`superpowers`** plugin for harness engineering using a 3-tier model strategy to optimize cost and quality:

- **High-tier (Design/Plan)**: Used exclusively by the PM/Red Team Lead for complex reasoning, architectural design, and writing precise sub-agent prompts.
- **Medium-tier (Review/QA)**: Used by Threat Modeler or Patch Engineer to review code, run tests, and perform quality gates. Acts as an independent supervisor.
- **Low-tier (Coding/Execute)**: Used by Pentester/Report Writer agents for fast typing, simple repetitive coding, or strictly scoped tasks.

**Tier Adjustment Rules:**
- The PM can dynamically downgrade an agent's Tier for simple tasks (Assigned <= Baseline) to save costs.
- The PM can NEVER upgrade a Tier above the baseline.
- If a downgraded task fails, the PM MUST restore the agent's baseline Tier for the retry.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments (e.g. `thinking_level`) are explicitly managed within the workspace configuration files (`CLAUDE.md` and `GEMINI.md`). Please refer to those files for your specific tool's exact AI model mappings and tier strategies.

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
| 1-2 (Recon & Threat Modeling) | Red Team Lead + Threat Modeler | Authorization confirmed |
| 3 (Exploitation) | Red Team Lead → Pentester | 1) Threat model (STRIDE) complete and PM-approved; 2) ATT&CK TTP list finalized; 3) Red Team Lead PoC methodology review complete |
| 4 (Remediation) | Patch Engineer | Findings documented |
| 5 (Reporting) | Report Writer | Patches applied |
| 6 (Verification) | Pentester (re-test) → Patch Engineer (sign-off) → Report Writer (update) → PM (close) | Report complete; Condition A: unpatched items found → append "Verification Gap", re-enter Phase 4; Condition B: all patched → update Executive Summary, PM closes |

### Quality Gates

- Phase 1: Authorization required (verify-authorization PASS)
- Phase 3: All three entry conditions must be met (STRIDE complete + TTP list + Red Team Lead review) — PM must confirm before dispatching Pentester
- Phase 4: All Ansible playbooks must pass `--check` (dry-run) before apply — PM must receive dry-run output before dispatching apply
- Phase 6: Patch Engineer sign-off required before Report Writer update; if unpatched items found, re-enter Phase 4

---

## Skills

| Skill | Path | Description |
|-------|------|-------------|
| **Agent Lifecycle Manager** | `skills/agent-lifecycle-manager/SKILL.md` | Security PM managing agent lifecycle; creating new agents, updating frontmatter, validating agent status and tiers |
| **Skill Lifecycle Manager** | `skills/skill-lifecycle-manager/SKILL.md` | Security PM managing skill lifecycle after agent configuration changes |
| **Meeting Facilitation** | `skills/meeting-facilitation/SKILL.md` | Running structured multi-agent meetings for collaborative decision-making |
| **Project Review** | `.claude/skills/project-review/SKILL.md` | Comprehensive parallel review by all available agents; produces prioritized improvement plan |
| **Audit Workspace** | `skills/audit-workspace/SKILL.md` | Runs workspace audit scripts to enforce CONSTITUTION.md compliance |
| **Security Scan** | `skills/security-scan/SKILL.md` | Runs security scanning tools across the workspace |

See `docs/co-security.context.md § Skills` for the full skill registry including domain-specific skills:
- verify-authorization (hard gate for Phase 1+)
- engagement-scoping, threat-modeling, recon-surface, finding-tracker, pentest-report, patch-automation

---

## Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:

- **Search Tool Prioritization**: Prioritize MCP semantic search tools (e.g., codegraph) for AST-aware insights over basic file search. Use standard grep as a fallback if MCP tools are unavailable.
<!-- COMMON-AGENTS:START -->
## Language Policy

**English-Only Documentation Rule**: All workspace documentation files (.md) must be written in English, with explicit exceptions for recognized locale translation zones (see Translation Zones below).

### English Documentation Requirement
- All `.md` files outside `ko/` and `locales/ko/` directories MUST be in English
- Applies to: README.md, CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md, CHANGELOG.md, all documentation in docs/, agents/, skills/
- Rationale: English documentation ensures global accessibility and cross-team collaboration

### Translation Zones (Locale Exceptions)
- `<lang-code>/` directories — language-specific documentation (e.g. `ko/`, `ja/`)
- `locales/<lang-code>/` — locale translation files for internationalization (e.g. `locales/ko/`, `locales/zh-CN/`)
- These are the ONLY locations where non-English `.md` files are permitted
- Recognized locale codes (from `docs/workspace-schema.json` `i18n.locale_codes`):
  `ko`, `ja`, `zh-CN`, `zh-TW`, `de`, `es`, `fr`, `pt`, `vi`, `ms`, `id`, `th`, `ru`, `it`, `ar`

### Enforcement
- Pre-commit audit checks for Korean content outside ko/ and locales/ko/
- PR reviews reject non-English documentation outside translation zones
- Auditor validates compliance during Phase 6 QA gate

### Git/PR Artifacts Language Rule
- All commit messages: English
- All PR titles: English
- All PR descriptions: English
- All branch names: English
- Code comments: English (unless documenting locale-specific logic)
<!-- COMMON-AGENTS:END -->
