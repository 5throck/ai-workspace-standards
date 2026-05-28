# Variant Lifecycle Integration Guide

**Purpose:** This document explains how the Variant Lifecycle Management System integrates with Phase 4 validation (validate-templates.ts) and provides practical examples for checking and updating variant status.

---

## Quick Reference: Status Transition Commands

### Check Current Status of All Variants

```bash
# View all variant statuses at once
cd /c/git/templates
for variant in co-*/; do
  echo "=== ${variant%/} ==="
  cat "$variant/variant.json" | jq '{name, status, version, lifecycle}'
done
```

### Update Variant Status (Manual Process)

**Example 1: Promote co-security from beta to stable**

```bash
# Step 1: Verify criteria met
cd /c/git/templates/co-security
# Check: 3 engagements logged? 0 bugs? 3 months in beta?

# Step 2: Update variant.json
cat variant.json | jq '
  .status = "stable" |
  .version = "1.0.0" |
  .lifecycle.statusSince = "2026-05-28" |
  .lifecycle.lastTransition = "beta → stable on 2026-05-28" |
  .lifecycle.stablePromotedOn = "2026-05-28"
' > variant.json.tmp && mv variant.json.tmp variant.json

# Step 3: Update CHANGELOG.md
cd /c/git/templates
# Add entry:
# ## [1.0.0] - 2026-05-28
# ### Changed
# - Promoted co-security from beta to stable

# Step 4: Commit and validate
git add co-security/variant.json CHANGELOG.md
git commit -m "Promote co-security to stable v1.0.0"
```

**Example 2: Deprecate a variant**

```bash
# Step 1: Update variant.json to deprecated
cd /c/git/templates/legacy-variant
cat variant.json | jq '
  .status = "deprecated" |
  .lifecycle.deprecatedOn = "2026-05-28" |
  .lifecycle.lastTransition = "stable → deprecated on 2026-05-28" |
  .lifecycle.archiveOn = "2026-11-28"  # 6 months later
' > variant.json.tmp && mv variant.json.tmp variant.json

# Step 2: Update CHANGELOG.md with deprecation notice

# Step 3: Commit
git add variant.json CHANGELOG.md
git commit -m "Deprecate legacy-variant (end-of-life 2026-11-28)"
```

---

## Phase 4 Integration: Lifecycle-Based Validation

The `validate-templates.ts` script (Phase 4) will enforce lifecycle-based validation rules:

### Validation Rules by Status

| Status | Validation Level | Checks Enforced |
|--------|-----------------|-----------------|
| **draft** | Minimal | Structure validity, JSON syntax only |
| **beta** | Strict | All A-04 checks, PostToolUse hook presence, verify-authorization skill |
| **stable** | Strictest | Full compliance, no exceptions, all docs complete |
| **deprecated** | Documentation-only | Only CHANGELOG.md and README.md changes allowed |

### Example: validate-templates.ts Logic

```typescript
// Pseudo-code for lifecycle-based validation
function validateVariant(variantPath: string, variantStatus: string) {
  switch (variantStatus) {
    case "draft":
      // Only check JSON schema validity
      return validateJSONSchema(variantPath);

    case "beta":
      // Enforce: PostToolUse hook, A-04 passing, verify-authorization
      const checks = [
        validateJSONSchema(variantPath),
        checkPostToolUseHookEnabled(variantPath),
        verifyA04Compliance(variantPath),
        checkVerifyAuthorizationSkill(variantPath)
      ];
      return allPass(checks);

    case "stable":
      // Full compliance: all checks must pass
      return runFullComplianceSuite(variantPath);

    case "deprecated":
      // Only allow documentation updates
      return validateDocumentationOnly(variantPath);

    default:
      throw new Error(`Invalid status: ${variantStatus}`);
  }
}
```

---

## Version Bump Rules

### When to Bump Versions

| Transition | Version Change | Example |
|------------|----------------|---------|
| **draft → beta** | No change (or PATCH bump) | `0.1.0` → `0.1.1` |
| **beta → stable** | **Bump MAJOR to 1.0.0** | `0.4.0` → `1.0.0` |
| **stable → deprecated** | No change | `1.0.0` stays `1.0.0` |
| **New major release** | Increment MAJOR | `1.0.0` → `2.0.0` (old `1.0.0` becomes deprecated) |

### Version Lifecycle Flow Example

```
co-security lifecycle:
  0.1.0 (draft)  →  0.1.0 (beta)  →  1.0.0 (stable)  →  1.0.0 (deprecated)
                  ↓
                  0.1.1 (beta, PATCH bump for bug fix)
```

---

## Current Variant Status Audit (2026-05-28)

Based on the lifecycle criteria in `VARIANT_LIFECYCLE.md`, here's the current state:

| Variant | Current Status | Current Version | **Required Action** |
|---------|----------------|------------------|-------------------|
| co-develop | stable | 0.4.0 | **Version bump to 1.0.0** (stable variants must be v1.0.0+) |
| co-work | stable | 0.5.0 | **Version bump to 1.0.0** (stable variants must be v1.0.0+) |
| co-design | stable | 0.5.0 | **Version bump to 1.0.0** (stable variants must be v1.0.0+) |
| co-security | stable | 0.1.0 | **Status change to beta** (no logged engagements yet) |

### Corrective Actions

**Action 1: Version bump for co-develop, co-work, co-design**

```bash
# For each stable variant, bump version to 1.0.0
cd /c/git/templates/co-develop
cat variant.json | jq '.version = "1.0.0"' > variant.json.tmp && mv variant.json.tmp variant.json

# Repeat for co-work and co-design
# Add CHANGELOG.md entries
# Commit
```

**Action 2: Demote co-security to beta**

```bash
cd /c/git/templates/co-security
cat variant.json | jq '
  .status = "beta" |
  .lifecycle.statusSince = "2026-05-28" |
  .lifecycle.lastTransition = "stable → beta on 2026-05-28 (corrected)"
' > variant.json.tmp && mv variant.json.tmp variant.json

# Add CHANGELOG.md entry
# Commit
```

---

## Testing Lifecycle Integration

### Test 1: Validate variant.json Schema

```bash
# Install ajv-cli (if not installed)
npm install -g ajv-cli

# Validate a variant.json against the schema
ajv validate -s /c/git/templates/common/variant.schema.json \
            -d /c/git/templates/co-develop/variant.json

# Expected: Valid (no errors)
```

### Test 2: Check Status Transition Criteria

```bash
# For co-security, check if it can be promoted to stable
cd /c/git/templates/co-security

# Check 1: Beta engagements count
cat variant.json | jq '.lifecycle.betaEngagements'
# Expected: 0 or 1 (need 3 for stable)

# Check 2: Time in beta
cat variant.json | jq '.lifecycle.statusSince'
# Expected: Should be at least 3 months ago

# Check 3: Bug reports
# Check GitHub Issues for co-security variant tag
```

### Test 3: new-project.sh Behavior

```bash
# Test that deprecated variants are blocked
# (Mock test - don't actually create project)
cd /c/git/templates
VARIANT="deprecated-variant" bash scripts/new-project.sh --dry-run
# Expected: Error message "Cannot create new project with deprecated variant"

# Test that beta variants show warning
VARIANT="co-security" bash scripts/new-project.sh --dry-run
# Expected: Warning message "⚠️ Warning: Creating project with beta variant"
```

---

## Automated Lifecycle Compliance Check

To be implemented in Phase 4 (`validate-templates.ts`), this function will:

```typescript
/**
 * Check if variant lifecycle is consistent with version and status
 */
function checkLifecycleCompliance(variantJson: any): ComplianceResult {
  const { status, version, lifecycle } = variantJson;

  // Rule 1: Stable variants must be version 1.0.0 or higher
  if (status === "stable" && version.startsWith("0.")) {
    return {
      compliant: false,
      error: `Stable variant has version ${version} (must be 1.0.0+)`
    };
  }

  // Rule 2: Beta variants must have lifecycle.betaEngagements
  if (status === "beta" && lifecycle.betaEngagements === undefined) {
    return {
      compliant: false,
      error: "Beta variant missing lifecycle.betaEngagements field"
    };
  }

  // Rule 3: Deprecated variants must have deprecation date
  if (status === "deprecated" && !lifecycle.deprecatedOn) {
    return {
      compliant: false,
      error: "Deprecated variant missing lifecycle.deprecatedOn field"
    };
  }

  // Rule 4: Stable variants must have promotion date
  if (status === "stable" && !lifecycle.stablePromotedOn) {
    return {
      compliant: false,
      error: "Stable variant missing lifecycle.stablePromotedOn field"
    };
  }

  return { compliant: true };
}
```

---

## FAQ

**Q: Can a variant skip the beta stage?**
A: No. All variants must progress through draft → beta → stable. The beta stage is critical for real-world testing and engagement validation.

**Q: What happens if a variant in beta has bugs?**
A: Bugs can be fixed during beta. The variant only progresses to stable when all bugs are resolved and 3 successful engagements are logged.

**Q: Can a deprecated variant be "undeprecated"?**
A: No. Once deprecated, a variant cannot return to a previous status. A new variant version should be created instead.

**Q: How do I track beta engagements?**
A: Log each engagement in the variant's CHANGELOG.md or in workspace memory files. Increment `lifecycle.betaEngagements` after each successful completion.

**Q: What if a stable variant needs breaking changes?**
A: Create a new major version (e.g., 2.0.0) and deprecate the old version (1.0.0). The old version enters a 6-month deprecation period.

---

## Related Documents

- [VARIANT_LIFECYCLE.md](./VARIANT_LIFECYCLE.md) - Full lifecycle specification
- [variant.schema.json](./variant.schema.json) - JSON schema for variant.json
- [Phase 4: Template Validation](./TEMPLATE_VALIDATION.md) - Validation system integration
- [New Project Script](../scripts/new-project.sh) - Project creation with lifecycle checks

---

**Last Updated:** 2026-05-28
**Version:** 1.0.0
