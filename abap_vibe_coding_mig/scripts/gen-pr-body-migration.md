# gen-pr-body Migration Guide

## Overview

This document describes the migration from PowerShell-based `gen-pr-body.ps1` to TypeScript-based `gen-pr-body.ts` adopted from the co-develop template.

## File Status

| File | Status | Purpose |
|------|--------|---------|
| `gen-pr-body.ps1` | ✅ Retained | Legacy PowerShell version (still functional) |
| `gen-pr-body.sh` | ✅ Retained | Bash version for Unix environments |
| `gen-pr-body.ts` | ✅ NEW | TypeScript enhancement from co-develop template |

## Key Enhancements in TypeScript Version

### 1. **Language Validation**
- **NEW**: Built-in Korean character detection using regex pattern `/[가-힯ᄀ-ᇿ㄰-㆏]/`
- Validates both commit messages and AI-generated PR bodies
- Enforces CONSTITUTION.md §3 English-only requirement
- Exits with clear error message if non-English content detected

### 2. **Improved Error Handling**
- Better TypeScript type safety
- Explicit exit codes for different failure modes
- Cleaner error messages with color-coded output

### 3. **Enhanced AI Mode**
- More robust Claude CLI detection
- Better temp file handling with automatic cleanup
- Improved fallback behavior when AI mode fails

### 4. **Consistent Cross-Platform Behavior**
- Uses Bun's shell execution for consistent behavior
- Better Windows/Unix compatibility
- No encoding issues (UTF-8 guaranteed)

## Functional Comparison

| Feature | PowerShell (`.ps1`) | TypeScript (`.ts`) | Notes |
|---------|-------------------|--------------------|-------|
| AI Mode (Claude CLI) | ✅ Yes | ✅ Yes | Both support Claude CLI |
| Fallback Template | ✅ Yes | ✅ Yes | Same structure |
| File Change Detection | ✅ Yes | ✅ Yes | Identical logic |
| Language Validation | ❌ No | ✅ **NEW** | Korean detection added |
| Error Handling | Basic | **Enhanced** | Better type safety |
| Cross-Platform | ✅ Yes | ✅ Yes | Both work |

## Usage

### TypeScript Version (Recommended)
```bash
# Direct execution
bun run scripts/gen-pr-body.ts "commit message"

# Via npm script
bun run gen-pr-body "commit message"
```

### PowerShell Version (Legacy)
```powershell
.\scripts\gen-pr-body.ps1 "commit message"
```

### Bash Version (Unix)
```bash
bash scripts/gen-pr-body.sh "commit message"
```

## Integration Points

### 1. **dev-sync.ts Integration**
The `dev-sync.ts` script should be updated to use the TypeScript version:

```typescript
// Current: uses shell script
// Recommended: switch to TypeScript
const prBody = await $`bun run scripts/gen-pr-body.ts "${commitMsg}"`.quiet();
```

### 2. **Commit Hooks**
The pre-commit and post-commit hooks can call either version:
- Current: Uses `gen-pr-body.sh` or `gen-pr-body.ps1`
- Migration: Update to `gen-pr-body.ts` for enhanced validation

## Migration Path

### Phase 1: Parallel Operation (Current State)
- ✅ Both versions installed and functional
- ✅ TypeScript version available for testing
- ✅ PowerShell version remains default for existing workflows

### Phase 2: Gradual Adoption
- Update `dev-sync.ts` to use TypeScript version
- Update documentation to recommend TypeScript version
- Maintain PowerShell version as fallback

### Phase 3: Full Migration (Future)
- Make TypeScript version the default
- Deprecate PowerShell version after validation period
- Remove PowerShell version from repository

## Benefits of TypeScript Version

1. **Language Enforcement**: Automatically validates English-only content
2. **Better Error Messages**: Clear, actionable error output
3. **Type Safety**: Compile-time validation reduces runtime errors
4. **Consistent Behavior**: Same behavior across all platforms
5. **Enhanced AI Fallback**: Better handling of Claude CLI failures

## Testing Checklist

- [x] Script executes without arguments (error handling)
- [x] Script generates PR body with sample commit
- [x] AI mode (Claude CLI) works correctly
- [x] Fallback mode works without Claude CLI
- [x] Language validation detects Korean characters
- [x] npm script shortcut works
- [x] No conflicts with existing PowerShell version
- [x] Documentation updated

## Compatibility Notes

- **Bun Runtime Required**: TypeScript version requires Bun runtime
- **Node.js Compatibility**: Not designed for vanilla Node.js execution
- **PowerShell Version**: Remains functional for environments without Bun
- **Bash Version**: Remains functional for Unix environments

## Recommendations

### For Development Teams
1. **Adopt TypeScript version** for new workflows
2. **Keep PowerShell version** as safety fallback during transition
3. **Test language validation** with non-English commit messages
4. **Update CI/CD pipelines** to use TypeScript version

### For Production
1. **Use TypeScript version** for all automated PR generation
2. **Monitor language validation** false positives during initial deployment
3. **Keep fallback** available for manual intervention scenarios

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-06-01 | 1.0.0 | Initial adoption from co-develop template |

---

*Generated for A-14 Part 3: gen-pr-body.ts adoption*
