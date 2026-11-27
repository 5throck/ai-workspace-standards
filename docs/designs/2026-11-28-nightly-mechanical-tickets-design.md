# Nightly Mechanical Tickets Batch — 2026-11-28 (T-20261128-001 / T-20261127-008 / T-20261127-009)

- **Status**: implemented
- **Date**: 2026-11-28
- **Source tickets**: T-20261128-001, T-20261127-008, T-20261127-009 (service tickets, fix plans prescribed in the tickets themselves)
- **Executor**: automation-engineer (2026-11-28 nightly, STEP A)

## 1. T-20261128-001 — windows load-flake budget for project-target-guards.test.ts

**Defect**: windows-latest killed the test "new-project.ts resolves bare names
under Projects/ (existence pre-flight path)" at its inline 30000ms per-test
ceiling. Measured evidence (retained API): main run 46003145206
(2026-11-27T12:58Z) `(fail) ... [30018.44ms] this test timed out after
30000ms`; PR #2212 recorded the same signature at 30005.04ms (ticket-recorded);
the ticket records a rerun reaching the 120000ms unit file wall. Healthy
windows file totals on identical content: 6773ms (run 46030252124), 18330ms
(run 46012256221).

**Fix (budgets only, no assertion loosened)**:
- `scripts/test-runner.ts` v1.22.0 → v1.23.0: first-time FILE_TIME_BUDGETS row
  `project-target-guards.test.ts: { suite: 300000, test: 60000 }` (engine-spawn
  family, same shape as upgrade-overwrite-protection / validate-templates-cv02).
- `tests/unit/project-target-guards.test.ts` v1.1.0 → v1.2.0: all 12 inline
  per-test ceilings raised 30000 → 60000ms. The inline raise is required because
  bun gives the inline third argument precedence over the runner's `--timeout`,
  so the budget row's test value alone would not lift the file's ceiling.
- Headroom: 60s per test is ≥3x the worst observed passing file total; 300s
  suite is ≥2.5x. Raise policy satisfied: ticket names the CI-run evidence;
  first raise for this file this quarter.

## 2. T-20261127-008 — stale .hermes mirrors (decision-record, evidence-ledger)

**Defect**: templates/common/.hermes/skills/{decision-record,evidence-ledger}
carried 1.1.1 while the other four mirrors carry 1.2.0 → 4 WARNs per scaffold
audit (platform-mirror Check E/F class).

**Fix**: sanctioned propagation tool
(`bun scripts/sync-skills.ts --dir templates/common` — the SSOT-wins mirror
tool used by the 2026-11-27 skills refresh #2206). Both .hermes SKILL.md
copies now read 1.2.0 with identical frontmatter to the sibling mirrors. The
same run refreshed the four explain-me PLATFORM_HARNESS.md mirrors from their
SSOT (tool output, SSOT wins; divergence WARN acknowledged). Verified:
validate-templates `platform-mirror-freshness` PASS ("all five platform skill
mirrors carry SSOT versions"), C-CM-03b PASS rows for every mirror, 0 errors
overall. Fresh-scaffold Check E/F confirmation rides the next scaffold audit;
the template-tree predicate is the same version-parity check and is green.

## 3. T-20261127-009 — co-develop security-check .gemini mirror under-integration

**Defect**: two warnings on every co-develop scaffold: (1) audit Command
parity gap — .claude/commands/security-check.md has no matching
.gemini/commands/security-check.toml (a hand-written .md sits there instead;
Gemini custom commands are TOML-only per T-20261013-009 phase 2); (2)
generate-version-manifest drift row "Command security-check has no matching
skill of the same name".

**Ruling**: the hand-written .gemini .md proves Gemini availability was
intended, so the render path is chosen (not gemini-parity: skip). No other
variant ships a .toml (co-game/co-security carry the same latent .md shape —
same-class follow-up noted, out of this ticket's co-develop scope); no variant
ships a security-check SKILL. The command dispatches agents/security-monitor.md
and is command-only by design, so a same-name SKILL.md would duplicate the
command surface — the sanctioned exemption shape applies.

**Fix**:
- templates/co-develop/.gemini/commands/security-check.toml rendered by
  scripts/render-commands.ts's own renderer (`renderAll("templates/co-develop")`);
  hand-written .gemini/commands/security-check.md retired.
- validate-templates.ts v1.87.0 → v1.88.0: variant-specific command allowlist
  admits "security-check.toml" beside "security-check.md" (the audit parity
  check requires exactly this counterpart).
- generate-version-manifest.ts v1.12.1 → v1.13.0: COMMAND_SKILL_EXEMPT gains
  "security-check" (fleet-level; clears the drift row class for the three
  variants carrying the command).
- Delivered-core-script rule honored: templates/common/scripts/{test-runner,
  validate-templates,generate-version-manifest}.ts re-propagated via
  `bun scripts/propagate-to-templates.ts --apply` (sanctioned scrub-aware
  propagation, not raw copy).

## Gates

- bun test: project-target-guards 12/12; test-runner-os 16/16 (K4 budget-key
  gate); agent-mechanical-date-bump 16/16; generate-version-manifest +
  render-commands 33/33; validate-templates suites 103/103 cumulative.
- validate-templates.ts: 0 errors, 43 warnings (all pre-existing soak/known).
- Full local unit suite (test-runner unit) green before PR.
- Registry parity: docs/VERSION_MANIFEST.md rows bumped for all three scripts.
