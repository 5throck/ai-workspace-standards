---
name: landed-cost-calculation
scope: co-export
description: >
  Defines the landed-cost computation convention for export engagements: a formula
  ledger decomposing customs value, duty, freight, insurance, and ancillary charges,
  plus an assumption ledger tracking every input's source and sensitivity. All
  arithmetic is executed by a bun/TypeScript script in the scaffolded project -
  never performed by the agent.
version: 1.0.0
last_reviewed: 2026-08-25
status: active
owner: logistics-coordinator
prerequisites: hs-classification-workflow
relates_to:
  - skill: hs-classification-workflow
    type: composes_with
  - skill: logistics-coordination
    type: composes_with
metadata:
  type: domain
  triggers:
    - landed cost calculation
    - landed cost breakdown
    - duty freight insurance breakdown
    - export pricing cost model
    - per-unit landed cost
    - incoterms cost comparison
---

## Context

Landed cost - the full per-unit cost of delivering goods to the destination market - previously had no computation convention in this variant. Engagements produced ad hoc spreadsheets whose inputs (valuation basis, freight quotes, insurance rates, ancillary fees) were untracked, so figures could not be audited, compared across runs, or recomputed when an input changed. This skill defines two durable artifacts - a **formula ledger** and an **assumption ledger** - and the computation discipline that turns them into verified numbers: every figure is emitted by an executed bun/TypeScript script in the scaffolded project, per the Computational Integrity section of [`docs/co-export.context.md`](../../docs/co-export.context.md).

## When to Use

- Pricing and margin analysis for export quotes (landed cost is the cost floor the quote must clear)
- Market-entry cost modeling (comparing candidate destination markets on delivered cost)
- Duty drawback baseline computation (the duty component of a landed-cost run is the baseline a later drawback claim reconciles against)
- Freight-term (Incoterms) comparisons (re-running the model under two Incoterms shows which components shift between buyer and seller)

## Formula Ledger

The formula ledger is the canonical decomposition of landed cost. Every component row names its formula, data source, and owner. No component may be added, merged, or dropped without updating this ledger first.

| # | Component | Formula | Data source | Owner |
|---|-----------|---------|-------------|-------|
| 1 | Customs value basis | FOB or CIF per the applicable valuation rules of the assessing jurisdiction - record which basis applies before any duty math | Valuation-basis determination from `hs-classification-workflow` | hs-classification-specialist |
| 2 | Duty amount | customs value x duty rate | Tariff dataset snapshot (`docs/countries/<code>/tariff-dataset.json`, schema: [`docs/tariff-dataset-schema.json`](../../docs/tariff-dataset-schema.json)). Default to MFN `mfn_ad_valorem_pct`; apply a preferential rate ONLY when `fta-origin-determination` plus `roo-qualification-worksheet` have qualified the shipment's origin for the claimed FTA | hs-classification-specialist |
| 3 | Freight | mode-dependent (sea/air/land) linehaul + origin/destination local charges | Logistics quotes assembled via `logistics-coordination`; record the Incoterm and note which components it shifts between buyer and seller | logistics-coordinator |
| 4 | Insurance | insured value x quoted cargo insurance rate | Insurance quote or rate card for the shipment | logistics-coordinator |
| 5 | Ancillary charges | sum of handling, customs brokerage, port/demurrage, inspection fees | Itemized fee schedule from forwarder/broker quotes | logistics-coordinator |
| 6 | Import taxes (recorded separately) | VAT/excise computed per destination rules | Destination tax rules; recorded in the tax note - typically recoverable or pass-through, so kept OUT of the landed-cost subtotal | hs-classification-specialist |

**Landed cost per unit = total landed cost / quantity.** State the quantity basis explicitly (units, kg, or CBM - whichever the shipment is priced on); a per-unit figure without its basis is not comparable across runs.

An unqualified shipment always computes duty at MFN - a preferential rate is never assumed pending origin qualification.

## Assumption Ledger

Every assumption used anywhere in the computation gets one row:

| Field | Content |
|-------|---------|
| id | Stable identifier (A1, A2, ...) referenced by the computation output |
| assumption | The assumption itself, stated as a number with unit, or UNKNOWN |
| source/basis | Quote, dataset field, client statement, or professional estimate |
| owner | Agent or party accountable for the value |
| sensitivity | Whether a 10% swing in this assumption moves the total materially (yes/no) |

Unpriced assumptions are marked **UNKNOWN** - never silently zero-filled. A zero in the ledger means someone verified the cost is zero; it is not a placeholder.

## Computational Integrity Rules

These rules are hard requirements, not guidance:

- The agent **never** performs the arithmetic - no mental or inline calculation of any component, subtotal, or per-unit figure
- Every number in the deliverable comes from an executed bun/TypeScript script in the scaffolded project
- The script reads the formula ledger and assumption ledger as its inputs and emits the computation table as its output
- AI-produced figures are estimates and must be labeled **approximate** until script-verified
- The deliverable cites the script path and the output reference (file or version) it was computed from

## Execution Steps

1. **Define the shipment scenario**: goods, quantity (with basis), Incoterm, origin, destination.
2. **Assemble the formula ledger** from data sources: valuation basis from `hs-classification-workflow`, duty rate from the tariff dataset snapshot, freight quotes, insurance rate, ancillary fee schedule.
3. **Record every assumption** in the assumption ledger, including source, owner, and sensitivity flag; mark unpriced inputs UNKNOWN.
4. **Write the computation script** (or reuse the project's existing one) so it reads both ledgers and emits the computation table.
5. **Execute the script** and capture the computation table output.
6. **Verify the roll-up**: per-unit x quantity reconciles to the total, and components sum to the landed-cost subtotal (import taxes excluded).
7. **Flag sensitivity-flagged assumptions** in the output so the reader sees which inputs the total actually turns on.

## Output Format

A markdown deliverable with, in order:

- Scenario header: goods, quantity + basis, Incoterm, origin, destination
- Formula ledger table: component | formula | source | value basis
- Assumption ledger table: id | assumption | source/basis | owner | sensitivity
- Computation results table: component | amount | per-unit
- Tax note: VAT/excise amounts recorded, excluded from the subtotal, with recovery/pass-through status
- Verification line: script path + output reference the figures were computed from

## Related Skills

- hs-classification-workflow
- fta-origin-determination
- roo-qualification-worksheet
- logistics-coordination

## Out of Scope

- Origin qualification itself - use `roo-qualification-worksheet`
- Tariff dataset capture and maintenance - governed by [`docs/tariff-dataset-schema.md`](../../docs/tariff-dataset-schema.md)
- Drawback claim execution - use `customs-duty-drawback-workflow`
- Transfer pricing and related-party valuation adjustments
