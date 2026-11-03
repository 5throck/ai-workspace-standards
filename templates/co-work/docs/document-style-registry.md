# Document Style Registry

## Purpose

The document style registry provides reusable corporate style templates keyed by document type for OOXML (Office Open XML) compilation. This is the Single Source of Truth (SSOT) for how `md-to-ooxml.ts` and future OOXML emitters should style paragraphs, text, and pages across all co-work deliverables.

This registry achieves benchmark parity with Apache POI's named-style system and corporate document template conventions, where style bundles are defined once and reused across all documents of a given type rather than being embedded in individual files.

**Decision record**: Closes `docs/variant-benchmark-backlog.md` section 8 "No document template registry" (gap closed 2026-08-25).

## Schema

The registry is a JSON document with the following structure:

### Root Fields

| Field | Type | Description |
|-------|------|-------------|
| `registry` | string | Registry identifier (e.g., "co-work-document-style-registry") |
| `version` | string | SemVer version string (e.g., "1.0.0") |
| `description` | string | Human-readable purpose statement |
| `consumers` | array of string | List of scripts/tools that consume this registry |
| `units` | object | Unit definitions for numeric values |
| `document_types` | object | Map of document type keys to style bundles |

### Units Object

| Key | Value Format | Description |
|-----|--------------|-------------|
| `size_half_pt` | integer | OOXML font size in half-points (24 = 12pt) |
| `color` | string | 6-digit hex without # prefix (OOXML w:color val format) |
| `spacing_pt` | number | Spacing values in points |

### Document Type Entry

Each key under `document_types` represents a document type (e.g., "memo", "report", "deck") and contains:

| Field | Type | Description |
|-------|------|-------------|
| `output_format` | string | Target OOXML format: "docx", "pptx", or "xlsx" |
| `description` | string | Human-readable document type description |
| `styles` | object | Style ID to style property mapping |
| `page` or `slide` | object | Page/slide layout settings (format-specific) |
| `header_footer` | string | Header/footer mode (docx only) |

### Style Property Fields

| Field | Type | OOXML Mapping | Description |
|-------|------|---------------|-------------|
| `font_ascii` | string | w:rFonts w:ascii | Latin-script font name |
| `font_eastasia` | string | w:rFonts w:eastAsia | East Asian script font name (e.g., Korean) |
| `size_half_pt` | integer | w:sz w:val | Font size in half-points |
| `color` | string | w:color w:val | 6-digit hex color (no # prefix) |
| `bold` | boolean | w:b | Bold text when true |
| `space_before_pt` | number | w:spacing w:before | Spacing before paragraph in points |
| `space_after_pt` | number | w:spacing w:after | Spacing after paragraph in points |
| `indent_pt` | integer | w:ind w:left | First-line indent in points |
| `line_spacing` | number | w:spacing w:line | Line spacing multiplier |
| `fill` | string | (xlsx only) | Cell background fill color |

## Consumption Contract

### Style ID Mapping

The style IDs defined in this registry (`Normal`, `Heading1`, `Heading2`, `Heading3`, `ListBullet` for DOCX; `Title`, `Body` for PPTX) match the `<w:pStyle w:val">` references that the OOXML compiler emitters generate. When the compiler writes:

```xml
<w:pStyle w:val="Heading1"/>
```

the corresponding `styles.xml` part should resolve that ID to the style definition under `document_types.<type>.styles.Heading1`.

### Current Compiler State

Today, `scripts/md-to-ooxml.ts` emits DOCX and PPTX files with NO `styles.xml` part - style resolution falls to Word/PowerPoint defaults. This registry is the SSOT for the TARGET corporate style definitions that future compiler enhancements should consult when wiring style parts.

### Reserved Entries

The `spreadsheet` document type is marked `status: "reserved"` - no XLSX emitter exists yet. When an XLSX emitter is implemented, it should read the `HeaderRow` and `Data` style definitions for cell styling.

### Extending the Registry

To add a new document type:

1. Add a new key under `document_types` (e.g., `"contract"`)
2. Define all required style entries appropriate to that document type
3. Specify `output_format` ("docx", "pptx", or "xlsx")
4. Provide a clear `description` of the document's purpose
5. For additive changes (new types, new style fields), bump the minor version
6. For breaking changes (renaming/removing style IDs), bump the major version and record in CHANGELOG

## Decks Section (v1.1.0)

The top-level `decks` object carries style tokens for the **native PPTX deck capability** (canonical-SVG authoring + DrawingML compilation; spec `2026-11-03-co-work-native-pptx-deck-design`, DEC-20261103-01). It is consumed by:

- `templates/co-work/scripts/svg-to-pptx.ts` — derives the PPTX `clrScheme` / `fontScheme` (via `colors.clr_scheme_mapping`) and slide size (via `canvas`) for the flat-mode package.
- `templates/co-work/skills/svg-slide-authoring` — locked tokens (colors, fonts, canvas) that deck-builder must not invent per run.

| Token group | Contents | PPTX mapping |
|-------------|----------|--------------|
| `canvas` | `width_px`, `height_px`, `aspect`, `emu_per_px` (9525) | slide size EMU (`width_px × emu_per_px`) |
| `colors` | `background` / `primary` / `accent` / `text` / `muted` (hex, no `#`, per `units.color`) + `clr_scheme_mapping` | `clrScheme` dk1/lt1/dk2/lt2/accent1–6 |
| `fonts` | `major` / `minor` (+ eastAsia variants, `fallback_note`) | `fontScheme` majorFont/minorFont |
| `deck_types` | presets (`business-report`, `proposal`, `briefing`): `page_count_guidance`, `slide_roles` | design-brief scaffolding; structured layouts are P2 roadmap |

Color unit note: this registry stores colors **without the `#` prefix** (OOXML convention, per `units.color`); canonical SVG authoring spells the same tokens **with** the `#` prefix and uppercase (`#RRGGBB`).

### Extending `decks`

Same rules as document types: additive changes (new deck types, new token fields) bump the minor version; removing/renaming token keys is a major bump. New deck_types are additive; changing `clr_scheme_mapping` semantics is breaking.

## Governance

The registry version lives in the JSON `version` field. Changes to the registry follow the standard PR flow via `/sync`:

- Minor version bumps: Additive changes (new document types, new style fields)
- Major version bumps: Breaking changes (removed IDs, renamed fields, incompatible schema changes)

All changes must pass validation (`bun scripts/validate-templates.ts`) and language checks (`bun scripts/validate-md-language.ts`) before merging.
