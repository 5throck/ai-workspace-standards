#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
@version 1.1.0
check_openability.py — cheap CI openability leg for produced .pptx decks
(design docs/designs/2026-11-07-external-deps-machinery-design.md D6).

Opens a produced .pptx with python-pptx (when available) and asserts the
expected shape from a JSON expectation file:

    {"slides": 3, "notes": 2, "tables": {"2": 1}}

  - "slides"  (required): expected slide count.
  - "notes"   (optional): expected number of slides carrying NON-EMPTY speaker
              notes; null = do not assert notes at all.
  - "tables"  (optional): {"<slideNum>": <expected native table count on that
              slide>}; null = do not assert tables.

v1.1.0 (2026-11-07): batch mode for the CI openability leg —
`--batch-expect <file>` takes a JSON object mapping deck paths to per-deck
expectations and asserts them all in one invocation:

    {
      "deliverables/presentations/main.pptx":       {"slides": 100, "notes": 100},
      "deliverables/presentations/exec-cut.pptx":   {"slides": 12,  "notes": 0}
    }

Deck paths resolve relative to the CURRENT WORKING DIRECTORY (CI runs from
the repo root; the golden-fixture single mode is unchanged). Exit 0 only when
EVERY deck passes; the first unreadable expectation file, unopenable deck, or
count mismatch is reported per deck and the run fails.

Also fixes a latent 1.0.0 defect surfaced by the first real-deck batch run:
`NotesSlide.has_notes_text_frame` does not exist in the python-pptx API —
notes counting crashed with AttributeError on any notes-bearing deck; the
`notes_text_frame` None-guard is the correct spelling.

Exit codes:
  0  pass (expectations hold) — OR graceful SKIP when python-pptx is absent
     (CI stays green on minimal environments; the skip prints an explicit
     "SKIP: python-pptx not available" line so it is never mistaken for a pass).
  1  FAIL — file unopenable, unparseable expectation, or a count mismatch.

Wiring (D6): (a) an optional step in the pptx-export skill's delivery
checklist; (b) the project CI unit-tests job (ADR-0094 conventions) via
`--batch-expect scripts/deck/openability-expectations.json` over the committed
deck deliverables (2026-11-07). The full headless-PowerPoint/LibreOffice open
harness is out of scope (standing no-Office-tooling policy; design D6).
"""

import argparse
import json
import sys


def fail(msg):
    print(f"FAIL: {msg}")
    sys.exit(1)


def parse_args():
    p = argparse.ArgumentParser(description="Open a produced .pptx and assert expected slide/notes/table counts (D6).")
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--pptx", help="path to the produced .pptx (single mode; pair with --expect)")
    mode.add_argument("--batch-expect",
                      help="path to a JSON file mapping deck paths to per-deck expectations: "
                           "{\"<pptx path>\": {\"slides\": N, \"notes\": M|null, \"tables\": {...}|null}, …} "
                           "(paths resolve against the current working directory)")
    p.add_argument("--expect",
                   help="single mode: path to a JSON expectation file "
                        "{\"slides\": N, \"notes\": M|null, \"tables\": {\"slideNum\": n}|null}")
    args = p.parse_args()
    if args.pptx and not args.expect:
        p.error("--pptx requires --expect <file>")
    if args.expect and not args.pptx:
        p.error("--expect requires --pptx <file>")
    if args.batch_expect and args.expect:
        p.error("--batch-expect and --expect/--pptx are mutually exclusive")
    return args


def load_expectation(path):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            doc = json.load(fh)
    except OSError as e:
        fail(f"cannot read expectation file {path}: {e}")
    except ValueError as e:
        fail(f"expectation file {path} is not valid JSON: {e}")
    if not isinstance(doc, dict):
        fail(f"expectation file {path} must be a JSON object")
    return parse_expectation(doc, path)


def parse_expectation(doc, source):
    """Validate one expectation object (the value side of both file shapes)."""
    slides = doc.get("slides")
    if not isinstance(slides, int) or slides < 0:
        fail(f"expectation 'slides' must be a non-negative integer (got {slides!r}) in {source}")
    notes = doc.get("notes", None)
    if notes is not None and (not isinstance(notes, int) or notes < 0):
        fail(f"expectation 'notes' must be a non-negative integer or null (got {notes!r}) in {source}")
    tables = doc.get("tables", None)
    if tables is not None:
        if not isinstance(tables, dict):
            fail(f"expectation 'tables' must be an object mapping slideNum -> count, or null (got {tables!r}) in {source}")
        normalized = {}
        for key, count in tables.items():
            try:
                slide_num = int(key)
            except (TypeError, ValueError):
                fail(f"expectation 'tables' key {key!r} is not a slide number (in {source})")
            if not isinstance(count, int) or count < 0:
                fail(f"expectation 'tables[{key}]' must be a non-negative integer (got {count!r}) in {source}")
            normalized[slide_num] = count
        tables = normalized
    return slides, notes, tables


def load_batch_expectations(path):
    """v1.1.0 batch mode: {deck path -> expectation object}, one invocation."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            doc = json.load(fh)
    except OSError as e:
        fail(f"cannot read batch expectation file {path}: {e}")
    except ValueError as e:
        fail(f"batch expectation file {path} is not valid JSON: {e}")
    if not isinstance(doc, dict) or not doc:
        fail(f"batch expectation file {path} must be a non-empty JSON object mapping pptx paths to expectations")
    batch = []
    for deck_path, expectation in doc.items():
        if not isinstance(expectation, dict):
            fail(f"batch expectation for {deck_path!r} in {path} must be an expectation object")
        slides, notes, tables = parse_expectation(expectation, f"{path}:{deck_path}")
        batch.append((deck_path, slides, notes, tables))
    return batch


def count_notes_slides(prs):
    """Slides carrying non-empty notes text."""
    count = 0
    for slide in prs.slides:
        if not slide.has_notes_slide:
            continue
        # NotesSlide has NO `has_notes_text_frame` predicate (python-pptx API);
        # `notes_text_frame` itself is None when the notes slide lacks a body
        # placeholder (fixed 2026-11-07 — the AttributeError was latent in 1.0.0,
        # which never ran against a notes-bearing deck).
        ntf = slide.notes_slide.notes_text_frame
        if ntf is not None and ntf.text is not None and ntf.text.strip():
            count += 1
    return count


def count_tables_by_slide(prs):
    """Native tables (GraphicFrame.has_table) per 1-based slide number."""
    counts = {}
    for idx, slide in enumerate(prs.slides, start=1):
        n = 0
        for shape in slide.shapes:
            if getattr(shape, "has_table", False):
                n += 1
        if n:
            counts[idx] = n
    return counts


def assert_deck(pptx_path, expected_slides, expected_notes, expected_tables, Presentation):
    """Open one deck and assert the expectation. Returns (problems, actual_slides);
    problems is empty on pass (and actual_slides None when the deck cannot be opened)."""
    try:
        prs = Presentation(pptx_path)
    except Exception as e:  # noqa: BLE001 — any open failure is a FAIL, not a skip
        return [f"cannot open {pptx_path} with python-pptx: {e}"], None

    problems = []
    actual_slides = len(prs.slides)
    if actual_slides != expected_slides:
        problems.append(f"slide count {actual_slides} != expected {expected_slides}")

    if expected_notes is not None:
        actual_notes = count_notes_slides(prs)
        if actual_notes != expected_notes:
            problems.append(f"notes-bearing slide count {actual_notes} != expected {expected_notes}")

    if expected_tables is not None:
        actual_tables = count_tables_by_slide(prs)
        for slide_num, expected_count in sorted(expected_tables.items()):
            actual_count = actual_tables.get(slide_num, 0)
            if actual_count != expected_count:
                problems.append(
                    f"slide {slide_num}: native table count {actual_count} != expected {expected_count}"
                )
    return problems, actual_slides


def main():
    args = parse_args()

    try:
        from pptx import Presentation  # python-pptx
    except ImportError:
        print("SKIP: python-pptx not available — openability assertion not run "
              "(install python-pptx to enable; CI stays green on minimal environments, design D6)")
        sys.exit(0)

    if args.batch_expect:
        batch = load_batch_expectations(args.batch_expect)
        failed = False
        passed = 0
        for deck_path, expected_slides, expected_notes, expected_tables in batch:
            problems, actual_slides = assert_deck(deck_path, expected_slides, expected_notes, expected_tables, Presentation)
            if problems:
                failed = True
                for p_msg in problems:
                    print(f"FAIL: {deck_path}: {p_msg}")
            else:
                passed += 1
                print(f"PASS: {deck_path} opened — slides={actual_slides}"
                      + (f", notes_slides={expected_notes}" if expected_notes is not None else "")
                      + (f", tables={ {str(k): v for k, v in sorted(expected_tables.items())} }" if expected_tables is not None else ""))
        if failed:
            sys.exit(1)
        print(f"PASS: batch openability — {passed}/{len(batch)} deck(s) match {args.batch_expect}")
        sys.exit(0)

    expected_slides, expected_notes, expected_tables = load_expectation(args.expect)
    problems, actual_slides = assert_deck(args.pptx, expected_slides, expected_notes, expected_tables, Presentation)
    if problems:
        for p_msg in problems:
            print(f"FAIL: {args.pptx}: {p_msg}")
        sys.exit(1)

    print(f"PASS: {args.pptx} opened — slides={actual_slides}"
          + (f", notes_slides={expected_notes}" if expected_notes is not None else "")
          + (f", tables={ {str(k): v for k, v in sorted(expected_tables.items())} }" if expected_tables is not None else ""))
    sys.exit(0)


if __name__ == "__main__":
    main()
