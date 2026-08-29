---
name: financial-journalism-style
scope: co-news
description: >
  Guides style-editor (and reporter during drafting) through house-style
  conventions for Korean business/finance journalism, drawing on general
  conventions associated with Sedaily (general economic-daily
  tone) and TheBell (IB/PE/capital-markets specialist tone). Default
  output language is Korean; non-Korean assignments use general
  business-journalism conventions instead. Use when: Phase 4, by
  style-editor on the reporter's draft; also referenced by reporter during
  Phase 3 drafting.
version: 1.0.0
last_reviewed: 2026-08-10
status: active
owner: style-editor
prerequisites: none
relates_to:
  - skill: financial-narrative-brief
    type: composes_with
  - skill: source-verification-ledger
    type: composes_with
  - skill: ai-tell-reduction
    type: composes_with
---

## Context

This is the house-style guide for Korean business/finance journalism, drawing on general conventions associated with Sedaily (general economic-daily tone, broader readership) and TheBell (IB/PE/capital-markets specialist tone, denser jargon, assumes reader sophistication).

The default output language is Korean. The assignment (set by pm in Phase 0) may specify a different target language, in which case this skill's Korean-specific phrasing templates are replaced by general business-journalism conventions for that language — the 5W1H-first lead, numbers-first headline, and source-attribution discipline still apply universally; only the specific Korean phrase templates are language-gated.

**Known limitation (resolved 2026-08-12)**: this skill was originally authored from general knowledge of Korean financial-journalism conventions — direct fetching of sedaily.com/thebell.co.kr failed during the design session. It has since been recalibrated against 3 real sample articles (2 Sedaily, 1 TheBell), each independently confirmed against a direct live-page fetch — see `references/style-examples/` for the samples and per-sample style notes. Recalibration findings folded into steps 1-5 below: Sedaily favors figure-first or record-superlative headlines with terse same-day disclosure attribution (a filing-date-anchored "the company disclosed provisional results today, stating that..." construction); TheBell favors comparative/peer-ranking framing built from a single filing and assumes market-shorthand fluency.

## When to Use

- Phase 4, by style-editor, applied to the reporter's draft
- Also referenced by the reporter during Phase 3 drafting

## Execution Steps

1. **Headline Conventions**: Lead with the number or key fact (figure-first), use an active verb, avoid clickbait phrasing.

2. **Lead Paragraph**: Cover 5W1H plus the single most important number within the first two sentences.

3. **Disclosure-Citation Phrasing (Korean mode)**: Use natural sourced-attribution phrasing (the Korean-language equivalent of English phrases like "according to the filing" or "the company said") rather than mechanical citation brackets.

4. **Register Selection**: Choose Sedaily-style (accessible, defines jargon inline) vs TheBell-style (dense, assumes IB/PE reader, uses market shorthand without explanation) based on the assignment's target audience field.

5. **Non-Korean Assignments**: Apply general wire-service business-journalism conventions instead of the Korean phrase templates in step 3 — e.g. AP/Reuters style: inverted pyramid, numbers-first lead, neutral attribution.

6. **Calibrate Against Real Samples**: Check `references/style-examples/` for real sample articles if present, and calibrate register/phrasing against them in preference to the general guidance above.

## Output Format

- The edited draft
- A short "Style Compliance Note": register chosen, language used, any deviations and why — never a silent edit

## Related Skills

- ai-tell-reduction
- financial-narrative-brief
