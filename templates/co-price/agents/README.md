# Agents Directory

This directory contains agent definition files for the co-price pricing management and consulting workflow.

## Available Agents

| Agent | File | Role | Tier |
|-------|------|------|------|
| PM (Pricing Consulting Orchestrator) | `pm.md` | Dual-lifecycle orchestration, sole dispatcher | High |
| Finance Strategy & Channel Lead | `finance-strategy-lead.md` | Multi-industry pricing/P&L LaTeX spec authorship | High |
| Cost & Asset Management | `cost-asset-mgmt.md` | OPEX/CAPEX, depreciation, BOM cost roll-ups, shock bands | High |
| P&L Engine Auditor (CPA) | `cpa-auditor.md` | Double-entry integrity, `[Ref:]`-tagged Vitest harness | High |
| Pricing Strategist | `pricing-strategist.md` | Diagnostics/elasticity to F/T/S recommendations, corridors | High |
| Market Intelligence Analyst | `market-intelligence-analyst.md` | Benchmarks, VW/GG survey analytics, competitor prices | High |
| Engagement Director | `engagement-director.md` | Diagnose → Design → Validate → Deliver orchestration | High |
| Lead Architect & Data Guard | `lead-architect.md` | Prisma modeling, batch schema design, AI contracts | High |
| Core Engine Developer | `core-engine-dev.md` | Drift-free TypeScript engine, on-rails AI transport | High |
| Security Auditor | `security-auditor.md` | Zod guardrails, API boundary audits, PRICE_* env | High |
| UX & Visual Specialist | `ux-specialist.md` | Onyx 2.0 components, copilot panel, user guides | High |
| End-to-End QA Engineer | `qa-tester.md` | Component mounting, browser assertions, streaming | High |
| DevOps & CI/CD Admin | `devops-admin.md` | Bun toolchain, Docker stages, git hooks | High |
| Global Strategy & L10N Auditor | `l10n-auditor.md` | 16-locale parity, glossary adherence, RTL safety | Medium |
| Security Monitor | `security-monitor.md` | Vuln/advisory scans, gitleaks, dependency policy | Medium |

## Creating New Agents

```bash
bun run agent:create <name> --role "Display Name" --group <group>
```

After creating: update `AGENTS.md` and `docs/co-price.context.md § Agents`.

## Listing Agents

```bash
bun run agent:list
bun run agent:list --group Strategy
```

## Deleting Agents

```bash
bun run agent:delete <name>
```

See `AGENTS.md` for the full workflow and dispatch protocol.