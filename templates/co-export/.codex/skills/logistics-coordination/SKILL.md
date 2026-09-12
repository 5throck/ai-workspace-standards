---
name: logistics-coordination
scope: co-export
description: >
  Guides the Logistics Coordinator through Incoterms term selection (2020 default, with 2000/2010
  version recognition for legacy contracts), freight mode/forwarder comparison, and
  bonded-warehouse/customs clearance logistics planning, ending in final engagement delivery
  handoff.
version: 1.1.0
last_reviewed: 2026-08-16
status: active
owner: logistics-coordinator
prerequisites: none
relates_to:
  - skill: market-entry-strategy
    type: follows
  - skill: landed-cost-calculation
    type: composes_with
---

## Context

Use in Phase 3-4 once compliance clearance and trade documentation are in place. This skill turns
a cleared, documented shipment into an actual moving plan and closes out the engagement.

## When to Use

- Incoterms term has not yet been selected for the deal
- Freight mode (sea/air/land) or forwarder needs to be compared
- Bonded-warehouse or transshipment logistics need planning
- Engagement is ready for final delivery handoff and closeout

## Prerequisites

- Cleared export control status and any required export license
- Completed document package from trade-documentation-specialist
- Product characteristics (weight, volume, value density, perishability)
- Buyer/seller logistics capability assessment

## Execution Steps

1. **Confirm Preconditions**: Verify export license/control-status findings are cleared before
   finalizing any logistics plan — a cleared shipment status is a precondition, not an afterthought.
2. **Incoterms Version Check**: Before recommending a term, check whether the deal is governed by
   an existing contract, PO, or LC that already cites an Incoterms version. Default to **Incoterms
   2020** for new agreements. If the counterparty's paperwork cites **2000** or **2010**, do not
   silently substitute the 2020 term — flag the version and any material difference (see table
   below) so the parties can confirm whether to keep the legacy term or migrate to 2020.
3. **Incoterms Selection**: Recommend the appropriate term given deal structure and each party's
   risk appetite and logistics capability. For DDP specifically, confirm the seller has the
   compliance/documentation capability to handle destination-country import clearance before
   recommending it.
4. **Freight Mode Comparison**: Compare sea/air/land freight on cost, transit time, and cargo
   suitability (weight, value density, perishability, restricted-carrier concerns).
5. **Check Cargo Restrictions**: Cross-check the recommended freight mode/route against any cargo
   restriction identified by `export-control-compliance-specialist` (e.g. restricted carriers or
   routes for controlled items).
6. **Forwarder Selection Criteria**: Outline the criteria for forwarder selection relevant to this
   shipment's specifics.
7. **Bonded Warehouse / Clearance Logistics**: Plan any bonded-storage or transshipment steps,
   coordinated with the customs clearance documentation already prepared.
8. **Final Delivery Handoff**: Confirm all upstream deliverables (compliance findings, documents,
   strategy) are consistent with the final logistics plan, then close out to PM.

## Incoterms Version Reference (2000 → 2010 → 2020)

| Change | 2000 → 2010 | 2010 → 2020 |
|--------|-------------|-------------|
| Terms removed | DAF, DES, DEQ, DDU | — |
| Terms added | — | none (DAT renamed, not replaced) |
| Terms renamed | — | DAT → **DPU** (Delivered at Place Unloaded) |
| Term count | 13 → 11 | 11 → 11 |
| Classification | By mode of transport (unchanged) | Grouped by mode (unchanged) |
| Insurance (CIP) | Minimum cover (Institute Cargo Clause C) | **CIP now requires higher cover (Clause A)**; CIF unchanged at Clause C |
| Security | Not addressed | Explicit security-related obligations/costs allocated |
| On-board notation | Not addressed | FCA now supports an on-board bill of lading option for letter-of-credit deals |
| Own-transport allowance | Not addressed | FCA/DAP/DPU/DDP allow the buyer/seller to arrange carriage with their own means of transport, not just a third-party carrier |

**How to apply**: If a cited term no longer exists in 2020 (DAF, DES, DEQ, DDU), do not assume a 1:1 mapping — confirm intent with both parties before recommending the nearest 2020 equivalent (e.g. DDU intent often maps to DAP, but risk/cost allocation must be re-verified, not copied over).

## Output Format

- Logistics coordination plan: recommended Incoterms term with rationale, freight mode comparison,
  forwarder selection criteria, bonded-warehouse/clearance logistics steps
- Final delivery handoff summary for PM closeout

## Quality Criteria

- [ ] Recommended Incoterms term cites the correct version (2020 default) and rationale
- [ ] If counterparty paperwork cites a 2000/2010 term, the version was flagged (not silently mapped) and any material difference explained
- [ ] Freight mode comparison covers cost, transit time, and cargo suitability
- [ ] Bonded-warehouse/clearance logistics steps documented (if applicable)
- [ ] Export-control cargo restrictions (restricted carriers/routes) checked and incorporated
- [ ] Final delivery plan consolidated with all upstream engagement deliverables

## Related Skills

- trade-documentation-checklist
- export-control-screening
