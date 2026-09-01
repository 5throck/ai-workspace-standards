# Accessibility Standard for Software Feature Development — Design Document

- **Spec ID**: accessibility-standard-2026-09-01
- **Date**: 2026-09-01
- **Status**: Approved
- **Owner**: architect
- **Sources**: [ADR-0064](../adr/0064-design-foundation-style-neutral-derivation.md) (design-system accessibility defaults), `templates/common/docs/design-foundation.md` (WCAG AA contract), `templates/co-design/skills/accessibility-audit/SKILL.md` (axe-core, WCAG 2.1 AA), [ADR-0055](../adr/0055-spec-registry-enforcement.md) (WARN-first enforcement playbook)

## 1. Problem Statement

The workspace treats accessibility as a first-class concern **inside design systems**: the Design Foundation (ADR-0064) mandates WCAG AA contrast, visible focus, non-color status encoding, and `aria-label` on icon-only controls, and co-design ships an `accessibility-audit` skill (axe-core, WCAG 2.1 AA). However, there is **no cross-cutting standard for feature development itself**. A web or app feature can ship with inaccessible markup, keyboard traps, or color-only state indicators even when the surrounding design system is compliant, because no artifact — design doc, ADR, constitution, or project context — requires accessibility to be *considered and documented* at the feature level.

The gap is documentation-level: nothing tells the architect, docs-writer, or automation-engineer to address accessibility when planning a feature, and no project-context rule tells a new project that accessibility is a baseline requirement rather than an optional enhancement.

## 2. Core Principle

> **Accessibility is a mandatory consideration for any user-facing software feature, not an optional enhancement.**

The standard is *style-neutral* and *baseline-prescriptive*: it prescribes WCAG 2.1 AA as the minimum bar (aligned with the Design Foundation's existing `accessibility-audit` contract), but leaves how to meet it to each project. It does **not** redefine design-system rules already owned by `design-foundation.md`; it references them and extends coverage to feature development.

### Scope

| In scope | Out of scope (explicit exemption) |
|----------|-----------------------------------|
| User-facing UI features: web apps, mobile apps, CLI interactive UIs, generated documents/templates (PDF/HTML), dashboard/console screens | Backend-only, non-interactive work (APIs, data pipelines, scripts) — exempt **only when** the design doc states the exemption explicitly |
| Any change that adds, removes, or alters user-facing interaction | Pure infrastructure/config changes with no user-facing surface |

## 3. Normative Requirements (SHALL statements)

1. **SHALL**: Design docs for user-facing feature development (`docs/designs/<spec-id>-design.md`) MUST include an **Accessibility** section covering: target level (WCAG 2.1 AA), affected interaction areas (keyboard, screen reader, color/contrast, motion, touch), and the verification method.
2. **SHALL**: ADRs for features that affect user-facing interaction MUST record the accessibility impact (or a reasoned exemption for non-UI features).
3. **SHALL**: The baseline accessibility requirements for feature development are:
   - **Keyboard operability**: every interactive element reachable and operable by keyboard; no keyboard traps; visible focus indicator.
   - **Contrast**: WCAG AA (4.5:1 normal text, 3:1 large text/UI components) for all text and meaningful UI boundaries.
   - **Semantic structure & ARIA**: correct semantic HTML elements; accessible names for all controls; `aria-label`/`aria-labelledby` for icon-only or ambiguous controls.
   - **Screen reader**: meaningful reading order; names/roles/values exposed correctly.
   - **Status encoding**: never convey state by color alone — always pair with icon and/or text (multi-encoded signals).
   - **Motion**: respect `prefers-reduced-motion`; no essential information lost when motion is disabled.
   - **Touch/target size**: adequate target sizes where the platform warrants it.
4. **SHALL**: Accessibility verification uses the `accessibility-audit` skill (axe-core, WCAG 2.1 AA) where available (co-design projects); otherwise a documented manual checklist covering the §3 items above.
5. **SHALL**: Backend/non-UI features are exempt only with an explicit exemption statement in the design doc or ADR.

## 4. Touchpoints (documentation propagation)

| # | Artifact | Layer | Change | Reaches new projects? |
|---|----------|-------|--------|----------------------|
| 1 | `docs/adr/0065-accessibility-standard.md` | L0 | New ADR recording the standard | No (L0-only governance record) |
| 2 | `docs/constitution/08-coding-guidelines.md` §8.14 + `CONSTITUTION.md` hub | L0 | New behavior rule | No (CONSTITUTION is L0-only) |
| 3 | `templates/common/docs/context.md` — `### Accessibility Standards` | L1 | New section under Documentation Standards | **Yes** — copied to every scaffold's `docs/context.md` |
| 4 | `templates/common/docs/design-foundation.md` §7 | L1 | Validation contract pointer | **Yes** — copied to every scaffold |
| 5 | `AGENTS.md` §5.1 design-gate key points + `templates/common/AGENTS.md` | L0/L1 | Design-gate requirement | **Yes** — L1 copy synced via `propagate-to-templates.ts --governance-l1` |

## 5. Enforcement Ladder

- **v1 (this change)**: documentation-level mandatory — design docs and ADRs must carry the Accessibility section (enforced by review and by the design-gate rule in `AGENTS.md` §5.1); constitution and project context state the rule.
- **Deferred**: hook/audit-level automated enforcement is **not** introduced in this change. It follows the ADR-0055 WARN-first playbook: let the documentation rule burn in across real engagements, then consider a `audit.ts` soft-check before any hard gate.

## 6. Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| Design-system-only coverage (status quo) | Leaves feature development ungoverned — the exact gap this change closes |
| Introducing a dedicated `accessibility` skill now | Duplicates `accessibility-audit` (co-design) and the Design Foundation contract; the workspace rule is *reference, don't redefine* (ADR-0064 §Relationship to existing skills) |
| Hard-gating design docs on an Accessibility section immediately | Conflicts with the ADR-0055 WARN-first playbook; a documentation rule must be exercised by real engagements before becoming a blocking gate |
| Enforcing only at the PM design gate | Constitution/context remain silent for agents that operate outside the gate (e.g. feature-level implementers); the rule belongs in the standing governance docs |

## 7. Success Criteria

- ADR-0065 is referenced from `CONSTITUTION.md` or `docs/constitution/` (`verify-adr-governance.ts --strict` passes).
- `templates/common/docs/context.md` contains an `Accessibility Standards` section that reaches new projects scaffolded from the template.
- `docs/constitution/08-coding-guidelines.md` contains §8.14 Accessibility; `CONSTITUTION.md` hub §8 summary reflects it.
- `AGENTS.md` §5.1 design-gate key points require an Accessibility section in design docs for user-facing features; `templates/common/AGENTS.md` is in sync.
- `bun scripts/audit.ts` passes (no L0-leakage, marker drift, or documentation violations introduced).
