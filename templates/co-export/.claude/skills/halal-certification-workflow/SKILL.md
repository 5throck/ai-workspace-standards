---
name: halal-certification-workflow
scope: co-export
description: >
  Guides the Halal Certification Specialist through determining whether halal certification is
  required for a destination market and product category, identifying the recognized certifying
  body, and mapping the certification/audit process and renewal cycle.
version: 1.0.0
last_reviewed: 2026-08-16
status: active
owner: halal-certification-specialist
prerequisites: hs-classification-workflow
---

## Context

Use in Phase 1-2 once the HS code is confirmed by `hs-classification-specialist` — halal
certification requirements are triggered by product category, not by the shipment as a whole, so
the determination without a confirmed HS code is unreliable.

## When to Use

- Destination market is a majority-Muslim country or otherwise has a halal-labeling regime
  (Malaysia, Indonesia, GCC states, and others)
- Client wants to know whether halal certification is legally required vs. commercially
  advantageous for this product category
- Client already holds a halal certificate and wants to confirm it is recognized in a new
  destination market
- Certification/audit timeline needs to be sequenced against the shipment schedule

## Prerequisites

- Confirmed HS code (from hs-classification-specialist)
- Destination market and product category
- Any existing halal certification the client holds (issuing body, scope, expiry)
- Regulatory-change flags from foreign-regulatory-intelligence-analyst, if any

## Execution Steps

1. **Confirm HS Code and Category**: Verify the HS code and product category with
   `hs-classification-specialist` — certification triggers differ by category even within the
   same destination market.
2. **Determine Requirement Status**: Establish whether halal certification is mandatory,
   conditionally mandatory (phased rollout by category), or voluntary-but-commercially-expected in
   the destination market. Cite the specific regulation (e.g. Malaysia's Trade Descriptions Act
   Halal Order, Indonesia's UU No. 33/2014 / BPJPH phased schedule, UAE/GCC's ESMA/GSO standards).
3. **Identify Recognized Certifying Body**: Determine which certifying body's mark the destination
   authority actually recognizes (JAKIM for Malaysia, BPJPH/MUI-LPPOM for Indonesia, ESMA-approved
   bodies for UAE, GSO-recognized bodies for the wider GCC bloc) — via direct accreditation or a
   mutual-recognition agreement. Do not assume a certificate valid in one market transfers to
   another.
4. **Check Existing Certification**: If the client already holds a halal certificate, verify it is
   from a body the destination market recognizes and that it is still within its validity period.
   If not recognized or expired, flag re-certification as required.
5. **Map Certification Process**: Outline the audit/certification steps (application, facility
   audit, ingredient/supply-chain documentation, certificate issuance) and a realistic timeline for
   each step.
6. **Note Validity and Renewal**: Record the certificate's validity period and the renewal lead
   time — a lapsed certificate blocks clearance in markets where certification is mandatory.
7. **Confirm Labeling Requirements**: Identify destination-market-specific halal-logo placement and
   wording requirements, separate from the certification itself.
8. **Handoff**: Pass the certification requirement, recognized certifying body, and timeline to
   `trade-documentation-specialist` for document-package inclusion, and flag the timeline to
   `logistics-coordinator` as a schedule-critical dependency.

## Output Format

- Halal certification determination report: requirement status, applicable authority/regulation,
  recognized certifying body/bodies, certification process steps with timeline, validity/renewal
  period, labeling requirements

## Quality Criteria

- [ ] Requirement status (mandatory / conditionally mandatory / voluntary) stated with the specific
      regulation cited
- [ ] Recognized certifying body confirmed for the specific destination market, not assumed from
      general reputation
- [ ] Existing client certification (if any) checked for destination-market recognition and
      validity
- [ ] Certification process timeline broken into audit/documentation/issuance steps, not bundled
- [ ] Validity period and renewal lead time documented
- [ ] Labeling requirements identified separately from the certification requirement itself

## Related Skills

- hs-classification-workflow
- foreign-regulation-monitoring
- trade-documentation-checklist
- logistics-coordination
