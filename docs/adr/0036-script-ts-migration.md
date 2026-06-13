# ADR-0036: Script Migration — sh/ps1 → TypeScript (Bun Runtime)

## Status
Accepted

## Type
Operational

## Created
2026-06-11

## Deciders
- architect
- automation-engineer
- auditor

## Context

The workspace has maintained a dual-file scripting model since initial setup: every operational script exists as both a `.sh` (macOS/Linux) and `.ps1` (Windows) file. As of 2026-06-11 the inventory is:

| Script | sh | ps1 |
|--------|----|-----|
| `new-project` | ✅ | ✅ |
| `remove-project` | ✅ | ✅ |
| `upgrade-project` | ✅ | ✅ |
| `cleanup-completed-md` | ✅ | ✅ |
| `install-bun` | ✅ | ✅ |

Additionally, `new-project.sh/ps1` contained:
- A bun installation check and install block (`install-bun` invocation)
- POSIX/NTFS permission-setting code (`chmod`, `chown`, `icacls`)

Bun is already a hard prerequisite for all TypeScript scripts in this workspace (`bun scripts/audit.ts`, `bun scripts/dev-sync.ts`, etc.). The dual-file model has created repeated maintenance failures: every change to `.sh` must be replicated in `.ps1`. In the session of 2026-06-11 alone, six separate sync operations were required to keep `new-project.sh` and `new-project.ps1` aligned.

Furthermore, `new-project.sh` already delegated approximately 40% of its logic to inline `bun` blocks (`bun - <<'BUNSCRIPT'`), making the shell wrapper largely a dispatch layer for TypeScript code.

## Problem Statement

### Dual-File Synchronization Burden
Every feature addition, bug fix, or cleanup in `.sh` requires an identical change in `.ps1`. This constraint has caused synchronization drift multiple times, leading to silent behavioral differences between platforms.

### bun Install Logic Is Dead Code
`install-bun.sh/ps1` and the bun-existence check in `new-project.sh` (Step 2.5: `command -v bun &>/dev/null`) are predicated on bun being absent at script execution time. Since bun is installed as part of workspace environment setup — before any script in this repository can run — this code path is never exercised in normal operation. It adds complexity and masks errors: if bun is genuinely missing, the silent skip causes downstream failures with confusing error messages.

### File Permission Code Causes More Problems Than It Solves
The permission-setting blocks across `new-project`, `remove-project`, and `upgrade-project` scripts include:
- `chmod +x scripts/*.sh scripts/*.ps1`
- `chmod 644 agents/*.md`
- `find . -name "*.sh" -exec chmod +x {} \;`
- PowerShell equivalents: `icacls ... /grant Users:R`

**Why these are harmful:**

1. **Windows (NTFS)**: POSIX permission bits have no semantic meaning in the NTFS filesystem context. Git on Windows emulates a permission bit (`core.fileMode`) but it does not correspond to actual OS-enforced access control. The `icacls` calls in `.ps1` have caused unexpected ACL modifications on project directories in environments with inherited permissions from parent directories.

2. **macOS**: The `chmod 644` calls on template `.md` files propagated read-only bits into scaffolded projects, causing editors and git hooks to fail when attempting to write to files they expected to be user-writable. This was reported as an undiagnosed issue multiple times before the root cause was identified.

3. **Complexity without benefit**: The scripts run in the context of the user who owns the workspace. Files created by the user are already user-writable by default. Explicitly setting permissions to values the OS would have assigned anyway adds lines of code that create risk without adding value.

## Decision

### 1. Migrate all operational scripts from sh/ps1 to TypeScript

All five script pairs are replaced by single TypeScript files executed via `bun`:

| Old (deleted) | New |
|---------------|-----|
| `scripts/new-project.sh` + `scripts/new-project.ps1` | `scripts/new-project.ts` |
| `scripts/remove-project.sh` + `scripts/remove-project.ps1` | `scripts/remove-project.ts` |
| `scripts/upgrade-project.sh` + `scripts/upgrade-project.ps1` | `scripts/upgrade-project.ts` |
| `scripts/cleanup-completed-md.sh` + `scripts/cleanup-completed-md.ps1` | `scripts/cleanup-completed-md.ts` |
| `scripts/install-bun.sh` + `scripts/install-bun.ps1` | **Deleted, no replacement** |

**Invocation changes (Breaking):**

```bash
# Before
bash scripts/new-project.sh <name> <variant>     # macOS/Linux
.\scripts\new-project.ps1 <name> <variant>        # Windows

# After (all platforms)
bun scripts/new-project.ts <name> <variant>
```

### 2. Remove bun installation logic entirely

- Delete `scripts/install-bun.sh` and `scripts/install-bun.ps1` with no TypeScript replacement.
- Remove the `command -v bun` existence check from `new-project.ts`. If bun is absent, the script fails immediately with a clear error from the Bun runtime itself.
- Remove any README or documentation references to `install-bun`.

### 3. Remove all file permission-setting code

All `chmod`, `chown`, `find ... -exec chmod`, and `icacls` calls are deleted from all scripts. No replacement. Files created during project scaffolding retain the permissions assigned by the operating system at creation time, which are correct by default.

This applies to:
- `new-project` — permission blocks after template copy
- `remove-project` — any permission resets before deletion
- `upgrade-project` — the re-chmod block after template overlay (primary source of upgrade failures on Windows)

## Consequences

### Positive
- Single source of truth for each script — one file per operation
- Cross-platform by default: TypeScript + Bun runs identically on Windows, macOS, Linux
- Simpler scripts: elimination of sh/ps1 dispatch wrapper reduces line count by ~30%
- Clearer error messages: bun runtime errors are more descriptive than shell `command not found`
- No more upgrade failures caused by permission bit propagation on Windows

### Negative / Risks
- **Breaking change for users**: Anyone with shell aliases or CI pipelines calling `bash scripts/new-project.sh` must update to `bun scripts/new-project.ts`. Mitigated by explicit CHANGELOG `[Breaking]` entry and README announcement.
- **Bun required at PATH**: The existing TypeScript scripts already require this. No new dependency is introduced.

## Implementation Order

1. ADR published (this document) — establishes policy record
2. `scripts/SCRIPTS.md` updated — migration policy declared, sh/ps1 marked deprecated
3. `CLAUDE.md` + `GEMINI.md` updated — execution instructions updated
4. `README.md` + `README_ko.md` updated — breaking change announced
5. TypeScript scripts written, sh/ps1 deleted, permission code removed — **atomic commit**
6. `bun scripts/audit.ts` must pass with exit code 0

## References

- Meeting transcript: `memory/meeting-2026-06-11-script-ts-migration.md`
- Predecessor: ADR-0034 (L0/L1 deployment strategy)
- Affected scripts: `SCRIPTS.md` registry
