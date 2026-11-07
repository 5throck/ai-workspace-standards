---
name: pptx-export
description: >
  PPTX export chain for canonical SVG decks: fingerprint-verified svg_check.py
  content gate (our SSOT) → ppt-master-adapter translation → the ppt-master
  conversion chain verbatim → their delivery/OPC validation → postflight
  receipt. Use when: exporting a finished deck, interpreting the
  delivery/OPC receipts, or producing previews for visual-judge acceptance.
version: 2.0.2
last_reviewed: 2026-11-07
status: active
scope: co-work
owner: pm
prerequisites: Bun runtime (adapter), Python 3.10+ (gate and previews — svg_check.py stdlib-only, render_previews.py with resvg-py), external dependency ppt-master v6.8.0 (MIT) cloned per external-deps.json (external/ppt-master/), python venv with their install list (PyMuPDF/AGPL excluded), templates/co-work/scripts/deck/ppt-master-adapter.ts, passing final svg_check.py report
metadata:
  type: capability
  triggers:
    - export pptx
    - export deck
    - compile pptx
    - svg to pptx
    - deck postflight
---

# 🛠️ Skill: pptx-export

## Provenance and license (read first)

The conversion engine is the external dependency
**[ppt-master](https://github.com/hugohe3/ppt-master) v6.8.0 — MIT license,
Copyright hugohe3** — consumed **as-is** behind an adapter boundary
(DEC-20261106-04; design 2026-11-06-deck-emitter-ppt-master-rebase-design).
Their deterministic scripts are run verbatim and **never modified**; their
LLM/agent authoring stages are never wired. The pinned clone keeps upstream
LICENSE/copyright files intact. PyMuPDF/AGPL (their optional PDF converter)
is excluded from every install list and dependency surface. Pin and install
procedure: project `external-deps.json` (install_dir `external/ppt-master/`,
gitignored — never a deliverable/working directory), delivered and updated by
the upstream external-dependency machinery (design
2026-11-07-external-deps-machinery-design.md D2/D3; the interim project-local
fetcher `scripts/deck/fetch-ppt-master.ts` is retired). Decks built by an MIT tool
are content, not software redistribution — no per-deck notice is required.

## Context

v2.0.0 was an engine swap: the hand-rolled DrawingML compiler
(svg-to-pptx.ts) is **retired and deleted** (Phase 2, 2026-11-07) — it produced eight classes of
PowerPoint-invalid output that no local oracle predicted (no
PowerPoint-validation oracle exists in this environment; DEC-20261106-04).
The export pipeline is now: **our content gate → their chain**, with all
coupling in one adapter. Everything upstream of the emitter stays ours:
content SSOT (`deck_content.md`), authoring doctrine, the svg_check.py
fingerprint gate, previews, and delivery verification. The fingerprint
discipline is OUR internal content gate — it is not a PowerPoint-validity
claim; PowerPoint validity is carried by their validators plus the
user-side manual open.

## When to Use

- After the final `svg_check.py` gate reports zero errors on the current bytes
  (any SVG edit invalidates the fingerprint — re-run the gate first)
- Re-export after postflight-flagged fixes; refresh the fingerprint report
  each time

## Execution Steps (in order — no step may be skipped)

1. **svg_check.py gate (ours, content SSOT fingerprint)** — must be green on
   the current bytes:
   ```bash
   python3 scripts/deck/svg_check.py --deck <deck-dir> --content <deck_content.md> --stage final --json
   ```
   Any SVG edit invalidates the fingerprint; re-run the gate. Notes-stem
   parity and `content_diff.unrendered_runs` checks (v1.4.0 checklist)
   still apply before export.
2. **ppt-master-adapter (our only coupling point)** — builds their project
   layout from our deck dir and writes the run-sheet:
   ```bash
   bun scripts/deck/ppt-master-adapter.ts \
     --deck <deck-dir> \
     --ppt-master external/ppt-master \
     --out <ppt-master-project-dir> \
     [--pptx-out <final.pptx>] [--run]
   ```
   Adapter transforms (source SVGs/notes are never modified): (a) bare `&`
   escaped into a sanitized copy (their chain is strict-XML ElementTree);
   (b) pages placed identity-stem into their `svg_output/` (mapping.tsv);
   (c) our `notes/*.md` emitted as their `notes/total.md` master (`# <stem>`
   per page) for their `total_md_split.py`; (d) our native-table `<desc>`
   payloads translated into their `ppt-master.semantic-table.v2` metadata
   (row_heights, header bold, band fills, first-col bold/color derived
   deterministically from our drawn fallback shapes) + their
   `<g data-pptx-replace-with="table">` marker, plus the multi-line-cell
   projection repair (their fallback-text join is separator-free; the
   adapter inserts the boundary space in our fallback shapes so their
   checker reproduces the payload text exactly); (e) `run-chain.sh` written
   into the project dir. `--run` executes it.
3. **Their chain, verbatim** (run-sheet — do not re-order; stamp before the
   quality report so the report covers the stamped bytes):
   ```bash
   total_md_split.py  <proj>                                   # only when notes exist
   stamp_native_fallbacks.py <proj>/svg_output --write          # only when native tables exist
   svg_quality_checker.py <proj> --quick-generate --stage final --json
   finalize_svg.py <proj>
   svg_to_pptx.py <proj> --quick-generate --with-notes --primary-language ko-KR [--native-charts-and-tables] -o <final.pptx>
   ```
   `--quick-generate` is mandatory without a spec_lock.md; `--with-notes`
   is not the default; `--primary-language ko-KR` fills run proofing
   language and theme script slots (Korean decks).
4. **Their delivery + OPC validation**:
   ```bash
   pptx_delivery_check.py <final.pptx>     # must print status: passed, errors []
   opc_check.py <final.pptx>               # generated by the adapter; pptx_opc_validation library — must report 0 problems
   ```
5. **Postflight receipt** — record into the deck's `validation/`:
   delivery-receipt JSON + package verification (xmllint every part 0
   errors, python-pptx open with expected slide/notes counts, native
   tables present as `a:tbl`, entity single-escape spot checks).
   Optional openability leg (design 2026-11-07-external-deps-machinery D6;
   check_openability.py v1.1.0):
   `python3 scripts/deck/check_openability.py --pptx <final.pptx> --expect <json>`
   with an expectation file `{"slides": N, "notes": M|null, "tables": {"slideNum": n}|null}`
   — asserts the counts; graceful SKIP (exit 0, explicit `SKIP:` line) when
   python-pptx is absent, so minimal CI environments stay green. Batch mode
   (CI openability leg, 2026-11-07):
   `python3 scripts/deck/check_openability.py --batch-expect scripts/deck/openability-expectations.json`
   asserts every committed deck in one invocation (JSON object mapping deck
   paths — resolved against the CWD — to per-deck expectations); exit 0 only
   when all pass.
6. **Previews** (visual acceptance): render from **OUR SVGs** via
   `render_previews.py` — the white-underlay method, now productionized
   (v2.0.1; resvg-py engine, bun + @resvg/resvg-js fallback):
   ```bash
   python3 scripts/deck/render_previews.py --deck <deck-dir>
   ```
   Per page it makes a sanitized temp copy (bare `&` → `&amp;`), injects a
   full-bleed white underlay rect when the page lacks a background rect,
   renders `previews/NN-<slug>.png` (1280px wide), and discards the copy —
   sources are never modified. This survives from the old procedure because
   resvg renders our authored bytes, not their package. Their `svg_final/`
   previews exist in the project dir for reference only.

## Output Format

- `<final.pptx>` — natively editable DrawingML from their emitter
- delivery receipt: `status: passed`, package part counts, fonts, transitions
- OPC receipt: `relationship problems: 0`
- `previews/NN-<slug>.png` (resvg, white underlay) — visual-judge input

## Related Skills

- `svg-quality-gate` — our content SSOT gate; its final report (fingerprint)
  is this skill's mandatory input
- `svg-slide-authoring` — owns the canonical language the chain compiles

## Hard Boundaries

- **No ppt-master file is ever modified** — the clone is read-only by
  convention; all glue lives in our adapter and run-sheet.
- Only their deterministic scripts are wired; their LLM/agent authoring
  stages are never invoked.
- **PyMuPDF/AGPL is never installed** (DEC-20261106-04 condition 4).
- No export without a fingerprint-matching final svg_check.py report (our
  gate), and no delivery without their delivery check `passed` + OPC `0`.
- No page repair inside the export path; pages are fixed upstream by
  deck-builder and re-gated.
- No font embedding — PPTX references font names (Malgun Gothic declared
  in theme + runs; rendering depends on the viewer machine).
- Whole-slide screenshots / SVG-as-picture embedding are not a fallback —
  editability is the product.
- No LibreOffice / Office-tooling rendering dependency — the final
  PowerPoint-open proof remains the user-side manual open (standing
  no-Office-tooling policy, design §11.6).

## References

- Design: `docs/designs/2026-11-06-deck-emitter-ppt-master-rebase-design.md` (D1–D8)
- Decision record: `docs/decisions/DEC-20261106-04.md` (clean-room reversal, MIT posture)
- Compatibility spike: `deliverables/drafts/2026-11-05-gtms-startup-market-research/ppt-master-spike-report_ko.md` (translation rules §5)
- Superseded (scoped): compile/export tier of `docs/designs/2026-11-03-co-work-native-pptx-deck-design.md` (authoring + gate tiers remain in force)
- Upstream: https://github.com/hugohe3/ppt-master (MIT) — pin v6.8.0
- Manifest: project `external-deps.json` (install_dir `external/ppt-master/`; the interim fetcher `scripts/deck/fetch-ppt-master.ts` is retired — superseded by the upstream external-deps machinery)
- `svg-quality-gate` skill — our content SSOT gate (fingerprint; single python checker `svg_check.py` 2.1.0 since the oracle retirement)
- `svg-slide-authoring` skill — owns the canonical language
