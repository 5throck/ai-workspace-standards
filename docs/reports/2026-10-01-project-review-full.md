# Project Review — workspace root — 2026-10-01

**Date**: 2026-10-01
**Scope**: workspace root, full (4 parallel agents + machine battery)
**Method**: rev-A (Architecture+Scaffolding) · rev-B (Standards+Lifecycle) · rev-C (Automation) · rev-D (Docs+Security), all read-only, plus `review-baseline.ts`

## Baseline

audit.ts PASS · validate-templates 0/0 · verify-scripts PASS · agent-lifecycle-audit PASS · skill-lifecycle-audit PASS · L1↔L2 drift: tolerated class only (gemini-settings family, documented) — **6/6 green**.

## Cross-review corrections (PM adjudication)

- rev-A/rev-D "ADR-0095 swap incomplete (4 projects dangling)" is **stale**: based on local disk where pulls are blocked by another session's uncommitted work. Remote mains verified 13/13 valid (11 resolvable + 2 inlined) via `git show origin/main:agents/pm.md`. Not a finding.
- The 4 failing tests in the unit sweep (`tests/unit/team-gateway-*.test.ts`) are another session's untracked in-flight work in the shared checkout (imports `services/team-gateway/` which does not exist here). Not part of any review-scope commit; left untouched.

## 🔴 Critical (fix immediately)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| C1 | 4 untracked test files import a nonexistent module (`services/team-gateway/src/*`); fail every full-suite run | rev-B | tests/unit/team-gateway-{server,jsonl,tenant,anthropic}.test.ts | one-time | Other session's in-flight work — service source must land in the same batch, or the files get deleted. NOT actionable by this session (shared-checkout ownership); recorded here so the next sweep does not re-discover it. |

## 🟡 High (fix within 1 week)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | `git ls-files` spawned without `cwd` in the manifest generator: invocation from any subdirectory silently fails `trackedFilterForRoot` open and corrupts the drift gate (verified experimentally) | rev-C | scripts/generate-version-manifest.ts:258,290-302 | script-gap | Fix now: resolve repo root once (`git rev-parse --show-toplevel`) and pass `cwd` to every git spawn + regression test |
| H2 | Both 2026-10-01 design docs are `draft` in docs/specs/registry.json while their implementations/ADRs landed (upgrade-policy 1.20.0, ci-workflow-merge 1.0.0, ADR-0094/0095 Accepted+linked) | rev-B | docs/specs/registry.json:1769,1778 | one-time | Fix now: spec-register status implemented / decided |
| H3 | 7 approved specs linger >14 days without progression (oldest 2026-06-02, 4 months); one entry has created≠id-date anomaly | rev-B | docs/specs/registry.json | systemic | Ticket: weekly-hygiene sweep for approved>14d specs |
| H4 | SUPERSEDED banner asserts the opposite of ADR-0095 ("premise was wrong / correct L1 pointer" vs ADR-0095 ruling that form invalid); T-20261001-003 result text persists the old framing on a done ticket | rev-D | docs/designs/2026-09-30-pm-extends-pointer-retarget-design.md:3-10; tickets/governance/T-20261001-003.yaml:8,24-29 | one-time | Fix now: amend banner to cite ADR-0095 as final ruling; append correction line to the ticket result |
| H5 | ADR-0094 rollout pacing deviates from its own text: PR-C (default-on) landed before the fleet resynced PR-B (only co-newbiz carries PROJECT-JOBS markers). Mitigated: the job self-skips without `test:unit` | rev-A | docs/adr/0094 (Rollout section) | one-time | Fix now: one-line ADR-0094 amendment recording the compression and its mitigation |

## 🟢 Moderate (fix within 2 weeks)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | ticket-store sequence guess truncates 4-digit IDs to 3 digits (regex allows \d{3,4}; self-corrects via collision check but wastes scans) | rev-C | scripts/helpers/ticket-store.ts:110 | script-gap | Fix now with H1 (trivial parse fix + test) |
| M2 | `audit`/`secret-scan` CI jobs lack `timeout-minutes` (unit-tests has 15) — a hung job burns the 6h default | rev-C | templates/common/.github/workflows/ci.yml:13-34,36-51 | systemic | Fix now: add timeout-minutes 15 |
| M3 | gitleaks runs via mutable tag `docker://ghcr.io/gitleaks/gitleaks:v8.28.0` (only unpinned action) | rev-C+D | templates/common/.github/workflows/ci.yml:49 | systemic | Fix now: pin digest |
| M4 | audit/secret-scan checkouts omit `persist-credentials: false` (only unit-tests sets it) | rev-D | templates/common/.github/workflows/ci.yml:17,40 | systemic | Fix now: add to all checkouts |
| M5 | service-ticket gitignore rule documented only in 2026-07-16 design docs, not in ticket-run/SKILL.md or AGENTS.md §3.7.5 | rev-B | skills/ticket-run/SKILL.md; AGENTS.md | systemic | Ticket: one-line doc addition |
| M6 | Hygiene backlog: 2 hook test files lack @version; 69 versioned scripts lack lifecycle records (opt-in); 5 pre-0040 ADRs have unparseable dates | rev-B | hooks/, docs/lifecycle/scripts/, docs/adr/0033-0040 | systemic | Ticket (low): ADR date frontmatter fix |

## ℹ️ Accepted-as-is (recorded)

- `bun install --frozen-lockfile` on PR-modified lockfiles: standard CI risk, mitigated (contents:read, pull_request-only, persist-credentials false, trigger denylist enforced in ci-workflow-merge) — rev-C, accepted in writing.
- 12 of 13 Projects carry the pre-fix `procedure-schema-spec.md` dangling link — expected pre-resync; template fixed (#1274), collected on next upgrade.

## ✅ Strengths

- ADR-0094↔implementation full match incl. the MERGE pass list-vs-set agreement test; fail-closed atomic write with read-back revalidation; block-scalar marker masking; CRLF preservation (rev-A/rev-C).
- No fork-model violations in today's landed work; fresh scaffolds cannot reproduce the L3 dangling state (rev-A).
- ADR-0094/0095 house-style + CONSTITUTION linkage; all 349 governance tickets done with results; today's script versions match SCRIPTS.md exactly (rev-A/rev-B).
- gitleaks clean over 1632 commits; docs link validator exit 0; zero Hangul in new governance docs (rev-D).
- Machine baseline 6/6 green at review time.

## Action wiring

- Fix-now batch (one /sync PR): H1+M1, H2, H4, H5, M2+M3+M4 — dispatched to automation-engineer (haiku).
- Tickets: T-20261001-011 (validator-hardening: H3 stale-spec sweep), T-20261001-012 (M5 gitignore doc line), T-20261001-013 (M6 ADR date fixes, low).
- No-route: C1 (other session's WIP — recorded), stale swap observation (adjudicated stale).

## Verification

Post-fix batch (same session):
- H1: `resolveRepoRoot()` anchors every git spawn (regression test proves subdir invocation now matches root; deviation note — anchored at process.cwd(), not import.meta.dir, because the latter resolves the L0 script's repo, not the walked tree). M1: full-digit-run parse + 4-digit-id test.
- Spot checks: targeted suites 53 pass / 0 fail; audit.ts 0 FAIL; gitleaks digest-pinned (sha256:cdbb…a854, multi-arch index for v8.28.0); timeout-minutes 15 on all three jobs; registry shows ci-template-design [implemented], l3-pm-stub-design [approved].
- C1 update: the user confirmed `services/team-gateway` was renamed into `services/co-workspace`; the 4 test files' imports were repointed this session (9 imports) — module-resolution errors gone. The remaining 10 behavioral failures in those files (stale API expectations: variant allowlist, session status code) belong to the owning session's in-flight work and are excluded from this review's scope.
- Tickets wired: T-20261001-011 (validator-hardening: stale-approved-spec sweep, normal), T-20261001-012 (service-ticket gitignore doc, low), T-20261001-013 (ADR date frontmatter, low).
- Ratchet note: H1+M1 closed with standing regression tests (found-by-agent → caught-by-script for the cwd and ID-width classes); H3's standing check is ticketed as the weekly sweep.

