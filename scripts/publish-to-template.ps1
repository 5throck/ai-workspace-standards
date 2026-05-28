# publish-to-template.ps1 - Thin wrapper -> delegates to publish-to-template.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/publish-to-template.ts
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& bun "$ScriptDir\publish-to-template.ts" @args
exit $LASTEXITCODE
