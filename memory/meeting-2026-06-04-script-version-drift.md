# Meeting Transcript
**Date**: 2026-06-04
**Topic**: Script Version Mismatch Resolution and Prevention System Design
**Participants**: architect, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[Architect]** (Round 1)

The structural issue is clear: three independent artifacts exist — the `@version` header in each file, the L0 `SCRIPTS.md` registry, and the L1 `SCRIPTS.md` snapshot. `lifecycle-sync-audit.ts` Check A compares them, but only at read-time, not write-time. This is the root structural problem.

For Type 2 fixes (SCRIPTS.md version > file version), the direction is correct — treat SCRIPTS.md as SSOT and align files to it. However, I need to confirm with automation-engineer: does `fix-script-versions.ts` only replace the version number text, or does it also verify that the actual file content matches that version? Bumping the number without the corresponding content creates a more dangerous inconsistency.

For the medium-term design, I propose upgrading Check A in the pre-commit hook from warning to blocking, but not just with an error code — the UX needs to output "which file, how to fix it" alongside the block. If developers are blocked without guidance, it creates new friction. Automation-engineer, is it feasible to output auto-fix suggestions from pre-commit.ts when Check A errors are detected?

**[Automation-Engineer]** (Round 1)

Architect pinpointed the core issue. Checking `fix-script-versions.ts` confirms: it replaces only the `@version` header text. It does not verify semantic alignment between file content and version number. As architect noted, Type 2 means "SCRIPTS.md is higher = there should have been an update in between" — whether the file content actually corresponds to that version can only be determined via git log. This limitation must be explicitly documented in the commit for this fix.

For `pre-commit.ts` modification: feasible. `lifecycle-sync-audit.ts` already outputs structured JSON with `--json` flag, and the `fixData` field already contains `{ scriptName, fileVersion, registryVersion }`. Parsing this JSON in pre-commit.ts and outputting a fix command on error (exit 1) is approximately 20-30 lines.

One implementation concern: running Check A on every commit means scanning 50+ scripts each time. As in the existing pre-commit, we need staged file filtering — only run Check A when `scripts/*.ts` or `scripts/SCRIPTS.md` is in the staged set. Architect, what should the filter scope be? Trigger only on `scripts/*.ts` changes, or also on `SCRIPTS.md` changes?

For `helpers/` missing `@version`: using `fix-script-versions.ts` as-is will insert headers based on SCRIPTS.md registered versions. Low implementation risk.

**[Architect]** (Round 2)

Agreed on staged file filtering. Trigger conditions for Check A in pre-commit:
- `scripts/**/*.ts` staged, OR
- `scripts/SCRIPTS.md` staged

The third condition (`templates/common/scripts/SCRIPTS.md`) is covered by Check B already, so two conditions suffice.

On `helpers/` @version: structurally, helpers are library modules, not executable scripts. Long-term, adding a `type: library | script` column to SCRIPTS.md would allow Check A to treat library type as recommended rather than required. This is out of scope for now — proceed with bulk header insertion, and record the structural improvement as a separate ADR.

Execution order: ① fix Type 2 file versions → ② insert helpers @version headers → ③ pre-commit blocking. Correct order?

**[Automation-Engineer]** (Round 2)

Order is critical. Deploying ③ first will block ①②. The correct sequence must be ① → ② → ③. After ①② are committed, ③ activates the hook for all subsequent commits.

The `type: library | script` column idea has long-term value and requires `verify-scripts.ts` parser updates as well — confirmed as a separate PR. An ADR draft in `docs/adr/` is sufficient for now.

Additional implementation detail for ③: alongside the Check A block, output the auto-fix command:

```
✖ ERROR: hooks/pre-commit.ts @version 1.5.2 ≠ SCRIPTS.md 1.5.0
  → Fix: bun scripts/fix-script-versions.ts --script hooks/pre-commit.ts
```

This eliminates the need to open SCRIPTS.md manually. `lifecycle-sync-audit.ts` `fixData` already contains `scriptName`, so only the output format needs updating.

**[Auditor]** (Synthesis)

Points of Agreement:
1. Execution order confirmed: ① Type 2 file version alignment → ② helpers @version insertion → ③ pre-commit blocking. Reverse order causes self-contradiction.
2. Check A trigger conditions: staged `scripts/**/*.ts` or `scripts/SCRIPTS.md` only. Avoids unnecessary full scans.
3. Auto-fix hint output: block + print `bun scripts/fix-script-versions.ts --script <name>`. Reuses existing `fixData` field.
4. helpers/ treatment: bulk @version header insertion now; `type: library|script` column via separate ADR + PR.

Open Questions:
- `fix-script-versions.ts` only replaces version numbers, not content — this limitation must be noted explicitly in the commit message for A-01.

---

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-01 | automation-engineer | Low | Run `fix-script-versions.ts` — align 7 Type 2 files' `@version` to SCRIPTS.md values |
| A-02 | automation-engineer | Low | Insert `@version` headers into 8 `helpers/` files missing them |
| A-03 | automation-engineer | Medium | Modify `pre-commit.ts` — add Check A blocking with staged filter + auto-fix hint output |
| A-04 | architect | Medium | Draft ADR for `type: library\|script` column in SCRIPTS.md (`docs/adr/`) |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `bun scripts/lifecycle-sync-audit.ts` passes with 0 errors | Run audit after A-01, A-02 |
| C-02 | Committing a file with mismatched `@version` is blocked by pre-commit | Manual test: bump @version in a script without updating SCRIPTS.md, attempt commit |
| C-03 | Block message includes auto-fix command | Verify output format after A-03 |
