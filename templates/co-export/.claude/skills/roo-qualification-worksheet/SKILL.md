---
name: roo-qualification-worksheet
scope: co-export
description: >
  Produces a per-shipment Rules of Origin qualification worksheet from the FTA skill's
  determination — converts origin analysis into an auditable artifact for customs
  post-clearance audits and FTA retention requirements.
version: 1.0.0
last_reviewed: 2026-08-25
status: active
owner: fta-origin-analyst
prerequisites: fta-origin-determination
metadata:
  type: domain
  triggers:
    - rules of origin worksheet
    - origin qualification record
    - RoO worksheet
    - per-shipment origin record
    - origin qualification
---

## Context

Customs post-clearance audits demand per-shipment origin qualification evidence — authorities do not accept general origin analysis; they require shipment-specific worksheets documenting how the product-specific rule was satisfied for that exact consignment. `fta-origin-determination` determines the rules; this skill records the determination as a repeatable, auditable worksheet artifact for each shipment. One worksheet per shipment per FTA claim.

## When to Use

- Claiming preferential tariff treatment under any Free Trade Agreement
- Preparing documentation for a customs post-clearance audit response
- Batch or multi-shipment certifications requiring individual origin records
- Client must retain origin evidence for the FTA's statutory retention period
- Exporter needs a self-certification origin statement template

## Prerequisites

- Completed FTA origin determination report (from `fta-origin-determination`)
- Confirmed HS code (from `hs-classification-workflow`)
- Bill of Materials with country-of-origin data for each input
- Cost data for RVC calculation (if RVC is the applicable criterion)

## Execution Steps

1. **Header Block — Shipment Metadata**
   - Exporter name and address
   - Product description and confirmed HS code (with `hs-classification-specialist` attribution)
   - Destination country
   - Claimed FTA (cite specific agreement)
   - Worksheet preparation date
   - Link to the originating `fta-origin-determination` report

2. **PSR Criterion Block**
   - Record the Product-Specific Rule applied (Wholly Obtained / Change in Tariff Classification (CC/CTH/CTSH) / Regional Value Content (RVC) / specific process rule)
   - Cite the FTA annex/chapter/paragraph where the rule was found (e.g., "Annex 3-B, Section A, heading 8544")
   - Note any special provisions or exceptions

3. **BOM Assessment Table**
   - Create one row per material input:
     - Input description
     - HS code (if classified)
     - Country of origin
     - Originating? (Y/N) — flag all non-originating inputs
     - Tariff shift satisfied? (if CTC/CTH/CTSH applies)
     - Cost value (for RVC or de minimis)
     - Notes (accumulation, de minimis, special provisions)
   - Explicitly identify which inputs are non-originating

4. **RVC Calculation Block** (if applicable)
   - State the calculation method required by the FTA (build-up / build-down / net-cost)
   - List all inputs with their values and originating status
   - Show the calculation: (originating cost / total cost) × 100 or equivalent formula
   - State the result with explicit margin — never round a marginal pass to a confident pass (inherit `fta-origin-determination` Step 7 discipline)
   - Flag if result is within 2% of the threshold

5. **De Minimis and Accumulation Checks**
   - De minimis: applied? (Y/N) — if yes, cite the provision and the threshold percentage
   - Accumulation: applicable? (Y/N) — if yes, cite the FTA partner countries and inputs qualifying
   - Outcome: state whether these provisions rescued the qualification

6. **Certification Method Block**
   - Identify the required certification method:
     - Self-certification (origin statement on invoice or commercial document)
     - Authorized-exporter certification (pre-approved exporter status)
     - Issuing-authority Certificate of Origin (C/O issued by customs/chamber)
   - List the retention documents required: origin statement, cost sheet, BOM, supplier declarations

7. **Conclusion**
   - Qualification determination: Qualifies / Does not qualify / Requires advance ruling
   - State the margin explicitly (e.g., "RVC 47.2% vs. 45% threshold — 2.2% margin")
   - Signature block:
     - Prepared by: `fta-origin-analyst`
     - Ratified by: client's licensed customs specialist (where required by jurisdiction)
     - Date

8. **Filing**
   - Save to: `deliverables/roo/<shipment-id>-<fta>-worksheet.md` (follow existing deliverables convention)
   - Cross-link from the origin determination report
   - Attach to the shipment's trade-documentation package

## Output Format

Full markdown worksheet template skeleton (fillable artifact):

```markdown
# Rules of Origin Qualification Worksheet

## Shipment Metadata

| Field | Value |
|-------|-------|
| Exporter | [Exporter name and address] |
| Product | [Product description] |
| HS Code | [XXXX.XX.XX] (confirmed by hs-classification-specialist) |
| Destination Country | [Country] |
| Claimed FTA | [FTA name] |
| Worksheet Date | [YYYY-MM-DD] |
| Linked Determination Report | [path/to/fta-origin-determination-report.md] |

## Product-Specific Rule Applied

**Criterion Type**: [Wholly Obtained / CTC / CTH / CTSH / RVC / Process Rule]

**FTA Citation**: [Annex/chapter/paragraph reference]

**Rule Text**: [quote the exact PSR from the FTA text]

## Bill of Materials Assessment

| Input | HS Code | Country of Origin | Originating? (Y/N) | Tariff Shift Satisfied? | Cost | Notes |
|-------|---------|-------------------|--------------------|-------------------------|------|-------|
| [Input 1] | [XXXX] | [Country] | [Y/N] | [Y/N] | [$] | [Accumulation/de minimis notes] |
| [Input 2] | [XXXX] | [Country] | [Y/N] | [Y/N] | [$] | [Notes] |

**Non-Originating Inputs Flagged**: [List all inputs marked N]

## Regional Value Content Calculation (if applicable)

**Method**: [Build-up / Build-down / Net-cost]

**Formula**: [State FTA formula]

**Calculation**:
- Originating cost: $[X]
- Non-originating cost: $[Y]
- Total cost: $[Z]
- RVC percentage: [X/Z × 100 = XX.X%]

**Threshold**: [XX%] (per FTA Article X)

**Result**: [Qualifies / Does not qualify] — margin: [+/- X.X%]

## De Minimis and Accumulation

**De Minimis**:
- Applied: [Y/N]
- Provision: [FTA article/annex]
- Threshold: [X%]
- Outcome: [Pass/Fail]

**Accumulation**:
- Applied: [Y/N]
- Partner countries: [List]
- Qualifying inputs: [List]
- Outcome: [Pass/Fail]

## Certification Method

**Required Method**: [Self-certification / Authorized-exporter / Issuing-authority C/O]

**Retention Documents**:
- [ ] Origin statement / Certificate of Origin
- [ ] Cost calculation sheet
- [ ] Bill of Materials with origin attributions
- [ ] Supplier declarations for non-originating inputs

## Conclusion

**Qualification Status**: [Qualifies / Does not qualify / Requires advance ruling]

**Margin**: [State explicit margin if applicable]

**Prepared By**: fta-origin-analyst
**Ratified By**: [Client's licensed customs specialist, if required]
**Date**: [YYYY-MM-DD]

---

**File Path**: `deliverables/roo/<shipment-id>-<fta>-worksheet.md`
**Cross-Reference**: [Link to origin determination report]
```

## Quality Criteria

- [ ] Shipment metadata complete (exporter, product, HS code, destination, FTA)
- [ ] PSR criterion cited with exact FTA annex/chapter reference
- [ ] BOM table includes all material inputs with origin status
- [ ] Non-originating inputs explicitly flagged
- [ ] RVC calculation shown with full cost breakdown (if applicable)
- [ ] Margin stated explicitly — never rounded to "pass"
- [ ] De minimis and accumulation provisions cited with outcome
- [ ] Certification method identified correctly per FTA
- [ ] Retention document list complete
- [ ] Signature block includes preparer and required ratifier
- [ ] Worksheet saved to deliverables path and cross-linked

## Related Skills

- `fta-origin-determination` — upstream rules determination; this skill operationalizes those steps into a per-shipment worksheet artifact
- `hs-classification-workflow` — HS code confirmation is prerequisite to PSR lookup
- `trade-documentation-checklist` — handoff for C/O preparation and document assembly
