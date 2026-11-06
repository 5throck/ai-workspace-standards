# Design: co-work deck-pipeline hardening (bidirectional SSOT diff, entity decode, preview underlay, notes parity, composition patterns)

**Date**: 2026-11-06
**Status**: implemented
**Scope**: `templates/co-work/scripts/deck/svg-check.ts` (+ golden tests), `templates/co-work/scripts/co-work/SCRIPTS.md`, `templates/co-work/skills/pptx-export/`, `templates/co-work/skills/svg-slide-authoring/` (+ the platform mirrors under `templates/co-work/.claude|.gemini|.agents|.codex|.hermes/skills/` and the two SKILLS.md registries)
**Relation to prior spec**: extends `docs/designs/2026-11-03-co-work-native-pptx-deck-design.md` (canonical SVG language, quality gate, exporter). That spec introduced the content-SSOT text-run diff; this batch fixes its verified blind spots from the Nov 5–6 deck sessions and codifies the layout practice proven in the v2.0 rebuild (22 pages + 100-slide intent table).

## Context

Five verified lessons from the Nov 5–6 deck sessions (reproduced against the template-managed files before designing):

1. **S11 one-directional diff**: `svg-check.ts` verifies every SVG text run is a substring of `deck_content.md` (SVG ⊆ SSOT). A stale SVG footnote that was a **substring of a longer, updated SSOT run** passed the gate while the page rendered outdated text. The gate literally cannot see SSOT text that never made it onto a page.
2. **Entity asymmetry**: pages using a bare `&` in text (`P&L`, `Q&A`) pass the gate — the tokenizer compares raw source — but **abort resvg preview rendering** (bare `&` is not well-formed XML). Escaping to `&amp;` fixes resvg but then **fails the gate** (raw-text comparison against the plain-text SSOT). Authors are forced into the spelling that breaks previews.
3. **White-underlay preview gap**: pages without a full-bleed background rect render with a transparent backdrop (black in most viewers). The Nov-5 build worked around this with an undocumented manual temp-copy underlay; the Nov-6 judge round failed 12/13 pages on it. The method exists only in one session's history — nowhere in the template.
4. **Notes-stem mismatch**: 3 speaker-note files (`notes/*.md`) had stems that matched no page SVG stem; `svg-to-pptx.ts` silently skipped them (notes are matched by stem). Nothing in the pipeline catches the mismatch before export.
5. **Layout practice proven but not codified**: the v2.0 rebuild (22 pages, 100-slide intent table) converged on a composition system — 2-column default, punchline band, data-hook — that lives only in that deck, not in the authoring skill.

All five are pipeline-correctness or knowledge-codification defects, not one-off authoring mistakes — they will recur on the next deck unless the template carries the fix.

### Lesson → decision traceability

| Lesson | Decision | Artifact(s) | Test pin |
|--------|----------|-------------|----------|
| 1. S11 one-directional diff | D2 bidirectional diff | svg-check.ts reverse block + `unrendered_runs` | T2 (+ manual stale-substring repro) |
| 2. Entity asymmetry | D1 entity decode; D5 escaped-spelling guidance | svg-check.ts `decodeXmlEntities`; authoring skill Text row | T1 (escaped) + T3 (bare, backward compat) |
| 3. White-underlay gap | D3 underlay procedure + SHOULD full-bleed rect | pptx-export step 4; authoring skill "Full-bleed background rect" | (procedure — exercised by the visual-judge flow, no unit pin) |
| 4. Notes-stem mismatch | D4 parity checklist | pptx-export Pre-Export Checklist step 2 | (procedure) |
| 5. Uncodified layout practice | D5 composition patterns | svg-slide-authoring "Composition Patterns" | (authoring guidance) |



## Decisions

### D1 (R1) — Entity decode in text-run extraction

`svg-check.ts` decodes the five XML built-in entities (`&amp;`→`&`, `&lt;`→`<`, `&gt;`→`>`, `&quot;`→`"`, `&apos;`→`'`) in extracted text runs **before** the SSOT diff. Concretely: decode inside `nodeText()` (the run extractor), so `PageReport.text_runs` and the forward diff both operate on decoded text.

- **Single-pass replace** (`/&(amp|lt|gt|quot|apos);/g`) — replacements are never re-scanned, so `&amp;lt;` correctly decodes to the literal text `&lt;` (standard XML semantics). Each raw text segment decodes exactly once (parent `text` nodes and child `tspan` nodes own disjoint segments).
- **SSOT side is NOT decoded** — `deck_content.md` stays plain text by contract; decoding it would corrupt SSOTs that legitimately contain the literal characters `&amp;`.
- **Backward compatible**: bare-`&` pages still pass (decoding is a no-op on text without entities), so no shipped deck re-gates into failure. Pinned by T3.
- Observable contract change: `text_runs` in the JSON report are now decoded (they report what the renderer will draw, not the source spelling). The `<desc>` JSON payloads of `data-native` blocks are intentionally untouched — they are machine data, not visible runs.

### D2 (R2) — Bidirectional diff: unrendered SSOT runs as a WARNING

After the existing SVG ⊆ SSOT check, the reverse direction runs: contract runs that **no page renders** are reported per page as `W-CONTENT-UNRENDERED` (warning, run preview in the message) and the final-gate JSON gains `content_diff.unrendered_runs` (count) so the exporter/skill can surface it.

- **Warnings only, deliberately** — punchlines, section hints, and presenter cues may legitimately lag the SSOT without being defects. The gate verdict is unchanged: warnings pass; the exporter (`verifyReportAgainstDeck`) still refuses only on errors.
- **Escalation path**: the JSON count makes a future major bump mechanical — a locked-deck mode could promote the count > 0 to a blocking error. Not done here (minor bump discipline).
- **Matching semantics** (the reverse direction must not cry wolf — the shipped fixture deck itself proves the naive form wrong):
  - The contract is sectioned by `## Page <n>` headings (`parseContractSections`); each non-empty section line is a run candidate. Contracts **without** page headings (free-form decks, most tests) skip the reverse direction entirely — the forward check still applies.
  - **Loose normalization** (`normalizeLoose`) applies identically to both sides: `normalizeText()` plus stripping sentence punctuation `[.,:;!?"'()\[\]]` and a leading `-`/`+` list marker. Worked examples from the fixture deck: the agenda contract line `1. Revenue performance` is authored as two runs (`1` + `Revenue performance`) — the loose join `agenda 1 revenue performance 2 product milestones …` still contains it; `Sep: 5.1M` normalizes to `sep 5 1m` on both sides, so decimal punctuation cannot split a match.
  - A run counts as **rendered** if any page's runs — concatenated in document order, space-separated — contain the loose run. Concatenation tolerates split runs; matching is global across pages (a run rendered on any page is rendered), while **attribution** follows the section number: the warning lands on the page whose `data-page-number` matches the section.
  - Sections whose page is absent from the deck are **skipped** — a missing page is a deck-completeness concern, not text drift; warning about it on every partial-authoring deck would erode trust. This is what keeps the existing "content drift blocks" test (pages 1 + 3 against a 2-section contract) noise-free. `PageReport` gains an optional `page_number` for the attribution (parse-failure pages carry no number; the missing attribute is already an E-MARKER error).
- Deduplication is not applied: a repeated unrendered contract line warns once per occurrence (rare, and repetition is itself a signal).

**Alternatives considered and rejected**: (a) exact per-run equality — false-warns on every legitimately split run (the fixture agenda); (b) token-multiset matching — would also fire on the S11 case but buries the signal in token noise and cannot show a meaningful run preview; (c) promoting to error now — breaks the punchline-lag legitimate case and is a major-bump decision, documented as escalation instead.

**The S11 scenario, end to end (the case D2 exists for)**:

1. Content contract (SSOT) footnote is updated upstream: `Q3 revenue grew quarter over quarter` → `Q3 revenue grew quarter over quarter, driven by enterprise expansion`.
2. The page SVG still carries the old footnote. Forward check: old run is a **substring** of the new run, so `contract.includes(run)` holds — the v1.4.0 gate passes and the deck ships with stale text.
3. v1.5.0 reverse check: the updated run is **not contained** in any page's run join → `W-CONTENT-UNRENDERED` on that page with the updated text as the preview, `unrendered_runs: 1` in the JSON. Verified manually against this exact repro before the tests were written.

### Gate output (JSON shape, v1.5.0)

```json
{
  "stage": "final",
  "pages": [
    {
      "file": "01-data.svg",
      "page_number": 1,
      "errors": [],
      "warnings": [
        { "rule": "W-CONTENT-UNRENDERED", "message": "contract run not rendered by any page: \"Q3 revenue grew quarter over quarter driven by enterprise expansion\" — update the page or the content contract (advisory; ...)" }
      ],
      "text_runs": ["Q3 revenue grew quarter over quarter"]
    }
  ],
  "summary": { "pages": 1, "errors": 0, "warnings": 1 },
  "content_diff": { "unmatched_runs": [], "unrendered_runs": 1 },
  "fingerprint": "sha256:…",
  "generated_at": "2026-11-06T…"
}
```

Exit code semantics unchanged: `process.exit(summary.errors > 0 ? 1 : 0)` — the count is surfaced, never blocking at this severity.

## Compatibility and degradation

- **JSON consumers**: `content_diff.unrendered_runs` and `PageReport.page_number` are additive; `svg-to-pptx.ts` reads only `stage`, `summary.errors`, and the fingerprint — no exporter change required (verified: all compile/refusal tests pass untouched).
- **Contract formats**: contracts without `## Page <n>` headings degrade gracefully (reverse direction skipped); contracts whose sections number pages that don't exist yet are skipped per section; page numbers are matched against `data-page-number` (not filename stems), so renumbered filenames do not misattribute warnings.
- **Human output**: the CLI's plain-text mode prints `W-CONTENT-UNRENDERED` through the existing warning loop (`[<file>] warn W-CONTENT-UNRENDERED: …`) — no new output machinery.
- **Rollback**: reverting svg-check.ts to 1.4.0 restores the one-directional gate; no data or artifact migration exists (reports are per-run JSON, never persisted as state).



### D3 (R3) — Preview underlay codification (white-backdrop render method)

The undocumented Nov-5 temp-copy underlay becomes the **REQUIRED preview procedure**, documented in the `pptx-export` skill:

1. Write a **temp sanitized copy** of each page SVG: escape bare `&` → `&amp;` (`&` not already opening one of the five named entities or a numeric reference) — resvg aborts on bare ampersands.
2. If the page lacks a full-bleed background rect, inject `<rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/>` as the root's first child (z-order: bottom).
3. Render from the temp copy (`svg-to-pptx.ts --deck <temp-dir> --render-png --png-dir <deck-dir>/previews` — PNG stems match page stems, so previews land in the canonical location); **discard** the temp copy — never re-gate against it (it is a render input, not an artifact; the fingerprint continues to cover the authored bytes).

The `svg-slide-authoring` skill gains the matching authoring guidance: **new pages SHOULD include a full-bleed background rect** (the locked `background` token) as their first block child; legacy pages are exempt — the exported master carries white, so the PPTX itself is never transparent. This makes the manual method obsolete for new work while keeping the procedure for legacy pages.

### D4 (R4) — Notes-stem parity checklist

The `pptx-export` skill gains a **Pre-Export Checklist** section whose step 2 requires: every `notes/*.md` stem must match a page SVG stem 1:1 (`01-title.svg` ↔ `01-title.md`). Mismatches are listed (diff `ls notes/` against the page list) and the files renamed **before** export — the exporter's silent stem-match skip becomes visible upstream instead of discovered as missing speaker notes in the delivered deck. The same checklist step 3 wires in D2: read `content_diff.unrendered_runs` from the final report and review each warning against deck intent before delivery. (Exporter code unchanged; this is procedure, per the scope boundary below.)

### D5 (R5) — v2.0 composition patterns in the authoring skill

`svg-slide-authoring` gains a **Composition patterns** section codifying the v2.0 practice:

- **2-column default** for content slides: left text ≈55% / right visual ≈45% of the 1280px canvas (≈ x=80..690 text, x=720..1200 visual), with a documented exceptions table: full-width `title`/`agenda`/`divider`/`closing` roles, data-hero pages (single oversized stat), punchline bands, and native-table pages (`data-native="table"` wants the full canvas width).
- **Punchline band**: a full-width statement band (locked accent/primary surface, one short bold line) for single-takeaway divider/takeaway pages; the band is the focal point.
- **Data-hook**: an oversized stat (72px class) as the page focal point with the supporting sentence subordinate — "every slide needs one focal point" (existing discipline item 3) made concrete for data pages.
- Worked references point at the shipped v2.0 deck's `previews/` renders (22 rebuilt pages, Nov 2026) — cited by pattern name; **no new example assets are added to the template**.
- Entity spelling guidance (pairs with D1, added to the Text whitelist row): text SHOULD use escaped entities (`&amp;` etc.) — required for resvg previews; the gate accepts either spelling since svg-check v1.5.0.

## Implementation map

| Item | File | Change |
|------|------|--------|
| R1 | `scripts/deck/svg-check.ts` | `decodeXmlEntities()` + `XML_ENTITIES` map; applied in `nodeText()` |
| R2 | `scripts/deck/svg-check.ts` | `normalizeLoose()`, `parseContractSections()` (exported for tests), `PageReport.page_number?`, reverse-diff block in `runCheck()`, `content_diff.unrendered_runs`, `W-CONTENT-UNRENDERED` rule |
| R3+R4 | `skills/pptx-export/SKILL.md` | new **Pre-Export Checklist** section; Execution Steps step 4 rewritten as the REQUIRED white-underlay procedure |
| R5 | `skills/svg-slide-authoring/SKILL.md` | new **Composition Patterns** section; entity-spelling note in the Text whitelist row; full-bleed background guidance |
| registry | `scripts/co-work/SCRIPTS.md`, `skills/SKILLS.md` (template + root catalog) | version/status rows re-pinned to frontmatter |
| tests | `scripts/deck/tests/deck-golden.test.ts` | T1/T2/T3 (below) |
| mirrors | `templates/co-work/.{claude,gemini,agents,codex,hermes}/skills/<name>/` | byte-copies of the two SSOT SKILL.md files |

## Explicitly out of scope (documented follow-ups)

- **SVG language whitelist expansion** (a charts vocabulary beyond `data-native` bar/line/pie): separate design; the composition patterns reference existing whitelisted constructs only.
- **Exporter sections/notesSlides API changes** (e.g. refusing on notes-stem mismatch, or emitting per-section layouts): `svg-to-pptx.ts` is unchanged in this batch; D4 handles the failure mode procedurally at the skill layer.
- **Promoting `W-CONTENT-UNRENDERED` to an error** for locked decks: documented escalation path via `content_diff.unrendered_runs`; requires a major version bump and a locked-deck mode decision.
- **`svg-quality-gate` SKILL.md**: its JSON sample (`"content_diff": { "unmatched_runs": [] }`) remains a true subset of the v1.5.0 output (additive field), so no edit is required; the gate skill's severity table already treats warnings as non-blocking.

## Test plan

New tests in `templates/co-work/scripts/deck/tests/deck-golden.test.ts` (fixtures built in-test per the existing `makeDeck` pattern; the shipped `fixtures/sample-business-report` is untouched — the SSOT-only run of T2 lives only in the test's own temp fixture):

- **T1 (entity decode)**: a page whose text run carries `P&amp;L review ahead` (+ a `&quot;` run) against a plain-text SSOT (`P&L review ahead`, `"scale"`) — forward diff passes with 0 errors, and the reported `text_runs` contain the decoded spelling.
- **T2 (bidirectional, in-test fixture only)**: an SSOT-only run (present under `## Page 1` in the contract, absent from every page) produces `W-CONTENT-UNRENDERED` on that page, appears in `content_diff.unrendered_runs` (count 1), and the gate still passes (`summary.errors === 0` — warnings pass).
- **T3 (backward compat)**: a bare-`&` page (`P&L review ahead`, unescaped) still passes with 0 errors and an empty `unmatched_runs`.
- Existing golden tests stay green — notably the clean-deck test (no new warnings on fully rendered decks), the content-drift test (partial decks: sections without a matching page are skipped, so no new noise), and the fixture-compile pins (compile path untouched).
- Fixture-level sanity (manual, pre-implementation): `runCheck` over `fixtures/sample-business-report` (6 pages, agenda splits, decimal stats) reports 0 errors / 0 warnings / `unrendered_runs: 0` — the loose-matching semantics produce no false positives on the shipped fixture; and a stale-substring repro (page run `Q3 revenue grew quarter over quarter` vs updated contract `…, driven by enterprise expansion`) passes the forward check but fires exactly one `W-CONTENT-UNRENDERED` with the updated run as preview.

Verification gates: `bun test ./templates/co-work/scripts/deck/tests/deck-golden.test.ts`; `bun run test:unit` (workspace); `bun scripts/validate-templates.ts`; `bun scripts/lifecycle-sync-audit.ts`; `bun scripts/generate-skill-graph.ts` (root document layer); `bun scripts/audit.ts`.

## Versioning

- `svg-check.ts` 1.4.0 → **1.5.0** (minor: new warning rule + additive JSON fields + decoded `text_runs`); registry row updated in `templates/co-work/scripts/co-work/SCRIPTS.md`. Not listed in the workspace-root `docs/VERSION_MANIFEST.md` (template-local scripts follow the co-deck convention — SCRIPTS.md is the variant-local registry).
- `pptx-export` SKILL.md 1.3.0 → **1.4.0** (preview procedure + notes parity), `last_reviewed: 2026-11-06`.
- `svg-slide-authoring` SKILL.md 1.4.0 → **1.5.0** (composition patterns + entity guidance + full-bleed background recommendation), `last_reviewed: 2026-11-06`.
- Platform mirrors (`templates/co-work/.{claude,gemini,agents,codex,hermes}/skills/<name>/`) re-synced byte-identically via `bun scripts/sync-skills.ts --dir templates/co-work` (variant-mirror-parity requires the mirror version to equal the SSOT version).
- SKILLS.md registry rows updated in both surfaces that pin frontmatter values: `templates/co-work/skills/SKILLS.md` (version + last_reviewed) and the root `skills/SKILLS.md` Variant-Exclusive catalog (version + last_reviewed) — enforced by `tests/unit/variant-skills-registry.test.ts` and the W5 registry-sync test. (Found the hard way during verification: bumping a variant skill's frontmatter without these rows fails three unit suites.)
- Skill graphs: `templates/co-work/docs/skill-graph.json` needs no regeneration (its nodes are `(id, type, layer)` only); the workspace-root `docs/skill-graph.json`/`.md` document layer pins each skill's `version` + `content_hash`, so it was regenerated (`bun scripts/generate-skill-graph.ts`) — diff is exactly the two skills' version/hash rows; the audit's skill-graph drift gate passes on the regenerated projection.
- CHANGELOG and memory-log entries are intentionally NOT written by this batch (PM-owned surfaces per AGENTS.md §0); the PM lands them at finalization.
