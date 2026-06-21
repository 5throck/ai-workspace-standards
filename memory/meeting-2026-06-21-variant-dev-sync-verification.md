# Meeting Transcript
**Date**: 2026-06-21
**Topic**: Extending dev-sync.ts and l2-to-variant-pipeline.ts for variant-specific verification hooks
**Participants**: architect, auditor, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[architect]**: (Round 1)

In our current workspace structure, `dev-sync.ts` is distributed globally from the common template (`templates/common/scripts/dev-sync.ts`), meaning all variant projects share the exact same sync logic. However, the point that each variant (such as `co-deck`, `co-design`, etc.) has different technical stacks and validation requirements that cannot be fully handled by a single common `dev-sync.ts` or `audit.ts` is highly valid.

To resolve this, we should avoid maintaining separate, variant-specific copies of `dev-sync.ts` directly. Branching the core file for each variant would exponentially increase merge conflicts and maintenance overhead during template upgrades. Instead, I propose introducing a **"Pluggable Verification Hook"** pattern.

Specifically, we keep the core `dev-sync.ts` and `audit.ts` files unified and identical, but configure them to dynamically detect and execute a local verification script (e.g., `scripts/audit-variant.ts`) if it exists in the project root. This maintains the consistency of the main synchronization pipeline while clean-rooming variant-specific audits.

I would like our `automation-engineer` colleague to comment on how this can be implemented in terms of script execution and process control under the Bun runtime environment.

---

**[automation-engineer]**: (Round 1)

The pluggable verification hook pattern proposed by our `architect` colleague is a great approach. It is highly decoupled and very straightforward to implement from an automation standpoint.

Under the Bun runtime, we can easily check for the existence of `scripts/audit-variant.ts` using `fs.existsSync`. For example, we can append a control block to the end of the global `audit.ts` pipeline:

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

This ensures that we do not modify the core `dev-sync.ts` script directly; we simply place custom verification logic in the variant folder (e.g., `templates/co-deck/scripts/audit-variant.ts`).

At the same time, when executing `l2-to-variant-pipeline.ts`, we must add a static analysis check to ensure that the user has not directly modified `dev-sync.ts` or `audit.ts` in the L2 project. If any unauthorized changes to common files are detected during scanning, the pipeline should warn the developer and guide them to migrate those checks to `scripts/audit-variant.ts` instead.

I request our `auditor` colleague to assess whether this pluggable system and pipeline audit check are sufficient to maintain quality gate reliability.

---

### Round 2

**[architect]**: (Round 2)

The implementation details outlined by the `automation-engineer` align perfectly with my architectural intent. Invoking the local verification script dynamically only when it exists allows the core `audit.ts` and `dev-sync.ts` to remain locked or merge-tier files while being safely extensible.

Additionally, the static check for variant verification scripts in `l2-to-variant-pipeline.ts` should be designed as follows:
1. **File Modification Detection (Reconciliation)**: Compare the hashes of `dev-sync.ts` and `audit.ts` in the L2 project against the L1 template copies.
2. **Handling Divergence**: If unauthorized modifications are detected, the pipeline must fail or emit warnings, notifying the developer that variant-specific checks must reside in `scripts/audit-variant.ts`.
3. **Template Standardization**: Ensure the pipeline leaves common files unchanged and packages `scripts/audit-variant.ts` under the variant's template folder.

This design securely protects the L0-L1-L2 fork upgrade model while granting variant projects the local freedom they need.

---

**[auditor]**: (Round 2)

The proposed design is safe and ideal from a quality control and auditing perspective.

Allowing variant-specific versions of `dev-sync.ts` or `audit.ts` would complicate workspace integrity verification and introduce security risks, such as accidental bypasses of core security checks. Keeping the core scripts identical is a non-negotiable principle for audit gate consistency.

By restricting variant extensions to the `scripts/audit-variant.ts` sandbox and enforcing hash verification in `l2-to-variant-pipeline.ts`, we establish a clean security barrier.

As concrete action items, we should standardize the dynamic invocation logic in the global `audit.ts` and integrate the hash validation step in `l2-to-variant-pipeline.ts`.

---

## Synthesis

**[auditor]**: (Synthesis)

Full consensus has been reached on extending the variant-specific verification hook:

1. **Decoupled Verification**: Core `dev-sync.ts` and `audit.ts` remain unified. Variant-specific checks are isolated in a local pluggable hook script (`scripts/audit-variant.ts`).
2. **Dynamic Execution**: `audit.ts` will dynamically detect and execute `scripts/audit-variant.ts` if present, blocking synchronization on failure.
3. **Pipeline Protection**: `l2-to-variant-pipeline.ts` will compare `dev-sync.ts` and `audit.ts` hashes. If modified, it halts and directs developers to use `scripts/audit-variant.ts`.

**Platform Parity**:
These modifications only affect command execution and pipeline logic under the Bun runtime and apply globally, meaning they are platform-independent.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | Medium | Document pluggable audit hook architecture in `docs/adr/0045-variant-specific-audit-hooks.md` | L0-only | Phase 3 |
| A-02 | automation-engineer | Low | Add dynamic `scripts/audit-variant.ts` execution block to `scripts/audit.ts` | Both | Phase 4 |
| A-03 | automation-engineer | Low | Add `dev-sync.ts` and `audit.ts` hash integrity checks to `scripts/l2-to-variant-pipeline.ts` | Both | Phase 4 |
| A-04 | docs-writer | Medium | Update `CONSTITUTION.md` and context templates to document the pluggable audit hook pattern | Both | Phase 4 |

---

## Acceptance Criteria

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| 1 | `bun scripts/audit.ts` dynamically runs `audit-variant.ts` if present, and fails if the variant hook fails | Run workspace audit with failing mock `audit-variant.ts` |
| 2 | `l2-to-variant-pipeline.ts` fails compile if L2 `dev-sync.ts` or `audit.ts` has been modified directly | Run pipeline on project with modified `dev-sync.ts` |
| 3 | Standard L2 projects with unmodified sync scripts compile successfully | Run pipeline on clean L2 project |
