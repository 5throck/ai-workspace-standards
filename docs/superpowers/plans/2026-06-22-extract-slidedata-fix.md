# extract_slidedata.mjs Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan.

**Goal:** Fix `extract_slidedata.mjs` so co-deck2 multi-line bullets no longer truncate; update html-build to emit strict JSON; then remove the JS→JSON transform and eval fallback.

**Architecture:** Three staged PRs.

**Tech Stack:** Bun/Node ESM (`.mjs`), Markdown skill files.

---

## Stage A — Immediate Hotfix (A-01 + A-02) ← CURRENT

- [ ] Task 1: Create test fixtures (co-deck1: 20 slides inline, co-deck2: 24 slides multi-line)
- [ ] Task 2: Write failing test (`scripts/co-deck/tests/extract_slidedata.test.mjs`) — run before fix
- [ ] Task 3: Rewrite `extract_slidedata.mjs` v1.1.0
  - Replace regex patterns + fallback with `extractBalancedArray()` state machine as primary
  - State machine skips `[`/`]` inside strings (`"`, `'`, `` ` ``), line comments (`//`), block comments (`/* */`)
  - JS→JSON transform: narrow `//` removal to `([\s,{[])\/\/[^\n]*` (outside-string-only)
  - eval fallback: add bracket-balance pre-check + stderr warning before `new Function()`
- [ ] Task 4: Run tests — AC-01, AC-02, AC-03 all pass
- [ ] Task 5: `/sync` Stage A PR

## Stage C — html-build strict-JSON contract (A-03, after Stage A merges)

- [ ] Update `.claude/skills/html-build/SKILL.md` → add strict-JSON requirement + update PDF pipeline note → bump to v1.3.1
- [ ] Update `.gemini/skills/html-build/SKILL.md` → same → bump to v1.3.1
- [ ] Update `agents/html-build.md` → update PDF pipeline note
- [ ] `/sync` Stage C PR

## Stage A-cleanup — Remove transform + eval (A-04, after Stage C merges)

- [ ] Remove JS→JSON transform block and eval fallback from `extract_slidedata.mjs` → v1.2.0
- [ ] Verify AC-04: `grep "new Function"` returns no matches
- [ ] Re-run tests — all pass
- [ ] `/sync` Stage A-cleanup PR

---

## Acceptance Criteria

| # | Criterion | Stage |
|---|-----------|-------|
| AC-01 | 24 slides from co-deck2 (multi-line bullets) | A |
| AC-02 | 20 slides from co-deck1 (no regression) | A |
| AC-03 | Strict-JSON input extracted without error | A |
| AC-04 | No Function-constructor, no transform block in final file | A-cleanup |
