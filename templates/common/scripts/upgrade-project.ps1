[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ProjectPath,

    [ValidateSet('co-develop', 'co-design', 'co-work')]
    [string]$Variant = '',

    [ValidateSet('claude', 'antigravity', 'both')]
    [string]$Platform = 'both',

    [switch]$DryRun
)

# UTF-8 enforcement
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

# ============================================================
# Helpers
# ============================================================
function DryPrefix {
    if ($DryRun) { return '[DRY RUN] ' } else { return '' }
}

function Resolve-TemplatePath {
    param([string]$Rel)
    $variantFile = Join-Path $TemplatesDir $Rel
    $commonFile  = Join-Path $CommonDir  $Rel
    if (Test-Path $variantFile) { return $variantFile }
    if (Test-Path $commonFile)  { return $commonFile }
    return $null
}

function Show-DiffSummary {
    param([string]$OldPath, [string]$NewPath)
    if (-not (Test-Path $OldPath)) {
        Write-Host "    (project file does not exist - will create)"
        return
    }
    $oldLines = (Get-Content $OldPath -ErrorAction SilentlyContinue).Count
    $newLines = (Get-Content $NewPath -ErrorAction SilentlyContinue).Count
    # Use git diff --no-index for a line count
    $diffOut = git diff --no-index --stat "$OldPath" "$NewPath" 2>&1
    $added   = 0
    $removed = 0
    if ($diffOut) {
        foreach ($line in $diffOut) {
            if ($line -match '(\d+) insertion') { $added   = [int]$Matches[1] }
            if ($line -match '(\d+) deletion')  { $removed = [int]$Matches[1] }
        }
    }
    Write-Host "    Lines: $oldLines -> $newLines  (+${added}/-${removed})"
}

function Merge-WorkspaceManaged {
    param(
        [string]$ProjectFile,
        [string]$TemplateFile,
        [string]$Rel
    )

    # Check template has markers
    $tplContent = Get-Content $TemplateFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($tplContent -notmatch '<!-- WORKSPACE-MANAGED -->') {
        Write-Host "    INFO: Template has no WORKSPACE-MANAGED markers - skipping $Rel"
        return
    }

    # Extract template managed block (inclusive of markers)
    $markerStart = '<!-- WORKSPACE-MANAGED -->'
    $markerEnd   = '<!-- /WORKSPACE-MANAGED -->'
    $tplBlock    = [regex]::Match($tplContent, [regex]::Escape($markerStart) + '[\s\S]*?' + [regex]::Escape($markerEnd))
    if (-not $tplBlock.Success) {
        Write-Host "    WARN: Could not extract managed block from template: $Rel"
        return
    }
    $managedBlock = $tplBlock.Value

    if (-not (Test-Path $ProjectFile)) {
        Write-Host "    INFO: Project file does not exist, will create from template"
        if (-not $DryRun) {
            $parentDir = Split-Path $ProjectFile -Parent
            if (-not (Test-Path $parentDir)) { New-Item -ItemType Directory -Path $parentDir -Force | Out-Null }
            Copy-Item $TemplateFile $ProjectFile -Force
        }
        Write-Host "    $(DryPrefix)CREATED: $Rel"
        return
    }

    $projContent = Get-Content $ProjectFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue

    if ($projContent -match [regex]::Escape($markerStart)) {
        # Replace existing managed block
        $newContent = [regex]::Replace(
            $projContent,
            [regex]::Escape($markerStart) + '[\s\S]*?' + [regex]::Escape($markerEnd),
            [regex]::Escape($managedBlock).Replace('\', '\\')  # literal replacement
        )
        # Note: [regex]::Replace with literal replacement string - use $_ approach
        $newContent = [regex]::Replace(
            $projContent,
            ([regex]::Escape($markerStart) + '[\s\S]*?' + [regex]::Escape($markerEnd)),
            { $managedBlock }
        )
        if (-not $DryRun) {
            [System.IO.File]::WriteAllText($ProjectFile, $newContent, [System.Text.Encoding]::UTF8)
        }
        Write-Host "    $(DryPrefix)MERGED managed section in: $Rel"
    } else {
        # No markers in project file - append at end
        Write-Host "    WARNING: $Rel has no WORKSPACE-MANAGED markers."
        Write-Host "             Appending managed block at end of file."
        if (-not $DryRun) {
            $appended = $projContent + "`n`n" + $managedBlock + "`n"
            [System.IO.File]::WriteAllText($ProjectFile, $appended, [System.Text.Encoding]::UTF8)
        }
        Write-Host "    $(DryPrefix)APPENDED managed block to: $Rel"
    }
}

# ============================================================
# Resolve paths
# ============================================================
$WorkspaceRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$VersionFile   = Join-Path $WorkspaceRoot 'templates\VERSION'
$CurrentVersion = (Get-Content $VersionFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
if (-not $CurrentVersion) { $CurrentVersion = 'unknown' }

# Resolve project dir (absolute)
if ([System.IO.Path]::IsPathRooted($ProjectPath)) {
    $ProjectDir = $ProjectPath
} else {
    $ProjectDir = Resolve-Path $ProjectPath -ErrorAction SilentlyContinue
    if (-not $ProjectDir) {
        Write-Error "ERROR: Project path does not exist: $ProjectPath"
        exit 1
    }
    $ProjectDir = $ProjectDir.Path
}

if (-not (Test-Path $ProjectDir -PathType Container)) {
    Write-Error "ERROR: Project directory not found: $ProjectDir"
    exit 1
}

# Validate git repo
$gitCheck = git -C "$ProjectDir" rev-parse --git-dir 2>&1
if (-not $? -or $LASTEXITCODE -ne 0) {
    Write-Error "ERROR: Not a git repository: $ProjectDir"
    exit 1
}

# ============================================================
# Detect or validate variant
# ============================================================
$TemplateVersionFile = Join-Path $ProjectDir '.claude\template-version.txt'
$DetectedVersion  = 'unknown'
$DetectedVariant  = ''

if (Test-Path $TemplateVersionFile) {
    $tvLines = Get-Content $TemplateVersionFile -ErrorAction SilentlyContinue
    foreach ($line in $tvLines) {
        if ($line -match '^variant=(.+)$')  { $DetectedVariant = $Matches[1].Trim() }
        if ($line -match '^version=(.+)$')  { $DetectedVersion = $Matches[1].Trim() }
    }
} else {
    Write-Host ""
    Write-Host "WARNING: template-version.txt not found in this project."
    Write-Host "    This project may have been created before version tracking was introduced."
    Write-Host "    Treating as: unknown -> current ($CurrentVersion)"
    Write-Host ""
    $confirm = Read-Host "    Proceed? [y/N]"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "Aborted."
        exit 0
    }
}

if ([string]::IsNullOrEmpty($Variant)) {
    if (-not [string]::IsNullOrEmpty($DetectedVariant)) {
        $Variant = $DetectedVariant
        Write-Host "Auto-detected variant: $Variant"
    } else {
        Write-Error "ERROR: Could not detect variant from template-version.txt. Specify -Variant explicitly."
        exit 1
    }
}

$TemplatesDir = Join-Path $WorkspaceRoot "templates\$Variant"
$CommonDir    = Join-Path $WorkspaceRoot 'templates\common'

if (-not (Test-Path $TemplatesDir)) {
    Write-Error "ERROR: Template variant not found: $TemplatesDir"
    exit 1
}
if (-not (Test-Path $CommonDir)) {
    Write-Error "ERROR: Common templates directory not found: $CommonDir"
    exit 1
}

# ── C-05: scripts-snapshot.json version comparison ────────────────────────────
$ScriptsSnapshot = Join-Path $ProjectDir 'scripts-snapshot.json'
$ScriptsMd       = Join-Path $WorkspaceRoot 'scripts\SCRIPTS.md'

if ((Test-Path $ScriptsSnapshot) -and (Test-Path $ScriptsMd)) {
    Write-Host ""
    Write-Host "--- Script version comparison (L2 snapshot vs L1 current) ---"
    try {
        $snapshot   = Get-Content $ScriptsSnapshot -Raw -Encoding UTF8 | ConvertFrom-Json
        $l2Scripts  = $snapshot.scripts
        $created    = if ($snapshot.created) { $snapshot.created } else { 'unknown' }
        $l2Names    = $l2Scripts.PSObject.Properties.Name
        Write-Host "  Snapshot created: $created  ($($l2Names.Count) scripts)"

        $scriptsMdContent = Get-Content $ScriptsMd -Raw -Encoding UTF8
        $l1Scripts = @{}
        $inRegistry = $false
        foreach ($line in $scriptsMdContent -split "`n") {
            if ($line -match '^## Registry') { $inRegistry = $true; continue }
            if ($inRegistry -and $line -match '^## ') { break }
            if ($inRegistry -and $line -match '^\|') {
                $parts = $line -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
                if ($parts.Count -ge 4 -and $parts[2] -match '^\d+\.\d+\.\d+$') {
                    $l1Scripts[$parts[0] -replace '`', ''] = @{ version = $parts[2]; status = $parts[3] }
                }
            }
        }

        $outdated   = @()
        $deprecated = @()
        foreach ($name in $l2Names) {
            $l2Info = $l2Scripts.$name
            $l1Info = $l1Scripts[$name]
            if (-not $l1Info) { continue }
            if ($l2Info.version -ne $l1Info.version) {
                $outdated += [PSCustomObject]@{ Name=$name; L2=$l2Info.version; L1=$l1Info.version }
            }
            if ($l1Info.status -eq 'deprecated') {
                $deprecated += [PSCustomObject]@{ Name=$name; Version=$l1Info.version }
            }
        }

        if ($outdated.Count -eq 0 -and $deprecated.Count -eq 0) {
            Write-Host "  ✅ All scripts up-to-date with L1 SCRIPTS.md" -ForegroundColor Green
        } else {
            if ($outdated.Count -gt 0) {
                Write-Host "  ⚠️  $($outdated.Count) script(s) have newer versions available:" -ForegroundColor Yellow
                foreach ($s in $outdated) {
                    Write-Host ("  {0,-42} {1} → {2}" -f $s.Name, $s.L2, $s.L1)
                }
            }
            if ($deprecated.Count -gt 0) {
                Write-Host "  ❌ $($deprecated.Count) script(s) are deprecated in L1 SCRIPTS.md:" -ForegroundColor Red
                foreach ($s in $deprecated) {
                    Write-Host ("  {0,-42} {1}  (deprecated — remove or replace)" -f $s.Name, $s.Version)
                }
            }
            Write-Host ""
            Write-Host "  Run: .\scripts\upgrade-project.ps1 <path> to get updated scripts."
        }
    } catch {
        Write-Host "  WARN: Could not parse scripts-snapshot.json: $_" -ForegroundColor Yellow
    }
    Write-Host ""
} elseif (Test-Path $ScriptsSnapshot) {
    Write-Host ""
    Write-Host "  INFO: scripts-snapshot.json found but SCRIPTS.md not accessible — skipping version comparison."
    Write-Host ""
}

# ============================================================
# Print header
# ============================================================
Write-Host ""
Write-Host "========================================================"
if ($DryRun) {
    Write-Host "  [DRY RUN] upgrade-project.ps1"
} else {
    Write-Host "  upgrade-project.ps1"
}
Write-Host "  Project : $ProjectDir"
Write-Host "  Variant : $Variant"
Write-Host "  Platform: $Platform"
Write-Host "  From    : $DetectedVersion"
Write-Host "  To      : $CurrentVersion"
Write-Host "========================================================"
Write-Host ""

# ============================================================
# Pre-upgrade snapshot (done BEFORE any file writes)
# ============================================================
if (-not $DryRun) {
    Write-Host "--- Creating pre-upgrade git stash snapshot ---"
    $snapDate = Get-Date -Format 'yyyyMMdd'
    $stashMsg = "pre-upgrade-snapshot-$snapDate"
    $stashOut = git -C "$ProjectDir" stash push -m $stashMsg 2>&1
    if ($LASTEXITCODE -eq 0 -and $?) {
        if ($stashOut -match 'No local changes') {
            Write-Host "INFO: Nothing to stash (working tree clean) - snapshot skipped."
        } else {
            Write-Host "Snapshot saved. To revert: git stash pop"
        }
    } else {
        Write-Host "INFO: Stash skipped (nothing to save or git stash unavailable)."
    }
    Write-Host ""
}

# ============================================================
# Tracking counters
# ============================================================
$LockedChanged  = 0
$MergeChanged   = 0
$PreserveListed = 0

# ============================================================
# LOCKED files
# ============================================================
Write-Host "--- LOCKED files (always overwrite) ---"

$LockedFiles = @(
    '.githooks/pre-commit',
    '.githooks/pre-push',
    '.githooks/commit-msg',
    '.githooks/post-checkout',
    '.githooks/pre-rebase',
    '.gitattributes',
    '.gitleaks.toml'
)

foreach ($rel in $LockedFiles) {
    $relNative = $rel.Replace('/', '\')
    $src  = Resolve-TemplatePath $relNative
    $dest = Join-Path $ProjectDir $relNative

    if (-not $src) {
        Write-Host "  SKIP (no template): $rel"
        continue
    }

    Write-Host "  LOCKED: $rel"
    Show-DiffSummary $dest $src

    if (-not $DryRun) {
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        Copy-Item $src $dest -Force
    }
    Write-Host "  $(DryPrefix)WROTE: $rel"
    $LockedChanged++
}

Write-Host ""

# ============================================================
# MERGE files
# ============================================================
Write-Host "--- MERGE files (WORKSPACE-MANAGED sections) ---"

$MergeFiles = [System.Collections.Generic.List[string]]::new()

if ($Platform -eq 'claude' -or $Platform -eq 'both') {
    $MergeFiles.Add('CLAUDE.md')
}
if ($Platform -eq 'antigravity' -or $Platform -eq 'both') {
    $MergeFiles.Add('GEMINI.md')
}

$MergeFiles.AddRange([string[]]@(
    'CONSTITUTION.md',
    '.gitignore',
    'agents/pm.md',
    'agents/architect.md',
    'agents/automation-engineer.md',
    'agents/docs-writer.md',
    'agents/scaffolding-expert.md',
    'agents/security-expert.md'
))

foreach ($rel in $MergeFiles) {
    $relNative = $rel.Replace('/', '\')
    $src  = Resolve-TemplatePath $relNative
    $dest = Join-Path $ProjectDir $relNative

    if (-not $src) {
        Write-Host "  SKIP (no template): $rel"
        continue
    }

    Write-Host "  MERGE: $rel"
    Merge-WorkspaceManaged -ProjectFile $dest -TemplateFile $src -Rel $rel
    $MergeChanged++
}

Write-Host ""

# ============================================================
# PRESERVE files
# ============================================================
Write-Host "--- PRESERVE files (listed only, not modified) ---"

$PreserveFiles = @('README.md', 'README_ko.md', 'docs\context.md')
foreach ($rel in $PreserveFiles) {
    $dest = Join-Path $ProjectDir $rel
    if (Test-Path $dest) {
        Write-Host "  PRESERVE: $rel"
        $PreserveListed++
    }
}

$srcDir = Join-Path $ProjectDir 'src'
if (Test-Path $srcDir -PathType Container) {
    Write-Host "  PRESERVE: src/ (directory - not touched)"
    $PreserveListed++
}

Write-Host ""

# ============================================================
# Post-upgrade: write template-version.txt
# ============================================================
if (-not $DryRun) {
    $claudeDir = Join-Path $ProjectDir '.claude'
    if (-not (Test-Path $claudeDir)) { New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null }
    $isoNow = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    $versionContent = "variant=$Variant`nversion=$CurrentVersion`nplatform=$Platform`nupgraded=$isoNow`n"
    [System.IO.File]::WriteAllText($TemplateVersionFile, $versionContent, [System.Text.Encoding]::UTF8)
    Write-Host "Written: .claude\template-version.txt (version=$CurrentVersion)"
} else {
    Write-Host "[DRY RUN] Would write: .claude\template-version.txt (version=$CurrentVersion)"
}
Write-Host ""

# ============================================================
# Security Bootstrap Verification
# ============================================================
Write-Host "--- Security Bootstrap Verification ---"
$SecurityPass = $true

# 1. .gitleaks.toml exists
$gitleaksPath = Join-Path $ProjectDir '.gitleaks.toml'
if (Test-Path $gitleaksPath) {
    Write-Host "  OK  .gitleaks.toml exists"
} else {
    Write-Host "  FAIL .gitleaks.toml missing"
    $SecurityPass = $false
}

# 2. .githooks/pre-commit exists
$preCommitPath = Join-Path $ProjectDir '.githooks\pre-commit'
if (Test-Path $preCommitPath) {
    Write-Host "  OK  .githooks/pre-commit exists"
} else {
    Write-Host "  FAIL .githooks/pre-commit missing"
    $SecurityPass = $false
}

# 3. .gitattributes has eol=lf
$gitattribPath = Join-Path $ProjectDir '.gitattributes'
if ((Test-Path $gitattribPath) -and (Select-String -Path $gitattribPath -Pattern 'eol=lf' -Quiet)) {
    Write-Host "  OK  .gitattributes has eol=lf"
} else {
    Write-Host "  FAIL .gitattributes missing eol=lf"
    $SecurityPass = $false
}

# 4. .gitignore has .env pattern
$gitignorePath = Join-Path $ProjectDir '.gitignore'
if ((Test-Path $gitignorePath) -and (Select-String -Path $gitignorePath -Pattern '\.env' -Quiet)) {
    Write-Host "  OK  .gitignore has .env pattern"
} else {
    Write-Host "  FAIL .gitignore missing .env pattern"
    $SecurityPass = $false
}

# 5. git core.hooksPath
$hooksPath = git -C "$ProjectDir" config core.hooksPath 2>&1
$gitOk = $? -and ($LASTEXITCODE -eq 0)
if ($gitOk -and ($hooksPath -eq '.githooks')) {
    Write-Host "  OK  git core.hooksPath = .githooks"
} else {
    Write-Host "  WARN git core.hooksPath = '$hooksPath' (expected .githooks)"
    if (-not $DryRun) {
        git -C "$ProjectDir" config core.hooksPath .githooks
        if ($? -and $LASTEXITCODE -eq 0) {
            Write-Host "       -> Auto-fixed: set core.hooksPath to .githooks"
        }
    }
}

Write-Host ""

# ============================================================
# Summary
# ============================================================
Write-Host "========================================================"
Write-Host "  Upgrade Complete"
Write-Host "  Locked files updated : $LockedChanged"
Write-Host "  Merge files processed: $MergeChanged"
Write-Host "  Preserve files listed: $PreserveListed"
if ($SecurityPass) {
    Write-Host "  Security checks      : PASSED"
} else {
    Write-Host "  Security checks      : FAILED (see above)"
}
if ($DryRun) {
    Write-Host ""
    Write-Host "  [DRY RUN] No files were modified."
}
Write-Host "========================================================"
