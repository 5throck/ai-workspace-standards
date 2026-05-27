[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectName,
    [string]$Description = "A new project",
    [string]$TechStack = "Node.js / Python / etc",
    [string]$Variant = "co-develop",
    [string]$Version = ""
)

# UTF-8 encoding enforcement — must follow param() block (PowerShell parser requirement)
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

# Validate ProjectName: alphanumeric, hyphens, underscores only; max 64 chars
if ($ProjectName -notmatch '^[a-zA-Z0-9_-]+$') {
    Write-Host "❌ Invalid project name: '$ProjectName'" -ForegroundColor Red
    Write-Host "   Only letters, numbers, hyphens (-), and underscores (_) are allowed." -ForegroundColor Yellow
    exit 1
}
if ($ProjectName.Length -gt 64) {
    Write-Host "❌ Project name too long ($($ProjectName.Length) chars). Maximum is 64 characters." -ForegroundColor Red
    exit 1
}

$WorkspaceRoot = Split-Path $PSScriptRoot -Parent
$ProjectDir    = Join-Path $WorkspaceRoot $ProjectName
$TemplatesDir  = Join-Path (Join-Path $WorkspaceRoot "templates") $Variant
$CommonDir     = Join-Path (Join-Path $WorkspaceRoot "templates") "common"
$VersionFile   = Join-Path (Join-Path $WorkspaceRoot "templates") "VERSION"

# ── Version resolution ─────────────────────────────────────────────────────────
$TempDir = $null
if ($Version -ne "") {
    $Tag = "template-v$Version"
    $tagExists = git -C $WorkspaceRoot tag -l $Tag 2>$null
    if (-not $tagExists) {
        Write-Host "❌ Template version not found: $Tag" -ForegroundColor Red
        Write-Host "   Run: .\scripts\list-template-versions.ps1" -ForegroundColor Yellow
        exit 1
    }
    $TempDir = [System.IO.Path]::GetTempPath() + [System.IO.Path]::GetRandomFileName()
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    # Extract BOTH common and variant from tag
    $archiveOutput = git -C $WorkspaceRoot archive $Tag "templates/common/" "templates/$Variant/" 2>&1 | tar -x -C $TempDir 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to extract template version $Tag" -ForegroundColor Red
        Write-Host "   This tag may predate the templates/common/ directory structure (introduced in v0.5.0)." -ForegroundColor Yellow
        Write-Host "   Available versions with common/ support: run .\scripts\list-template-versions.ps1" -ForegroundColor Yellow
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
    $CommonDir = Join-Path (Join-Path $TempDir "templates") "common"
    $TemplatesDir = Join-Path (Join-Path $TempDir "templates") $Variant
    if (-not (Test-Path $TemplatesDir)) {
        Write-Host "❌ Variant '$Variant' not found in template version $Tag" -ForegroundColor Red
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
    if (-not (Test-Path $CommonDir)) {
        Write-Host "❌ templates/common/ not found in template version $Tag" -ForegroundColor Red
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
    Write-Host "📦 Using template version: $Tag" -ForegroundColor Cyan
}

if (Test-Path $ProjectDir) {
    Write-Host "❌ Directory already exists: $ProjectDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $TemplatesDir)) {
    Write-Host "❌ Template variant not found: $TemplatesDir" -ForegroundColor Red
    Write-Host "   Available variants: co-develop (stable), co-design (stable), co-work (stable)" -ForegroundColor Yellow
    exit 1
}

# Check variant status
$VariantJson = Join-Path $TemplatesDir "variant.json"
if (Test-Path $VariantJson) {
    $variantData = Get-Content $VariantJson -Raw | ConvertFrom-Json
    if ($variantData.status -ne "stable") {
        Write-Host "⚠️  Variant '$Variant' has status: $($variantData.status)" -ForegroundColor Yellow
        Write-Host "   This variant may not be fully implemented." -ForegroundColor Yellow
        $confirm = Read-Host "   Continue anyway? [y/N]"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "Aborted." -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host "🚀 Scaffolding new project: $ProjectName" -ForegroundColor Cyan

# ── 1. Copy common/ first (shared infrastructure) ────────────────────────────
if (-not (Test-Path $CommonDir)) {
    Write-Host "❌ Common templates directory not found: $CommonDir" -ForegroundColor Red
    exit 1
}
New-Item -ItemType Directory -Path $ProjectDir -Force | Out-Null
robocopy $CommonDir $ProjectDir /E /NFL /NDL /NJH /NJS | Out-Null

# ── 2. Overlay variant/ on top (variant-specific files override common) ──────
if (-not (Test-Path $TemplatesDir)) {
    Write-Host "❌ Variant templates directory not found: $TemplatesDir" -ForegroundColor Red
    exit 1
}
robocopy $TemplatesDir $ProjectDir /E /NFL /NDL /NJH /NJS /IS | Out-Null

# ── 2. Remove docs/_examples (reference-only - not part of a real project) ───
$examplesDir = Join-Path $ProjectDir "docs\_examples"
if (Test-Path $examplesDir) { Remove-Item $examplesDir -Recurse -Force }

# ── 2.5. Remove any accidentally copied .cmd files and Enforce .ps1 / .sh Pairs ──
Get-ChildItem -Path $ProjectDir -Recurse -Filter "*.cmd" | Remove-Item -Force

$scriptsDir = Join-Path $ProjectDir "scripts"
if (Test-Path $scriptsDir) {
    # Check .ps1 missing .sh
    Get-ChildItem -Path $scriptsDir -Filter "*.ps1" | ForEach-Object {
        $base = $_.BaseName
        $shPair = Join-Path $scriptsDir "$base.sh"
        if (-not (Test-Path $shPair)) {
            Write-Host "❌ Script Pair Validation Failed: Missing .sh pair for $_.Name" -ForegroundColor Red
            exit 1
        }
    }
    # Check .sh missing .ps1
    Get-ChildItem -Path $scriptsDir -Filter "*.sh" | ForEach-Object {
        $base = $_.BaseName
        $ps1Pair = Join-Path $scriptsDir "$base.ps1"
        if (-not (Test-Path $ps1Pair)) {
            Write-Host "❌ Script Pair Validation Failed: Missing .ps1 pair for $_.Name" -ForegroundColor Red
            exit 1
        }
    }
}

# ── 3. Remove .gitkeep placeholders ────────────────────────────────────────────
Get-ChildItem -Path $ProjectDir -Recurse -Filter ".gitkeep" | Remove-Item -Force

# ── 4. Substitute placeholders in all text files ─────────────────
$extensions = @('.md', '.json', '.sh', '.ps1', '.yaml', '.yml', '.sample')
Get-ChildItem -Path $ProjectDir -Recurse -File |
  Where-Object { $_.Extension -in $extensions } |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($content) {
        $modified = $false
        if ($content -match '\[Project Name\]') { $content = $content -replace '\[Project Name\]', $ProjectName; $modified = $true }
        if ($content -match '\{\{PROJECT_NAME\}\}') { $content = $content -replace '\{\{PROJECT_NAME\}\}', $ProjectName; $modified = $true }
        if ($content -match '\{\{PROJECT_DESCRIPTION\}\}') { $content = $content -replace '\{\{PROJECT_DESCRIPTION\}\}', $Description; $modified = $true }
        if ($content -match '\{\{PROJECT_CHARACTERISTICS\}\}') { $content = $content -replace '\{\{PROJECT_CHARACTERISTICS\}\}', $TechStack; $modified = $true }

        if ($modified) {
            Set-Content $_.FullName $content -Encoding UTF8 -NoNewline
        }
    }
  }

# ── 4.5. Record template provenance in variant context file ───────────────────
$TemplateVersion = if ($Version -ne "") { $Version } elseif (Test-Path $VersionFile) { (Get-Content $VersionFile -Raw).Trim() } else { "unknown" }
$VariantContextMd = Join-Path $ProjectDir "docs\$Variant.context.md"
if (Test-Path $VariantContextMd) {
    $variantContextContent = Get-Content $VariantContextMd -Raw -Encoding UTF8
    if ($variantContextContent -notmatch "Template-Version:") {
        $provenance = "`n## Template Provenance`n`n- **Template-Version**: $TemplateVersion`n- **Template-Variant**: $Variant`n"
        Add-Content $VariantContextMd $provenance -Encoding UTF8
    }
}

# ── 4.6. Protect context.md from accidental overwrites (merge=ours) ───────────
$GitAttributesPath = Join-Path $ProjectDir ".gitattributes"
$mergeOursLine = "docs/context.md merge=ours"
if (Test-Path $GitAttributesPath) {
    $gitAttrContent = Get-Content $GitAttributesPath -Raw -Encoding UTF8
    if ($gitAttrContent -notmatch "docs/context\.md") {
        Add-Content $GitAttributesPath "`n$mergeOursLine" -Encoding UTF8
    }
} else {
    Set-Content $GitAttributesPath $mergeOursLine -Encoding UTF8
}

# ── 4.6. Inject AGENTS.md Skills into docs/context.md ────────────────────────
$AgentsMdPath = Join-Path $ProjectDir "AGENTS.md"
$ContextMdPath = Join-Path $ProjectDir "docs\context.md"

if ((Test-Path $AgentsMdPath) -and (Test-Path $ContextMdPath)) {
    $agentsContent = Get-Content $AgentsMdPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    $contextContent = Get-Content $ContextMdPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue

    if ($agentsContent -and $contextContent) {
        if ($agentsContent -match '(?ms)^## Skills\s*(?<tableData>\| Skill .*?)(?=\n---|\Z)') {
            $skillsTable = $Matches['tableData'].Trim()
            $replacement = "`$1`n" + $skillsTable.Replace('$', '$$') + "`n`$2"
            $newContextContent = $contextContent -replace '(?s)(<!-- DYNAMIC_SKILLS_START -->).*?(<!-- DYNAMIC_SKILLS_END -->)', $replacement
            
            if ($newContextContent -ne $contextContent) {
                Set-Content $ContextMdPath $newContextContent -Encoding UTF8 -NoNewline
                Write-Host "🔄 Injected dynamic skills from AGENTS.md into docs/context.md" -ForegroundColor Cyan
            }
        }
    }
}

# ── 5. Initialize git ──────────────────────────────────────────────────────────
Set-Location $ProjectDir
git init
git config core.hooksPath .githooks
git config core.fileMode false

# ── 6. Set executable bit on hooks and scripts (for WSL / Git Bash users) ──────
Get-ChildItem -Path (Join-Path $ProjectDir ".githooks") -File -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = ".githooks/" + $_.Name
    git update-index --add --chmod=+x $rel
    if ($LASTEXITCODE -ne 0) { Write-Warning "chmod +x failed for: $rel" }
}
Get-ChildItem -Path (Join-Path $ProjectDir "scripts") -File -Include "*.sh","*.ps1" -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = "scripts/" + $_.Name
    git update-index --add --chmod=+x $rel
    if ($LASTEXITCODE -ne 0) { Write-Warning "chmod +x failed for: $rel" }
}

# ── 7. Post-scaffold audit ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "Running post-scaffold audit..." -ForegroundColor Cyan
.\scripts\audit.ps1
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Project '$ProjectName' scaffolded and verified at: $ProjectDir" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Project scaffolded but audit found issues - review above before continuing." -ForegroundColor Yellow
}

# ── 8. Environment setup (env file, deps, initial commit) ─────────────────────
Write-Host ""
Write-Host "Running environment setup..." -ForegroundColor Cyan
& "$ProjectDir\scripts\setup.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  Setup encountered an error - run '.\scripts\setup.ps1' manually to retry." -ForegroundColor Yellow
}

# ── 9. Move into project directory ────────────────────────────────────────────
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor DarkGray
Write-Host "PROJECT DIRECTORY: $ProjectDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "WARNING: Your shell is still at the workspace root." -ForegroundColor Yellow
Write-Host "Run the following command to move into your new project:"
Write-Host ""
Write-Host "   cd '$ProjectDir'" -ForegroundColor Green
Write-Host ""
Write-Host "All subsequent work must be run from inside this directory."
Write-Host ("=" * 60) -ForegroundColor DarkGray
Write-Host ""

Set-Location $ProjectDir
Write-Host ""
Write-Host "Extension templates (ADR, analyst agent, skill, daily log):" -ForegroundColor DarkGray
Write-Host "  -> $TemplatesDir\docs\_examples" -ForegroundColor DarkGray

# ── Cleanup temp dir ───────────────────────────────────────────────────────────
if ($TempDir -and (Test-Path $TempDir)) {
    Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}





