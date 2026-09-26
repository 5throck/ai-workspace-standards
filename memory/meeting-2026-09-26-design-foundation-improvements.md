# Meeting: Design Foundation Improvements (design-foundation coverage audit follow-up)

- **Date**: 2026-09-26
- **Facilitator**: PM (ZCode session, meeting-facilitation skill)
- **Participants**: Architect (design owner), Documentation Writer, Automation Engineer, Consistency Auditor (**red-team / dissent seat**)
- **Trigger**: User-requested coverage audit of the Design Foundation framework (philosophy / principles / guide / color system / standard components / standard screens / style / icons / fonts), followed by a request to derive improvement plans via a meeting.
- **Governance**: Dissent seat occupied; outcome is a PROPOSAL for user approval (not a decision); dissent preserved verbatim below.

## 1. Audit Findings (input to the meeting)

| Item | Verdict | Evidence |
|------|---------|----------|
| Design philosophy | Covered | `design_decisions.philosophy` block (spec §4); rationale mandatory |
| Design principles | Covered | §3 derivation (3–6 falsifiable principles); pipeline layer ① |
| Design guide | Covered | Project SSOT `docs/design.md`; pipeline layer ③ "Style guide & color system" |
| Color system | Covered | §4 color decision; §5 3-layer tokens; status bg/fg/border triplets; `[data-theme]`; `design-tokens.template.css` |
| Standard components | **Partial** | Pipeline layer ⑤ + component tokens (`--button-*`, `--card-*`, `--input-*`, `--tooltip-*`) only; no catalog/inventory template; spec procedure delegated to `ui-ux-design-intelligence` |
| Standard screens | **Partial** | `screen-patterns.template.md` (inventory shape only; co-design reference non-normative); pipeline layers ⑥–⑦ |
| Style | Structure covered / values excluded **by design** | "Foundation ≠ Design System"; style-neutral is a stated design principle |
| Icons | Covered for declaration+validation; **gaps in tokens & vocabulary template** | Pipeline layer ④; `design_decisions.iconography`; single-library rule; design-phase gate rule 4d (icon-vocabulary registration); design-lint "non-registered icons"; §7 [Required] "Icon library defined". Missing: no `--icon-*` tokens in `design-tokens.template.css`; no icon-vocabulary inventory template (lint's "registered icons" has no machine-readable source) |
| Fonts | Covered; **gap in fallback/loading guidance** | Typography roles body/heading/numeric (numeric ⇒ `tabular-nums` mandatory); licensing + Korean-optimization criteria; `--font-body/-heading/-numeric`, `--text-*`, `--font-weight-*`; §7 [Required] "Typography roles defined". Missing: no fallback-stack contract, no font-loading strategy guidance |
| Stale reference (found) | Defect | `design-foundation.md` §8 (~L215) cites `co-newbiz docs/design-guide.md`; actual path is `Projects/co-newbiz/docs/design-system/design-guide.md` |

## 2. Round Contributions (verbatim-position summaries)

### Architect
1. Add a shape-only `components.template.md` (inventory table: component name, component tokens consumed, states, a11y evidence) mirroring the screen-patterns precedent — do not rely on `ui-ux-design-intelligence` alone; "components" is the one pipeline layer with no reviewable artifact. L1 effort.
2. Keep project-declared pattern inventories; template adequate. Later: one-line cross-reference to the component inventory.
3. Style-neutral: keep as-is. Relaxing imports taste into L1 and breaks the provenance chain.
4. Fix §8 path; bundle items 4–6 into one spec revision (design-foundation v1.2) to avoid three spec-check cycles.
5. Icons: add `--icon-size`/`--icon-stroke` (primitives) + `--icon-color` (semantic) to the CSS scaffold; add `icon-vocabulary.template.md`; add §7 [Required] "icon vocabulary declared". Untokened iconography violates "tokens are data" (§2b rule 2).
6. Fonts: add a `loading` sub-field to the typography decision block (fallback stack, `font-display`, self-host vs CDN, variable-font stance) + Korean subsetting bullet in §6. Criteria, not values. No new artifact.

### Documentation Writer
1. Add `components.template.md` as a registration skeleton (name, role, props/variants, states, bound tokens, status draft/stable/deprecated, implementation link). Prescriptive anatomy/visual specs stay out.
2. Keep project-declared inventories; add a minimum field contract per pattern entry (trigger, layout skeleton, primary action, empty/loading/error states, component references).
3. Keep style-neutral — "the load-bearing wall". Items 1/5 must be designed to pass it.
4. Fix §8 at SSOT (`templates/common`), propagate via project-resync to `Projects/*/docs/` and check `docs/lifecycle/skills`; `design-guide_ko.md` is in the translation zone — re-sync for parity; grep all three locations before closing.
5. Icons: `--icon-size`/`--icon-stroke`/`--icon-color` with comments tied to the iconography decision block; minimal `icon-vocabulary.template.md` (name, semantic usage, aria-label text, status).
6. Fonts: §6 mandatory decision checklist (font-display, fallback stack construction, self-host vs CDN, variable fonts, Korean subsetting) + one-line pointer comment at the font tokens. `design_decisions` records choices, not how to choose.
Structure: new templates English-only at template level, same frontmatter convention, wired into `docs/templates/common-contract.json`.

### Automation Engineer
1. Catalog: human doc + `components.registry.yaml` (SSOT: component id, required token bindings, layout primitives). Lint rule: non-`var(--token)` literal in a component style block fails. Extends `token-usage-lint` — enforceable today in co-design projects; shared design-lint listed in §7 backlog.
2. Patterns: schema-first (`patterns.registry.yaml`: pattern id, entry-point token requirements, allowed layout primitives); validate at design-phase gate — screen must reference a registered pattern id or file a waiver. Zod validation via existing `zod-contract-gate` — enforceable today.
3. Style-neutral: keep. Relaxing converts a bounded deny-list into an unbounded allow-list review problem; enforcement surface must stay constant.
4. Fix the ref now; separately add an idempotent link/path checker to `scripts/audit.ts` (extract relative paths from indexed docs, verify existence, fail on stale) — ~1 hour, catches this class permanently. "Review-only checking does not scale."
5. Icons: tokens in scaffold (trivial, enforceable today); make `icon-vocabulary.yaml` the machine-readable SSOT (icon id, source set, allowed contexts) — the design-lint "non-registered icons" check reduces to set membership against it. Registry must precede the lint (backlog dependency).
6. Fonts: encode full stacks as token values (`--font-body: <primary>, <fallback>, <generic>;`) — one SSOT, no parallel drift; enforceable check (≥1 fallback + terminating generic) is regex-level, backlog until design-lint ships.
Cross-cutting: land all new checks as pluggable variant hooks; core `audit.ts`/`dev-sync.ts` stay identical across templates.

### Consistency Auditor (RED TEAM — dissent)
1. **REJECT** standalone component catalog template. Contradicts the framework's own placement of component selection downstream (layer ⑤, `ui-ux-design-intelligence`, project-owned). Scaffolds get copied verbatim; placeholder rows become the project's component set by inertia — a de-facto prescribed inventory, "exactly what the framework forbids". "The audit's 'PARTIAL' verdict measures a *record*, not a *method*, gap." Minimal consistent fix: an empty "Component inventory" section appended to `screen-patterns.template.md` — register shape, zero entries, populated only via the pipeline gate. A standalone new template file is scope creep.
2. **REJECT** icon-vocabulary template (registration gate + decision block + §7 checks already make vocabulary a governed procedure; "a template adds no governance, only a place to paste results"). **Conditionally accept** icon tokens only if (a) shipped commented-out or empty — inert until the iconography decision block is exercised — and (b) §7 validates tokens against the *registered* vocabulary, never against shipped examples. Bloat concern for text-heavy projects that never declare icons.
3. **REJECT** font loading/fallback guidance in `design-foundation.md` — "runtime/performance concerns, web-platform-specific. Embedding them in a methodology spec starts platform drift — the neutrality claim is methodological, not only stylistic." Belongs in project runtime docs or the downstream `ui-ux-design-intelligence` skill. One concession: the font token *schema* may carry a fallback-chain field per role — token completeness, not loading guidance.
4. **ACCEPT** the stale-ref issue but **REJECT the fix direction**: "Do not update the path. The deeper defect is structural: an L1 template shipped into scaffolded projects must not point at workspace-root example artifacts (`Projects/co-newbiz/...`); it breaks the moment any project stands alone." Correct fix: remove the project-specific pointer or rephrase generically. "Patching the path preserves the L0/L1 violation underneath."
5. Accepts: item 4 (as relocation/removal, not path update); item 3's fallback-chain token field; item 2's conditional opt-in icon tokens. **Binding constraints for any accepted artifact**: (a) inventory/register shape only — zero prescribed values, no examples shipped as defaults; (b) content populated exclusively through the pipeline decision gate; (c) §7 validates against registered decisions, never template content; (d) scaffold additions inert (empty or commented) unless the corresponding decision block is exercised; (e) no platform-specific implementation prose anywhere in the methodology spec.

## 3. Synthesized PROPOSAL (pending user approval — not a decision)

| # | Proposal | Consensus notes |
|---|----------|-----------------|
| P1 | **Component inventory**: add `components.template.md` as a **shape-only, zero-entry** registration table (component name, bound tokens, states, a11y evidence, status), populated exclusively via the design-phase gate; plus `components.registry.yaml` schema for lint (backlog for shared design-lint). | Architect/docs-writer/automation-engineer in favor; auditor accepts only under red-team constraints (a)–(d) — auditor's lighter alternative: an empty inventory section inside `screen-patterns.template.md`. **User to pick: standalone file (recommended, mirrors layer-⑥ precedent) vs appended section.** |
| P2 | **Screens**: keep project-declared inventories; add the minimum field contract per pattern entry (trigger, layout skeleton, primary action, empty/loading/error states); optional `patterns.registry.yaml` schema validated by `zod-contract-gate` at the design-phase gate. | Uncontested. |
| P3 | **Style-neutral**: keep unchanged. | Unanimous (4/4). |
| P4 | **Stale §8 reference**: two options — (i) genericize/remove the project-specific pointer per red team (structurally correct; no standalone-project breakage), or (ii) update the path and propagate to `Projects/*/docs/` + `docs/lifecycle/skills` + Korean translation parity (docs-writer's wave). **Recommended: (i), plus automation-engineer's path-existence checker in `scripts/audit.ts`** so the class of defect is caught mechanically. | Fix agreed; direction split — recorded as dissent, user to ratify. |
| P5 | **Icons**: add `--icon-size`/`--icon-stroke`/`--icon-color` to the token scaffold as **inert placeholders (commented/empty)** activated when the iconography decision is exercised; add an **icon-vocabulary inventory** in machine-readable form (`icon-vocabulary.yaml`) + one §7 [Required] line "icon vocabulary declared". No standalone vocabulary `.md` template (red team). | Majority in favor with red-team constraints (b)(d); vocabulary-as-template rejected by auditor — machine-readable file satisfies the lint dependency instead. |
| P6 | **Fonts**: add fallback-chain to the font token value contract (`--font-body: <primary>, <fallback>, <generic>;` with ≥1 fallback + terminating generic); add Korean subsetting / `unicode-range` as a §4 selection criterion bullet. **No** `font-display`/CDN/preload section in the methodology spec (red team, constraint (e)) — route loading guidance to `ui-ux-design-intelligence` or project runtime docs. | Synthesis of architect+docs-writer+automation-engineer proposals constrained by red-team (e). |

**Execution shape (if approved)**: single Design Gate pass — one design doc (`docs/designs/…-design.md`) + spec revision `design-foundation.md` v1.2 bundling P1/P2/P4/P5/P6 edits, checklist template update, `common-contract.json` wiring for any new file, then PM-dispatched implementation (architect spec / docs-writer docs / automation-engineer audit-script hook) → `/sync`. No L0 changes; existing projects not retrofitted (per §9 precedent, v1.2 applies to new derivations).

## 4. Dissent preserved verbatim (unchanged from §2, auditor section)

Key dissenting statements, transcribed as stated:
- "A shipped catalog template contradicts 'this template never prescribes layout patterns'… placeholder rows become the project's component set — a de-facto prescribed inventory by inertia, not by decision."
- "The audit's 'PARTIAL' verdict measures a *record*, not a *method*, gap."
- "Do not update the path. The deeper defect is structural… Patching the path preserves the L0/L1 violation underneath."
- "Runtime/performance concerns, web-platform-specific. Embedding them in a methodology spec starts platform drift — the neutrality claim is methodological, not only stylistic."

## 5. Action Items (proposed owners — execute only after user approval)

| Action | Owner | Tier |
|--------|-------|------|
| Design doc for design-foundation v1.2 (bundles P1/P2/P4/P5/P6) + `spec-register` | architect | L0 Design Gate |
| `components.template.md` (shape-only) + `common-contract.json` wiring | docs-writer | L1 |
| Token scaffold edits (icon tokens inert; font fallback contract) | docs-writer (review: automation-engineer) | L1 |
| Pattern field contract + §7/§2b spec line edits (icon vocabulary, component inventory cross-ref) | architect (spec) + docs-writer (text) | L1 |
| §8 reference resolution (option per user) + propagation sweep incl. `_ko` parity | docs-writer | L1 + projects |
| `scripts/audit.ts` link/path checker (idempotent) | automation-engineer | L0 script |
| Registry schemas (`components.registry.yaml`, `patterns.registry.yaml`, `icon-vocabulary.yaml`) + design-lint backlog ticket | automation-engineer | L1 + backlog |
