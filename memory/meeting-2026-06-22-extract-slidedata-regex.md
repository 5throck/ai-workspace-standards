# Meeting Transcript
**Date**: 2026-06-22
**Topic**: extract_slidedata.mjs non-greedy regex `\[[\s\S]*?\]` truncation — review & improvement options
**Participants**: automation-engineer, architect, security-expert
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

`templates/co-deck/scripts/co-deck/extract_slidedata.mjs` fails to parse co-deck2's `lecture_v1.html` slideData ("Unexpected token ']'"), which is the first step of the co-deck PDF pipeline. co-deck1 parses fine. The PM's independent verification (Phase 4 loop) confirmed this is a pre-existing tooling issue, independent of the authoritative-`renderSlide` template work, and reproduces whenever co-deck2's slideData is fed through the script.

## Root Cause (agreed)

`patterns[0]` — `/(?:const|let|var)\s+slideData\s*=\s*(\[[\s\S]*?\]);?\s*\n/` — uses a **non-greedy** `\[[\s\S]*?\]` that matches from the first `[` to the first `]` followed by `;?\s*\n`.

- co-deck1: `bullets` is inline (`bullets: ["a","b"],`) → the inner `]` is followed by `,`, so the regex does not stop there and correctly matches the outer array close. Parses fine.
- co-deck2: `bullets` is multi-line, so its closing `]` is followed by `\n` → the regex truncates there, capturing a malformed fragment. `JSON.parse` fails.

A balanced-bracket fallback already exists at lines 52-64, but it only runs when `patterns[0]` **and** `patterns[1]` both fail. Because `patterns[0]` returns a (truncated) "success", the fallback never engages — the real defect.

A secondary concern: the dynamic-eval fallback at line 98 (a Function constructor that returns the slideData text as an object) evaluates the slideData text as JS — a latent code-execution surface, made worse when fed truncated input.

## Transcript

### Round 1

**automation-engineer**: Agreed with PM's mechanism. `patterns[0]` is non-greedy and stops at the first `]` followed by `;\n`. co-deck1 (inline bullets) passes because the inner `]` is followed by `,`; co-deck2 (multi-line bullets) truncates because the inner `]` is followed by `\n`. Notably, a bracket-depth counter already exists at lines 52-64 but only runs as a last resort — and since `patterns[0]` returns a truncated "success", the fallback never triggers. Proposal: promote bracket-matching to the **primary** extractor and delete the two regex patterns.

**architect**: Diagnosis correct. The problem is fundamentally "reliably slice one top-level JS array literal out of text" — a recursive-structure match that regex cannot do (nested `[]` must be counted). Options: (A) balanced-bracket scan, (B) JS parser dependency (acorn/babel), (C) require html-build to emit slideData as strict JSON. Recommendation: **(A) immediately + (C) as the long-term target**. (B) is overkill for one file. Asked automation-engineer whether the bracket scanner can skip `[`/`]` inside string literals.

**security-expert**: Raised the execution surface at line 98: the Function-constructor fallback evaluates slideData as code. Trust model says slideData is author-controlled (defensively acceptable), but it is a latent code-execution hole, and dynamic eval of truncated rawJson is riskier. If (A)+(C) land, (A)'s transform→`JSON.parse` alone suffices and the dynamic-eval fallback can be removed entirely. Caveat: the JS-literal→JSON transform (lines 79-89) has its own risk — `//[^\n]*` comment-stripping beheads `//` inside URL strings — which must be tightened until (C) lands.

### Round 2

**automation-engineer**: Confirmed the scanner will use a state machine that ignores brackets inside `"`, `'`, template literals, and `//`/`/* */` comments. Agreed that (C) eliminates the transform AND the dynamic-eval fallback together (quoted keys, double-quotes, no comments → no transform needed). Implementation order: **(A) first (immediate hotfix) → (C) next (html-build emission contract) → then remove transform + dynamic-eval fallback**. During the interim, asked security-expert whether keeping the dynamic eval as explicit last-resort with a warning log is acceptable.

**architect**: Agreed on order; added two conditions: (A) should attempt `JSON.parse` first without normalization and only apply transform on failure (minimizes attack surface); and (C)'s html-build contract change must touch **both** `.claude/skills/html-build/SKILL.md` **and** the `.gemini` counterpart for platform parity (Platform: Both). Suggested narrowing the transform's `//` removal to "outside string literals only", bundled into (A).

**security-expert**: Accepted last-resort-with-warning, on condition the warning goes to **stderr and explicitly flags possible abnormal termination** (not just a log). Agreed on "outside-string-only //" removal. Added: (A) should add a **pre-eval balance check** (matching open/close bracket counts) before any dynamic-eval call, blocking truncated input from reaching the evaluator. Summary: (A) → (C) → cleanup; the dynamic-eval fallback stays as warned, pre-checked last-resort until (C).

---

## Synthesis (auditor)

**Agreements**:
- Root cause: non-greedy `\[[\s\S]*?\];?\s*\n` truncates at the first inner `]+\n` (multi-line bullets); the existing bracket-matching fallback never runs because `patterns[0]` returns truncated success.
- Strategy: (A) promote bracket-depth extraction to primary (state machine, ignores brackets in strings/comments) → (C) change html-build to emit strict JSON → then remove transform + dynamic-eval fallback.
- Dynamic-eval fallback: kept as last-resort with stderr warning + balance pre-check until (C); removed after.

**Open / unresolved**:
- Whether to bundle (A) and (C) in one PR or stage them. Consensus: **staged (two PRs)** for risk isolation, but (C) must follow quickly to keep the execution-surface exposure window short.
- Where the transform `//`-narrowing lands: recommended into the (A) PR (URL-beheading is a live risk until (C)).

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Medium | `extract_slidedata.mjs`: promote bracket-depth-counting extraction to primary (string/comment-aware state machine), remove regex patterns, narrow transform `//` removal to outside-string-only (Stage A hotfix) | Both | Immediate |
| A-02 | automation-engineer | Medium | Add stderr warning + bracket-balance pre-check to the dynamic-eval fallback (harden last-resort) | Both | Immediate (same PR as A-01) |
| A-03 | automation-engineer | Medium | Change html-build to emit slideData as strict JSON (quoted keys, double quotes, no comments): `.claude/skills/html-build/SKILL.md` + `.gemini/skills/html-build/SKILL.md` + `agents/html-build.md` (Stage C) | Both | After A-01/02 merge |
| A-04 | automation-engineer | Medium | After (C) lands, remove the transform (lines 79-89) and the dynamic-eval fallback; simplify `extract_slidedata.mjs` | Both | After A-03 merge |
| A-05 | auditor | Low | Regression test: co-deck2 slideData passes extract after (A) (recovers 24 slides) + co-deck1 regression (20 slides) | L0-only | At A-01 verification |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `extract_slidedata.mjs` recovers all 24 co-deck2 slides after A-01 | run extract on co-deck2 `lecture_v1.html` → output length 24 |
| AC-02 | co-deck1 still recovers 20 slides (no regression) | same, co-deck1 → length 20 |
| AC-03 | No dynamic-eval execution path reached when input is well-formed | structural test: balanced input skips the eval fallback |
| AC-04 | After A-04, `extract_slidedata.mjs` contains no Function-constructor usage and no JS→JSON transform | grep for the constructor → none; transform block removed |
