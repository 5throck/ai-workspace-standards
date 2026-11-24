# Conflict adjudication analysis: co-deck (T-20261124-010) and co-architect (T-20261125-001)

- **Date**: 2026-11-25
- **Author**: Template Architect (read-only analysis, Design Gate Row 0 companion)
- **Procedure of record**: `docs/designs/2026-10-27-sync-overwrite-policy-design.md` section 6 (adjudicated port)
- **Tickets**: T-20261124-010 (co-deck), T-20261125-001 (co-architect)

## 1. Conclusion

Seventeen of the eighteen blocked files lose nothing when the project takes the template copy: fourteen are `TEMPLATE_SUPERSET` and two carry only superseded lines plus `LOCAL-PATCH` markers whose tickets are all closed. One file, `gen-slides-pdf-render.test.ts`, is a real `TRUE_DIVERGENCE` (the template rewrote the project's pins under new titles). No file is `PROJECT_SUPERSET`, so no template-side port is required for either project. The engine still reports every file `CONFLICT` because its test is baseline-based, so each adoption needs one explicit `--disposition adopt-template` with owner sign-off (see the companion design, section 4.8).

## 2. Method

- **B (last-delivered baseline)**: the `baselines[path].hash` value in `Projects/<p>/.claude/last-upgrade-delivery.json`, matched byte-for-byte against every blob in the project's `git log -- <path>`.
- **P**: the copy on `main` (both projects clean, on `main`, at analysis time).
- **T**: `templates/co-deck/...` for variant files, `templates/common/...` for `scripts/lib/external-deps.ts` and `scripts/validate-templates.ts`.
- **Classification rule**: `TEMPLATE_SUPERSET` when no line P added over B is missing from T; `PROJECT_SUPERSET` when no line T added over B is missing from P; otherwise `TRUE_DIVERGENCE`.
- **Tooling note**: counts come from an in-memory line diff. The two files over 2,500 lines (`gen-slides-pdf.ts`, `validate-templates.ts`) used a diff mode that drops very frequent lines, so their B-relative counts are approximate; their direct P-versus-T hunks were re-read without that mode.
- **Path correction**: the co-deck tests live at `scripts/co-deck/tests/<name>` in both the project and the template, not at `tests/<name>`.

## 3. Summary table

"P-only" counts lines P added over B that T does not carry. "T-only" counts lines T added over B that P does not carry.

| # | Project / file | Class | P-only | T-only | Open LOCAL-PATCH tickets | V/U |
|---|---|---|---|---|---|---|
| 1 | co-deck `scripts/co-deck/diagram-helpers.ts` | TEMPLATE_SUPERSET | 1 (version header) | 155 | none | V |
| 2 | co-deck `scripts/co-deck/estimate-layout.ts` | TEMPLATE_SUPERSET | 1 (version header) | 111 | none | V |
| 3 | co-deck `scripts/co-deck/gen-slides-pdf.ts` | LOCAL-PATCH | 6 superseded (section 4 note) | 78 | none (6 ids, all `done`) | V |
| 4 | co-deck `scripts/co-deck/gen-visual-images.ts` | TEMPLATE_SUPERSET | 3 (2 header, 1 import) | 14 | none | V |
| 5 | co-deck `scripts/co-deck/validate-image-manifest.ts` | TEMPLATE_SUPERSET | 15 superseded | 89 | none (U-20261114-005 `done`) | V |
| 6 | co-deck `scripts/lib/external-deps.ts` | TEMPLATE_SUPERSET | 1 (reworded comment) | 147 | none | V |
| 7 | co-deck `scripts/validate-templates.ts` | LOCAL-PATCH | 1 (marker comment) | 815 (approx.) | none (U-20261111-001 `done`) | V |
| 8 | co-deck `scripts/co-deck/tests/estimate-layout-lint.test.ts` | TEMPLATE_SUPERSET | 1 (version header) | 92 | none | V |
| 9 | co-deck `scripts/co-deck/tests/gen-slides-pdf-render.test.ts` | TRUE_DIVERGENCE | 136 | 338 | none | V (counts), U (section 4) |
| 10 | co-deck `scripts/co-deck/tests/validate-image-manifest.test.ts` | TEMPLATE_SUPERSET | 1 (version header) | 74 | none | V |
| 11 | co-deck `scripts/co-deck/tests/ppt-engine-integration.browser.mjs` | TEMPLATE_SUPERSET | 0 | 1 | none | V |
| 12 | co-deck `scripts/co-deck/tests/diagram-helpers.test.ts` | TEMPLATE_SUPERSET | 3 (header comment) | 101 | none | V (direct P vs T), U (B) |
| 13 | co-architect `agents/mep-engineer.md` | TEMPLATE_SUPERSET | 0 | 0 | none | V |
| 14 | co-architect `agents/drafting-architect.md` | TEMPLATE_SUPERSET | 0 | 0 | none | V |
| 15 | co-architect `agents/bylaw-expert.md` | TEMPLATE_SUPERSET | 0 | 0 | none | V |
| 16 | co-architect `agents/visualization-expert.md` | TEMPLATE_SUPERSET | 0 | 0 | none | V |
| 17 | co-architect `agents/interior-designer.md` | TEMPLATE_SUPERSET | 0 | 0 | none | V |
| 18 | co-architect `agents/structural-engineer.md` | TEMPLATE_SUPERSET | 0 | 0 | none | V |

### 3.1 Baseline recovery

- co-deck, rows 1 to 11: B recovered from a committed project blob for every file (V). Examples: `302217b` (0.29.0 to 0.30.0 delivery) for rows 1 and 9, `a736430` (0.30.x sync) for rows 2, 4, 6, 7, `58104ca` (0.25.0 delivery) for rows 5, 8, 10, 11, `e486fa8` (0.30.0 wave, 2026-11-19) for row 3.
- co-deck, row 12: B not recovered. The recorded baseline hash equals the current template content (it matches a root-revision blob), while the project copy has been 117 lines at 1.0.0 since `302217b`. P was compared against T directly.
- co-architect, rows 13 to 18: B not recovered. The engine keys agent baselines on lifecycle-stripped text (`scripts/lib/upgrade-policy.ts:1779-1782`), so no raw blob in the project or root history matches. P was compared against T directly.

### 3.2 LOCAL-PATCH markers (every marker ticket)

| File | Markers in P | Markers in T | Ticket ids (same set on both sides) | Status |
|---|---|---|---|---|
| `gen-slides-pdf.ts` | 54 | 67 | U-20261105-002, U-20261105-005, U-20261114-008, U-20261114-011, U-20261119-007, U-20261119-010 | all `done` |
| `validate-image-manifest.ts` | 1 | 1 | U-20261114-005 | `done` |
| `validate-templates.ts` | 1 | 0 | U-20261111-001 | `done`; T carries the behavior without the marker |

No marker ticket is still open (V: ticket files read under `tickets/governance/` and `tickets/governance/archive/`). Adopting T keeps every marker id the project carries, and adds markers.

### 3.3 The six co-architect agents

Each project copy differs from the template by exactly one line, the frontmatter `version:` (1.0.1 in the project, 1.0.2 in the template). There is no substantive difference and no delivered-block bookkeeping difference (V). The project's last change to these files is `a4fe14c` (2026-11-16), which removed one dependency line; the template carries the same removal.

## 4. TRUE_DIVERGENCE: `scripts/co-deck/tests/gen-slides-pdf-render.test.ts`

- P-only (1.8.0, project): the original U-20261119-007 pins written on the project side (commit `10d74bb`, 2026-11-19): 14 test or describe titles with no verbatim counterpart in T, including "defect premise: premium-dark card_dark [11,15,25]", "premium-dark cover: the title renders white on the bubble", "the hug card spans exactly the text column".
- T-only (1.9.0, template): the batch-2 rewrite of the same U-20261119-007 pins under new titles (23 titles, for example "cover title: no ink equals the card fill; title renders white on the dark bubble") plus the U-20261119-010 framed-parity pins.
- Reading (U, judgment not proven by diff): T looks like a rewrite of P's pins, not a loss. P has 41 `test(` calls and T has 43; T carries 5 more `skipIf(` guards than P (34 against 29), so T skips more cases when fonts or `pdftoppm` are absent.
- Required before adoption: a person maps the 14 P titles to T titles and records the mapping in the sign-off.

Note on row 3 (`gen-slides-pdf.ts`), classified `LOCAL-PATCH`: the 6 P-only lines are the 1.15.0 header line and 5 code lines where P still uses the `colors.C_DARK` constant and T uses `readableTextOn(colors.C_CARD)`, the fix of U-20261119-007 (`done`). Every other P-only hunk is the same comment text, wrapped and prefixed with a marker in T.

Note on row 5 (`validate-image-manifest.ts`): the 15 P-only lines are the 1.5.0 header and the older, shorter forms of `resolveAssetPath` and `checkPoolPathStyle`. T's `resolveAssetPath` keeps the `../` branch and adds `./`; both sides carry 2 `win32` occurrences (V).

## 5. Verifier evidence

- `bun scripts/verify-delivered-versions.ts --project Projects/co-deck --template templates/co-deck` reports 10 `[stale]` rows and exit 1 (V). All 10 are engine-preserved conflicts, reported as plain STALE. The ticket says 9; the tenth is row 12. The two common-sourced scripts (rows 6, 7) are not reported at all.
- The same command on co-architect reports "7 path(s) checked ... clean" while six agents are `CONFLICT` (V). The verifier does not sweep agents.

## 6. Recommended order of resolution

Each step adopts the template copy with an explicit adopt grant. The dry-run must show `ADOPT` for the named paths and nothing else.

| Step | Files | Risk | Why this position |
|---|---|---|---|
| 1 | co-architect rows 13 to 18 | Very low | Bodies are byte-equal to T; only the version line changes. Unblocks the 12 ready update rows. |
| 2 | co-deck rows 11, 12, 8, 10 | Low | Tests and a browser harness; P-only lines are header comments. Run the delivered tests after adoption. |
| 3 | co-deck rows 1, 2, 4 | Low | Template additions (layout-safety audit, meta-wording gate); P adds only header lines. `gen-visual-images.ts` starts to import `svgLayoutSafetyIssues`, so row 1 must land in the same change. |
| 4 | co-deck rows 7, 6 | Low to medium | Common scripts. Row 7 drops a marker whose ticket is closed. Row 6 lets `external-deps.json` accept `market_scope`, which unblocks the delivered `humanize-adapter.ts` entry. Both scripts run in every project pass. |
| 5 | co-deck row 3 | Medium | 3,400-line generator. T carries all 6 marker ids. The 1.9.0 render tests in row 9 pin T's behavior, so row 3 and row 9 must land together. |
| 6 | co-deck rows 9, 5 | Medium | Row 9 needs the title mapping in section 4. Row 5 is a blocking validator; run the project's decks through it before recording success. |

No step writes to the template, so the section 6 hash table reduces to recording the template and project SHA-256 values in the sign-off and re-checking them after the wave.

## 7. Not verified

- The template lineage of T for rows 3, 5 and 9 (whether T was ported from P or re-authored) was inferred from content, not from the port records.
- Row 12: why the recorded baseline equals the template content while the project copy is older.
- co-architect: which lifecycle-stripped difference makes the engine call the copies project-evolved.
