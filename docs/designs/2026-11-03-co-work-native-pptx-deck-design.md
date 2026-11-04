# Design: co-work native PPTX deck capability — canonical-SVG authoring, deterministic gates, and DrawingML compilation

- **Spec ID**: 2026-11-03-co-work-native-pptx-deck-design
- **Date**: 2026-11-03
- **Status**: Implemented (user-approved 2026-11-03; P1 capability + P2 text-model slice landed same day — P3 roadmap items remain demand-gated; registry status: implemented)
- **Decision record**: docs/decisions/DEC-20261103-01.md (placement, tech route, clean-room ruling, agent model, style SSOT)
- **Owner**: architect (PM Gateway dispatch)
- **Tier**: L2 (templates/co-work only — no L0/L1 file changes)
- **Placement ruling**: co-work variant; **co-deck remains unchanged** (its 11-Stage naming, S1~S11 IDs, and HTML→PDF pipeline are explicitly preserved as-is)

## 0. Accessibility exemption statement

This design produces no user-facing UI. It defines an authoring workflow, a
validator script, a compiler script, and registry data. ADR-0065
accessibility sections and ADR-0070 preview-verification sections are
**exempt** for every artifact in this design. The PPTX deliverable's own
text-contrast/legibility quality is carried by the deck design guidance in
the svg-slide-authoring skill, not by UI accessibility tooling.

## 1. Context and goal

### 1.1 Background analysis (ppt-master, v6.7.0)

ppt-master is a workflow that turns documents or topics into **natively
editable PowerPoint** (.pptx) files. Its architectural ideas — evaluated and
adopted here as clean-room concepts (no code or document text is copied) —
are:

| Concept | Summary | Adoption in this design |
|---|---|---|
| Project-canonical SVG | A **closed** intermediate language: a whitelist of SVG elements/attributes with exact DrawingML mappings; px viewBox; uppercase `#RRGGBB`; three input states (canonical / compatible-with-warning / invalid-blocking) | **Adopted verbatim as a concept** — it is the single source of truth for what the compiler accepts |
| Per-page hand authoring | Pages are authored one at a time by the agent; script-generated page batches are forbidden (cross-page visual continuity degrades) | **Adopted** — deck-builder authors per page |
| Dual quality gates | Early gate on the first five pages (method sample; skipped for rosters ≤ 6) + final gate over the whole deck; severity model: error blocks, warning passes, **intentionally no auto-fix**; export refuses without a SHA-256-fingerprint-matching final report | **Adopted** — the fingerprint-refusal rule is the key export integrity invariant |
| Design brief + locked tokens | Human-readable design rationale separated from a machine-readable execution contract (colors, fonts, page rhythm) | **Simplified** — one design brief document plus a locked-tokens block sourced from the registry |
| Kitchen contract ownership | Planner / cook / inspector / packager roles with non-mergeable ownership | **Adopted** — mapped onto co-work's existing agents plus the new builder |
| Deterministic routing | Request shape → route is decided by rules, never offered as a route-choice menu | **Adopted** — two modes (default/quick) selected by explicit user intent only |

Explicitly **not** adopted (out of scope or superseded by simpler co-work
placement): edit-native round-trip editing of arbitrary PPTX files, template
mining (brand/style/layout/deck extraction), animation sidecars, TTS
narration, MP4 export, image-sheet chroma-key slicing.

### 1.2 Workspace gap

- co-deck produces print-ready PDF only; per DEC-20261103-01 it stays
  unchanged, and a co-deck-deck → PPTX conversion path is deferred to §10
  (P3 roadmap).
- co-work owns the document-style-registry (md/json), the styling SSOT whose
  entries already declare `output_format: docx|pptx|xlsx` and target
  `templates/common/scripts/md-to-ooxml.ts` — a structured-document OOXML
  compiler. That compiler handles flowing documents; it has no
  canvas-geometry model, so a deck capability needs its own compiler.
- The zcode `presentations:pptx` plugin is a runtime capability available in
  the harness, not a template-system asset; scaffolded L3 projects do not
  receive it.

### 1.3 Goal

A single authoring path in co-work that produces **natively editable
DrawingML PPTX** (clickable, restylable shapes — not slide images), with
deterministic quality gates, style tokens from the existing SSOT, and a
clean-room TS implementation consistent with the bun/TS workspace standard.

## 2. Placement and boundaries

- **co-work** (templates/co-work) carries the capability. co-work is a
  delegation hub (the analyst / content-writer / ms365-expert /
  project-coordinator / technical-writer family); spokes may route PPTX
  deliverables through `delegate-to-hub`.
- **co-deck** receives zero file changes (DEC-20261103-01).
- **Runtime three-layer boundary** (documented to prevent capability overlap):

| Layer | Scope | Capability shape |
|---|---|---|
| zcode `presentations:pptx` plugin | Harness runtime only | Generic quick authoring/editing; not delivered to scaffolded projects |
| **co-work deck capability** (this design) | Template system, co-work + delegation consumers | Registry-token-driven, gate-enforced, deterministic export |
| `md-to-ooxml.ts` + document-style-registry | All variants (common contract) | Structured flowing documents (DOCX/XLSX/simple PPTX) |

- **Agent boundary**: `ms365-expert` remains advisory (guidance on PowerPoint
  features/templates); generation belongs to the new `deck-builder` agent.
  `content-writer` / `storyteller` own narrative content, not slides.

## 3. Architecture — single authoring path

```text
[Content]  content-writer / storyteller
           → deck_content.md   (approved content contract — the SSOT for text)
     ↓
[Author]   deck-builder   (svg-slide-authoring skill)
           per-page canonical SVG, hand-authored, one page per pass
           default mode: ONE blocking design-brief confirmation gate before authoring
           quick mode:   straight to authoring (explicit user intent only)
     ↓
[Gate]     svg-quality-gate skill / svg-check.ts
           early gate: first 5 pages as method sample (skipped for rosters ≤ 6)
           final gate: whole deck; error = block, warning = pass, NO auto-fix
           content SSOT invariant: text runs diffed against deck_content.md —
             added/changed text beyond the brief BLOCKS
           report carries SHA-256 fingerprint of the checked SVG bytes
     ↓
[Repair]   deck-builder re-authors failing pages (max 2 rounds per page,
           then PM escalation — co-deck retry_policy pattern)
     ↓
[Package]  pptx-export skill / svg-to-pptx.ts
           DrawingML compile → fflate OOXML zip
           export REFUSES without a fingerprint-matching final report
           postflight report: zip integrity, slide count, mode, provenance
     ↓
[Accept]   @resvg/resvg-js PNG render per page → existing visual-judge gate
           (per the delivery protocol's visual acceptance pass)
```

Key rules:

1. **One authoring path.** There is no second lane and no route menu. Quick
   mode is the same path minus the confirmation gate, selected by explicit
   user intent — never inferred from page count or topic.
2. **Per-page hand authoring.** No script may generate page SVGs; the skill
   states the prohibition and the gate's provenance check surfaces violations.
3. **Locked tokens.** Colors, fonts, and canvas come from the registry
   `decks` section (§7). Page-local accents are allowed; a second recurring
   visual system is not — recurring identity requires a registry/brief update.
4. **Content SSOT.** `deck_content.md` is the only source of deck text. The
   gate enforces the invariant mechanically (text-run diff), which is what
   makes per-page authoring safe without a second planning artifact.

## 4. Canonical SVG specification (clean-room)

### 4.1 Element whitelist (initial)

| Family | Elements / attributes | Notes |
|---|---|---|
| Text | `text`, `tspan` | dy-stacked tspans flatten into one text body at compile; x-anchored tspans map to positioned runs |
| Geometry | `rect` (+rx), `circle`, `ellipse`, `line`, `polyline` | |
| Paths | `path` with absolute `M/L/H/V/C/Q/Z` commands | relative commands = compatible (deterministic normalization) |
| Images | `image` (+`preserveAspectRatio`, crop via viewport) | raster embedded into package media |
| Paint | `fill`, `stroke`, `linearGradient`, `radialGradient` | `#RRGGBB` uppercase; transparency via `fill-opacity` / `stroke-opacity` / element `opacity`, never `rgba()` |
| Structure | `g` with `transform="translate/rotate/scale"` | top-level `g` = logical content block; carries `data-block-id` |
| Text presentation | `text-anchor="start\|middle\|end"`, `letter-spacing` (px number), `text-decoration="underline\|line-through\|none"` | compiled to paragraph `algn` / run `spc` / `u`·`strike`; the text box is repositioned from an estimated text width. `dominant-baseline` / `alignment-baseline` are **unsupported** — the checker warns (`W-UNSUPPORTED-BASELINE`) and the compiler ignores them; a `tspan` repeating its line-start `x` is the canonical wrap pattern; tspans mixing different `x` values warn (`W-TSPAN-X`, compiles as paragraph flow) |
| Markers | `data-block-id` | future transition/animation anchor; required on top-level groups |
| Hyperlinks | `<a href="...">` wrapping one visible element; href = absolute `https?://`/`mailto:` or `#slide-N` (1-based internal jump); nested `<a>` invalid | external -> hyperlink relationship (TargetMode External) + `a:hlinkClick`; internal -> slide relationship + `ppaction://hlinksldjump` |
| Slide transition | `data-slide-transition="none|fade|push|zoom|wipe"` on root | consumed at compile; emits `p:transition`, never appears in output |

Anything outside the whitelist is `invalid` (blocking), except expressions
explicitly listed as `compatible` (deterministic normalization + non-blocking
warning; never fed back into authoring prompts).

### 4.2 Canvas

- viewBox in px; default 1280×720 (16:9); registry `decks.canvas` may declare
  alternatives (e.g. 9:16 briefing). EMU conversion happens exactly once, at
  export (9525 EMU/px; 16:9 slide = 12192000×6858000 EMU).

### 4.3 Speaker notes (optional feature, first implementation)

- Per-page notes live in `deck_content.md`; the exporter emits `notesSlide`
  parts. Absent notes = no notesSlide part; never placeholder text.

## 5. Compiler design (`scripts/svg-to-pptx.ts`)

- **Per-element dispatch translators** (SVG hierarchy → DrawingML
  group/shape/picture types), not whole-file translation — each translator is
  unit-testable in isolation; slide quality is the sum of independent local
  conversions.
- px→EMU conversion (9525/px) as in §4.2.
- **Flat mode output**: one clean slide master + one blank layout per file,
  with `clrScheme` / `fontScheme` derived from the registry `decks` tokens of
  the chosen deck style. Structured mode (`p:sldLayout` per registry deck
  preset) is P2 roadmap (§10) — not in the initial subset.
- **Packaging**: fflate for the OOXML zip; XML build patterns follow the
  `templates/common/scripts/md-to-ooxml.ts` precedent (escape, part templating,
  content-types assembly). No Python, no external Office tooling.
- **Export integrity**: refuses to run without a final `svg-check.ts` report
  whose SHA-256 fingerprint matches the current SVG bytes; writes a postflight
  report (zip part counts, slide count, mode, per-page provenance).
- **Golden-file tests** (`scripts/co-work/tests/` or per script-lifecycle
  conventions): compile a fixed minimal deck, unzip the artifact, assert
  slideN.xml structure, master part, clrScheme values, notes presence.
- **New co-work dependencies**: `fflate`, `@resvg/resvg-js` (preview render).

## 6. Gate runner (`scripts/svg-check.ts`)

- Validates the canonical contract (§4): three input states, whitelist
  enforcement, XML well-formedness.
- Enforces the content SSOT invariant: extracted text runs diffed against
  `deck_content.md` (normalization: whitespace collapse); additions/changes
  beyond the approved brief are blocking errors.
- Emits a JSON report: per-page findings with severity, deck-level summary,
  SHA-256 fingerprint of checked bytes, early/final stage tag.
- Read-only: never rewrites pages (no auto-fix, matching §1.1 severity model).

## 7. Registry extension — document-style-registry `decks` section

Extend `templates/co-work/docs/document-style-registry.{md,json}` (the
existing styling SSOT) with a `decks` section:

| Token group | Contents | PPTX mapping |
|---|---|---|
| `canvas` | width/height px, aspect | slide size EMU |
| `colors` | background / primary / accent / text / muted | `clrScheme` (dk1/lt1/accent1-6) + shape-fill palette |
| `fonts` | major / minor (+ fallback note) | `fontScheme` major/minor |
| `deck_types` | presets, e.g. `business-report`, `proposal`, `briefing`: page-count guidance, slide-role roster (title/agenda/content/divider/closing) | design-brief scaffolding; structured layouts in P2 |

Why registry extension over a separate spec file: one SSOT for document and
deck styling; no parallel style system; existing registry validation and
review flow cover the new section unchanged.

## 8. New components (co-work, at implementation time)

| Type | Name | Registration |
|---|---|---|
| Agent | `deck-builder` (tier: medium) — canvas design + strict-XML authoring + gate operation + export chain; `handoff_from: content-writer, storyteller` | `agents/deck-builder.md`; variant.json `agents[]`; `agent_manifest` (evaluate `optional[]` placement) |
| Skill | `svg-slide-authoring` — canonical SVG spec (§4), modes, per-page discipline | `skills/svg-slide-authoring/` (scope: co-work); `skills/SKILLS.md`; variant.json `skills[]` + `skill_manifest.variant_specific[]` (`used_by_agents: [deck-builder]`) |
| Skill | `svg-quality-gate` — gate procedure, severity model, SSOT invariant | `skills/svg-quality-gate/` (scope: co-work); same registration |
| Skill | `pptx-export` — compile + postflight + provenance | `skills/pptx-export/` (scope: co-work); same registration |
| Script | `scripts/svg-check.ts` | first co-work `script_manifest` (new block; conventions per co-deck manifest, `variant_scripts_dir: scripts`) |
| Script | `scripts/svg-to-pptx.ts` | same |
| Tests | golden-file bun tests | per script quality gate (docs/governance/script-quality-gate.md) |
| Registry | document-style-registry `decks` section (§7) | `docs/document-style-registry.{md,json}` |
| Release | CHANGELOG entry; version 1.0.0 → 1.1.0 | `templates/co-work/CHANGELOG.md`, `variant.json`, `docs/templates/VERSION_REGISTRY.json`; `docs/VERSION_MANIFEST.md` regenerated via `generate-version-manifest.ts` (never hand-edited) |

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Authoring discipline erosion (script batch generation temptation) | skill states the prohibition; provenance check at gate; per-page authoring is also what keeps visual continuity |
| Content drift between slides and approved content | mechanical text-run diff invariant in svg-check.ts (blocking) |
| Scope creep of the SVG language | closed whitelist; widening requires a spec update; golden tests pin compiler behavior |
| Fonts: PPTX references font names — rendering depends on the viewer machine | registry `fonts` carries a fallback note; limit stated in deck brief; no font embedding in P1 |
| resvg preview vs actual PowerPoint render differ in minor ways | visual-judge verdicts are the acceptance gate on rendered previews; the limit is stated in the skill; pixel-perfect parity is a non-goal |
| Design-brief gate friction for trivial decks | quick mode escape hatch (explicit user intent only) |
| First compiler subset too narrow for some decks | whitelist grows by spec update, not per-run improvisation; structured layouts scheduled P2 |

## 10. Roadmap

- **P2**: native Chart/Table (data-backed, Edit Data — next slice; needs the
  embedded-workbook contract), structured Master/Layout mode derived from
  registry `deck_types` presets (`p:sldLayout` inheritance).
  Landed 2026-11-04 (slice 2): hyperlinks (`<a>` external + `#slide-N`
  internal) and slide transitions (`data-slide-transition` → `p:transition`).
- **P3** (deferred, co-deck linkage — DEC-20261103-01): promote `html-to-svg`
  extraction to a common script enabling co-deck HTML decks → PPTX conversion
  including ppt-engine theme token linkage; TTS narration.
- **Non-goals**: edit-native round-trip editing of arbitrary PPTX files,
  template mining (brand/style/layout/deck extraction), MP4 export, batch
  script page generation.

## 11. Verification (implementation round)

1. `bun test` golden files pass (compile → unzip → assert slideN.xml, master,
   clrScheme, notes).
2. `svg-check.ts` unit cases: whitelist violation blocks; compatible input
   warns non-blockingly; text-run mismatch against deck_content.md blocks.
3. Export refuses to run without a fingerprint-matching final report.
4. A 6-page sample deck (one registry deck_type) compiles and opens as
   editable DrawingML (shapes selectable/restylable in PowerPoint).
5. Rendered page PNGs pass the existing visual-judge gate per the delivery
   protocol.
6. **No Office-tooling rendering dependency (deliberate policy, 2026-11-03
   user ruling)**: LibreOffice (and PowerPoint automation) is never installed
   or invoked by this pipeline. Visual acceptance renders the *authored SVG*
   via `@resvg/resvg-js`; package correctness rests on the compiler's
   structural postflight plus the empirical compatibility contract — the
   checker's rule set is thickened as real PowerPoint breakage surfaces, not
   by rendering the package through an Office emulator.

## 12. References

- docs/decisions/DEC-20261103-01.md (gate-moment rulings)
- docs/adr/0074 (Design Gate), docs/adr/0061 (decision records)
- templates/co-work/variant.json, templates/co-work/docs/document-style-registry.{md,json}
- templates/co-deck/variant.json (script_manifest / retry_policy conventions — reference only; no changes to co-deck)
- templates/common/scripts/md-to-ooxml.ts (XML build precedent)
- docs/guides/hub-operator-guide.md (co-work hub role, delegation)
- docs/governance/script-quality-gate.md (script tests)
