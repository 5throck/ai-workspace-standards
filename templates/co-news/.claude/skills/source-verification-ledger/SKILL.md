---
name: source-verification-ledger
scope: co-news
description: >
  Guides fact-checker through the newsroom's source-verification discipline —
  every material claim in an article must be traceable to 2+ independently
  verifiable sources before publish. Use when: after financial-analyst and
  legal-researcher produce their briefs, before the reporter drafts the
  article; re-run after style-editor's rewrite pass to confirm no figures
  drifted.
version: 1.0.0
last_reviewed: 2026-08-10
status: active
owner: fact-checker
prerequisites: none
---

## Context

The newsroom's fact-checking discipline requires every material claim (a number, a date, a quote, an attribution) in an article to be traceable to at least two independently verifiable sources before the article can be handed off for publication. This skill defines the ledger-building process that enforces that discipline.

## When to Use

- After financial-analyst and legal-researcher have produced their briefs, before the reporter begins drafting
- Re-run after style-editor's rewrite pass, to confirm no figures drifted during the language/style edit
- Any time a draft is about to be handed off to the next phase and contains claims not yet logged in the ledger

## Execution Steps

1. **Extract Every Material Claim**: Read the input briefs/draft and pull out every material claim — number, date, quote, attribution — into a working list.

2. **Require 2+ Independent Sources**: For each claim, require at minimum one DART disclosure receipt-number citation (via the `k-dart` skill) plus one corroborating source (a news wire, a company IR statement, a second disclosure, or a `k-law` citation).

3. **Build the Ledger**: Construct a per-article ledger table with columns: claim | source 1 | source 2 | receipt number | status.

4. **Flag Unverified Claims**: Mark any claim with fewer than 2 sources as `UNVERIFIED` and block handoff to the next phase until it is resolved.

5. **Verify Quotes Verbatim**: Check every direct quote against its source transcript or press release — no paraphrasing may appear inside quotation marks.

## Output Format

- A Markdown ledger table with columns: claim | source 1 | source 2 | receipt number | status
- A one-line summary: "N claims, M verified, K UNVERIFIED — [PASS/BLOCK]"

## Related Skills

- financial-narrative-brief
- financial-journalism-style
