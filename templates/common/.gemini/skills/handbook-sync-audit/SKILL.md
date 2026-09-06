---
name: handbook-sync-audit
scope: common
version: 1.0.0
description: >-
  Handbook Sync Audit — verifies that generated handbooks stay aligned with
  their sources across three axes: (1) content reflection against the
  ai-workspace upstream (docs/designs, docs/adr), (2) structural linkage
  within and between handbook repositories, and (3) section-level language
  parity (ko/en/ja/es) that pinpoints exactly which sections a translation is
  missing. Responds to "audit handbook", "handbook parity check",
  "handbook sync audit", "textbook drift check".
status: active
owner: handbook-reviewer
last_reviewed: 2026-08-29
prerequisites: handbook (audits the output of the H-Stage handbook pipeline)
l2_propagate: true
---

## Context

Handbooks drift in three predictable ways: the upstream workspace gains new
concepts the handbook never mentions, handbook pages get restructured and
links break (including links between sibling handbooks), and new sections are
added to a base-language page without being translated. This skill runs one
self-contained audit script that detects all three and reports findings with
enough detail (missing section ids, unreflected source docs, broken link
targets) to investigate the cause and plan the fix.

Works on **any handbook directory** with the co-deck layout
(`<repo>/docs/**/*.html`, language variants suffixed `_en`/`_ja`/`_es`) —
both freshly generated co-deck handbooks and existing handbook repositories
such as `Handbooks/multi-agent-harness-handbook`.

## When to Use

- After generating or updating a handbook (post H-Stage verification)
- Periodic drift check against the workspace (recommended: monthly)
- User says "audit handbook", "handbook parity", "textbook drift check"

## Execution Steps

Run the audit script via bun (per ADR-0036):

```bash
# 1. Content reflection — does the handbook mention upstream workspace topics?
bun scripts/handbook/handbook-sync-audit.ts content \
  --handbook-dir <handbook>/docs \
  --workspace <ai-workspace-root> \
  [--since 2026-08-01]

# 2. Structural linkage — broken links, orphan pages, cross-handbook links
bun scripts/handbook/handbook-sync-audit.ts structure \
  --handbook-root <dir-containing-handbook-repos>

# 3. Language parity — which h2/h3 sections each translation is missing
bun scripts/handbook/handbook-sync-audit.ts parity \
  --handbook-dir <handbook>/docs

# Or all three at once (exit 1 if any FAIL finding):
bun scripts/handbook/handbook-sync-audit.ts all \
  --handbook-dir <handbook>/docs --workspace <ws> --handbook-root <root>
```

### Interpreting Results

| Mode | FAIL means | Typical cause | Typical fix |
|------|-----------|---------------|-------------|
| `content` | Workspace design docs / ADRs whose keywords the handbook never mentions | Upstream feature landed after the handbook was written | Dispatch handbook-writer (or the variant's authoring specialist) to add/refresh the relevant chapter section |
| `structure` | Broken internal links, orphan pages, dead cross-handbook links | Pages renamed/moved without link updates; new page never linked from index | Fix hrefs; link the orphan from index.html/nav |
| `parity` | Sections present in the base page but missing from `_en`/`_ja`/`_es` | Content added to base page only | Translate the missing section into each variant, mirroring heading ids |

### Finding → Fix Loop

1. Run the audit and capture the findings list.
2. For each finding, investigate the cause (when was the source added? was the
   page moved? is the translation pending?) and record it in the fix commit.
3. Apply fixes (docs-writer / handbook-writer territory), then re-run until
   the audit reports PASS.

## Output Format

The script prints a per-mode report and exits 0 (PASS) or 1 (findings exist):

```
═══ <mode> audit — <description> ═══
handbook docs: <path>
...per-item findings (missing sections with #ids, unreflected source docs,
broken link targets)...
result: PASS | FAIL (findings above — investigate causes, then resolve)
```

When dispatching handbook-writer after an audit, include the captured findings
block verbatim — the `#section-id` and source-doc references are the fix plan.

## Related Skills

- `handbook` — H-Stage generation pipeline this skill audits
- `validate-docs-links` (workspace) — markdown link validation for workspace docs
- `project-review` — broader multi-agent project review that can include handbook output

## Notes

- The `content` mode uses keyword-quorum matching (≥2 slug keywords of a
  source doc must appear in the handbook text) — it is a drift detector, not
  a semantic proof. Review its misses before acting: a keyword hit on a
  generic term can be a false negative trigger for investigation.
- `parity` compares heading **ids**; renaming a section id counts as a parity
  finding for the other languages. Keep ids stable across languages.
- Exit code 1 = findings exist; CI can wire this script as a scheduled gate.
