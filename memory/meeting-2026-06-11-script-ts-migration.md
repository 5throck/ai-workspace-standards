# Meeting Transcript
**Date**: 2026-06-11
**Topic**: Script Migration Policy Review — sh/ps1 → TypeScript, Remove bun install, Remove file permission settings
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect**: (Round 1)

The proposal to migrate all sh/ps1 scripts to TypeScript (Bun runtime) is architecturally sound and overdue. The current dual-file maintenance model — where every change to `new-project.sh` must be replicated in `new-project.ps1` — has caused repeated synchronization failures. The most recent session alone required six separate sync operations to keep the pair aligned.

From an architecture standpoint, the migration should follow the doc-first principle the user specified: ADR first, then SCRIPTS.md policy update, then README announcements, then implementation. This ensures the governance record precedes any code deletion.

On bun install removal: the `install-bun.sh/ps1` scripts are predicated on bun being absent. Since bun is a workspace prerequisite installed at environment setup time, these scripts represent dead code. They should be deleted, not deprecated. The bun existence check in `new-project.sh` Step 2.5 (`command -v bun &>/dev/null`) should also be removed — fail loudly if bun is missing rather than silently skipping the pm.md strip step.

On file permission removal: `chmod`, `chown`, `icacls` calls in the scripts have no consistent effect on Windows (Git Bash emulates permissions) and have caused unintended side effects on macOS (read-only templates accidentally propagated). Removing them simplifies the scripts significantly. This removal rationale must be documented in the ADR to prevent future re-introduction.

**automation-engineer**: (Round 1)

Agreeing with architect's assessment and adding implementation specifics. The current sh/ps1 inventory is:

- `new-project.sh/ps1` — primary target, ~400 lines each
- `remove-project.sh/ps1` — moderate complexity
- `upgrade-project.sh/ps1` — moderate complexity
- `cleanup-completed-md.sh/ps1` — simple, but used by git hooks (needs verification)
- `install-bun.sh/ps1` — delete entirely, no ts replacement needed

For the TypeScript rewrites, the pattern is already established: `new-project.sh` already delegates ~40% of its logic to inline `bun` scripts. The full TS version will use `node:fs`, `node:path`, `node:child_process` (for git calls), and `js-yaml` — all already in the project's dependencies.

The permission-setting code in `new-project.sh` includes: `chmod +x scripts/*.sh`, `chmod 644 agents/*.md`, `find . -name "*.sh" -exec chmod +x {} \;`, and the `icacls` equivalents in `.ps1`. These blocks can be deleted wholesale — no replacement needed.

One concern: the git hook integration for `cleanup-completed-md`. If `.githooks/` calls the `.sh` directly, the hook must be updated to call `bun scripts/cleanup-completed-md.ts` instead. This dependency must be checked before deletion.

**auditor**: (Round 1)

Two structural concerns to flag.

First, the migration will create a gap period where old sh/ps1 files coexist with new ts files. The SCRIPTS.md registry must be updated simultaneously with the file renames — not after — to prevent audit failures due to stale registry entries. The audit script checks SCRIPTS.md against actual file existence.

Second, the ADR must explicitly state the "why now" for permission removal — not just "it caused problems" but a precise statement: "POSIX permission bits have no semantic meaning in the Windows NTFS context where most workspace users operate, and the macOS behavior introduced read-only propagation bugs in template directories." This prevents the pattern from being reintroduced by a future contributor who thinks they're being helpful.

Regarding bun install scripts: audit.ts does not currently check for `install-bun.*` existence, so deletion requires no audit rule update. The README links to these scripts must also be removed — auditor will flag dangling references if they remain.

---

### Round 2

**architect**: (Round 2)

Responding to automation-engineer's git hook concern: I checked the hook pattern in this workspace — `.githooks/commit-msg` and `pre-commit` call `bun scripts/` directly, not shell scripts. The `cleanup-completed-md` hook call, if any, likely already uses `bun`. This should be verified before deletion but is not expected to block the migration.

On auditor's simultaneity requirement: agreed. The correct execution sequence is:
1. ADR (architect) — establishes policy record
2. SCRIPTS.md + CLAUDE.md + GEMINI.md + README.md/README_ko.md (automation-engineer) — doc layer
3. File creation: new `.ts` scripts written, tested
4. File deletion: old `.sh/.ps1` files removed
5. Sync + PR

Steps 3 and 4 must be atomic within a single commit to prevent the audit gap the auditor identified.

**automation-engineer**: (Round 2)

Confirming architect's hook assessment — I'll verify `.githooks/` contents during implementation. Adding one more scoping note: the `upgrade-project` scripts contain a section that calls `chmod` to re-apply execution bits after overlaying new template files onto an existing project. This block is the most likely source of the "additional problems" the user referenced. Removing it eliminates a class of upgrade failures on Windows entirely.

For the README update: the current Quick Start section in both `README.md` and `README_ko.md` shows:
```bash
bash scripts/new-project.sh <name> <variant>    # macOS/Linux
.\scripts\new-project.ps1 <name> <variant>      # Windows
```

Post-migration this becomes:
```bash
bun scripts/new-project.ts <name> <variant>     # All platforms
```

This is a user-facing breaking change and must be clearly marked in both READMEs and in CHANGELOG.md under a `[Breaking]` tag.

**auditor**: (Round 2)

Synthesis complete. All three concerns are resolved:
- Hook dependency: verify before delete, expected safe
- Audit gap: atomic commit (create + delete in same PR) eliminates the window
- Breaking change: CHANGELOG `[Breaking]` tag required

No open disagreements. Action items are clearly scoped. Proceed with A-01 first.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | Issue new ADR — "sh/ps1 → TypeScript(Bun) migration policy", including migration rationale, scope, and permission-removal justification | L0-only | L1-A |
| A-02 | automation-engineer | Low | Update `scripts/SCRIPTS.md` — document migration policy, mark sh/ps1 files as deprecated | L0-only | L1-A |
| A-03 | automation-engineer | Low | Update `CLAUDE.md` + `GEMINI.md` — replace sh/ps1 execution instructions with `bun scripts/<name>.ts` format | Both | L1-A |
| A-04 | automation-engineer | Low | Update `README.md` + `README_ko.md` — announce script execution method change, mark as breaking change | L0-only | L1-A |
| A-05 | automation-engineer | Low | Implement ts migration: rewrite 4 script pairs as `.ts`, delete `install-bun.sh/ps1`, remove all permission-setting code; atomic commit (create + delete) | L0-only | L1-B |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | ADR published with permission-removal rationale explicitly stated | `ls docs/adr/ADR-*.md` shows new entry |
| 2 | No `*.sh` or `*.ps1` files remain in `scripts/` | `ls scripts/*.sh scripts/*.ps1` returns empty |
| 3 | `bun scripts/new-project.ts <name> <variant>` creates a valid project | Run and check output |
| 4 | `bun scripts/audit.ts` passes with 0 failures post-migration | Exit code 0 |
| 5 | `.githooks/` contains no references to `.sh` or `.ps1` files | `grep -r "\.sh\|\.ps1" .githooks/` returns empty |
| 6 | CHANGELOG.md has `[Breaking]` entry for script execution method change | Manual review |
