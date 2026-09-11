# Screen Patterns — co-design Inventory

> The declared pattern inventory required by the Design Foundation 7-phase
> pipeline (ADR-0066, layer ⑥) and reviewed via the design-review checklist
> (sections A–G; §G is the ADR-0070 rendered-preview gate). New patterns require
> a revision of this document **before**
> implementation (design-phase gate). Reference implementation:
> `playground/src/patterns.ts` (live in the playground under each pattern
> heading).

Normative source: `docs/designs/2026-09-06-universal-design-extension-design.md`
(L0). Accessibility baseline: WCAG 2.1 AA (ADR-0065) + Universal Design review
lens (ADR-0068).

## Patterns

| # | Pattern | Composes from | Demonstrated a11y requirements |
|---|---------|---------------|--------------------------------|
| 1 | **list** | toolbar, card, badge | `role="list"`, rows as real links, status never color-only (badges carry text), primary action ≥ `--target-size` |
| 2 | **form** | field, input, button | explicit `<label for>`, constrained input (`maxLength`/datalist), `role="alert"` inline error with recovery hint, `aria-invalid` (UD: tolerance for error) |
| 3 | **detail** | card, definition list, button | heading hierarchy, `dl` metadata, destructive action deferred to the modal pattern |
| 4 | **dashboard** | card grid, stat tile | text-first tiles (perceptible information), no color-only metrics |
| 5 | **modal** | backdrop, dialog, button | `role="dialog"` + `aria-modal` + labelledby/describedby, Esc to close, focus moves in on open / returns to trigger on close, confirm-before-destructive (UD: error recovery) |
| 6 | **table** | table, caption | `<caption>`, `scope="col"`, `aria-sort` on sortable headers, token-sized cells |

## Rules

1. Screens MUST compose from these patterns (or a pattern added via revision of
   this document) — improvising a one-off composition is a design-phase gate
   failure.
2. Every pattern consumes semantic/component tokens only; raw values fail
   `bun scripts/design-lint.ts`.
3. Each pattern ships with its accessibility requirements demonstrated in the
   playground source — a pattern PR without a11y evidence is not mergeable.
4. Theme switches (`data-theme`) must not alter pattern layout — themes override
   color/shadow only ([DESIGN-R2]); `--target-size` and motion durations are
   theme-invariant.
