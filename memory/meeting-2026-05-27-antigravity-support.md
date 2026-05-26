# Multi-Agent Meeting Minutes: Antigravity & Claude Code Workspace Support

**Date:** 2026-05-27
**Topic:** Transitioning the workspace from Claude Code-centric to Engine-Agnostic (supporting Gemini CLI / Antigravity).
**Participants:**
- PM Agent (Orchestrator)
- Template Architect (Design & Structure)
- Automation Engineer (Execution & Scripting)

## Discussion

**PM Agent:**
Our workspace rules and templates heavily bias towards Claude Code, using `.claude/skills`, `.claude/commands`, and `CLAUDE.md`. We need to properly integrate support for Gemini CLI (Antigravity). How do we restructure our configuration, skills, and commands to be engine-agnostic?

**Template Architect:**
- **Documentation:** We have `CONSTITUTION.md` which should remain the Single Source of Truth (SSOT) for general rules. Tool-specific rules must reside in `CLAUDE.md` and `GEMINI.md`. Templates need to distribute both.
- **Skills Location:** Right now, Claude expects skills in `.claude/skills/`. Gemini can load skills from specific plugin directories or via its own `.gemini/` structure. To avoid drift, we should designate `templates/common/skills/` (or a root `skills/`) as the SSOT.
- **Commands:** Claude relies on `.claude/commands/` for slash commands. Gemini doesn't have an identical slash command registry but can execute scripts. Therefore, the actual logic for all commands must be abstracted into `scripts/` (e.g., `scripts/new-task.ps1`). The `.claude/commands/` will just be thin wrappers calling these scripts.

**Automation Engineer:**
- I completely agree with abstracting logic to `scripts/`. It makes testing easier and ensures both agents execute the exact same operations.
- **Encoding Issues:** As specified in `GEMINI.md`, running PowerShell commands via Gemini can cause Unicode decoding errors. I will ensure every `.ps1` script explicitly sets `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;`.
- **Syncing:** We can create a `scripts/sync-config.ps1` that mirrors skills from the SSOT (`skills/`) into `.claude/skills/` and `.gemini/skills/` if both AI tools strictly require localized dot-folders.

**PM Agent:**
Excellent. I'll synthesize these points into actionable improvement measures.

## Derived Improvement Measures

1. **Unified Skill Management (SSOT):**
   - Consolidate all shared skills into `templates/common/skills/` (for template inheritance) and the root `skills/` folder.
   - Implement a synchronization script (`scripts/sync-skills.ps1`) to distribute these skills into both `.claude/skills/` and `.gemini/skills/` as required by the respective engines, preventing duplication and drift.

2. **Command Logic Abstraction:**
   - Move all execution logic out of `.claude/commands/*.md` and into cross-platform scripts (`scripts/*.ps1` and `scripts/*.sh`).
   - `.claude/commands/` files will be refactored to simply invoke the corresponding scripts. Gemini will natively be instructed to run the scripts directly via `/slash` emulation instructions in `GEMINI.md`.

3. **Documentation Separation:**
   - Enforce `CONSTITUTION.md` as the engine-agnostic root for all workflow and architectural standards.
   - Ensure `CLAUDE.md` and `GEMINI.md` are strictly reserved for tool-specific behavioral prompts (e.g., token limits, tool mappings, and tier strategies).
   - Update project scaffolding (`templates/`) to include both configuration files.

4. **Encoding & CLI Compatibility Safeguards:**
   - Update all `scripts/*.ps1` to include `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` to prevent CP949 or local encoding errors when executed by Antigravity on Windows.

5. **Tool-Specific Hooks:**
   - Explicitly document in `GEMINI.md` that `PostToolUse` hooks (used in Claude) are not supported, requiring manual explicit execution of post-write audit scripts (`scripts/audit.ps1`) by Gemini at task boundaries.
