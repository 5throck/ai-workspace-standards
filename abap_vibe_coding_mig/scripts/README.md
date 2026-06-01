# Project Scripts

Utility scripts for project operations.

## Available Scripts

### Shell Scripts (Bash + PowerShell)

All utility scripts have both `.sh` and `.ps1` versions for cross-platform compatibility:

| Script | Purpose |
|--------|---------|
| `setup.sh` / `setup.ps1` | Initial project setup (env, deps, first commit) |
| `audit.sh` / `audit.ps1` | Documentation and file integrity audit |
| `dev-sync.sh` / `dev-sync.ps1` | Full sync pipeline (memlog → changelog → audit → commit → PR) |
| `sync-md.sh` / `sync-md.ps1` | Update memory/MEMORY.md index |
| `gen-pr-body.sh` / `gen-pr-body.ps1` | Generate PR body from changes |

### TypeScript (Bun) Scripts

Complex orchestration and automation scripts:

| Script | Purpose |
|--------|---------|
| `audit.ts` | Comprehensive documentation and file integrity audit (TypeScript enhancement of audit.sh/ps1) |
| `dev-sync.ts` | Full sync pipeline orchestration (TypeScript enhancement of dev-sync.sh/ps1) |
| `gen-pr-body.ts` | Generate PR body from commit changes with AI mode (TypeScript enhancement of gen-pr-body.sh/ps1) |
| `verify-skills.ts` | Verify all skills in `skills/` are loadable |
| `agent-create.ts` | Create new agent definition files |
| `agent-list.ts` | List all agents with metadata |
| `agent-delete.ts` | Delete agent files |
| `agent-verify.ts` | Verify agent/documentation synchronization |
| `dispatch.ts` | Main entry point for agent dispatch |
| `dispatch-parallel.ts` | Parallel agent dispatcher |
| `dispatch-serial.ts` | Serial agent dispatcher with dependencies |
| `retry-handler.ts` | Retry logic with exponential backoff |

## NPM Scripts

Convenience shortcuts defined in `package.json`:

```bash
bun run verify-skills     # Verify skills
bun run agent:create      # Create new agent
bun run agent:list        # List agents
bun run agent:delete      # Delete agent
bun run agent:verify      # Verify agent/documentation sync
bun run dispatch:parallel # Run parallel dispatch
bun run dispatch:serial   # Run serial dispatch
bun run gen-pr-body       # Generate PR body (TypeScript version)
```

## Hybrid Scripting Model

This project follows a hybrid scripting approach:

- **TypeScript (Bun)** for complex orchestration, multi-agent dispatch, automation pipelines
- **Shell Scripts** for everyday utilities and cross-platform compatibility

### Script Pairing Rule

Any creation, modification, or deletion of a shell script MUST maintain both versions:

| Operation | Requirement |
|-----------|-------------|
| Create `.sh` | MUST also create `.ps1` |
| Edit `.sh` | MUST also edit `.ps1` |
| Delete `.sh` | MUST also delete `.ps1` |

## File Encoding

All scripts MUST be saved as **UTF-8 (without BOM)**.

PowerShell scripts must explicitly specify encoding:
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

---

*Project template - customize as needed*
