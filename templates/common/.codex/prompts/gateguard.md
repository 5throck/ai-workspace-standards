Investigate a file before editing — pre-edit quality gate.

Arguments: $ARGUMENTS (file path)

## Steps

1. Identify the target file path from `$ARGUMENTS`
2. Search for files that import or require the target:
   ```bash
   grep -rn "from ['\"].*<basename without ext>['\"]" --include="*.ts" --include="*.js" --include="*.json" --include="*.md" . 2>/dev/null | grep -v node_modules | grep -v ".git"
   ```
3. Scan the target file for exported interfaces, types, enums, classes
4. Summarize findings:
   - Importers: list files and their relationship
   - Exported schemas that downstream consumers depend on
   - Scope constraints from user instructions
5. Output: `[GATEGUARD] Pre-edit investigation complete` with summary

If importers exist, verify changes won't break downstream consumers before proceeding with the edit.

## Enforcement

| Platform | Automatic? |
|----------|:----------:|
| Claude Code CLI | ✅ (PreToolUse hook also enforces) |
| Claude Desktop App | ✅* (bundled CLI) |
| Gemini CLI | ✅ (BeforeTool hook also enforces) |
| Antigravity | ❌ (manual enforcement only — hooks don't fire) |

\* Claude Desktop App: documented by Anthropic but workspace testing (2026-05) observed intermittent behavior.

See context.md §11.2 and `skills/gateguard/SKILL.md` for full specification.
