# Meeting Transcript
**Date**: 2026-06-21
**Topic**: co-deck variant-specific scripts architecture
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

co-deck template has a non-standard scripts structure: `templates/co-deck/scripts/co-deck/` contains variant-specific scripts (gen-slides-pdf.ts, download-font.ts, measure-layout.ts, snapshot.ts, extract_slidedata.mjs). Other variants have no scripts/ folder and rely entirely on `templates/common/scripts/`. The co-deck scripts SCRIPTS.md itself describes this as a "workaround" to avoid the L1 audit's `verifyScriptRegistryConsistency()` non-recursive scan. The meeting was convened to design a canonical solution.

---

## Transcript

### Round 1

**[architect]**: (Round 1)

The problem is precisely that `templates/co-deck/scripts/co-deck/SCRIPTS.md`'s own Design Note calls this a "workaround" — hiding co-deck scripts in a subdirectory to avoid the L1 audit scan. This is audit evasion, not audit coexistence.

A bigger problem is integration with `new-project.ts`. Currently only `templates/common/scripts/` is known to the copy pipeline — there is no handling for `templates/co-deck/scripts/co-deck/`. This means any co-deck project generated via `new-project.ts` would be missing gen-slides-pdf.ts, download-font.ts, etc. The bug is invisible because co-deck currently exists only as a deployed L2 instance.

Root cause: there is no canonical path for variant-specific scripts. Two solution directions:

- **Option A (canonical extension)**: Add a `variantScripts` section to `propagation-map.json`. Each variant declares its script source path. `new-project.ts` reads this and copies accordingly. `templates/co-deck/scripts/co-deck/` stays in place but becomes officially registered.
- **Option B (common consolidation)**: Move co-deck scripts to `templates/common/scripts/co-deck/`, tag with `@variant: co-deck`, `new-project.ts` selectively copies tagged scripts.

Preference: Option A. co-deck scripts are semantically co-deck-only; mixing them into common blurs the meaning of "common scripts." Question to automation-engineer: what does `new-project.ts` currently do with co-deck scripts, and how complex would `propagation-map.json` extension be?

---

**[automation-engineer]**: (Round 1)

Confirmed: `new-project.ts` has no special handling for `templates/co-deck/scripts/co-deck/`. Only `templates/common/scripts/` is in the copy pipeline. Generated co-deck projects would be missing all PDF-related scripts. The bug is hidden because co-deck is only used as a deployed L2 project currently.

Comparing implementation complexity:

**Option A (propagation-map extension)**:
1. Add `variantScripts` section to `propagation-map.json`
2. `new-project.ts`: look up variant name → copy scripts from declared source to declared dest
3. `propagate-to-templates.ts`: no change needed
4. `lifecycle-sync-audit.ts`: add Check V for co-deck registry

**Option B (common subdirectory)**:
1. Move files from `templates/co-deck/scripts/co-deck/` → `templates/common/scripts/co-deck/`
2. `verifyScriptRegistryConsistency()`: recursive scan or per-subdirectory SCRIPTS.md handling
3. `new-project.ts`: add `@variant` tag scan logic
4. `propagate-to-templates.ts`: copy co-deck subdirectory only to co-deck variant
5. `lifecycle-sync-audit.ts`: Check B exemption for co-deck subdirectory

Option A is cleaner: "variant owns its scripts" is semantically correct. Option B mixes variant-specific code into common. Question to auditor: which audit checks does current structure break, and is Option A's pattern fully auditable?

---

**[auditor]**: (Round 1)

Three non-auditable problems with current state:

1. **`lifecycle-sync-audit.ts` Check B blind spot**: Only validates `scripts/SCRIPTS.md` ↔ `templates/common/scripts/SCRIPTS.md`. `templates/co-deck/scripts/co-deck/SCRIPTS.md` is completely absent from Check B. Version mismatches or unregistered co-deck scripts are invisible to audit.

2. **Non-recursive `verifyScriptRegistryConsistency()` scan**: Only top-level `.ts` files in `scripts/` are checked against SCRIPTS.md. Scripts in `scripts/co-deck/` are completely excluded — no version tracking, no status management, no registry consistency check.

3. **Orphan `templates/co-deck/scripts/co-deck/SCRIPTS.md`**: This file is connected to no audit system. Someone could modify a co-deck script without updating the registry and nothing would catch it.

**Required audit updates for Option A**:
- `lifecycle-sync-audit.ts`: Add **Check V (Variant Scripts)** — reads `propagation-map.json.variantScripts`, validates `@version` in each script file against version in the variant SCRIPTS.md registry
- `verifyScriptRegistryConsistency()`: No change needed (non-recursive scan maintained; variant scripts handled separately by Check V)
- `new-project.ts`: Variant SCRIPTS.md must also be copied to the generated project

Proposed auditable flow:
```
propagation-map.json → variantScripts section
  ↓
Check V (lifecycle-sync-audit):
  @version in script file == version in variant SCRIPTS.md
  variant SCRIPTS.md registered in propagation-map.json
  ↓
new-project.ts: copy based on variantScripts
  ↓
Generated project: scripts/co-deck/ present + SCRIPTS.md included
```

Support Option A. Request architect to finalize `propagation-map.json` schema first so implementation can be consistent.

---

### Round 2

**[architect]**: (Round 2)

Auditor's 3 non-auditable problems are precise. The orphan SCRIPTS.md in particular means modifications can go undetected. Proposing the `propagation-map.json` `variantScripts` schema:

```json
{
  "variantScripts": {
    "co-deck": {
      "source": "templates/co-deck/scripts/co-deck/",
      "dest_in_project": "scripts/co-deck/",
      "registry": "templates/co-deck/scripts/co-deck/SCRIPTS.md",
      "description": "co-deck PDF generation and layout toolchain"
    }
  }
}
```

- `source`: template source path
- `dest_in_project`: destination path in generated project
- `registry`: audit target SCRIPTS.md path
- Schema supports multiple variants (e.g., co-develop adding build scripts later)

`templates/co-deck/` structure does NOT change. Only adding official registration + wiring. Changes needed:
1. `propagation-map.json`: add variantScripts section
2. `new-project.ts`: read variantScripts → copy
3. `lifecycle-sync-audit.ts`: add Check V

Question to automation-engineer: where exactly in `new-project.ts` does the variantScripts copy logic insert, and how complex is it?

---

**[automation-engineer]**: (Round 2)

`new-project.ts` copy pipeline order:
1. `templates/common/` → project root copy
2. `templates/<variant>/` → project root overlay (variant-specific files overwrite common)
3. Cleanup (remove l2_propagate: false scripts, etc.)

variantScripts handling inserts **after Step 2, before Step 3**:

```typescript
// pseudo-code
const variantScripts = propagationMap.variantScripts?.[variantName];
if (variantScripts) {
  const src = path.join(workspaceRoot, variantScripts.source);
  const dst = path.join(projectRoot, variantScripts.dest_in_project);
  await fs.cp(src, dst, { recursive: true });
  // SCRIPTS.md already included in src directory
}
```

Implementation complexity: **low**. One `fs.cp` call; `propagation-map.json` read logic already exists.

Check V implementation is also straightforward: iterate `propagation-map.json.variantScripts`, compare `@version` comments in each source `.ts` file against registry SCRIPTS.md versions. Same pattern as existing Check A — reuse the function with a path parameter.

Additional consideration: **`package.json` handling** (pdf-lib, fflate, playwright dependencies). `templates/co-deck/package.json` already exists and overlays common `package.json` in Step 2. No additional work needed. Question to auditor: should Check V scope include package.json dependency validation?

---

**[auditor]**: (Synthesis)

Summarizing both rounds:

**Points of Agreement**:
1. Option A adopted: `templates/co-deck/scripts/co-deck/` path retained; added to `propagation-map.json` as canonical registration. Workaround elevated to canonical pattern.
2. Architect's schema confirmed: `variantScripts.co-deck.{source, dest_in_project, registry, description}`
3. `new-project.ts`: variantScripts copy logic inserted after Step 2 (variant overlay)
4. `lifecycle-sync-audit.ts` Check V: variant script @version ↔ variant SCRIPTS.md version validation (reuses Check A pattern)
5. `package.json`: already handled by variant overlay, no separate action needed
6. `propagation-map.json` JSON schema (Check PM-01) must be updated to include variantScripts shape

**Open Questions**:
- Check V coverage of package.json dependencies: deferred, out of scope for this session. Can be added as Check V-b later.
- Other variants adding their own scripts: variantScripts schema already supports it; low barrier to entry.

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| S-01 | automation-engineer | Medium | Add `variantScripts.co-deck` section to `propagation-map.json` with architect's confirmed schema | L0-only | Next |
| S-02 | automation-engineer | Medium | `new-project.ts` — add variantScripts-based script copy logic (insert after Step 2, before cleanup) | L0-only | Next |
| S-03 | automation-engineer | Medium | `lifecycle-sync-audit.ts` — add Check V: variant script `@version` ↔ variant SCRIPTS.md version consistency | L0-only | Next |
| S-04 | automation-engineer | Low | `templates/co-deck/scripts/co-deck/SCRIPTS.md` — remove "workaround" language from Design Note, replace with canonical pattern description | L0-only | Next |
| N-1 | pm | Medium | Lifecycle Update (SCRIPTS.md versions, timestamps) | L0-only | Next |
| N | pm | Medium | Final QA Audit (`bun scripts/audit.ts`) | L0-only | Next |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `bun run new-project co-deck` generates project with `scripts/co-deck/` directory | `ls <project>/scripts/co-deck/` |
| 2 | gen-slides-pdf.ts, download-font.ts, measure-layout.ts, snapshot.ts all present | File existence check |
| 3 | `lifecycle-sync-audit.ts` Check V detects version mismatch in co-deck scripts | Intentional version corruption + audit run |
| 4 | `lifecycle-sync-audit.ts` Check V passes on clean state | `bun scripts/lifecycle-sync-audit.ts` exit 0 |
| 5 | `propagation-map.json` variantScripts section passes JSON schema validation (Check PM-01) | `bun scripts/audit.ts` PASS |
