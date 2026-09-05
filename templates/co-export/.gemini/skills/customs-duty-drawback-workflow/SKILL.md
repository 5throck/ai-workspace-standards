---
name: customs-duty-drawback-workflow
scope: co-export
description: >
  Guides the Customs Duty Drawback Specialist through refund-eligible raw material
  determination, individual refund vs. simplified fixed-rate refund method selection,
  usage-rate calculation support, and refund-application deadline tracking under the Act on
  Special Cases Concerning the Refund of Customs Duties Levied on Raw Materials for Export.
  Keeps drawback claims clearly separated from ordinary Customs Act erroneous-payment refunds.
version: 1.0.0
last_reviewed: 2026-08-08
status: active
owner: customs-duty-drawback-specialist
prerequisites: hs-classification-workflow
relates_to:
  - skill: landed-cost-calculation
    type: follows
---

## Context

Use in Phase 3, after the export has shipped and the HS code / tariff rate paid on the imported
raw materials is confirmed. Drawback recovers duties already paid — it is a post-export
administrative claim, not a pre-export compliance gate, but it still carries real financial and
legal risk (fraudulent-refund findings trigger claw-back plus criminal referral), so treat
eligibility and method selection with the same rigor as classification.

## When to Use

- Client asks whether duties paid on imported raw materials can be refunded after export
- A finished-goods export uses raw materials that were dutiable at import
- Client wants to compare the individual refund method against the simplified fixed-rate refund
  method to decide which to file under
- A prior drawback claim needs review before the statutory application deadline lapses

## Prerequisites

- Confirmed HS code (national tariff line) and tariff rate paid (from hs-classification-specialist)
- Import declaration records for the raw materials in question
- Bill of materials linking raw materials to exported finished goods
- Export declaration records for the finished goods

## Execution Steps

1. **Confirm Prerequisite Inputs**: Verify the HS code and tariff rate paid on the imported raw
   material are confirmed (not probable/contested) via `hs-classification-specialist` output —
   do not proceed on an unconfirmed classification.
2. **Determine Refund Eligibility**: Check the raw material was (a) used directly in production of
   the exported good, (b) imported within the statutory import-to-export window, and (c) not on an
   excluded-material list under the Duty Drawback Act.
3. **Regime Check**: Confirm this is a drawback claim under the Duty Drawback Act, not an
   erroneous/overpaid duty claim under Customs Act Art. 46 — state which regime applies before
   proceeding.
4. **Compare Refund Methods**:
   - **Individual refund method**: calculate the actual usage rate (raw material quantity per
     unit of exported good) from production records; higher accuracy, higher documentation
     burden, no eligibility ceiling.
   - **Simplified fixed-rate refund method**: check the client's refund-performance total for the
     preceding 2 years is at or below the statutory SME threshold, and that a fixed refund rate is
     published for the item; if either condition fails, the individual refund method is the only
     available path.
   - Recommend whichever nets more value after accounting for documentation cost, not simply the
     larger headline figure.
5. **Usage-Rate Statement Support**: If the individual refund method applies, support construction
   of the usage-rate statement tying imported raw material quantity to exported finished-good
   quantity, cross-checked against the confirmed HS code.
6. **Deadline Tracking**: Flag the statutory refund-application deadline and the import-to-export
   eligibility window explicitly — a late claim is time-barred regardless of merit.
7. **Fraud-Risk Screen**: Check for round-tripping, inflated usage-rate figures, or HS code
   mismatches between the import declaration and the confirmed classification before finalizing
   the estimate.
8. **Handoff**: Pass the refund method, estimated amount, and supporting basis to
   `trade-documentation-specialist` to package with the export documentation set.

## Output Format

- Drawback assessment report: eligibility determination, regime confirmation (Duty Drawback Act
  vs. Customs Act Art. 46), method comparison with recommendation, usage-rate statement basis,
  estimated refundable amount, application deadline, fraud-risk flags (if any), confidence level

## Quality Criteria

- [ ] Refund-eligible material determination cites specific Duty Drawback Act provisions
- [ ] Refund method comparison (individual vs. simplified fixed-rate) documented with reasoning
- [ ] Usage-rate calculation basis clearly stated
- [ ] Application deadline and statutory window noted
- [ ] Regime disambiguation stated (Duty Drawback Act vs. Customs Act Art. 46)
- [ ] Fraud-risk patterns flagged (or confirmed absent)

## Related Skills

- hs-classification-workflow
- trade-documentation-checklist
