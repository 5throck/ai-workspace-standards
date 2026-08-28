# co-price Context

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE — all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md                — immutable project identity (architecture, standards)
>   2. docs/co-price.context.md       — THIS FILE — tech stack, agents, skills, workflow

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript 5+ (strict) |
| **Framework** | Next.js 16 (App Router, React 19) · Standalone output |
| **Database** | SQLite + Prisma 7 ORM (@prisma/adapter-better-sqlite3) |
| **Math Engine** | mathjs BigNumber wrappers (`fAdd/fSub/fMul/fDiv`) — no IEEE 754 drift |
| **Validation** | Zod runtime guards |
| **Styling** | Tailwind CSS 4 · Onyx 2.0 design system |
| **Auth** | NextAuth v4 (dynamic cookie prefixing) |
| **AI Transport** | self-built multi-provider fetch adapters (ADR-0003) — zero LLM SDKs |
| **Package Manager** | Bun (single lock source `bun.lock`, ADR-0001) |
| **Testing** | Vitest harness ([Ref:] tagged) |

---

## Agents

15 agents across five groups. Full roster/dispatch: [`AGENTS.md`](../AGENTS.md);
authoritative definitions in `agents/*.md`.

| Agent | File | Role | Status |
|-------|------|------|--------|
| PM (Pricing Consulting Orchestrator) | `agents/pm.md` | Dual-lifecycle orchestration; sole dispatcher | active |
| finance-strategy-lead | `agents/finance-strategy-lead.md` | Multi-industry pricing/P&L LaTeX spec authorship | active |
| cost-asset-mgmt | `agents/cost-asset-mgmt.md` | Cost structures, depreciation, shock bands | active |
| cpa-auditor | `agents/cpa-auditor.md` | Double-entry audit, `[Ref:]` harness certificates | active |
| pricing-strategist | `agents/pricing-strategist.md` | Diagnostics → F/T/S recommendations | active |
| market-intelligence-analyst | `agents/market-intelligence-analyst.md` | Benchmarks, VW/GG analytics, provenance | active |
| engagement-director | `agents/engagement-director.md` | Engagement lifecycle & deliverable gates | active |
| lead-architect | `agents/lead-architect.md` | Prisma modeling, AI-infrastructure contracts | active |
| core-engine-dev | `agents/core-engine-dev.md` | Engine + AI transport implementation | active |
| security-auditor | `agents/security-auditor.md` | Zod guards, API boundaries, PRICE_* env | active |
| ux-specialist | `agents/ux-specialist.md` | Onyx UI, copilot panel, user guides | active |
| l10n-auditor | `agents/l10n-auditor.md` | 16-locale parity, glossary, RTL | active |
| security-monitor | `agents/security-monitor.md` | Vuln scans, gitleaks, dependency policy | active |
| qa-tester | `agents/qa-tester.md` | E2E, component mounting, streaming states | active |
| devops-admin | `agents/devops-admin.md` | bun toolchain, Docker, hooks, deploys | active |

---

## Skills

Active registry with owners: [`skills/README.md`](skills/README.md).
Highlights: `harness-verification` (5-gate engine certification), `van-westendorp-psm`
and `gabor-granger` (pricing research), `prisma-7`, `i18n-audit`.
Planned v10.1 additions are listed there and in `variant.json → skill_manifest`.

---

## Scripts

Single language: TypeScript under `scripts/` (run with `bun`). The former
ps1/sh pairs were retired 2026-08-25.

| Command | Purpose |
|---|---|
| `bun scripts/audit.ts` | Workspace standards gate |
| `bun scripts/dev-sync.ts "feat: …"` | memlog → index → changelog → audit → branch → PR |
| `bun scripts/sync-md.ts <date> <summary>` | MEMORY.md index update |
| `bun scripts/gen-pr-body.ts "<msg>"` | Structured PR body (stdout) |
| `bun scripts/setup.ts` | install + prisma + hooks bootstrap |

Git hooks (`.githooks/*`) are two-line shims executing `scripts/hooks/*.ts`.

---

## Workflow

### Harness Engineering order (non-negotiable)
`docs/biz_logic.md` LaTeX spec → `[Ref: biz_logic.Section_X]` Vitest tests (red) →
engine implementation (green) → Harness Pass Certificate.

### Dual lifecycle
1. **Build** (AIG 5-phase): parallel triage → design approval (DB/core needs user
   sign-off) → serial engine→UI implementation → verification chain → sync.
2. **Consulting engagement**: Diagnose → Design → Validate → Deliver; client-facing
   artifacts require a recorded human approval.

### Git / PR
```
bun scripts/dev-sync.ts "feat: description"
```
All changes reach `main` via PR only. Direct pushes to main are blocked by the pre-push hook.

---

## Global Financial Input Rules

- Capital Stock: $1 – $10,000,000 USD · Financial seeds > 0
- Quantity & Time: positive integers · Percentages 0–100% (growth/inflation exempt)

---

## Session Start Skills

- `skills/harness-verification/SKILL.md` — always, for simulation-integrity work
- `skills/prisma-7/SKILL.md` — when touching `prisma/schema.prisma`

---

## Commercial Operating Cycle (SSOT — 8-step closed loop)

The canonical business process for distribution/pricing/promotion strategy & execution.
Every stage has an owner agent, system surface, and a gate to the next stage.
Stage 8 output **feeds back into stages 0–2** of the next cycle — the loop is mandatory.

| # | Stage | Owner agent | System surface | Gate to advance |
|---|---|---|---|---|
| 0 | Objectives & Constraints | `pm` (+engagement-director) | Goal declaration, trade budget cap | User objective confirmed |
| 1 | Diagnose | `market-intelligence-analyst` | CompetitorPrice · SurveyResponse · diagnostics/GTN band · VW-GG | Minimum sample & ledger registration report |
| 2 | Select | `pricing-strategist` (review) | partner-pnl.scoreTradeLines rescore | Portfolio decision recorded |
| 3 | Allocate | `core-engine-dev` (verify) | mixRatio · TradeLine.supplyPrices | capacity/mix constraints met |
| 4 | Terms Design [TERMS] | `finance-strategy-lead` | TradeTerm(terms stack·settlement) | wholesaleParamsSchema pass |
| 5 | Price Path Design [PRICE] | `pricing-strategist` | ConsumerPricePlan(price path) | consumerParamsSchema pass |
| 6 | Validate | `cpa-auditor` + **User Gate** | ScenarioSnapshot tri-view comparison | Approved snapshot recorded |
| 7 | Execute | `engagement-director` | Path injection + settlement(on/off-invoice) | Active policy deployment complete |
| 8 | Review | `engagement-director` | **`promotion-analytics` netROI(8-week window)** · outcome classification · scorecard rescore → `trade-promotion-roi` skill | Review memo → next cycle 0–2 input |

Two-track persistence: **PRICE track = `ConsumerPricePlan`**(§9.2 shelf paths) ·
**PRICING track = `TradeTerm`**(§9.1 terms stack, settlement on/off-invoice).
Analysis rides the snapshot tri-view double waterfall
(list → consumer promo → shelf → supply rate → trade discount → net supply).

---

## Development Workflow

Implementation follows the Harness Engineering order (non-negotiable):
`docs/biz_logic.md` LaTeX spec → `[Ref: biz_logic.Section_X]` Vitest tests (red) →
engine implementation (green) → Harness Pass Certificate (CPA).

Two lifecycles run in parallel:
1. **Build** (AIG 5-phase): parallel triage → design approval (DB/core changes need
   user sign-off) → serial engine→UI implementation → verification chain → sync.
2. **Consulting engagement**: Diagnose → Design → Validate → Deliver; client-facing
   artifacts require a recorded human approval before export.

All changes reach `main` via PR only. Direct pushes to main are blocked by pre-push hook.
Use `bun scripts/dev-sync.ts "feat: …"` (or the `/sync` slash command) to commit, audit, and open a PR.

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Guidelines

- Currency math via `mathjs` wrappers only (`fAdd/fSub/fMul/fDiv`); quantities are integers.
- Every user-facing string exists in all 16 locales within the same PR.
- `PRICE_*` keys and all secrets never leave env files; never log secrets.
- Client-facing deliverables require human approval before export.
- Conversational replies in Korean by default; code/docs/logs in English.
<!-- END VARIANT-INJECT -->

## File Organization Policy

- `src/lib/engine/*` — drift-free math/pricing engine (BIZ_LOGIC-backed, `[Ref:]`-tested).
- `src/components/dashboard/*` — Onyx 2.0 dashboard tabs (incl. GovernanceTab).
- `agents/*.md` — agent roster definitions (PM-dispatched only).
- `skills/*/SKILL.md` — variant-specific skills (22 registered in `variant.json`).
- `docs/biz_logic.md` — immutable business-logic spec; `docs/co-price.context.md` — variant customization layer.
- `prisma/schema.prisma` — data model (Zod synced via `security-auditor`).

## Domain Rules

- Pricing architecture uses corridors, fences, and a MAP stance owned by `pricing-strategist`.
- Margin & waterfall floors are owned by `finance-strategy-lead`; trade-promotion netROI gate ≥ 2.0×.
- Channel strategy & Deal Desk process owned by `engagement-director` + `cpa-auditor` (exception log).
- The LLM copilot cites engine-computed figures only; it never computes its own numbers.
- Educational simulator only — no real customer/financial data; all samples are synthetic.
