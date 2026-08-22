---
name: fta-origin-determination
scope: co-export
description: >
  Guides the FTA/Origin Analyst through determining whether goods qualify for preferential
  tariff treatment under a specific Free Trade Agreement — origin criterion selection,
  non-originating material assessment, and origin certification method identification.
version: 1.0.0
last_reviewed: 2026-08-08
status: active
owner: fta-origin-analyst
prerequisites: hs-classification-workflow
---

## Context

Use in Phase 1-2 once the HS code is confirmed by `hs-classification-specialist` — the
product-specific rule (PSR) governing origin is looked up by HS heading/subheading, so origin
analysis without a confirmed HS code is not reliable.

## When to Use

- Client wants to claim preferential tariff treatment under a specific FTA
- Shipment includes non-originating (third-country) inputs and origin status is unclear
- Origin certificate/declaration requirements need to be identified before shipment
- A customs post-clearance audit questions a prior origin claim

## Prerequisites

- Confirmed HS code (from hs-classification-specialist)
- Bill of materials and sourcing breakdown (originating vs. non-originating inputs)
- Target FTA text with Rules of Origin annex
- Cost data for RVC calculation (if applicable)

## Execution Steps

1. **Confirm HS Code**: Verify the HS code with `hs-classification-specialist` — do not proceed
   without it.
2. **Screen Applicable FTA(s)**: Identify which FTA(s) apply given the origin/destination country
   pair — use the home country's FTA network from the active country profile (KR: 20+ in force); do not default to the most well-known one.
3. **Look Up Product-Specific Rule (PSR)**: Retrieve the origin criterion for the confirmed HS
   heading from the specific FTA's Rules of Origin annex — Wholly Obtained, Change in Tariff
   Classification (CC/CTH/CTSH), Regional Value Content (RVC), or a specific process requirement.
4. **Assess Non-Originating Materials**: For any third-country input, determine whether it causes
   a tariff-shift failure or falls within accumulation/de minimis provisions.
5. **Calculate RVC (if applicable)**: Document the calculation method and all inputs; if the
   result is marginal, state the margin explicitly rather than rounding to a confident pass.
6. **Identify Certification Method**: Determine whether self-certification, authorized-exporter
   certification, or an issuing-authority-issued Certificate of Origin is required, and what
   supporting documentation (origin statement, cost calculation sheet, BOM) must be retained.
7. **Confidence Rating**: Qualifies / does not qualify / requires advance ruling — never resolve a
   close call to "qualifies" without flagging the margin.
8. **Handoff**: Pass the confirmed origin criterion and certification method to
   `trade-documentation-specialist` for C/O preparation.

## Output Format

- Origin determination report: applicable FTA(s), origin criterion applied, tariff-shift/RVC
  calculation, non-originating material assessment, certification method, confidence rating

## Quality Criteria

- [ ] Specific FTA article/annex and product-specific rule cited
- [ ] Origin criterion applied (WO / CTC / RVC / specific process) documented with reasoning
- [ ] Non-originating material assessment completed (tariff-shift, de minimis, accumulation)
- [ ] RVC calculation shown with intermediate cost breakdown (if RVC is the criterion)
- [ ] Certification method identified (self-certification / authorized exporter / issuing authority)
- [ ] Confidence level stated (qualifies / does not qualify / requires advance ruling)

## Related Skills

- hs-classification-workflow
- trade-documentation-checklist
