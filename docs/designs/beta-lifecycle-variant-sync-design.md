# Design: Beta Lifecycle Aggregate Summary Sync to variant.json (Retroactive)

**Date**: 2026-07-11 (retroactive — documents a change already merged via [PR #397](https://github.com/5throck/ai-workspace-standards/pull/397))
**Status**: Approved (implemented)
**Spec ID**: 2026-07-11-beta-lifecycle-variant-sync
**Scope**: scripts/helpers/beta-lifecycle.ts, .gitignore, templates/co-deck/variant.json, templates/co-game/variant.json

---

## 1. Problem Statement

`docs/reports/variant-promotion-roadmap-2026-07.md` flagged that `.pipeline-state/beta-lifecycle/*.json` — the only record of a beta variant's engagement count, bug count, and promotion eligibility — is git-ignored (caught by the workspace's blanket `/*/ ` rule) and therefore local-only. Since promotion decisions (beta → stable) are based on this data, the durable governance record was missing: a different machine, a fresh clone, or CI would see zero history and could not evaluate promotion readiness at all.

## 2. Decision Summary

Investigated whether the whole `.pipeline-state/` directory should simply be un-ignored (the same fix applied to `tests/` earlier in this session for an analogous accidental-exclusion bug). Found this was **not** analogous: `.pipeline-state/beta-lifecycle/*.json` contains `Engagement.clientId` (client identifiers, obfuscated but still per-client) and `Bug.description` (free-text bug reports) — operational/business data, not accidentally-excluded source code. Committing it wholesale would leak that detail into git history.

Resolution: keep the raw per-engagement log local-only (documented explicitly in `.gitignore`, not left as an undocumented side-effect of the blanket rule), but mirror the **aggregate, non-sensitive fields** — engagement count, bug count, beta age, promotion eligibility, missing criteria — into the already-tracked `templates/<variant>/variant.json` under a new `betaLifecycleSummary` key. This is exactly the data promotion decisions consume; the per-engagement detail is not needed for that decision.

## 3. Files Changed (as merged in PR #397)

| File | Action | Description |
|------|--------|-------------|
| `scripts/helpers/beta-lifecycle.ts` | Modify | Added `syncSummaryToVariantJson(state, workspaceRoot?)`, called from `saveLifecycleState()` after every state-mutating operation (`initializeBetaLifecycle`, `recordEngagement`, `recordBug`, etc.) |
| `.gitignore` | Modify | Added explicit `.pipeline-state/` entry with a rationale comment (previously only caught implicitly by the blanket `/*/ ` rule) |
| `templates/co-deck/variant.json`, `templates/co-game/variant.json` | Modify (backfill) | One-time sync of current state (0 engagements, not eligible, per the promotion roadmap report) |
| `tests/unit/beta-lifecycle-variant-sync.test.ts` | Create | 4 tests: writes aggregate fields without leaking per-engagement detail, preserves existing variant.json fields, non-throwing when variant.json is absent, overwrites stale summary on repeat sync |

## 4. Trade-offs Considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| Un-ignore `.pipeline-state/` wholesale | Simple, matches the `tests/` precedent | Commits client identifiers and bug descriptions to git history | Rejected |
| Leave as-is (local-only, undocumented) | Zero effort | Silent governance-data loss across machines; indistinguishable from an oversight | Rejected |
| Mirror only the aggregate into the already-tracked `variant.json` | Durable where it matters (promotion decisions); no sensitive data committed | Two sources of truth for the same numbers (local detail log + tracked summary) — acceptable since the summary is a read-only derived projection, never the primary write target | **Selected** |

## 5. Cross-Platform Considerations

No platform-specific behavior — pure Node/Bun `fs` operations, identical on Windows/Linux/macOS.

## 6. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|-----------------|
| Claude Code | None | N/A |
| Antigravity (GEMINI.md) | None | N/A |
| templates/common | None — `templates/co-deck/` and `templates/co-game/` are L2 variant directories, not `templates/common/`; no L0→L1 propagation involved | N/A |

## 7. Acceptance Criteria (met, as merged)

- [x] `betaLifecycleSummary` written to `variant.json` on every `saveLifecycleState()` call.
- [x] No `clientId` or bug `description` values appear in `variant.json`.
- [x] Missing `variant.json` (e.g. a test fixture) does not throw — logs a warning and continues.
- [x] `.gitignore` documents the exclusion rationale explicitly rather than relying on the blanket rule silently.
- [x] Backfilled for both current beta variants (co-deck, co-game).

## 8. Open Questions

None — this is a retroactive record of already-approved, already-merged work; no new decisions required.
