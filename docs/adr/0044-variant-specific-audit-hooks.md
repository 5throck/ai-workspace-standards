# ADR-0044: Pluggable Variant Audit Hooks and Pipeline Integrity Validation

**Date**: 2026-06-21
**Status**: Accepted
**Deciders**: architect, automation-engineer, auditor
**Supersedes**: —
**Related**: ADR-0036 (TypeScript script migration), ADR-0039 (L0/L1/L2 hierarchy)

---

## Context

In our current workspace structure, core scripts like `dev-sync.ts` and `audit.ts` are standardized and propagated globally from the common template (`templates/common/scripts/`) to all variant templates (L1) and ultimately variant projects (L2). This ensures uniform execution of quality gates, security scans, and synchronization checks across the workspace.

However, different variants (such as `co-deck`, `co-design`, etc.) have different technical stacks, configurations, and custom verification requirements that cannot be unified in a single, common `audit.ts` or `dev-sync.ts`. 

Allowing variant projects to directly modify their local copies of `dev-sync.ts` or `audit.ts` is highly discouraged because it breaks template standardization, introduces significant drift, and complicates workspace-wide upgrades. Furthermore, custom local modifications to these files pose a risk of bypassing or weakening core security and quality controls.

We need a design that:
1. Standardizes core scripts across all templates and variants.
2. Allows variant projects to execute custom validation checks during local audits.
3. Automatically detects and prevents unauthorized local modifications to core scripts during template reconciliation (`l2-to-variant-pipeline.ts`).

---

## Decision

### 1. Pluggable Variant Audit Hook

We will implement a pluggable verification hook pattern. The core `audit.ts` script remains unified and identical across all variant templates. However, it will dynamically detect and execute a local verification script, specifically `scripts/audit-variant.ts`, if it exists in the project root.

The dynamic execution block in `scripts/audit.ts` will check for the file using `fs.existsSync(path.join('scripts', 'audit-variant.ts'))`. If present, it will run it using Bun's shell API:
```typescript
const variantAuditPath = path.join('scripts', 'audit-variant.ts');
if (fs.existsSync(variantAuditPath)) {
  console.log('🔄 Running variant-specific audit checks...');
  const res = await $`bun ${variantAuditPath}`.nothrow();
  if (res.exitCode !== 0) {
    console.error('❌ Variant audit failed.');
    process.exit(1);
  }
}
```

This keeps the core pipeline clean and locked while allowing complete extensibility inside the variant sandbox.

### 2. Core Script Integrity Check during Reconciliation

To prevent developers from directly editing core scripts in L2 projects, the template reconciliation process (`l2-to-variant-pipeline.ts` via `scripts/helpers/reconcile-with-l0-l1.ts`) will perform an integrity hash check on core synchronization scripts (specifically `scripts/dev-sync.ts` and `scripts/audit.ts`).

If the reconciliation process detects that `scripts/dev-sync.ts` or `scripts/audit.ts` has been classified as `modified` in the L2 project compared to the L1/L0 base templates, it will throw a fatal reconciliation error and halt pipeline compilation. Developers will be directed to migrate their custom checks to `scripts/audit-variant.ts` instead.

---

## Alternatives Considered

### Alt A: Maintain Variant-Specific Copies of `dev-sync.ts` and `audit.ts`

Maintain different templates for `dev-sync.ts` and `audit.ts` for each variant.

**Rejected because**: This would exponentially increase merge conflicts and maintenance overhead during template upgrades. It breaks the foundational principle of a unified core infrastructure.

### Alt B: Skip Core Script Validation in L2 Projects

Allow changes to core scripts in L2 and ignore them during reconciliation.

**Rejected because**: This creates a security risk where local projects could accidentally or intentionally disable mandatory hooks (such as gitleaks credential scanning or markdown language policy audits).

---

## Consequences

### Positive

- **Core script uniformity**: Core validation gates remain 100% consistent across all variant templates.
- **Variant-specific extensibility**: Variants can run custom tests, build scripts, or quality checks in a dedicated hook script (`scripts/audit-variant.ts`).
- **Integrity protection**: The pipeline automatically detects and rejects unauthorized core script modifications, guiding developers toward the correct extension mechanism.

### Negative / Risks

- **Complexity in troubleshooting**: If a variant audit fails, the developer must inspect `scripts/audit-variant.ts` inside their project, which is not tracked in the common templates. This is mitigated by clear console logging during execution.

---

## References

- Meeting transcript: `memory/meeting-2026-06-21-variant-dev-sync-verification.md`
- Execution plan: `implementation_plan.md`
