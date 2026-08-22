---
name: foreign-regulation-monitoring
scope: co-export
description: >
  Guides the Foreign Regulatory Intelligence Analyst through tracking US/China/EU import
  regulation, tariff, and trade-defense changes, with strict source attribution and staleness
  disclosure so downstream compliance work isn't built on outdated destination-market context.
version: 1.0.0
last_reviewed: 2026-08-08
status: active
owner: foreign-regulatory-intelligence-analyst
prerequisites: none
---

## Context

Use in Phase 1 to establish destination-market regulatory context before or alongside home-jurisdiction
compliance work. This is intelligence/monitoring, not a compliance determination — findings feed
`export-control-compliance-specialist` and `market-entry-strategist`, who own the actual
conclusions in their domains.

## When to Use

- New destination market not previously researched for this engagement
- Client's product category has a history of trade-defense action (steel, solar, semiconductors,
  etc.) in the destination market
- Significant time has elapsed since the last regulatory check for an ongoing engagement
- A compliance specialist requests destination-side context for their determination

## Execution Steps

1. **Identify Jurisdiction Scope**: Confirm which of US / China / EU (or others) are relevant
   given the destination country.
2. **Tariff/Trade-Defense Check**:
   - US: Section 301/232 actions, USITC AD/CVD orders, Federal Register, CBP HTS updates
   - China: GACC announcements, MOFCOM trade remedy investigations, tariff schedule updates
   - EU: TARIC database, European Commission trade defense investigations, sanctions regime
3. **Regulatory Change Detection**: Identify recent or pending changes to import requirements
   (labeling, certification, customs procedure) for the client's product category.
4. **Distinguish Enacted vs. Pending**: Never blur an enacted regulation with a proposed one —
   state status and effective date explicitly for each finding.
5. **Source Attribution**: Cite the specific foreign-government source and access date for every
   claim — no unattributed regulatory claims.
6. **Staleness Check**: If a source was last verified more than 30 days before report delivery,
   flag it explicitly rather than presenting it as current.
7. **Route Findings**: Control-relevant findings → `export-control-compliance-specialist`.
   Market-access-relevant findings → `market-entry-strategist`. Do not draw the compliance
   conclusion yourself.

## Output Format

- Regulatory monitoring brief: jurisdiction, regulation/measure name, effective date, source
  citation with access date, impact summary, staleness warning if applicable

## Related Skills

- export-control-screening
- market-entry-strategy
