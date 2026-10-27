# Screen Patterns — co-design Inventory

> The declared pattern inventory required by the Design Foundation 7-phase
> pipeline (ADR-0066, layer ⑥) and reviewed via the design-review checklist
> (sections A–G; §G is the ADR-0070 rendered-preview gate). New patterns require
> a revision of this document **before**
> implementation (design-phase gate). Reference implementation:
> `playground/src/patterns.ts` (live in the playground under each pattern
> heading). Design-system decisions of record: `docs/design.md`
> (project instantiation — each co-design checkout maintains its own; not
> present in the template tree).

Normative source: `docs/designs/2026-09-06-universal-design-extension-design.md`
(L0, workspace root). Accessibility baseline: WCAG 2.1 AA (ADR-0065) + Universal Design review
lens (ADR-0068).

## Patterns

Field contract per `docs/screen-patterns.template.md` (rule 5; L1 common —
delivered to projects): every entry
carries trigger, layout skeleton, primary action, and empty/loading/error
states. Triggers are seeded from `docs/design/patterns.registry.yaml`;
layout skeletons and primary actions are derived from the implementation of
record (`playground/src/patterns.ts`).

| # | Pattern | Trigger | Layout skeleton | Primary action | Empty / loading / error states | Composes from | Demonstrated a11y requirements |
|---|---------|---------|-----------------|----------------|--------------------------------|---------------|--------------------------------|
| 1 | **list** | Indexed collections with row-level navigation and actions | Toolbar row (title + action button) above a vertical stack of card rows, each a link + status badge | "+ New" button in the toolbar | Routed to the feedback pattern (7) | card, badge, button (toolbar restated as a text + button row composition) | `role="list"`, rows as real links, status never color-only (badges carry text), primary action ≥ `--target-size` |
| 2 | **form** | Create/edit data entry with inline validation and recovery | Vertical form stack of labelled field groups, inline error line, submit button | "Create" submit button | Inline error only: `role="alert"` message with recovery hint; success announced via pattern 7 toast | label + input, button, alert (inline error) | explicit `<label for>`, constrained input (`maxLength`/datalist), `role="alert"` inline error with recovery hint, `aria-invalid` (UD: tolerance for error) |
| 3 | **detail** | Single-entity view with metadata and safe actions | Card with header (entity title + action) over a `dl` metadata stack | "Edit" ghost button in the card header | Routed to the feedback pattern (7) | card, button, text scale (`dl` metadata semantics — definition list is not a catalog primitive) | heading hierarchy, `dl` metadata, destructive action deferred to the modal pattern |
| 4 | **dashboard** | At-a-glance summary of statuses and metrics (text-first) | Grid of stat cards, each a muted caption label + strong value | None — read-only summary surface | Routed to the feedback pattern (7) | card grid, text scale (stat tiles are cards, not a separate primitive) | text-first tiles (perceptible information), no color-only metrics |
| 5 | **modal** | Focused confirmation, destructive actions gated behind intent | Trigger button + backdrop overlay containing the dialog (title, description, Cancel/confirm row) | "Delete" confirm button inside the dialog (Cancel secondary) | Not applicable — interaction states only (open / confirm / cancel) | Dialog/Modal (overlay backdrop + dialog content), button, text scale | `role="dialog"` + `aria-modal` + labelledby/describedby, Esc to close, focus moves in on open / returns to trigger on close, confirm-before-destructive (UD: error recovery) |
| 6 | **table** | Structured rows with sortable columns and stable captions | Single table — `<caption>`, sortable `scope="col"` header row, body rows | None — column-header sorting is the interaction | Routed to the feedback pattern (7) | table, text scale (the caption belongs to the Heading/Text Scale primitive) | `<caption>`, `scope="col"`, `aria-sort` on sortable headers, token-sized cells |
| 7 | **feedback** | Async state surfaces: loading, empty, error, and mutation toasts | Stacked page-state blocks (loading / empty / error) + action toolbar + toast region | "Retry" control on the error state; Save actions drive the toast queue | Loading = skeleton + text under `aria-busy`; empty = one muted sentence + exactly one next-action link; error = `role="alert"` + one retry control; toasts auto-dismiss ≥ 4 s with manual close | skeleton (loading), alert (empty / error; toast = transient alert composition), button | loading marked `aria-busy` (skeleton or text, never motion-only); toasts = `role="status"` success / `role="alert"` failure, focus never stolen |
| 8 | **tabs** | In-page section switching with keyboard roving tabindex and URL state | Tablist row of tab buttons above stacked tabpanels (one visible) | Tab selection — no push button; arrow-key roving tabindex | Routed to the feedback pattern (7); panel visibility (`hidden` swap + `?tab=` URL) is the interaction state | tabs (tablist / tab / tabpanel roles), text scale | `role="tablist"` / `tab` / `tabpanel`, `aria-selected` + `aria-controls`, roving tabindex with arrow-key navigation, panel focusability, selection state preserved in URL |
| 9 | **report** | Data presentation: chart-first series, bullet lists, wide tables | Chart block, bullet list, then the wide table in a horizontal-scroll container | None — read-only narrative surface | Routed to the feedback pattern (7) | table (pivot / data alternative), text scale (bullet lists), badge (units & provenance context) — the chart itself is a non-primitive surface carried by its text alternative | time series render chart-first with a pivot table and a text alternative (`role="img"` summary + data table); long text as bullet lists, never paragraph blocks; ≥ 4-column narrative tables wrap in a horizontal-scroll container with column minimum widths; CJK `word-break: keep-all`; units and provenance visible beside figures; numeric cells `tabular-nums`, right-aligned |

Patterns 7–9 are generalized from sibling-variant practice (co-newbiz ADR-0121 shared
surface primitives, ADR-0088 report data-presentation standard) via
`docs/designs/2026-09-27-design-system-ssot-and-pattern-extension-design.md`
(project instantiation record — co-design checkout, not the template tree).

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
