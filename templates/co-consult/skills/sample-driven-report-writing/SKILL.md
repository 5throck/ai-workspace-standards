---
name: sample-driven-report-writing
status: active
scope: co-consult
description: >
  Analyzes a deliverable sample (HWP/PDF/DOCX) to extract its table-of-contents
  structure AND, for each section, whether tables and/or charts are mandatory —
  then researches and drafts report content that matches the sample's exact
  structure and visual-element requirements. Use when: writing any consulting
  deliverable that must conform to a supplied sample or government/institutional
  template format.
owner: communications-lead
version: 1.0.0
last_reviewed: 2026-08-11
prerequisites: consulting-report-writing
metadata:
  type: domain
  triggers:
    - sample-driven report
    - deliverable template
    - match sample structure
    - write to sample format
---

## Context

This skill generalizes the "write-to-sample" discipline: given a finished reference deliverable (a sample) or an official template form, produce a new deliverable whose chapter structure, section composition, and visual-element usage (tables/charts) match the sample exactly — not approximately.

It replaces engagement-specific hardcoding (a fixed chapter table, a fixed page budget, a fixed team roster) with a **sample-analysis procedure** that derives all of those from the actual sample on disk. Always re-extract from the real attached sample; never trust a cached or previously-known structure, because template forms are revised (e.g. annual `2026형` → `2027형` editions change chapter counts and required tables).

**PM Gateway applies**: PM displays an execution plan table before dispatching any specialist at each phase transition. PM may Write/Edit only `memory/*.md` and `CHANGELOG.md` directly; deliverable files are produced by dispatched specialists.

## When to Use

- A client or engagement lead supplies a reference deliverable (or a government/institutional form template) and the new report must match its structure and format
- A public-sector submission (a results/report template that specifies chapter count, mandatory tables, and page budget) must be filled in
- A completed past deliverable should serve as the structural model for a new engagement
- Do NOT use for free-form reports with no required structure — use `consulting-report-writing` alone

## Execution Steps

1. **Phase 1 — Sample Analysis**: Ingest the reference deliverable, extract its structure (TOC, mandatory tables/charts per section, placeholder slots, page budget), and produce a Writing Spec artifact. Confirm the spec with the engagement lead before proceeding.
2. **Phase 2 — Research**: Dispatch analytical inputs (financial, legal, industry) mapped to each chapter per the Writing Spec.
3. **Phase 3 — Draft**: Assign chapter owners by content type, draft in parallel against the Writing Spec, replace all placeholders, enforce table-to-narrative ratio and mandatory visual elements.
4. **Phase 4 — Validate & Render**: Structural validation, visual-element audit, render to the sample's specified format (`.hwpx` / `.docx` / `.pdf`). Max 2 revision cycles before PM escalation.

Detailed instructions for each phase are below.

## Phase 1 — Sample Analysis (the differentiator)

Ingest the actual sample and produce a **Writing Spec** artifact (`memory/<engagement>-writing-spec-<date>.md`). This is the single source of truth for the rest of the workflow.

### 1.1 Ingest the sample

| Sample format | Tool | Notes |
|---|---|---|
| `.hwp` (HWP 5.0 binary) | `bun scripts/co-consult/hwp-extract.ts <file.hwp>` → `hwp-document-processing` | Extracts BodyText paragraph records; no Hancom Office required |
| `.pdf` | `md-to-ooxml` text extraction / WebFetch / manual read | If image-only PDF, OCR first |
| `.docx` | `md-to-ooxml` / `md-to-report` reader | |
| `.hwpx` (open XML) | `python/generate_hwpx.py` (read mode) / `hwpx-validate` | |

If only a paper/PDF scan exists, ask the engagement lead for the editable source — analysis fidelity drops sharply on scans.

### 1.2 Extract the structure and the per-section visual-element requirements

For each chapter/section visible in the sample, record in the Writing Spec:

1. **Chapter/section number and title** (English + original-language).
2. **Table-of-contents position** and approximate page span in the sample.
3. **Table mandatory-flag**: count table markers in that section (`표 N-N`, `<table>`, HWP table records, pipe-tables). If the sample contains one or more tables in this section, mark it `requires-table`. Record the typical column structure.
4. **Chart/figure mandatory-flag**: count figure/chart markers (`그림 N-N`, `차트`, `그래프`, embedded images). Mark `requires-chart` where present. Record the chart type (trend line, bar, pie, etc.).
5. **Narrative-only sections**: sections with neither table nor chart markers — prose is the expected output.
6. **Placeholder/guideline slots**: every guideline-instruction block (`[작성 가이드라인]`, `[기재 방향]`, `예시N)`) and example block that the sample/template uses to instruct the author. These MUST be replaced with real content in the draft — list them so none survive.
7. **Page-budget target**: from the sample's completed length (or the template's stated budget), derive a per-chapter page target.

**Critical**: the table/chart mandatory-flags are not decorative — a section marked `requires-table` is incomplete without a table, and `requires-chart` is incomplete without a chart. The draft cannot be considered done until every mandatory visual element is present.

### 1.3 Confirm the spec with the engagement lead

Before research begins, confirm the Writing Spec (structure + mandatory visual elements + page budget) with the engagement lead. Template editions drift; a wrong spec wastes an entire drafting cycle.

## Phase 2 — Research

Dispatch analytical inputs against the Writing Spec's section list:

- **Company financials / industry data** → `k-dart`, `financial-statement-analysis` pipeline (`bun scripts/co-consult/financial-pipeline.ts`), `company-intelligence`, `competitive-intelligence`
- **Legal / regulatory environment** → `k-law`
- **DART fallback** (non-disclosing / unlisted target companies): use company-provided source documents (`세무조정계산서`, `결산서`, `시산표`), explicitly labeled `기업 제공 비공식 자료` with document name and date — these are not independently verifiable the way a DART filing is.
- Each research output is mapped to the specific chapter(s) it feeds, per the Writing Spec.

## Phase 3 — Draft (parallel, against the Writing Spec)

- PM/Communications Lead assigns chapters per the ownership implied by content type (financial → `data-analyst`; narrative → `communications-lead`; domain → `sme`; strategy → `strategy-analyst`). Dispatch chapter owners in parallel — disjoint chapters with Phase-1 research already in hand can be drafted concurrently.
- Each owner drafts their chapters in Markdown, **replacing every guideline/placeholder slot listed in the Writing Spec with real content**.
- Enforce the **table-to-narrative ratio**: every data table is followed by at least half a page of interpretation. A table alone does not satisfy a section.
- For every section marked `requires-table` / `requires-chart`, the drafted section MUST contain that visual element (Markdown table / Mermaid or chart-spec block).
- Communications Lead assembles the full draft, edits for voice/terminology/MECE consistency, and confirms chapter order matches the Writing Spec's TOC exactly.

## Phase 4 — Validate & Render

1. **Structural validation** (via `hwp-document-processing`): chapter order matches the sample TOC; no guideline/example placeholder leftovers survive; per-chapter page count is within ±15% of the Writing Spec page budget.
2. **Visual-element audit**: re-scan the draft for each section's mandatory-flag — every `requires-table` / `requires-chart` section must contain its element. This is the check most likely to fail; iterate.
3. **Render the final format**:
   - `.hwpx` (government submission) → `bun scripts/co-consult/hwpx-generate.ts <draft.md> <output.hwpx>`, then `hwpx-validate` (must report "All schema validations passed").
   - `.docx` / `.pdf` (internal/client review) → `bun scripts/co-consult/md-to-report.ts <draft.md>` (LibreOffice-backed PDF).
   - The submission format is whatever the sample specifies — do not substitute.
4. Max 2 revision cycles before PM escalation.

## Writing Principles (preserved)

1. **No placeholder leftovers** — every guideline/example block in the sample must become real narrative.
2. **Expand through argument density, not appendices** — meet page targets by deepening tables/charts/interpretation, never by padding with raw source documents.
3. **Table-to-narrative ratio** — every table earns at least half a page of interpretation.
4. **DART fallback** — explicitly label company-provided unofficial materials.
5. **Client-data handling** — drafts contain financials and PII; review for sensitive data before any `git add`/commit.
6. **File naming** — `{company}-{report-type}-{YYYY-MM-DD}_ko.md` (draft) → final format per sample, in `deliverables/reports/`.

## Output Format

- **Writing Spec** (`memory/<engagement>-writing-spec-<date>.md`) — TOC + per-section table/chart flags + page budget + placeholder-slot list
- Full deliverable draft (Markdown, chapter order matching the Writing Spec exactly)
- Chapter-by-chapter page count vs. target
- Final deliverable in the sample's specified format (`.hwpx` / `.docx` / `.pdf`), validated
- `memory/YYYY-MM-DD.md` engagement summary entry

## Related Skills

- `consulting-report-writing` — prerequisite; general report-writing standards
- `hwp-document-processing` — sample ingestion (`.hwp` / `.hwpx`) and structural / placeholder / page-count validation
- `k-dart`, `financial-statement-analysis` — financial research inputs (with DART-fallback procedure)
- `k-law` — legal / regulatory research input
- `company-intelligence`, `competitive-intelligence` — company / industry research inputs
- `insight-synthesis` — cross-source synthesis for narrative chapters
