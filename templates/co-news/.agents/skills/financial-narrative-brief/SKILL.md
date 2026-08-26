---
name: financial-narrative-brief
scope: co-news
description: >
  Guides financial-analyst through converting raw k-dart DART data into an
  article-ready narrative brief. Explicitly distinct from co-consult's
  financial-statement-analysis (which builds a 5-level ROIC/valuation driver
  tree) — this skill is narrative-oriented, not valuation-oriented, and
  produces structured data for a reporter, not a full financial model. Use
  when: Phase 1, immediately after an assignment names a target company.
version: 1.0.1
last_reviewed: 2026-08-26
status: active
owner: financial-analyst
prerequisites: k-dart
---

## Context

This skill converts raw k-dart DART data into an article-ready narrative brief. It is explicitly distinct from co-consult's `financial-statement-analysis` skill, which builds a 5-level ROIC/valuation driver tree for financial modeling purposes. This skill is narrative-oriented rather than valuation-oriented: it produces structured data handed off to a reporter, not a full financial model.

## When to Use

- Phase 1, immediately after an assignment names a target company

## Execution Steps

1. **Pull DART Data**: Pull the company overview plus relevant financial statements/disclosures via the `k-dart` skill — specify CFS preferred, OFS fallback, matching k-dart's own convention.

2. **Identify the "So What"**: Identify the 2-3 numbers/events a business reader actually needs — an earnings surprise, a capital-structure change, an auditor-opinion change, a change in largest shareholder, etc.

3. **Produce Structured Entries**: For each item, produce: headline number, YoY/QoQ delta, one-sentence context, and disclosure citation (receipt number).

4. **Flag Anomalies for Legal Review**: Flag anomalies — auditor opinion changes, related-party transactions, CB/EB issuance, unusual related-party loans — for legal-researcher review.

5. **Hand Off as Structured Data**: Hand off to the reporter as a short table or bullet list, NOT prose — the reporter, not this skill, writes the narrative sentences.

## Output Format

- Wire header comment per [`docs/wire-format.md`](../../docs/wire-format.md) — slug, register, language, desk, receipt count ([NEWS-R2])
- `## Headline Numbers` table: metric | value | YoY/QoQ | receipt number
- `## Context Notes`: 1-2 sentences per number
- `## Flags for Legal Review`: bullet list, may be empty

## Related Skills

- k-dart
- source-verification-ledger
- financial-infographic-svg
