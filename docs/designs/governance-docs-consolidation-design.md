# Design: Governance Docs Consolidation (Execution Plan Boilerplate + Three-Tier Strategy)

**Date**: 2026-07-11
**Status**: Approved
**Spec ID**: 2026-07-11-governance-docs-consolidation
**Scope**: CLAUDE.md, GEMINI.md, CONSTITUTION.md, AGENTS.md

---

## 1. Problem Statement

`docs/reports/governance-docs-diet-analysis.md` (2026-07-11) found the Execution Plan boilerplate table duplicated 5 times across 4 files and the three-tier model strategy description duplicated 6 times, including two non-identical versions within `AGENTS.md` itself. Re-verifying during this design pass surfaced something more serious than duplication: **the two Execution Plan definitions actively conflict**. `CONSTITUTION.md` §5.5 states *"Always include Lifecycle Update and Final QA Audit as the final two steps"*, while `AGENTS.md` §5.1 states *"No separate Lifecycle Update or Final QA Audit rows needed — `/sync` handles both"* — the opposite rule. A PM session reading `CONSTITUTION.md` first could construct an execution plan that violates `AGENTS.md`'s actual (and more current, per its "Version History" changelog) rule.

## 2. Decision Summary

Apply the SSOT + link-out pattern already used successfully for two rules in this same document set (PM Gateway "Single Point of Entry" in `AGENTS.md` §3.1, and the 4-level enforcement table in `CONSTITUTION.md` §5.5) — a rule stated once in the file that owns it, referenced everywhere else, and NOT restated inline. `AGENTS.md` §5 and §3.6 are the designated owners, since they are the SSOT root document (`AGENTS.md` header explicitly declares itself the SSOT for "agent ecosystem, individual agent definitions, PM Gateway workflow, and execution plan templates").

## 3. Files to Change

| File | Action | Description |
|------|--------|-------------|
| `CONSTITUTION.md` §5.5 | Replace | Remove the restated Execution Plan table + its (conflicting) rules; replace with a link to `AGENTS.md#51-standard-execution-plan-template`. Keep the 4-level enforcement table (already correctly SSOT'd here) and the Enforcement Model heading unchanged. |
| `CLAUDE.md` §5 | Replace | Remove the restated Execution Plan boilerplate table; keep the Claude-specific content (model alias → registry-ID translation table, native `Agent` tool dispatch example) which is legitimately platform-specific per the diet report's own recommendation. Link to `AGENTS.md#51-standard-execution-plan-template` for the table/rules. |
| `GEMINI.md` §5 | Replace | Same treatment as `CLAUDE.md` §5, keeping Gemini/Antigravity-specific content (thinking_level parameter, model ID usage). |
| `CLAUDE.md` §5 (3-tier) | Replace | Remove the restated High/Medium/Low tier *concept* description; keep the Claude-specific model-ID mapping (`claude-opus-4-7` / `claude-sonnet-4-6` / `claude-haiku-4-5`) inline since that mapping is platform-specific, not duplicated. Link to `AGENTS.md#36-3-tier-strategy` for the concept explanation. |
| `GEMINI.md` §5 (3-tier) | Replace | Same treatment, keeping Gemini's own model-ID mapping (`gemini-3.1-pro` / `gemini-3.5-flash`) and `thinking_level` parameter notes. |
| `AGENTS.md` §4.1 (3-tier) | Replace | The second, non-identical 3-tier description inside `AGENTS.md` itself — replace with a link back to §3.6 (the earlier, canonical definition in the same file) instead of restating it a second time. |

**Explicitly NOT changed**: `AGENTS.md` §5.1 (the owning definition), §5.1.1 (exemptions, only defined once), §5.2 (platform parity considerations, only defined once), §5.3 (worked examples — these apply the template to concrete scenarios and don't restate the template's rules, so they are not duplication in the harmful sense). `docs/constitution/*.md` — the diet report found no duplication there; out of scope.

## 4. Trade-offs Considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| Leave as-is, only flag in a report (no code/doc change) | Zero risk | The active rule conflict (Lifecycle/QA rows) remains a live governance bug | Rejected — a real conflict was found, not just cosmetic duplication |
| Fully rewrite all 4 files' §5 sections from scratch | Cleanest end state | High risk of breaking cross-references, anchors, and any automated checks (`checkStaleShellReferences`, template validation) that scan these files | Rejected |
| Surgical replace: delete only the duplicated table+rules block per file, insert a link, leave everything else (headings, surrounding prose, anchors) untouched | Minimizes diff surface and risk; preserves existing anchor IDs other docs/skills may link to | Slightly less elegant than a full rewrite | **Selected** |

## 5. Cross-Platform Considerations

- Windows/Unix: no shell-script impact — pure Markdown edits.
- `CLAUDE.md` and `GEMINI.md` retain their own platform-specific model-ID tables and dispatch mechanics; only the *shared conceptual* boilerplate (table shape, tier concept) moves to `AGENTS.md`. This matches the diet report's explicit recommendation not to touch platform-specific content.

## 6. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|-----------------|
| Claude Code | Yes — `CLAUDE.md` §5 trimmed, link added | `CLAUDE.md` |
| Antigravity (GEMINI.md) | Yes — `GEMINI.md` §5 trimmed, link added, in the same commit as `CLAUDE.md` (platform parity requires both together per `AGENTS.md` §5.2) | `GEMINI.md` |
| templates/common | None — `CLAUDE.md`/`GEMINI.md`/`CONSTITUTION.md`/`AGENTS.md` at the workspace root are L0-only governance documents; `CONSTITUTION.md` is explicitly barred from `templates/common/` per its own §7.5, and `AGENTS.md`/`CLAUDE.md`/`GEMINI.md` root copies are not template-propagated content | N/A |

## 7. Acceptance Criteria

- [ ] The Lifecycle/QA-rows rule conflict between `CONSTITUTION.md` and `AGENTS.md` no longer exists — only one statement of that rule remains, in `AGENTS.md` §5.1.
- [ ] `CLAUDE.md`, `GEMINI.md`, `CONSTITUTION.md` each link to `AGENTS.md#51-standard-execution-plan-template` instead of restating the table.
- [ ] `CLAUDE.md`, `GEMINI.md` link to `AGENTS.md#36-3-tier-strategy` for the tier concept, retaining only their own model-ID mapping tables locally.
- [ ] `AGENTS.md` §4.1 no longer restates the 3-tier concept a second time within the same file.
- [ ] `bun scripts/audit.ts` passes with no new failures after the edit.
- [ ] All existing anchor links elsewhere in the repo that point into the edited sections (e.g. `CLAUDE.md#5-agent-dispatch-rules`, `CLAUDE.md#6-native-sub-agents-agent-tool`) still resolve — headings that are link targets are preserved even where their body content is trimmed.

## 8. Open Questions

None — this is a same-session follow-up to the diet-analysis report, with the additional conflict finding surfacing during design and being folded into the same fix rather than requiring separate user sign-off, since it's strictly a bug-fix within the already-approved consolidation scope.
