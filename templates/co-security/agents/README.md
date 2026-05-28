# Agents Directory

This directory contains agent definition files for co-security engagement workflows.

## Available Agents

| Agent | File | Role |
|-------|------|------|
| Security PM | `pm.md` | Single entry point — owns authorization, scope, and engagement workflow |
| Red Team Lead | `red-team-lead.md` | Attack methodology, MITRE ATT&CK TTPs, PoC review |
| Pentester | `pentester.md` | Vulnerability discovery, PoC development, re-testing |
| Threat Modeler | `threat-modeler.md` | STRIDE analysis, ATT&CK mapping, risk scoring |
| Patch Engineer | `patch-engineer.md` | Ansible-based cross-platform patch deployment |
| Report Writer | `report-writer.md` | Pentest reports, executive summaries |

## ⚠️ Authorization Required

All agents except PM require a confirmed authorization document before dispatching.
PM runs `verify-authorization` skill automatically before any Phase 1+ activity.

## Creating New Agents

```bash
bun run agent:create <name> --role "Display Name" --group Security
```

After creating: update `AGENTS.md` and `docs/co-security.context.md § Agents`.

See `AGENTS.md` for the full engagement workflow (Phases 0–6).
