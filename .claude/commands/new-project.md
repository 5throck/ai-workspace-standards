---
gemini-parity: skip
description: Scaffold a new project under the workspace root (Claude Code only — uses native Agent tool dispatch)
---

Scaffold a new project under the workspace root.

Arguments: $ARGUMENTS

Detect the OS and run the appropriate script:

**Windows (PowerShell native) — no bash available:**
```powershell
.\scripts\new-project.ps1 -ProjectName "$ARGUMENTS"
```

**Bash (Git Bash / WSL / macOS / Linux):**
```bash
bash scripts/new-project.sh "$ARGUMENTS"
```

To detect: check if `bash` is available by running `bash --version`. If the command fails or the environment is PowerShell-only, use the `.ps1` variant; otherwise use the `.sh` variant.

Both scripts do the same thing:
1. Copy `templates/` into a new `<workspace>/$ARGUMENTS/` directory
2. Overlay the variant template (`co-develop` by default) on top of `common/`
3. Remove `docs/_examples/` (reference-only) and `.gitkeep` placeholders
4. Substitute `[Project Name]` placeholder with `$ARGUMENTS` in all text files
5. Record template provenance in `docs/context.md`
6. Initialize git with `core.hooksPath .githooks`
7. Run `bun scripts/audit.ts` to verify the scaffold
8. Run `bash scripts/setup.sh` (if exists) for dependency installation

After scaffolding, `cd` into the new project directory — all subsequent work runs from there.

> ⚠️ This command is workspace-level only. Run from the workspace root (`<workspace-root>`).
