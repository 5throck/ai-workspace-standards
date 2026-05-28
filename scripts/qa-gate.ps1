# qa-gate.ps1 - Thin wrapper -> delegates to qa-gate.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/qa-gate.ts
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& bun "$ScriptDir\qa-gate.ts" @args
exit $LASTEXITCODE
