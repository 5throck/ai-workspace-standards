---
lang: ko
lang_reason: proper-noun
---

# co-price User Guide

> **Audience**: planners, finance strategists, and consultants using the platform.
> Korean version: [`user-guide_ko.md`](user-guide_ko.md)

## 1. Getting Access

1. Open `http://localhost:9981` and click **Register**.
2. Fill in your name, email, and password, then submit.
3. New accounts enter a **pending** state until an administrator approves them.
4. After approval, sign in from the **Login** page.

> Administrators manage accounts under `/admin` (approve, suspend, force
> password change). First-time admins receive a temporary password and are
> guided through a mandatory change at first login.

## 2. Core Concepts

| Concept | Meaning |
|---|---|
| **Company** | Top-level tenant. Owns projects. |
| **Project** | One simulation model: products, channels, costs, financial seeds. |
| **Channel** | A sales route (e.g., D2C, department store, open market) with a supply rate and mix ratio. |
| **Supply Price** | What your company receives per unit in that channel (MSRP × supply rate). |
| **BEP** | Break-even point — when cumulative operating profit turns positive. |
| **VDT** | Value Driver Tree — decomposition of profit drivers. |

## 3. Building a Simulation

1. Create or select a **Project**.
2. On the dashboard, configure tabs left-to-right:
   - **Sales** — product lifecycle years, channel policy, allocation
     (mix ratios must total 100%), pricing strategy, portfolio matrix.
   - **Costs** — labor plan (CEO/Leader/Member scaling rules), production
     cost (BOM-based), expenses (SG&A methods).
   - **Financial Seeds** — capital stock and opening balances.
3. Results recompute automatically for up to **60 months** across three
   statement tabs: **Income Statement**, **Balance Sheet**, **Cash Flow**
   (with waterfall visualizations).

All currency math uses high-precision arithmetic; quantities are whole
numbers; percentages accept 0–100% (growth/inflation may exceed 100%).

## 4. Analysis Tools

- **BEP Analysis tab** — break-even timing per year.
- **Value Driver Tree** — drill into revenue/cost drivers year by year.
- **Intelligence Matrix** — price positioning grid across
  product × channel × year with three view modes.

## 5. Localization & Currency

- Switch language/currency in **Settings** (16 locales incl. RTL Arabic).
- FX rates sync automatically every Monday (editable offline).

## 6. Exporting

Click **Export** to generate an Excel workbook of the active scenario
(statements, assumptions, and monthly detail). Korean business-plan
templates (제조/유통 v2.5) are available for standard deliverables.

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| Stuck on "pending" after register | Ask an admin to approve the account. |
| Mix ratio validation error | Channel mix ratios must sum to 100%. |
| Charts empty | Ensure at least one enabled channel has quantity targets. |
