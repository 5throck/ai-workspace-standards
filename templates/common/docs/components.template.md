# Component Inventory (template) — the project's declared component inventory

> **Style-neutral by design**: this template defines the *shape* of the component
> inventory required by the Design Foundation pipeline layer ⑤ (§2b of
> `docs/design-foundation.md`). It does NOT prescribe which components a project
> declares or how they look — replace the placeholder row with the project's own
> inventory derived via `docs/design-foundation.md`. Entries enter ONLY via the
> design-phase gate; the component design/spec procedure itself lives downstream
> in the `ui-ux-design-intelligence` skill.

**Token source**: <design-tokens file> · **Component reference impl**: <path>

## Inventory

| # | Component | Component tokens consumed | States | A11y evidence | Status |
|---|-----------|---------------------------|--------|---------------|--------|
| 1 | <component-name> | <component tokens consumed> | <states incl. focus> | <WCAG 2.1 AA + UD evidence shipped with the component> | <declared / implemented> |

(Keep the inventory minimal and genuine: only components the project actually
declares. Add a row via design-document revision BEFORE first implementation —
the design-phase gate.)

## Rules

1. Components MUST consume component tokens only; raw values fail the design-lint.
2. New components enter via design-document revision before first implementation
   (the design-phase gate).
3. Each component ships its accessibility baseline: its states including focus,
   and `aria-label` on every icon-only control.
4. Pattern/screen compositions may reference only components registered in this
   inventory or in the pattern inventory (`screen-patterns.template.md`).
