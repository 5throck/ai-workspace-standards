# gen-pr-body.ps1 - Thin wrapper -> delegates to gen-pr-body.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/gen-pr-body.ts
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& bun "$ScriptDir\gen-pr-body.ts" @args
exit $LASTEXITCODE
