# co-architect Promotion Checklist

> **Authored snapshot — machine state is variant.json.** This checklist records
> the promotion review at its time; the authoritative status/phase state lives
> in `variant.json`.

**Variant:** co-architect
**Current Status:** beta
**Beta Since:** 2026-11-01
**Source:** Projects/co-architect (L3), promoted via `scripts/l3-to-variant-pipeline.ts` v1.21.2
**Batch:** hub-and-spoke Phase 1 Batch E⑤ (spec 2026-11-01-hub-consolidation-design §6.3 — validation case, first exercised consumer of the pipeline conformance rules)

## Hold History

- 2026-08-29 — ⛔ PROMOTION HOLD recorded (standing directive: no promotion
  without explicit user permission; seeded into `Projects/co-architect/variant.json`).
- 2026-11-01 — ✅ HOLD RELEASED on the user's plain-language ratification of the
  hub-and-spoke baseline (2026-10-31 review decision item 2 "co-architect template
  creation proceeds"; 2026-11-01 v6 baseline review item 11 "Roster pinned:
  co-architect = template creation"). co-newbiz remains held/excluded.

## Pipeline Run Record (2026-11-01)

| Run | Outcome | Fix applied between runs |
|-----|---------|--------------------------|
| 1 | FAILED Phase 3.7 (plugin capability-coverage) | Added `capabilities:` frontmatter to pm/analyst/technical-writer (co-news precedent) |
| 2 | FAILED Phase 6 (platform parity, 8 fatal) | Aligned `.claude/settings.json` mcpServers with gemini (graft+trail); removed 7 stale `.gemini/commands/*.md` (pre-toml-migration drift) |
| 3 | FAILED Phase 8 (readiness gate: manifest `file` fields, PROMOTION_CHECKLIST, pm orphan) | Completed manually post-run (see below) |
| 4 | All phases to Phase 8; Phase 8 completion finished by hand | — |

## Post-Run Manual Completion (this batch)

- [x] variant.json manifests rebuilt from the generated tree: 24 agents (incl. pm) with `file` fields; 26 skills with `file` fields (reconcile had dropped 14 L1-identical source skills that extractSkills still listed)
- [x] Lifecycle reset to honest beta state (the generator inherited the project's stale stable-era lifecycle: statusSince 2026-06-17, stablePromotedOn set)
- [x] `skills/SKILLS.md` index regenerated from actual template dirs (26)
- [x] Stale `skills/accessibility-audit` copy dropped (hub-doctrine per registry — L3 carried the L1 common stock with `scope: common`; design §6.3 declare-first: no stale copies; consumer reads the hub canonical v1.1.0)
- [x] Hub block added: `{role: consumer, consumes: [{domain: co-design, minimum_version: 1.0.0}]}`
- [x] `docs/user-guide.md` + `docs/user-guide_ko.md` authored (contract-required; source project had none)

## Promotion Criteria (beta -> stable)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|------------------|
| 1 | Agent roster completeness | Pending | 24 agents on disk and manifested; golden-reference structural WARNs on ~19 agents (missing Responsibilities/Output Format/Constraints sections) — non-blocking, tracked for template maturation |
| 2 | Skills coverage | Pending | 26 variant-shipped skills manifested; design-domain skills consumed from co-design hub (registry: accessibility-audit 1.1.0, ui-ux-design-intelligence 1.0.2, service-design 1.1.0, token-usage-lint 1.1.1, tokens.json 1.0.0) |
| 3 | Documentation completeness | Pending | README en/ko, user-guide en/ko, AGENTS.md (regenerated with VARIANT-* markers), docs/co-architect.context.md present |
| 4 | Audit pass rate | Pending | `bun scripts/audit.ts` 0 errors — verify at next sync |
| 5 | Real engagements | Pending | Minimum 1 successful end-to-end engagement on the template |
| 6 | README accuracy | Pending | README reflects current capability set and agent roster |
| 7 | Minimum beta duration | Pending | 3 months in beta status |
| 8 | Zero unresolved bugs | Pending | 0 open bug reports at promotion time |
| 9 | User feedback | Pending | Positive feedback from beta users; no critical complaints |
| 10 | Hub consumption verified | Pending | audit.ts hub-resolve + validate-templates hub-consumer-min-version stay green through at least one promotion wave |

## Known Gaps / Follow-ups (for PM)

- Source-project stale manifest rows: `validate-docs-links` (skill retired fleet-wide in T-20260912-013) and `k-law` (country-scoped, common-delivered) still listed in `Projects/co-architect/variant.json` skills[] — dead rows, do not propagate, but the source manifest should be cleaned by its owner.
- CAD identity assets (`cad-server-manager`, `cad-space-recognition`, `cad-svg-preview`, `generate-room-elevation`, `zwcad-ai-drawing`, plus the `zwcad-mcp`/`building_skill`/`base-map` server stack and `src/cad_intelligence` doctrine) are variant-identity candidates for the hub_topology registry — batch E④ registered co-safety/co-game/co-abap identity assets but not co-architect's (template did not exist yet).
- Golden-reference section WARNs (~19 agents) — cosmetic structural maturation, not blocking beta.

## Review History

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| 2026-11-01 | scaffolding-expert (Batch E⑤) | Promoted to beta | 3 pipeline refusals resolved (capabilities frontmatter, platform-parity mirrors, manifest completion); hub block declared; hold release recorded above |
