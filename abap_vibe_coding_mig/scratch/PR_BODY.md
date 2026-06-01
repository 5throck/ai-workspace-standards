## Why

This PR implements the comprehensive **3-Phase Project Improvement Plan** for the VSP Harness Engineering project. The plan addresses configuration management, script standardization, agent coordination, skill system enhancement, and automation/monitoring.

**Key Decision**: Migrate to **Bun-based single-source scripts** for cross-platform compatibility and reduced maintenance burden.

## What Changed

### Phase 1: Foundation Layer

**1A. Documentation Structure Reorganization**
- Reorganized `docs/context.md` to remove agent workflow sections (migrated to `AGENTS.md`)
- Added `scripts/update-memory-index.ts` for automatic index updates
- Standardized `CHANGELOG.md` template

**1B. Bun-based Script Standardization**
- Migrated all core scripts from dual `.sh`/`.ps1` to single-source `.ts` files
- Added `scripts/package.json` with npm script shortcuts
- Added `scripts/tsconfig.json` configured for Bun's TypeScript
- Added `scripts/README.md` with usage documentation
- Updated `.gitignore` to prevent `.cmd` file creation

**13 New TypeScript Scripts:**
| Script | Purpose |
|--------|---------|
| `dev-sync.ts` | Full pipeline: memlog → sync-md → changelog → audit → commit → PR |
| `audit.ts` | Documentation integrity check |
| `sync-mcp.ts` | MCP config synchronization (.mcp.json → tool-specific settings) |
| `health-check.ts` | System health monitoring (VSP, MCP, Git, Memory) |
| `post-write.ts` | Post-write QA chain execution |
| `verify-skills.ts` | Skill loading verification |
| `qa-full.ts` | Full QA chain (SyntaxCheck → RunUnitTests → RunATCCheck) |
| `qa-quick.ts` | Quick syntax check only |
| `dispatch-parallel.ts` | Parallel agent dispatch automation |
| `dispatch-serial.ts` | Serial agent dispatch automation |
| `retry-handler.ts` | Error recovery with exponential backoff |
| `update-memory-index.ts` | Memory index auto-update |
| `gen-pr-body.ts` | Generate PR body from commit + diff |

**Benefits:**
- Single source of truth (no more dual `.sh`/`.ps1` maintenance)
- Cross-platform by design (Windows, macOS, Linux)
- Modern async/await and native JSON handling
- ~50ms startup (negligible vs human time)
- Legacy `.sh`/`.ps1` wrappers retained for backward compatibility

**1C. MCP Configuration with Sync Script**
- Created `.mcp.json` as Single Source of Truth for MCP configuration
- Implemented `scripts/sync-mcp.ts` synchronization script
- Added pre-commit hook to check configuration drift

### Phase 2: Orchestration Layer

**2A. Agent Coordination Improvements**
- Created `templates/dispatch-parallel.md` - parallel dispatch template
- Created `templates/dispatch-serial.md` - serial dispatch template
- Created `agents/handoff-spec.md` - JSON-based handoff format
- Added error recovery section to `AGENTS.md`

**2B. Skill System Enhancement**
- Created `skills/desktop-app-fallback/SKILL.md` - manual execution guide for Desktop App
- Created `skills/SKILLS.md` - auto-generated skill index
- Created `scripts/verify-skills.ts` - skill loading verification
- Implemented `scripts/post-write.ts` wrapper

### Phase 3: Automation & Monitoring

**3A. QA Automation Enhancement**
- Created `scripts/qa-full.ts` - full QA chain execution
- Created `scripts/qa-quick.ts` - quick syntax check
- Integrated QA into pre-commit hook (optional)
- Created QA report template

**3B. Connection State Monitoring**
- Created `scripts/health-check.ts` with daemon mode support
- Monitors: VSP health, MCP servers, Git repo, Memory log
- Output: Markdown table + JSON status file
- Status dashboard: `scratch/status.md`

### Additional Improvements

**Error Recovery**
- Implemented exponential backoff retry mechanism (3-retry limit)
- Added `scripts/retry-handler.ts` for robust error handling

**Documentation**
- Added `docs/superpowers/specs/2026-05-24-*.md` - Phase 1-3 design specs
- Updated `README.md` with Bun migration information
- Updated `AGENTS.md` with error recovery section

## Architectural Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Script Runtime** | Bun (not Deno) | ~50ms vs ~200ms startup; native TypeScript; single-file modules |
| **MCP Config** | `.mcp.json` as SSoT | Single source of truth; syncs to tool-specific settings |
| **Legacy Scripts** | Retained `.sh`/`.ps1` | Backward compatibility during transition |
| **Retry Limit** | 3 attempts | Balance resilience vs. infinite loops |
| **ATC Priority 1** | Blocking rule | Quality gate for production code |

## Test Plan

- [ ] `bun scripts/audit.ts` passes
- [ ] `bun scripts/health-check.ts` reports all systems healthy
- [ ] `bun scripts/sync-mcp.ts` syncs `.mcp.json` to `.claude/settings.json`
- [ ] `bun run dev-sync "test: verify Bun migration"` executes successfully
- [ ] `bun scripts/verify-skills.ts` confirms all 9 skills loadable
- [ ] `templates/dispatch-*.md` are valid Markdown
- [ ] `.githooks/pre-commit` detects MCP drift
- [ ] CHANGELOG.md updated under `[Unreleased]`

## Verification Steps

```bash
# Install Bun (one-time)
powershell -c "irm bun.sh/install.ps1"  # Windows
curl -fsSL https://bun.sh/install | bash  # Unix/macOS

# Test TypeScript scripts
bun run audit
bun run health-check
bun run dev-sync "test: verify Bun migration"

# Verify MCP sync
bun run sync-mcp
git diff .claude/settings.json

# Verify skills
bun scripts/verify-skills.ts
```

## Security Checklist

- [ ] No secrets, credentials, or API keys committed
- [ ] No `.env` files staged (use `.env.sample` for templates)
- [ ] Dependencies unchanged or reviewed for new CVEs
- [ ] `.mcp.json` is gitignored (contains SAP credentials as example)

## Migration Guide

1. **Install Bun** (one-time):
   ```bash
   powershell -c "irm bun.sh/install.ps1"  # Windows
   curl -fsSL https://bun.sh/install | bash  # Unix/macOS
   ```

2. **Use new scripts**:
   ```bash
   bun run dev-sync "feat: description"
   bun run audit
   bun scripts/health-check.ts
   ```

3. **Legacy scripts still work** during transition:
   ```bash
   bash scripts/dev-sync.sh "feat: description"
   ```

## Files Changed

- **35 files added**: `.mcp.json`, `scripts/*.ts` (13), `scripts/*.sh` (legacy), `scripts/package.json`, `scripts/tsconfig.json`, `templates/*.md`, `skills/SKILLS.md`, `skills/desktop-app-fallback/`, `docs/superpowers/specs/`, `.githooks/pre-commit`
- **5 files modified**: `README.md`, `AGENTS.md`, `.gitignore`, `docs/context.md`, `CHANGELOG.md`

## Breaking Changes

None. Legacy `.sh`/`.ps1` scripts are retained for backward compatibility.

## Notes

**Implementation Priority** (from plan):
- P0: `.mcp.json` + Sync Script, Bun runtime, Core .ts scripts, Agent coordination
- P1: Documentation reorganization, Skill system enhancement, QA automation
- P2: Legacy wrappers, Status monitoring

All P0 and P1 items are complete. P2 items are implemented where applicable.

---

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-Authored-By: Gemini <noreply@google.com>
