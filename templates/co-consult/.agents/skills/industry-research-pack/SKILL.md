---
name: industry-research-pack
scope: co-consult
description: >
  Guides the production of an industry research pack: a source-priority ladder
  (official bodies > corporate filings > wire media > research firms; blogs
  excluded), one-source-one-document packaging with a fixed five-section
  per-source skeleton, per-bullet source citations, figure-by-figure
  cross-validation against a named second source, warning marks for
  single-source figures, and a search-quota-exhaustion fallback. Judgments are
  rendered AGAINST the user's hypotheses, not in support of them.
version: 1.0.0
last_reviewed: 2026-10-08
status: active
owner: pm
l2_propagate: false
prerequisites:
  - research-analysis
  - evidence-ledger
relates_to:
  - skill: research-analysis
    type: composes_with
  - skill: evidence-ledger
    type: composes_with
metadata:
  source: workspace
  type: research
  triggers:
    - industry research
    - research pack
    - market scan
    - industry landscape
---

# Industry Research Pack

## Context

Produce a defensible industry research pack: every material claim carries its
source, every figure carries a second source or a visible warning mark, and
the conclusion tests the user's hypothesis instead of confirming it.

Origin: co-consult engagement t11/t13 (Projects/co-consult PR #86; filed as
T-20261007-013). Related workspace skills: `research-analysis` (the generic
analysis process, no output format) and `evidence-ledger` (the row-per-claim
ledger; this pack is its document-shaped overlay).

## When to Use

- The engagement question is an industry-landscape or market-structure
  hypothesis that must be tested against sources.
- The deliverable is a packaged, citable research corpus feeding a report or
  deck (the report-pack-as-citable-substrate contract: consumer deliverables
  cite per-source documents per section).

## Execution Steps

1. **Source-priority ladder.** Select and rank sources in this order; a lower
   rung may never override a higher one without an explicit note:
   1. Official bodies — regulators, ministries, statistics offices, central
      banks.
   2. Corporate filings — annual reports, audit disclosures, investor
      materials.
   3. Wire media — Reuters/Bloomberg/Yonhap-class reporting of official
      events.
   4. Research firms — paid research (cite the report, not the press
      summary).
   5. Blogs and aggregators — EXCLUDED; at most use them to locate a
      higher-rung primary source.
2. **One-source-one-document packaging.** Each source becomes exactly ONE
   document in the pack (`<date>-<source-name>.md`). Never merge two sources
   into one document — cross-validation happens BETWEEN documents.
3. **Five-section per-source skeleton.** Every source document uses:
   (a) metadata table (publisher, date, URL, author, ladder rung, access
   date); (b) summary with one bullet per material claim, each ending
   `[Source: <url>]`; (c) figure cross-validation against a named second
   source — corroborated / deviates (both numbers) / single-source; (d)
   implication lenses (market, regulation, competition, technology); (e)
   reliability grade A/B/C with a one-line bias note.
4. **Warning-mark protocol.** A figure without a second source carries
   `⚠ SINGLE-SOURCE` inline and in the pack roll-up; the mark is removed only
   by a real second source, never by a rewrite.
5. **Verify-user-hypotheses rule.** Render every judgment AGAINST the user's
   stated hypothesis: attempt to refute it with the pack. Surviving a test is
   a finding ("not refuted by N sources"); contradiction by a higher-rung
   source is reported as contradicted.
6. **Search-quota-exhaustion fallback.** On budget exhaustion: stop, mark the
   pack `PARTIAL — quota exhausted at <timestamp>`, list covered vs uncovered
   sections, route the remainder to the next session. Never fill gaps from
   memory or below-ladder sources.

## Output Format

A pack directory of one-source-one-document files plus a roll-up:

- Per source: the five-section skeleton document (§3).
- Roll-up: findings ledger with per-figure cross-validation verdicts,
  warning marks, and the hypothesis verdicts ("not refuted" / "contraded by
  <source>").
- Coverage statement: covered vs uncovered sections (`PARTIAL` marker when
  the quota fallback fired).

## Related Skills

- `research-analysis` — the generic analysis process this pack instantiates
  with a fixed output format.
- `evidence-ledger` — the row-per-claim ledger discipline; the pack is its
  document-shaped overlay (same 2+ independent sources requirement).
- `competitive-intelligence`, `company-intelligence` — per-target deep dives
  that feed the pack's figure cross-validation.

## Usage Examples

- "Build the Q4 industry pack for the engagement question `<hypothesis>`"
- "Cross-validate the market-size figure in `<source doc>`"
