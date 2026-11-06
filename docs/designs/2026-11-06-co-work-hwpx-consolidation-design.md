# Design: consolidate HWP/HWPX document authoring into co-work

- **Spec ID**: 2026-11-06-co-work-hwpx-consolidation-design
- **Date**: 2026-11-06
- **Status**: Superseded 2026-11-06 — scope changed to removal (DEC-20261106-02 supersedes DEC-20261106-01; user direction: "remove the HWPX-related features", clarified "remove all HWPX"). Earlier approval: Approved 2026-11-06 (DEC-20261106-01)
- **Owner**: architect (PM Gateway dispatch)
- **Tier**: L2 (`templates/co-work`, `templates/co-consult`) + one L0 doc correction
- **Origin**: user direction 2026-11-06 — "HWP/HWPX document authoring should be consolidated into templates/co-work"


## Revised decision (2026-11-06)

The user withdrew the consolidation direction the same day: "remove the HWPX-related features", clarified as "remove all HWPX". Ruling recorded in `docs/decisions/DEC-20261106-02.md`, which supersedes DEC-20261106-01.

**HWP/HWPX capability is removed from the workspace templates entirely.**

- **co-work**: no HWP/HWPX tooling. No `md-to-hwpx.ts` / `hwp-extract.ts` / `hwpx-check.ts`, no `report-hwpx` entry in `document-style-registry.json`, no `hwpx-authoring` skill, no `cfb` dependency. The co-work TypeScript implementation that had started was stopped and fully reverted; no co-work changes remain.
- **co-consult removes**:
  - `templates/co-consult/scripts/co-consult/hwp-extract.ts`, `templates/co-consult/scripts/co-consult/hwpx-generate.ts`
  - `templates/co-consult/python/extract_hwp.py`, `templates/co-consult/python/generate_hwpx.py`
  - the `olefile` and `python-hwpx` lines (and their comments) in `templates/co-consult/python/requirements.txt` — `pandas` stays
  - the `hwp-document-processing` skill: SSOT `skills/hwp-document-processing/` plus every platform mirror
  - its registrations: `variant.json` (skills and scripts arrays), `skills/SKILLS.md`, `scripts/SCRIPTS.md`, `docs/skill-graph.*`
  - HWP references in `sample-driven-report-writing`, which instead states that deliverables are drafted in Markdown and converted to the client's format outside the workspace
  - HWP mentions in co-consult `README.md`, `README_ko.md`, `PROMOTION_CHECKLIST.md`, `package.json` (scripts/description)
- **Common-layer follow-on (in scope, found by grep)**: `templates/common/skills/i18n-layout/SKILL.md` line 92 routes HWP extraction/conversion/authoring to co-consult's `hwp-document-processing` skill, which will no longer exist. The paragraph (SSOT + `.claude`/`.gemini`/`.codex`/`.agents`/`.hermes` mirrors) must be reworded so it routes nowhere (e.g. "HWP is not processed in the workspace; convert to UTF-8 text/Markdown at the boundary outside the workspace"). `templates/common/agents/i18n-specialist.md` line 57 ("hwp pointers") drops that phrase.
- **2026-10-09 erratum stays valid.** The D5 erratum on `2026-10-09-co-deck-injector-promotion-design.md` corrected a factual record (T-20261005-026 promoted the Python, it was not deprecated). That history is unchanged by the removal; the removal is a new, later event.
- **Out of scope (format mentions only, left alone)**: `k-law` (`licbyl` attachments may be HWP/PDF links), `k-dart` (OpenDART source documents may contain HWP; it extracts text via its own API path), and co-safety (`evidence-collection-hot-work-permit`, evidence-models) mention HWP as a file format only. Grep for `hwp-extract|hwpx-generate|extract_hwp|generate_hwpx|hwp-document-processing` across `templates/common` and `templates/co-safety` matched only `i18n-layout` (handled above); none instruct running the removed scripts.

Everything below this section (§1 onward, including D1–D5 and the §6 resolutions) is the **Superseded** consolidation design, kept as a historical record.

---

> **Superseded (2026-11-06)** — historical record; see "Revised decision" above.

## 1. Context

co-work is the variant that owns office deliverables: the style SSOT `templates/co-work/docs/document-style-registry.json` already keys `docx`, `pptx`, and `xlsx` document types, and the native PPTX deck capability (`2026-11-03-co-work-native-pptx-deck-design`) landed there. Korean public-sector and institutional deliverables are the one office format it cannot produce.

HWP/HWPX capability exists today only inside co-consult, bound to one engagement shape:

| Asset | Path | Notes |
|---|---|---|
| Skill | `templates/co-consult/skills/hwp-document-processing/SKILL.md` (v2.0.1) + 4 platform mirrors | Procedure is written around the KOSME report (guideline-slot scan, 150p target, Communications Lead handoff) |
| HWP 5.0 read | `python/extract_hwp.py` (74 lines, `olefile`) via `scripts/co-consult/hwp-extract.ts` | Read-only; binary write is rejected by policy |
| HWPX write | `python/generate_hwpx.py` (173 lines, `python-hwpx`) via `scripts/co-consult/hwpx-generate.ts` | Headings, paragraphs, pipe tables only; no styles, no page setup, no images |
| Validation | `hwpx-validate` CLI from `python-hwpx` | Schema check only |

Two record-level problems surfaced while inventorying:

1. **Runtime-standard conflict.** ADR-0036 (amended by ADR-0087) makes TypeScript/Bun the template tooling runtime; ADR-0087's exception list does not include co-consult's Python. T-20261005-026 nonetheless promoted both `.py` files into the template (result: "both scripts stay active").
2. **Contradictory record.** `docs/designs/2026-10-09-co-deck-injector-promotion-design.md` states "co-consult's HWP promotion resolved to deprecation". The ticket and the shipped files say the opposite. One of the two is wrong today.

## 2. Goals / non-goals

**Goals**
- co-work owns a general HWPX authoring capability usable by any co-work engagement, styled from the same registry as docx/pptx.
- One implementation, not two drifting copies.
- Resolve the runtime-standard conflict explicitly, in an ADR-traceable way.

**Non-goals**
- Writing HWP 5.0 binaries (unchanged policy: read-only).
- Engagement-specific procedure (guideline-slot scans, page targets, chapter ownership) — stays in co-consult's `sample-driven-report-writing`.
- Pixel-faithful reproduction of arbitrary Hancom templates (see §6 Q3).

## 3. Decisions

### D1 — Placement: co-work is the owner of the format capability

- New co-work skill **`hwpx-authoring`** (type `implementation`): Markdown → HWPX with registry styles, HWP 5.0 structure extraction, validation. Format-generic; no engagement vocabulary.
- co-consult's `hwp-document-processing` is split: the engagement procedure (template TOC cross-check, placeholder scan, page-count target) stays as a thin co-consult skill that **calls** the co-work tooling contract; the format mechanics move out.
- Variants inherit only from `templates/common`, so co-consult cannot import co-work files. Resolved by §6 Q1: co-work is the sole owner of HWP/HWPX tooling; co-consult removes its copy.

### D2 — Runtime: port to TypeScript (confirmed: option A)

| Option | Fit with ADR-0036/0087 | Cost | Risk |
|---|---|---|---|
| **A. TS port (recommended)** | Compliant, no exception needed | Medium: HWPX is OPC zip + OWPML XML, the same shape `scripts/md-to-ooxml.ts` already emits for docx; HWP 5.0 read is OLE CFB + zlib (`cfb` npm + `node:zlib`) | Must reproduce `python-hwpx`'s minimal valid package (header.xml, section0.xml, content.hpf, manifest) |
| B. Keep Python, add ADR-0087 exception | Requires ADR amendment | Low now | Two runtimes in co-work; `pip` prerequisite for every co-work user; `shell:true` spawn path on Windows |
| C. Keep Python in co-consult only, co-work calls nothing | Status quo | None | Does not meet the user's direction |

**Confirmed: option A.** Per §6 Q2 the emitter is co-work-local (`md-to-hwpx.ts`); sharing the Markdown AST with `scripts/md-to-ooxml.ts` is deferred until a second consumer appears.

**Dependencies (co-work `package.json`)**: reuse the existing `fflate` for zip read/write; add `cfb` (npm, Apache-2.0) for HWP 5.0 OLE compound-file reading; use `node:zlib` `inflateRawSync` for BodyText stream decompression; add `fast-xml-parser` only if needed for D4 XML well-formedness checks.

### D3 — Style SSOT: registry gains an `hwpx` document type

Add a `report-hwpx` entry to `document-style-registry.json` with `output_format: "hwpx"`: page A4, Korean public-document margins, font roles mapped to bundled-safe faces (HCR Batang / HCR Dotum (Hancom bundled faces) with a fallback chain), heading numbering style (Roman / Arabic / Hangul-syllable levels), table border/header-fill tokens. Values are proposals to confirm in implementation; field names follow the existing docx entries.

### D4 — Validation without Python

The gate runs three deterministic checks in TS: (1) OPC package integrity (required parts present, manifest ↔ parts parity), (2) XML well-formedness of every part, (3) a structural subset of the OWPML schema covering the elements the emitter writes. `hwpx-validate` remains an **optional** extra check when the user has it installed; it is not a prerequisite.

### D5 — Correct the record

Fix the false statement in `2026-10-09-co-deck-injector-promotion-design.md` with a dated erratum line pointing at T-20261005-026 and this spec. Do not rewrite history in place.

## 4. Implementation map (after approval)

| Step | Surface | Change |
|---|---|---|
| 1 | `templates/co-work/scripts/co-work/md-to-hwpx.ts` (no L0 `scripts/md-to-ooxml.ts` change) | HWPX emitter: headings, paragraphs, lists, tables, images, page setup |
| 2 | `templates/co-work/scripts/co-work/hwp-extract.ts` | TS port of `extract_hwp.py` (CFB + zlib BodyText → text/TOC) |
| 3 | `templates/co-work/scripts/co-work/hwpx-check.ts` | D4 validation gate, JSON report |
| 4 | `templates/co-work/docs/document-style-registry.json` | D3 `report-hwpx` entry |
| 3a | `templates/co-work/scripts/co-work/tests/` | Bun tests for steps 1–3 (golden, HWP read, gate negatives) |
| 3b | `templates/co-work/package.json` | add `cfb` (+ `fast-xml-parser` if needed); reuse `fflate` |
| 5 | `templates/co-work/skills/hwpx-authoring/SKILL.md` + platform mirrors; `skills/SKILLS.md`; `variant.json` | new skill registration |
| 6 | `templates/co-consult/...` | **Removal** (per §6 Q1): delete `scripts/co-consult/hwp-extract.ts`, `scripts/co-consult/hwpx-generate.ts`, `python/extract_hwp.py`, `python/generate_hwpx.py`, and the `olefile` / `python-hwpx` lines of `python/requirements.txt` (`pandas` stays — other co-consult Python remains). Slim `hwp-document-processing` (+ mirrors) to the engagement procedure (TOC cross-check, placeholder scan, page-count) and state that format tooling lives in co-work (`hwpx-authoring`). Update co-consult `SCRIPTS.md` / registries. |
| 7 | `docs/designs/2026-10-09-co-deck-injector-promotion-design.md` | D5 erratum |
| 8 | `docs/skill-graph.*`, `SCRIPTS.md` registries | regenerate / re-pin |

## 5. Test plan

- **Parity fixture**: the same Markdown input through the current Python generator and the TS emitter; both outputs pass `hwpx-validate` (run once, manually, where Python exists) and open in Hancom Office / Hancom Docs Viewer with equal paragraph and table counts.
- **Golden tests** (Bun): emitter output part list and `section0.xml` snapshot for headings, nested lists, a 3×3 table, a Korean+Latin mixed run, an image.
- **HWP read**: a small `.hwp` fixture; extracted TOC equals the known heading list.
- **Gate negatives**: missing manifest entry, malformed XML, unknown element → each fails with its rule id.
- **co-consult regression**: the slimmed engagement procedure runs end to end in a co-work engagement using co-work tooling; co-consult audit passes with the removed files gone (no dangling references).

## 6. Resolved questions (Design Gate 2026-11-06, DEC-20261106-01)

- **Q1 — How does co-consult get the tooling? → RESOLVED: option (c).** co-work is the sole owner of HWP/HWPX tooling. co-consult removes `scripts/co-consult/hwp-extract.ts`, `scripts/co-consult/hwpx-generate.ts`, `python/extract_hwp.py`, `python/generate_hwpx.py`, and the `olefile` / `python-hwpx` lines of `python/requirements.txt` (`pandas` stays — other co-consult Python remains). co-consult's `hwp-document-processing` shrinks to the engagement procedure (TOC cross-check, placeholder scan, page-count target) and states that format tooling lives in co-work (`hwpx-authoring`); engagements needing HWPX generation run with co-work tooling. **Removal is direct, not a deprecated → removed lifecycle cycle**, because the user explicitly asked for the cleanup ("clean up the HWPX tooling in co-consult"); a deprecation window would keep the ADR-0036/0087 runtime conflict alive for no requesting consumer. Options (a) byte-synced copy and (b) promotion to `templates/common` were rejected: (a) re-creates the two-copy drift this spec removes; (b) ships HWPX to every variant without a second consumer.
- **Q2 — Emitter location → RESOLVED: co-work-local.** `templates/co-work/scripts/co-work/md-to-hwpx.ts`, `hwp-extract.ts`, `hwpx-check.ts`, with Bun tests under `templates/co-work/scripts/co-work/tests/`. No change to L0 `scripts/md-to-ooxml.ts`; merge later only if a second consumer appears.
- **Q3 — Template fill → RESOLVED: out of scope.** Filling an existing institutional `.hwpx` template is not part of this spec; propose separately once the emitter exists.
