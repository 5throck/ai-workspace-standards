# ADR-0066: Design process pipeline — principles-to-screens ordering and a design-phase gate

## Context

ADR-0064 established *what* a project's design foundation must define (style-neutral
derivation: evidence → principles → decisions → tokens → components → validation), and the
`design-foundation` skill walks projects through those derivation stages. What remained
unspecified was the **systemization order and enforcement**: external benchmarks
(Material Design 3 tokens, IBM Carbon, Shopify Polaris/Atlassian governance, Fowler's
token-as-data architecture) converge on a strict layering — principles → tokens (3-tier) →
style guide/color system → iconography → components → screen patterns → screens — and on
requiring design artifacts *at the design phase* of a build, not during implementation.

Variant practice confirmed the cost of skipping this: a project (co-newbiz) accumulated
three separate UI-consistency remediation cycles (interaction standards, visual standards,
screen-pattern adoption — its ADR-0082/0083/0086/0087) because pages were built before
tokens, patterns, and gates existed. The fix was codified there first; the workspace now
adopts the *method* — explicitly not any project's specific styles, patterns, or icon sets,
per ADR-0064's style-neutrality rule.

## Decision

1. **Seven-phase pipeline** is normative for projects with UI: ① principles → ② tokens
   (primitive → semantic → component; tokens declared as data with a single source) →
   ③ style guide & color system → ④ iconography (declared set + concept-per-icon
   vocabulary) → ⑤ components (token-referencing only) → ⑥ screen patterns (project's own
   inventory) → ⑦ screens (composition of declared patterns + documented slots only).
   A layer is not built before its predecessor exists.
2. **Design-phase gate**: design documents for new screens/features must state the pattern
   used, tokens/components consumed (new ones approved at design time), conformance to the
   project's declared interaction standards, and icon-vocabulary registration. Review
   ownership follows the project's own review chain.
3. **Automated enforcement is recommended**: a project-level design-lint script (banned
   hard-coded values, bypassed layout primitives, non-registered labels/icons) as a build
   or PR gate.
4. **Template propagation (L1)**: `templates/common/docs/design-foundation.md` gains the
   pipeline as §2b (method only — no styles/patterns prescribed), and
   `docs/_templates/design-review-checklist-template.md` provides the style-neutral
   checklist. Projects fill in their own pattern inventory, token source, and vocabulary.
5. **k-dart skill propagation (v2.0.0 → v2.1.0, L1)**: corp_code fallback chain (cache TTL
   → bulk retry → web fallback + company.json cross-validation), financial account
   normalization + summation checks with confidence flags, CFS→BFS fallback, disclosure
   search presets, shareholder signal, source-document text extraction, and a shared fetch
   gate (concurrency cap, backoff, daily budget). Country-scoped deployment rules unchanged
   (ADR-0057 registry).

Full analysis: `Projects/co-newbiz/docs/research/k-dart-benchmarking-2026-09-01.md` (skill
benchmarking) and `Projects/co-newbiz/docs/designs/2026-09-01-design-process-establishment_ko.md`
(pipeline source, ADR-0087).

## Consequences

- New projects scaffolded from the templates get the process (order, gate, checklist,
  lint concept) without inheriting any project's visual identity — ADR-0064 holds.
- Existing variants adopt the pipeline incrementally; co-newbiz already implements it
  end-to-end and serves as the reference.
- The checklist and lint are per-project: template review should reject any future edit
  that hard-codes a project's style into L0/L1 artifacts.
