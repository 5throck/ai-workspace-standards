# sync-md.ps1 - Thin wrapper -> delegates to sync-md.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/sync-md.ts
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& bun "$ScriptDir\sync-md.ts" @args
exit $LASTEXITCODE
