# Component Primitives Catalog

> A registry of composable, token-bound UI primitives for the co-design system. Each primitive maps to the token classes it MUST consume, ensuring generated components cannot bypass the single source of truth (tokens.json).
>
> This catalog is the **binding contract** between design tokens and component implementation. All primitive implementations MUST consume tokens only — no raw hex/px/em values outside this contract. Actual component implementations live in consumer projects.

## Token Domain Primer

| Domain | Keys | Compiled CSS Variable Pattern | Usage Scope |
|--------|------|-------------------------------|-------------|
| `color` | `primary`, `secondary`, `success`, `warning`, `danger`, `background`, `text` | `--color-{key}` | Component backgrounds, text, borders, focus rings |
| `typography.fontFamily` | `sans`, `mono` | `--typography-font-family-{key}` | Body text, code, data display |
| `typography.fontSize` | `sm`, `base`, `lg`, `xl` | `--typography-font-size-{key}` | Heading scale, body copy, labels |
| `spacing` | `xs`, `sm`, `md`, `lg`, `xl` | `--spacing-{key}` | Padding, margins, gaps, insets |
| `borderRadius` | `sm`, `md`, `lg` | `--border-radius-{key}` | Button corners, card edges, input fields |
| `shadow` | `sm`, `md`, `lg` | `--shadow-{key}` | Dropdowns, modals, elevated cards |

## Primitive Catalog

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
| Shadow (focus ring) | `shadow.sm` | Shadow |

#### Input
**Role:** Text/data entry field with focus states.

| State | Required Token | Token Type |
|-------|----------------|------------|
| Background | `color.background` | Color |
| Border | `color.secondary` | Color |
| Border (focus) | `color.primary` | Color |
| Text | `color.text` | Color |
| Placeholder | `color.secondary` | Color |
| Border radius | `borderRadius.md` | Border radius |
| Padding (horizontal) | `spacing.md` | Spacing |
| Padding (vertical) | `spacing.sm` | Spacing |
| Font family | `typography.fontFamily.sans` | Font family |
| Font size | `typography.fontSize.base` | Font size |

#### Label
**Role:** Form field descriptor.

| Property | Required Token | Token Type |
|----------|----------------|------------|
| Text color | `color.text` | Color |
| Font size | `typography.fontSize.sm` | Font size |
| Font family | `typography.fontFamily.sans` | Font family |
| Margin (bottom) | `spacing.xs` | Spacing |

#### Checkbox / Switch
**Role:** Binary selection control.

| State | Required Token | Token Type |
|-------|----------------|------------|
| Border (unchecked) | `color.secondary` | Color |
| Background (checked) | `color.primary` | Color |
| Background (checked, hover) | `color.primary` (darken 10%) | Color |
| Border radius (checkbox) | `borderRadius.sm` | Border radius |
| Border radius (switch) | `borderRadius.lg` | Border radius |
| Shadow (focus) | `shadow.sm` | Shadow |

#### Select
**Role:** Dropdown selection menu.

| State | Required Token | Token Type |
|-------|----------------|------------|
| Background | `color.background` | Color |
| Border | `color.secondary` | Color |
| Border (focus) | `color.primary` | Color |
| Text | `color.text` | Color |
| Border radius | `borderRadius.md` | Border radius |
| Padding | `spacing.sm` | Spacing |
| Shadow (dropdown) | `shadow.md` | Shadow |

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

#### Separator
**Role:** Visual divider.

| Property | Required Token | Token Type |
|----------|----------------|------------|
| Color | `color.secondary` | Color |
| Height | `1px` (fixed) | — |
| Margin (vertical) | `spacing.md` | Spacing |

### Feedback

#### Alert
**Role:** Status message with semantic levels.

| Variant | Required Token | Token Type |
|---------|----------------|------------|
| Background (info) | `color.primary` | Color |
| Background (success) | `color.success` | Color |
| Background (warning) | `color.warning` | Color |
| Background (destructive) | `color.danger` | Color |
| Text | `color.background` | Color |
| Border radius | `borderRadius.md` | Border radius |
| Padding | `spacing.md` | Spacing |
| Shadow | `shadow.sm` | Shadow |

#### Badge
**Role:** Small status or count indicator.

| Variant | Required Token | Token Type |
|---------|----------------|------------|
| Background (default) | `color.secondary` | Color |
| Background (success) | `color.success` | Color |
| Background (warning) | `color.warning` | Color |
| Background (destructive) | `color.danger` | Color |
| Text | `color.background` | Color |
| Border radius | `borderRadius.sm` | Border radius |
| Padding (horizontal) | `spacing.sm` | Spacing |
| Font size | `typography.fontSize.sm` | Font size |

#### Progress
**Role:** Loading or completion indicator.

| Property | Required Token | Token Type |
|----------|----------------|------------|
| Background (track) | `color.secondary` | Color |
| Background (fill) | `color.primary` | Color |
| Border radius | `borderRadius.lg` | Border radius |
| Height | `spacing.sm` | Spacing |

#### Skeleton
**Role:** Loading placeholder.

| Property | Required Token | Token Type |
|----------|----------------|------------|
| Background | `color.secondary` | Color |
| Border radius | `borderRadius.sm` | Border radius |

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

### Typography

#### Heading / Text Scale
**Role:** Semantic typography hierarchy.

| Level | Required Token | Token Type |
|-------|----------------|------------|
| Font family (headings) | `typography.fontFamily.sans` | Font family |
| Font family (code) | `typography.fontFamily.mono` | Font family |
| Font size (h1) | `typography.fontSize.xl` (scaled 2.5x) | Font size |
| Font size (h2) | `typography.fontSize.xl` (scaled 2x) | Font size |
| Font size (h3) | `typography.fontSize.lg` (scaled 1.5x) | Font size |
| Font size (body) | `typography.fontSize.base` | Font size |
| Font size (small) | `typography.fontSize.sm` | Font size |
| Color | `color.text` | Color |

## Composition Rules

1. **Token-only consumption** — Primitives MUST reference tokens.json values ONLY via CSS custom properties (e.g., `var(--color-primary)`) or TypeScript constants. Raw hex codes, pixel values, or em units are FORBIDDEN in primitive implementations.

2. **Nesting composes via spacing tokens** — Child components within primitives MUST use spacing tokens for margins/padding (e.g., `var(--spacing-md)`). No arbitrary pixel gaps.

3. **Variant maps 1:1 to token classes** — Each primitive variant (default/secondary/destructive, hover/active/disabled) MUST have an explicit token mapping in this catalog. No silent variants.

4. **New primitives require catalog entry first** — Before implementing any new component, add its token mappings to this catalog. This document is the contract that the future token-usage lint skill will enforce.

5. **Shadow and radius defaults** — Elevated components (dialogs, dropdowns, cards) consume `shadow.md` or `shadow.lg`. Interactive controls (buttons, inputs) consume `borderRadius.md`. Override ONLY if catalog-specified.

## Hardcoded-Value Ban

Raw values outside tokens.json are PROHIBITED in primitive implementations:

- **FORBIDDEN**: Hex colors (e.g., `#0066cc`, `rgb(0, 102, 204)`), pixel values (e.g., `8px`, `1rem` without token backing), em units without token basis.
- **REQUIRED**: ALL colors, spacing, radii, shadows, and typography MUST reference tokens via CSS custom properties (`var(--color-primary)`, `var(--spacing-md)`) or TS constants.
- **EXCEPTIONS**: Fixed ratios only (e.g., `1px` borders, fixed aspect ratios, percent-based widths). Fixed pixel values for dimensions (e.g., `560px` max-width for dialogs) are catalog-exempt only if explicitly noted in this document.

This catalog is the binding contract. Violations will be flagged by the token-usage lint skill (backlog §3, row 7 enforcement gap).
