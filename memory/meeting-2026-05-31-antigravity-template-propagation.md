# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Antigravity Template Propagation — Full Re-review Including .gemini/ Structure, settings.json Hooks, and Platform-Specific Gaps
**Participants**: architect, automation-engineer, security-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete
**Extends**: meeting-2026-05-31-template-propagation-gap.md (adds Antigravity platform analysis)

---

## Key Discovery: Antigravity Uses .gemini/, Not .claude/

When a project is created with `-platform antigravity`:
- CLAUDE.md is deleted
- `.claude/` directory remains (but Antigravity does NOT read it)
- `.gemini/` is the sole operational directory for Antigravity

All `.claude/commands/` and `.claude/skills/` files created this session are invisible to Antigravity.

---

## Critical Security Gap: .gemini/settings.json SessionStart Hook Missing from Templates

| | Root | templates/common/.gemini/ | Generated Project |
|---|:----:|:-------------------------:|:-----------------:|
| SessionStart hook (git config core.hooksPath) | ✅ | ❌ NOT FOUND | ❌ |
| codegraph MCP | ✅ | N/A | ✅ (via variant) |

**Impact**: A developer who clones a generated project and uses Gemini CLI or Antigravity will NOT have `.githooks/` activated. The pre-commit `SYNC_ACTIVE` check, gitleaks scan, and pre-push audit are all bypassed until `git config core.hooksPath .githooks` is manually run.

**Root cause**: `templates/common/.gemini/settings.json` does not exist. Variant `.gemini/settings.json` files (co-develop, co-design, co-work, co-security) only contain codegraph MCP config — no SessionStart hook. JSON deep-merge does not happen during scaffolding (variant overwrites common).

**Fix**: Add SessionStart hook to each of the 4 variant `.gemini/settings.json` files.

---

## Full Platform Propagation Gap Map

| Gap | Claude | Gemini | Antigravity | Generated Project |
|----|:------:|:------:|:-----------:|:-----------------:|
| `commit-push-pr` redirect command | ✅ `.claude/` | ❌ | ❌ | ❌ |
| `finishing-a-branch` override skill | ✅ `.claude/skills/` | ❌ | ❌ | ❌ |
| SessionStart `.githooks` reconfiguration | ✅ | ⚠️ root only | ⚠️ root only | ❌ broken on clone |
| `.gemini/skills/` common skills | N/A | ✅ root | ✅ root | ❌ not propagated |
| `run_command` git prohibition | N/A | ✅ (this session) | ✅ (this session) | unconfirmed |
| `invoke_subagent` commit prohibition | N/A | ✅ (this session) | ✅ (this session) | unconfirmed |

---

## Transcript

**[Architect]**: (Round 1)

Platform directory mapping: Claude Code uses .claude/, Gemini CLI and Antigravity use .gemini/. When -platform antigravity: CLAUDE.md deleted, .claude/ remains but is not read. All commit-push-pr.md and finishing-a-development-branch/SKILL.md created in .claude/ this session are invisible to Antigravity.

New finding: root .gemini/settings.json has SessionStart hook; templates/common/.gemini/settings.json does not exist; variant .gemini/settings.json files only have codegraph MCP. Generated projects lack SessionStart hook in .gemini/ — cloned repositories will have .githooks/ disabled for Gemini/Antigravity sessions.

**[Automation Engineer]**: (Round 1)

Clone scenario: Claude Code session → .claude/settings.json SessionStart re-runs git config → hooks activated. Gemini/Antigravity session → no SessionStart → .githooks/ disabled → direct git commit succeeds without SYNC_ACTIVE check, gitleaks, or pre-push audit. Security gap confirmed.

variant .gemini/settings.json overwrites common during scaffolding (no JSON merge). Fix: add SessionStart to each of the 4 variant .gemini/settings.json files directly.

**[Security Expert]**: (Round 1)

Risk assessment: Gemini/Antigravity user who clones a generated project can issue direct git commit with full hook bypass (including gitleaks). Severity: medium — requires clone + Gemini/Antigravity usage + AI attempting direct commit. Mitigation: GEMINI.md has SYNC_ACTIVE explanation (added this session). Fix: SessionStart hook in variant .gemini/settings.json.

**[Auditor]**: (Round 1)

Confirmed: JSON deep-merge does not occur during scaffolding. Settings.json propagation gap affects all 4 variants. Additionally, root .gemini/skills/ (11 skills) not in templates/common/.gemini/skills/ — generated projects don't receive common Gemini skills.

**[Architect]**: (Round 2)

Decisions: (1) Add SessionStart to 4 variant .gemini/settings.json (Option 1 — direct, no merge logic needed). (2) Create .gemini/commands/commit-push-pr.md at root for Gemini/Antigravity redirect. (3) Propagate to templates/common/.gemini/commands/. (4) Create .gemini/skills/finishing-a-development-branch/ at root and propagate to common. (5) Check P-02 must cover .gemini/ as well as .claude/.

**[Automation Engineer]**: (Round 2)

Check P-02 scope expanded: must check root ↔ common for both .claude/commands/ and .gemini/commands/. Current A-03 spec was .claude/ only — needs update.

---

## Final Integrated Action Items

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| **Security (immediate)** | | | | |
| B-01 | automation-engineer | Medium | Add SessionStart hook (`git config core.hooksPath .githooks`) to all 4 variant `.gemini/settings.json` files | High |
| **Gemini/Antigravity redirect** | | | | |
| B-02 | automation-engineer | Low | Create `.gemini/commands/commit-push-pr.md` at root (Gemini/Antigravity /sync redirect) | High |
| B-03 | automation-engineer | Low | Create `templates/common/.gemini/commands/commit-push-pr.md` (propagation to generated projects) | High |
| B-04 | automation-engineer | Low | Create `.gemini/skills/finishing-a-development-branch/SKILL.md` at root | Medium |
| B-05 | automation-engineer | Low | Create `templates/common/.gemini/skills/finishing-a-development-branch/SKILL.md` | Medium |
| **From prior meeting (template propagation gap)** | | | | |
| A-01 | automation-engineer | Low | `templates/common/.claude/commands/commit-push-pr.md` | High |
| A-02 | automation-engineer | Low | `templates/common/.claude/skills/finishing-a-development-branch/SKILL.md` | High |
| A-03 | automation-engineer | Medium | `validate-templates.ts` Check P-02: root ↔ common parity for BOTH `.claude/commands/` AND `.gemini/commands/` | Medium |
| A-04 | docs-writer | Low | CLAUDE.md + GEMINI.md §9: add lifecycle rows for `.claude/commands/`, `.claude/skills/`, `.gemini/commands/`, `.gemini/skills/` | Medium |
| A-05 | automation-engineer | Low | Register `commit-push-pr` in `common-contract.json` | Low |

## Execution Order
1. B-01 (security — immediate)
2. B-02~B-05, A-01~A-02 (parallel)
3. A-03~A-05 (sequential)

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | All 4 variant .gemini/settings.json contain SessionStart hook | Read each file |
| C-02 | `.gemini/commands/commit-push-pr.md` exists at root and in templates/common | File check |
| C-03 | `.gemini/skills/finishing-a-development-branch/SKILL.md` exists at root and in templates/common | File check |
| C-04 | `templates/common/.claude/commands/commit-push-pr.md` exists | File check |
| C-05 | `templates/common/.claude/skills/finishing-a-development-branch/SKILL.md` exists | File check |
| C-06 | validate-templates.ts Check P-02 covers both .claude/ and .gemini/ | Run validate-templates |
| C-07 | Generated project (fresh clone simulation) has .githooks/ activated for Gemini session | Manual test |
| C-08 | bun scripts/audit.ts passes | Run audit |
