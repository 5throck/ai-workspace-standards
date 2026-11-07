#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
@version 2.0.0
svg-check semantics suite (python-only): svg_check.py 2.1.0 pins over the real
decks, the golden fixture, and synthetic single-page fixtures.

v2.0.0 (2026-11-07): oracle retirement — the differential bun comparison legs
(svg-check.ts) are REMOVED together with svg-check.ts itself. svg_check.py is
the single checker; its semantics are pinned directly against literal expected
values. The suite keeps: the entity-decode / single-pass-decoder / S11
stale-substring / bare-`&` / blocking-vs-warning verdict pins, the real-deck
fingerprint checks (main aa3baf43…, exec cut ffa4d390…, fixture c0748b55…),
and the svg-check 2.1.0 E-heading pin. Supersedes test_svg_check_parity.py
1.1.0 (differential harness; deleted together with the oracle it compared).

History:
  v1.1.0 (2026-11-07): svg-check 2.1.0 E-heading pin — exec-cut contracts key
           on `## E01`–`## E12`, so the reverse diff (W-CONTENT-UNRENDERED)
           became ACTIVE there (inert before 2.1.0): one injected unrendered
           run under `## E07` fires exactly 1 warning on page 7 with
           unrendered_runs == 1; the REAL exec-cut contract stays at
           unrendered_runs == 0 (no false positives); exec-cut expected
           fingerprint refreshed to ffa4d390… (deck_content-exec-cut v1.1
           cold-read revision; the pre-v1.1 value a454f49a… was stale).
  v1.0.0 (2026-11-07): differential parity harness — python svg_check.py 2.0.0
           vs bun svg-check.ts 1.5.1, the Phase 2 switch criterion of design
           2026-11-06-deck-emitter-ppt-master-rebase-design (D6/§6.3). The
           switch happened; the oracle is retired.

Pinned checker semantics (originally ported from the deleted
deck-golden.test.ts; hardening spec 2026-11-06-deck-pipeline-hardening-design
R1/R2, U-20261106-002):
  - entity decode: a page spelling `P&amp;L` matches a plain-text SSOT,
  - single-pass decoder table: `&amp;lt;` → literal `&lt;`, never `<`,
  - unrendered-run warning: a stale-substring SSOT line fires
    W-CONTENT-UNRENDERED exactly once (S11 stale-substring repro) and the gate
    still passes (warnings do not block),
  - bare `&` backward compat: the unescaped spelling still matches,
  - blocking verdicts (E-COLOR / E-MARKER / E-CONTENT-DIFF) vs advisory
    warnings (W-COLOR-LOWER / W-PATH-REL),
  - svg-check 2.1.0 E-contract reverse diff (mutation pin above).

Runs under pytest (`python3 -m pytest scripts/deck/tests/test_svg_check.py`)
AND as a plain runner (`python3 scripts/deck/tests/test_svg_check.py`) when
pytest is absent.

Decks exercised:
  (a) main deck, 100 pages — deliverables/drafts/2026-11-05-gtms-startup-market-research
  (b) exec cut, 12 pages  — …/exec-cut
  (c) golden fixture deck — templates/co-work/scripts/deck/tests/fixtures/sample-business-report
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
# Context-adaptive: in a consuming PROJECT (…/Projects/<x>/scripts/deck/tests) the
# real decks live under <project>/deliverables; in the TEMPLATE checkout
# (templates/co-work/scripts/deck/tests) they do not exist and the real-deck
# tests skip (fixture + semantics pins still run everywhere).
_CANDIDATE_PROJECT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
if os.path.isdir(os.path.join(_CANDIDATE_PROJECT, "deliverables", "drafts")) and os.path.isdir(os.path.join(_CANDIDATE_PROJECT, "scripts", "deck")):
    PROJECT_ROOT: str | None = _CANDIDATE_PROJECT
    WORKSPACE_ROOT = os.path.abspath(os.path.join(PROJECT_ROOT, "..", ".."))  # …/ai_workspace
else:
    PROJECT_ROOT = None
    WORKSPACE_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))

PY_CHECKER = os.path.join(WORKSPACE_ROOT, "templates", "co-work", "scripts", "deck", "svg_check.py")

MAIN_DECK = (
    os.path.join(PROJECT_ROOT, "deliverables", "drafts", "2026-11-05-gtms-startup-market-research")
    if PROJECT_ROOT else None
)
EXEC_DECK = os.path.join(MAIN_DECK, "exec-cut") if MAIN_DECK else None
FIXTURE_DECK = os.path.join(WORKSPACE_ROOT, "templates", "co-work", "scripts", "deck", "tests", "fixtures", "sample-business-report")


class _Skip(Exception):
    pass

EXPECTED_FINGERPRINTS = {
    "main": "sha256:aa3baf43fe5ebc57a565a080f6d6a80127da1a492a3dab8a22a570f7c4fbd866",
    "exec-cut": "sha256:ffa4d390048e5c056a1c39a9718e72cf5829fc3f427ec9e1589daf26dc1e7adf",
    "fixture": "sha256:c0748b55a760b3b50514e8b3c9542b530eae2d6e9fcba1b3fc051fd5ca68bdff",
}


# ---------------------------------------------------------------------------
# Checker invocation helpers
# ---------------------------------------------------------------------------

def _run_py(deck: str, content: str | None, stage: str = "final") -> dict:
    cmd = [sys.executable, "-I", PY_CHECKER, "--deck", deck, "--stage", stage, "--json"]
    if content:
        cmd += ["--content", content]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode not in (0, 1):
        raise AssertionError(f"python checker failed (rc={proc.returncode}): {proc.stderr}")
    return json.loads(proc.stdout)


def _make_deck(pages: list[tuple[str, str]], content: str) -> tuple[str, str]:
    deck = tempfile.mkdtemp(prefix="svgcheck-deck-")
    for name, body in pages:
        with open(os.path.join(deck, name), "w", encoding="utf-8") as fh:
            fh.write(body)
    content_path = os.path.join(deck, "deck_content.md")
    with open(content_path, "w", encoding="utf-8") as fh:
        fh.write(content)
    return deck, content_path


# ---------------------------------------------------------------------------
# Golden fixture page bodies (shared by the synthetic pins)
# ---------------------------------------------------------------------------

PAGE_ENTITIES = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="80" y="120" font-size="24" fill="#202020">P&amp;L review ahead</text>
    <text x="80" y="180" font-size="18" fill="#202020">Plan for the &quot;scale&quot; phase</text>
  </g>
</svg>"""

PAGE_UNRENDERED = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="80" y="120" font-size="24" fill="#202020">Rendered headline lands on the page</text>
  </g>
</svg>"""

PAGE_BARE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="1">
  <g data-block-id="b1">
    <text x="80" y="120" font-size="24" fill="#202020">P&L review ahead</text>
  </g>
</svg>"""

PAGE_BAD = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="3">
  <g>
    <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.5)"/>
    <text x="10" y="50" font-size="18" fill="#202020">This sentence is not in the contract</text>
  </g>
</svg>"""

PAGE_LOWER_COLOR = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="title" data-page-number="1">
  <g data-block-id="b1">
    <rect x="0" y="0" width="1280" height="720" fill="#ffffff"/>
    <text x="80" y="220" font-size="48" font-weight="bold" fill="#1F3864">Quarterly Business Review</text>
  </g>
</svg>"""

PAGE_REL_PATH = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" data-slide-role="content" data-page-number="2">
  <g data-block-id="b1">
    <path d="m100 500 l300 500 C350 480 400 520 450 500 Z" fill="none" stroke="#1F3864" stroke-width="2"/>
    <text x="80" y="140" font-size="32" font-weight="bold" fill="#1F3864">Revenue grew 12 percent 2026 outlook: solid</text>
    <text x="80" y="620" font-size="20" fill="#202020">Outlook remains positive</text>
  </g>
</svg>"""

CONTENT_MD = """# Quarterly Business Review deck content

## Page 1 (title)
Quarterly Business Review

## Page 2 (content)
Revenue grew 12 percent 2026 outlook: solid
Outlook remains positive
"""


# ---------------------------------------------------------------------------
# Real decks + golden fixture: fingerprints and clean gates
# ---------------------------------------------------------------------------

def test_deck_main_100p_fingerprint():
    if not MAIN_DECK or not os.path.isdir(MAIN_DECK):
        raise _Skip("main deck not present in this checkout (template context)")
    r = _run_py(MAIN_DECK, os.path.join(MAIN_DECK, "deck_content.md"))
    assert r["summary"]["pages"] == 100
    assert r["summary"]["errors"] == 0 and r["summary"]["warnings"] == 0
    assert r["content_diff"]["unrendered_runs"] == 0
    assert r["fingerprint"] == EXPECTED_FINGERPRINTS["main"]
    print(f"  main: {r['fingerprint']} (100 pages, 0/0)")


def test_deck_exec_cut_12p_fingerprint():
    if not EXEC_DECK or not os.path.isdir(EXEC_DECK):
        raise _Skip("exec cut not present in this checkout (template context)")
    r = _run_py(EXEC_DECK, os.path.join(MAIN_DECK, "deck_content-exec-cut.md"))
    assert r["summary"]["pages"] == 12
    assert r["summary"]["errors"] == 0 and r["summary"]["warnings"] == 0
    # svg-check 2.1.0: the real E-keyed contract must produce ZERO unrendered-
    # run warnings — the E-contract reverse diff is active without false
    # positives on the delivered exec cut.
    assert r["content_diff"]["unrendered_runs"] == 0
    assert r["fingerprint"] == EXPECTED_FINGERPRINTS["exec-cut"]
    print(f"  exec-cut: {r['fingerprint']} (12 pages, 0/0, unrendered_runs=0)")


def test_deck_golden_fixture_fingerprint():
    r = _run_py(FIXTURE_DECK, os.path.join(FIXTURE_DECK, "deck_content.md"))
    assert r["summary"]["pages"] == 6
    assert r["fingerprint"] == EXPECTED_FINGERPRINTS["fixture"]
    print(f"  fixture: {r['fingerprint']} (6 pages, 0/0)")


# ---------------------------------------------------------------------------
# svg-check 2.1.0 E-heading pin (exec-cut reverse diff active, no false positives)
# ---------------------------------------------------------------------------

E_HEADING_UNRENDERED_LINE = "Exec cut parity fixture line rendered by no exec cut page"


def _mutated_exec_contract() -> str:
    """One unrendered run injected under the `## E07` heading of the REAL
    exec-cut contract (in-test fixture — the SSOT itself is never modified on
    disk)."""
    assert MAIN_DECK is not None
    with open(os.path.join(MAIN_DECK, "deck_content-exec-cut.md"), encoding="utf-8") as fh:
        raw = fh.read()
    marker = "## E07"
    assert marker in raw, "exec-cut contract is expected to key on ## E<n> headings"
    return raw.replace(marker, f"{marker}\n{E_HEADING_UNRENDERED_LINE}", 1)


def test_pin_exec_cut_e_heading_reverse_diff_active():
    # svg-check 2.1.0: exec-cut contracts key on `## E01`–`## E12`; before
    # 2.1.0 the section parser ignored E-headings and the REVERSE diff was
    # inert for them. With the fix, one injected unrendered run under `## E07`
    # fires exactly 1 W-CONTENT-UNRENDERED on page 7 (E07 → page 7), counted
    # in content_diff.unrendered_runs. The gate stays at 0 errors (advisory).
    if not EXEC_DECK or not os.path.isdir(EXEC_DECK):
        raise _Skip("exec cut not present in this checkout (template context)")
    mutated = _mutated_exec_contract()
    content_path = os.path.join(tempfile.mkdtemp(prefix="svgcheck-exec-contract-"), "deck_content-exec-cut.md")
    try:
        with open(content_path, "w", encoding="utf-8") as fh:
            fh.write(mutated)
        r = _run_py(EXEC_DECK, content_path)
        assert r["summary"]["errors"] == 0  # advisory warning — gate verdict unchanged
        assert r["summary"]["warnings"] == 1  # the real contract is otherwise clean (0)
        assert r["content_diff"]["unrendered_runs"] == 1
        warned = [
            (p.get("page_number"), w)
            for p in r["pages"]
            for w in p["warnings"]
            if w["rule"] == "W-CONTENT-UNRENDERED"
        ]
        assert len(warned) == 1, f"expected exactly 1 W-CONTENT-UNRENDERED, got {len(warned)}"
        page_num, warning = warned[0]
        assert page_num == 7, f"E07 run must warn on page 7, warned on page {page_num}"
        assert E_HEADING_UNRENDERED_LINE in warning["message"]
        print(f"  pin exec-cut E-heading reverse diff: 1 W-CONTENT-UNRENDERED on page {page_num}")
    finally:
        shutil.rmtree(os.path.dirname(content_path), ignore_errors=True)


# ---------------------------------------------------------------------------
# Semantics pins (originally ported from deck-golden.test.ts; python-only since
# the oracle retirement — expected values pinned literally)
# ---------------------------------------------------------------------------

def test_pin_entity_decode_matches_plain_ssot():
    # hardening R1: escaped page matches plain-text contract; text_runs report
    # the DECODED spelling.
    deck, content = _make_deck([("01-entities.svg", PAGE_ENTITIES)],
                               'P&L review ahead\nPlan for the "scale" phase\n')
    try:
        r = _run_py(deck, content)
        assert r["summary"]["errors"] == 0
        assert "P&L review ahead" in r["pages"][0]["text_runs"]
        assert 'Plan for the "scale" phase' in r["pages"][0]["text_runs"]
    finally:
        shutil.rmtree(deck, ignore_errors=True)


def test_pin_unrendered_run_warns_once_and_gate_passes():
    # hardening R2 (S11 stale-substring repro): a contract run no page renders
    # warns W-CONTENT-UNRENDERED once, counted additively in
    # content_diff.unrendered_runs; warnings never block the gate.
    deck, content = _make_deck(
        [("01-only.svg", PAGE_UNRENDERED)],
        "## Page 1 (content)\nRendered headline lands on the page\nUnrendered contract line lives only in the SSOT\n")
    try:
        r = _run_py(deck, content)
        assert r["summary"]["errors"] == 0  # warnings pass — gate verdict unchanged
        warns = [w for w in r["pages"][0]["warnings"] if w["rule"] == "W-CONTENT-UNRENDERED"]
        assert len(warns) == 1
        assert "Unrendered contract line" in warns[0]["message"]
        assert r["content_diff"]["unrendered_runs"] == 1
    finally:
        shutil.rmtree(deck, ignore_errors=True)


def test_pin_bare_ampersand_backward_compat():
    # hardening R1: bare `&` pages still match the plain-text contract.
    deck, content = _make_deck([("01-bare.svg", PAGE_BARE)], "P&L review ahead\n")
    try:
        r = _run_py(deck, content)
        assert r["summary"]["errors"] == 0
        assert r["content_diff"]["unmatched_runs"] == []
    finally:
        shutil.rmtree(deck, ignore_errors=True)


def test_pin_single_pass_decoder_semantics():
    # U-20261106-002: the decoder is single-pass per XML semantics
    # (&amp;lt; → literal '&lt;', never '<'). Expected values pinned literally
    # (python-only since the oracle retirement).
    cases = ["P&amp;L", "a&lt;b&gt;c&quot;d&apos;e&amp;f", "&amp;lt;", "&amp;amp;",
             "P&L", "no entities here", "&unknown;"]
    expected = ["P&L", 'a<b>c"d\'e&f', "&lt;", "&amp;", "P&L", "no entities here", "&unknown;"]
    sys.path.insert(0, os.path.dirname(PY_CHECKER))
    sys.dont_write_bytecode = True  # keep __pycache__ out of the template tree
    import svg_check as pc  # noqa: E402
    out = [pc.decode_xml_entities(c) for c in cases]
    assert out == expected, f"decoder semantics drifted: {out}"


def test_pin_blocking_verdicts():
    # gate section: invalid color, missing block marker, and content drift all
    # BLOCK (exit 1).
    deck, content = _make_deck([("01-title.svg", PAGE_LOWER_COLOR), ("03-bad.svg", PAGE_BAD)], CONTENT_MD)
    try:
        r = _run_py(deck, content)
        rules = [e["rule"] for p in r["pages"] for e in p["errors"]]
        assert "E-COLOR" in rules and "E-MARKER" in rules and "E-CONTENT-DIFF" in rules
        assert r["summary"]["errors"] >= 3
    finally:
        shutil.rmtree(deck, ignore_errors=True)


def test_pin_compatible_forms_warn():
    # gate section: lowercase hex + relative path commands WARN without
    # blocking.
    deck, content = _make_deck([("01-title.svg", PAGE_LOWER_COLOR), ("02-content.svg", PAGE_REL_PATH)], CONTENT_MD)
    try:
        r = _run_py(deck, content)
        assert r["summary"]["errors"] == 0
        warns = [w["rule"] for p in r["pages"] for w in p["warnings"]]
        assert "W-COLOR-LOWER" in warns and "W-PATH-REL" in warns
    finally:
        shutil.rmtree(deck, ignore_errors=True)


# ---------------------------------------------------------------------------
# Plain runner (pytest absent)
# ---------------------------------------------------------------------------

def main() -> int:
    tests = [(k, v) for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = skipped = 0
    for name, fn in tests:
        try:
            fn()
            print(f"PASS {name}")
        except _Skip as e:
            skipped += 1
            print(f"SKIP {name}: {e}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {name}: {e}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"ERROR {name}: {type(e).__name__}: {e}")
    print(f"\n{len(tests) - failed - skipped}/{len(tests)} semantics checks passed"
          + (f" ({skipped} skipped — deck fixtures absent in this checkout)" if skipped else ""))
    if failed == 0:
        print("SVG-CHECK SEMANTICS GREEN — all pins hold on svg_check.py")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
