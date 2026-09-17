---
schemaVersion: 1.0.0
spec-id: instruction-lint-probe
---

# Instruction Sentence-Length Lint Probe — 2026-09-17

## 1. Overview

Lands ticket T-20260917-011: an advisory sentence-length lint prototype for
development-facing instruction text (ADR-0079 Decision ¶4 names "a
sentence-length lint" as the possible future extension; the ticket probes
it). ADR-0079 keeps enforcement advisory — no machine gate. This tool is a
standalone probe. Nothing in `/sync`, `audit.ts`, or any hook invokes it.

Scope for the prototype: requirement and acceptance sections inside
`docs/designs/*.md` — the artifact class ADR-0079 names first and the
section type the architect checks at Design Gate review.

## 2. Requirements and acceptance criteria

1. Scan `docs/designs/*.md` by default. Accept `--dir <path>` to scan
   another root of markdown files.
2. Detect requirement sections by heading text. Match headings that
   contain "requirement" or "acceptance" (case-insensitive), levels 2-4.
3. Check every sentence inside those sections against the ADR-0079
   descriptive limit: 25 words. Flag sentences over the limit as WARN.
4. Skip fenced code blocks, table lines, and heading lines. Handle
   bullets and numbered list items: one item may hold one instruction.
5. Count words on whitespace-separated tokens. Strip list markers
   (`-`, `*`, `N.`) and inline-code backticks before counting.
6. Print one WARN line per finding: file, line number, word count, and
   the first 90 characters of the sentence.
7. Print a per-file summary and a total. Keep exit code 0 on findings —
   the probe is advisory. Exit 1 only under `--strict`.
8. Add no config file and no gate wiring. One script, `--help`, `--dir`,
   `--strict`. That is the whole surface.

Acceptance criteria:

- `bun scripts/lint-instructions.ts` exits 0 and prints findings for the
  current `docs/designs/` tree (the tree holds known long sentences).
- `bun scripts/lint-instructions.ts --strict` exits 1 when at least one
  WARN exists, 0 when clean.
- A fixture with a 30-word sentence in a requirement section produces
  exactly one WARN; the same sentence inside a fenced code block or a
  table produces none.
- `bun test tests/unit/lint-instructions.test.ts` passes.

## 3. Chosen approach

### 3.1 Pure helpers + thin CLI

Export pure functions from the script module; keep the CLI a thin wrapper:

- `extractRequirementSections(text): {startLine, endLine, heading}[]` —
  heading scan, section extent = until the next heading of level ≤ the
  matched heading's level.
- `lintLine(line): string[]` — strip fences/tables/markers, split into
  sentences, return the over-limit sentences with counts.
- `lintDocument(text): {line, words, text}[]` — walks the section ranges,
  accumulates findings with absolute line numbers.

Sentence split heuristic: split on `.`, `!`, or `?` followed by
whitespace and a new token. This over-splits on abbreviations
(e.g. "e.g.") — acceptable for an advisory probe; over-splitting only
under-reports. Word count treats `code spans` as one token after
backtick stripping.

### 3.2 Considered and rejected

- Passive-voice and idiom detection — rejected for the prototype: needs
  a dictionary or model; the ticket scopes a length probe.
- Wiring into `audit.ts` as a WARN check — rejected: ADR-0079 declares
  advisory enforcement; wiring creates a gate by another name.
- Scanning all workspace markdown — rejected: out of the ticket scope
  (design-doc requirement sections); `--dir` keeps the door open.

## 4. Files that change

| File | Change |
|------|--------|
| `scripts/lint-instructions.ts` | new, v1.0.0 |
| `tests/unit/lint-instructions.test.ts` | new, v1.0.0 |
| `scripts/SCRIPTS.md` | registry row + detail section |

## 5. Rollout

Single PR. `propagate-to-templates --apply` (dev-sync step 4.5) copies the
script and registry to L1. No gate wiring, no template content change.

## 6. Verification

- `bun test tests/unit/lint-instructions.test.ts` green.
- `bun scripts/lint-instructions.ts` over the current tree: exit 0,
  findings printed (expected — known long sentences exist).
- `bun scripts/audit.ts` passes.

## 7. Accessibility

Backend/CLI-only work (a read-only markdown linter). No user-facing UI
is produced. Exempt from ADR-0065 WCAG scope; the WCAG 2.1 AA baseline
does not apply.

## 8. Preview Verification

Non-UI work — no rendered surface exists. Exempt from ADR-0070 preview
verification; verification is the executed battery in Section 6.

## References

- [Source: tickets/governance/T-20260917-011.yaml — ticket]
- [Source: docs/adr/0079-simplified-english-development-instructions.md — Decision ¶1 (limits), ¶4 (advisory + lint extension)]
- [Source: docs/designs/2026-09-17-instruction-policy-wiring-design.md — the wiring batch this follows]
