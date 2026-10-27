# Component Primitives Catalog

> A registry of composable, token-bound UI primitives for the co-design system. Each primitive maps to the token classes it MUST consume, ensuring generated components cannot bypass the single source of truth (tokens.json).
>
> This catalog is the **binding contract** between design tokens and component implementation. All primitive implementations MUST consume tokens only — no raw hex/px/em values outside this contract. Actual component implementations live in consumer projects.

## Token Domain Primer

| Domain | Keys | Compiled CSS Variable Pattern | Usage Scope |
|--------|------|-------------------------------|-------------|
| `color` | `primary`, `secondary`, `success`, `warning`, `danger`, `background`, `text` | `--color-{key}` | Component backgrounds, text, borders, focus rings |
| `typography.fontFamily` | `sans`, `mono` | `--typography-font-family-{key}` | Body text, code, data display |
| `typography.fontSize` | `xs`, `sm`, `base`, `lg`, `xl` | `--typography-font-size-{key}` | Heading scale, body copy, labels |
| `typography.fontWeight` | `regular`, `bold`, `heading` | `--typography-font-weight-{key}` | Body copy, emphasis, headings |
| `typography.lineHeight` | `body`, `heading`, `tight` | `--typography-line-height-{key}` | Body copy, headings, dense data cells |
| `typography.numericVariant` | `tabular-nums` | `--typography-numeric-variant` | Aligned figure columns |
| `spacing` | `xs`, `sm`, `md`, `lg`, `xl` | `--spacing-{key}` | Padding, margins, gaps, insets |
| `borderRadius` | `sm`, `md`, `lg` | `--border-radius-{key}` | Button corners, card edges, input fields |
| `shadow` | `sm`, `md`, `lg` | `--shadow-{key}` | Dropdowns, modals, elevated cards |
| `focus` | `ring`, `ring-offset` | `--focus-{key}` | Focus indicator for interactive controls |
| `target` | `size` | `--target-size` | Minimum interactive target size (2.75rem) |
| `motion` | `duration-fast`, `duration-normal`, `duration-slow` | `--motion-duration-{key}` | Animation durations (e.g. Skeleton shimmer) |

> **Naming convention**: the **Required Token** column names tokens in design-notation form `group.key` (camelCase), resolved through the semantic layer. `tokens.json` and compiled CSS variables use kebab-case literal keys; the compiler's camelCase→kebab-case mapping (`compile-tokens.ts`) is lossless, so `typography.fontSize.sm` ⇔ `semantic.typography.font-size.sm` ⇔ `--typography-font-size-sm`. Where the semantic root name differs from the primitive group (`radius`→`border-radius`, `space`→`spacing`, `text-size`→`font-size`, `elevation`→`shadow`, `duration`→`motion-duration`), the notation follows the semantic name and this Primer's "Compiled CSS Variable Pattern" column gives the literal variable. Registries and implementations must cite the compiled variable form.

## Primitive Catalog

> **Accessibility verification**: annotations below are the contract; conformance is demonstrated per feature with the `accessibility-audit` skill (axe-core) against the playground, plus `:focus-visible` / keyboard-only walkthrough (design.md §8 — project instantiation; each co-design checkout maintains its own `docs/design.md`). A primitive whose declared pair fails axe in any theme is a catalog defect → Ruling 2 exception E2 (project instantiation ruling, spec 2026-10-27-deferred-items-design).

### Form Inputs

#### Button
**Role:** Primary action trigger with semantic variant states.

| Variant / State | Required Token | Token Type |
|-----------------|----------------|------------|
| Background (default) | `color.primary` | Color |
| Text (default) | `color.background` | Color |
| Background (secondary) | `color.secondary` | Color |
| Background (destructive) | `color.danger` | Color |
| Background (ghost/outline) | `color.background` | Color |
| Border (outline) | `color.primary` | Color |
| Text (hover) | `color.background` | Color |
| Background (hover) | `color.primary` (darken 10%) | Color |
| Background (active) | `color.primary` (darken 20%) | Color |
| Background (disabled) | `color.secondary` | Color |
| Border radius | `borderRadius.md` | Border radius |
| Padding (horizontal) | `spacing.lg` | Spacing |
| Padding (vertical) | `spacing.md` | Spacing |
| Focus ring | `focus.ring` | Focus |
| Focus ring offset | `focus.ring-offset` | Focus |

> **Accessibility:** contrast — `--color-background` on `--color-primary` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme; focus — visible `:focus-visible` ring via `--focus-ring` / `--focus-ring-offset`; target — ≥ `--target-size` (2.75rem); state — disabled = `color.secondary` bg + reduced affordance, never color-only.

#### Input
**Role:** Text/data entry field with focus states.

| State | Required Token | Token Type |
|-------|----------------|------------|
| Background | `color.background` | Color |
| Border | `color.secondary` | Color |
| Border (focus — supplementary) | `color.primary` | Color |
| Text | `color.text` | Color |
| Placeholder | `color.secondary` | Color |
| Border radius | `borderRadius.md` | Border radius |
| Padding (horizontal) | `spacing.md` | Spacing |
| Padding (vertical) | `spacing.sm` | Spacing |
| Font family | `typography.fontFamily.sans` | Font family |
| Font size | `typography.fontSize.base` | Font size |

> **Accessibility:** contrast — `--color-text` on `--color-background` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme; focus — visible `:focus-visible` ring via `--focus-ring` / `--focus-ring-offset`; target — ≥ `--target-size` (2.75rem); state — focus and validation are never border-color alone: the shared `focus.ring` carries focus and text conveys errors.

> Focus indicator: the border-color change is a SUPPLEMENTARY indicator only — the required focus indicator is the shared `focus.ring` (see Button / Checkbox-Switch bindings). Border color alone does not satisfy focus visibility.

#### Label
**Role:** Form field descriptor.

| Property | Required Token | Token Type |
|----------|----------------|------------|
| Text color | `color.text` | Color |
| Font size | `typography.fontSize.sm` | Font size |
| Font family | `typography.fontFamily.sans` | Font family |
| Margin (bottom) | `spacing.xs` | Spacing |

> **Accessibility:** contrast — `--color-text` on `--color-background` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme.

#### Checkbox / Switch
**Role:** Binary selection control.

| State | Required Token | Token Type |
|-------|----------------|------------|
| Border (unchecked) | `color.secondary` | Color |
| Background (checked) | `color.primary` | Color |
| Background (checked, hover) | `color.primary` (darken 10%) | Color |
| Border radius (checkbox) | `borderRadius.sm` | Border radius |
| Border radius (switch) | `borderRadius.lg` | Border radius |
| Focus ring | `focus.ring` | Focus |
| Focus ring offset | `focus.ring-offset` | Focus |

> **Accessibility:** contrast — `--color-background` on `--color-primary` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme; focus — visible `:focus-visible` ring via `--focus-ring` / `--focus-ring-offset`; target — ≥ `--target-size` (2.75rem); state — checked = fill + ✓ glyph + `aria-checked`, never color-only.

#### Select
**Role:** Dropdown selection menu.

| State | Required Token | Token Type |
|-------|----------------|------------|
| Background | `color.background` | Color |
| Border | `color.secondary` | Color |
| Border (focus — supplementary) | `color.primary` | Color |
| Text | `color.text` | Color |
| Border radius | `borderRadius.md` | Border radius |
| Padding | `spacing.sm` | Spacing |
| Shadow (dropdown) | `shadow.md` | Shadow |

> **Accessibility:** contrast — `--color-text` on `--color-background` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme; focus — visible `:focus-visible` ring via `--focus-ring` / `--focus-ring-offset`; target — ≥ `--target-size` (2.75rem); state — focus and validation are never border-color alone: the shared `focus.ring` carries focus and text conveys errors.

> Focus indicator: the border-color change is a SUPPLEMENTARY indicator only — the required focus indicator is the shared `focus.ring` (registry binds `--focus-ring` for Select). Border color alone does not satisfy focus visibility.

### Layout

#### Card
**Role:** Content container with semantic regions.

| Region / State | Required Token | Token Type |
|----------------|----------------|------------|
| Background (container) | `color.background` | Color |
| Border radius | `borderRadius.lg` | Border radius |
| Shadow | `shadow.sm` | Shadow |
| Shadow (elevated) | `shadow.md` | Shadow |
| Padding (header) | `spacing.md` `spacing.lg` | Spacing |
| Padding (content) | `spacing.lg` | Spacing |
| Padding (footer) | `spacing.md` `spacing.lg` | Spacing |

> **Accessibility:** contrast — `--color-text` on `--color-background` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme.

#### Separator
**Role:** Visual divider.

| Property | Required Token | Token Type |
|----------|----------------|------------|
| Color | `color.secondary` | Color |
| Height | `1px` (fixed) | — |
| Margin (vertical) | `spacing.md` | Spacing |

> **Accessibility:** contrast — `--color-secondary` on `--color-background` ≥ **3:1** (non-text) in every shipped theme.

### Feedback

#### Alert
**Role:** Status message with semantic levels.

| Variant | Required Token | Token Type |
|---------|----------------|------------|
| Background (info) | `color.primary` | Color |
| Text (info) | `color.background` | Color |
| Background (success) | `color.success-bg` | Color |
| Text (success) | `color.success-fg` | Color |
| Border (success) | `color.success-border` | Color |
| Background (warning) | `color.warning-bg` | Color |
| Text (warning) | `color.warning-fg` | Color |
| Border (warning) | `color.warning-border` | Color |
| Background (destructive) | `color.danger-bg` | Color |
| Text (destructive) | `color.danger-fg` | Color |
| Border (destructive) | `color.danger-border` | Color |
| Border radius | `borderRadius.md` | Border radius |
| Padding | `spacing.md` | Spacing |
| Shadow | `shadow.sm` | Shadow |

> AA binding (E2, spec 2026-10-27-deferred-items-design — project instantiation record): the success / warning / destructive variants bind the status bg/fg/border triplets — the light-theme filled pairings they replace (white on `color.success` ≈3.1:1, white on `color.warning` ≈1.6:1) cannot meet the WCAG 2.1 AA 4.5:1 text floor in every shipped theme.

> Documented deviation: the info variant intentionally binds `color.primary` (filled; white-on-blue-500 ≈5.6:1 passes AA) — no `info` triplet is minted in tokens.json, so primary serves the info semantic. Revisit this binding if a true info token is ever added.

> **Accessibility:** contrast — each variant's `--color-{success,warning,danger}-fg` on its matching `--color-*-bg` (info: `--color-background` on `--color-primary`) ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme; state — status = icon + text label + color, multi-encoded per design.md §4 (project instantiation), never color-only.

#### Badge
**Role:** Small status or count indicator.

| Variant | Required Token | Token Type |
|---------|----------------|------------|
| Background (default) | `color.background` | Color |
| Border (default) | `color.secondary` | Color |
| Text (default) | `color.text` | Color |
| Background (success) | `color.success-bg` | Color |
| Text (success) | `color.success-fg` | Color |
| Background (warning) | `color.warning-bg` | Color |
| Text (warning) | `color.warning-fg` | Color |
| Background (destructive) | `color.danger-bg` | Color |
| Text (destructive) | `color.danger-fg` | Color |
| Border radius | `borderRadius.sm` | Border radius |
| Padding (horizontal) | `spacing.sm` | Spacing |
| Padding (vertical) | `spacing.xs` | Spacing |
| Font size | `typography.fontSize.sm` | Font size |

> AA binding (E2, spec 2026-10-27-deferred-items-design — project instantiation record): status variants bind the status bg/fg triplets, mirroring `component.badge` (which the playground already consumes); the default variant moves to the outline treatment — the filled `color.secondary`/white pairing ≈3.9:1 fails the 4.5:1 text floor at `fontSize.sm`, and the shipped badge has no filled default.

> **Accessibility:** contrast — each variant's `--color-{success,warning,danger}-fg` on its matching `--color-*-bg` (default: `--color-text` on `--color-background`) ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme; state — status = icon + text label + color, multi-encoded per design.md §4 (project instantiation), never color-only.

#### Progress
**Role:** Loading or completion indicator.

| Property | Required Token | Token Type |
|----------|----------------|------------|
| Background (track) | `color.secondary` | Color |
| Background (fill) | `color.primary` | Color |
| Border radius | `borderRadius.lg` | Border radius |
| Height | `spacing.sm` | Spacing |

> **Accessibility:** contrast — `--color-primary` on `--color-secondary` ≥ **3:1** (non-text) in every shipped theme; state — `role="progressbar"` + `aria-valuenow`, never color-only.

#### Skeleton
**Role:** Loading placeholder.

| Property | Required Token | Token Type |
|----------|----------------|------------|
| Background | `color.secondary` | Color |
| Border radius | `borderRadius.sm` | Border radius |
| Animation duration | `motion.duration-normal` | Motion |

> Shimmer: `color.secondary` at 40% opacity over `color.background` — a composition of existing tokens, no new token is minted.

> **Accessibility:** contrast — `--color-secondary` on `--color-background` ≥ **3:1** (non-text) in every shipped theme; state — `aria-busy` marks loading content, never color-only.

### Overlay

#### Dialog / Modal
**Role:** Focused content overlay.

| Region | Required Token | Token Type |
|--------|----------------|------------|
| Background (overlay) | `color.text` (with opacity) | Color |
| Background (content) | `color.background` | Color |
| Border radius | `borderRadius.lg` | Border radius |
| Shadow | `shadow.lg` | Shadow |
| Padding | `spacing.xl` | Spacing |
| Max width | `560px` (fixed) | — |
| Focus ring | `focus.ring` | Focus |
| Focus ring offset | `focus.ring-offset` | Focus |

> **Accessibility:** contrast — `--color-text` on `--color-background` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme; focus — visible `:focus-visible` ring via `--focus-ring` / `--focus-ring-offset`; state — focus is trapped inside the dialog and Escape closes it; the overlay carries no own target-size requirement.

#### Tooltip
**Role:** Contextual help popup.

| Property | Required Token | Token Type |
|----------|----------------|------------|
| Background | `color.text` | Color |
| Text | `color.background` | Color |
| Border radius | `borderRadius.sm` | Border radius |
| Shadow | `shadow.md` | Shadow |
| Padding | `spacing.xs` `spacing.sm` | Spacing |
| Font size | `typography.fontSize.sm` | Font size |

> **Accessibility:** contrast — `--color-background` on `--color-text` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme; focus — visible `:focus-visible` ring on the trigger via `--focus-ring` / `--focus-ring-offset`; the tooltip itself is exempt from target-size.

### Data Display

#### Table
**Role:** Structured data grid.

| Region | Required Token | Token Type |
|--------|----------------|------------|
| Border color | `color.secondary` | Color |
| Background (header) | `color.background` | Color |
| Background (row, hover) | `color.secondary` (with opacity) | Color |
| Text (header) | `color.text` | Color |
| Text (body) | `color.text` | Color |
| Padding (cell) | `spacing.md` | Spacing |
| Font size | `typography.fontSize.base` | Font size |

> **Accessibility:** contrast — `--color-text` on `--color-background` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme; state — sortable columns expose `aria-sort` and the table carries a `caption`, never color-only.

#### Tabs
**Role:** Content switcher.

| State | Required Token | Token Type |
|-------|----------------|------------|
| Background (active) | `color.background` | Color |
| Background (inactive) | `color.secondary` (with opacity) | Color |
| Border (bottom, active) | `color.primary` | Color |
| Text (active) | `color.primary` | Color |
| Text (inactive) | `color.text` | Color |
| Border radius | `borderRadius.md` | Border radius |
| Padding | `spacing.md` `spacing.lg` | Spacing |

> **Accessibility:** contrast — `--color-primary` on `--color-background` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme; focus — visible `:focus-visible` ring via `--focus-ring` / `--focus-ring-offset`; target — ≥ `--target-size` (2.75rem); state — selected = weight + underline + `aria-selected`, never color-only.

### Typography

#### Heading / Text Scale
**Role:** Semantic typography hierarchy.

| Level | Required Token | Token Type |
|-------|----------------|------------|
| Font family (headings) | `typography.fontFamily.sans` | Font family |
| Font family (code) | `typography.fontFamily.mono` | Font family |
| Font size (h1) | `typography.fontSize.xl` (1.5rem); `typography.fontSize.lg` (1.25rem) in dense contexts | Font size |
| Font size (h2) | `typography.fontSize.lg` (1.25rem) | Font size |
| Font size (h3) | `typography.fontSize.base` (1rem) | Font size |
| Font size (body) | `typography.fontSize.base` (1rem); `typography.fontSize.sm` (0.875rem) in dense contexts | Font size |
| Font size (small / caption) | `typography.fontSize.xs` (0.75rem) / `typography.fontSize.sm` (0.875rem) | Font size |
| Font weight (headings) | `typography.fontWeight.heading` (800) | Font weight |
| Font weight (body / caption) | `typography.fontWeight.regular` (400) | Font weight |
| Color | `color.text` | Color |

> Scale rule: headings and body bind token steps + weights directly — one `h1` per view (design.md §4, project instantiation), no derived multipliers. A computed step (e.g. ×2.5 on a base size) exists in no token and is unreachable in the shipped system (`typography.fontSize.xl` = 1.5rem is the scale ceiling).

> **Accessibility:** contrast — `--color-text` on `--color-background` ≥ **4.5:1** (AA text; **3:1** for large text / non-text) in every shipped theme.

## Composition Rules

1. **Token-only consumption** — Primitives MUST reference tokens.json values ONLY via CSS custom properties (e.g., `var(--color-primary)`) or TypeScript constants. Raw hex codes, pixel values, or em units are FORBIDDEN in primitive implementations.

2. **Nesting composes via spacing tokens** — Child components within primitives MUST use spacing tokens for margins/padding (e.g., `var(--spacing-md)`). No arbitrary pixel gaps.

3. **Variant maps 1:1 to token classes** — Each primitive variant (default/secondary/destructive, hover/active/disabled) MUST have an explicit token mapping in this catalog. No silent variants.

4. **New primitives require catalog entry first** — Before implementing any new component, add its token mappings to this catalog. This document is the contract that the `token-usage-lint` skill (v1.1.1) and `scripts/design-lint.ts` enforce today.

5. **Shadow and radius defaults** — Elevated components (dialogs, dropdowns, cards) consume `shadow.md` or `shadow.lg`. Interactive controls (buttons, inputs) consume `borderRadius.md`. Override ONLY if catalog-specified.

## Hardcoded-Value Ban

Raw values outside tokens.json are PROHIBITED in primitive implementations:

- **FORBIDDEN**: Hex colors (e.g., `#0066cc`, `rgb(0, 102, 204)`), pixel values (e.g., `8px`, `1rem` without token backing), em units without token basis.
- **REQUIRED**: ALL colors, spacing, radii, shadows, and typography MUST reference tokens via CSS custom properties (`var(--color-primary)`, `var(--spacing-md)`) or TS constants.
- **EXCEPTIONS**: Fixed ratios only (e.g., `1px` borders, fixed aspect ratios, percent-based widths). Fixed pixel values for dimensions (e.g., `560px` max-width for dialogs) are catalog-exempt only if explicitly noted in this document.

This catalog is the binding contract. Violations are flagged by the `token-usage-lint` skill and `scripts/design-lint.ts` (token-usage check) on every PR.
