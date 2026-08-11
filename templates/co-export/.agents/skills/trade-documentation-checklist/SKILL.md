---
name: trade-documentation-checklist
scope: co-export
description: >
  Guides the Trade Documentation Specialist through assembling a complete, internally consistent
  trade document package (invoice, packing list, B/L, certificate of origin) and reviewing
  letter-of-credit terms against UCP 600 for discrepancy risk.
version: 1.0.0
last_reviewed: 2026-08-08
status: active
owner: trade-documentation-specialist
prerequisites: none
---

## Context

Use in Phase 3 once upstream compliance findings (HS code, origin criterion/certification method,
export control clearance) are available. This skill assembles and checks consistency — it does
not re-derive classification, origin, or control status.

## When to Use

- Shipment is ready to move and a full document set needs to be prepared
- Client has received L/C terms and needs a discrepancy-risk review before accepting
- A document inconsistency (HS code, value, quantity, origin claim) needs to be tracked down

## Prerequisites

- Confirmed HS code, origin determination, and export control status from compliance specialists
- Commercial terms (Incoterms, payment method) from the sales contract
- L/C terms (if letter of credit is the payment method)

## Execution Steps

1. **Confirm Upstream Inputs**: Verify the HS code, origin criterion and certification method, and
   export control/license status are all confirmed before drafting final documents — draft with
   placeholders if any are still pending.
2. **Compile Document Checklist**: Determine the full required document set for this specific
   shipment (commercial invoice, packing list, B/L or AWB, certificate of origin, export license
   if applicable, insurance certificate) based on its compliance profile.
3. **Populate Compliance-Sourced Fields**: Every field sourced from a compliance finding (HS code,
   origin claim, license number) must be traceable to the specialist agent that determined it —
   never fill a field with an unsourced guess.
4. **Consistency Verification**: Cross-check that HS code, declared value, quantity, and origin
   claim are identical across every document in the set.
5. **Prepare Certificate of Origin**: Use the format and certification method
   `fta-origin-analyst` determined is required.
6. **L/C Terms Review** (if applicable): Check letter-of-credit terms against UCP 600 for
   shipment-deadline feasibility, required-document-list completeness, and consistency between the
   L/C's goods description and the classified HS code.
7. **Flag, Don't Reconcile**: If an inconsistency is found across the document set, flag it
   explicitly rather than silently picking one value to resolve it.
8. **Handoff**: Pass the finalized document set to `logistics-coordinator` once shipment is ready
   to move.

## Output Format

- Document checklist with per-document status (drafted / pending compliance input / final)
- Draft document templates with compliance-sourced fields populated
- L/C discrepancy risk review with specific clause citations

## Quality Criteria

- [ ] Document checklist covers all required documents for the shipment's compliance profile
- [ ] Cross-document consistency verified (HS code, value, quantity, origin claim identical across all documents)
- [ ] L/C terms reviewed against UCP 600 discrepancy risks (if L/C applies)
- [ ] Certificate of origin format matches the certification method determined by fta-origin-analyst
- [ ] Outstanding items clearly marked as pending compliance input

## Related Skills

- fta-origin-determination
- export-control-screening
