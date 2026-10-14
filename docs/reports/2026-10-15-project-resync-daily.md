# Project Resync Daily — 2026-10-15

Nightly 01:30 KST run. **User directive: Projects/co-newbiz excluded from this
cycle as well** (live session continues — 8 dirty files in its checkout, no open
PRs; Step 0's LOCAL-WORK findings are all inside it and were left untouched).

## Release chain

- **template-v0.19.1** published (PATCH, 4 delivered paths): the #1544 ride-along —
  upgrade-project 1.70.5 COMMANDS_SYNC toml delivery fix, registry-append helper,
  registry/version bumps. Bump PR #1550 merged CLEAN, tag pushed.

## Steps 0–3

- Step 0: LOCAL-WORK only inside excluded co-newbiz; elsewhere STALE-RESIDUE only.
- Step 2: no project-authored deltas outside co-newbiz → backport-diff not applicable.
- Step 2e ledger: open U- tickets none. Genuine pending LOCAL-PATCH markers
  (unchanged from 10-14): co-abap install-vsp.ts, co-develop/co-security
  design-lint.ts — routing duty with the owning projects.
- Step 2f: no non-excluded project had merged landings in this window — nothing to
  extract (co-newbiz #530–#534 FIFO-carried, still excluded).
- Step 2b: co-safety schema-typed plane stays **PROMOTABLE** (unchanged) — Step 2b
  promotion decision remains human-judged.

## Steps 4–5 — upgrade wave to 0.19.1

**This wave is the first fleet delivery of the COMMANDS_SYNC toml fix** (upgrade-project
1.70.5): projects without variant command overlays receive rendered
`.gemini/commands/*.toml` for the first time. Projects WITH variant overlays
(e.g. co-safety's `meeting.md`) keep the variant-first fallback — the common toml
set is withheld by that pre-existing fallback (residual documented under
T-20261014-001).

Canary: **co-safety #205** — full public CI green, merged, verified (0.19.1,
audit PASS). Wave (14 projects, co-newbiz excluded): ALL MERGED via the standing
billing exception (local audit green per project, gitleaks clean, content from the
tagged v0.19.1).

## Step 6 — final state

- Fleet: 15/15 upgraded projects at **0.19.1**, audit PASS, trees clean, pr/*
  branches pruned.
- co-newbiz: EXCLUDED — untouched this cycle (live-session LOCAL-WORK preserved).
- Open PRs after the wave: none.
