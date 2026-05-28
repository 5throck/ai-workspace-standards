# Meeting Transcript
**Date**: 2026-05-29
**Topic**: Remaining .sh/.ps1 Scripts Classification and Conversion Strategy (Workspace Root & Templates)
**Participants**: PM, Architect, Automation-Engineer, Auditor
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

**[PM]**: (Round 1)
Sharing the current state. A full audit of `scripts/` in the Workspace Root reveals 10 scripts still existing as `.sh`/`.ps1` pairs: `gen-pr-body`, `install-bun`, `list-template-versions`, `new-project`, `publish-to-template`, `qa-gate`, `sync-md`, `sync-skills`, `upgrade-project`, `validate-templates`. Among these, some already have a `.ts` counterpart (e.g., `validate-templates.ts`). In `templates/common/scripts/`, 6 `.sh/.ps1` scripts remain. Please provide your classification based on the established Tier criteria.

**[Architect]**: (Round 1)
Classifying by the established Tier criteria:
- **Tier 1 (Shell Permanent)**: `install-bun` (Bun installation itself — TS conversion impossible), `new-project` (bootstrap entry point, Tier 1 hardening already complete), `upgrade-project` (pre-existing project upgrade — runtime availability unclear, keep in Shell).
- **Tier 2 (TS Conversion Targets)**: `gen-pr-body`, `publish-to-template`, `qa-gate`, `sync-md`, `sync-skills`, `list-template-versions`. These are internal pipeline scripts that only run in an environment where Bun is already installed, making them ideal for TS conversion.
- `validate-templates` already has a `.ts` implementation — simply delete the `.sh/.ps1` wrappers.

**[Automation-Engineer]**: (Round 1)
I agree with the Architect's classification. However, following the precedent set by `audit` and `dev-sync`, we MUST complete TS implementation and parallel verification before deleting any shell wrappers. Additionally, `templates/common/scripts/` is the L1 layer, which is synchronized from the Workspace Root (L0) via the `publish-to-template` script. Therefore, the scripts in `templates/common/scripts/` should not be converted individually — instead, they should be automatically reflected in L1 after the L0 conversion is complete, via `publish-to-template`.

**[Auditor]**: (Round 2)
From a risk perspective, I have additional points to raise. `qa-gate.sh/.ps1` may be called directly from CI/CD pipelines. If `.github/workflows/` or `.githooks/` directly call `qa-gate.sh`, changing the invocation to `bun run qa-gate` after TS conversion could break the pipeline. We must verify this dependency before conversion.

**[Architect]**: (Round 2)
An excellent point. `sync-md` also has a dependency: `dev-sync.ts` internally calls `.ps1/.sh` directly. Therefore, when converting `sync-md` to TS, `dev-sync.ts` must also be updated simultaneously. It is safest to convert in reverse dependency order (convert what is depended upon first): `sync-md` → `gen-pr-body` → `qa-gate` → `publish-to-template` → `list-template-versions` → `sync-skills`.

**[Auditor]**: (Synthesis)
Summarizing the analysis and agreements:

**Tier 1 — Shell Permanent (No Conversion)**
| Script | Reason |
|--------|--------|
| `install-bun.sh/.ps1` | Purpose is Bun installation itself — TS conversion impossible |
| `new-project.sh/.ps1` | User-facing bootstrap entry point — Tier 1 hardening already complete |
| `upgrade-project.sh/.ps1` | Existing project upgrade — runtime availability unclear |

**Tier 2 — TS Conversion Targets (respect dependency order)**
| Priority | Script | Notes |
|----------|--------|-------|
| 1 | `sync-md` | Called internally by `dev-sync.ts` — `dev-sync.ts` must also be updated |
| 2 | `gen-pr-body` | Called by `dev-sync.ts` |
| 3 | `qa-gate` | Must verify CI/CD hook dependencies first |
| 4 | `validate-templates` | `.ts` already exists — only delete `.sh/.ps1` |
| 5 | `publish-to-template` | Must complete before L0→L1 sync |
| 6 | `list-template-versions` | Independent — low risk |
| 7 | `sync-skills` | Independent — low risk |

**Templates (L1) Handling Principle**: After L0 conversion is complete, automatically sync to L1 via `publish-to-template`.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Automation-Engineer | Convert `sync-md.sh/.ps1` to `sync-md.ts` and update `dev-sync.ts` to call it | Implementation |
| A-02 | Automation-Engineer | Convert `gen-pr-body.sh/.ps1` to `gen-pr-body.ts` and update `dev-sync.ts` | Implementation |
| A-03 | Architect/Auditor | Inspect `.github/workflows/` and `.githooks/` for `qa-gate.sh` dependencies before converting | Research |
| A-04 | Automation-Engineer | Delete `validate-templates.sh/.ps1` (`.ts` already exists) | Implementation |
| A-05 | Automation-Engineer | Convert `publish-to-template`, `list-template-versions`, `sync-skills` to `.ts` | Implementation |
| A-06 | Automation-Engineer | Run `publish-to-template` to sync L0 changes to `templates/common/scripts/` (L1) | Sync |
| A-07 | Auditor | Verify each conversion with parallel execution before deleting shell wrappers | QA Gate |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | No regression in `dev-sync.ts` flow | Run `bun run dev-sync` dry-run and confirm output matches previous behavior |
| 2 | CI/CD pipeline safety | `qa-gate` conversion does not break any `.github/workflows/` triggers |
| 3 | L1 parity | `templates/common/scripts/` reflects all L0 TS scripts after `publish-to-template` |
