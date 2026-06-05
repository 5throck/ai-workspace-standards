# @version 1.6.3
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectName,
    [string]$Variant = "",
    [string]$Version = "",
    [string]$Platform = "both"
)

# UTF-8 encoding enforcement -- must follow param() block (PowerShell parser requirement)
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
    [System.Text.Encoding]::RegisterProvider([System.Text.CodePages.CodePagesEncodingProvider]::Instance)
} catch { }
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

# -- Detect bash-style --double-dash arguments (common mistake on PowerShell) --
# When a user types --variant or --version, PowerShell treats them as positional
# string values instead of named parameters, causing silent misrouting.
$doubleDashArgs = @()
if ($Variant  -match '^--') { $doubleDashArgs += $Variant }
if ($Version  -match '^--') { $doubleDashArgs += $Version }
if ($Platform -match '^--') { $doubleDashArgs += $Platform }

if ($doubleDashArgs.Count -gt 0) {
    Write-Host ""
    Write-Host "[FAIL] Double-dash (--) arguments detected. PowerShell uses a single dash (-)." -ForegroundColor Red
    Write-Host "   Detected: $($doubleDashArgs -join ', ')" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Correct PowerShell syntax:" -ForegroundColor Cyan
    Write-Host "   .\scripts\new-project.ps1 `"my-project`"" -ForegroundColor Green
    Write-Host "   .\scripts\new-project.ps1 `"my-project`" -variant co-work" -ForegroundColor Green
    Write-Host "   .\scripts\new-project.ps1 `"my-project`" -variant co-develop -version 0.5.0" -ForegroundColor Green
    Write-Host ""
    Write-Host "   (On bash/Linux: bash scripts/new-project.sh `"my-project`" --variant co-work)" -ForegroundColor DarkGray
    Write-Host ""
    exit 1
}

# Validate ProjectName: alphanumeric, hyphens, underscores, slashes, dots only; block path traversal; max 100 chars
if ($ProjectName -notmatch '^[a-zA-Z0-9_/\.-]+$' -or $ProjectName -match '\.\.') {
    Write-Host "[FAIL] Invalid project name: '$ProjectName'" -ForegroundColor Red
    Write-Host "   Only letters, numbers, hyphens (-), underscores (_), and slashes (/) are allowed, without path traversal (..)." -ForegroundColor Yellow
    exit 1
}
if ($ProjectName.Length -gt 64) {
    Write-Host "[FAIL] Project name too long ($($ProjectName.Length) chars). Maximum is 64 characters." -ForegroundColor Red
    exit 1
}

# Validate Variant against dynamically detected list (prevent path traversal attacks)
if ($Variant -ne "") {
    $_wsRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    # Dynamic variant detection — git tag or filesystem
    if ($Version -ne "") {
        $_tag = "template-v$Version"
        $gitOutput = git -C $_wsRoot archive $_tag --list 2>$null
        $validVariants = $gitOutput | Where-Object { $_ -match "^templates/co-[^/]+/variant\.json$" } |
            ForEach-Object { ($_ -replace "^templates/", "") -replace "/variant\.json$", "" } | Sort-Object
    } else {
        $validVariants = Get-ChildItem (Join-Path $_wsRoot "templates") -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match "^co-" } |
            Select-Object -ExpandProperty Name | Sort-Object
    }
    if ($Variant -notin $validVariants) {
        Write-Host "[FAIL] Invalid variant: $Variant" -ForegroundColor Red
        Write-Host "   Valid variants: $($validVariants -join ', ')" -ForegroundColor Yellow
        exit 1
    }
}

# Validate Platform flag
if ($Platform -notin @("claude", "antigravity", "both")) {
    Write-Host "[FAIL] --platform must be: claude, antigravity, or both (default: both)" -ForegroundColor Red
    exit 1
}

# -- Require explicit variant selection ------------------------------------------
if ($Variant -eq "") {
    $_wsRoot2 = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $availableVariants = Get-ChildItem (Join-Path $_wsRoot2 "templates") -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match "^co-" } |
        Select-Object -ExpandProperty Name | Sort-Object
    Write-Host ""
    Write-Host "[INFO] No variant specified. Please choose one:" -ForegroundColor Cyan
    foreach ($v in $availableVariants) {
        Write-Host "   $v" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "   Usage: .\scripts\new-project.ps1 `"$ProjectName`" -Variant <variant>" -ForegroundColor White
    Write-Host ""
    exit 1
}

# -- Workspace Root Resolution ------------------------------------------------------
$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ProjectDir    = Join-Path $WorkspaceRoot $ProjectName
$TemplatesDir  = Join-Path (Join-Path $WorkspaceRoot "templates") $Variant
$CommonDir     = Join-Path (Join-Path $WorkspaceRoot "templates") "common"
$VersionFile   = Join-Path (Join-Path $WorkspaceRoot "templates") "VERSION"

# -- Version resolution ---------------------------------------------------------  # TEST: none
$TempDir = $null
if ($Version -ne "") {
    $Tag = "template-v$Version"
    $tagExists = git -C $WorkspaceRoot tag -l $Tag 2>$null
    if (-not $tagExists) {
        Write-Host "[FAIL] Template version not found: $Tag" -ForegroundColor Red
        Write-Host "   Run: bun scripts/list-template-versions.ts" -ForegroundColor Yellow
        exit 1
    }
    $TempDir = [System.IO.Path]::GetTempPath() + [System.IO.Path]::GetRandomFileName()
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
    $TarFile = [System.IO.Path]::GetTempFileName() + ".tar"
    try { git -C $WorkspaceRoot archive --format=tar $Tag "templates/common/" "templates/$Variant/" -o $TarFile 2>&1 | Out-Null } catch { }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $TarFile) -or (Get-Item $TarFile).Length -eq 0) {
        Write-Host "[FAIL] Failed to create archive for template version $Tag" -ForegroundColor Red
        Write-Host "   This tag may predate the templates/common/ directory structure (introduced in v0.5.0)." -ForegroundColor Yellow
        Write-Host "   Available versions with common/ support: run bun scripts/list-template-versions.ts" -ForegroundColor Yellow
        Remove-Item $TarFile -Force -ErrorAction SilentlyContinue
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
    try { tar -x -C $TempDir -f $TarFile 2>&1 | Out-Null } catch { }
    $tarExit = $LASTEXITCODE
    Remove-Item $TarFile -Force -ErrorAction SilentlyContinue
    if ($tarExit -ne 0) {
        Write-Host "[FAIL] Failed to extract template version $Tag" -ForegroundColor Red
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
    $CommonDir    = Join-Path (Join-Path $TempDir "templates") "common"
    $TemplatesDir = Join-Path (Join-Path $TempDir "templates") $Variant
    if (-not (Test-Path $TemplatesDir)) {
        Write-Host "[FAIL] Variant '$Variant' not found in template version $Tag" -ForegroundColor Red
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
    if (-not (Test-Path $CommonDir)) {
        Write-Host "[FAIL] templates/common/ not found in template version $Tag" -ForegroundColor Red
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
        exit 1
    }
    Write-Host "[PKG] Using template version: $Tag" -ForegroundColor Cyan
}

if (Test-Path $ProjectDir) {
    Write-Host "[FAIL] Directory already exists: $ProjectDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $TemplatesDir)) {
    Write-Host "[FAIL] Template variant not found: $TemplatesDir" -ForegroundColor Red
    $availableNow = (Get-ChildItem (Join-Path $WorkspaceRoot "templates") -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match "^co-" } | Select-Object -ExpandProperty Name) -join ", "
    Write-Host "   Available variants: $availableNow" -ForegroundColor Yellow
    exit 1
}

# Check variant status
$VariantJson = Join-Path $TemplatesDir "variant.json"
if (Test-Path $VariantJson) {
    $variantData = Get-Content $VariantJson -Raw | ConvertFrom-Json
    if ($variantData.status -ne "stable") {
        Write-Host "[WARN]  Variant '$Variant' has status: $($variantData.status)" -ForegroundColor Yellow
        Write-Host "   This variant may not be fully implemented." -ForegroundColor Yellow
        $confirm = Read-Host "   Continue anyway? [y/N]"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "Aborted." -ForegroundColor Red
            exit 1
        }
    }
}

# -- D-05: lifecycle-governance.json variant pre-check ------------------------- # TEST: none
$GovernanceJson = Join-Path $WorkspaceRoot "docs\templates\lifecycle-governance.json"
$ValidateScript = Join-Path $WorkspaceRoot "scripts\validate-templates.ts"
if ((Get-Command bun -ErrorAction SilentlyContinue) -and (Test-Path $ValidateScript) -and (Test-Path $GovernanceJson)) {
    Write-Host ""
    Write-Host "Running lifecycle governance pre-check for variant '$Variant'..." -ForegroundColor Cyan

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
                Write-Host "  [FAIL] $($err.message)" -ForegroundColor Red
            }
            Write-Host ""
            Write-Host "[FAIL] Lifecycle governance pre-check FAILED for variant '$Variant'." -ForegroundColor Red
            Write-Host "   Fix the issues above before creating a project from this variant." -ForegroundColor Yellow
            Write-Host "   Run: bun scripts\validate-templates.ts --variant $Variant" -ForegroundColor Yellow
            exit 1
        } else {
            Write-Host "  [OK] Lifecycle governance pre-check passed (mandatory domains: $($mandatoryDomains -join ', '))" -ForegroundColor Green
        }
    } catch {
        Write-Host "  WARN: Governance pre-check could not complete: $_" -ForegroundColor Yellow
    }
}

Write-Host " Scaffolding new project: $ProjectName" -ForegroundColor Cyan

# -- Template validation before copying ----------------------------------------  # TEST: none
if (Get-Command "bun" -ErrorAction SilentlyContinue) {
    Write-Host "Validating template integrity..." -ForegroundColor Cyan
    $validationExit = & bun "$WorkspaceRoot/scripts/helpers/template-validation.ts" $Variant $CommonDir $TemplatesDir 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] Template validation failed: $validationExit" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[WARN]  Template validation skipped (bun not available or helper missing)" -ForegroundColor Yellow
}

# -- 1. Copy common/ first (shared infrastructure) ---------------------------- # TEST: Test 1, Test 7
if (-not (Test-Path $CommonDir)) {
    Write-Host "[FAIL] Common templates directory not found: $CommonDir" -ForegroundColor Red
    exit 1
}
New-Item -ItemType Directory -Path $ProjectDir -Force | Out-Null
robocopy $CommonDir $ProjectDir /E /NFL /NDL /NJH /NJS | Out-Null

# Exclude workspace-root-only files that must NOT be copied into new projects.
# package.json at the root is a workspace management artifact (bun scripts for
# audit, dev-sync, agent:verify, etc.) - not an app dependency manifest.
# New projects that genuinely need Node.js should create their own package.json.
$workspaceFilesToRemove = @("package.json", "package-lock.json", "bun.lock", "bun.lockb")
foreach ($file in $workspaceFilesToRemove) {
    $filePath = Join-Path $ProjectDir $file
    if (Test-Path $filePath) {
        Remove-Item $filePath -Force
        Write-Host "  [SKIP] Excluded workspace-only file: $file"
    }
}

# -- 2. Overlay variant/ on top (variant-specific files override common) ------ # TEST: Test 1, Test 7
if (-not (Test-Path $TemplatesDir)) {
    Write-Host "[FAIL] Variant templates directory not found: $TemplatesDir" -ForegroundColor Red
    exit 1
}

# Copy with extends resolution - process files BEFORE losing template context
Write-Host " Copying variant templates with extends resolution..."
Get-ChildItem -Path $TemplatesDir -Recurse -Filter "*.md" | ForEach-Object {
    $srcFile = $_.FullName
    $relPath = $srcFile.Substring($TemplatesDir.Length + 1)
    $destFile = Join-Path $ProjectDir $relPath

    if (Select-String -Path $srcFile -Pattern '^extends:' -Quiet) {
        $extendsLine = Select-String -Path $srcFile -Pattern '^extends:' | Select-Object -First 1
        $extendsPath = $extendsLine.Line.Replace("extends:", "").Trim()
        $srcDir = Split-Path $srcFile
        try {
            $skeletonAbsPath = (Join-Path $srcDir $extendsPath | Resolve-Path -ErrorAction Stop).Path
            $destDir = Split-Path $destFile
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item $srcFile $destFile -Force
            $mergeResult = & bun "scripts/helpers/merge-frontmatter.ts" $destFile $skeletonAbsPath 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[WARN]  Extends merge failed: $relPath" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "[WARN]  Skeleton not found for $relPath (extends: $extendsPath)" -ForegroundColor Yellow
            $destDir = Split-Path $destFile
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item $srcFile $destFile -Force
        }
    } else {
        $destDir = Split-Path $destFile
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        Copy-Item $srcFile $destFile -Force
    }
}

# Copy all non-.md files normally
Get-ChildItem -Path $TemplatesDir -Recurse -File | Where-Object { $_.Extension -ne ".md" } | ForEach-Object {
    $srcFile = $_.FullName
    $relPath = $srcFile.Substring($TemplatesDir.Length + 1)
    $destFile = Join-Path $ProjectDir $relPath
    $destDir = Split-Path $destFile
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item $srcFile $destFile -Force
}

# -- 2.5. Verify extends resolution (post-copy validation) --------------------  # TEST: Test 18
Write-Host " Verifying extends resolution..."
$extendsFiles = Get-ChildItem -Path $ProjectDir -Recurse -Filter "*.md" | Where-Object {
    Select-String -Path $_.FullName -Pattern '^extends:' -Quiet
}
if ($extendsFiles.Count -gt 0) {
    Write-Host "[WARN]  Found $($extendsFiles.Count) files with unresolved extends field:" -ForegroundColor Yellow
    $extendsFiles | ForEach-Object { Write-Host "   - $($_.FullName)" -ForegroundColor Yellow }
    Write-Host "   This should not happen - extends fields should be resolved during copy." -ForegroundColor Yellow
} else {
    Write-Host "  [OK] All extends fields resolved" -ForegroundColor Green
}

# -- 2.6. Apply platform profile -----------------------------------------------  # TEST: Test 8
if ($Platform -eq "claude") {
    $geminiFile = Join-Path $ProjectDir "GEMINI.md"
    if (Test-Path $geminiFile) { Remove-Item $geminiFile -Force }
} elseif ($Platform -eq "antigravity") {
    $claudeFile = Join-Path $ProjectDir "CLAUDE.md"
    if (Test-Path $claudeFile) { Remove-Item $claudeFile -Force }
}

# -- 2.7. Remove any accidentally copied .cmd files ---------------------------  # TEST: Test 17
Get-ChildItem -Path $ProjectDir -Recurse -Filter "*.cmd" | Remove-Item -Force

# -- 3. Remove docs/_examples (reference-only - not part of a real project) --  # TEST: Test 14
$examplesDir = Join-Path $ProjectDir "docs\_examples"
if (Test-Path $examplesDir) { Remove-Item $examplesDir -Recurse -Force }

# -- 3.5. Enforce .sh / .ps1 script pairs --------------------------------------  # TEST: Test 18
$scriptsDir = Join-Path $ProjectDir "scripts"
if (Test-Path $scriptsDir) {
    $pairOk = $true
    Get-ChildItem -Path $scriptsDir -Filter "*.ps1" | ForEach-Object {
        $base = $_.BaseName
        if ($base -like "test-*") { return }
        $shPair = Join-Path $scriptsDir "$base.sh"
        if (-not (Test-Path $shPair)) {
            Write-Host "[FAIL] Script Pair Validation Failed: Missing .sh pair for $($_.Name)" -ForegroundColor Red
            $pairOk = $false
        }
    }
    Get-ChildItem -Path $scriptsDir -Filter "*.sh" | ForEach-Object {
        $base = $_.BaseName
        if ($base -like "test-*") { return }
        $ps1Pair = Join-Path $scriptsDir "$base.ps1"
        if (-not (Test-Path $ps1Pair)) {
            Write-Host "[FAIL] Script Pair Validation Failed: Missing .ps1 pair for $($_.Name)" -ForegroundColor Red
            $pairOk = $false
        }
    }
    if (-not $pairOk) {
        Write-Host "   Fix script pairs in templates before scaffolding." -ForegroundColor Yellow
        exit 1
    }
}

# -- 3.6. Agent Override Merge (VARIANT-SECTION substitution) ----------------- # TEST: Test 20, Test 21, Test 22
# For additive overrides: substitute VARIANT-SECTION placeholders with variant content
# NOTE: Skip files that use 'extends' pattern (already processed above)
$VariantJson = Join-Path $TemplatesDir "variant.json"
if ((Test-Path $VariantJson) -and (Get-Command "bun" -ErrorAction SilentlyContinue)) {
    $BunScript = @'
const fs = require('fs');
const path = require('path');
const [,, commonDir, variantDir, projectDir] = process.argv;

const variantJsonPath = path.join(variantDir, 'variant.json');
if (!fs.existsSync(variantJsonPath)) process.exit(0);

const variant = JSON.parse(fs.readFileSync(variantJsonPath, 'utf8'));
const overrides = variant.agent_overrides || {};

for (const [agentName, override] of Object.entries(overrides)) {
  if (override.type !== 'additive') continue;

  const skeletonFile = path.join(commonDir, 'agents', agentName + '.md');
  const variantFile = path.join(variantDir, 'agents', agentName + '.md');
  const outFile = path.join(projectDir, 'agents', agentName + '.md');

  if (!fs.existsSync(skeletonFile) || !fs.existsSync(variantFile) || !fs.existsSync(outFile)) continue;

  // Check if variant file uses 'extends' pattern - if so, skip additive processing
  const variantContent = fs.readFileSync(variantFile, 'utf8');
  if (variantContent.match(/^---\n[\s\S]*?^extends:/m)) {
    console.log('  [SKIP-ADDITIVE] agents/' + agentName + '.md (uses extends pattern)');
    continue;
  }

  let skeleton = fs.readFileSync(skeletonFile, 'utf8');

  // Use js-yaml to preserve nested structures (e.g. tier: {antigravity: high})
  const yaml = require('js-yaml');
  function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) return { fm: {}, body: content };
    try {
      const fm = yaml.load(match[1]) || {};
      return { fm, body: content.slice(match[0].length) };
    } catch {
      return { fm: {}, body: content };
    }
  }

  const { fm: skelFm, body: skelBody } = parseFrontmatter(skeleton);
  const { fm: varFm, body: varBody } = parseFrontmatter(variantContent);
  const mergedFm = { ...skelFm, ...varFm };
  const hasFrontmatter = Object.keys(mergedFm).length > 0;
  const fmStr = hasFrontmatter
    ? '---\n' + yaml.dump(mergedFm).trimEnd() + '\n---\n'
    : '';

  skeleton = fmStr + skelBody;
  const effectiveVariantContent = varBody;

  const allSections = {};
  const lines = effectiveVariantContent.split('\n');
  let currentHeading = null;
  let currentLines = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentHeading) allSections[currentHeading] = currentLines.join('\n');
      currentHeading = line.slice(3).trim();
      currentLines = [line];
    } else if (currentHeading) {
      currentLines.push(line);
    }
  }
  if (currentHeading) allSections[currentHeading] = currentLines.join('\n');

  const headingMap = {
    'agent-roster': 'Agent Roster',
    'governance-workflow': 'Governance Workflow',
    'dispatch-protocol': 'Dispatch Protocol',
  };

  const vsRegex = /<!-- VARIANT-SECTION: ([\w-]+) -->([\s\S]*?)<!-- END VARIANT-SECTION -->/g;
  skeleton = skeleton.replace(vsRegex, (match, sectionId) => {
    const heading = headingMap[sectionId];
    if (heading && allSections[heading]) {
      return allSections[heading];
    }
    return '';
  });

  fs.writeFileSync(outFile, skeleton, 'utf8');
  console.log('  [SECTION-MERGE] agents/' + agentName + '.md (skeleton + variant sections)');
}
'@
    $TmpScript = [System.IO.Path]::GetTempFileName() + ".mjs"
    try {
        Set-Content $TmpScript $BunScript -Encoding UTF8
        & bun $TmpScript $CommonDir $TemplatesDir $ProjectDir
    } finally {
        Remove-Item $TmpScript -Force -ErrorAction SilentlyContinue
    }
}

# -- 4. Remove .gitkeep placeholders -------------------------------------------  # TEST: Test 15
Get-ChildItem -Path $ProjectDir -Recurse -Filter ".gitkeep" | Remove-Item -Force

# -- 5. Substitute placeholders in all text files ------------------------------ # TEST: Test 3, Test 2
if (Get-Command "bun" -ErrorAction SilentlyContinue) {
    & bun "$WorkspaceRoot/scripts/helpers/substitute-placeholders.ts" $ProjectDir $ProjectName "A new project" "" | Out-Null
} else {
    Write-Host "[WARN]  Placeholder substitution skipped (bun not available or helper missing)" -ForegroundColor Yellow
}

# -- 5.5b. Update lifecycle.statusSince in the project's variant.json --------  # TEST: Test 9
$ProjectDate = Get-Date -Format "yyyy-MM-dd"
$ProjVariantJson = Join-Path $ProjectDir "variant.json"
if (Test-Path $ProjVariantJson) {
    if (Get-Command "bun" -ErrorAction SilentlyContinue) {
        & bun "$WorkspaceRoot/scripts/helpers/update-variant-lifecycle.ts" $ProjectDir $ProjectDate $Variant | Out-Null
    }
}

# -- 5.5c. Write scripts-snapshot.json with L1 script version map -------------  # TEST: Test 10
$ScriptsMd = Join-Path $WorkspaceRoot "scripts\SCRIPTS.md"
if (Test-Path $ScriptsMd) {
    if (Get-Command "bun" -ErrorAction SilentlyContinue) {
        & bun "$WorkspaceRoot/scripts/helpers/write-scripts-snapshot.ts" $ProjectDir $ProjectDate $Variant "templates/common/scripts" | Out-Null
    }
}

# -- 5.5d. Merge workspace scripts into package.json (Tier 2 integration) -------  # TEST: Test 11
$PkgJsonPath = Join-Path $ProjectDir "package.json"
if (Test-Path $PkgJsonPath) {
    if (Get-Command "bun" -ErrorAction SilentlyContinue) {
        & bun "$WorkspaceRoot/scripts/helpers/merge-package-scripts.ts" $ProjectDir | Out-Null
    }
}

# -- 5.5. Record template provenance in variant context file -------------------  # TEST: none
$TemplateVersion = if ($Version -ne "") { $Version } elseif (Test-Path $VersionFile) { (Get-Content $VersionFile -Raw).Trim() } else { "unknown" }
$VariantContextMd = Join-Path $ProjectDir "docs\$Variant.context.md"
if (Test-Path $VariantContextMd) {
    $variantContextContent = Get-Content $VariantContextMd -Raw -Encoding UTF8
    if ($variantContextContent -notmatch "Template-Version:") {
        $provenance = "`n## Template Provenance`n`n- **Template-Version**: $TemplateVersion`n- **Template-Variant**: $Variant`n"
        Add-Content $VariantContextMd $provenance -Encoding UTF8
    }
}

# -- 5.6. Write template-version.txt for upgrade tracking ---------------------  # TEST: Test 12
$ClaudeDir = Join-Path $ProjectDir ".claude"
if (-not (Test-Path $ClaudeDir)) { New-Item -ItemType Directory -Path $ClaudeDir -Force | Out-Null }
$CreatedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
@"
variant=$Variant
version=$TemplateVersion
platform=$Platform
created=$CreatedAt
"@ | Set-Content (Join-Path $ClaudeDir "template-version.txt") -Encoding UTF8

# -- 5.6b. Inject AGENTS.md Skills into docs/context.md ----------------------  # TEST: Test 19
if (Get-Command "bun" -ErrorAction SilentlyContinue) {
    & bun "$WorkspaceRoot/scripts/helpers/inject-skills.ts" $ProjectDir | Out-Null
}

# -- 5.7. Protect context.md from accidental overwrites (merge=ours) ----------  # TEST: Test 13
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

# -- 6. Cleanup Strictly L0 Files ----------------------------------------------
$l0Scripts = @(
    "publish-to-template.ts", "propagate-to-templates.ts", "validate-templates.ts",
    "list-template-versions.ts", "generate-version-manifest.ts", "generate-scripts-readme.ts",
    "verify-template-integrity.ts", "verify-new-project-tests.ts", "test-new-project.ts",
    "new-project.ps1", "new-project.sh", "upgrade-project.ps1", "upgrade-project.sh",
    "verify-readme-sync.ts"
)
foreach ($script in $l0Scripts) {
    $filePath = Join-Path $ProjectDir "scripts\$script"
    if (Test-Path $filePath) { Remove-Item $filePath -Force }
}

$l0Skills = @("simulate-project-creation")
foreach ($skill in $l0Skills) {
    foreach ($base in @("skills", ".claude\skills", ".gemini\skills")) {
        $skillPath = Join-Path $ProjectDir "$base\$skill"
        if (Test-Path $skillPath) { Remove-Item $skillPath -Recurse -Force }
    }
}

# -- 6.1 Make scripts and hooks executable ---------------------------------------  # TEST: Test 16, Test 5
# (Note: chmod not available on Windows -- executable bits set via git update-index after init)

# -- 7. Initialize git ----------------------------------------------------------  # TEST: Test 4
$OriginalLocation = Get-Location
Set-Location $ProjectDir
try { git init 2>&1 | Out-Null } catch { }
git config core.hooksPath .githooks
git config core.fileMode false
$gitEmail = git config user.email 2>$null
if (-not $gitEmail) {
    git config user.email "scaffold-bot@local"
    git config user.name "Scaffold Bot"
}

# Mark hooks and scripts executable in git index
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

# -- 6.5. Security Bootstrap Verification --------------------------------------  # TEST: Test 6
Write-Host ""
Write-Host "Running security bootstrap verification..." -ForegroundColor Cyan
$SecurityOk = $true

# Check 1: .gitleaks.toml
if (-not (Test-Path (Join-Path $ProjectDir ".gitleaks.toml"))) {
    Write-Host "  [FAIL] .gitleaks.toml not found" -ForegroundColor Red
    $SecurityOk = $false
} else { Write-Host "  [OK] .gitleaks.toml present" -ForegroundColor Green }

# Check 2: pre-commit hook
if (-not (Test-Path (Join-Path $ProjectDir ".githooks\pre-commit"))) {
    Write-Host "  [FAIL] .githooks/pre-commit not found" -ForegroundColor Red
    $SecurityOk = $false
} else { Write-Host "  [OK] .githooks/pre-commit present" -ForegroundColor Green }

# Check 3: .gitattributes eol=lf
$gitattribPath = Join-Path $ProjectDir ".gitattributes"
if ((Test-Path $gitattribPath) -and ((Get-Content $gitattribPath -Raw) -match "eol=lf")) {
    Write-Host "  [OK] .gitattributes has eol=lf" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] .gitattributes missing eol=lf" -ForegroundColor Red
    $SecurityOk = $false
}

# Check 4: .gitignore has .env
$gitignorePath = Join-Path $ProjectDir ".gitignore"
if ((Test-Path $gitignorePath) -and ((Get-Content $gitignorePath -Raw) -match '\.env')) {
    Write-Host "  [OK] .gitignore excludes .env" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] .gitignore missing .env exclusion" -ForegroundColor Red
    $SecurityOk = $false
}

# Check 5: core.hooksPath
$hooksPath = git -C $ProjectDir config core.hooksPath 2>$null
if ($LASTEXITCODE -eq 0 -and $hooksPath -match '\.githooks') {
    Write-Host "  [OK] git core.hooksPath configured" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] git core.hooksPath not set to .githooks" -ForegroundColor Red
    $SecurityOk = $false
}

if (-not $SecurityOk) {
    Write-Host ""
    Write-Host "[FAIL] Security bootstrap check FAILED. Fix the issues above before using this project." -ForegroundColor Red
    Write-Host "   Run 'bash scripts/audit.sh' after fixing to verify." -ForegroundColor Yellow
    Set-Location $OriginalLocation
    exit 1
}
Write-Host "  [OK] All security bootstrap checks passed" -ForegroundColor Green

Set-Location $OriginalLocation

# -- 8. Post-scaffold audit ----------------------------------------------------  # TEST: none
# NOTE: Audit runs from $WorkspaceRoot (workspace root) intentionally — it validates
# workspace-wide integrity after project creation. The rootAllowlist exception in
# audit.ts (Fix-1) handles the newly created project directory so it does not appear
# as a stray file and cause a false-positive failure.
Write-Host ""
Write-Host "Running post-scaffold audit (from workspace root)..." -ForegroundColor Cyan
& bun "$WorkspaceRoot/scripts/audit.ts"
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] Project '$ProjectName' scaffolded and verified at: $ProjectDir" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[WARN]  Project scaffolded but audit found issues - review above before continuing." -ForegroundColor Yellow
}


# -- 9. Environment setup (env file, deps, initial commit) -------------------- # TEST: none
Write-Host ""
Write-Host "Running environment setup..." -ForegroundColor Cyan
Set-Location $ProjectDir
& ".\scripts\setup.ps1"
$setupExit = $LASTEXITCODE
Set-Location $OriginalLocation
if ($setupExit -ne 0) {
    Write-Host ""
    Write-Host "[WARN]  Setup encountered an error - run '.\scripts\setup.ps1' manually to retry." -ForegroundColor Yellow
}

# -- 10. Move into project directory -------------------------------------------  # TEST: none
Write-Host ""
Write-Host ("-" * 60) -ForegroundColor DarkGray
Write-Host "PROJECT DIRECTORY: $ProjectDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: Your shell is still at the workspace root." -ForegroundColor Yellow
Write-Host "   Run the following command to move into your new project:"
Write-Host ""
Write-Host "   cd '$ProjectDir'" -ForegroundColor Green
Write-Host ""
Write-Host "   All subsequent work must be run from inside this directory."
Write-Host ("-" * 60) -ForegroundColor DarkGray
Write-Host ""
Write-Host "Extension templates (ADR, analyst agent, skill, daily log):"
Write-Host "  -> $TemplatesDir\docs\_examples"

# --- Dynamic Plugin Injection ---
$InjectScript = Join-Path $WorkspaceRoot 'scripts\helpers\inject-global-plugins.ts'
if ((Get-Command bun -ErrorAction SilentlyContinue) -and (Test-Path $InjectScript)) {
    bun $InjectScript $ProjectDir $Platform
}

# -- Cleanup temp dir -----------------------------------------------------------  # TEST: none
if ($TempDir -and (Test-Path $TempDir)) {
    Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}
