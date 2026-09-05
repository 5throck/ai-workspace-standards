---
name: export-control-screening
scope: co-export
description: >
  Guides the Export Control & Sanctions Screening Specialist through strategic-item
  classification, catch-all end-use/end-user assessment, and denied-party/sanctions screening.
  The highest-consequence workflow on the team — escalation discipline is mandatory.
version: 1.0.0
last_reviewed: 2026-08-08
status: active
owner: export-control-compliance-specialist
prerequisites: none
relates_to:
  - skill: hs-classification-workflow
    type: composes_with
  - skill: roo-qualification-worksheet
    type: composes_with
  - skill: market-entry-strategy
    type: composes_with
  - skill: hs-classification-workflow
    type: follows
  - skill: fta-origin-determination
    type: composes_with
  - skill: halal-certification-workflow
    type: composes_with
---

## Context

Use in Phase 1-2 for every engagement, regardless of how routine the product seems — catch-all
controls can apply to non-listed items based on end-use or destination, so this screening is not
optional even when the item doesn't obviously look like a "controlled" good.

## When to Use

- New product, destination, or counterparty not previously screened
- Item falls in a strategic-items-adjacent HS chapter (electronics, chemicals, machinery,
  aerospace, nuclear-related)
- Transaction involves US-origin technology/software or a high-risk destination
- Counterparty identity or ownership structure is not already verified clean

## Prerequisites

- Confirmed HS code (national tariff line) and item technical specifications
- Destination country and end-user information
- Counterparty names and addresses for denied-party screening
- US-origin technology/software involvement assessment

## Execution Steps

1. **Strategic Item Classification**: Check the item, software, or technology against the
   Integrated Public Notice on Strategic Items and identify the applicable control regime
   (Wassenaar, NSG, MTCR, Australia Group, Chemical Weapons Convention) if listed.
2. **Catch-All Assessment**: Even if not listed, evaluate end-use (military, WMD proliferation
   concern) and end-user/destination (embargoed or high-risk) red flags that trigger catch-all
   licensing requirements.
3. **License Requirement Determination**: State explicitly whether an export license is required
   and from which authority — do not leave this ambiguous.
4. **US EAR/OFAC Parallel Check**: If US-origin technology or a high-risk destination is involved,
   run the parallel US re-export control and sanctions-program check regardless of the home-jurisdiction side
   clearance — extraterritorial exposure applies independently.
5. **Denied-Party Screening**: Screen counterparties, intermediaries, and ultimate consignees
   against OFAC SDN List, BIS Entity/Denied Persons Lists, and the home jurisdiction's own sanctioned-party list.
6. **Match Confidence Triage**: Full-name exact matches → treat as a hit requiring resolution.
   Partial-name or ownership-structure matches → flag for manual/legal review, do NOT self-clear.
7. **Overall Risk Rating**: Assign clear / requires license / requires legal review / do not
   proceed — when genuinely uncertain, always round toward the more conservative rating.
8. **Handoff**: Only pass to `trade-documentation-specialist` once status is confirmed cleared or
   the required license is identified and in hand.

## Output Format

- Screening report: item control status, applicable control regime/authority, license
  requirement, counterparty screening results with match confidence, overall risk rating

## Quality Criteria

- [ ] Control list entry or regime cited for every controlled-item determination
- [ ] Catch-all end-use/end-user assessment completed (not just list-check)
- [ ] Sanctions screening covers OFAC SDN, BIS Entity List, and the home-jurisdiction sanctions list
- [ ] Overall risk rating stated explicitly (clear / requires license / requires legal review / do not proceed)
- [ ] Ambiguous or borderline findings escalated as "requires legal review"

## Related Skills

- hs-classification-workflow
- foreign-regulation-monitoring
