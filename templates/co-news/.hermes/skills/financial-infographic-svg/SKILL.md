---
name: financial-infographic-svg
scope: co-news
description: >
  Guides visual-editor through turning a financial-narrative-brief's
  structured data into inline SVG for readers who benefit from visualizing
  complex financial concepts (capital structure changes, ownership
  timelines, YoY comparisons) rather than parsing prose alone. Use when:
  Phase 5, after the reporter's draft and financial-analyst's brief both
  exist.
version: 1.0.1
last_reviewed: 2026-08-24
status: active
owner: visual-editor
prerequisites: financial-narrative-brief
---

## Context

This skill turns a `financial-narrative-brief`'s structured data into inline SVG for readers who benefit from visualizing complex financial concepts — capital structure changes, ownership timelines, YoY comparisons — rather than parsing prose alone.

## When to Use

- Phase 5, after the reporter's draft and financial-analyst's brief both exist

## Execution Steps

1. **Identify Genuinely Visual Concepts**: Identify which concepts from the brief are genuinely clearer as a visual — don't force a chart where prose suffices.

2. **Select Chart Form by Data Shape**: Waterfall for capital-structure changes, timeline for a sequence of disclosures/events, simple bar or line for period-over-period comparisons — avoid over-decorated infographics.

3. **Generate Clean Inline SVG**: Generate inline SVG using clean, workspace-neutral styling — consistent stroke widths, accessible contrast, no unnecessary chrome.

4. **Use Correct Korean Number Formatting**: When the article is in Korean, apply Korean numeral groupings (jo/eok/man scale — scale definitions and conversion rules follow the common `i18n-formatting` skill, constitution §4.4 i18n asset suite) rather than raw Western thousand-separated notation (e.g. "1.25 jo KRW" expressed in jo/eok units, not "KRW 1,250,000,000,000"); never mix grouping conventions within a single figure.

5. **Save and Reference**: Save each figure to `deliverables/drafts/<article>/figures/<figure-name>.svg` and reference it from the article draft with a caption.

## Output Format

- One or more `.svg` files
- A short caption line per figure suitable for inline placement in the article

## Related Skills

- financial-narrative-brief
