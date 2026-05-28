# AGENTS.md

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

> **Canonical agent index** -auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`. Full project context in `docs/co-security.context.md`.

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
