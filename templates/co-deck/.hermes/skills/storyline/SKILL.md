---
name: storyline
scope: co-deck
version: 1.3.2
lang: ko
lang_reason: proper-noun (Step 3.5 quotes verbatim Korean defect strings and replacement wording from the affected deck)
description: >
  Designs lecture storyline and slide deck composition. Given research_notes.md
  (or direct topic input), produces storyline.md and slide_deck.md. Responds
  to "make storyline", "compose slide deck", "structure chapters" (Korean:
  "make storyline", "compose slide deck", "restructure chapters"). Stages 2-3
  of the lecture workflow.
status: active
owner: storyline
last_reviewed: "2026-11-16"
prerequisites: research
relates_to:
  - skill: design
    type: follows
inputs: [research-notes]
outputs: [storyline-outline, slide-deck-draft]
---

## Context

Designs the lecture narrative flow (`storyline.md`) and per-slide content (`slide_deck.md`). `slide_deck.md` is the direct input consumed by the Build Agent for HTML generation. Invoked at Stages 2-3, after research and optional source verification.

## When to Use

- PM Agent dispatches after Stage 1 (research)
- User says "make storyline"
- User says "compose slide deck"
- User says "restructure chapters"

---

## Execution Steps

### Step 1: Confirm Inputs

- If `research_notes.md` exists, read it first
- Confirm with the user:
  - Total slide count (e.g., 40, 60)
  - Chapter (part) count and rough proportions
  - Whether to include cover / speaker intro / contact slides (default: include all)

---


### Step 1.6: Optional Pre-Build Lint (Humanize, U-20261114-009 item 3)

When a Humanize rule-engine server is reachable (the offline Korean AI-tic rule
engine; default `http://localhost:8765`), run a deck-wide lint of the authored
narration and bullets through `POST /api/analyze` before the build:

```bash
curl -s -X POST http://localhost:8765/api/analyze \
  -H "Content-Type: application/json" -d "$(bun -e 'const t = await Bun.file(process.argv[1]).text(); console.log(JSON.stringify({ text: t }))' slide_deck.md)"
```

Report the finding count and the top patterns; severe findings are rewritten at
authoring time (numbers and density preserved — the lint flags AI-tic phrasing,
not content). The step is OPTIONAL and skips silently when the server is
unreachable (connection refused = lint unavailable, never a build blocker).

### Step 1.7: Slidedata Generator Hygiene (U-20261114-009 item 4)

Projects that generate `slidedata.json` from a script (gen-slidedata-*.py and
friends) follow two rules:

- **Single source**: presentation constants (cover metadata, speaker bio,
  chapter titles) derive from `lecture-profile.md` at generation time — a
  hardcoded constant that drifted from lecture-profile.md silently reintroduces
  stale text on every rebuild (observed: credential re-entry risk).
- **Round-trip parity gate**: a rebuild regenerating an unchanged
  lecture-profile.md must produce a byte-identical slidedata.json (modulo
  timestamps); regenerate-then-diff gates the rebuild, so generator-vs-slidedata
  drift is caught before the build consumes it.

---

### Step 1.5: Content Doctrine (authoring rules)

The slide-content doctrine the built deck must follow (mirrored in zen theme.json
content_rules.bullet_doctrine; enforced editorially at Step 3.5’s hygiene check):

- **Bullets carry context, not listings** — every bullet states an interpretation or
  takeaway; the bare "number — source" listing style is banned. The figure and its
  meaning live in the same line.
- **Source attributions are narration material** — per-slide source citations belong
  in the speaker script and the references appendix, never in slide bullets.
- **No next-slide announcements in bullets** — "다음 장에서는…" sentences belong in
  the speaker script only.
- **Biography credentials break per line** — each credential is its own line so
  profile cards keep a readable width instead of stretching full-width.

---

### Step 2: Write storyline.md

Construct the lecture's high-level flow narratively. Not just a table of contents — encode the logic of "why this order" so the audience journey is clear.

```markdown
# Storyline: [Topic]

## Lecture Overview
- Total slide count:
- Presentation time:
- Core message:

## Overall Narrative Flow
[3-5 paragraphs describing where the audience starts, what journey they take, and what they leave with]

## Chapter Structure
| # | Type | Title | Slide count | Key role |
|---|------|------|------------|---------|
| - | Cover | | 1 | Topic and speaker intro |
| - | Speaker intro | | 1 | Build credibility |
| 1 | PART | | N | |
| 2 | PART | | N | |
| - | Contact | | 1 | Closing and follow-up |

## Key Takeaways
What the audience should remember after the lecture:
1.
2.
3.
```

---

### Step 3: Write slide_deck.md

Write per-slide content. This file becomes the direct input for HTML generation.

```markdown
# Slide Deck: [Topic]

---
## [Slide number]. [Slide type] — [Title]

**Section**: [section name shown in header]
**Type**: cover / speaker intro / divider / standard / contact
**Script**: [Speaker narration text — 2-4 sentences, natural spoken style. Required for every slide. Write in `script_language` from lecture-profile.md (defaults to `language`).]

### Content
- Bullet 1
- Bullet 2
- Bullet 3

### Right Panel
- Type: image / text box
- Image: [search keyword or filename]
- Text title: [if any]
- Text body: [if any]

---
```

Repeat this structure for every slide. Dividers include part number and description.

> Korean example (actual slide content for a Korean lecture is written in Korean):
>
> ```markdown
> ## 5. divider — The Arrival of the AX Era
>
> **Section**: PART 01
> **Type**: divider
>
> ### Content
> - Paradigm shift in the securities industry
> - Definition of AX (AI Transformation)
> ```

> ⚠️ **Uniform Layout Principle**: All content slides within a single deck MUST use `standard` type. Special types (`punchline`, `divider`, `profile`) are reserved for their designated structural purpose only. `punchline` is allowed ONLY as the last content slide with a single-statement message (≤1 line, no bullets). Mixing slide types for content slides is prohibited — each type has a distinct CSS layout (2-column vs center-aligned), and mixing breaks visual consistency.

---

### Step 3.5: Slide Content Hygiene Check

Run before Step 4. `slide_deck.md` is the content SSOT — anything written into a slide-visible field (bullets, message, caption, footnote, right-panel text body, divider description, script-visible text) renders on the audience slide. Remove internal-process artifacts at authoring time; do not rely on build or review to catch them.

**R1 — No internal-process annotations on slide-visible content.** Analyst-facing caveats, scope flags, and caution glyphs MUST NOT appear in any slide-visible field. They are working notes for the author and reviewer, not audience content.

Ban list (matched against slide-visible fields of `slide_deck.md`):

| Pattern | Example |
|---------|---------|
| `⚠️` / `⚠` glyph, anywhere | `(⚠️ 단일 소스)`, `(⚠️ 근사치)`, bare `⚠️` |
| `※` scope annotation | `※ 제3자 업로드 클립 …` |
| `—` aside headers: `— (해석 주의\|배제 검토\|검토 필요\|추후 확인)` | `— 해석 주의`, `— 배제 검토` |
| Bracketed caveat asides: `\((근사치\|단일 소스\|Unverified\|미검증)\)` | `(⚠️ 근사치)` |
| Bare meta-words standing alone as an aside (not inside a sentence) | `Unverified`, `근사치` as a lone bullet tail |

Regex sketch: `⚠|※|—\s*(해석 주의|배제 검토|검토 필요|추후 확인)|\((⚠️|근사치|단일 소스|Unverified|미검증)[^)]*\)`

Allowed replacements (the information is preserved, the artifact is not):

| Mechanism | Example |
|-----------|---------|
| In-sentence plain-language qualifier | `약 16.3억 달러` (`≈`/`⚠️ 근사치` → `약`), `추정치 기준`, `미검증 집계`, `언론 보도 기준` |
| Plain-language footnote (field `footnote:`) | `라면 수출 수치는 농식품부 계열 집계 기준. 관세청 HS 기준과는 집계 차이가 있음.` |
| Migration into Script (narration) for verbal delivery | per the ※-cleanup pattern |

The distinction that matters: a **qualifier woven into the claim** (`약`, `~기준`, `추정치`) is audience content and is correct; a **glyph/aside addressed at the analyst** (`⚠️`, `※`, `— 해석 주의`) is internal process and is banned.

**R2 — Internal terms and codes require prior definition.** A coined term or internal framework label may appear on a slide only **on or after** the slide that introduces its definition. Dividers, part descriptions, and early-chapter slides MUST use plain language. This includes internal citation codes — they never appear outside the references slide (R3).

Ban patterns:

| Pattern | Example |
|---------|---------|
| Coined compound term used before its defining slide | `15셀` in a divider, defined later as `5시장 × 3카테고리 = 15셀` |
| Internal citation codes in visible text | `(R4·R1)`, `(R1)`, `R4·R1` — regex: `\(R\d+(\s*[·,]\s*R\d+)*\)` |

Allowed replacement: rewrite the pre-introduction occurrence in plain language (`시장별 × 카테고리별 판정 매트릭스` instead of `15셀` in the divider). The term then appears for the first time on its defining slide, where the definition is the slide's content.

Enforcement method: after writing slide_deck.md, scan coined terms per slide order. Any term that a reader meeting the deck for the first time could not resolve at that slide is either defined there or rewritten in plain language.

**R3 — No internal citation-code footers; deck-level references slide instead.** Internal research-note linkage (`research_notes.md` R-codes) MUST NOT be rendered as per-slide footers. `[Source: R1]`-style entries are banned from slide-visible output.

Field-level rules for `slide_deck.md`:

| Field | Rule |
|-------|------|
| `Sources:` lines | Remain in slide_deck.md as research-note linkage, but may cite **external named sources only** (e.g. `[Source: YouTube — KBS News, 2026-05-29]`, `링크: youtube.com/watch?v=…`). No R-code entries. |
| `footnote:` lines | Plain-language scope/caveat text per R1; no R-codes, no internal file paths. |
| References slide | The single slide-visible surface for R-code linkage — see spec below. |

References slide spec:

- **When required**: mandatory for every deck produced via Stage 1 research (i.e., whenever `research_notes.md` exists). A deck built without internal research notes may omit it.
- **Placement**: after the last content slide, **immediately before the closing punchline slide** (and before the contact slide when present). The punchline remains the deck's last word.
- **Type**: `standard` (Uniform Layout Principle applies). `image_role: none` or a light background; no visual burden.
- **Contents**: one bullet per report, in the form `R{n} — <human-readable report title> (<발행일>)`. **No internal file paths**, no `research_notes.md` references, no URLs to internal notes. The R-code prefix is retained here (and only here) so the audience list stays mappable to the research package.
- **Script**: one or two sentences telling the audience where the numbers come from (e.g. "수치가 궁금하신 부분은 이 보고서들에서 출처를 확인하실 수 있습니다"), no internal process talk.
- **Bullet cap exemption**: the references slide is exempt from the 4-bullet content rule. If entries exceed ~10, group by category (the script may narrate the grouping). Record this exemption in the slide's own design note so Gate 2/3 reviewers do not flag it as a density violation.

**Exception — methodology / quality-gate teaching slides.** A slide whose **designed purpose** is to teach the audience how the analysis was verified (methodology, quality gates, data-provenance explanation) may present verification concepts as first-class content. What remains banned even there: bare internal-process glyphs and asides (R1 patterns), citation-code footers, and citation codes outside the references slide. The exception covers *the concepts*, not *the artifact formats*.

---

### Step 4: Balance Check

Self-review after writing both files:

- Are slide counts balanced across chapters (within ±20%)?
- Any slides with too many bullets? (4 max recommended, 5 is hard limit)
- No more than 3 consecutive slides without visuals?
- Does every slide have a `script` field with narration text?
- If multi-language narration is requested, do translated script fields exist?
- **Uniform Layout check**: Do ALL content slides (between cover and closing) use `type: standard`? If any content slide uses `punchline` or another non-standard type, convert it to `standard`.
- No `⚠️`/`※`/`— 해석 주의`-style internal annotations in any slide-visible field
- No coined term or internal code used before its defining slide (dividers use plain language)
- No `[Source: R#]` footers; references slide present before the punchline (if research_notes.md exists)

---

## Output Format

- `deliverables/<project>/storyline.md` — narrative flow with chapter structure table
- `deliverables/<project>/slide_deck.md` — per-slide content with type, content bullets, and right-panel spec
- References slide (mandatory when research_notes.md exists): standard type, placed before the punchline, one bullet per report (`R{n} — title (발행일)`), no internal file paths

## Related Skills

- `research` — produces `research_notes.md` consumed by this skill
- `design` — consumes `slide_deck.md` output from this skill
