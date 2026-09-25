---
name: style-lint-checklist
scope: co-news
description: >
  Pre-publication lint pass that encodes the financial-journalism style guide's
  top rules as pass/fail checklist items — headline structure, lead coverage,
  number/date/company-name notation, AI-tell patterns, and the zero-drift
  preservation hard constraints. Run by style-editor before publication;
  meaning-distortion findings block.
version: 1.0.1
last_reviewed: 2026-08-26
status: active
owner: style-editor
prerequisites: financial-journalism-style
metadata:
  type: domain
  triggers:
    - style lint
    - pre-publication style check
    - style checklist
    - lint pass
    - style gate
---

## Context

`financial-journalism-style` carries the house-style conventions as guidance; this skill is the mechanical gate derived from them. Where the style skill tells the style-editor HOW to write well, this checklist verifies the draft PASSED — every item is a pass/fail (or warn) question answerable from the draft alone, producing a lint report the pm can attach to the publication decision. Rules are distilled from `docs/financial-journalism-style-guide.md` (sections cited per item); when an item and the full guide conflict, the full guide wins and the item is flagged for update.

Korean-mode items apply to the default Korean output; non-Korean assignments skip the language-gated items (marked **[KR]**) and keep the universal ones (marked **[ALL]**), mirroring the language gating in `financial-journalism-style` step 5.

## When to Use

- Phase 4, by style-editor, as the final pass on the reporter's draft AFTER stylistic editing — immediately before the publication decision
- By pm as an audit checklist when reviewing a style-editor pass
- Never during drafting (Phase 3) — linting a half-written draft produces noise

## Execution Steps

Run the nine lint groups in order; record every non-pass finding with its location and severity. Blocking severities: **meaning distortion** and **preservation violation** — these block publication regardless of other results.

### 1. Headline Lint **[KR]**

- [ ] Headline contains a concrete number or key fact (amount, percent, ranking) — noun-phrase headline with no number fails
- [ ] Noun-phrase form: no sentence-final predicates, no topic/subject particles ending clauses
- [ ] Second clause cut with an ellipsis hook where a two-part headline is used
- [ ] No question-form headline
- [ ] No bracket article-type tags (exclusive/breaking-news-style tags)
- [ ] Headline opens with the company or subject name

### 2. Lead Lint **[ALL]**

- [ ] Most important fact or number is in the first sentence
- [ ] 5W1H coverage within the first two sentences
- [ ] The single most important number of the article appears in the lead
- [ ] Lead is 2–4 sentences

### 3. Number Notation Lint **[KR]** (guide §4.1)

- [ ] Amounts use Korean scale units (won / ten-thousand-won / hundred-million-won / trillion-won scale) consistently
- [ ] Percentages are Arabic numerals with `%` (e.g., `15%`, `3.2%`)
- [ ] Multiples are Arabic numerals with the multiplier suffix (e.g., `1.5x` form)

### 4. Date Notation Lint **[KR]** (guide §4.2)

- [ ] Past dates in month-day form; future dates use the coming-form prefix; relative words (today/yesterday/tomorrow) only where anchored
- [ ] Year-over-year comparisons use the standard comparison phrase, quarter references in quarter form

### 5. Company-Name Lint **[KR]** (guide §4.3)

- [ ] Legal or industry-standard names only — no informal nicknames
- [ ] Foreign companies: Korean transliteration (where one exists) with the English name at first mention

### 6. Terminology Lint **[KR]** (guide §4.4)

- [ ] Industry-standard English acronyms used inline as-is; uppercase acronyms preserved
- [ ] NO parenthetical expansion of acronyms at first mention — flag any expansion as a failure (house style deliberately omits them)

### 7. AI-Tell Lint **[ALL]** (guide §5.1; operates with `ai-tell-reduction`)

Scan the draft for the catalogued AI-tell patterns. Severity per the guide's table:

- **Meaning distortion (BLOCKING)**: translationese constructions (passive-ish "can be seen that..." forms — replace with direct statements); excessive conjunction chains linking every paragraph
- **Distracting (WARN)**: mechanical enumeration openers (firstly/secondly/thirdly sequences); stock AI idioms ("it is worth noting", "interestingly"); excessive hedging stacks
- **Cosmetic (WARN)**: passive-voice overuse; bullets or emoji in article body; uniform sentence length with no variation

### 8. Preservation Hard Constraints **[ALL]** (guide §5.2 — zero figure drift)

- [ ] Proper nouns (companies, people) byte-identical to the source draft
- [ ] Numbers, amounts, ratios byte-identical to the source draft
- [ ] Dates byte-identical to the source draft
- [ ] Direct quotes (inside quotation marks) untouched
- [ ] Every sentence containing a figure diffed against the fact-checker's evidence ledger (see `source-verification-ledger`) — any mismatch is a blocking preservation violation

### 9. Register Consistency **[KR]**

- [ ] One register throughout (economic-daily accessible register vs IB-specialist dense register per the assignment's target audience) — mixed-register passages flagged with locations
- [ ] Disclosure-citation phrasing uses natural attributed forms, not mechanical citation brackets
- [ ] Wire header valid per `docs/wire-format.md` — slug present and matches ledger/corrections-triage references; register/language fields match the assignment; on `final.md` the wire comment is byte-stable vs `draft.md` (slug, register, language never change)

## Output Format

```markdown
## Style Lint Report

**Article**: [slug]  **Register**: [economic-daily / IB-specialist]  **Language**: [Korean / other]
**Wire header**: [valid / slug mismatch / missing / not byte-stable]
**Result**: PASS / PASS WITH WARNINGS / BLOCKED

| # | Group | Finding | Severity | Location | Fix |
|---|-------|---------|----------|----------|-----|
| 7 | AI-tell | translationese in market summary | blocking | ¶3 | rewrite as direct statement |

**Preservation diff**: [clean / violations listed]
**Ledger cross-check**: [clean / mismatches listed]
```

A BLOCKED result returns the draft to style-editor for one more pass; two consecutive BLOCKED results escalate to pm with the findings table.

## Related Skills

- `financial-journalism-style` — upstream conventions this checklist distills; consult it for any item whose fix is unclear
- `ai-tell-reduction` — the AI-tell lint group operates on its pattern catalog; deep remediation runs through it
- `source-verification-ledger` — the preservation cross-check diffs figure sentences against this ledger (NEWS-R1 two-source rule context)
