# audit.ps1 - Documentation integrity check (Windows PowerShell)
# Mirrors audit.sh exactly. Exit code 0 = pass, non-zero = fail.

# UTF-8 encoding enforcement
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

$errors = 0

function Pass($msg)  { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg)  { Write-Host "[FAIL] $msg" -ForegroundColor Red;   $script:errors++ }
function Warn($msg)  { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host "=== audit.ps1 - workspace standards check ===" -ForegroundColor Cyan

# 1. CHANGELOG.md must exist
if (Test-Path "CHANGELOG.md") { Pass "CHANGELOG.md exists" }
else                           { Fail "CHANGELOG.md missing" }

# 2. CONSTITUTION.md must be accessible (workspace root OR one level up for project dirs)
if ((Test-Path "CONSTITUTION.md") -or (Test-Path "..\CONSTITUTION.md")) { Pass "CONSTITUTION.md accessible" }
else { Fail "CONSTITUTION.md not found (expected at ./ or ../)" }

# 2.5. Constitution section files must exist and be non-empty (workspace root only)
if ((Test-Path "CONSTITUTION.md") -and (Test-Path "docs\constitution")) {
    $content = Get-Content "CONSTITUTION.md" -Raw -Encoding UTF8
    if ($content -match 'docs/constitution/([\w.-]+\.md)') {
        $matches = [regex]::Matches($content, 'docs/constitution/([\w.-]+\.md)')
        foreach ($match in $matches) {
            $ref = $match.Groups[1].Value
            $path = "docs\constitution\$ref"
            if ((Test-Path $path) -and ((Get-Item $path).Length -gt 0)) {
                Pass "constitution section: $ref"
            } else {
                Fail "constitution section missing or empty: docs\constitution\$ref"
            }
        }
    }
}

# 2.6. Web URL link validation (workspace root only)
if ((Test-Path "AGENTS.md") -or (Test-Path "templates\common\docs\context.md")) {
    $linkErrors = 0

    # Check if Invoke-WebRequest is available
    if (Get-Command Invoke-WebRequest -ErrorAction SilentlyContinue) {
        # Check AGENTS.md web URLs
        if (Test-Path "AGENTS.md") {
            $webUrls = Select-String -Path "AGENTS.md" -Pattern "https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md#[\w-]+" -AllMatches
            foreach ($match in $webUrls.Matches) {
                $url = $match.Value
                try {
                    $null = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 5
                } catch {
                    Fail "Dead link detected in AGENTS.md: $url"
                    $linkErrors++
                }
            }
        }

        # Check templates/common/docs/context.md web URLs
        if (Test-Path "templates\common\docs\context.md") {
            $webUrls = Select-String -Path "templates\common\docs\context.md" -Pattern "https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md#[\w-]+" -AllMatches
            foreach ($match in $webUrls.Matches) {
                $url = $match.Value
                try {
                    $null = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 5
                } catch {
                    Fail "Dead link detected in templates\common\docs\context.md: $url"
                    $linkErrors++
                }
            }
        }

        if ($linkErrors -eq 0) {
            Pass "Web URL validation: all external links resolve"
        } else {
            $errors += $linkErrors
        }
    } else {
        Warn "Invoke-WebRequest not available - skipping web URL validation"
    }
}

# 3. CHANGELOG.md must have [Unreleased] section
if (Test-Path "CHANGELOG.md") {
    $cl = Get-Content "CHANGELOG.md" -Raw -Encoding UTF8
    if ($cl -match "\[Unreleased\]") { Pass "CHANGELOG.md has [Unreleased] section" }
    else                              { Fail "CHANGELOG.md is missing '[Unreleased]' section" }
}

# --- Agent checks (applicable to all projects AND workspace root) ---

    # 4. AGENTS.md must exist
    if (Test-Path "AGENTS.md") { Pass "AGENTS.md exists" }
    else                        { Fail "AGENTS.md missing (required for agent-first projects)" }

    # 5. At least one agent file must exist in agents/
    $agentFiles = Get-ChildItem -Path "agents" -Filter "*.md" -ErrorAction SilentlyContinue
    if ($agentFiles) { Pass "agents/ has agent files" }
    else              { Fail "agents/ is empty or missing - create at least agents/pm.md" }

# --- Project-level checks (skip at workspace root where docs/context.md is absent) ---

if (Test-Path "docs\context.md") {
    $ctx = Get-Content "docs\context.md" -Raw -Encoding UTF8

    # 6. docs/context.md must have ## Coding Guidelines
    if ($ctx -match "(?m)^## Coding Guidelines") { Pass "docs/context.md has ## Coding Guidelines" }
    else                                           { Fail "docs/context.md is missing '## Coding Guidelines' section" }

    # 7. .env.sample must exist
    if (Test-Path ".env.sample") { Pass ".env.sample exists" }
    else                          { Warn ".env.sample not found - add one if this project uses environment variables" }

    # 8. scripts/ .sh/.ps1 parity check
    Get-ChildItem -Path "scripts" -Filter "*.sh" -ErrorAction SilentlyContinue | ForEach-Object {
        $ps1 = Join-Path "scripts" ($_.BaseName + ".ps1")
        if (Test-Path $ps1) { Pass "script parity: $($_.Name) / $($_.BaseName).ps1" }
        else                 { Warn "script parity gap: $($_.Name) has no matching .ps1" }
    }

} else {
    Warn "docs/context.md not found - skipping project-level checks (workspace root)"
}

# --- Skills registry cross-check ---
# Verify every directory in skills/ and .claude/skills/ has a SKILL.md file
foreach ($skillsDir in @("skills", ".claude\skills")) {
    if (Test-Path $skillsDir) {
        Get-ChildItem -Path $skillsDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $skillMd = Join-Path $_.FullName "SKILL.md"
            if (Test-Path $skillMd) { Pass "skill exists: $skillsDir\$($_.Name)\SKILL.md" }
            else                     { Fail "skill directory missing SKILL.md: $skillsDir\$($_.Name)\" }
        }
    }
}

# --- Lifecycle Audits ---
if (Get-Command bun -ErrorAction SilentlyContinue) {
    if (Test-Path "scripts\agent-lifecycle-audit.ts") {
        $agentOutput = bun scripts\agent-lifecycle-audit.ts --json 2>$null
        if ($agentOutput -match '"errors":\s*\[\]') { Pass "Agent audit: all agents healthy" }
        else { Fail "Agent audit detected issues (run 'bun scripts\agent-lifecycle-audit.ts' to see details)" }
    }
    if (Test-Path "scripts\skill-lifecycle-audit.ts") {
        $skillOutput = bun scripts\skill-lifecycle-audit.ts --json 2>$null
        if ($skillOutput -match '"errors":\s*\[\]') { Pass "Skill audit: all skills healthy" }
        else { Fail "Skill audit detected issues (run 'bun scripts\skill-lifecycle-audit.ts' to see details)" }
    }
} else {
    Warn "Bun not installed - skipping lifecycle audits"
}

# --- Agent/Skill State Synchronization Check ---
if (Test-Path "AGENTS.md" -and (Test-Path "agents")) {
    $syncErrors = 0
    Get-ChildItem "agents\*.md" -ErrorAction SilentlyContinue | ForEach-Object {
        $agentFile = $_
        $agentName = $_.BaseName

        # Extract status from agent file
        $fileStatus = Select-String -Path $agentFile -Pattern "^status:" | ForEach-Object {
            $_.Line.Split(":")[1].Trim()
        }

        if ($fileStatus) {
            # Check AGENTS.md for matching status
            $agentsMdLine = Select-String -Path "AGENTS.md" -Pattern "\`${agentName}\.md\`" -Context 0,2
            if ($agentsMdLine) {
                $agentsMdStatus = $agentsMdLine.Context.PostContext | Select-String -Pattern "status: \w+" | ForEach-Object {
                    $_.Matches[0].Value.Split(":")[1].Trim()
                }

                if ($agentsMdStatus -and $fileStatus -ne $agentsMdStatus) {
                    Fail "Agent state mismatch: $agentName (file=$fileStatus, AGENTS.md=$agentsMdStatus)"
                    $syncErrors++
                }
            }
        }
    }

    if ($syncErrors -eq 0) {
        Pass "Agent state synchronization: all agents in sync"
    } else {
        $errors += $syncErrors
    }
}

Write-Host ""
if ($errors -eq 0) { Write-Host "✅ All checks passed." -ForegroundColor Green; exit 0 }
else               { Write-Host "❌ $errors check(s) failed. Fix before committing." -ForegroundColor Red; exit 1 }

