# Co-News User Guide

**Language**: **English** · [한국어](user-guide_ko.md)

> This guide explains how to *use* a co-news project — how to hand article assignments to
> the newsroom agent team, what happens at each phase, and where output lands. For the full
> roster and repository layout, see [`../README.md`](../README.md); for governance rules,
> see [`../AGENTS.md`](../AGENTS.md).

## 1. Quick Start

1. Bring the assignment to the **PM (Editor-in-Chief)** — it is the single entry point.
   Describe it in plain language: *"Write an article on Hyundai Motor's Q2 earnings,
   Sedaily register, ~1,200 characters."*
2. Phase 1 briefs run **in parallel**: financial-analyst (DART-sourced figures) and
   legal-researcher (regulatory context) — an article is never drafted from an
   unbriefed premise.
3. For any multi-agent task, the PM shows an **execution plan table** and waits for your
   approval before dispatching:

   | Task | Agent | Tier | Model | Platform |
   |------|-------|------|-------|----------|
   | Financial narrative brief | financial-analyst | High | claude-opus-5-0 | Claude Code |
   | Legal context brief | legal-researcher | High | claude-opus-5-0 | Claude Code |
   | Draft article | reporter | Medium | claude-sonnet-5-0 | Claude Code |

4. The **Source Verification Gate** is hard: the reporter is never dispatched while the
   citation ledger shows any `UNVERIFIED` claim (2+ independent sources per claim).
5. After drafting, style editing, and figures, the **Editorial Review Gate** (Phase 6)
   requires sign-off from BOTH fact-checker and style-editor — failures route back to
   the responsible agent, never forward.
6. Close with `/sync` — only after the Editorial Review Gate passes; a draft never
   commits with open fact-check or style items.

> **Rule of thumb**: every factual claim you want in the article belongs in the ledger
> first — if it can't be sourced, it doesn't ship.

## 2. What Kind of Task Do You Have?

| Your scenario | Likely agent(s) | Skill(s) involved |
|---------------|-----------------|-------------------|
| Earnings / disclosure-driven article | financial-analyst → reporter | `financial-narrative-brief`, `k-dart`, `financial-journalism-style` |
| Regulation / legal-driven story | legal-researcher → reporter | `k-law`, `financial-journalism-style` |
| Article drafting / rewrite | reporter, style-editor | `financial-journalism-style`, `ai-tell-reduction` |
| Claim verification / citation ledger | fact-checker | `source-verification-ledger` |
| Natural-human polish (AI-tell removal) | style-editor | `ai-tell-reduction` |
| Charts / infographics | visual-editor | `financial-infographic-svg` |

## 3. The Standard Newsroom Workflow

```
Assignment Intake (PM / Editor-in-Chief)
        │
        ▼
Phase 1 — parallel briefs (financial-analyst + legal-researcher)
        │
        ▼
Phase 2 — Source Verification Gate (ledger: 0 UNVERIFIED claims)
        │
        ▼
Phase 3 — reporter draft
        │
        ▼
Phase 4 — style edit (register + AI-tell reduction, figures re-verified)
        │
        ▼
Phase 5 — figures (visual-editor: one SVG per figure + manifest)
        │
        ▼
Phase 6 — Editorial Review Gate (fact-checker AND style-editor)
        │
        ▼
/sync (commit + PR) — publish-ready final.md
```

Key commands (inherited from the common template):

- `/sync "feat: ..."` — full pipeline: memlog → changelog → audit → commit → PR
- `/memlog "summary"` / `/new-task "name"` — session logging and task blocks
- `/meeting "topic"` — structured newsroom discussion when coverage decisions conflict

Never bypass the gates with direct specialist invocation, and never run raw
`git commit` / `git push` — the hooks will reject it.

## 4. Article Phase Structure

| Phase | Owner | What happens |
|-------|-------|--------------|
| 1 — Briefs | financial-analyst + legal-researcher (parallel) | DART-sourced figure brief + regulatory context brief |
| 2 — Source Verification Gate | fact-checker | Citation ledger built; 0 `UNVERIFIED` claims required |
| 3 — Draft | reporter | Article drafted strictly from the ledger |
| 4 — Style Edit | style-editor | Register conformity + AI-tell reduction; every figure re-verified against the ledger |
| 5 — Figures | visual-editor | One SVG per figure + `figures/manifest.md` |
| 6 — Editorial Review Gate | pm (gatekeeper) | fact-checker AND style-editor sign-off; failures route back, never forward |

Phase 1 is the only parallel stage; after it the pipeline is **strictly sequential** —
each phase's output is the next phase's input.

## 5. Where Your Output Goes

| Output | Location |
|--------|----------|
| Phase briefs | `deliverables/drafts/<article>/brief/` |
| Citation ledger | `deliverables/drafts/<article>/ledger.md` |
| Draft / publish-ready article | `deliverables/drafts/<article>/draft.md` → `final.md` |
| Figures + manifest | `deliverables/drafts/<article>/figures/` |
| Session log entries | `memory/YYYY-MM-DD.md` (indexed by `memory/MEMORY.md`) |

Domain rules to keep in mind:

- One article = one `<article>` directory; never mix two assignments' files.
- No claim ships without 2+ independent sources in the ledger; financial figures trace
  to a specific DART filing (receipt number logged), never estimated.
- Mandatory disclaimers: DART-sourced figures carry "Based on FSS DART (Financial
  Supervisory Service electronic disclosure system) filing data"; k-law-sourced legal
  context carries "Based on National Law Information Center shared data / not legal
  advice".
- Language split: article content defaults to Korean (or the assignment's target
  language); ALL git artifacts (commits, PR titles, branches) are English-only.
- Korean numeral-grouping units (jo/eok/man) appear only in Korean-language articles;
  never mix grouping conventions within a single figure.
- Figure SVGs are never inlined into markdown until `final.md` — drafts reference them
  by path so a rewrite can't silently drop one.
