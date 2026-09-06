# Screen Patterns (template) — the project's declared pattern inventory

> **Style-neutral by design**: this template defines the *shape* of the pattern
> inventory required by the Design Foundation 7-phase pipeline (ADR-0066, layer ⑥)
> and reviewed via the design-review checklist (section A). It does NOT prescribe
> which patterns a project declares or how they look — replace the placeholder rows
> with the project's own inventory derived via `docs/design-foundation.md`.
>
> Reference implementation: `templates/co-design/docs/screen-patterns.md`
> (list, form, detail, dashboard, modal, table) with a11y-evidenced playground
> source in `templates/co-design/playground/src/patterns.ts`.

Normative sources: ADR-0066 (process pipeline), ADR-0065 (accessibility),
ADR-0068 (Universal Design). Fill per project:

**Token source**: <design-tokens file> · **Pattern reference impl**: <path>

## Inventory

| # | Pattern | Composes from | Demonstrated a11y requirements |
|---|---------|---------------|--------------------------------|
| 1 | <pattern-name> | <components/primitives> | <concrete WCAG 2.1 AA + UD evidence shipped with the pattern> |
| 2 | <pattern-name> | ... | ... |

(Keep the inventory minimal and genuine: only patterns the project actually
declares. Add a row via design-document revision BEFORE first implementation —
the design-phase gate.)

## Rules

1. Screens MUST compose from declared patterns; a one-off composition is a
   design-phase gate failure (ADR-0066).
2. Every pattern consumes semantic/component tokens only; raw values fail the
   project design-lint.
3. Each pattern ships with its accessibility baseline demonstrated (WCAG 2.1 AA
   per ADR-0065; Universal Design evidence per ADR-0068) — a pattern PR without
   a11y evidence is not mergeable.
4. Theme switches (`[data-theme]`) must not alter pattern layout — themes remap
   semantic tokens only; layout tokens stay theme-invariant.
