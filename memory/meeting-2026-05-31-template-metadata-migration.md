# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Migration of Variant/Template Governance Files to `docs/`
**Participants**: pm, architect, lifecycle-manager, auditor
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**[pm]**: (Round 1)
The user has pointed out that placing variant-related governance and schema files (such as `common-contract.json`, `variant.schema.json`, etc.) directly inside `templates/common/` causes them to be inappropriately copied into newly scaffolded projects. The user suggests migrating these files to the `docs/` folder and updating all associated references. 

**[architect]**: (Round 1)
This is an excellent architectural observation. The `templates/common/` directory should strictly contain only the "payload" — the files that are meant to be inherited by scaffolded projects. Governance files (schemas, contracts, version registries, lifecycle definitions) are metadata *about* the templates, not contents *of* the templates. Placing them in `docs/templates/` or `docs/governance/` cleanly separates the Antigravity framework's internal metadata from the scaffolding payload.

**[lifecycle-manager]**: (Round 1)
I fully support this. Currently, my state monitoring rules reference these files at `templates/common/`. Specifically, I monitor `lifecycle-governance.json`, `common.lifecycle.json`, and `VERSION_REGISTRY.json`. If we move them to `docs/templates/`, I will need my `agents/lifecycle-manager.md` instructions updated to point to the new paths. Also, the audit scripts (`agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts`, `lifecycle-sync-audit.ts`) will need their hardcoded paths updated.

**[auditor]**: (Round 1)
I have identified 8 files that fall into this category:
1. `VERSION_REGISTRY.json`
2. `common-contract.json`
3. `common.lifecycle.json`
4. `lifecycle-governance.json`
5. `variant-contract.json`
6. `variant.schema.json`
7. `workspace-schema.json`
8. `phase-definitions.md`

We need to make sure that `validate-templates.ts` is updated as well, because it heavily relies on `workspace-schema.json`, `variant.schema.json`, and `common-contract.json` to perform its checks.

**[architect]**: (Round 2)
Let's agree on the destination directory. I propose `docs/templates/` as the new home for all these 8 files. This keeps them logically grouped. We will then need a comprehensive search-and-replace across the `scripts/` directory to update references from `templates/common/<file>` to `docs/templates/<file>`. We also need to update `CONSTITUTION.md` and `AGENTS.md` if they reference `phase-definitions.md`.

**[auditor]**: (Round 2)
I agree. In `CONSTITUTION.md` Section 5.6, it explicitly lists `templates/common/lifecycle-governance.json` and `templates/common/common.lifecycle.json`. Those must be updated. Also, in the variant `AGENTS.md` files (like `templates/co-work/AGENTS.md`), they currently have a comment `[phase-definitions.md](phase-definitions.md) <!-- path resolves post-scaffolding -->`. Wait, if `phase-definitions.md` is moved to `docs/templates/`, does the scaffolded project get a copy of it?

**[architect]**: (Round 2, Interjection)
Ah! `phase-definitions.md` is actually needed by the scaffolded projects! It defines the 7-phase workflow that the PM agent in the new project relies on. If we move `phase-definitions.md` to `docs/templates/`, how does the new project get it? We should keep `phase-definitions.md` inside `templates/common/` because it IS part of the payload, or we can move it to `templates/common/docs/phase-definitions.md` so it goes into the new project's `docs/` folder!

**[pm]**: (Synthesis)
Great catch. Here is the consensus plan:
1. **Move Metadata to `docs/templates/`**:
   Move `VERSION_REGISTRY.json`, `common-contract.json`, `common.lifecycle.json`, `lifecycle-governance.json`, `variant-contract.json`, `variant.schema.json`, and `workspace-schema.json` to `C:\git\docs\templates\`.
2. **Move `phase-definitions.md` to `templates/common/docs/`**:
   The scaffolded projects *need* `phase-definitions.md`, so we will move it to `templates/common/docs/phase-definitions.md` so it correctly lands in the `docs/` folder of the new project. We will update the `AGENTS.md` files in the variants to point to `docs/phase-definitions.md`.
3. **Update References**:
   Update all TypeScript scripts (especially `validate-templates.ts`, `audit.ts`, lifecycle audits) to point to `docs/templates/` for the JSON schemas/contracts.
   Update `CONSTITUTION.md` and `agents/lifecycle-manager.md` to reflect the new paths.
4. **Execution**: PM will create an Implementation Plan detailing this migration.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | Create Implementation Plan for Template Metadata Migration | Planning |
| A-02 | pm | High | Present plan to user for approval | Planning |
