---
source: fleet
date: 2026-11-20
ticket: T-20261119-008 / T-20261119-009
status: confirmed-twice
---

# adopt-template grants do not take on the variant-scripts subtree

**Observation (2026-11-19 → 2026-11-20, co-deck)**: an upgrade wave run with
explicit per-file `--disposition adopt-template=scripts/co-deck/<file>` grants
delivered the tests/agents/baselines/styles but delivered ZERO of the
`scripts/co-deck/*.ts` variant scripts — 12 scripts + later 8 more stayed stale
while their sibling test files (whose grants came from the same list) delivered.
The partial delivery made the project copy's tests expect newer script surfaces
than the delivered scripts implemented (html-to-pdf tests 1.3.x vs script 1.2.0
= 16 test fails).

**Second confirmation (2026-11-20, co-safety/co-newbiz)**: adopt-template grants
worked fine for L0-synced scripts (TEMPLATE TREE SYNC channel) but the
variant-scripts channel (SYNC_IF_NEWER/variant pass) never applied the granted
rows — agents/ has its own version-gated D4 rule; scripts/co-deck/ appears to
silently swallow the grants instead.

**Working hypothesis**: the engine's disposition-grant matching for the
variant-scripts pass either keys on a different path form (directory row vs
per-file) or the D4-style version gate ignores grants for this pass entirely.

**Workaround that worked**: `cp templates/co-deck/scripts/co-deck/<f>
Projects/co-deck/scripts/co-deck/<f>` + dev-sync — manual file copy delivered
everything the grants should have (20 files, both test suites then passed).

**Action**: engine fix tracked in T-20261119-009 (needs Design Gate). Until
fixed, verify every adopt-template delivery with a version sweep
(`grep @version` per delivered file vs template) instead of trusting the run's
dirty count.
