# audit.ps1 - Thin wrapper → delegates to audit.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/audit.ts
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& bun "$ScriptDir\audit.ts" @args
exit $LASTEXITCODE
