# Skills Index

Auto-generated index of all available skills in the `skills/` directory.

## Core Skills

| Skill | Description | Trigger |
|-------|-------------|---------|
| `abap-dev` | SAP ABAP development workflows and MCP tool optimization | Session start |
| `post-write-chain` | Mandatory QA chain after any WriteSource/EditSource | After write operations |
| `desktop-app-fallback` | Manual Post-Write QA for Desktop App | Desktop App usage |
| `source-command-celebrate` | Celebration for successful task completion | After task completion |

## Module-Specific Skills

| Skill | Description | Trigger |
|-------|-------------|---------|
| `sap-sd` | Sales & Distribution module context | SD tasks (sales orders, billing) |
| `sap-mm` | Materials Management module context | MM tasks (purchasing, inventory) |
| `sap-fi` | Financial Accounting module context | FI tasks (journal entries, GL) |
| `sap-co` | Controlling module context | CO tasks (cost centers, CO-PA) |
| `sap-pp` | Production Planning module context | PP tasks (BOM, routing) |
| `sap-le` | Logistics Execution module context | LE tasks (shipping, warehouse) |

## Utility Skills

| Skill | Description | Trigger |
|-------|-------------|---------|
| `changelog` | Add entry to CHANGELOG.md [Unreleased] | After completing changes |
| `memlog` | Append session entry to memory/YYYY-MM-DD.md | During/after session |
| `new-task` | Create task file from template | New task start |
| `new-project` | Scaffold new project structure | New project start |
| `post-write` | Run Post-Write QA chain | After ABAP writes |
| `sync` | Full sync pipeline (memlog → changelog → audit → commit) | Session end |
| `transport` | Manage SAP Transport Requests | Transport operations |
| `triage` | Auto-classify and dispatch for SAP requests | New SAP task |
| `verify` | Verify code changes by running the app | Testing changes |

## Skill Loading

Skills are auto-discovered from the `skills/` directory at session start.

To add a new skill:
1. Create `skills/<skill-name>/SKILL.md`
2. Add frontmatter with `name`, `description`, `metadata.type`
3. Skill will be automatically discovered

---

*Generated: 2026-05-24*
*Source: `skills/` directory scan*
