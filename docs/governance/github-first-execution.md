# GitHub-First Execution Architecture

**Status**: Design Phase
**Created**: 2026-05-30
**Meeting**: [meeting-2026-05-30-github-first-execution](../../memory/meeting-2026-05-30-github-first-execution.md)

## Overview

Enable users to download and execute new-project.ps1 from GitHub without cloning the entire repository, while maintaining security and auditability.

## Architecture

### 3-Layer Structure

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: Bootstrap (Entry Point)                    │
│ - bootstrap.ps1 (~100-150 lines)                     │
│ - Detects execution mode                            │
│ - Downloads git archive if needed                    │
│ - Verifies checksums                                 │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Layer 2: Package Download (if Mode 1)                │
│ - GitHub: archive/refs/tags/template-vX.Y.Z.zip     │
│ - Local extraction                                   │
│ - Cleanup after execution                           │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│ Layer 3: Core Execution (new-project.ps1)           │
│ - Templates processing                               │
│ - Project scaffolding                               │
│ - Existing logic unchanged                          │
└─────────────────────────────────────────────────────┘
```

## Execution Modes

### Mode 1: Bootstrap (GitHub-first)

**Use case**: Quick start, prototyping, no git required

```powershell
# One-time setup
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/bootstrap.ps1" -OutFile "bootstrap.ps1"

# Execution
.\bootstrap.ps1 -Version "1.2.0" -ProjectName "my-project"
```

**Flow**:
1. Mode detection: Not in git repo → Bootstrap mode
2. Download: `https://github.com/5throck/ai-workspace-standards/archive/refs/tags/template-v1.2.0.zip`
3. Verify: Check SHA256 against checksums.txt
4. Extract: Expand archive to temporary location
5. Execute: Call `new-project.ps1` from extracted archive
6. Cleanup: Remove downloaded archive

### Mode 2: Local (Clone-based)

**Use case**: Regular development, contribution

```powershell
# Clone repository
git clone https://github.com/5throck/ai-workspace-standards.git
cd ai-workspace-standards

# Execution
.\scripts\new-project.ps1 -ProjectName "my-project"
```

**Flow**:
1. Mode detection: In git repo → Local mode
2. Use local templates/ and scripts/
3. No download or verification needed
4. Existing behavior unchanged

## Security Requirements

### Mandatory (AC-03)

1. **SHA256 Checksum Verification**
   - Download `checksums.txt` from GitHub
   - Verify downloaded archive SHA256
   - Block execution if mismatch

2. **User Confirmation**
   - Display downloaded file list
   - Prompt: "Downloaded [n] files. Continue? (y/n)"
   - Require explicit confirmation

3. **Execution Log**
   - Create `.template-bootstrap.log` in generated project
   - Record: timestamp, version, SHA256, user confirm status

### Recommended

4. **Signature Verification** (Optional)
   - PGP signed checksums.txt
   - Verify signature before checksum validation

## Auditability

### Template Version Recording (AC-04)

Generated project includes:
```
.template/
├── VERSION          # "template-v1.2.0"
└── INTEGRITY        # SHA256 of all downloaded files
```

### Verification Tool (AC-05)

```bash
bun scripts/verify-template-integrity.ts ./my-project
```

Output:
```
✅ Project created with: template-v1.2.0
✅ All files integrity verified
✅ Download timestamp: 2026-05-30T10:30:00Z
```

## Workspace Structure

```
workspace/                          # L0 - Root
├── bootstrap.ps1                    # Entry point (L0, standalone)
├── scripts/
│   ├── new-project.ps1             # Core script (L0, unchanged)
│   └── ...
├── templates/                       # L1 - Template snapshot
│   ├── bootstrap/                  # NEW: Bootstrap support files
│   │   ├── checksums.txt           # SHA256 for each version
│   │   ├── README.md               # Bootstrap usage guide
│   │   ├── common/                 # Mirror of templates/common
│   │   └── co-develop/             # Mirror of variant templates
│   ├── common/
│   └── co-develop/
└── docs/
    └── governance/
        └── github-first-execution.md  # This document
```

## Implementation Phases

### Phase 1: Design & Governance (Current)
- [x] Meeting & agreement
- [ ] Folder structure specification
- [ ] Lifecycle policy update
- [ ] Checksum mechanism design

### Phase 2: Bootstrap Implementation
- [ ] bootstrap.ps1 implementation
- [ ] Mode detection logic
- [ ] Git archive download
- [ ] Checksum verification
- [ ] User confirmation UI

### Phase 3: CI/CD & Tools
- [ ] GitHub Actions: checksums.txt auto-generation
- [ ] verify-template-integrity.ts implementation
- [ ] Release checklist

### Phase 4: Documentation
- [ ] README.md update
- [ ] Quick Start guide
- [ ] Security procedures

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | bootstrap.ps1 standalone execution | Manual test from clean environment |
| AC-02 | Mode detection accuracy | Test both git/non-git environments |
| AC-03 | Checksum verification blocks malicious files | Security audit + penetration test |
| AC-04 | Generated projects record version | Verify .template/VERSION exists |
| AC-05 | Audit tool verifies integrity | Run on old project |

## References

- [Meeting Transcript](../../memory/meeting-2026-05-30-github-first-execution.md)
- [CONSTITUTION.md §5.6 - Agent Lifecycle](../../CONSTITUTION.md#56-lifecycle-governance)
- [CONSTITUTION.md §6.5 - Script Lifecycle](../../CONSTITUTION.md#65-script-lifecycle)
