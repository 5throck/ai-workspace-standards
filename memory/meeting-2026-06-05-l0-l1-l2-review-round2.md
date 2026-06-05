# Meeting Transcript — Round 2
**Date**: 2026-06-05
**Topic**: Unresolved Items Resolution — U-01 through U-05
**Participants**: architect, auditor, automation-engineer, scaffolding-expert, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

This is the second meeting following the L0/L1/L2 project review. First meeting left 5 unresolved items (U-01~U-05) requiring further investigation or ADR decisions.

Pre-meeting PM discovery: `common-contract.json` `common_skills` source fields point to `skills/<name>/SKILL.md` (project skills), not `.claude/skills/` (platform skills). This informed the U-01 discussion.

---

## Transcript

### Round 1

**auditor** (Round 1):
Shared PM's pre-meeting finding: all `common_skills` entries have `source: "skills/<name>/SKILL.md"` — these are project skills, not platform skills. WS-03 check is likely checking `skills/` not `.claude/skills/`. Confirmed co-design/co-develop/co-security/co-work each have only `agent-lifecycle-manager` in their `skills/` directory. Asked automation-engineer to confirm WS-03 code path.

**automation-engineer** (Round 1):
Confirmed WS-03 checks `templates/<variant>/skills/<name>/` — the `skills/` directory, not `.claude/skills/`. The 1st meeting report confusion about `.claude/skills/` was a `--check-drift` output interpretation error. Confirmed 4 variants each have only `agent-lifecycle-manager` in `skills/`. Asked scaffolding-expert to clarify whether 1st meeting findings were `skills/` or `.claude/skills/` basis.

**scaffolding-expert** (Round 1):
Confirmed: 1st meeting findings were `skills/` basis. 4 variants confirmed to have only `agent-lifecycle-manager/` in `skills/`. Clarified that `overridable: false` may mean "cannot be overridden" not "must physically exist." Asked architect whether common_skills are designed for runtime injection or physical copy at scaffold time.

**architect** (Round 1):
Clarified original design: common_skills should be physically copied from `templates/common/skills/` to L2 `skills/` at scaffold time. `create-l2-scaffold.ts` `overlayItems` includes `skills/`. The absence of 7 skills in 4 variants indicates they were scaffolded before those skills were added to L1 — same pattern as C-2 (helpers). Concluded: **H-1 is propagation gap, not design flaw**. Proposed M-3 solution: `.tmpl` extension files in `templates/common/` to avoid Check 9 conflict. Asked auditor if `.tmpl` approach conflicts with Check 9.

**auditor** (Round 1):
Agreed with architect's U-01 conclusion. Confirmed `overridable: false` = override governance rule, not physical presence guarantee. Confirmed `.tmpl` extension doesn't conflict with Check 9 (which forbids `CLAUDE.md`, `GEMINI.md`, `CONSTITUTION.md` by exact filename). Raised U-04: suggested two-phase approach — immediately add `.gemini/commands/security-check.md` to affected variants, then design `variant_commands` section in `common-contract.json` separately. Asked lifecycle-manager if adding variant-level commands triggers lifecycle tracking.

**lifecycle-manager** (Round 1):
Confirmed variant-level commands are not tracked by `verify-platform-lifecycle.ts` Check G (which only tracks L0 `.claude/commands/` → `templates/common/` propagation). This absence of tracking is exactly the U-04 governance gap. Proposed U-03 solution: use SCRIPTS.md `Layer` column as SSOT for `common_scripts` section, avoiding duplicate data. Asked automation-engineer to confirm Layer column completeness.

---

### Round 2

**automation-engineer** (Round 2):
Confirmed SCRIPTS.md Layer column uses values `L0`, `L0+L1`, `L0+L1+L2` — all 86 scripts have this column populated. Confirmed `common-contract.json` pointer approach is feasible and does not require ADR — Medium document update. Proposed Check 10 implementation: replace `fs.readdirSync` with recursive variant to cover `helpers/`. Proposed `lib/` severity upgrade from WARN to ERROR. Preferred `_CLAUDE.md.template` naming over `.tmpl` for visual clarity.

**scaffolding-expert** (Round 2):
Agreed on `_CLAUDE.md.template` naming (consistent with 1st meeting proposal). Confirmed U-01 fix is one-time propagation recovery — not Fork Model violation. Confirmed `create-l2-scaffold.ts` `overlayItems` already includes `skills/` so new scaffolds are automatically correct; only existing 5 variants need manual sync. Agreed U-04 two-phase approach. Asked architect whether M-3 requires ADR.

**architect** (Round 2):
Confirmed M-3 does NOT require ADR since `_CLAUDE.md.template` doesn't modify Check 9. Document intent in `create-l2-scaffold.ts` comments instead. Summarized all U-01~U-05 decisions.

**auditor** (Synthesis):
All 5 unresolved items resolved. See Action Items below.

---

## Decisions

| Item | Decision | Rationale |
|------|----------|-----------|
| U-01 (H-1) | Propagation gap — include `skills/` sync in A-02 | `overridable: false` = governance rule, not physical guarantee |
| U-02 (M-3) | `_CLAUDE.md.template` + `_GEMINI.md.template` in `templates/common/` | `.template` suffix avoids Check 9 conflict; no ADR needed |
| U-03 (M-4) | SCRIPTS.md Layer column pointer in `common-contract.json` | Avoids duplicate data; Layer column already complete for all 86 scripts |
| U-04 (H-2) | Immediately add `.gemini/commands/security-check.md` to co-develop and co-security | `variant_commands` governance section is separate follow-up |
| U-05 | Check 10 recursive expansion + `lib/` severity upgrade to ERROR | Closes the helpers/ and lib/ drift detection gap |

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| B-01 | automation-engineer | Low | Extend A-02 to include `skills/` sync: copy 7 common_skills from `templates/common/skills/` to all 5 L2 variant `skills/` directories | L0-only | 4 |
| B-02 | automation-engineer | Low | Add `_CLAUDE.md.template` + `_GEMINI.md.template` to `templates/common/`; add processing logic to `create-l2-scaffold.ts` overlayItems | Both | 4 |
| B-03 | automation-engineer | Low | Add `common_scripts` pointer section to `common-contract.json` referencing SCRIPTS.md Layer column | L0-only | 4 |
| B-04 | automation-engineer | Low | Add `.gemini/commands/security-check.md` to `templates/co-develop/` and `templates/co-security/` | Both | 4 |
| B-05 | automation-engineer | Low | Extend `validate-templates.ts` Check 10 to recursively cover `scripts/helpers/`; upgrade `scripts/lib/` drift to ERROR severity | L0-only | 4 |

## Open Items

None. All U-01 through U-05 resolved.
