---
status: Accepted
date: 2026-09-01
author: PM + Architect
---

# ADR-0065: Accessibility as a Mandatory Consideration for Software Feature Development

## Context

The workspace already treats accessibility as a first-class concern **within design
systems**: ADR-0064 (Design Foundation) mandates WCAG AA contrast, visible focus,
non-color status encoding, and accessible labels, and co-design ships an
`accessibility-audit` skill (axe-core, WCAG 2.1 AA). But there is no cross-cutting
standard for **feature development itself**. Web/app features can ship with
inaccessible markup, keyboard traps, or color-only state indicators even when the
surrounding design system is compliant — because no artifact (design doc, ADR,
constitution, or project context) requires accessibility to be *considered and
documented* at the feature level.

Full design analysis:
[docs/designs/2026-09-01-accessibility-standard-design.md](../designs/2026-09-01-accessibility-standard-design.md)

## Decision

**Accessibility is a mandatory consideration for any user-facing software feature
(web, app, CLI interactive UI, generated documents), not an optional enhancement.**

1. **Baseline**: WCAG 2.1 AA — aligned with the Design Foundation contract and the
   `accessibility-audit` skill. The standard is style-neutral: it prescribes the
   bar and the documentation duty, never *which* design to use.
2. **Design docs MUST include an Accessibility section.** Any design doc
   (`docs/designs/<spec-id>-design.md`) for user-facing feature development MUST
   state the target level (WCAG 2.1 AA), the affected interaction areas (keyboard,
   screen reader, contrast, motion, touch), and the verification method.
3. **ADRs MUST record accessibility impact** for features that affect user-facing
   interaction; backend/non-UI features are exempt only with an explicit exemption
   statement.
4. **Baseline requirements** (keyboard operability with visible focus, WCAG AA
   contrast, semantic structure with accessible names, screen-reader order,
   multi-encoded status — never color alone, `prefers-reduced-motion`, adequate
   target sizes) are codified in `CONSTITUTION.md` §8.14 and the project context
   template so every agent working on a project sees them.
5. **Verification** uses the `accessibility-audit` skill (axe-core, WCAG 2.1 AA)
   where available; otherwise a documented manual checklist covering the baseline
   items.
6. **Enforcement ladder**: v1 is documentation-level mandatory (design-gate rule in
   `AGENTS.md` §5.1 + governance docs). Hook/audit-level automated enforcement is
   explicitly deferred, following the ADR-0055 WARN-first playbook, until the
   documentation rule has burned in across real engagements.

Distribution policy: the standard propagates L0 → L1 via the template artifacts
(`templates/common/docs/context.md`, `templates/common/docs/design-foundation.md`,
`templates/common/AGENTS.md`), so **every newly scaffolded project receives it**;
CONSTITUTION itself stays L0-only. No skill is created or modified — the workspace
reuses `accessibility-audit` and the Design Foundation rather than redefining them.

## Consequences

**Positive:**

- Every user-facing feature design doc and ADR now carries an explicit
  accessibility duty, closing the gap between design-system compliance and
  feature-level compliance.
- New projects inherit the requirement automatically through the template
  (`docs/context.md` Accessibility Standards section).
- No new skills or scripts; existing assets (`accessibility-audit`, Design
  Foundation) are referenced, not duplicated.

**Negative / Trade-offs:**

- One additional mandatory section per user-facing design doc/ADR — a small
  documentation tax at the exact gate where accessibility is cheapest to address.
- v1 is review-enforced, not machine-enforced; enforcement automation is deferred
  until the rule has been exercised by real engagements (ADR-0055 playbook).

## Implementation

| File | Change |
|------|--------|
| `docs/adr/0065-accessibility-standard.md` | This ADR |
| `docs/designs/2026-09-01-accessibility-standard-design.md` | Design doc (Row 0) |
| `docs/constitution/08-coding-guidelines.md` | New §8.14 Accessibility (this PR) |
| `CONSTITUTION.md` | §8 hub summary updated with the Accessibility rule + ADR-0065 pointer (this PR) |
| `templates/common/docs/context.md` | New `### Accessibility Standards` section under Documentation Standards (this PR) |
| `templates/common/docs/design-foundation.md` | §7 validation contract gains a feature-level accessibility pointer (this PR) |
| `AGENTS.md` + `templates/common/AGENTS.md` | §5.1 design-gate key point: design docs for user-facing features MUST include an Accessibility section (this PR; L1 synced via `propagate-to-templates.ts --governance-l1`) |

## References

- ADR-0064 — Design Foundation style-neutral derivation: the design-system
  accessibility contract this standard extends to feature development
- ADR-0061 — Decision Record Standard: gate-moment documentation discipline this
  ADR mirrors
- ADR-0059 — Governance reflection validators: this ADR must appear in the
  governance corpus (`verify-adr-governance.ts --strict`)
- ADR-0055 — WARN-first → hard-gate enforcement playbook, followed by §6's
  enforcement ladder
- `templates/co-design/skills/accessibility-audit/SKILL.md` — verification tool
  (axe-core, WCAG 2.1 AA), referenced not redefined
