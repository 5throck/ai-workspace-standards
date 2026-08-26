# Wire Format — Brief & Article Dispatch Templates

> Agency dispatch structure for co-news deliverables: every draft and brief carries a standard wire header (slug, dateline, source line) so files route between agents, survive corrections, and remain traceable to the citation ledger. Closes `docs/variant-benchmark-backlog.md` §9 "No wire-format output templates", closed 2026-08-26.

## Why a wire header

The deliverable tree (`deliverables/drafts/<article>/`) passes files between five agents and two QA gates before publication. Without a header convention, each file invents its own identity — the corrections triage keys on `article_slug` (see [corrections-workflow.md](corrections-workflow.md)) and the style-lint report opens with a slug line, so the slug must exist, be predictable, and never drift between `draft.md`, `final.md`, and any correction. The wire header is the assignment's filing identity: assigned once, stable through publication and corrections.

## Header fields

| Field | Format | Rules |
|-------|--------|-------|
| **Slug** | `<topic>-<desk>-<yyyymmdd>` kebab-case (e.g. `semiconductor-exports-mof-20260826`) | Assigned by pm at Phase 3 kickoff. STABLE for the life of the assignment — `draft.md`, `final.md`, ledger references, corrections-triage rows, and figures manifest all use the same slug. Never rename mid-assignment; a factual rewrite that changes the story's subject is a new assignment, not a new slug. |
| **Dateline** | EN: `SEOUL, Aug 26 –` (CITY, Mon DD –) · KR: `CITY=` desk-prefix convention (city name written in Korean in Korean-language articles) | City where the story was reported + filing date. Leads the body text on `final.md`; on internal files (`draft.md`, briefs) it carries the preparation date. |
| **Source line** | EN: `Reporting by <reporter>; Editing by <style-editor>` | Closes `final.md`. Names the humans/agents in the chain actually responsible; sources themselves are cited in the body per the ledger, never in the source line. |
| **Register / Language** | `Register: economic-daily / IB-specialist · Language: Korean / other` | Already consumed by the style-lint report header — restated here so the wire header is the single top-of-file block. |

## Article wire template (`draft.md`, `final.md`)

```markdown
<!-- wire: slug=<topic>-<desk>-<yyyymmdd> | register=<economic-daily|IB-specialist> | language=<korean|english|other> -->

# [Headline]

[dateline] — [lead paragraph: the new fact, sourced, in one breath]

[body — claims cite the ledger; figures follow the figure-formatting locale rule]

---

*Reporting by [reporter]; Editing by [style-editor]*
```

The HTML comment carries the machine-readable fields; the visible article shows dateline and source line only. `final.md` is `draft.md` plus the Phase 4–6 passes; the wire comment is preserved verbatim between them.

## Brief wire template (`brief/` deliverables)

```markdown
<!-- wire: slug=<topic>-<desk>-<yyyymmdd> | register=<…> | language=<…> | desk=financial-analyst | receipts=<n> -->

# Narrative Brief — [company, period]

## Headline Numbers
| metric | value | YoY/QoQ | receipt # |

## Context Notes
…

## Flags for Legal Review
…
```

Briefs are internal dispatch: dateline is replaced by `desk` + preparation context, and `receipts` names how many ledger receipts the numbers stand on (the ledger itself remains the SSOT — `source-verification-ledger` skill). The `financial-narrative-brief` skill's section structure is unchanged; the wire comment wraps it.

## Ownership and checks

| Phase | Owner | Duty |
|-------|-------|------|
| 3 (draft) | reporter | writes the wire header on `draft.md`; slug matches the assignment record |
| 4 (style pass) | style-editor | validates the wire header as part of `style-lint-checklist` (slug present + matches ledger/triage references; source line names the actual chain) |
| 6 (publish gate) | pm | `final.md` wire header is byte-stable vs `draft.md` except headline/body edits — slug, register, language never change |

## Corrections and refiles

Corrected articles keep the original slug — the corrections triage and any published correction note reference it. A same-day substantive refile appends the suffix `-upd<N>` to the slug in the wire comment only (`semiconductor-exports-mof-20260826-upd1`); the correction note itself follows [corrections-workflow.md](corrections-workflow.md) severity classes. Slug renames are prohibited after Phase 3 — a slug that no longer matches its story means the assignment record is wrong, and pm re-adjudicates rather than renaming silently.
