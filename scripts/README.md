# Workspace Scripts

Utility scripts for workspace-level operations.

## Script Categories

### Project Scaffolding
- `new-project.sh` / `new-project.ps1` - Create a new project from templates

### Lifecycle Audits (Bun/TypeScript Only)
- `agent-lifecycle-audit.ts` - Validate agent frontmatter, AGENTS.md consistency, deprecated agent references
- `skill-lifecycle-audit.ts` - Validate skill frontmatter, owner references, deprecated skills, dependencies

> **Note**: Lifecycle audit scripts use Bun/TypeScript for cross-platform compatibility. No shell script versions are needed.

### Workspace Utilities
- `audit.sh` / `audit.ps1` - Documentation and file integrity audit
- `dev-sync.sh` / `dev-sync.ps1` - Development sync (memlog → changelog → audit → commit → PR)
- `sync-md.sh` / `sync-md.ps1` - Update memory/MEMORY.md index
- `gen-pr-body.sh` / `gen-pr-body.ps1` - Generate PR body from changes

---

## Hybrid Scripting Strategy

This workspace follows a **hybrid scripting model**:

### TypeScript (Bun) Scripts
- **Purpose**: Complex orchestration, multi-agent dispatch, automation pipelines, lifecycle audits
- **Location**: Both workspace root (`C:\git\scripts/`) and individual projects
- **Examples**:
  - `agent-lifecycle-audit.ts` - Agent lifecycle validation
  - `skill-lifecycle-audit.ts` - Skill lifecycle validation
  - `dispatch.ts` - Agent dispatcher CLI
  - `verify-skills.ts` - Skill verification
  - `agent-create.ts` - Agent creation
  - `retry-handler.ts` - Retry logic with exponential backoff

### Shell Scripts (Bash + PowerShell)
- **Purpose**: Everyday development utilities, cross-platform compatibility
- **Location**: Both workspace root (`C:\git\scripts/`) and individual projects
- **Rule**: All utility scripts must have **both** `.sh` and `.ps1` versions

### Script Pairing Rule

Any creation, modification, or deletion of a shell script MUST maintain the pair:

| Operation | Requirement |
|-----------|-------------|
| Create `.sh` | MUST also create `.ps1` |
| Edit `.sh` | MUST also edit `.ps1` |
| Delete `.sh` | MUST also delete `.ps1` |

---

## Usage Examples

### Create a New Project
```bash
bash scripts/new-project.sh "my-project"
cd my-project
```

### Run Development Sync
```bash
bash scripts/dev-sync.sh "feat: description"
# or
.\scripts\dev-sync.ps1 "feat: description"
```

### Run Agent Scripts (from project directory)
```bash
# List agents
bun run agent:list

# Create a new agent
bun run agent:create security-auditor --group Technical

# Dispatch parallel tasks
bun run dispatch:parallel
```

### Run Lifecycle Audits
```bash
# Check agent health
bun scripts/agent-lifecycle-audit.ts

# Check skill health
bun scripts/skill-lifecycle-audit.ts

# JSON output for CI/CD
bun scripts/agent-lifecycle-audit.ts --json
bun scripts/skill-lifecycle-audit.ts --json
```

---

## File Encoding

All scripts MUST be saved as **UTF-8 (without BOM)**.

PowerShell scripts must explicitly specify encoding for outputs:
```powershell
Add-Content -Path "file.txt" -Value "content" -Encoding UTF8
```

---

*Last Updated: 2026-05-25*
