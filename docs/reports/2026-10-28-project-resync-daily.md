# Daily Project Resync — 2026-10-28

Fleet: 16 projects (`Projects/co-*` glob). Standalone-track (no `templates/<variant>/`): co-architect, co-newbiz. Template version at cycle start: 0.21.0 → released **0.22.0** this cycle (Phase 6b, tag `template-v0.22.0`, PR #1665 artifacts + #1667 bump).

## Step 0 — Resync audit

`bun scripts/resync-audit.ts --snapshot-dir .pipeline-state/resync-snapshots`: all 16 projects clean — **0 STALE-RESIDUE, 0 PRESUME-STALE, 0 KEEP rows, 0 dirty files**. Nothing to auto-apply, nothing routed to commit-side review.

## Step 1 — Local work

Zero projects with uncommitted LOCAL-WORK → no project dev-sync PRs this cycle.

## Step 2 — Backport review (5-surface)

Delta source (skill v1.7.0): (a) LOCAL-WORK = none; (b) non-mechanical merged-window PRs per project, `--base` = pre-window rev (2026-10-27T06:23:30+0900):

| Project | Base | Non-mechanical window landings | Backport verdict |
|---|---|---|---|
| co-abap | d4a55779e | #223 (GEMINI.md LOCAL-PATCH adjudication, T-20261027-007) | Nothing to promote — the adjudication REMOVED the pending local patch (heading + body); template never carried it; disposition complete project-side |
| co-design | 961c7180f | #59 (review-backlog remediation), #60 (deferred-items batch), #62 (smoke-skip loudness), #64 (re-apply state reverted by delivery) | Surface dominated by in-sync rows (delivery already carried counterparts). Project-ahead: `agents/README_ko.md` +1 (i18n roster row — template KO copy lacks the EN-present row) → T-20261028-007. Both-changed `AGENTS.md`/`CLAUDE.md`/`agents/*.md` body deltas = the project-owned corrections re-applied in #64 — live subject of U-20261028-001 (below); recorded, not promoted |
| co-newbiz | f2477a699 | #746–#753 (ADR-0186 gate-integrity P0–P5, ADR-0187 process-SSOT W3) | Project-only governance corpus (tests, ADRs, process docs); 2f candidate extracted from #743 → T-20261028-008; promotion surfaces none |
| co-safety | 66725889a | #213 (pm.md duplicate lifecycle-block removal, T-20261027-006) | Nothing to promote — project removed a duplicate frontmatter block; template `agents/pm.md` carries the single canonical lifecycle block (verified) |

## Step 2d — Domain Operating Model (read-only diff)

| Project | DOM surface changed | Row |
|---|---|---|
| co-newbiz | `process/stages.yaml` +42/−29 (ADR-0187 W3 process SSOT) | `domain-model:` triage — substantive project-side process restructure (track ladders, gate ladders per W3). Read-only recorded; never promoted in-runner |
| co-abap / co-design / co-safety / (all others) | none | — |

## Step 2e — Upstream request ledger

Open U-tickets: **1** — `U-20261028-001` (co-design, `waiting`, filed 01:20 KST by the upstream-request MCP server; adopted as residue and landed with the Phase I PR #1663). Subject: template delivery waves resurrect project-deleted files (`docs/governance/agents/workflows.md`) and revert project-side `agents/*.md` body corrections; requests tombstone/exclusion honor + project-ownership of non-managed body sections. **Partial relief already in flight**: the v0.22.0 wave (below) carries the sync-overwrite policy engine (delivery provenance baselines, ERROR-grade conflict dispositions, unified decision log — T-20261027-004), which directly addresses the conflict-surfacing half of the request; the tombstone/ownership asks remain open — ticket stays `waiting`. U-20261027-001/-003 verified `done` (closed with the #1653 wave; ledger updated). U-20261027-005/-006/-007 closed via #1653.

LOCAL-PATCH population (fleet-wide, records/memory excluded): 102 `pending` markers / 208 resolved-or-other across 16 projects (heaviest: co-abap 13, co-security 13, co-develop 12). Standing class — U-20261028-001's ownership mechanism is the systemic remedy.

**Fix→request pairing (this cycle's wave = v0.22.0)**: U-20261028-001 (co-design) ← partial: sync-overwrite conflict-surfacing engine (T-20261027-004) + snapshot attribution/re-stamp fixes (U-20261027-002, U-20261026-009). No project's request is fully closed by the wave; U-20261028-001 remains open for the tombstone half.

## Step 2f — Learning extraction (FIFO)

Budget: 3 landings deep-reviewed (FIFO: co-newbiz #533, #534, #743 — oldest carried). One scoped Explore pass.

| Landing | Verdict |
|---|---|
| co-newbiz #533 (KO wording sweep + data consistency) | **reviewed, nothing to extract** — project-local UI/label normalization; the only generic code (per-route Map caches) is a trivial known pattern |
| co-newbiz #534 (greenfield default origin internal, ADR-0166) | **reviewed, nothing to extract** — co-newbiz-only business rule; surrounding pattern standard practice |
| co-newbiz #743 (gate integrity: script guards + graft helpers + ADR-0186) | **learning candidate (1)** → `T-20261028-008`: distill ADR-0186 into a fleet process skill "decision-write-integrity" (HARD BLOCK/ACK/DISPLAY taxonomy, off\|shadow\|enforce rollout, snapshot-hash propose-confirm, script-aware rationale checks, maker/checker countersign). Its two script guards were ALREADY extracted root-side (U-20261026-011, T-20261026-003) — no re-file. Pollination lead: co-architect `model.py:127,44`. **Gated**: any port blocked until T-20261028-009 (secrets-gate FP adjudication) clears |

**1 `learning:` ticket filed. Carried FIFO to next window**: co-newbiz #740–#742, co-design #54, co-price #157, then this window's co-design #59/#60/#62/#64, co-newbiz #746–#752 (subset of #743's review already done), co-safety #213, co-abap #223.

NO-SILENCE (mechanical, reviewed — nothing to extract): all remaining window PRs in the four projects were template deliveries/workspace syncs (#61/#63 co-design; co-newbiz #747–#753 are the ADR series covered by the #743-family review lineage; co-abap/co-safety single adjudications covered above).

## Step 2b — Evidence backport scan

| Verdict | Projects |
|---|---|
| PROMOTABLE | co-safety — schema-typed evidence plane: 187/190 `evidence-models/**` validate against the common schema; M1–M6 PASS incl. 4 decision records + 55 companion-skill references + migrations README. **Triage row, not promoted tonight**: M2/M4 are UNVERIFIED-BY-DELTA (git-log fallback), and promotion stays human-judged — an explicit adjudication (à la T-20261027-011/-012) should decide the 187-file port |
| NOT_YET | co-newbiz (maturity test failed), co-security (prose-ledger FAIL M1/M2) |
| NEEDS_TRIAGE (standing no-op: evidence-shaped paths, no form fingerprint) | other 13 |

## SECRETS GATE

Git-mode gitleaks (full config) over the four project diff ranges: co-abap, co-design, co-safety **clean**; co-newbiz **4 findings** (generic-api-key) in ADR-0186 test fixtures — assessed false-positive class (gate-acknowledgement identifier fixtures, not credentials) but recorded as a **hard-fail with urgent ticket T-20261028-009**; disposition (allowlist vs scrub) is human adjudication. Note: a first invocation accidentally ran `--no-git` against the workspace root (piped-stdin misuse, uniform 1198 count) — discarded as invalid; the reported per-range results are from corrected git-mode runs. No project content enters root/templates this cycle; the wave direction (template→project) derives from tagged `template-v0.22.0` whose landing passed full root CI.

## Step 3 — This PR

Report-only landing (judgment report + this file + tickets T-20261028-007/-008/-009). No template content changes; zero backport candidates promoted. Design Gate: covered by the standing specs 2026-09-25-daily-fleet-review-resync-design (ADR-0089) and 2026-10-07-daily-fleet-learning-extraction-design.

## Steps 4–5 — v0.22.0 upgrade wave

To be appended after the wave completes (canary-first: co-price; then remaining 15 projects; billing-wall exception T-20261007-025 applies to private-repo fail-at-start merges with per-merge recording).
