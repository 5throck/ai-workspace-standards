---
schemaVersion: 1.0.0
spec-id: upgrade-project-drift-fixes
---

# upgrade-project Drift Fixes — Four Recurring Fleet-Upgrade Failures

## 1. Overview

The 2026-09-15 fleet upgrade of all 11 `Projects/co-*` to template v0.6.0 was a
hash-based drift-delivery run (no version bump). It required hand-patching four
recurring failures across the fleet. This design fixes the four root causes at
their actual seams. Each was confirmed by direct inspection of the code and the
fleet's on-disk state; in two cases the investigation disproved the initially
assumed cause, and the design follows the evidence rather than the assumption.

## 2. Background — root causes

### D1. DOCS_MERGE never adds a missing WORKSPACE-MANAGED block

Symptom: the new `<!-- WORKSPACE-MANAGED: tier-model-mapping -->` block (§3.6
3-Tier Strategy) never reached 6 of 11 projects, and 5 more kept a stale
2-platform copy missing the `gpt-5.6-*` Codex column. `validate-model-registry.ts`
(fatal audit gate) failed 11/11 until hand-patched.

The assumed cause was "merge only updates existing blocks". The real cause is one
level up, in template resolution:

| Fact | Evidence |
|------|----------|
| Common template has the block | `templates/common/AGENTS.md:153` and `:463` — 2 `WORKSPACE-MANAGED` blocks |
| Variant templates do **not** | `templates/co-abap/AGENTS.md:509`, `templates/co-game/AGENTS.md:734` — 1 block only, `graft repo context graph` |
| `AGENTS.md` resolves variant-first | `resolveTemplate(rel)` in the `DOCS_MERGE_FILES` loop, `upgrade-project.ts:955-962` |
| Common fallback is all-or-nothing | `mergeWorkspaceManaged` falls back to common **only** when `tplManaged.length === 0` (`upgrade-project.ts:693`) |

Because the variant template has one marker (graft), `tplManaged.length` is 1,
not 0 — the common fallback never fires, and `tier-model-mapping` is never even a
merge candidate. The project also has exactly 1 block, so counts match (1 vs 1)
and the positional branch (`:771-780`) cheerfully updates graft and reports
success. The block is not skipped by the merge; it never enters the merge.

Two aggravating factors in the same function:

- **Matching is marker-type-granular, not label-granular.** `MANAGED_PATTERNS`
  (`:657-665`) keys on the marker family (`WORKSPACE-MANAGED`); the
  `: description` suffix the pattern already tolerates (`:658`) is captured by
  nothing. Blocks are paired by ordinal position, so identity is positional.
- **The count-mismatch branch is lossy.** `:755-769` replaces everything from the
  first to the last project block with the template sequence — silently deleting
  any project prose living *between* two managed blocks. This is why the stale
  2-platform sub-case is distinct: it is not "a new line segment failing to
  merge", it is the same resolution gap, with the project's block surviving
  untouched because it was never paired against a template block that has the
  Codex column.

### D2. `generate-version-manifest.ts` is never delivered

Symptom: `docs/VERSION_MANIFEST.md` has been stale in every project since
inception; surfaced as a fatal `audit.ts` failure ("Skills registry is missing
skills/X") in 6+ of the most-drifted projects.

The assumed cause was a missing classification in `upgrade-policy.ts`. It is not:
`resolveClaim` already claims all of `scripts/**` as
`{ policy: 'SYNC', pass: 'SYNC_IF_NEWER: scripts/' }` (`upgrade-policy.ts`, the
`underDir(rel, 'scripts')` rule). The classification is correct and generic.

The real cause is a **propagation gap**: the file does not exist in the template
tree. `scripts/generate-version-manifest.ts` exists at L0; `templates/common/scripts/`
contains its sibling `generate-skill-graph.ts` but no `generate-version-manifest.ts`.
A tree-walk delivery pass can only deliver files that exist in the tree, so the
correct claim has always applied to zero bytes.

The failure was invisible because `dev-sync.ts` step 4.7 (`:741-753`) guards with
`if (fs.existsSync(genManifestTs))` and has no `else`. Step 4.65 immediately above
it at least logs `skipped — skill graph generator not present`; 4.7 prints nothing
at all. A permanently absent hard dependency reads as a silent success.

### D3. No SKILLS.md ↔ SKILL.md reconciliation after delivery

When `SYNC_IF_NEWER: skills/` delivers a newer `skills/<name>/SKILL.md`, its
frontmatter `version` / `last_reviewed` advance, but the sibling row in
`skills/SKILLS.md` is never touched. `skill-lifecycle-audit.ts` then reports
ERROR-level `Registry version drift` (`:408`) and `Registry last_reviewed drift`
(`:432`), which is fatal in the audit chain and blocks `/sync`. Confirmed on
co-architect and co-game (both: `project-review`, `agent-lifecycle-manager`);
several other projects carry WARN-level instances of the same class.

The detector is correct and already exists — the missing piece is a *writer*. The
upgrade delivers one half of a two-file invariant and leaves the other half to a
gate that runs later and can only complain. Note that `upgrade-project.ts` already
owns a SKILLS.md-mutating pass (`:1107-1159`, the layer-column schema migration),
so the seam exists.

### D4. `§`-prefixed anchors in delivered docs

`co-game`'s `docs/user-guide.md` / `_ko.md` linked `AGENTS.md#42-harness-engineering-workflow`;
GitHub's slug algorithm — faithfully reproduced by `validate-docs-links.ts:74`,
`.replace(/[^\p{L}\p{N}\p{M}\s\-_]/gu, "")` — yields `#42-harness-engineering-workflow`.
The `§` is stripped from headings but preserved in hand-written fragments, so every
such link is permanently broken.

The brief asked whether this is a one-off or warrants a lint rule. It is **not** a
one-off: **34 markdown files** under `templates/`, `docs/`, and `Projects/` contain
`#` anchor fragments, including template-level sources that will keep seeding the
fleet (`templates/co-deck/AGENTS.md:176,261,321`, `co-consult`, `co-design`,
`co-work`, `co-hr`, and more). `validate-docs-links.ts` v1.1.0 already *catches*
these as generic `broken anchor` findings; what is missing is an actionable
diagnostic and a fix at the source.

## 3. Decision

### D1 — label-keyed managed-block merge (`upgrade-project.ts`)

1. Extend `findManagedBlocks` to capture the optional `: description` suffix as a
   **block key**, so a block's identity is `{ label, key }` rather than
   `{ label, ordinal }`. Unlabelled blocks keep ordinal identity within their
   label (backward compatible: COMMON-CLAUDE's several unlabelled per-section
   blocks continue to pair positionally).
2. Replace the all-or-nothing common fallback (`:693`) with a **per-key union**:
   the candidate template block set is variant blocks ∪ common blocks, variant
   winning on key collision. This preserves variant override semantics while
   ending the "variant shadows the whole common marker set" failure.
3. For a keyed template block with no project counterpart, **insert** it rather
   than skip. Insertion anchor, in order of preference: (a) immediately after the
   heading whose text the key names, if present; (b) after the project's last
   block of the same label; (c) end of file. Every insertion logs
   `INSERTED <label>:<key>`.
4. The lossy count-mismatch branch (`:755-769`) becomes unreachable for keyed
   blocks. Retain it for unlabelled blocks only, and upgrade its log line to name
   the prose-loss risk explicitly.

This fixes the missing-block case and the stale-block sub-case with one mechanism:
once `tier-model-mapping` is keyed and unioned from common, the stale 2-platform
project block is paired by key and overwritten with the Codex-bearing template
block.

### D2 — deliver the script, and make the dependency honest

1. Propagate `scripts/generate-version-manifest.ts` into
   `templates/common/scripts/`, alongside `generate-skill-graph.ts`, and register
   it in `templates/common/scripts/SCRIPTS.md`. No `upgrade-policy.ts` change —
   the existing `SYNC_IF_NEWER: scripts/` claim then delivers it fleet-wide.
2. Turn `dev-sync.ts` step 4.7's silent skip into a reported one, matching step
   4.65's existing shape: log
   `Step 4.7: skipped — VERSION_MANIFEST generator not present in this context`.
   A skipped regeneration must be visible in the sync log.
3. Add a template-completeness assertion to `validate-templates.ts`: any script
   `dev-sync.ts` invokes by literal path must exist in `templates/common/scripts/`.
   This is the check that would have caught the gap at inception and that
   generalizes to the next sibling script.

### D3 — post-delivery registry reconciliation (`upgrade-project.ts`)

Add a `SKILLS_REGISTRY_RECONCILE` pass that runs **after** the
`SYNC_IF_NEWER: skills/` pass and before the post-upgrade audit, extending the
existing SKILLS.md-mutating pass at `:1107`:

- For each `skills/<name>/SKILL.md` delivered or updated in this run, rewrite the
  matching `skills/SKILLS.md` row's `version` and `last_reviewed` from the
  delivered frontmatter. SKILL.md frontmatter is the SSOT; the registry row is a
  projection of it — this direction is the only safe one.
- Rows with no matching SKILL.md, and SKILL.md files with no row, are **reported,
  not synthesized**. Row creation and deletion are lifecycle decisions owned by
  `skill-lifecycle-manager`, not by an upgrade.
- Honor `--dry-run`, and log each reconciled row.

Reusing `parseSkillRegistryRows` (`skill-lifecycle-audit.ts:110`) keeps the
writer and the detector parsing the registry identically — a divergence here
would reintroduce the same drift class one layer down.

### D4 — targeted lint rule plus source fix

1. `validate-docs-links.ts`: when a fragment fails to resolve **and** contains
   `§`, emit a specific finding instead of the generic one —
   `anchor contains '§', which GitHub strips from slugs; use #<slugified> instead`,
   naming the computed correct fragment. Severity unchanged (it is already a
   broken link); this is a diagnosis upgrade, not a new gate. It costs one
   conditional and converts a class of findings from puzzling to self-fixing.
2. Bulk-fix the 34 affected files at the source, templates first, so the fleet
   stops inheriting the pattern.

## 4. Requirements / Acceptance

1. A project whose `AGENTS.md` lacks `WORKSPACE-MANAGED: tier-model-mapping`
   receives it on upgrade; a project with the stale 2-platform block has it
   replaced with the Codex-bearing version; `validate-model-registry.ts` passes
   for 11/11 without hand-patching.
2. Managed-block merge preserves project prose between blocks — verified by a
   fixture with authored text between two managed blocks.
3. `generate-version-manifest.ts` is present in `scripts/` after upgrade for all
   11 projects; `dev-sync.ts` step 4.7 regenerates rather than no-ops; a context
   genuinely lacking the script logs a visible skip.
4. `validate-templates.ts` fails if a `dev-sync.ts`-invoked script is absent from
   `templates/common/scripts/`.
5. After upgrade, `skill-lifecycle-audit.ts` reports zero `Registry version drift`
   / `Registry last_reviewed drift` findings for co-architect and co-game.
6. A `#`-bearing broken anchor produces the specific diagnostic naming the
   corrected fragment; the 34 source files are fixed; `validate-docs-links.ts`
   passes at L0 and across templates.
7. `bun scripts/audit.ts` passes end-to-end at L0 after all changes.

## 5. Non-goals

- **No redesign of the classification system.** `upgrade-policy.ts` gains no new
  rule; D2's investigation confirmed its existing `scripts/**` claim is correct.
- **No changes to unrelated upgrade passes** — TEMPLATE TREE SYNC, ENV_SAMPLE
  SYNC, COMMANDS_SYNC, CONTEXT_COMMONIZATION, and the sync-skills platform mirror
  are untouched.
- **No new marker families.** `MANAGED_PATTERNS` keeps its seven entries; only
  block *identity* within a family changes.
- **No registry row creation or deletion** during upgrade (D3) — reporting only.
- **No change to `validate-docs-links.ts` severity or link-checking scope** (D4);
  message specificity only.
- **No template version bump** — these are drift-delivery corrections.
- Broader `AGENTS.md` variant/common divergence (variant templates having drifted
  far from the common structure) is the visible backdrop of D1 but is a separate
  consolidation effort, deliberately out of scope.

## 6. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no `.claude/` command, skill, or hook surface changes. The fixes are in workspace scripts invoked identically from every platform. | N/A |
| Antigravity (GEMINI.md) | None. Justification: all four fixes live in `scripts/` (upgrade, sync, validators) which Antigravity invokes through the same `bun scripts/<name>.ts` entry points; no platform-specific dispatch, command file, or instruction surface is involved, so `.gemini/` requires no counterpart change. D1's merge operates on `AGENTS.md`, which is platform-neutral by definition. | N/A |
| templates/common | Propagation required — D2 adds a script, D4 fixes anchors in variant `AGENTS.md` sources. | `templates/common/scripts/generate-version-manifest.ts` (new), `templates/common/scripts/SCRIPTS.md`, the 34 `#`-bearing markdown files under `templates/` |

## 7. Risk Notes

- D1 changes a merge function that writes to every project's `AGENTS.md`. The
  insertion-anchor logic must be exercised against all 11 projects in `--dry-run`
  before any write. The prose-preservation acceptance criterion (2) is the
  guardrail for the one genuinely destructive path in the current code.
- D3 writes to `SKILLS.md`, a file projects also edit by hand. Restricting writes
  to two columns of rows whose SKILL.md changed in the same run bounds the blast
  radius; row add/delete is explicitly excluded for this reason.

## 8. Accessibility & Preview

Backend upgrade and validation tooling with no user-facing UI. ADR-0065
accessibility requirements and ADR-0070 preview verification are not applicable.
