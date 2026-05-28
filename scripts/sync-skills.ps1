# sync-skills.ps1 - Thin wrapper -> delegates to sync-skills.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/sync-skills.ts
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& bun "$ScriptDir\sync-skills.ts" @args
exit $LASTEXITCODE
