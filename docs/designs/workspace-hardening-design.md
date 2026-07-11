# Design: Workspace Hardening (M-item cleanup, drift-noise removal, tests, CI, variant/docs analysis)

**Date**: 2026-07-11
**Status**: Completed
**Spec ID**: 2026-07-11-workspace-hardening
**Scope**: scripts/generate-version-manifest.ts, scripts/sync-skills.ts, scripts/qa-gate.ts, scripts/new-project.ts, scripts/propagate-to-templates.ts, scripts/dev-sync.ts, package.json, .agents/, tests/unit/, .github/workflows/, docs/reports/

---

## 1. Problem Statement

The 2026-07-10 two-round project review ([memory/2026-07-10.md](../../memory/2026-07-10.md)) fixed 53 issues but deferred 11 Moderate items (M1-M15, excluding M11/M12/M15) as "no functional impact." Independently, `docs/VERSION_MANIFEST.md` Drift Detection reports about 30 duplicated false-positive "no triggers defined" warnings, caused by a parser bug (see Section 3). Test coverage across 67 operational scripts is limited to `tests/propagate-to-templates.test.ts` and `tests/unit/`. CI (`.github/workflows/test.yml`) has no enforced secret scanning (soft-skips if the `gitleaks` binary is absent) and no scheduled lifecycle health check per CONSTITUTION Section 9. Two beta variants (co-deck, co-game) lack a promotion readiness assessment, and governance documentation (CLAUDE.md/GEMINI.md/CONSTITUTION.md/AGENTS.md) has accumulated cross-document duplication with no measurement.

## 2. Decision Summary

Address all six workstreams in this cycle, split into 3 PRs by dependency to keep review surface manageable:

- **PR1** - script hardening (M-items) plus VERSION_MANIFEST parser fix plus regression tests. Internally organized as 5 separate commits (parser, then sync-skills, then qa-gate, then new-project/regex/M1, then dependency pinning, then .agents parity, then test registration) so reviewers and `git bisect` can isolate any regression to a single concern.
- **PR2** - CI gate extension (`.github/workflows/*`), independent of PR1's script changes.
- **PR3** - analysis reports (`docs/reports/*`), independent of both.

Excluded from this cycle: M11/M12 (templates/co-design AGENTS.md format cleanup) - CONSTITUTION Section 9 forbids mixing workspace-root and template edits in a single session; M15 (ssrf.ts TOCTOU DNS rebinding) - already a documented, accepted limitation.

Agent-tool fallback: PM Gateway (CLAUDE.md Section 6) specifies specialist dispatch via the native Agent tool. During this session the Agent tool failed with a model-routing error. Per user direction, execution proceeds inline (PM executing directly) rather than blocking on the tool; this is recorded here as the governance exception for this cycle, not a precedent for future sessions.

## 3. VERSION_MANIFEST Parser Root Cause

`scripts/generate-version-manifest.ts` in `parseSkillFrontmatter()` uses a regex that only matches a top-level inline YAML array (`triggers: [a, b]`). Actual skills (verified in `skills/sync/SKILL.md`) declare triggers nested under a `metadata:` block as a YAML list. The regex never matches this shape, so every skill is reported as "no triggers defined" - a false positive, not a real governance gap. Additionally, skills are scanned once per platform-distribution location (`skills/`, `.claude/skills/`, `.gemini/skills/`, `.agents/skills/`), so each false-positive is emitted multiple times in the Drift Detection section.

Fix: parse frontmatter via `js-yaml` (already a devDependency) and read `metadata.triggers` with a top-level `triggers` fallback; apply the same treatment to `version`/`owner`. Deduplicate drift issues by unique skill name. Wrap the YAML parse in try/catch - a malformed `SKILL.md` must not abort manifest generation for every other skill.

Severity convention introduced: drift issues are now prefixed `[ERROR]` (frontmatter unparseable - version/owner/triggers all unrecoverable) or `[WARNING]` (parseable but a field, e.g. triggers, is genuinely empty). This lets a future CI gate fail only on `[ERROR]`-level drift without blocking on cosmetic warnings.

## 4. Files to Change

| File | Workstream | Action |
|------|------------|--------|
| scripts/generate-version-manifest.ts | WS2 | Fix parseSkillFrontmatter, add try/catch plus severity, dedup drift issues, fix command-integration mapping |
| skills/*/SKILL.md (subset found trigger-less after fix) | WS2 | Add metadata.triggers, patch version bump |
| scripts/sync-skills.ts | WS1 (M2/M3) | Per-skill try/catch error collection; skip identical-content copies |
| scripts/qa-gate.ts | WS1 (M5) | Normalize CRLF to LF before content comparison |
| scripts/new-project.ts | WS1 (M13) | try/catch with rollback of partially-created project dir |
| scripts/propagate-to-templates.ts | WS1 (M4) | Harden fragile regex (anchored pattern or js-yaml) |
| scripts/dev-sync.ts | WS1 (M1) | Verify crypto.randomUUID() usage at line 327; no-op or minor cleanup |
| package.json | WS1 (M7) | Pin @types/node, js-yaml, typescript to exact versions |
| .agents/commands/*.md, .agents/skills.json | WS1 (M9/M10) | Add missing command files, verify skill registry completeness |
| tests/unit/generate-version-manifest.test.ts (new) | WS3 | Parser regression tests |
| tests/unit/sync-skills.test.ts (new) | WS3 | Idempotency plus error-collection tests |
| tests/unit/qa-gate-crlf.test.ts (new) | WS3 | CRLF normalization test |
| tests/unit/new-project-rollback.test.ts (new) | WS3 | Rollback-on-failure test |
| .github/workflows/test.yml | WS4 | Real gitleaks scan (PR-diff scope), add validate-templates step |
| .github/workflows/weekly-health-check.yml (new) | WS4 | Scheduled lifecycle health check (CONSTITUTION Section 9) |
| docs/reports/variant-promotion-roadmap-2026-07.md (new) | WS5 | co-deck/co-game promotion analysis |
| docs/reports/governance-docs-diet-analysis.md (new) | WS6 | Governance doc duplication analysis |

## 5. Trade-offs Considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| Single PR for all 6 workstreams | Fewer PR overhead | Unreviewable diff size, mixes independent concerns | Rejected |
| One PR per M-item (11 PRs) | Maximal isolation | High process overhead for small, related fixes | Rejected |
| 3 PRs by dependency, PR1 internally commit-separated | Balances review size with process overhead; commits give bisect granularity within PR1 | Slightly more coordination during PR1 authoring | Selected |
| Fail-fast on malformed skill frontmatter | Simpler code | One bad file blocks the entire manifest/audit pipeline | Rejected |
| Try/catch with per-skill ERROR reporting | Resilient, informative | Slightly more code | Selected |

## 6. Cross-Platform Considerations

- Windows (PowerShell) / Unix (Bash): all script changes remain TypeScript executed via Bun (ADR-0036); no shell-specific logic introduced.
- CRLF fix (M5) directly addresses a Windows-specific qa-gate false-positive.
- .agents/ parity (M9/M10) is an Antigravity-platform-specific fix.
- CI workflows already run a 3-OS matrix (ubuntu-latest, windows-latest, macos-latest) for test.yml; the new weekly-health-check.yml runs ubuntu-latest only (lifecycle audits are OS-independent Bun scripts).

## 7. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|-----------------|
| Claude Code | None - no .claude/ config changes; .claude/skills/ receives distributed copies via sync-skills.ts (no manual edits) | N/A |
| Antigravity (GEMINI.md) | Yes - M9/M10 closes .agents/ command/skill parity gap | .agents/commands/*.md, .agents/skills.json |
| templates/common | None this cycle - all changes are workspace-root (L0) scripts, tests, CI, and reports; no template propagation required | N/A |

## 8. Acceptance Criteria

- [x] PR1: parser tests pass; VERSION_MANIFEST regenerates with clean Drift Detection (no triggers noise, no duplicates); sync-skills and version-manifest both idempotent (empty git diff on 2nd run); bun.lock diff limited to 3 pinned packages; M1 branch decision documented; bun scripts/audit.ts all PASS. — Verified 2026-07-12: merged via PRs #394/#398/#400/#402; 26 tests pass across the 4 target suites; audit.ts all PASS.
- [x] PR2: test.yml performs real gitleaks PR-diff scan plus validate-templates step; weekly-health-check.yml runs on schedule and manually; all referenced bun run scripts exist in package.json. — Verified 2026-07-12: merged via PR #395 (+ #400 fetch-depth fix); weekly-health-check.yml cron confirmed present.
- [x] PR3: both reports cite verified repository state (e.g., git ls-files output), are English-only, live under docs/reports/, and end with a Summary section (Findings / Recommended Actions / Deferred Items). — Verified 2026-07-12: merged via PR #396; both reports present under docs/reports/.

## 9. Open Questions

None outstanding - all prior open questions were resolved across the plan-review rounds with the user (PR granularity, YAML failure policy, dependency-pinning verification, gitleaks scan scope, report structure).
