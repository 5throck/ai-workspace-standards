# Design Foundation v1.2 — Design Document

> **Decision source**: 4-agent facilitated meeting, 2026-09-26 (Architect, Documentation Writer, Automation Engineer, Consistency Auditor holding the red-team / dissent seat) — transcript `memory/meeting-2026-09-26-design-foundation-improvements.md`, dissent preserved verbatim therein. This wave ratifies the meeting's synthesized proposal (P1–P6) and binds every landed artifact to the red-team constraints (a)–(e).

- **Spec ID**: 2026-09-26-design-foundation-v1-2-design
- **Date**: 2026-09-26
- **Status**: Approved
- **Owner**: architect
- **Sources**: `memory/meeting-2026-09-26-design-foundation-improvements.md` (meeting transcript + dissent), `docs/designs/2026-08-30-design-foundation-design.md` (v1.0 design; v1.1 pipeline added by ADR-0066), `templates/common/docs/design-foundation.md` v1.1, Design Foundation v1.1 coverage audit (2026-09-26)

## 1. Problem Statement

The Design Foundation v1.1 coverage audit (2026-09-26) found five gaps in an otherwise covered philosophy / principles / guide / color-system / style / fonts surface:

1. **Pipeline layer ⑤ Components has no reviewable inventory artifact.** Component coverage exists only as token groups (`--button-*`, `--card-*`, …) and a downstream hand-off to `ui-ux-design-intelligence`; "components" is the one pipeline layer with nothing to review against.
2. **The icon system is declared but untokened, and vocabulary registration has no machine-readable home.** `design-tokens.template.css` carries no `--icon-*` tokens, and the design-phase gate's icon-vocabulary registration (§2b rule 4d) plus the design-lint "non-registered icons" check have no registration file to validate against.
3. **The font fallback chain is not covered by the token value contract.** `--font-body/-heading/-numeric` carry no fallback-stack requirement, so a project can declare a single-face value with no degradation path.
4. **Pattern inventory entries lack a minimum field contract.** `screen-patterns.template.md` fixes the inventory shape but not the minimum fields per entry, so reviewability varies per project.
5. **§8 carries project-specific example pointers that break in standalone projects.** The L1-shipped spec cites `co-price docs/design.md` and `co-newbiz docs/design-guide.md` — workspace-root (`Projects/`) artifacts that do not exist in a standalone checkout. This is an L0/L1 layering violation (the audit additionally found the co-newbiz path had already drifted).

## 2. Core Principle

> **Foundation ≠ Design System** — unchanged by v1.2. The Foundation defines *how to build* a design system; each project's `docs/design.md` remains the project-specific SSOT. v1.2 adds scaffolds and contracts only; it still prescribes no colors, fonts, icons, components, or layout patterns.

### Layer Responsibilities (fixed)

| Artifact | Layer | Role | Nature |
|----------|-------|------|--------|
| `templates/common/docs/design-foundation.md` | L1 | What must be defined | Specification / Reference |
| `templates/common/docs/design-tokens.template.css` | L1 | How tokens are expressed | Implementation Scaffold — v1.2 adds INERT commented icon tokens (`--icon-size` / `--icon-stroke` primitives, `--icon-color` semantic) and extends the font tokens with the fallback-chain value contract |
| `templates/common/docs/components.template.md` | L1 | Declared component inventory shape | Registration Scaffold |
| `templates/common/docs/screen-patterns.template.md` | L1 | Declared screen-pattern inventory shape | Registration Scaffold — v1.2 adds a minimum field contract per entry |
| `skills/design-foundation/SKILL.md` | L0→L1 | How to derive and apply | Procedure / Agent Behavior |
| Project `docs/design.md` + token implementation + icon-vocabulary registration | Project | What the project actually chose | Project-specific SSOT |

## 3. Normative Design Principles (SHALL statements)

Red-team constraints from the meeting's dissent seat — binding on every artifact in this wave:

1. **SHALL**: Inventories/registries are shape-only — zero prescribed values, no examples shipped as defaults.
2. **SHALL**: Content is populated exclusively through the pipeline decision gate (design-phase gate), never shipped pre-populated.
3. **SHALL**: §7 validation validates against the project's registered decisions, never against template content.
4. **SHALL**: Scaffold additions are inert (commented or empty) unless the corresponding decision block is exercised.
5. **SHALL**: No platform-specific implementation prose (font-display, CDN/preload, bundler behavior, …) anywhere in the methodology spec.

The v1.0 normative principles (semantic-token theme mapping; mandatory rationale provenance chain) remain in force unchanged.

## 4. Architecture

Repository placement of the wave's artifacts (v1.0 §4 placement, plus v1.2 additions):

```
L0 Workspace
├── templates/common/docs/
│   ├── design-foundation.md            # Specification (v1.2)
│   ├── design-tokens.template.css      # Scaffold — inert icon tokens + font fallback contract
│   ├── components.template.md          # NEW (v1.2) — component inventory shape, ZERO entries
│   └── screen-patterns.template.md     # Pattern inventory — minimum field contract per entry
└── skills/design-foundation/
    └── SKILL.md                        # Procedure (version consistency across registration points)
        │
        ↓ propagate (scope: common)     L0 → L1 (Fork Model for L2)
L1 templates/common/skills/design-foundation/
        │
        ↓ l2_propagate = false          (no forced variant distribution)
Project — populates exclusively via the design-phase gate:
├── docs/design.md                      # Project SSOT (design_decisions record)
├── component inventory entries         # only via the gate, into the components.template.md shape
├── icon-vocabulary registration        # machine-readable file (e.g. YAML), NOT a new MD template
└── design-tokens.css                   # font tokens carry fallback chains; icon tokens activated on use
```

Notes:

- The project icon vocabulary is a **machine-readable registration** (icon-vocabulary file), NOT a new MD template — it is the set-membership source the design-lint "non-registered icons" check consumes (backlog dependency: the registry precedes the lint).
- `components.template.md` ships shape-only with ZERO entries; population happens only through the design-phase gate (constraint b).

## 5. Decision Record (from the 2026-09-26 facilitated meeting)

| # | Decision |
|---|----------|
| P1 | Add standalone `templates/common/docs/components.template.md` — shape-only, ZERO entries, populated exclusively via the design-phase gate. Accepted by the red team only under constraints (a)–(d); the auditor's lighter alternative (an appended empty section inside `screen-patterns.template.md`) is superseded by the standalone file, mirroring the layer-⑥ precedent. |
| P2 | Extend `screen-patterns.template.md` with a minimum field contract per pattern entry: trigger, layout skeleton, primary action, empty/loading/error states, component references. |
| P3 | Style-neutral principle unchanged (unanimous 4/4). |
| P4 | Genericize the §8 example pointers — remove project-specific paths from the L1-shipped spec so it stays valid in standalone checkouts. The L0 historical design doc's path (`Projects/co-newbiz/...`) is fixed separately: L0 may reference `Projects/`. Propagation to projects (incl. `_ko` parity) is the docs-writer wave. |
| P5 | Icon tokens `--icon-size` / `--icon-stroke` (primitives) + `--icon-color` (semantic) added to `design-tokens.template.css` as INERT commented placeholders, activated when the iconography decision block is exercised. The project icon vocabulary is a machine-readable registration (icon-vocabulary file), NOT a new MD template. Add §7 [Required] "icon vocabulary declared". |
| P6 | Font fallback chain enters the token VALUE contract: `--font-body: <primary>, <fallback>, <generic>;` — ≥1 fallback + terminating generic. Korean subsetting / `unicode-range` added as a §4 selection criterion. NO font-loading prose (font-display / CDN / preload) in the methodology spec — loading guidance routes to `ui-ux-design-intelligence` or project runtime docs. |

## 6. Accessibility & Rendered-Preview Exemption (ADR-0065 / ADR-0070)

This wave is **docs/scaffold-only**: it produces no user-facing UI. Therefore:

- Feature-level accessibility sections (ADR-0065 duty) are **exempt** for this wave — no feature UI exists to document.
- Rendered-preview verification (ADR-0070 / spec §2b rule 6) is **exempt** — there is nothing to render.

This statement is the record of the exemption.

## 7. Alternatives Considered

| Alternative | Verdict |
|-------------|---------|
| Standalone component catalog template shipped with entries/examples | Rejected (red team): a "de-facto prescribed inventory by inertia" — placeholder rows would become the project's component set without a decision. Accepted only as shape-only / zero-entry under constraints (a)–(d). |
| Appended "Component inventory" section inside `screen-patterns.template.md` (auditor's lighter fix) | Considered; superseded by the standalone file (P1) — mirrors the layer-⑥ precedent and keeps the pattern and component inventories independently addressable. |
| Update the §8 pointer to the corrected path `Projects/co-newbiz/docs/design-system/design-guide.md` | Rejected: "patching the path preserves the L0/L1 violation underneath." Genericization (P4) is the structurally correct fix; the L0 historical design doc's path is corrected separately. |
| Font-loading guidance (`font-display`, self-host vs CDN, preload) in `design-foundation.md` | Rejected: "platform drift — the neutrality claim is methodological, not only stylistic." Only the token *value* schema (fallback chain) enters the spec's scope (P6). |
| Standalone icon-vocabulary `.md` template | Rejected (red team): the registration gate + decision block + §7 checks already make vocabulary a governed procedure; the machine-readable file satisfies the lint dependency without a new MD artifact (P5). |

## 8. Success Criteria

- Red-team constraints honored in the landed artifacts: icon tokens shipped as commented (inert) placeholders; component inventory shipped EMPTY; §7 additions validate against registered decisions, not template content; zero font-loading / platform-specific prose in the methodology spec.
- `bun scripts/audit.ts --spec-check` green for this wave (this design doc registered; flipped to `implemented` via `--update --status implemented` once the wave lands).
- `design-foundation` skill version consistent across its 4 registration points (SKILL.md frontmatter, `docs/VERSION_MANIFEST.md`, and the template/variant mirrors as applicable).
- Zero stale project-path references in L1 scope (`templates/common/**`): no `Projects/` pointers shipped in scaffolded docs.
- Existing projects are not retrofitted (v1.0 §9 precedent): v1.2 applies to new derivations; propagation to existing projects is the docs-writer wave.
