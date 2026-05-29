# Variant Lifecycle Management System

**Version:** 1.0.0
**Last Updated:** 2026-05-28
**Owner:** Platform Team

## Overview

This document defines the formal lifecycle stages for all template variants in the workspace. Each variant progresses through four standardized stages: **draft** → **beta** → **stable** → **deprecated**.

The lifecycle status is stored in each variant's `variant.json` under the `status` field and must follow the transition criteria defined below.

---

## Lifecycle Stages

### 1. Draft

**Definition:** Initial development phase. Variant structure and core files are being created. Not ready for production use.

**Characteristics:**
- Variant structure is being scaffolded
- Core documentation and configuration files are incomplete
- May have missing or placeholder agents/skills
- **No automated validation enforced**
- Manual testing only

**Restrictions:**
- Cannot be used for new project creation via `new-project.sh`
- No documentation publication
- No support commitments

---

### 2. Beta

**Definition:** Feature-complete but not yet production-proven. All required files exist, automated hooks are active, and initial verification has passed. Ready for limited real-world testing.

**Characteristics:**
- 100% required files present and validated
- PostToolUse audit hook enabled in `.claude/settings.json`
- All A-04 verification checks passing
- Verify-authorization skill implemented (for security variants)
- Ready for controlled testing engagements

**Beta Usage Scope (per variant):**

| Variant | Beta Scope | Usage Notes |
|---------|------------|--------------|
| co-security | **Single engagement trial** | One designated security project for real-world testing. Requires explicit user acknowledgment of beta status. |
| co-develop | **Full access** | Standard development workflow beta testing |
| co-work | **Full access** | Collaboration workflow beta testing |
| co-design | **Full access** | Design workflow beta testing |

**Restrictions:**
- Must display beta warning on project creation
- No production SLA or uptime guarantees
- Feature changes may occur without notice

---

### 3. Stable

**Definition:** Production-ready variant with proven track record. Suitable for general use with full support.

**Transition Criteria (from Beta):**

| Requirement | Criteria |
|--------------|----------|
| **Engagement History** | Minimum 3 successful actual project engagements (not test runs) |
| **Bug Reports** | 0 unresolved bug reports (all issues resolved or documented as known limitations) |
| **Usage Duration** | Minimum 3 months in beta status |
| **Documentation** | All docs reviewed and approved |
| **User Feedback** | Positive feedback from beta users (no critical UX/functional complaints) |
| **Script Health** | 0 deprecated scripts in use (all scripts at `active` status in SCRIPTS.md) |

**Characteristics:**
- Full support commitment
- Versioned releases with CHANGELOG.md entries
- Backwards compatibility maintained within major version
- Production SLA applies
- Recommended for all new projects

---

### 4. Deprecated

**Definition:** End-of-life variant. No longer recommended for new projects. Existing projects receive maintenance-only support.

**Transition Criteria (from Stable):**

| Trigger | Timeline |
|---------|----------|
| **New Major Version** | Release of variant vX.0.0 when current version is v(X-1).Y.Z |
| **Deprecation Period** | Minimum 6 months from deprecation announcement to removal |
| **End of Support** | After 6 months, variant moves to "archive" status |

**Restrictions:**
- **No new project creation** via `new-project.sh` (script must reject deprecated variants)
- Existing projects: maintenance only (bug fixes, no new features)
- Documentation remains available but marked as deprecated
- Security updates: critical fixes only for 6 months, then no updates

**Migration Path:**
- Users must be notified to migrate to newer variant versions
- Migration guide must be provided (if compatible successor exists)

---

## Status Transition Criteria Matrix

| Current Status | Next Status | Required Criteria | Approval Authority |
|----------------|-------------|-------------------|-------------------|
| **draft** | **beta** | 1. 100% required files complete (validate-templates.ts A-04 passing)<br>2. PostToolUse hook enabled in `.claude/settings.json`<br>3. verify-authorization skill implemented (security variants)<br>4. A-04 verification: all checks passing<br>5. Variant documentation complete | Platform Lead |
| **beta** | **stable** | 1. Minimum 3 successful engagements logged<br>2. 0 unresolved bug reports<br>3. Minimum 3 months in beta<br>4. Documentation reviewed<br>5. User feedback validated | Platform Lead |
| **stable** | **deprecated** | 1. New major version released (vX.0.0)<br>2. Deprecation announcement published<br>3. 6-month support timeline communicated | Platform Lead |
| **deprecated** | **archive** | 1. 6-month deprecation period elapsed<br>2. No active projects (or migration complete) | Platform Lead |

---

## variant.json Status Field Schema

```json
{
  "name": "co-<variant>",
  "description": "...",
  "status": "draft|beta|stable|deprecated",
  "version": "X.Y.Z",
  "lifecycle": {
    "statusSince": "YYYY-MM-DD",
    "lastTransition": "draft → beta on YYYY-MM-DD",
    "betaEngagements": 0,
    "stablePromotedOn": null
  }
}
```

**Field Definitions:**

- **status:** Current lifecycle stage (one of: `draft`, `beta`, `stable`, `deprecated`)
- **lifecycle.statusSince:** Date when current status was entered
- **lifecycle.lastTransition:** Human-readable description of last status change
- **lifecycle.betaEngagements:** Count of successful engagements during beta phase
- **lifecycle.stablePromotedOn:** Date promoted to stable (null if not yet stable)

---

## Version Update Detection Mechanism

The version update detection mechanism is integrated into the variant lifecycle through the `variant.json` schema:

### 1. Version Structure
- Follows Semantic Versioning: `MAJOR.MINOR.PATCH` (e.g., `0.4.0`, `1.0.0`)
- **MAJOR** increment: Breaking changes or lifecycle transitions (e.g., `0.5.0` → `1.0.0` on stable promotion)
- **MINOR** increment: New features, backwards compatible
- **PATCH** increment: Bug fixes, small improvements

### 2. Lifecycle-Based Version Rules

| Transition | Version Change | Example |
|------------|----------------|---------|
| draft → beta | No version change (or bump PATCH) | `0.1.0` → `0.1.1` |
| beta → stable | **Bump MAJOR** (1.0.0) | `0.4.0` → `1.0.0` |
| stable → deprecated | No version change | `1.0.0` remains `1.0.0` |
| New major release (successor) | Increment MAJOR | `1.0.0` → `2.0.0` (old `1.0.0` becomes deprecated) |

### 3. Automated Detection

The `validate-templates.ts` script (Phase 4) will:
- Parse each variant's `variant.json`
- Compare `version` and `status` fields against lifecycle rules
- Flag inconsistencies (e.g., `status: "stable"` with version `0.1.0`)

### 4. Changelog Integration

Every version change must include a `CHANGELOG.md` entry:

```markdown
## [1.0.0] - 2026-05-28

### Added
- Promoted co-security from beta to stable

### Changed
- All 3 beta engagement criteria met
- Zero bug reports for 3-month period
```

---

## Checking and Updating Variant Status

### Manual Status Check

To check the current status of all variants:

```bash
# Read all variant.json files
cat /c/git/templates/*/variant.json | jq -s '.'
```

### Updating Variant Status

**Step 1:** Verify transition criteria are met
```bash
# For beta → stable transition, verify:
# - 3 engagements logged in CHANGELOG.md or memory/
# - 0 open bug reports (check GitHub Issues)
# - 3 months elapsed (check lifecycle.statusSince in variant.json)
```

**Step 2:** Update `variant.json`

```bash
# Example: co-develop beta → stable
cd /c/git/templates/co-develop
jq '
  .status = "stable" |
  .lifecycle.statusSince = "2026-05-28" |
  .lifecycle.lastTransition = "beta → stable on 2026-05-28" |
  .lifecycle.stablePromotedOn = "2026-05-28" |
  .version = "1.0.0"
' variant.json > variant.json.tmp && mv variant.json.tmp variant.json
```

**Step 3:** Update CHANGELOG.md

```bash
# Add entry to templates/CHANGELOG.md
# Follow format: "## [1.0.0] - YYYY-MM-DD"
```

**Step 4:** Commit and validate

```bash
# Run full sync pipeline
cd /c/git/templates
bash ../scripts/dev-sync.sh "Promote co-develop to stable (v1.0.0)"
```

### Automated Validation

The `validate-templates.ts` script (Phase 4) will enforce:
- Correct status values (must match `draft|beta|stable|deprecated`)
- Version consistency with lifecycle stage
- Presence of `lifecycle` object in variant.json
- Valid date formats in lifecycle fields

---

## Integration with Phase 4 (validate-templates.ts)

The lifecycle system integrates with Phase 4 validation through:

### 1. Lifecycle-Based Validation Rules

```typescript
// validate-templates.ts will check:
- If status === "draft": skip most validations (allow incomplete structure)
- If status === "beta": enforce all A-04 checks, PostToolUse hook presence
- If status === "stable": enforce full compliance (no exceptions)
- If status === "deprecated": allow only documentation updates
```

### 2. Variant Blocking in new-project.sh

The project creation script will reject deprecated variants:

```bash
# In scripts/new-project.sh
if [ "$variant_status" = "deprecated" ]; then
  echo "Error: Cannot create new project with deprecated variant '$variant_name'"
  echo "Deprecated variants: $variant_name (deprecated since $variant_deprecated_date)"
  echo "Please use a stable variant instead."
  exit 1
fi
```

### 3. Beta Variant Warning

For beta variants, display a warning:

```bash
# In scripts/new-project.sh
if [ "$variant_status" = "beta" ]; then
  echo "⚠️  Warning: Creating project with beta variant '$variant_name'"
  echo "Beta variants are for testing purposes only and may change without notice."
  read -p "Continue? (y/N): " confirm
  if [ "$confirm" != "y" ]; then
    exit 1
  fi
fi
```

---

## Lifecycle State Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Variant Lifecycle                         │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │    draft     │
    │              │
    │ - Incomplete │
    │ - No hooks   │
    └──────┬───────┘
           │ 100% files + PostToolUse + A-04 passing
           ▼
    ┌──────────────┐
    │    beta      │
    │              │
    │ - Full files │
    │ - Hooks on  │◄───┐
    └──────┬───────┘    │
           │            │
           │ 3 engagements, 0 bugs, 3 months
           │            │
           ▼            │
    ┌──────────────┐    │
    │   stable     │    │
    │              │    │
    │ - Production │    │
    │ - Supported  │────┘ (Only for co-security
    └──────┬───────┘   single engagement)
           │
           │ New major version released
           ▼
    ┌──────────────┐
    │  deprecated  │
    │              │
    │ - Maintenance│
    │ - No new     │
    │   projects   │
    └──────┬───────┘
           │
           │ 6 months elapsed
           ▼
    ┌──────────────┐
    │   archive    │
    │              │
    │ - Read-only  │
    │ - No support │
    └──────────────┘
```

---

## Current Variant Status (2026-05-28)

| Variant | Status | Version | Notes |
|---------|--------|---------|-------|
| co-develop | stable | 0.4.0 | Should be 1.0.0 (needs version bump) |
| co-work | stable | 0.5.0 | Should be 1.0.0 (needs version bump) |
| co-design | stable | 0.5.0 | Should be 1.0.0 (needs version bump) |
| co-security | stable | 0.1.0 | Incorrect: should be beta (no engagements yet) |

**Action Items:**
1. Audit all variants against lifecycle criteria
2. Correct status/version inconsistencies
3. Log beta engagements for co-security before stable promotion

---

## References

- [Phase 4: Template Validation System](../governance/TEMPLATE_VALIDATION.md) (to be created)
- [Variant JSON Schema](../governance/variant.schema.json) (to be created)
- [New Project Script](../../scripts/new-project.sh)
- [CHANGELOG.md](../../CHANGELOG.md)

---

**Document Version:** 1.0.0
**Next Review:** 2026-08-28 (quarterly lifecycle review)
