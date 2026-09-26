# Design-Lint Registries — Design Document

> **Decision source**: Architect design authored 2026-09-26 under the PM Gateway, closing the machine-checkable design-lint backlog deferred by Design Foundation v1.2 (tickets **T-20260926-028**, **T-20260926-029**, **T-20260926-030**, **T-20260926-031**). Ratified implementation intents come from the 2026-09-26 facilitated meeting (automation-engineer positions) — transcript `memory/meeting-2026-09-26-design-foundation-improvements.md`. Bound by the v1.2 red-team constraints (a)–(e), restated normatively in §3.

- **Spec ID**: 2026-09-26-design-lint-registries-design
- **Date**: 2026-09-26
- **Status**: Draft (registry status at registration; flip to `implemented` via `spec-register.ts --update` once the wave lands)
- **Owner**: architect
- **Tickets**: T-20260926-028 (components registry + check), T-20260926-029 (patterns registry + design-phase-gate validation), T-20260926-030 (icon-vocabulary registration + check), T-20260926-031 (font fallback token contract check)
- **Sources**: `docs/designs/2026-09-26-design-foundation-v1.2-design.md` (deferring design; constraints (a)–(e) origin), `templates/common/docs/design-foundation.md` v1.2 (§2b rule 5, §7 backlog note), `memory/meeting-2026-09-26-design-foundation-improvements.md` (automation-engineer implementation intents), `scripts/design-lint.ts` v1.0.0 (existing token-usage-lint companion — see §4 discovery note), `skills/token-usage-lint/SKILL.md`, `skills/zod-contract-gate/SKILL.md`

## 1. Problem Statement

The v1.2 wave shipped the shape-only inventories (`components.template.md`, extended `screen-patterns.template.md`), the inert icon-token scaffold, and the font fallback value contract — but **nothing machine-checkable**. Concretely:

1. `design-foundation.md` §7 ("This contract is review-enforced today; automated linting is a tracked backlog item") leaves every [Required]/[Consistency] item to human review.
2. §2b rule 5 ("Enforcement SHOULD be automated") names a design-lint (banned hard-coded values, bypassed layout primitives, non-registered icons/labels) that has no registry-backed implementation at L0.
3. The v1.2 scaffolds created the *registration shapes* but no machine-readable registration *files* for projects to populate, so the lint's set-membership checks had no source to validate against (the v1.2 design doc records this dependency: "the registry precedes the lint").

The four backlog tickets own closing this gap: one registry + one deterministic check per pipeline layer (components, patterns, icons), plus the font fallback token contract.

## 2. Core Principle

> **Registries are data; the lint is deterministic set membership over them.** Every check in this design reduces to one of: (i) set membership of a reference against a registry, (ii) set membership of a declared token against the project's token source, or (iii) regex-level parse of a token declaration. No heuristic scoring, no LLM, no network.

**Absence of a registry is a SKIP, never an error** (constraint d, made operational): a project that never exercised the corresponding design-phase-gate decision block has no registry file, and the matching check reports `skipped` with zero exit contribution. Invocation of the lint by a project is itself the opt-in; nothing force-fails a project that never adopted the registries.

**Validation runs against registered decisions, never template content** (constraint c): the lint reads only project-side files — the project's registries and the project's token source. It never inspects `templates/common/**`.

## 3. Normative Design Principles (SHALL statements)

The v1.2 red-team constraints, binding on every artifact in this wave:

1. **SHALL**: Registries are shape-only — zero prescribed values, no example entries shipped as defaults (constraint a).
2. **SHALL**: Registry content is populated exclusively through the pipeline decision gate (design-phase gate); nothing pre-populated ships with scaffolds (constraint b).
3. **SHALL**: Validation runs against the project's registered decisions, never against template content (constraint c).
4. **SHALL**: A missing registry file means the corresponding check is SKIPPED (inert unless the decision block was exercised) — never an error for projects that did not opt in (constraint d).
5. **SHALL**: No platform-specific implementation prose enters the methodology spec; platform-specific behavior stays in this design doc and the script's own documentation (constraint e).
6. **SHALL**: Every check is deterministic (set membership or parse logic), idempotent, CI-runnable, and has zero LLM dependency.
7. **SHALL**: The lint is standalone — core `audit.ts` and `dev-sync.ts` remain byte-identical across templates; a project's pluggable `audit-variant.ts` hook (per `variant.json` → `script_manifest`) MAY invoke it, but nothing at L0 wires it into the core audit pipeline.

## 4. Architecture

### 4.1 Discovery note (recorded decision)

`scripts/design-lint.ts` **v1.0.0 already exists** at L0 — it is the runnable companion to the `token-usage-lint` skill (raw hex / `rgb()`/`hsl()` / raw-px detection with the `design-token-exempt:` suppression scheme), registered in `docs/VERSION_MANIFEST.md` and `scripts/SCRIPTS.md`, and referenced by ADR-0064/0066/0068 and the v1.2 spec itself. The meeting transcript already designates it the backlog target ("shared design-lint listed in §7 backlog"), and ticket T-20260926-028's intent is "extends `token-usage-lint` detection logic, do not duplicate it".

**Decision: extend the existing `scripts/design-lint.ts` (v1.0.0 → v2.0.0) rather than create a new file.** The existing raw-value scan becomes one sub-check among five; its CLI contract (`[paths...]`, `--dir`, `--help`, exit codes, suppression comment) is preserved for backward compatibility. A second file named `design-*.lint.ts` would fork the "design-lint" identity that the spec, ADRs, and manifest already track.

### 4.2 Structure

```
L0 Workspace
├── scripts/design-lint.ts              # v2.0.0 — sub-check runner (this wave)
│     ├── sub-check: token-usage        # existing v1.0.0 scan, unchanged behavior
│     ├── sub-check: components         # T-20260926-028
│     ├── sub-check: patterns           # T-20260926-029
│     ├── sub-check: icons              # T-20260926-030
│     └── sub-check: fonts              # T-20260926-031
├── tests/unit/design-lint-*.test.ts    # unit tests (§8)
│     ↓ propagate (scripts domain, propagation-map.json: scripts/*.ts → templates/common/scripts/, Fork Model for L2)
L1 templates/common/scripts/design-lint.ts
        │
Project — registries are project-created, plain committed artifacts (never gitignored),
          populated exclusively via the design-phase gate:
├── docs/design.md                          # existing project SSOT (design_decisions)
├── docs/design/components.registry.yaml    # T-028 — created by the project when the
├── docs/design/patterns.registry.yaml      # T-029 —   corresponding decision block is
└── docs/design/icon-vocabulary.yaml        # T-030 —   exercised (shape in §5)
```

### 4.3 CLI contract

```
bun scripts/design-lint.ts [project-root]        # default: cwd
  --check <name>    run one sub-check (components|patterns|icons|fonts|token-usage);
                    repeatable; default: all five
  --json            machine-readable JSON report on stdout (per-check status,
                    findings array, skip reasons) for CI consumption
  --schema          print the three registry YAML schemas (§5 skeletons) and exit 0
  [legacy]          [paths...] / --dir <path> preserved: they scope the token-usage
                    sub-check exactly as v1.0.0 did
```

- Exit `0` = every sub-check PASS or SKIP; exit `1` = at least one FAIL.
- `project-root` argument changes the base directory for registry lookup, token-source lookup, and UI-source scanning (replacing v1.0.0's implicit cwd default while keeping cwd as the default).
- One-line per-check summary on stderr-free stdout: `PASS|FAIL|SKIP <check> (<n> findings, <reason>)`.

### 4.4 Registry file locations — decision and justification

**Decision: `docs/design/` under the project root** — `docs/design/components.registry.yaml`, `docs/design/patterns.registry.yaml`, `docs/design/icon-vocabulary.yaml`.

Justification: (i) the project's design SSOT is already `docs/design.md`; the machine-readable siblings belong beside it, keeping the design-system artifact family in one place; (ii) a new top-level `design/` directory would violate the workspace File Organization baseline against root clutter; (iii) the v1.2 design doc fixes the icon vocabulary as "a machine-readable registration (icon-vocabulary file), NOT a new MD template" without fixing a path — this decision fixes it. All three are plain committed project artifacts; nothing is gitignored. They do not propagate from templates: L1 ships shapes in the methodology docs only (constraint b).

## 5. Registry Schemas (shape-only)

Minimal field sets, per the meeting-ratified automation-engineer intents. Every field is project-chosen in value; the lint validates structure and cross-references only. `version` is an integer schema version (start at `1`) so future shape changes are detectable. YAML parsing uses `js-yaml` (already a root dependency — no new dependency).

### 5.1 `docs/design/components.registry.yaml` (T-20260926-028)

```yaml
version: 1
components:
  - id: <string>                  # required, unique, kebab-case; matches the human
                                  #   inventory entry in components.template.md shape
    tokens:                       # required token bindings, grouped by state
      default: [<--token refs>]   #   custom-property names this component consumes
      <state-group>: [<--token refs>]   # arbitrary state keys (hover, focus, disabled, …)
    layout_primitives: [<string>] # layout primitives this component is allowed to use
    status: active | deprecated   # lifecycle; deprecated entries are not failed, only reported
```

The a11y-evidence and human-readable states columns of the `components.template.md` inventory stay in the human doc; the machine registry carries only what the lint consumes. (Deliberate scope cut: `aria` evidence is review-checked, not lint-checked, this wave.)

### 5.2 `docs/design/patterns.registry.yaml` (T-20260926-029)

```yaml
version: 1
patterns:
  - id: <string>                  # required, unique, kebab-case
    trigger: <string>             # when to use this pattern (free text, project-chosen)
    entry_tokens: [<--token refs>]  # token requirements a screen entry point must consume
    layout_primitives: [<string>]   # allowed layout primitives for this pattern
    composes_from: [<component-id>] # component ids (cross-ref into components registry)
```

### 5.3 `docs/design/icon-vocabulary.yaml` (T-20260926-030)

```yaml
version: 1
icons:
  - id: <string>                  # required, unique; the icon identifier as referenced in UI
    source: <string>              # the single source set/library (project-chosen)
    contexts: [<string>]          # allowed usage contexts (project-defined vocabulary)
    aria_label_required: <boolean>  # default true; declarative — see §6.3
```

## 6. Check Semantics (normative SHALLs)

Each sub-check, exactly one per ticket. All findings carry file:line where a file location exists.

### 6.1 Components (T-20260926-028) — `--check components`

- **SHALL** skip when `docs/design/components.registry.yaml` is absent.
- **SHALL** fail any registry-bound token name that does not exist in the project's token source (set membership against declared custom properties extracted from the project token file — the CSS/JSON source of truth per the project's own token architecture; a project declares its token source via the existing convention: `tokens.json` / token CSS scaffold in the project root or `docs/`).
- **SHALL** fail any raw design value (hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, raw px) in a governed component's style block — implemented by **reusing the existing v1.0.0 detector unchanged** over the project's UI source roots when the components registry is present (registry presence = components are governed). The `design-token-exempt: <reason>` suppression scheme and the false-positive filters apply identically. The detector is imported/reused, never duplicated.

### 6.2 Patterns (T-20260926-029) — `--check patterns`

- **SHALL** skip when `docs/design/patterns.registry.yaml` is absent.
- **SHALL** fail any screen/feature design document under `docs/` that declares a pattern usage (a `patterns:` field in the document's front-matter or an explicit pattern reference block) whose pattern id is not in the registry (set membership).
- **SHALL** treat an explicit `pattern-waiver: <reason>` field in the same document as a recorded waiver — reported as INFO, never a failure.
- **SHALL** structurally validate the registry itself (§5.2 fields present and well-typed; `composes_from` ids resolve when the components registry exists).

Validation is **hand-rolled deterministic structural validation, not zod** (see §7). A project that carries zod MAY additionally run the `zod-contract-gate` skill at its own design-phase gate; that is a project-side convention, not an L0 dependency.

### 6.3 Icons (T-20260926-030) — `--check icons`

- **SHALL** skip when `docs/design/icon-vocabulary.yaml` is absent.
- **SHALL** fail any icon reference in governed UI source (icon id/name references resolved by the project's declared icon-usage convention, e.g. `<Icon name="...">` / `icon="<id>"` attributes as declared in the project's `design_decisions.iconography`) that is not a registered icon id (pure set membership).
- `aria_label_required` is **declarative this wave**: it is registered and review-checked per design-foundation §6/§7 but not lint-checked (checking rendered accessibility attributes is the `accessibility-audit` skill's domain). This is a recorded scope cut, not an oversight.

### 6.4 Font fallback token contract (T-20260926-031) — `--check fonts`

- **SHALL** skip when the project's token source declares no `--font-*` custom properties (no typography decision exercised → nothing to check, constraint d).
- **SHALL** fail any `--font-*` custom property whose value is not a stack with **at least one fallback** (≥ 2 comma-separated family entries) **and a terminating generic family** from the closed set: `serif`, `sans-serif`, `monospace`, `cursive`, `fantasy`, `system-ui`, `ui-serif`, `ui-sans-serif`, `ui-monospace`, `ui-rounded`.
- **SHALL** implement this as regex-level parsing of token declarations only — no font loading, rendering, or metric analysis (constraint e).

## 7. Validation Library Decision — hand-rolled, no zod (recorded with evidence)

The task convention requires checking the root `package.json` before choosing zod. Evidence (root `package.json`, read 2026-09-26):

```json
"devDependencies": { "@types/bun": "^1.4.2", "@types/node": "^26.6.1", "typescript": "^7.0.2" },
"dependencies": { "js-yaml": "^5.4.2", "semver": "^7.8.5" }
```

**No `zod` dependency exists at the workspace root. Decision: hand-rolled deterministic validators** (plain TypeScript functions per §5 shape), honoring the zero-new-dependencies baseline. The three schemas are small, closed shapes — structural checks (required keys, types, uniqueness, cross-refs) are fully deterministic without a schema library. `js-yaml` (already present) parses the registries. The meeting's "zod via `zod-contract-gate`" position is preserved where it actually lives: **project-side** projects that already carry zod may validate their registries with `zod-contract-gate` at their design-phase gate; the L0 lint does not gain a dependency for it. The schemas in §5 are additionally exposed via `--schema` so the design doc and the tool cannot drift apart in practice.

## 8. Testing

- **Location and style**: new `tests/unit/design-lint-registries.test.ts` (components/patterns/icons checks), `tests/unit/design-lint-fonts.test.ts` (font check), `tests/unit/design-lint-cli.test.ts` (CLI contract, `--json`/`--schema`, legacy flags, exit codes). Style follows the existing `tests/unit/compile-tokens.test.ts` precedent: `bun:test`, shell-out to the CLI via `bun $` with `.nothrow()`, assert on exit codes and stdout.
- **Fixture strategy**: disposable fixture project trees created at test runtime under `mkdtempSync(os.tmpdir())` and removed in `afterAll` — matching the workspace's disposable-fixture idiom. **No shared `tests/fixtures/` tree is introduced**: none exists today (the only fixture directory, `tests/procedures-fixtures`, is procedures-domain), and hermetic per-test trees keep the parallel unit suite race-free.
- **Required cases, per check**: registry absent → exit 0 with `SKIP` (constraint d, the absence-skip behavior); fixture with violations → correct FAILs with exit 1; clean fixture → PASS exit 0; waiver recorded → exit 0; `--json` output shape stable; legacy v1.0.0 invocation (`--dir`, paths, suppression comment) unchanged.
- Suite runs via the standard runner: `bun scripts/test-runner.ts unit` (`npm run test:unit`).

## 9. Accessibility & Rendered-Preview Exemption (ADR-0065 / ADR-0070)

This wave is **tooling-only**: it extends a lint script and adds tests. It produces no user-facing UI, nothing to render, and no feature-level accessibility surface. Therefore:

- Feature-level accessibility sections (ADR-0065 duty) are **exempt** — no feature UI exists to document.
- Rendered-preview verification (ADR-0070 / spec §2b rule 6) is **exempt** — there is nothing to render.

This statement is the record of the exemption.

## 10. Alternatives Considered

| Alternative | Verdict |
|-------------|---------|
| Wire the checks into core `audit.ts` / `dev-sync.ts` | **Rejected** — violates the template-identity constraint (core scripts must stay identical across templates; only the pluggable `audit-variant.ts` hook is variant-owned). Constraint 7/§3. |
| Create a new `scripts/design-registry-lint.ts` alongside the existing file | **Rejected** — `scripts/design-lint.ts` v1.0.0 already owns the "design-lint" identity (VERSION_MANIFEST, SCRIPTS.md, ADR-0064/0066/0068, the v1.2 spec's backlog pointer) and already contains the raw-value detector the components check must reuse "without duplication". Extension, not forking. |
| Ship registry template files (`*.registry.yaml` skeletons) into `templates/common/` | **Rejected for now** — constraints (b)/(d): registries are project-populated through the decision gate; shipping pre-populated files would prescribe-by-inertia (the v1.2 red team's exact objection to populated inventories). The schema lives in this design doc and the lint's `--schema` output; a shape-only commented skeleton may be reconsidered in a later wave if projects ask for it. |
| zod validation at L0 via `zod-contract-gate` | **Rejected** — root `package.json` carries no zod (§7 evidence); zero-new-deps wins. Hand-rolled deterministic validators cover the closed shapes; `zod-contract-gate` remains the project-side convention where zod exists. |
| LLM-based checks (semantic "does this screen follow the pattern" review) | **Rejected** — every check must be deterministic set membership or parse logic (§3.6); LLM judgment is review's job, not the lint's. |
| Fix the registry paths at project root (`design/*.yaml`) | **Rejected** — violates the File Organization baseline against root clutter; `docs/design/` sits beside the existing `docs/design.md` SSOT (§4.4). |

## 11. Success Criteria

1. All four ticket checks implemented as sub-checks of `scripts/design-lint.ts` v2.0.0, each unit-tested per §8, including the absence-skip behavior and violation fixtures.
2. `bun scripts/audit.ts` full pass; typecheck at baseline; core `audit.ts`/`dev-sync.ts` byte-identical (no wiring changes).
3. With no registries present, `bun scripts/design-lint.ts` exits 0 and prints per-check SKIP notes; `--json` reports `"status": "skipped"` per check.
4. A fixture project with (i) an unbound token, (ii) a raw value in a governed component style block, (iii) an unregistered pattern reference, (iv) an unregistered icon, and (v) a single-face font token produces the five correct FAILs and exit 1; the legacy v1.0.0 invocation surface still behaves identically.
5. Version/registration consistency: `scripts/SCRIPTS.md` root row and `docs/VERSION_MANIFEST.md` row updated to v2.0.0 in the implementation wave; the L1 mirror (`templates/common/scripts/`) refreshed via the standard scripts propagation.
6. This design doc registered in `docs/specs/registry.json`; tickets T-20260926-028..031 reference this spec id when implemented.
