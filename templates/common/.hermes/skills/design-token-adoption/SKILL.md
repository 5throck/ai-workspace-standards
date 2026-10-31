---
name: design-token-adoption
version: 1.0.0
description: >
  Staged retrofit playbook for adopting a design token architecture in an
  existing (brownfield) UI built from raw hex/px/rgba literals. Walks a project
  through a no-UI-change foundation stage (token SSOT + framework bridge +
  honest lint config), per-layer codemod stages (type scale, then color with
  near-duplicate collapse under a computed WCAG contrast proof, then
  radii/shadows/layout), and a machine-verified allowlist-residue sweep until
  the design lint passes with documented residue only. Use when: adopting
  design tokens in an existing UI, running a token retrofit, planning a staged
  token-migration PR series, or reducing a design-lint allowlist. Greenfield
  projects follow design-foundation Stage 4 instead; raw-value detection alone
  is token-usage-lint.
status: active
scope: common
l2_propagate: false
owner: pm
last_reviewed: 2026-10-31
prerequisites: none
relates_to:
  - skill: token-usage-lint
    type: composes_with
  - skill: design-foundation
    type: relates_to
metadata:
  type: process
  triggers:
    - token retrofit
    - design token adoption
    - allowlist reduction
    - adopt design tokens in existing UI
    - brownfield design tokens
---

# Skill: design-token-adoption

## Context

Three skills cover the token lifecycle, each with a distinct contract:

| Skill | Contract |
|-------|----------|
| `design-foundation` | **Greenfield prerequisite** - derives principles, decisions, and the 3-layer token architecture for a new project (its Stage 4 copies the token scaffold). |
| `token-usage-lint` | **Detection half** - scans for raw hex/px/rgba literals that bypass the token SSOT and classifies them. Detects; prescribes no adoption method. |
| `design-token-adoption` (this skill) | **Retrofit workflow** - the staged, value-preserving method for converting an existing raw-value UI onto tokens without visual regression. |

This playbook is distilled from the co-price retrofit (PRs #164-#167), whose
method and gates are recorded in the provenance section below.

## When to Use (Applicability Gate)

Run the gate before any stage work:

- **Use this skill** when the project is brownfield: existing UI pages carry raw
  literal values (hex, px, rgba/hsla) AND a design-lint substrate exists or can
  be configured (`docs/workspace-schema.json` `designLint` block with
  `scanRoots` / `tokenSources` / `allowlist`).
- **Do NOT use this skill** when the project is greenfield: follow
  `design-foundation` Stage 4 (copy the token scaffold, fill placeholders) and
  then `token-usage-lint` as the ongoing detector. Retrofit machinery (codemods,
  allowlist deltas) has nothing to converge on a greenfield codebase.
- Trigger phrases: "token retrofit", "design token adoption", "allowlist
  reduction", "adopt design tokens in existing UI", "brownfield design tokens".

## Procedure

One PR per stage. Stages are independently revertible; every stage ends with the
design lint green and an explicit allowlist delta. Gates and sequencing follow
the co-price precedent (`Projects/co-price/docs/designs/2026-10-29-token-adoption-design.md`
§5 Migration plan, §7 Sequencing).

### Stage 0 - Foundation (no UI change)

Instantiate the token infrastructure without touching any rendered value:

1. Create the token SSOT file (e.g. `src/app/tokens.css`) with the 3-layer
   architecture: Primitive (ramps, type scale, radii, shadows) -> Semantic
   (`--background`, `--surface`, `--border`, text roles, status bg/fg/border
   triplets) -> Component (only when a repeated composite emerges; do not
   pre-create). Reference implementation: `Projects/co-price/src/app/tokens.css`.
   Move existing `:root` declarations in verbatim (delete-and-reference, values
   unchanged); add the ramp steps the design vocabulary needs - unused steps are
   the vocabulary, not debt.
2. Add the framework bridge so utilities resolve to the runtime variables. For
   Tailwind v4 this is an `@theme inline` block in `globals.css`; the `inline`
   keyword is required for `var()`-referencing entries.
3. Truth-up the lint config in `docs/workspace-schema.json`: set `tokenSources`
   to the SSOT file and `scanRoots` to the real UI source roots. Do this in the
   first PR so every later stage is measured against honest config (the config
   schema is `DesignLintConfig`, `Projects/co-price/scripts/design-lint.ts:286-319`).
4. Point the design-decision record (e.g. `docs/design.md`) at the new token SSOT.

**Stage gate**: build succeeds; bridged utility classes appear in the built CSS
(verify the generated stylesheet, never trust the class string alone); design
lint green; **allowlist count unchanged** (Stage 0 removes nothing).

### Stage 1 - Type scale codemod

Mechanical 1:1 mapping by px value - no optical resizing. Each raw size maps to
the type-role token carrying the dominant current value; exact token names come
from the project's design-decision vocabulary. Allowlist delta: remove px
entries as their last occurrences disappear.

### Stage 2 - Color and surface

Order the work so each mapping is value-preserving at the dominant current value:

1. Page shells and panels to background/surface tokens; accents and status
   literals to primary/status tokens and bg/fg/border triplets; semi-transparent
   overlays to opacity utilities or token-derived functions.
2. Near-duplicate collapse: fold hex values that differ imperceptibly into the
   nearest canonical ramp step. This is the **only intended pixel change in the
   whole retrofit** - and it is allowed only under a computed WCAG contrast proof
   for any value that participates in a text/background pair (>= 4.5:1 for the
   small-label roles). Get explicit sign-off on the collapsed values before the
   stage lands.
3. Runtime-dynamic inline styles (computed colors) become conditional classes
   with token utilities - keep the accompanying non-color encodings (icon, text
   label) so status is never color-only.
4. Legitimately raw contexts (print pipelines, browser chrome, chart-internal
   values) stay raw with an inline `design-token-exempt: <reason>` comment.

Run an accessibility audit (axe-core, per `accessibility-audit`) on the main
surfaces after this stage. Allowlist delta: remove color entries as they exhaust.

### Stage 3 - Radii, shadows, layout dims

Radii and shadow literals to token presets (glow/shadow parameterizations
collapse to a few presets; box-shadow values belong in tokens). Semantic
dimensions (input heights, panel sizes) to size tokens. Data-driven dimensions
(chart geometry, container constants) either become named tokens or stay raw
with `design-token-exempt: <reason>`. Allowlist delta: px entries leave as they
exhaust.

### Stage 4 - Machine-verified allowlist residue

The allowlist (`designLint.allowlist` in `docs/workspace-schema.json`) exempts
documented raw literals from the lint. Reduce it to honest residue:

1. Collect the full match set per pattern class (hex, px, rgba/hsla) from a lint
   run, so every entry's live occurrences are known.
2. For each entry, run remove-entry-then-relint: delete the entry, re-run the
   lint. A clean pass proves the entry has no live occurrences - dead entries
   are deleted, not kept as clutter. A failing pass names the remaining
   occurrences; map them to tokens (back to Stage 1-3) or document the reason.
   Through this loop the co-price allowlist went 158 -> 131 entries in its live
   run.
3. Rewrite the surviving entries' reasons to describe the residue classes
   (print pipeline, browser chrome, chart-internal values) rather than listing
   individual historical values.

**Exit condition**: every remaining allowlist entry carries a documented reason
for its residue, and the design lint (`design-lint.ts --json` equivalent) is
green. The retrofit is done when the lint is a live fence, not a backlog.

## Validation Gates Per Stage

- Design lint green per PR; the token-usage fail count decreases monotonically
  across stages.
- Visual evidence per user-facing stage (ADR-0070 preview verification):
  rendered screenshots at two breakpoints plus one key interaction, attached to
  the PR. Value-preserving stages need the evidence to prove preservation; the
  near-duplicate collapse stage additionally needs the contrast computation.
- In-flight feature branches that still emit raw literals start failing the
  gate as their values leave the allowlist - that is the designed enforcement;
  coordinate landing order rather than re-adding entries.

## Expected Outputs

- Token SSOT file + framework bridge + truth-up lint config (Stage 0)
- One merged PR per stage, each with its allowlist delta stated
- Contrast computations for every collapsed value in a text/background pair
- A reduced allowlist with per-entry documented reasons
- Updated design-decision record pointing at the token SSOT

## Fleet Status and Deferral Boundary

- First fleet target: **co-architect** - its `designLint.allowlist` carries 122
  entries and `tokenSources` is absent (pre-Stage-0), matching the retrofit
  entry condition on the same Tailwind v4 + design-lint substrate as co-price.
- No template or code promotion accompanies this skill: the playbook references
  provenance paths (co-price design doc, `tokens.css`, `design-lint.ts`) instead
  of promoting any variant file into `templates/`. Promotion to a shared
  primitive, scaffold asset, or L1 fleet propagation is deferred until a second
  variant demands the retrofit or the upstream lint substrate stabilizes at P2+
  - whichever first. Until then the skill stays L0-only
  (`l2_propagate: false`).

## Provenance

- Method and gates: `Projects/co-price/docs/designs/2026-10-29-token-adoption-design.md` (§5 Migration plan, §7 Sequencing)
- Token SSOT reference: `Projects/co-price/src/app/tokens.css` (3-layer architecture)
- Allowlist mechanism: `Projects/co-price/scripts/design-lint.ts:286-319` (`DesignLintConfig`: `scanRoots` / `tokenSources` / `allowlist`)

## Related Skills

- **token-usage-lint**: the detection half this workflow gates every stage with
- **design-foundation**: the greenfield counterpart (Stage 4 token architecture); retrofit assumes its vocabulary but not its execution
- **accessibility-audit**: contrast/axe verification for the color stage
