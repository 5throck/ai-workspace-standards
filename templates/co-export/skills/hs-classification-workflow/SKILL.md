---
name: hs-classification-workflow
scope: co-export
description: >
  Guides the HS Classification Specialist through GRI-ordered Harmonized System
  classification, customs valuation basis determination, and tariff rate lookup.
  Ensures classification reasoning is reproducible and defensible under a customs
  post-clearance audit.
version: 1.0.0
last_reviewed: 2026-08-08
status: active
owner: hs-classification-specialist
prerequisites: none
---

## Context

Use at the start of Phase 1 whenever a shipment's HS code is not already confirmed. Every
downstream compliance step (FTA origin analysis, export control screening, tariff cost
calculation) depends on this classification, so treat it as the engagement's foundational input.

## When to Use

- New product or product variant requiring HS classification
- Existing classification needs re-verification after a product spec change
- Client disputes a prior classification or a customs authority raises a query
- Customs valuation basis needs to be established alongside classification

## Prerequisites

- Confirmed product description and technical specifications from the client
- Access to the home jurisdiction's HS nomenclature at tariff-line depth (KR: Korea Customs Service HSK)
- Prior customs ruling database access (if available for precedent research)

## Execution Steps

1. **Gather Product Facts**: Collect full product description, materials/composition, function,
   how it is marketed/sold, and packaging — classification depends on objective characteristics,
   not the client's preferred outcome.
2. **Apply GRI in Strict Order**:
   - GRI 1: Match against heading text and section/chapter notes first
   - GRI 2: Consider incomplete/unassembled goods and mixtures if GRI 1 doesn't resolve it
   - GRI 3(a)/3(b)/3(c): Apply only if multiple headings appear equally applicable
   - GRI 4–6: Apply only for genuinely novel goods or subheading-level disputes
   - Never skip ahead to a later GRI rule without documenting why the earlier rule didn't resolve
     the classification
3. **Search Ruling Precedent**: Check prior customs-authority advance rulings (KR: Korea Customs Service) and
   authoritative interpretations for materially similar products before finalizing.
4. **Determine Customs Valuation Basis**: Identify the applicable valuation method (transaction
   value, or fallback methods in the Customs Act Article 30 order) and flag related-party pricing.
5. **Confidence Rating**: Classify the result as confirmed / probable (recommend advance ruling) /
   contested — never present a probable classification as certain.
6. **Tariff Rate Lookup**: Identify the applicable home-jurisdiction tariff rate and, if relevant, the
   destination-country rate (cross-reference `foreign-regulatory-intelligence-analyst` findings).
7. **Handoff**: Pass the confirmed HS code to `fta-origin-analyst` (origin rules are HS-specific)
   and to `export-control-compliance-specialist` if the classification falls in a
   strategic-items-adjacent chapter.

## Output Format

- Classification report: candidate HS headings considered, GRI reasoning chain, final HS code
  code, confidence level, customs valuation basis, applicable tariff rate(s), cited prior rulings

## Quality Criteria

- [ ] HS heading and subheading cited with exact text from the nomenclature
- [ ] GRI reasoning chain documented in order (GRI 1 → 2 → 3 → ... as applicable)
- [ ] Confidence level stated explicitly (confirmed / probable / contested)
- [ ] Prior ruling precedent checked and referenced (or noted as unavailable)
- [ ] Ambiguity escalation recommended when multiple plausible headings exist

## Related Skills

- fta-origin-determination
- export-control-screening
