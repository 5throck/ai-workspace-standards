# Agents Directory

This directory contains agent definition files for the co-abap SAP ABAP harness engineering workflow.

## Available Agents

| Agent | File | Role | Tier |
|-------|------|------|------|
| Project Manager (PM) | `pm.md` | Workflow orchestration, dispatch, quality gates, lifecycle management | High |
| SD Analyst | `sd-analyst.md` | Sales & Distribution module analysis — activates on SD trigger keywords | Medium |
| MM Analyst | `mm-analyst.md` | Materials Management module analysis — activates on MM trigger keywords | Medium |
| FI Analyst | `fi-analyst.md` | Financial Accounting module analysis — activates on FI trigger keywords | Medium |
| CO Analyst | `co-analyst.md` | Controlling module analysis — activates on CO trigger keywords | Medium |
| PP Analyst | `pp-analyst.md` | Production Planning module analysis — activates on PP trigger keywords | Medium |
| LE Analyst | `le-analyst.md` | Logistics Execution module analysis — activates on LE trigger keywords | Medium |
| Architect | `architect.md` | Technical Execution Lead — pattern selection, execution sequencing, DBA coordination | High |
| Code Writer | `code-writer.md` | ABAP implementation via WriteSource/EditSource, syntax check | Low |
| Test Runner | `test-runner.md` | QA verification — unit tests, code coverage, ATC check | Low |
| DBA | `dba.md` | Table/CDS/index design, SQL performance tuning, ERD normalization | Medium |
| DevOps Admin | `devops-admin.md` | Transport management, infrastructure install, system audit | Low |
| SAP Investigator | `sap-investigator.md` | Codebase pattern scan, historical design extraction (read-only) | Medium |
| Read-Only Analyst | `read-only-analyst.md` | Business data queries, AS-IS analysis with draft AC (read-only) | Medium |
| Schema Inspector | `schema-inspector.md` | Table/CDS structure inspection, dependency maps (read-only) | Medium |
| Interface Expert | `interface-expert.md` | OData/RFC/IDoc interface design and connectivity validation | Medium |
| Fiori Developer | `fiori-developer.md` | UI5/Fiori screen design and implementation | Medium |
| Form Expert | `form-expert.md` | SAP Script, Smart Forms, Adobe Forms design and print programs | Medium |
| Security Monitor | `security-monitor.md` | Security policies enforcement and safe dependency audit | Low |
| GUI Scripter | `gui-scripter.md` | BDC / VBS automation — LAST RESORT when no BAPI/OData/RFC alternative exists | Low |

## Creating New Agents

```bash
bun run agent:create <name> --role "Display Name" --group <group>

# Examples:
bun run agent:create wm-analyst --role "WM Analyst" --group Business
bun run agent:create ci-cd-agent --role "CI/CD Agent" --group Technical
```

After creating: update `AGENTS.md` and `docs/co-abap.context.md`.

## Listing Agents

```bash
bun run agent:list
bun run agent:list --group Business
```

## Deleting Agents

```bash
bun run agent:delete <name>
```

See `AGENTS.md` for the full workflow and dispatch protocol.
