# Variant Promotion Roadmap — 2026-07

**Date**: 2026-07-11
**Scope**: Beta → Stable promotion readiness for `co-deck` and `co-game` (the workspace's two beta-status variants as of this date). Analysis only — no template or lifecycle files modified in this report.

---

## 1. Method

Promotion eligibility is governed by `scripts/helpers/registries/promotion-policy.ts` (SSOT for beta-to-stable criteria, keyed by `variant_type`), tracked per-variant in `.pipeline-state/beta-lifecycle/<variant>.json` (local, untracked — not committed to git), and sourced from each variant's `templates/co-<name>/variant.json` `lifecycle` block. `skills/promote-variant/SKILL.md` governs a different transition (Phase A prototype → Phase B template) and does not apply here, since both variants already have a `templates/co-<name>/` template — the open question is their **internal beta → stable** status, not initial promotion.

## 2. Criterion × Variant Comparison

| Criterion | co-deck (`lecture` type) | co-game (`game` type) |
|---|---|---|
| Policy: min engagements | 2 required | 3 required |
| Policy: min beta duration | 2 months | 3 months |
| Actual engagements logged | **0** (`betaEngagements: 0`, empty `engagementLog`) | **0** (`betaEngagements: 0`, empty `engagementLog`) |
| Beta start date | 2026-06-17 (`variant.json`) / 2026-06-26 (`.pipeline-state` tracking init) | 2026-07-08 (both sources agree) |
| Beta age as of 2026-07-11 | ~24 days (~0.8 months) | ~3 days (~0.1 months) |
| `promotionEligible` flag | `false` | `false` |
| Additional checks required | None (lecture type has no `additionalChecks`) | None (game type has no `additionalChecks`) |
| **Overall status** | **Not eligible** — met 0/2 engagement criterion, ~0.8/2 months | **Not eligible** — met 0/3 engagement criterion, ~0.1/3 months |

## 3. Per-Variant Analysis

### co-deck
Furthest along of the two, but still well short on both axes: zero logged client engagements against a minimum of 2, and roughly 24 days of beta age against a 2-month (~60 day) minimum. No `additionalChecks` gate applies to the `lecture` type, so the remaining path to eligibility is purely usage-driven — it needs real engagements logged via the beta-lifecycle tracking tooling (`scripts/helpers/beta-lifecycle.ts`) and to simply continue existing in beta for another ~5 weeks minimum.

### co-game
Very early in its beta lifecycle (3 days old as of this report) with the strictest policy of the two currently-beta variant types (3 engagements / 3 months, matching `security`'s months requirement but with a lower engagement bar). No action is warranted yet — revisit no earlier than 2026-10-08 (3 months from beta start), and only once at least 3 engagements have been logged.

## 4. Housekeeping Note — `Projects/co-deck_prototype.zip`

`git ls-files Projects/` returns no tracked files — the entire `Projects/` directory (including `co-deck_prototype.zip`) is excluded from version control by the workspace `.gitignore`'s blanket `/*/ ` rule (per CONSTITUTION: this repo tracks only `scripts/`, `templates/`, `agents/`, `docs/`, `skills/`, `memory/`, and root config files — `Projects/*` are independent, locally-cloned projects, consistent with the Layer × Stage model). **No git cleanup is needed or possible** — the zip is a local artifact on this machine only. If it is stale scratch space left over from the co-deck Phase A→B promotion, a manual local `rm` is a user decision, not a repo change; it is not recommended to script its removal since `Projects/` may hold other in-progress local work.

## Summary

### Findings
- Both beta variants (`co-deck`, `co-game`) are far from meeting their respective beta-to-stable promotion policies — the binding constraint for both is zero logged engagements, not beta duration.
- `co-game` additionally fails the duration criterion by a wide margin (3 days vs. a 3-month minimum).
- `.pipeline-state/beta-lifecycle/*.json` tracking files are local-only (not git-tracked) — engagement/bug logging only persists on whichever machine runs the tracking scripts, which may itself be worth flagging to lifecycle-manager as a durability gap outside this report's scope.
- `Projects/co-deck_prototype.zip` is not a git artifact — no repository cleanup action applies.

### Recommended Actions
- No promotion action for either variant at this time — both are explicitly **hold** status.
- Log real engagements via `scripts/helpers/beta-lifecycle.ts` as they occur, to build the evidence base needed for future promotion review.
- Revisit `co-deck` no earlier than mid-August 2026 (2-month mark) and `co-game` no earlier than October 2026 (3-month mark), each conditional on the engagement count also being met by that time.

### Deferred Items
- Whether `.pipeline-state/beta-lifecycle/` tracking state should be committed to git (durability across machines/sessions) is a governance question outside this report's scope — flagged for a future lifecycle-manager review, not actioned here.
