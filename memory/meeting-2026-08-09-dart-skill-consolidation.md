# Meeting: DART Skill Consolidation & .env.sample Standardization

**Date**: 2026-08-09
**Participants**: PM (facilitator), Architect, Automation Engineer
**Objective**: Determine the future of k-dart and dart-disclosure-parser skills — common promotion, merge, env var standardization, and .env.sample placement.

---

## Agenda

1. k-dart promotion to L0 common skill
2. Env var standardization: `API_K_DART` → `DART_API_KEY`
3. dart-disclosure-parser redundancy evaluation and removal
4. .env.sample creation for co-consult
5. LAW_API_OC applicability (future)

---

## Pre-meeting Survey Results

### Skill Placement现状

| Skill | `skills/` (L0) | `templates/common/skills/` (L1) | `templates/co-consult/skills/` (L2) | `.agents/skills/` |
|-------|:-:|:-:|:-:|:-:|
| k-dart | No | No | Yes | No |
| dart-disclosure-parser | Yes | No | Yes | Yes |

### Functional Scope Comparison

| Aspect | k-dart | dart-disclosure-parser |
|--------|--------|----------------------|
| Core role | Direct DART OpenAPI endpoint caller (curl) | Response parsing/normalization rules |
| env var | `API_K_DART` | `API_K_DART` |
| Endpoints | 15 endpoints (disclosure, company, financials, dividends, lawsuits, etc.) | Parsing rules only |
| Parsing logic | None (returns raw response) | K-IFRS normalization, CFS/OFS distinction, unit conversion |
| TypeScript code | None | `parseDartFinancials()` example function |
| Terminology dict | `references/terms-ko.json` | None |
| Status codes | 11 codes defined | 8 codes defined (partial overlap) |
| Used by agent | strategy-analyst | strategy-analyst |
| Used by variant | co-consult only | co-consult only |

### Env Var Status
- k-dart: `API_K_DART` (in skill body, bash/PowerShell examples)
- dart-disclosure-parser: `API_K_DART` (in prerequisites)
- User-requested standard: `DART_API_KEY`
- `LAW_API_OC`: Not referenced anywhere in workspace templates (only in Projects/co-architect, not yet promoted)

---

## Round 1: Initial Positions

### Architect

**Agenda 1 (k-dart → common)**: **Pro**. High reuse potential for future legal/financial variants. Move to L0 `skills/`, distribute via `sync-skills.ts`.

**Agenda 2 (env var rename)**: **Cautious**. k-dart is forked from k-skill (NomaDamas, MIT). Original uses `API_K_DART`. However, `DART_API_KEY` is more intuitive. Suggested compromise: env var fallback logic. Or full rename — depends on workspace consistency policy.

**Agenda 3 (dart-disclosure-parser removal)**: **Pro — merge first, then remove**. The two skills are complementary (collection vs processing). Merge parsing rules into k-dart as a "Parsing & Normalization" sub-section, then deprecate dart-disclosure-parser.

### Automation Engineer

**Agenda 1**: **Pro**. Change `scope: co-consult` → `scope: common`. Remove variant-local copy after promotion.

**Agenda 2**: Low-risk change (bash/PowerShell examples + prompt text only). Need to verify `financial-pipeline.ts` env var references.

**Agenda 3**: **Pro**. Steps: (1) merge parsing rules into k-dart, (2) deprecate dart-disclosure-parser, (3) remove from co-consult variant.json `skills[]`, (4) cleanup Related Skills references in company-intelligence and financial-statement-analysis, (5) remove L0 and platform skill copies.

### PM

**Agenda 5 (LAW_API_OC)**: Not applicable now. No template variant uses it. Apply when co-architect is promoted to template. Do not add to common `.env.sample`.

---

## Round 2: Deep Dive on Key Friction Points

### Friction 1: Merge Structure

- k-dart current: API call spec (15 endpoints) + response policy + status codes + failure modes
- dart-disclosure-parser: 7-step parsing workflow + TypeScript parseDartFinancials() + output format + status codes
- **Proposal**: Add "## Parsing & Normalization" section to k-dart SKILL.md, incorporating the 7 parsing steps compressed into steps 5-6 of k-dart's existing 7-step execution flow.

### Friction 2: scope and l2_propagate

- k-dart currently has `scope: co-consult`, no `l2_propagate`
- Promote to `scope: common` without `l2_propagate` — variants should explicitly include DART if needed, not auto-propagate

### Friction 3: TypeScript example code

- dart-disclosure-parser's `parseDartFinancials()` is prompt-embedded pseudocode, not a runnable module
- Keep as inline example in merged k-dart SKILL.md (no separate .ts file needed)

---

## Round 3: Decisions

### Approved Decisions

| # | Decision | Details | Owner |
|---|----------|---------|-------|
| D1 | Promote k-dart to L0 common skill | Move to `skills/k-dart/`, set `scope: common`, no `l2_propagate`, include `terms-ko.json` | docs-writer |
| D2 | Merge dart-disclosure-parser into k-dart, then deprecate | Parsing rules + TS example + output format merged into k-dart SKILL.md; dart-disclosure-parser marked deprecated and removed from L0/L2 | docs-writer |
| D3 | Unify env var to `DART_API_KEY` | All `API_K_DART` → `DART_API_KEY` in k-dart SKILL.md, bash/PowerShell examples, and financial-pipeline.ts | automation-engineer |
| D4 | Create co-consult `.env.sample` | Contains only `DART_API_KEY=your_dart_api_key_here` | docs-writer |
| D5 | Update co-consult variant.json | Remove `"dart-disclosure-parser"` from `skills[]` and `skill_manifest[]` | automation-engineer |
| D6 | LAW_API_OC deferred | Apply when co-architect is promoted to template | — (future) |
| D7 | Cleanup dart-disclosure-parser references | Remove from Related Skills in company-intelligence, financial-statement-analysis | docs-writer |
| D8 | Remove variant-local k-dart copies | Delete `templates/co-consult/skills/k-dart/`, `.agents/skills/k-dart/`, `.claude/skills/k-dart/`, `.gemini/skills/k-dart/` | automation-engineer |

### Pending Items

| Item | Details | Reason |
|------|---------|--------|
| `financial-pipeline.ts` env var check | Verify if it references `API_K_DART`, change if so | Impact scope |
| k-dart `owner` field | Currently `owner: strategy-analyst`; common skill needs ownership decision | Governance policy |

---

## Action Items Summary

1. **docs-writer**: Merge dart-disclosure-parser content into k-dart, create L0 `skills/k-dart/SKILL.md` with `scope: common`
2. **automation-engineer**: Rename `API_K_DART` → `DART_API_KEY` across all affected files
3. **docs-writer**: Create `templates/co-consult/.env.sample` with `DART_API_KEY`
4. **automation-engineer**: Update co-consult `variant.json`, remove dart-disclosure-parser entries
5. **docs-writer**: Cleanup Related Skills references in company-intelligence and financial-statement-analysis
6. **automation-engineer**: Remove variant-local k-dart copies from co-consult template
7. **docs-writer**: Deprecate and remove `skills/dart-disclosure-parser/` and `.agents/skills/dart-disclosure-parser/`
