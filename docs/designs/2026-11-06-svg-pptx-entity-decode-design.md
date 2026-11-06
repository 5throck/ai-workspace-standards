# SVG→PPTX entity-decode parity (export leg of the authoring-hygiene migration) — design

- **Status**: implemented
- **Date**: 2026-11-06
- **Ticket**: U-20261106-002 (upstream request from co-work, suspected layer L2)
- **Related specs**: 2026-11-06-deck-pipeline-hardening-design (gate-side R1 entity decode, svg-check v1.5.0 — this design is its export-leg counterpart; that spec explicitly scoped the exporter out: "svg-to-pptx.ts is unchanged in this batch"), 2026-11-03-co-work-native-pptx-deck-design (compiler architecture)
- **Affected scripts**: `templates/co-work/scripts/deck/svg-check.ts` v1.5.0 → 1.5.1, `templates/co-work/scripts/deck/svg-to-pptx.ts` v1.4.1 → 1.4.2

## 1. Problem

The authoring-hygiene migration (gate R1, svg-check v1.5.0) lets pages spell text bare
(`P&L`) or escaped (`P&amp;`) — the gate decodes the five XML built-ins in run
extraction before the plain-text SSOT diff. The exporter leg was not given the same
treatment: `svg-to-pptx.ts` v1.4.1 consumed raw parser text (`node.text`, tspan
`.text`) and then ran DrawingML `esc()` on it, so a parser-level entity survived into
the slide XML with its `&` re-escaped.

Observed (co-work deck `gtms-startup-market-research-2026-11-05_ko`, slides 28/54):
an authored `P&amp;L` compiled to slide XML `<a:t>3년 P&amp;amp;L</a:t>` — PowerPoint
displays the literal string "P&amp;L" instead of "P&L". The gate (R1 decode) and the
resvg previews were correct; only the export leg diverged, breaking the pipeline
invariant that gate-passing pages compile to what the gate said they render.

Secondary effect: `estTextWidth` measured the raw entity spelling, over-estimating
text-box widths by the entity overhead (reproduced: 2657475 EMU vs the correct
2124075 EMU for a 24px "P&L review ahead" run — a 533400 EMU over-size).

## 2. Root cause

`parseSvg()` stores text chunks verbatim (parser-level entities undecoded) — correct
for a gate that must see authored bytes, and R1 deliberately confines decoding to
run extraction. The exporter reuses `parseSvg()` output but has its own extraction
surface (direct `<text>` text, tspan runs, the `nodeTextOf` nested-children fallback,
and native `<desc>` JSON payloads) with no decode step before `esc()`.

## 3. Decision

1. **One decoder, both legs**: export `decodeXmlEntities` from svg-check (v1.5.1) and
   import it in the exporter (v1.4.2) rather than duplicating a second regex in the
   compiler. Single decoder = single semantics; a future entity-policy change cannot
   drift between gate and export.
2. **Decode at every extraction site, before normalize/esc**: direct `node.text`
   (svg-to-pptx.ts ~309), tspan `.text` (~317), the nested-children fallback
   `nodeTextOf` (~365), and native `<desc>` payloads before `JSON.parse` (~211).
3. **Single-pass decode** per XML semantics (`&amp;lt;` → literal `&lt;`) — the
   shared function already guarantees this; pinned by test U1.
4. **Measurement parity**: box sizing (`estTextWidth` via `longest.text`) consumes
   the already-decoded paragraph strings, so entity overhead no longer inflates box
   widths. Verified: authored-entity and bare-& pages produce identical box geometry.
5. **Invariance property**: authored `P&amp;L` and bare `P&L` both compile to slide
   XML `P&amp;L` (exactly one escape level), matching gate R1's "both match the
   plain-text contract" semantics on the export side.

## 4. Tests (scripts/deck/tests/deck-golden.test.ts, offline)

- v1.5.1 U1: `decodeXmlEntities` single-pass semantics (`&amp;lt;` → `&lt;`, not `<`;
  bare `&` passthrough; non-built-in `&unknown;` verbatim; all five built-ins).
- v1.4.2 pin: authored entities on all five built-ins across direct-text, tspan, and
  native-table desc-payload paths compile to exactly one escape level; no
  `&amp;(amp|lt|gt|quot|apos);` anywhere in the part; decode-once over every `a:t`.
- v1.4.2 pin: bare-`&` page compiles identically to the escaped spelling.
- v1.4.2 pin: nested-tspan fallback (outer tspan with no own text) decodes —
  `nodeTextOf` parity with the gate's `nodeText`.
- v1.4.2 pin: measurement parity — authored-entity and bare-& boxes are identical and
  equal the decoded-run expectation (and differ from the raw-entity expectation, so a
  regression to raw measurement is detectable).

Reproduction evidence (pre-fix, pristine origin/main code under a scratch harness):
gate passed 0 errors with decoded run "P&L review ahead" while slide XML carried
`<a:t>P&amp;amp;L review ahead</a:t>` and the box was 533400 EMU over-sized.

## 5. Non-goals / out of scope

- No gate behavior change in svg-check v1.5.1 (export-only of an existing function).
- Named entities beyond the five XML built-ins, numeric character references
  (`&#38;`), and CDATA remain out of the canonical contract (gate rejects or leaves
  them verbatim; unchanged here).
- The content SSOT stays plain text; no decode is applied to contract lines.
