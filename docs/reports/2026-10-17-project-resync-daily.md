# Project Resync Daily — 2026-10-17

Nightly run resumed 2026-10-17 10:22 KST (the 10-16 01:30 nightly did not fire;
window spans ~2.3 days). **User directive (repeated mid-run): Projects/co-newbiz
excluded** — its LOCAL-WORK (8 files, live session active) preserved untouched.

## Release chain

- **template-v0.19.2** published (PATCH, 3 delivered paths): registry-append v1.2.0
  boundary fix (T-20261017-001 — the append-index scan stopped at `####` sub-tables,
  leaving co-abap without its toml delivery; 13/14 → 14/14). Bump PR #1556 merged
  CLEAN, tag pushed.

## Steps 0–3

- Step 0: LOCAL-WORK only inside excluded co-newbiz; elsewhere clean.
- Step 2e ledger: open U- tickets none. Genuine pending LOCAL-PATCH markers
  (unchanged): co-abap install-vsp.ts, co-develop/co-security design-lint.ts.
- Step 2f: the window's non-excluded landings (#1554 registry-append fix) were
  reviewed by their own concurrent session with spec/tests/mirrors — reviewed,
  nothing further to extract. co-newbiz FIFO-carried (excluded).
- Step 2b: co-safety schema-typed plane stays **PROMOTABLE** — Step 2b promotion
  decision remains human-judged.

## Steps 4–5 — upgrade wave to 0.19.2

Canary: **co-abap** (the T-20261017-001 toml catch-up target). Its CI is the first
co-abap CI to RUN since the billing fix, surfacing three pre-existing damage layers
from the unvalidated 0.19.x chain — all repaired in the canary PR (#215, final
state full CI green):

1. 13 stale governance/setup links — the L1-delivered governance docs carried
   root-relative paths that do not resolve in the project layout. Fixed AT THE
   TEMPLATE level (`templates/common/docs/governance/agents/*.md`: context.md
   depth, CLAUDE/GEMINI boilerplate anchors, ADR-0099 → canonical workspace URL),
   so every future delivery is correct.
2. variant OVERLAY top-level scripts had no upgrade delivery path (the
   `validate-abap-platform-parity.ts` CI job referenced a script never delivered —
   Module-not-found). upgrade-project **1.71.0** adds the overlay top-level walk
   with auto-registration (new-project §6.6 parity), delivered to all fleets.
3. the delivered parity validator then enforced the #194-196 hardening's
   instruction sections — SAP Safety sections (proxy / approvals / parallel
   dispatch) added to the project's CLAUDE/CODEX/GEMINI.

Wave (13 projects, co-newbiz excluded; co-safety followed as its own PR #206,
full CI green): **ALL MERGED** via the standing billing exception — though the
wall is now PARTIALLY LIFTED (co-abap/co-safety CI ran fully green tonight), so
several merges carried real CI evidence for the first time since 10-08.

| Project | PR | Post-merge audit | Version |
|---|---|---|---|
| co-abap (canary) | #215 (final: full CI green) | PASS | 0.19.2 |
| co-architect | #374 | PASS | 0.19.2 |
| co-consult | #98 | PASS | 0.19.2 |
| co-deck | #174 | PASS | 0.19.2 |
| co-design | #40 | PASS | 0.19.2 |
| co-develop | #185 | PASS | 0.19.2 |
| co-export | #52 | PASS | 0.19.2 |
| co-game | #52 | PASS | 0.19.2 |
| co-hr | #8 | PASS | 0.19.2 |
| co-learning | #20 | PASS | 0.19.2 |
| co-news | #8 | PASS | 0.19.2 |
| co-price | #153 | PASS | 0.19.2 |
| co-safety (late) | #206 (full CI green) | PASS | 0.19.2 |
| co-security | #81 | PASS | 0.19.2 |
| co-work | #19 | PASS | 0.19.2 |

## Step 6 — final state

- Fleet: 15/15 upgraded projects at **0.19.2**, audit PASS, trees clean, pr/*
  branches pruned.
- co-newbiz: EXCLUDED — untouched this cycle (live-session LOCAL-WORK preserved).
- Open PRs after the wave: none.
- Open root issues: #849/#846 (automation state-holders, intentionally open);
  #1553 left OPEN with a regeneration request (stale-conflicted archive branch —
  hand-resolving would violate the ticket.ts-only rule).
