# Checksum Verification Mechanism

**Status**: Design Phase
**Created**: 2026-05-30
**Related**: [GitHub-First Execution Architecture](./github-first-execution.md)

## Overview

Security mechanism to verify integrity and authenticity of downloaded template archives from GitHub.

## Checksum Format

### checksums.txt Structure

Located at: `templates/bootstrap/checksums.txt`

```text
# Template Checksums
# Format: <template-version> <sha256-hash> <file-size>
# Generated: <timestamp>

template-v1.2.0 a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef12 1024000
template-v1.1.0 0987654321fedcba0987654321fedcba0987654321fedcba0987654321f 980000
```

**Fields**:
- **Template version**: Git tag format (template-vX.Y.Z)
- **SHA256**: Lowercase hexadecimal hash
- **File size**: Bytes
- **Metadata**: Generation timestamp

### Integrity Log Format (.template/INTEGRITY)

Generated in each created project:

```text
# Template Integrity Log
# Generated: 2026-05-30T10:30:00Z

Template-Version: template-v1.2.0
Download-Timestamp: 2026-05-30T10:29:45Z
Downloaded-From: https://github.com/5throck/ai-workspace-standards/archive/refs/tags/template-v1.2.0.zip
Archive-SHA256: a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef12
User-Confirmed: true
Execution-Log: .template-bootstrap.log

# File Integrity
README.md,a1b2c3d4...
scripts/new-project.ps1,5e6f7a8b...
templates/agents/pm.md,9c0d1e2f...
# ... (all extracted files)
```

## Verification Algorithm

### Step 1: Download Checksums

```powershell
$checksumsUrl = "https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/templates/bootstrap/checksums.txt"
Invoke-WebRequest -Uri $checksumsUrl -OutFile "checksums.txt"
```

### Step 2: Parse Expected Hash

```powershell
$version = "template-v1.2.0"
$expectedHash = (Get-Content "checksums.txt" | Select-String "^$version" | ConvertFrom-Csv -Delimiter ' ' -Header Version,Hash,Size).Hash
```

### Step 3: Calculate Actual Hash

```powershell
$actualHash = (Get-FileHash -Algorithm SHA256 "workspace.zip").Hash.ToLower()
```

### Step 4: Compare and Block

```powershell
if ($expectedHash -ne $actualHash) {
    Write-Host "❌ SECURITY ALERT: Checksum mismatch!" -ForegroundColor Red
    Write-Host "   Expected: $expectedHash" -ForegroundColor Yellow
    Write-Host "   Actual: $actualHash" -ForegroundColor Yellow
    Write-Host "   Possible causes: MITM attack, repository compromise, corrupted download" -ForegroundColor Yellow
    Write-Host "   Action: Aborted for your safety. Please report this issue." -ForegroundColor Yellow
    exit 1
}
```

## User Confirmation UI

### Before Extraction

```powershell
Write-Host ""
Write-Host "=== Security Check ===" -ForegroundColor Cyan
Write-Host "Downloaded: template-v1.2.0 ($actualSize bytes)" -ForegroundColor Green
Write-Host "SHA256: $actualHash" -ForegroundColor Green
Write-Host ""
Write-Host "Files to be extracted:" -ForegroundColor Yellow
Get-ChildItem "workspace.zip" | Select-Object -First 10 | ForEach-Object {
    Write-Host "  - $($_.Name)" -ForegroundColor White
}
Write-Host "  ... (and $totalFiles more files)" -ForegroundColor Gray
Write-Host ""
$confirm = Read-Host "Continue extraction? (y/n)"
if ($confirm -ne "y") {
    Write-Host "Aborted by user." -ForegroundColor Yellow
    exit 0
}
```

## Execution Log (.template-bootstrap.log)

Created in generated project root:

```text
=== Template Bootstrap Log ===
Timestamp: 2026-05-30T10:30:00Z
Workspace-Root: C:\Users\user\Projects

Bootstrap-Configuration:
  Mode: Standalone (GitHub-first)
  Template-Version: template-v1.2.0
  Download-URL: https://github.com/.../template-v1.2.0.zip

Security-Verification:
  Checksum-Expected: a1b2c3d4...
  Checksum-Actual: a1b2c3d4...
  Checksum-Status: PASS
  User-Confirmed: true

Execution:
  Project-Name: my-project
  Project-Path: C:\Users\user\Projects\my-project
  Status: Success
```

## Security Requirements (AC-03)

### Mandatory

1. **Checksum verification before extraction**
   - Block execution if mismatch
   - Clear error message with diagnostic info
   - Log attempt in bootstrap log

2. **User confirmation before extraction**
   - Display file count and size
   - Require explicit 'y' confirmation
   - Allow abort with 'n'

3. **Execution log recording**
   - Create .template-bootstrap.log in generated project
   - Include all verification steps
   - Persist for audit trail

### Recommended

4. **Signature verification (optional)**
   - PGP sign checksums.txt
   - Verify signature before hash validation
   - Provide clear error if signature invalid

## Verification Tool Design

### verify-template-integrity.ts

```typescript
interface IntegrityReport {
  templateVersion: string;
  downloadTimestamp: string;
  archiveHash: string;
  userConfirmed: boolean;
  files: { [path: string]: string }; // filename -> sha256
  status: 'VALID' | 'INVALID' | 'MISSING';
}

function verifyProjectIntegrity(projectPath: string): IntegrityReport {
  // 1. Read .template/INTEGRITY
  // 2. Read .template-bootstrap.log
  // 3. Verify each file's SHA256
  // 4. Return status report
}
```

**CLI Usage**:
```bash
bun scripts/verify-template-integrity.ts ./my-project
```

**Output**:
```
✅ Project: my-project
✅ Template: template-v1.2.0
✅ Integrity: VALID (245/245 files verified)
✅ Downloaded: 2026-05-30T10:29:45Z
✅ User confirmed: true

Status: PASSED
```

## Generation: CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: Generate Checksums

on:
  push:
    tags:
      - 'template-v*'

jobs:
  generate-checksums:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate archive
        run: |
          git archive --format=zip --output=template.zip ${{ github.ref_name }}
          sha256=$(sha256sum template.zip | awk '{print $1}')
          size=$(stat -f%z template.zip)
          echo "${{ github.ref_name }} $sha256 $size" >> templates/bootstrap/checksums.txt
      
      - name: Commit checksums
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add templates/bootstrap/checksums.txt
          git commit -m "chore: update checksums.txt for ${{ github.ref_name }}"
          git push
```

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-03.1 | Checksum verification blocks malicious downloads | Security audit + penetration test |
| AC-03.2 | User confirmation required before extraction | Manual test |
| AC-03.3 | Execution log created in generated project | Verify .template-bootstrap.log exists |
| AC-03.4 | Verification tool validates old projects | Run on projects created with different versions |

## References

- [Meeting Transcript](../../memory/meeting-2026-05-30-github-first-execution.md)
- [GitHub-First Execution Architecture](./github-first-execution.md)
