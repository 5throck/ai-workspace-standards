#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
@version 1.0.0
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

Exit codes:
  0  pass (expectations hold) — OR graceful SKIP when python-pptx is absent
     (CI stays green on minimal environments; the skip prints an explicit
     "SKIP: python-pptx not available" line so it is never mistaken for a pass).
  1  FAIL — file unopenable, unparseable expectation, or a count mismatch.

Wiring (D6): (a) an optional step in the pptx-export skill's delivery
checklist; (b) runnable inside the opt-in CI unit-tests job (ADR-0094) against
the golden fixture deck. The full headless-PowerPoint/LibreOffice open harness
is out of scope (standing no-Office-tooling policy; design D6).
"""

import argparse
import json
import sys


def fail(msg):
    print(f"FAIL: {msg}")
    sys.exit(1)


def parse_args():
    p = argparse.ArgumentParser(description="Open a produced .pptx and assert expected slide/notes/table counts (D6).")
    p.add_argument("--pptx", required=True, help="path to the produced .pptx")
    p.add_argument("--expect", required=True,
                   help="path to a JSON expectation file: {\"slides\": N, \"notes\": M|null, \"tables\": {\"slideNum\": n}|null}")
    return p.parse_args()


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
    slides = doc.get("slides")
    if not isinstance(slides, int) or slides < 0:
        fail(f"expectation 'slides' must be a non-negative integer (got {slides!r})")
    notes = doc.get("notes", None)
    if notes is not None and (not isinstance(notes, int) or notes < 0):
        fail(f"expectation 'notes' must be a non-negative integer or null (got {notes!r})")
    tables = doc.get("tables", None)
    if tables is not None:
        if not isinstance(tables, dict):
            fail(f"expectation 'tables' must be an object mapping slideNum -> count, or null (got {tables!r})")
        normalized = {}
        for key, count in tables.items():
            try:
                slide_num = int(key)
            except (TypeError, ValueError):
                fail(f"expectation 'tables' key {key!r} is not a slide number")
            if not isinstance(count, int) or count < 0:
                fail(f"expectation 'tables[{key}]' must be a non-negative integer (got {count!r})")
            normalized[slide_num] = count
        tables = normalized
    return slides, notes, tables


def count_notes_slides(prs):
    """Slides carrying non-empty notes text."""
    count = 0
    for slide in prs.slides:
        if not slide.has_notes_slide:
            continue
        text = slide.notes_slide.notes_text_frame.text if slide.notes_slide.has_notes_text_frame else ""
        if text is not None and text.strip():
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


def main():
    args = parse_args()
    expected_slides, expected_notes, expected_tables = load_expectation(args.expect)

    try:
        from pptx import Presentation  # python-pptx
    except ImportError:
        print("SKIP: python-pptx not available — openability assertion not run "
              "(install python-pptx to enable; CI stays green on minimal environments, design D6)")
        sys.exit(0)

    try:
        prs = Presentation(args.pptx)
    except Exception as e:  # noqa: BLE001 — any open failure is a FAIL, not a skip
        fail(f"cannot open {args.pptx} with python-pptx: {e}")

    actual_slides = len(prs.slides)
    problems = []
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

    if problems:
        for p in problems:
            print(f"FAIL: {args.pptx}: {p}")
        sys.exit(1)

    print(f"PASS: {args.pptx} opened — slides={actual_slides}"
          + (f", notes_slides={expected_notes}" if expected_notes is not None else "")
          + (f", tables={ {str(k): v for k, v in sorted(expected_tables.items())} }" if expected_tables is not None else ""))
    sys.exit(0)


if __name__ == "__main__":
    main()
