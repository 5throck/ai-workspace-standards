---
title: "Deck checker tests fail on Windows only because of text encoding and line endings, not paths"
author: Mark
date: 2026-11-17
branch: main
cost: { minutes: 1, tokens: 1520 }
id: l-d18553a6
scope: repo
status: active
src: agent
touches:
  - templates/co-work/scripts/deck/svg_check.py
  - templates/co-work/scripts/deck/tests/test_svg_check.py
  - templates/co-work/scripts/co-work/SCRIPTS.md
---

## Decided
The co-work deck checker test failures on a Korean Windows machine had two encoding causes plus one line-ending cause. All three are fixed inside the co-work template only, and the pinned fingerprint was left as is.

In the code:
- templates/co-work/scripts/deck/svg_check.py: main() now forces stdout/stderr to UTF-8 (the tests run it with python -I, which ignores PYTHONIOENCODING, so the script must do it itself). Version 2.1.1.
- templates/co-work/scripts/deck/tests/test_svg_check.py: subprocess.run reads the child output as UTF-8. Version 2.0.1.
- templates/co-work/scripts/deck/tests/fixtures/.gitattributes: '* text eol=lf', because the checker fingerprints raw bytes and the .svg fixtures were not pinned to LF.
- templates/co-work/scripts/co-work/SCRIPTS.md: both rows bumped.

## Tried and ruled out
- The reported hardcoded Downloads path: not present anywhere in templates/co-work; the test already derives paths from __file__. The symptom (JSONDecodeError on every case) came from the checker crashing on a cp949 pipe, not from a wrong path.
- Making the checker normalize CRLF before hashing: it would change every fingerprint that the export chain and the pinned test values depend on.
- Adding eol=lf to the root .gitattributes: the template-boundary rule forbids mixing root and template changes in one task; nested template-level attributes files already exist for other templates.
- git checkout of the fixture folder to renormalize: no-op, because git saw no content diff; the working files had to be rewritten to LF directly.

## Watch out
- Fixture fingerprints match only when the .svg files are LF on disk; a CRLF checkout shows up as a single fingerprint mismatch while everything else passes.
- git status keeps listing the six fixture .svg files as modified after the rewrite even though git diff is empty; it is a stat-cache artifact, not a real change.
- The three real-deck cases skip in the template checkout by design.
