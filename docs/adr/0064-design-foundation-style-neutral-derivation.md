---
status: Accepted
date: 2026-08-30
author: PM + Architect
---

# ADR-0064: Design Foundation as Style-Neutral Design-System Derivation

## Context

Projects co-price (Onyx 2.0) and co-newbiz (Onyx 3.0) each evolved mature design
systems independently. Their reusable methodology — HSL token architecture with
semantic bg/fg/border triplets, role-based typography (body / heading / numeric
with `tabular-nums`), accessibility defaults, and multi-layer enforcement
(prose spec + token file + skill/agent review) — existed only inside those
projects. New projects scaffolded from the templates started from zero and
tended to either copy a specific style (Onyx) or improvise inconsistently,
because the workspace had no methodology layer: design knowledge was
project-local, the same gap ADR-0063 closed for workflow knowledge.

Simply promoting one project's design system into the template was rejected:
it would prescribe specific colors, fonts, density, and trends — the opposite
of what the workspace needs, since design selection must remain a per-project
decision. Meanwhile co-design already carried working token infrastructure
(`tokens.json` + `compile-tokens.ts`, `[data-theme]` theming, `token-usage-lint`,
`accessibility-audit`) that any new framework had to align with rather than
duplicating.

Full design analysis: [docs/designs/2026-08-30-design-foundation-design.md](../designs/2026-08-30-design-foundation-design.md)

## Decision

The workspace adopts a **Design Foundation** layer that encodes *how to derive*
a design system, never *which* design system to use. **Foundation ≠ Design
System**: L0/L1 carry methodology only; the actual design system is each
project's `docs/design.md` (project-specific SSOT), and design selection
happens at the project level.

Four fixed layers:

| Layer | Artifact | Role |
|-------|----------|------|
| Specification | `templates/common/docs/design-foundation.md` | What must be defined |
| Scaffold | `templates/common/docs/design-tokens.template.css` | How tokens are expressed |
| Procedure | `skills/design-foundation/SKILL.md` | How to derive and apply |
| Project SSOT | Project `docs/design.md` + token implementation | What was actually chosen |

Normative principles:

1. **Theme variation SHALL be expressed primarily through semantic-token
   mapping; primitive tokens SHALL remain theme-neutral.** The canonical theme
   mechanism is the `[data-theme="<name>"]` attribute selector — matching
   co-design's `compile-tokens.ts` output — not a `.dark` class. This
   generalizes to any named theme (dark, high-contrast, …).
2. **Design decisions SHALL record domain-evidence rationale** via a
   `design_decisions` record (philosophy, color, typography body/heading/numeric,
   spacing, radius, motion, iconography — each with `rationale`), preserving the
   provenance chain Domain Evidence → Design Principle → Design Decision →
   Token → Component.

Token architecture is three layers with a strict reference rule — Primitive →
Semantic (theme-mapped) → Component; semantic tokens reference only primitives,
component tokens reference only semantics, and components must not bypass
layers. Every project token file provides a default theme (`:root`) plus at
least one alternate theme, each with the full semantic set including
bg/fg/border status triplets.

Coherence with co-design (no duplication): hardcoded-value detection reuses
`token-usage-lint`; WCAG verification references `accessibility-audit`; the
`design-foundation` skill `enables` co-design's `ui-ux-design-intelligence`
(foundation derives tokens, ui-ux-design-intelligence implements components)
and deliberately excludes the "design system" trigger to avoid resolution
conflicts.

Distribution policy: the skill uses `scope: common` (propagates L0 → L1 via the
Fork Model) with **`l2_propagate: false`** — the methodology reaches every new
project, but no variant is forced to adopt it; per-project autonomy is the
architectural property this ADR protects.

Design validation is contract-first: the Design Validation Contract
([Required] / [Consistency] checks, see the design document §7) is
review-enforced today. Automated lint implementation and co-design's
`tokens.json` flat → 3-layer migration are tracked as follow-up backlog.

## Governance

- Skills: `design-foundation` (owner: architect, v1.0.0) registered in
  `skills/SKILLS.md`, `docs/VERSION_MANIFEST.md`,
  `docs/lifecycle/skills/design-foundation.md`; relations projected into the
  skill graph (ADR-0060).
- Templates: `templates/common/docs/design-foundation.md` +
  `design-tokens.template.css` propagate under the Fork Model; referenced from
  `templates/common/docs/context.md` § Documentation Standards.
- Validators: `validate-skills.ts` covers the skill; the lint contract is
  documented in the specification and will graduate to an automated check in a
  follow-up change.
- Enforcement of the co-design alignment decisions (context.md phantom
  reference, `DOMAIN_DOC_DIRS` design entry) shipped with the same change.

## Consequences

- Every project scaffolded from `templates/common` receives the derivation
  procedure and token scaffold; following the skill produces a traceable
  `docs/design.md` and a validated token file.
- Agents can no longer make unexplained aesthetic choices: every font, color
  system, or library selection must carry a rationale anchored in domain
  evidence — reviewable in PRs.
- The workspace stays style-neutral: adopting a new visual trend or rebranding
  a project never requires template changes.
- Existing projects are unaffected substantively (co-price/co-newbiz already
  satisfy the contract); retrofitting the `design_decisions` YAML block into
  their `docs/design.md` is optional per-project work.
- Follow-up backlog: automated design-lint script implementing the validation
  contract; migration of co-design's flat `tokens.json` to the 3-layer model
  once its compiler/lint consumers are updated.
