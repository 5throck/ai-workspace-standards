# Meeting Transcript
**Date**: 2026-06-06
**Topic**: SKILLS.md Registry Introduction — Design and Feasibility Review
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Background

User proposed that skills need a centralized registry similar to SCRIPTS.md. Current state:
- SCRIPTS.md: rich registry with `script | source | version | status | removal-date | security-advisory | layer | pair` columns, machine-parseable by `verify-scripts.ts`
- Skills: metadata scattered in individual SKILL.md frontmatter, no central registry, no `layer` column, some frontmatter inconsistencies found (duplicate status fields, missing last_reviewed)

---

## Transcript

### Round 1

**architect** (Round 1):
Strongly supported the idea. Identified core problem: skill governance SSOT is distributed across individual SKILL.md files. `publish-to-template.ts` directly parses SKILL.md for `scope`, `skill-lifecycle-audit.ts` iterates each file. This is exactly the pre-SCRIPTS.md state of script management. SKILLS.md would solve: Layer/scope centralization, version tracking at a glance, deprecation tracking, machine-parseable single source. Noted skills differ from scripts (directory structure vs single file). Asked automation-engineer how publish-to-template.ts currently reads skill scope.

**automation-engineer** (Round 1):
Confirmed publish-to-template.ts directly parses SKILL.md frontmatter (regex match on `scope:` field). Problems: silent fallback to `common` when scope missing (root cause of create-variant misclassification), no `layer` field support for L0+L1 vs L0+L1+L2 distinction, three tools independently parse SKILL.md. SKILLS.md would allow `parseSkillLayers()` helper — identical pattern to existing `parseScriptLayers()`. Asked lifecycle-manager how skill-lifecycle-audit.ts would change with SKILLS.md.

**lifecycle-manager** (Round 1):
Described current skill-lifecycle-audit.ts behavior (iterate SKILL.md files, check frontmatter). With SKILLS.md: registry row parsing replaces file iteration, adds SKILLS.md vs directory drift detection, faster execution. Existing issues that SKILLS.md would have caught: duplicate `status: active` in skill-lifecycle-manager (5 occurrences), missing `last_reviewed` in team-builder and translate. Asked auditor about boundary with `common-contract.json`.

**auditor** (Round 1):
Defined clear boundary: SKILLS.md = "what exists + what state" (lifecycle SSOT); `common-contract.json` = "what is provided to L2 and override rules" (distribution governance). Not duplicate — complementary. `publish-to-template.ts` reads SKILLS.md layer column for propagation decisions; `validate-templates.ts` reads `common-contract.json` for L2 variant skill presence validation. Proposed adding `gemini-parity` column analogous to SCRIPTS.md `pair` column.

---

### Round 2

**architect** (Round 2):
Confirmed role boundary for ADR C-01. Accepted auditor's boundary proposal. Proposed SKILLS.md column design:
`| skill | version | status | layer | owner | last_reviewed | removal-date | notes |`
Layer values: `L0` / `L0+L1` / `L0+L1+L2` — same as script Layer system. Excluded `source` (always `skills/<name>/SKILL.md`) and `security-advisory` (rare for skills). Asked automation-engineer about drift validation strategy between SKILL.md frontmatter and SKILLS.md.

**automation-engineer** (Round 2):
Proposed adding Check E to `lifecycle-sync-audit.ts`: compare SKILL.md frontmatter version vs SKILLS.md version column, ERROR on mismatch. Key distinction: SKILLS.md becomes SSOT for `layer` (scope decision), but SKILL.md `scope` field remains for human readability. Migration strategy: parallel dual-source reading with WARN during transition → SKILLS.md-only after stabilization. Asked lifecycle-manager which tool should be primary SKILLS.md parser entry point.

**lifecycle-manager** (Round 2):
Proposed tool role separation mirroring SCRIPTS.md pattern:
- `verify-skills.ts`: fast check — physical existence + SKILLS.md ↔ skills/ directory match (pre-commit)
- `skill-lifecycle-audit.ts`: deep check — SKILLS.md vs SKILL.md frontmatter drift Check E, last_reviewed validity, deprecated removal-date tracking (CI/sync)
Defined scope: SKILLS.md covers `skills/` project skills (15) only. `.claude/skills/` platform skills remain under `verify-platform-lifecycle.ts`.

**auditor** (Synthesis):
See Action Items below.

---

## Decisions

| Item | Decision |
|------|----------|
| SKILLS.md introduction | Approved — create central lifecycle registry for project skills |
| Column design | `skill \| version \| status \| layer \| owner \| last_reviewed \| removal-date \| notes` |
| SSOT boundary | SKILLS.md = lifecycle SSOT; common-contract.json = distribution governance; SKILL.md = human-readable (drift-checked) |
| Tool separation | verify-skills.ts = fast existence check; skill-lifecycle-audit.ts = deep drift check |
| Migration strategy | Parallel dual-source → SKILLS.md-only after stabilization |
| Scope | skills/ (15 project skills) only; .claude/skills/ platform skills unchanged |
| Layer values | Same as scripts: L0 / L0+L1 / L0+L1+L2 |

## Open Items

| # | Item | Owner |
|---|------|-------|
| O-01 | SKILLS.md location — `skills/SKILLS.md` vs `scripts/SKILLS.md` vs `docs/` | architect |

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| E-01 | architect | High | Decide SKILLS.md location + include SKILLS.md design in ADR C-01 | L0-only | 1-2 |
| E-02 | automation-engineer | Low | Create `skills/SKILLS.md` — register all 15 skills with layer column | L0-only | 4 |
| E-03 | automation-engineer | Low | `publish-to-template.ts` — replace SKILL.md scope parsing with SKILLS.md layer parsing (phased migration) | L0-only | 4 |
| E-04 | automation-engineer | Low | `verify-skills.ts` — add SKILLS.md ↔ skills/ directory match check | L0-only | 4 |
| E-05 | lifecycle-manager | Medium | `skill-lifecycle-audit.ts` — add Check E (SKILLS.md vs SKILL.md frontmatter drift) | L0-only | 4 |
| E-06 | lifecycle-manager | Medium | Fix 15 skill frontmatter — fill missing last_reviewed, remove duplicate fields | L0-only | 4 |
