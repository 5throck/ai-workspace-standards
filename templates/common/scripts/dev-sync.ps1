# dev-sync.ps1 - Thin wrapper -> delegates to dev-sync.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/dev-sync.ts
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& bun "$ScriptDir\dev-sync.ts" @args
exit $LASTEXITCODE
