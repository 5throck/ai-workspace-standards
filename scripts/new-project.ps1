# new-project.ps1 — Scaffold a new project under the workspace root (Windows)
# Usage: .\scripts\new-project.ps1 "<project-name>"
param([Parameter(Mandatory)][string]$ProjectName)

$WorkspaceRoot = Split-Path $PSScriptRoot -Parent
$ProjectDir    = Join-Path $WorkspaceRoot $ProjectName

if (Test-Path $ProjectDir) {
    Write-Host "❌ Directory already exists: $ProjectDir" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Scaffolding new project: $ProjectName" -ForegroundColor Cyan

# Create directory structure
$dirs = @("src","docs","scripts","memory","agents","skills",".claude\commands",".gemini\commands",".githooks")
foreach ($d in $dirs) { New-Item -ItemType Directory -Path "$ProjectDir\$d" -Force | Out-Null }

Set-Location $ProjectDir
git init
git config core.hooksPath .githooks

# Copy audit scripts from workspace
Copy-Item "$WorkspaceRoot\scripts\audit.sh"  "scripts\audit.sh"
Copy-Item "$WorkspaceRoot\scripts\audit.ps1" "scripts\audit.ps1"

# Scaffold files (same content as new-project.sh — abbreviated for PowerShell)
@"
# [Project Name]
## Project Overview
[One-sentence description.]
## Coding Guidelines
> See CONSTITUTION.md §8 for full guidelines.
### 1. Think Before Coding
### 2. Simplicity First
### 3. Surgical Changes
### 4. Goal-Driven Execution
### 5. Response Language
- Conversational replies → Korean (한국어)
- Code / commits / PRs → English only
"@ | Set-Content "docs\context.md"

@"
# Changelog
All notable changes to this project will be documented in this file.
## [Unreleased]
"@ | Set-Content "CHANGELOG.md"

@"
# Memory Index
| Date | Summary |
|------|---------|
"@ | Set-Content "memory\MEMORY.md"

"# .env.sample — copy to .env and fill in values" | Set-Content ".env.sample"

@"
.env
.venv/
__pycache__/
node_modules/
.DS_Store
Thumbs.db
"@ | Set-Content ".gitignore"

Write-Host ""
Write-Host "✅ Project '$ProjectName' scaffolded at: $ProjectDir" -ForegroundColor Green
Write-Host "Next: fill in docs\context.md placeholders and run .\scripts\audit.ps1"
