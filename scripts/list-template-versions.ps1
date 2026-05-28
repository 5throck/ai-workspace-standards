# list-template-versions.ps1 - Thin wrapper -> delegates to list-template-versions.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/list-template-versions.ts
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& bun "$ScriptDir\list-template-versions.ts" @args
exit $LASTEXITCODE
