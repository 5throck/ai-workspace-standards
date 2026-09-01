# Design Foundation

> **What this is**: The workspace's style-neutral methodology for deriving a project's own design system.
> **What this is NOT**: A design system. It prescribes no colors, fonts, spacing values, or visual trends.
>
> **Foundation ≠ Design System.** This document tells you *what* a project must define. The project's actual
> design system is its own `docs/design.md` (project SSOT). Design selection happens at the project level —
> never at workspace or template level.

- **Scope**: All projects scaffolded from this template
- **Normative source**: `docs/designs/2026-08-30-design-foundation-design.md` (L0)
- **Companion artifacts**: `docs/design-tokens.template.css` (token scaffold), `design-foundation` skill (derivation procedure)
- **Reference implementation**: `templates/co-design/tokens.json` + `scripts/compile-tokens.ts`

---

## 1. Normative Principles

1. Theme variation SHALL be expressed primarily through semantic-token mapping; primitive tokens SHOULD remain theme-neutral.
2. Design decisions SHOULD record domain evidence/principle rationale so that the provenance chain
   **Domain Evidence → Design Principle → Design Decision → Token → Component** can be reconstructed.

## 2. Derivation Procedure (overview)

The `design-foundation` skill walks a project through these stages. Each stage consumes the previous one:

| Stage | Input | Output |
|-------|-------|--------|
| 1. Domain Evidence | PRD/SRS, user profiles, operating context | Evidence list (density needs, data criticality, audience, regulatory constraints) |
| 2. Design Principles | Evidence list | 3–6 numbered principles with per-principle rationale |
| 3. Design Decisions | Principles | `design_decisions` record (§4) — every selection justified by a principle |
| 4. Token Architecture | Decisions | Token file implementing §5 |
| 5. Components | Tokens | UI consuming component tokens only |
| 6. Validation | Everything | §7 validation contract |

## 3. Design Principles — how to derive them

Principles are derived from the project's domain, not from trends. Proven pattern (drawn from co-price
"Strategic Financial Aesthetics" and co-newbiz "Onyx 3.0" — as examples of *method*, not styles to copy):

- **Density**: What information density does the domain require? (e.g., expert consoles favor dense-but-legible; consumer onboarding favors breathing room). State the target viewport baseline.
- **Trust & Evidence**: If numbers/provenance are core to the domain, treat them as first-class: dedicated numeric typography, source-linked figures, consistent rendering of identical semantics.
- **Clarity**: Every screen answers "what am I looking at, what can I do, what happens next" at a glance.
- **Guided workflow**: If the domain has stages/processes, the UI reflects where the user stands.
- **Accessibility**: WCAG AA contrast, visible focus, status never conveyed by color alone.

Write 3–6 principles. Each must be falsifiable in review ("does this screen satisfy principle N?").
Pair them with operating rules (like co-newbiz's P1–P6) when the project needs machine-checkable constraints.

## 4. Design Decision Record

`docs/design.md` MUST contain a `design_decisions` record. **Every selection carries a `rationale`** — an
agent must never pick a font, color, or library without a traceable reason.

```yaml
design_decisions:
  philosophy:
    - principle: "<principle>"
      rationale: "<domain evidence>"
  color:
    selected: "<system description, e.g. HSL token scale>"
    rationale: "<...>"
  typography:
    body:    { selected: "<font>", rationale: "<...>" }   # primary reading face; Korean-optimized where applicable
    heading: { selected: "<font>", rationale: "<...>" }   # display/heading face
    numeric: { selected: "<font>", rationale: "<...>" }   # figures/IDs; MUST support tabular numerals if numbers are domain-critical
  spacing:   { scale: "<scale>",   rationale: "<...>" }    # e.g. 4px / 8px base grid
  radius:    { scale: "<scale>",   rationale: "<...>" }
  motion:    { policy: "<policy>", rationale: "<...>" }    # e.g. durations, easing curves, reduced-motion policy
  iconography: { library: "<library>", rationale: "<...>" }
```

### Selection criteria (not prescriptions)

| Area | Decide | Criteria |
|------|--------|----------|
| Typography — body | font | Primary-language optimization, screen legibility at 0.8–1rem, licensing |
| Typography — heading | font | Contrast with body, display weights available |
| Typography — numeric | font | **`tabular-nums` support mandatory when figures are domain-critical**; alignment of columns of numbers |
| Color | system + roles | Domain connotation (e.g. finance: profit/loss semantics), AA contrast for all role pairs, brand fit |
| Spacing | base unit | Multiple of 4px or 8px; consistent steps (xs→xl) |
| Radius / shadow | scales | 3–6 steps; match overall density (dense UIs → smaller radii/shadows) |
| Motion | policy | Shared easing curve; durations; `prefers-reduced-motion` behavior |
| Iconography | library | Single library per project; consistent size/stroke defaults; icon-only controls require `aria-label` |

## 5. Token Architecture (normative)

Three layers with a strict reference rule:

```
Primitive Tokens    --color-primary-500, --color-neutral-100 …   (theme-neutral values)
        ↓
Semantic Tokens     --background, --foreground, --border …       (theme-mapped via [data-theme])
        ↓
Component Tokens    --button-primary-bg …                        (semantic-only references)
        ↓
UI Components       (consume component tokens; may also consume semantic tokens directly
                     for one-off cases, but MUST NOT use raw values)
```

Rules:

1. **Semantic tokens reference ONLY primitives. Component tokens reference ONLY semantics.** Bypassing layers is a lint violation (§7).
2. **Theme variation lives in the semantic layer.** Canonical mechanism: `[data-theme="<name>"]` attribute selector
   (workspace convention, aligned with co-design's `compile-tokens.ts`). Do NOT use a `.dark` class mechanism.
3. **Primitives stay theme-neutral**: one value per primitive, independent of theme.
4. **Token contract**: default theme (`:root`) + at least one alternate theme (typically dark), each providing the
   full semantic set including **bg/fg/border triplets** for status semantics (e.g. `--green-bg/fg/border`,
   `--amber-*`, `--red-*`).
5. Include radius, shadow (2–5 steps), and a shared easing/motion token where the domain warrants it.
6. Use `design-tokens.template.css` as the starting scaffold; see co-design's `tokens.json` + `compile-tokens.ts`
   for a working reference implementation (JSON source → compiled CSS/TS forms, themes compiled to
   `[data-theme]` blocks).

## 6. Typography, Iconography & Layout defaults

- **Numeric UI**: wherever figures are domain-critical, use the numeric role font with
  `font-variant-numeric: tabular-nums` so columns of numbers align vertically.
- **Icons**: one library per project; fixed default size/stroke; every icon-only interactive element carries an
  `aria-label`.
- **Signals are multi-encoded**: status = color + icon + text. Never color alone.
- **Accessibility defaults**: WCAG AA contrast for all semantic role pairs, visible `:focus-visible` state,
  keyboard operability.
- **Layout**: declare the density model (baseline viewport, max content width policy, sidebar/topbar pattern)
  as a decision in `docs/design.md`, not as a default.

## 7. Design Validation Contract

This contract is review-enforced today; automated linting is a tracked backlog item. Where a project has
`token-usage-lint` available (co-design projects), run it — this contract extends, not replaces, it.

### [Required]
- ✓ `docs/design.md` exists with a complete `design_decisions` record
- ✓ Token implementation exists (CSS custom properties, or tokens.json + compiled forms)
- ✓ Default theme + at least one alternate theme of semantic tokens exist
- ✓ bg / fg / border semantic triplets exist for each status color
- ✓ Typography roles defined (body / heading / numeric)
- ✓ Icon library defined
- ✓ WCAG AA target declared
- ✓ Focus state defined
- ✓ Non-color state encoding defined

### [Consistency]
- ✓ Component tokens do not bypass semantic tokens
- ✓ Icon-only buttons have accessible labels
- ✓ Numeric UI uses tabular numerals where appropriate
- ✓ No hard-coded design values in governed components (raw hex, `rgb()`/`hsl()` literals, raw px spacing)

Accessibility verification should use the `accessibility-audit` skill (axe-core, WCAG 2.1 AA) rather than
ad-hoc checks.

This contract covers the **design system** layer. Feature-level accessibility is a separate, mandatory
duty: design docs for user-facing features MUST include an Accessibility section (target level, affected
interaction areas, verification method) per the workspace standard — see `docs/context.md` §
Accessibility Standards and ADR-0065.

## 8. Relationship to Other Workspace Assets

| Asset | Relationship |
|-------|--------------|
| `templates/co-design/tokens.json` + `scripts/compile-tokens.ts` | Reference implementation of the token architecture |
| `token-usage-lint` skill | Hardcoded-value detection; reused, not duplicated |
| `accessibility-audit` skill | WCAG verification; referenced, not redefined |
| `ui-ux-design-intelligence` skill (co-design) | Downstream: takes over once tokens and decisions exist (`design-foundation` enables it) |
| co-price `docs/design.md`, co-newbiz `docs/design-guide.md` | Originating examples of the *method* (Projects/, not templates) |

## 9. Migration Notes

- co-design's current flat single-layer `tokens.json` remains valid; migrating it to the 3-layer model is a
  tracked backlog item, not part of this Foundation's rollout.
- Existing projects (co-price, co-newbiz) already satisfy this contract substantively; retrofitting the
  `design_decisions` YAML block into their `docs/design.md` is optional and per-project.
