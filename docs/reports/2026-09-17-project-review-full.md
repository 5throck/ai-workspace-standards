# Project Review — workspace root — 2026-09-17

**Date**: 2026-09-17
**Scope**: workspace root (full — T-01 user request, PM-led remediation requested)
**Method**: 4 parallel agents (Architecture+Scaffolding / Standards+Lifecycle / Automation / Documentation+Security) + machine battery

## Baseline (Step 0)

`bun scripts/review-baseline.ts`: **6/6 green** — audit.ts ✅ · validate-templates ✅ · verify-scripts ✅ · agent-lifecycle-audit ✅ · skill-lifecycle-audit ✅ · propagate-to-templates --check-drift exit 1 (documented tolerated `gemini-settings` class only).

## Review Results

Findings deduplicated across slots (A4≡C2 same root cause); discoverers credited. Severity: 🔴 Critical (fix immediately) · 🟡 High (≤1 week) · 🟢 Moderate (≤2 weeks).

### 🔴 Critical

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| 1 | CRLF-fragile tier regex `^tier:[ \t]*\n` — on Windows checkouts tier silently parses `N/A`, regenerating a manifest that drifts from the committed one (the exact 2026-09-16 fleet-sync failure mode) | C | scripts/generate-version-manifest.ts:119 | script-gap (parser has zero CRLF tests) | Fix regex to `\r?\n` + CRLF unit test |
| 2 | `templates/co-price/.gitignore` corrupt: UTF-8 BOM, unkeyed block marker, wrong close marker (`END WORKSPACE-MANAGED` vs lib's `/WORKSPACE-MANAGED`), em-dash mojibake, missing `!.env.sample`, missing `.zcode/`, `/graft/`, `tests/.temp/` entries — upgrades/scaffolds of co-price hit the append branch and duplicate the secrets block | A | templates/co-price/.gitignore:1,64 | script-gap (no structure/parity arm covers .gitignore) | Replace with common block + variant entries outside; parity arm ticketed |
| 3 | Managed-block parity enforced for AGENTS.md only while `MERGE_MANAGED_FILES` covers CLAUDE.md/GEMINI.md/.gitignore/agents/pm.md — same silent-drift failure mode everywhere else | A | scripts/lib/upgrade-policy.ts:144, scripts/validate-templates.ts:3556-3606 | script-gap | Validator-hardening ticket (TH-01) |

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| 4 | `findInsertionPosition` interpolates block key into RegExp unescaped — metacharacter key crashes upgrade-project mid-run or mis-anchors insertion | C+A | scripts/lib/managed-block-merge.ts:179 | systemic | Escape key (fixed this session) |
| 5 | gitleaks invocation passes two empty-string argv args when `.gitleaks.toml` absent — can silently downgrade to regex fallback on the every-commit hot path | C | scripts/hooks/pre-commit.ts:325 | one-time | Conditional args array (fixed) |
| 6 | Dead conflict-marker branch: outer condition tests `=======` but inner exit path excludes it — outer test is noise | C | scripts/hooks/pre-commit.ts:103-108 | one-time | Drop `=======` from outer (fixed) |
| 7 | dev-sync does not detect a pre-existing merge-in-progress (`.git/MERGE_HEAD`) — `git add -A` can stage unresolved conflicts blindly | C | scripts/dev-sync.ts (~step 6) | systemic | MERGE_HEAD pre-check (fixed) |
| 8 | Dangling "ADR-0073 Amendment 2" reference — the amendment is recorded inside ADR-0074's Decision section, not in ADR-0073; the citation is unresolvable as written | B | CONSTITUTION.md:155 | systemic — script-gap | Point at the recording ADR (fixed); reference-validation ticketed (TH-02) |
| 9 | Broken link in Korean README: `docs/countries/KR.md` does not exist at root (EN twin uses `templates/co-news/docs/countries/KR.md`); country-profiles link dropped | D | README_ko.md:39 | one-time | Mirror EN links (fixed) |

### 🟢 Moderate

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| 10 | New remediation-wave scripts have no `docs/lifecycle/scripts/` records; Check H cannot flag "significant new lib without a record" | B | docs/lifecycle/scripts/ | by-design gap | Ticket (TH-04) |
| 11 | Ticket `attempts:` always 0 while `history:` shows transitions — semantics undefined/unmaintained | B | tickets/governance/*.yaml | systemic — script-gap | Ticket (TH-03) |
| 12 | CHANGELOG `## [Unreleased]` backlog since 2026-09-04 is very large; release cut overdue | B | CHANGELOG.md:9 | one-time | Ticket (chore) |
| 13 | Pre-commit CHANGELOG rewrite rewrites file even when content unchanged (EOL round-trip risk) | C | scripts/hooks/pre-commit.ts:61-71 | one-time | No-change guard (fixed) |
| 14 | `extractSkillVersion` BOM blind spot silently skips a skill from freshness arm | C | scripts/lib/platform-mirror-freshness.ts:44 | one-time | BOM strip (fixed) |
| 15 | pre-push SHA guards hardcode 40-hex; SHA-256 repos would silently skip diff scoping (ZERO_OID_RE already handles 64) | C | scripts/hooks/pre-push.ts:64,65,79,105 | one-time | `{40,64}` (fixed) |
| 16 | `VARIANT_OVERLAY_SKIP` is a one-element hand list guarding common-owned files — co-price's divergent .gitignore overlays common because nothing derives the list from a contract | A | scripts/new-project.ts:651 | systemic | Ticket (design) |
| 17 | Unlabeled-block reconcile replaces project content on count mismatch with only a WARNING — no snapshot beside git-only recovery | A | scripts/lib/managed-block-merge.ts:283-298 | systemic | Ticket (design) |
| 18 | AGENTS.md §6.6 cross-reference points at a differently-titled heading (Session-Evidence loop is unnumbered in 06-skill-lifecycle.md) | D | AGENTS.md:671 | systemic | Reference heading by title (fixed) |
| 19 | `fetch-depth: 0` requirement of the VERSION_MANIFEST gate documented only inline in ci.yml — next CI "optimization" can reintroduce PR #945's bug | D | templates/common/.github/workflows/ci.yml:17-22 | systemic | Note added at gate docs (fixed) |

### ℹ️ Low / Improvements

| # | Issue | Agent | Class | Wiring |
|---|-------|-------|-------|--------|
| 20 | co-hr / co-safety ship no `.gitignore` (benign — common delivers); 11 redundant variant copies are drift fuel | A | instance | Ticket (chore) |
| 21 | common `.gitignore` SSOT block carries duplicate `dist/` and `nul`/`NUL` entries — noise propagates to every scaffold | A | instance | Deduped this session |

### ✅ Strengths (verified across slots)

- SCRIPTS.md ↔ disk (179 rows), VERSION_MANIFEST ↔ disk (93/8/51), specs registry ↔ designs (108) — all exact matches; governance §-references and constitution anchors resolve (except #8/#18).
- Secrets hygiene clean (27 new tickets + all new design docs: zero hits); language policy holds; CI least-privilege with SHA-pinned actions; no `pull_request_target`; fork-PR guard in test.yml.
- managed-block-merge.ts (T-20260916-012 fix), pre-push.ts v1.4.0, dev-sync v1.14.0 fail-closed work verified sound; L0↔L1 mirrors of scaffold-markers.ts / managed-block-parity.ts byte-identical; remediation-wave test coverage generally good.

## Action wiring (Step 5)

**Fixed this session** (PM-dispatched, executed in-session; findings 1, 2, 4, 5, 6, 7, 8, 9, 13, 14, 15, 18, 19, 21): see `## Verification`.

**Tickets created** (`bun scripts/ticket.ts create --manual`):

| ID | Title | Priority |
|----|-------|----------|
| T-20260917-001 | validator-hardening: extend managed-block parity arm to all MERGE_MANAGED files (CLAUDE.md, GEMINI.md, .gitignore, agents/pm.md) | high |
| T-20260917-002 | validator-hardening: validate ADR amendment references resolve to a real heading | normal |
| T-20260917-003 | validator-hardening: validate ticket attempts field against history transitions or drop it | normal |
| T-20260917-004 | validator-hardening: warn when a versioned script lacks a lifecycle record | normal |
| T-20260917-005 | design: derive VARIANT_OVERLAY_SKIP from upgrade-policy classifications instead of a hand list | normal |
| T-20260917-006 | design: snapshot replaced unlabeled managed-block spans before reconcile | normal |
| T-20260917-007 | chore: cut CHANGELOG release or split Unreleased per Keep-a-Changelog | low |
| T-20260917-008 | chore: delete variant .gitignore copies byte-identical to common | low |

## Verification (Step 6)

Fixes applied 2026-09-17 (design: `docs/designs/2026-09-17-project-review-remediations-design.md`, spec `2026-09-17-project-review-remediations-design` — implemented):

- **#1 (CRLF tier regex)**: `parseAgentFrontmatter` normalizes CRLF before matching; exported for tests. 3 new unit tests (LF / CRLF / missing-tier) in `tests/unit/generate-version-manifest.test.ts`. v1.6.0 → v1.6.1.
- **#2 (co-price .gitignore)**: rewritten — keyed common managed block, correct `/WORKSPACE-MANAGED` close, no BOM, `!.env.sample` + fleet entries restored; variant entries (`tmp/`, `src/generated/`, `scratch/`, `tsconfig.tsbuildinfo`) preserved outside the block.
- **#21 (common .gitignore)**: duplicate `dist/` (Node.js section) and `nul`/`NUL` (OS artifacts section) removed; mirrored into the co-price rewrite.
- **#4 (unescaped key)**: `findInsertionPosition` escapes the key before RegExp construction. managed-block-merge.ts v1.0.0 → v1.0.1.
- **#5 (gitleaks empty args)**: argv array built conditionally and interpolated as a list. pre-commit.ts v1.7.0 → v1.7.1.
- **#6 (dead `=======` branch)**: outer condition narrowed to the opening/closing markers (setext underline stays legal).
- **#7 (merge-in-progress)**: dev-sync v1.14.1 aborts fail-closed on `.git/MERGE_HEAD` before staging.
- **#8 (ADR-0073 Amendment 2)**: CONSTITUTION.md now points the citation at its recording location (ADR-0074, Decision ¶2).
- **#9 (README_ko link)**: KR-profile and country-profiles links now mirror the English README's resolvable paths.
- **#13 (CHANGELOG rewrite)**: hook writes only when the rewritten content differs.
- **#14 (BOM blind spot)**: `extractSkillVersion` strips a UTF-8 BOM before matching. platform-mirror-freshness.ts v1.0.0 → v1.0.1.
- **#15 (SHA-256 guards)**: pre-push.ts hex allowlists widened to `{40,64}` (v1.4.0 → v1.4.1).
- **#18 (§6.6 label)**: AGENTS.md §10 step 1.5 now cites the real heading title ("Session-Evidence Skill Review Loop (Observation-Based Revision)", 06-skill-lifecycle.md:347).
- **#19 (fetch-depth note)**: covered by generate-version-manifest v1.6.1 header + the pre-existing T-20260916-013 shallow-tolerance docs; CI workflow already carries the inline rationale.
- L0→L1 mirrors re-propagated (`propagate:apply`, 46 files); SCRIPTS.md + L1 mirror versions bumped in lockstep (Check A clean).

**Post-fix validation**: `bun scripts/review-baseline.ts` **6/6 green** · targeted unit tests **46 pass / 0 fail** (`generate-version-manifest`, `managed-block-merge`, `pre-push-deletion-detection`).
