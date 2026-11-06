#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
@version 1.0.0
Differential parity harness: python svg_check.py (2.0.0) vs Bun svg-check.ts (1.5.1).

Phase 2 acceptance of design 2026-11-06-deck-emitter-ppt-master-rebase-design
(D6/§6.3): the Bun deck runtime retires ONLY when this harness proves, over the
real decks AND the golden fixture, that the python port produces
  - identical error/warning counts,
  - identical per-page issue sets (rule + message, same order),
  - identical fingerprints (byte-identical sha256 over the same hashing input),
and that the hardening semantics pins (svg-check 1.5.0 R1/R2, U-20261106-002)
hold identically in both implementations:
  - entity decode: a page spelling `P&amp;L` matches a plain-text SSOT,
  - unrendered-run warning: a stale-substring SSOT line fires
    W-CONTENT-UNRENDERED exactly once (S11 stale-substring repro) and the gate
    still passes (warnings do not block),
  - bare `&` backward compat: the unescaped spelling still matches.

Runs under pytest (`python3 -m pytest scripts/deck/tests/test_svg_check_parity.py`)
AND as a plain runner (`python3 scripts/deck/tests/test_svg_check_parity.py`)
when pytest is absent.

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
# parity tests skip (fixture parity + semantics pins still run everywhere).
_CANDIDATE_PROJECT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
if os.path.isdir(os.path.join(_CANDIDATE_PROJECT, "deliverables", "drafts")) and os.path.isdir(os.path.join(_CANDIDATE_PROJECT, "scripts", "deck")):
    PROJECT_ROOT: str | None = _CANDIDATE_PROJECT
    WORKSPACE_ROOT = os.path.abspath(os.path.join(PROJECT_ROOT, "..", ".."))  # …/ai_workspace
else:
    PROJECT_ROOT = None
    WORKSPACE_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))

PY_CHECKER = os.path.join(WORKSPACE_ROOT, "templates", "co-work", "scripts", "deck", "svg_check.py")
TS_CHECKER = os.path.join(WORKSPACE_ROOT, "templates", "co-work", "scripts", "deck", "svg-check.ts")

MAIN_DECK = (
    os.path.join(PROJECT_ROOT, "deliverables", "drafts", "2026-11-05-gtms-startup-market-research")
    if PROJECT_ROOT else None
)
EXEC_DECK = os.path.join(MAIN_DECK, "exec-cut") if MAIN_DECK else None
FIXTURE_DECK = os.path.join(WORKSPACE_ROOT, "templates", "co-work", "scripts", "deck", "tests", "fixtures", "sample-business-report")


class _Skip(Exception):
    pass

PY_CHECKER = os.path.join(WORKSPACE_ROOT, "templates", "co-work", "scripts", "deck", "svg_check.py")
TS_CHECKER = os.path.join(WORKSPACE_ROOT, "templates", "co-work", "scripts", "deck", "svg-check.ts")

MAIN_DECK = os.path.join(PROJECT_ROOT, "deliverables", "drafts", "2026-11-05-gtms-startup-market-research")
EXEC_DECK = os.path.join(MAIN_DECK, "exec-cut")
FIXTURE_DECK = os.path.join(WORKSPACE_ROOT, "templates", "co-work", "scripts", "deck", "tests", "fixtures", "sample-business-report")

EXPECTED_FINGERPRINTS = {
    "main": "sha256:aa3baf43fe5ebc57a565a080f6d6a80127da1a492a3dab8a22a570f7c4fbd866",
    "exec-cut": "sha256:a454f49ae40f1888de24db3926133e07b9ff207cb3b3b67ba1b3f1fedb1712d0",
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


def _run_ts(deck: str, content: str | None, stage: str = "final") -> dict:
    cmd = ["bun", TS_CHECKER, "--deck", deck, "--stage", stage, "--json"]
    if content:
        cmd += ["--content", content]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode not in (0, 1):
        raise AssertionError(f"bun checker failed (rc={proc.returncode}): {proc.stderr}")
    return json.loads(proc.stdout)


def _norm(report: dict) -> dict:
    """Strip the wall-clock field; everything else must be identical."""
    r = dict(report)
    r.pop("generated_at", None)
    return r


def _assert_parity(deck: str, content: str | None, label: str) -> tuple[dict, dict]:
    py = _run_py(deck, content)
    ts = _run_ts(deck, content)
    assert _norm(py) == _norm(ts), (
        f"[{label}] python/bun reports diverge:\n"
        f"fingerprint py={py['fingerprint']} ts={ts['fingerprint']}\n"
        f"summary py={py['summary']} ts={ts['summary']}\n"
        f"content_diff py={py['content_diff']} ts={ts['content_diff']}"
    )
    return py, ts


def _make_deck(pages: list[tuple[str, str]], content: str) -> tuple[str, str]:
    deck = tempfile.mkdtemp(prefix="parity-deck-")
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
# Parity over the real decks + golden fixture (the Phase 2 switch criterion)
# ---------------------------------------------------------------------------

def test_parity_main_deck_100p():
    if not MAIN_DECK or not os.path.isdir(MAIN_DECK):
        raise _Skip("main deck not present in this checkout (template context)")
    py, ts = _assert_parity(MAIN_DECK, os.path.join(MAIN_DECK, "deck_content.md"), "main")
    assert py["summary"]["pages"] == 100
    assert py["summary"]["errors"] == 0 and py["summary"]["warnings"] == 0
    assert py["fingerprint"] == EXPECTED_FINGERPRINTS["main"]
    print(f"  parity main: {py['fingerprint']} (100 pages, 0/0)")


def test_parity_exec_cut_12p():
    if not EXEC_DECK or not os.path.isdir(EXEC_DECK):
        raise _Skip("exec cut not present in this checkout (template context)")
    py, ts = _assert_parity(EXEC_DECK, os.path.join(MAIN_DECK, "deck_content-exec-cut.md"), "exec-cut")
    assert py["summary"]["pages"] == 12
    assert py["summary"]["errors"] == 0 and py["summary"]["warnings"] == 0
    assert py["fingerprint"] == EXPECTED_FINGERPRINTS["exec-cut"]
    print(f"  parity exec-cut: {py['fingerprint']} (12 pages, 0/0)")


def test_parity_golden_fixture_deck():
    py, ts = _assert_parity(FIXTURE_DECK, os.path.join(FIXTURE_DECK, "deck_content.md"), "fixture")
    assert py["summary"]["pages"] == 6
    assert py["fingerprint"] == EXPECTED_FINGERPRINTS["fixture"]
    print(f"  parity fixture: {py['fingerprint']} (6 pages, 0/0)")


# ---------------------------------------------------------------------------
# Semantics pins (ported from deck-golden.test.ts where they hit the checker)
# ---------------------------------------------------------------------------

def test_pin_entity_decode_matches_plain_ssot():
    # deck-golden T1 / hardening R1: escaped page matches plain-text contract;
    # text_runs report the DECODED spelling in both implementations.
    deck, content = _make_deck([("01-entities.svg", PAGE_ENTITIES)],
                               'P&L review ahead\nPlan for the "scale" phase\n')
    try:
        py = _run_py(deck, content)
        ts = _run_ts(deck, content)
        assert _norm(py) == _norm(ts)
        assert py["summary"]["errors"] == 0
        assert "P&L review ahead" in py["pages"][0]["text_runs"]
        assert 'Plan for the "scale" phase' in py["pages"][0]["text_runs"]
    finally:
        shutil.rmtree(deck, ignore_errors=True)


def test_pin_unrendered_run_warns_once_and_gate_passes():
    # deck-golden T2 / hardening R2 (S11 stale-substring repro): a contract run
    # no page renders warns W-CONTENT-UNRENDERED once, counted additively in
    # content_diff.unrendered_runs; warnings never block the gate.
    deck, content = _make_deck(
        [("01-only.svg", PAGE_UNRENDERED)],
        "## Page 1 (content)\nRendered headline lands on the page\nUnrendered contract line lives only in the SSOT\n")
    try:
        py = _run_py(deck, content)
        ts = _run_ts(deck, content)
        assert _norm(py) == _norm(ts)
        assert py["summary"]["errors"] == 0  # warnings pass — gate verdict unchanged
        warns = [w for w in py["pages"][0]["warnings"] if w["rule"] == "W-CONTENT-UNRENDERED"]
        assert len(warns) == 1
        assert "Unrendered contract line" in warns[0]["message"]
        assert py["content_diff"]["unrendered_runs"] == 1
    finally:
        shutil.rmtree(deck, ignore_errors=True)


def test_pin_bare_ampersand_backward_compat():
    # deck-golden T3: bare `&` pages still match the plain-text contract.
    deck, content = _make_deck([("01-bare.svg", PAGE_BARE)], "P&L review ahead\n")
    try:
        py = _run_py(deck, content)
        ts = _run_ts(deck, content)
        assert _norm(py) == _norm(ts)
        assert py["summary"]["errors"] == 0
        assert py["content_diff"]["unmatched_runs"] == []
    finally:
        shutil.rmtree(deck, ignore_errors=True)


def test_pin_single_pass_decoder_semantics():
    # deck-golden U1 / U-20261106-002: the decoder is single-pass per XML
    # semantics (&amp;lt; → literal '&lt;', never '<'). Verified against the TS
    # implementation itself so one decoder = one semantics across both.
    cases = ["P&amp;L", "a&lt;b&gt;c&quot;d&apos;e&amp;f", "&amp;lt;", "&amp;amp;",
             "P&L", "no entities here", "&unknown;"]
    script = (
        f'const {{ decodeXmlEntities }} = await import({json.dumps(TS_CHECKER)});\n'
        + "".join(f'console.log(JSON.stringify(decodeXmlEntities({json.dumps(c)})));\n' for c in cases)
    )
    proc = subprocess.run(["bun", "-e", script], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    ts_out = [json.loads(line) for line in proc.stdout.strip().splitlines()]
    sys.path.insert(0, os.path.dirname(PY_CHECKER))
    sys.dont_write_bytecode = True  # keep __pycache__ out of the template tree
    import svg_check as pc  # noqa: E402
    py_out = [pc.decode_xml_entities(c) for c in cases]
    assert py_out == ts_out, f"decoder divergence: py={py_out} ts={ts_out}"
    assert py_out == ["P&L", 'a<b>c"d\'e&f', "&lt;", "&amp;", "P&L", "no entities here", "&unknown;"]


def test_pin_blocking_verdicts_parity():
    # deck-golden T2 (gate section): invalid color, missing block marker, and
    # content drift all block — identical rule sets in both implementations.
    deck, content = _make_deck([("01-title.svg", PAGE_LOWER_COLOR), ("03-bad.svg", PAGE_BAD)], CONTENT_MD)
    try:
        py = _run_py(deck, content)
        ts = _run_ts(deck, content)
        assert _norm(py) == _norm(ts)
        rules = [e["rule"] for p in py["pages"] for e in p["errors"]]
        assert "E-COLOR" in rules and "E-MARKER" in rules and "E-CONTENT-DIFF" in rules
        assert py["summary"]["errors"] >= 3
    finally:
        shutil.rmtree(deck, ignore_errors=True)


def test_pin_compatible_forms_warn_parity():
    # deck-golden T3 (gate section): lowercase hex + relative path commands warn
    # without blocking — identical warning rule sets in both implementations.
    deck, content = _make_deck([("01-title.svg", PAGE_LOWER_COLOR), ("02-content.svg", PAGE_REL_PATH)], CONTENT_MD)
    try:
        py = _run_py(deck, content)
        ts = _run_ts(deck, content)
        assert _norm(py) == _norm(ts)
        assert py["summary"]["errors"] == 0
        warns = [w["rule"] for p in py["pages"] for w in p["warnings"]]
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
    print(f"\n{len(tests) - failed - skipped}/{len(tests)} parity checks passed"
          + (f" ({skipped} skipped — deck fixtures absent in this checkout)" if skipped else ""))
    if failed == 0:
        print("PARITY EXACT — python port matches bun svg-check.ts on all decks and pins")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
