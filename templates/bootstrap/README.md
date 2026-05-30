# Bootstrap Support Files

This folder contains supporting files for the GitHub-first bootstrap mechanism.

## Purpose

Enable users to create new projects without cloning the entire repository by running:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/bootstrap.ps1" -OutFile "bootstrap.ps1"
.\bootstrap.ps1 -Version "0.5.0" -ProjectName "my-project"
```

## Files

| File | Purpose | Maintained By |
|------|---------|---------------|
| `checksums.txt` | SHA256 checksums for each template release version | CI/CD (auto-generated) |
| `README.md` | This file | Docs team |

## Checksum Format

```
# Template Checksums
# Format: <template-version> <sha256-hash> <file-size>
# Generated: <timestamp>

template-v0.5.0 a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef12 1024000
```

## Adding New Template Versions

When a new template release is created (e.g., `template-v0.6.0`):

1. Create and push the git tag: `git tag template-v0.6.0 && git push origin template-v0.6.0`
2. Download the archive: `wget https://github.com/5throck/ai-workspace-standards/archive/refs/tags/template-v0.6.0.zip`
3. Generate checksum: `sha256sum template-v0.6.0.zip`
4. Add entry to `checksums.txt` with the format above
5. Commit and push the updated `checksums.txt`

## Security

- **Checksum verification**: Mandatory before extraction
- **User confirmation**: Required before proceeding
- **Execution logging**: All bootstrap runs logged to `.template-bootstrap.log`

See [GitHub-First Execution Architecture](../../../docs/governance/github-first-execution.md) for details.
