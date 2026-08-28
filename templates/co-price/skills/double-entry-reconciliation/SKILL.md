---
name: double-entry-reconciliation
scope: co-price
description: Double-entry bookkeeping integrity verification
version: "2.0.0"
last_reviewed: 2026-08-25
status: active
owner: cpa-auditor
prerequisites: simulation output with MonthlyData series available
---

# Skill: Double-Entry Reconciliation
**Role**: CPA Auditor (`cpa-auditor`)
**Frequency**: Mandatory on every pull request that modifies `src/lib/simulation.ts`

## 1. Description
This skill enforces strict double-entry bookkeeping rules across the AIG Simulation Engine. Any changes to the simulation math must adhere to the fundamental accounting equation:

`Assets = Liabilities + Equity`

## 2. Trigger Condition
The CPA Auditor must run this skill if the Core Engine Developer modifies any variable or calculation in `src/lib/simulation.ts` that affects:
- `MonthlyData` output
- `simulate()` loops
- Income Statement (IS) calculations
- Balance Sheet (BS) calculations
- Cash Flow Statement (CF) calculations

## 3. Verification Protocol

The CPA Auditor will perform the following algorithmic checks on the resulting output of `simulation.ts`:

### 3.1. The Fundamental Equation
For every simulated month (`m`):
```typescript
const isBalanced = (m.totalAssets === m.totalLiabilities + m.totalEquity);
if (!isBalanced) throw new Error("Balance sheet does not balance");
```

### 3.2. Retained Earnings Roll-Forward
```typescript
const expectedRE = m_prior.retainedEarnings + m_current.netIncome;
if (m_current.retainedEarnings !== expectedRE) throw new Error("Retained Earnings roll-forward failed");
```

### 3.3. Cash Flow to Cash Balance Articulation
```typescript
const netChangeInCash = m_current.cfo + m_current.cfi + m_current.cff;
const expectedCash = m_prior.cash + netChangeInCash;
if (m_current.cash !== expectedCash) throw new Error("Cash flow does not articulate to Balance Sheet");
```

## 4. Execution
If the CPA Auditor detects a violation of these rules, they MUST REJECT the code and instruct the Core Engine Developer to fix the math to ensure zero leakage in the financial model.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Double-entry bookkeeping integrity verification** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `cpa-auditor`. See `variant.json` skills registry for the full co-price skill set.
