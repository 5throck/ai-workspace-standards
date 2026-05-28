[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectName,
    [string]$Description = "A new project",
    [string]$TechStack = "Node.js / Python / etc",
    [string]$Variant = "co-develop",
    [string]$Version = "",
    [string]$Platform = "both"
)

function Initialize-UTF8Environment {
    [CmdletBinding()]
    param()

    try {
        # Force UTF-8 encoding for all operations
        $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        [System.Text.Encoding]::RegisterProvider([System.Text.CodePages]::CodePagesEncodingProvider]::Instance)

        # Set Git UTF-8 configuration
        & git config --local core.quotepath false 2>$null
        & git config --local i18n.commitencoding utf-8 2>$null
        & git config --local i18n.logOutputEncoding utf-8 2>$null

        Write-Verbose "UTF-8 environment initialized"
    }
    catch {
        throw "Failed to initialize UTF-8 environment: $_"
    }
}

function Validate-TemplateSync {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$TemplatePath
    )

    if (-not (Test-Path $TemplatePath)) {
        throw "Template path not found: $TemplatePath"
    }

    $requiredFiles = @(
        "CLAUDE.md",
        "GEMINI.md",
        "CONSTITUTION.md",
        ".gitignore",
        ".githooks/pre-commit"
    )

    $missingFiles = @()
    foreach ($file in $requiredFiles) {
        $filePath = Join-Path $TemplatePath $file
        if (-not (Test-Path $filePath)) {
            $missingFiles += $file
        }
    }

    if ($missingFiles.Count -gt 0) {
        throw "Missing required template files: $($missingFiles -join ', ')"
    }

    Write-Verbose "Template synchronization validated"
}

# UTF-8 encoding enforcement — must follow param() block (PowerShell parser requirement)
Initialize-UTF8Environment
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

# Validate Platform flag
if ($Platform -notin @("claude", "antigravity", "both")) {
    Write-Host "❌ --platform must be: claude, antigravity, or both (default: both)" -ForegroundColor Red
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
    # Note: PowerShell pipes corrupt binary streams, so write the tar archive to a temp file first
    $TarFile = [System.IO.Path]::GetTempFileName() + ".tar"
    try { git -C $WorkspaceRoot archive --format=tar $Tag "templates/common/" "templates/$Variant/" -o $TarFile 2>&1 | Out-Null } catch { }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $TarFile) -or (Get-Item $TarFile).Length -eq 0) {
        Write-Host "❌ Failed to create archive for template version $Tag" -ForegroundColor Red
        Write-Host "   This tag may predate the templates/common/ directory structure (introduced in v0.5.0)." -ForegroundColor Yellow
        Write-Host "   Available versions with common/ support: run .\scripts\list-template-versions.ps1" -ForegroundColor Yellow
        Remove-Item $TarFile -Force -ErrorAction SilentlyContinue
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
    try { tar -x -C $TempDir -f $TarFile 2>&1 | Out-Null } catch { }
    $tarExit = $LASTEXITCODE
    Remove-Item $TarFile -Force -ErrorAction SilentlyContinue
    if ($tarExit -ne 0) {
        Write-Host "❌ Failed to extract template version $Tag" -ForegroundColor Red
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
    Write-Host "   Available variants: co-develop (stable), co-design ( stable), co-work (stable), co-security (draft)" -ForegroundColor Yellow
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

# ── D-05: lifecycle-governance.json variant pre-check ─────────────────────────
$GovernanceJson = Join-Path $WorkspaceRoot "templates\common\lifecycle-governance.json"
$ValidateScript = Join-Path $WorkspaceRoot "scripts\validate-templates.ts"
$bunCmd = Get-Command bun -ErrorAction SilentlyContinue
if ($bunCmd -and (Test-Path $ValidateScript) -and (Test-Path $GovernanceJson)) {
    Write-Host ""
    Write-Host "Running lifecycle governance pre-check for variant '$Variant'…" -ForegroundColor Cyan

    $govData = Get-Content $GovernanceJson -Raw -Encoding UTF8 | ConvertFrom-Json
    $mandatoryDomains = $govData.variantValidationPolicy.mandatoryBeforeProjectCreation
    if (-not $mandatoryDomains) { $mandatoryDomains = @('variant', 'agent', 'skill') }

    try {
        $validateOutput = & bun $ValidateScript --variant $Variant --json 2>$null | Out-String
        $validateData   = $validateOutput | ConvertFrom-Json -ErrorAction SilentlyContinue
        $mandatoryErrors = @()
        if ($validateData -and $validateData.errors) {
            foreach ($err in $validateData.errors) {
                foreach ($domain in $mandatoryDomains) {
                    if ($err.check -match $domain) {
                        $mandatoryErrors += $err
                        break
                    }
                }
            }
        }
        if ($mandatoryErrors.Count -gt 0) {
            foreach ($err in $mandatoryErrors) {
                Write-Host "  ❌ $($err.message)" -ForegroundColor Red
            }
            Write-Host ""
            Write-Host "❌ Lifecycle governance pre-check FAILED for variant '$Variant'." -ForegroundColor Red
            Write-Host "   Fix the issues above before creating a project from this variant." -ForegroundColor Yellow
            Write-Host "   Run: bun scripts\validate-templates.ts --variant $Variant" -ForegroundColor Yellow
            exit 1
        } else {
            Write-Host "  ✅ Lifecycle governance pre-check passed (mandatory domains: $($mandatoryDomains -join ', '))" -ForegroundColor Green
        }
    } catch {
        Write-Host "  WARN: Governance pre-check could not complete: $_" -ForegroundColor Yellow
    }
}

Write-Host "🚀 Scaffolding new project: $ProjectName" -ForegroundColor Cyan

# ── Template validation before copying ───────────────────────────────────────
try {
    Validate-TemplateSync -TemplatePath $CommonDir
    Write-Host "  ✅ Common template validation passed" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Template validation failed: $_" -ForegroundColor Red
    exit 1
}

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

# ── 2.5. Apply platform profile ────────────────────────────────────────────────
if ($Platform -eq "claude") {
    $geminiFile = Join-Path $ProjectDir "GEMINI.md"
    if (Test-Path $geminiFile) { Remove-Item $geminiFile -Force }
} elseif ($Platform -eq "antigravity") {
    $claudeFile = Join-Path $ProjectDir "CLAUDE.md"
    if (Test-Path $claudeFile) { Remove-Item $claudeFile -Force }
}

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

# ── 4.5b. Update lifecycle.statusSince in the project's variant.json ─────────
$ProjectDate = Get-Date -Format "yyyy-MM-dd"
$ProjVariantJson = Join-Path $ProjectDir "variant.json"
if (Test-Path $ProjVariantJson) {
    $variantObj = Get-Content $ProjVariantJson -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $variantObj.lifecycle) {
        $variantObj | Add-Member -MemberType NoteProperty -Name lifecycle -Value ([PSCustomObject]@{})
    }
    $variantObj.lifecycle | Add-Member -MemberType NoteProperty -Name statusSince -Value $ProjectDate -Force
    $currentStatus = if ($variantObj.status) { $variantObj.status } else { "unknown" }
    $variantObj.lifecycle | Add-Member -MemberType NoteProperty -Name lastTransition -Value "initial → $currentStatus on $ProjectDate" -Force
    $variantObj | ConvertTo-Json -Depth 10 | Set-Content $ProjVariantJson -Encoding UTF8
    Write-Host "  ✅ variant.json lifecycle.statusSince set to $ProjectDate" -ForegroundColor Green
}

# ── 4.5c. Write scripts-snapshot.json with L1 script version map ──────────────
$ScriptsMd = Join-Path $WorkspaceRoot "scripts\SCRIPTS.md"
$SnapshotFile = Join-Path $ProjectDir "scripts-snapshot.json"
if (Test-Path $ScriptsMd) {
    $scriptsMdContent = Get-Content $ScriptsMd -Raw -Encoding UTF8
    $scriptsMap = @{}
    $inRegistry = $false
    foreach ($line in $scriptsMdContent -split "`n") {
        if ($line -match '^## Registry') { $inRegistry = $true; continue }
        if ($inRegistry -and $line -match '^## ') { break }
        if ($inRegistry -and $line -match '^\|') {
            $parts = $line -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
            if ($parts.Count -ge 4 -and $parts[2] -match '^\d+\.\d+\.\d+$') {
                $scriptName = $parts[0] -replace '`', ''
                $scriptsMap[$scriptName] = @{ version = $parts[2]; status = $parts[3] }
            }
        }
    }
    $snapshot = [ordered]@{
        created = $ProjectDate
        variant = $Variant
        l1_source = "templates/common/scripts"
        scripts = $scriptsMap
    }
    $snapshot | ConvertTo-Json -Depth 5 | Set-Content $SnapshotFile -Encoding UTF8
    Write-Host "  ✅ scripts-snapshot.json written ($($scriptsMap.Count) scripts)" -ForegroundColor Green
}

# ── 4.5d. Merge workspace scripts into package.json (Tier 2 integration) ──────
$PkgJsonPath = Join-Path $ProjectDir "package.json"
if (Test-Path $PkgJsonPath) {
    $pkgJson = Get-Content $PkgJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $pkgJson.scripts) {
        $pkgJson | Add-Member -MemberType NoteProperty -Name "scripts" -Value ([PSCustomObject]@{})
    }
    $workspaceScripts = @{
        "audit" = "bun scripts/audit.ts"
        "dev-sync" = "bun scripts/dev-sync.ts"
        "sync-md" = "bun scripts/sync-md.ts"
    }
    foreach ($script in $workspaceScripts.Keys) {
        if (-not $pkgJson.scripts.psobject.properties.match($script)) {
            $pkgJson.scripts | Add-Member -MemberType NoteProperty -Name $script -Value $workspaceScripts[$script]
        }
    }
    $pkgJson | ConvertTo-Json -Depth 10 | Set-Content $PkgJsonPath -Encoding UTF8
    Write-Host "  ✅ Tier 2 scripts merged into package.json" -ForegroundColor Green
}

# ── 4.6. Write template-version.txt for upgrade tracking ──────────────────────
$ClaudeDir = Join-Path $ProjectDir ".claude"
if (-not (Test-Path $ClaudeDir)) { New-Item -ItemType Directory -Path $ClaudeDir -Force | Out-Null }
$CreatedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
@"
variant=$Variant
version=$TemplateVersion
platform=$Platform
created=$CreatedAt
"@ | Set-Content (Join-Path $ClaudeDir "template-version.txt") -Encoding UTF8

# ── 4.7. Protect context.md from accidental overwrites (merge=ours) ───────────
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

# ── 4.8. Inject AGENTS.md Skills into docs/context.md ────────────────────────
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
try { git init 2>&1 | Out-Null } catch { }
git config core.hooksPath .githooks
git config core.fileMode false

# ── 6. Set executable bit on hooks and scripts (for WSL / Git Bash users) ──────
Get-ChildItem -Path (Join-Path $ProjectDir ".githooks") -File -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = ".githooks/" + $_.Name
    try { git update-index --add --chmod=+x $rel 2>&1 | Out-Null } catch {
        Write-Warning "chmod +x failed for: $rel"
    }
}
Get-ChildItem -Path (Join-Path $ProjectDir "scripts") -File -Include "*.sh","*.ps1" -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = "scripts/" + $_.Name
    try { git update-index --add --chmod=+x $rel 2>&1 | Out-Null } catch {
        Write-Warning "chmod +x failed for: $rel"
    }
}

# ── 6.5. Security Bootstrap Verification ──────────────────────────────────────
Write-Host ""
Write-Host "Running security bootstrap verification…" -ForegroundColor Cyan
$SecurityOk = $true

# Check 1: .gitleaks.toml
if (-not (Test-Path (Join-Path $ProjectDir ".gitleaks.toml"))) {
    Write-Host "  ❌ .gitleaks.toml not found" -ForegroundColor Red
    $SecurityOk = $false
} else { Write-Host "  ✅ .gitleaks.toml present" -ForegroundColor Green }

# Check 2: pre-commit hook
if (-not (Test-Path (Join-Path $ProjectDir ".githooks\pre-commit"))) {
    Write-Host "  ❌ .githooks/pre-commit not found" -ForegroundColor Red
    $SecurityOk = $false
} else { Write-Host "  ✅ .githooks/pre-commit present" -ForegroundColor Green }

# Check 3: .gitattributes eol=lf
$gitattribPath = Join-Path $ProjectDir ".gitattributes"
if ((Test-Path $gitattribPath) -and ((Get-Content $gitattribPath -Raw) -match "eol=lf")) {
    Write-Host "  ✅ .gitattributes has eol=lf" -ForegroundColor Green
} else {
    Write-Host "  ❌ .gitattributes missing eol=lf" -ForegroundColor Red
    $SecurityOk = $false
}

# Check 4: .gitignore has .env
$gitignorePath = Join-Path $ProjectDir ".gitignore"
if ((Test-Path $gitignorePath) -and ((Get-Content $gitignorePath -Raw) -match '\.env')) {
    Write-Host "  ✅ .gitignore excludes .env" -ForegroundColor Green
} else {
    Write-Host "  ❌ .gitignore missing .env exclusion" -ForegroundColor Red
    $SecurityOk = $false
}

# Check 5: core.hooksPath
$hooksPath = git -C $ProjectDir config core.hooksPath 2>$null
if ($LASTEXITCODE -eq 0 -and $hooksPath -match '\.githooks') {
    Write-Host "  ✅ git core.hooksPath configured" -ForegroundColor Green
} else {
    Write-Host "  ❌ git core.hooksPath not set to .githooks" -ForegroundColor Red
    $SecurityOk = $false
}

if (-not $SecurityOk) {
    Write-Host ""
    Write-Host "❌ Security bootstrap check FAILED. Fix the issues above before using this project." -ForegroundColor Red
    Write-Host "   Run '.\scripts\audit.ps1' after fixing to verify." -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✅ All security bootstrap checks passed" -ForegroundColor Green

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





