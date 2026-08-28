# Product Requirements Document (PRD) v4.1 — Strategic Audit Ready

This document is the **Single Source of Truth (SST)** for the **AIG v4.1 Platform**. It defines the high-level requirements, vision, and roadmap for the Pricing Management Simulation.

---

## 1. Vision & UI Identity
*   **Persona**: Strategic Financial Consultant / C-Level Strategist.
*   **Design Paradigm**: **Onyx 2.0 Aesthetics** (Strategic Density, Glassmorphism, HSL Precision).
*   **Core Value**: Bridging the gap between raw BOM data and executive profitability projections through multidimensional simulation.

---

## 2. Strategic Business Logic
All mathematical formulas, calculation rules, and simulation constraints are synchronized with the codebase and detailed in the Tactical Master Specification.

> [!IMPORTANT]
> For high-precision mathematical logic (Revenue Dynamics, COGS Scaling, Multi-Regional Tax, Working Capital) and machine-readable LaTeX formulas, refer to:
> [**biz_logic.md (Master Specification)**](./biz_logic.md)

---

## 3. Feature Roadmap

### **Completed**
- **[DONE] Next.js 16 (App Router)**: Migration to the latest React 19 / Next.js architecture.
- **[DONE] Standalone Mode**: Production-optimized build output for enterprise deployment.
- **[DONE] Proxy Security**: Dynamic `__Secure-` cookie protocol for Cloudflare/Proxy environments.
- **[DONE] Multi-Regional Tax v4.5**: Engine supporting 20+ regional tax logic sets.
- **[DONE] Variant Conversion P1 (2026-08-25)**: Workspace governance markers; bun as single package manager (ADR-0001, ADR-0002).

### **Planned — v10.1 Consulting Evolution** ([execution plan](../memory/co-price-plan.md))
- **[PLANNED] Governance P2**: Agent roster normalization (15 agents) + schema-compliant skills registry.
- **[PLANNED] Diagnostics Engine**: Benchmark gap scoring, price waterfall, G/B/B validation, Floor/Target/Stretch guidance.
- **[PLANNED] On-Rails AI Copilot**: Multi-provider advisory chat that cites engine-computed figures only (ADR-0003).
- **[PLANNED] Scenario Comparison**: Side-by-side snapshots with margin/revenue/volume tri-view.
- **[PLANNED] Market Research Modules**: Van Westendorp PSM + Gabor-Granger demand analytics.
- **[PLANNED] Cost Shock Analysis**: Raw-material sensitivity tornado, margin-neutral repricing, FX bands.
- **[PLANNED] Trade-line Management**: Wholesale/retail tiers, partner P&L simulation, scorecard, domestic–export dual pricing.
- **[PLANNED] Pricing Strategy Playbook (two-layer)**: **Wholesale layer** (quantity tiers, revenue rebates vs trade lines) and **Consumer layer** (High-Low cycles, lifecycle Markdown, rule-based Dynamic pricing per channel) — modeled as separate policy paths over supply and shelf prices respectively, analyzed solo & combined via double-waterfall scenario comparison (integrated into 3-F-4 per decisions 2026-08-25).
- **[PLANNED] Hiring Lag**: 2-month delay between headcount threshold crossing and onboarding ($M_{t}$ depends on $Metric_{t-2}$).

### **Backlog**
- External market-price auto-ingestion (web scraping / price APIs).

---

## 4. Calculation Integrity & Verification
To ensure mathematical excellence and investor confidence:
*   **Harness Protocol**: All core logic must be verifiable against the machine-readable LaTeX specs in `biz_logic.md`.
*   **Vitest Engine QA**: Every formula in `src/lib/engine/` is covered by automated unit tests.
*   **P&L Auditor Review**: Mandatory CPA-level audit of the $NetIncome \to CFO$ bridge for accounting consistency.

---
*Maintained by AIG Product Lead | Strategic Financial Intelligence Group*
