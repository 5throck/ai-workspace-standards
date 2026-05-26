param([Parameter(ValueFromRemainingArguments)][string[]]$PassThruArgs)
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& bun "$ScriptDir/validate-templates.ts" @PassThruArgs
exit $LASTEXITCODE
