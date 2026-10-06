# Project Review — Workspace Root — 2026-10-07 (daily fleet review, run-10)

**Date**: 2026-10-07
**Scope**: workspace root (L0) FULL review + Phase 1b per-variant review (first run)
**Method**: 4 parallel Explore review slots (A Architecture+Scaffolding / B Standards+Lifecycle / C Automation / D Docs+Security) + machine battery + per-variant batteries
**Mode rationale**: FULL — structural trigger fired (new variant co-learning added via PR #1438); window also spans a 47h gap (the 2026-10-06 02:00 shifted run did not complete; two consecutive cycles deferred on stranded session-closeout blocks, landed this session via PR #1442 with user direction)
**Window**: 2026-10-05T02:38:14 → `5b1a9c7c` (80 commits): remediation waves (co-deck 114 files, co-abap/co-consult/co-develop checklists+gates+phase-definitions), new co-learning variant (48 files), spec-registry enforcement (244 entries), docs-links --all gate with 59-link repair, upgrade-project 1.64.0 L3 preservation, pre-rebase hook scan fix, co-safety #197 merged (fleet complete at 0.12.0)

## Baseline (machine battery)

| Validator | Result |
|---|---|
| audit.ts | ✅ PASS |
| validate-templates.ts | ✅ PASS |
| verify-scripts.ts --verify | ✅ PASS |
| agent-lifecycle-audit | ✅ PASS |
| skill-lifecycle-audit | ✅ PASS |
| propagate-to-templates --check-drift | ✅ PASS (tolerated only) |
| **validate-variant-claims.ts (new 7th)** | ✅ PASS — fleet-wide 0 findings (independently re-verified per variant, 14/14) |

## Phase 1b — per-variant battery (first run)

| Variant | claims (validate-variant-claims --template) | readiness (validate-variant-readiness --variant) | Mode |
|---|---|---|---|
| co-abap | PASS 0 findings (33 warn) | All checks passed | battery-only* |
| co-consult | PASS 0 findings (4 warn) | READY (warnings) | battery-only* |
| co-deck | PASS 0 findings (15 warn) | All checks passed | battery-only* |
| co-design | PASS 0 findings (7 warn) | All checks passed | battery-only* |
| co-develop | PASS 0 findings (1 warn) | All checks passed | battery-only* |
| co-export | PASS 0 findings (5 warn) | READY (warnings) | battery-only* |
| co-game | PASS 0 findings (11 warn) | All checks passed | battery-only* |
| co-hr | PASS 0 findings (8 warn) | READY (warnings) | battery-only* |
| co-learning | PASS 0 findings | All checks passed | FULL (new variant — reviewed by Slot A) |
| co-news | PASS 0 findings (5 warn) | READY (warnings) | battery-only* |
| co-price | PASS 0 findings | READY (warnings) | battery-only* |
| co-safety | PASS 0 findings (2 warn) | READY (warnings) | battery-only* |
| co-security | PASS 0 findings (11 warn) | All checks passed | battery-only* |
| co-work | PASS 0 findings (5 warn) | All checks passed | battery-only* |

*All 14 variants carried window changes (the remediation + L1 waves touched every variant), but their deltas are shared waves already under 4-slot FULL review (Slot A: co-learning + co-deck + fork-model checklists; Slot B: lifecycle/registry coherence; Slot C: L1 scripts wave; Slot D: docs/language). Per the wave-dedupe rule, per-variant agent dispatch would duplicate the same review — findings below carry variant attribution. One-time exception note: the originally specified per-variant commands (scripts/audit.ts inside templates/<v>) do not exist — see finding P1b-1.

## Review Results

### 🔴 Critical
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|

*(none)*

### 🟡 High
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | co-learning has no platform-side lifecycle record — validate-variant-claims check (m) silently skips it; ADR-0099 §4 makes the record the SSOT twin of variant.json status | A+B (deduped) | docs/lifecycle/templates/ (missing co-learning.md); scripts/validate-variant-claims.ts:1143 | one-time | ✅ fixed: record created (created 2026-10-06, `- → review` per beta-first); hardening idea (warn on missing record for tracked variants) folded into T-20261006-006 |
| H2 | co-deck PROMOTION_CHECKLIST marks criteria 6/8/10 "Done" while its own evidence says unmet (criterion 8: 74-day beta vs 3-month gate) — the exact class ADR-0099 §2 proscribes; co-deck sits outside the ADR's named ratification scope | A | templates/co-deck/PROMOTION_CHECKLIST.md | systemic | T-20261006-005 |
| H3 | validate-variant-claims.ts (1,880 lines, 4 versions in 2 days) has zero unit tests and no CI wiring — calibration-sensitive parsers can regress invisibly; every other new gate this window got tests + CI | B+C (deduped) | scripts/validate-variant-claims.ts | script-gap | T-20261006-006 |

### 🟢 Moderate
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | "Beta Since" boilerplate contradicts the waiver narrative in co-consult/co-develop checklists (no migrated-same-day parenthetical, unlike co-abap) | A | templates/co-{consult,develop}/PROMOTION_CHECKLIST.md:5 | one-time | folded into T-20261006-005 |
| M2 | VRG `--variant` mode broken in the L1 copy (WORKSPACE_ROOT resolves to templates/common → templates/templates/...); documented usage can never succeed; enforcement unaffected (all machinery uses --dir) | A | templates/common/scripts/validate-variant-readiness.ts:38-39 | script-gap | route with T-20261006-007-class L1 hygiene (noted in ticket T-20261006-007 scope) |
| M3 | ADR-0051 not back-linked to its correcting ADR (superseded claims presented as fact to readers of 0051 alone) | B | docs/adr/0051-co-abap-stable-promotion.md:3 | one-time | ✅ fixed: Status-line backlink per the ADR-0036/0088 convention |
| M4 | docs/governance/variant-lifecycle.md (the stage-transition SSOT) has no ADR-0099 linkage and its promoted-variants table is stale ("All five variants … stable"; fleet is 14) | B | docs/governance/variant-lifecycle.md:56 | one-time | ✅ fixed: migration fast-track subsection + table correction |
| M5 | co-abap lifecycle record missing the ADR-0099 ratification row its two siblings got (fleet-parity drift) | B | docs/lifecycle/templates/co-abap.md | one-time | ✅ fixed: row appended (matching co-consult wording) |
| M6 | L1 SCRIPTS.md stale duplicated tail (readme-lifecycle-audit 1.0.4 vs 1.1.0; validate-docs-links 1.4.0 vs 1.5.0; malformed truncated rows) — root was deduplicated 10-05, the L1 mirror was not | C | templates/common/scripts/SCRIPTS.md:556,598 | script-gap | T-20261006-007 |
| M7 | co-learning `_ko` docs skip the `lang: ko` declaration convention (2 files no frontmatter at all); validator silently excludes `_ko` files so the drift is undetectable | D | templates/co-learning/docs/*_ko.md; scripts/validate-md-language.ts | script-gap | T-20261006-003 (declarations) + T-20261006-004 (validator perimeter) |
| M8 | pre-rebase `--root` under-scans (zero-arg fallback = HEAD~10..HEAD on a full-history rebase) — residual gap, not a regression | C | .githooks/pre-rebase:34-38 | script-gap | T-20261006-008 |
| M9 | upgrade-project agents prune omits the root agents/ SSOT from its upstream list → truthful-delivered agents get a wrong "project-owned" KEEP verdict (safe outcome, wrong classification) | C | scripts/upgrade-project.ts:3126 | script-gap | T-20261006-009 |
| M10 | VARIANT-SCOPE owner-curated pass removes foreign-variant skills before the L3-preservation walk — exam-bank class only partially covered; exemption undocumented | C | scripts/upgrade-project.ts:2933-2959 | script-gap | T-20261006-010 |
| M11 | P1b-1: the Phase 1b battery spec names scripts/audit.ts inside templates/<variant> — L2 templates carry no scripts/ tree; first run failed Module-not-found on all 14 | PM | runner prompt + design §4.2b R44 | script-gap | T-20261006-002 (spec corrected to the real validators, both verified 14/14 PASS) |

### ℹ️ Low / Improvements
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| L1 | T-20261004-029 result cites PR #1417; the fix actually landed via PR #1415 (outcome real, citation wrong — result field not editable outside ticket.ts) | B | tickets/governance/T-20261004-029.yaml | one-time | recorded here; corrected at next ticket touch |
| L2 | U-20261006-001 history carries one non-native doubled backlog→waiting edge (stale-read artifact; current status review is correct) | B | tickets/governance/U-20261006-001.yaml:13-18 | one-time | report-only; candidate ticket-store lint folded into T-20261006-010 follow-ups |
| L3 | co-learning context.md:60 em-dash where an arrow is meant (cosmetic) | D | templates/co-learning/docs/co-learning.context.md:60 | one-time | sweep with the co-learning wave |
| L4 | Corrects the runner's own window note: "4 new ADRs" was wrong — exactly 1 new ADR (0099) landed in-window; the other adr/ diffs are link-path repairs | D (vs PM brief) | docs/adr/ | — | corrected here |

### ✅ Strengths
- The ADR-0099 remediation wave is coherent end-to-end: all three migrated checklists implement §2 to the letter (waivers marked "N/A per ADR-0099", never "met"), ratification rows present, and the 10-05 L0-leak finding is resolved with the intentional-duplicate marker working as designed (Slot A).
- co-learning's new-variant acceptance is substantively sound: beta-first honored (status beta, all criteria honestly Pending), five-mirror parity verified, all registration touchpoints landed (Slot A) — the one gap (H1) was the platform-side record, fixed in this landing.
- The spec registry survived three "keep both entries" conflict resolutions intact: 244 entries machine-checked — zero duplicates, canonical order, 1:1 entries parity, byte-identical canonical JSON (Slot B).
- docs-links --all landed in its strongest form: 59 links repaired to zero, no baseline carve-out, dual enforcement in audit + CI (Slots C+D verified independently).
- The pre-rebase rewrite fixes a real subtle bug (gitleaks 8.x ignores stdin — old verdicts were working-tree verdicts), keeps mirrors byte-identical, and fails closed without the binary (Slots C+D agree: strengthening, not weakening).
- upgrade-project 1.64.0's preserve-by-default flip is the right failure direction with byte-for-byte test pins (Slot C).
- Supply chain untouched: package.json/bun.lock zero diff; zero secrets in the window diff; .gitleaks.toml unchanged (Slot D).

## Fixes applied this session (docs-class, in Phase I landing)

| File | Change |
|---|---|
| docs/lifecycle/templates/co-learning.md | created — platform-side lifecycle record (H1) |
| docs/adr/0051-co-abap-stable-promotion.md | Status-line backlink to ADR-0099 (M3) |
| docs/governance/variant-lifecycle.md | migration fast-track subsection + stale promoted-variants claim corrected (M4) |
| docs/lifecycle/templates/co-abap.md | ADR-0099 ratification row appended (M5) |
| memory/skill-graph-metrics/snapshot-2026-10-07.json | today's fleet snapshot (diff base; 14 projects) |
| tickets/governance/T-20261006-002..010.yaml | 9 tickets (shared cap: 9/10 used) |

## Action wiring

| Ticket | Class | Summary |
|---|---|---|
| T-20261006-002 | script-gap | Phase 1b battery spec vs repo reality (audit.ts doesn't exist in templates) — spec corrected |
| T-20261006-003 | one-time | co-learning `_ko` lang declarations |
| T-20261006-004 | validator-hardening | require lang declaration in `_ko` files (validator perimeter) |
| T-20261006-005 | systemic | ADR-0099 checklist-coherence wave 2 (co-deck 6/8/10 + Beta Since parentheticals + baseline count) |
| T-20261006-006 | validator-hardening | validate-variant-claims tests + CI wiring |
| T-20261006-007 | script-gap | L1 SCRIPTS.md stale tail dedup (VRG --variant L1 mode noted in scope) |
| T-20261006-008 | script-gap | pre-rebase --root under-scan |
| T-20261006-009 | script-gap | agents prune upstream list omits root SSOT |
| T-20261006-010 | script-gap | VARIANT-SCOPE vs L3-preservation ordering + exemption documentation |

## Adjudications

- **H1 dedupe**: Slots A and B independently found the missing co-learning lifecycle record — credited to both, one finding, one fix.
- **Phase 1b agent-dispatch waiver**: all 14 variants changed in-window (shared waves), but their delta surfaces were under the same FULL-mode 4-slot review; per-variant dispatch would duplicate it. Recorded per the wave-dedupe rule; from the next normal cycle, changed variants get their own scoped passes.
- **co-deck local work**: the project carries an in-flight local branch (`feat-presentations-add-lecture-v4…`, 13 dirty files, engagement content) — Phase II handles it per resync-audit verdicts; not a Phase I finding.

## Verification

Post-landing: audit.ts + spec-check re-run results appended after the landing PR; validate-variant-claims stays 14/14 PASS (lifecycle record creation turns co-learning's check (m) from skipped to audited — re-verified below).
