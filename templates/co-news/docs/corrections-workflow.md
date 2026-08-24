# Corrections Workflow

> Published-corrections discipline for the co-news newsroom — every material error in published work is visible to the reader, never silently edited. Transparency over face-saving is what distinguishes a correction from an unauthorized rewrite.

## Core Principle

**No silent edits on substantive errors.** Every material correction to a published article includes a visible correction note that states what was wrong, what is correct, when the correction was made, and who adjudicated the change. This discipline is non-negotiable — it is what distinguishes a legitimate news organization from content that can be altered post-publication without reader awareness.

## Error Severity Taxonomy

| Class | Definition | Examples | Response Path |
|-------|-----------|----------|---------------|
| **F1** | Factual or numerical error in substance | Incorrect revenue figure, wrong date, misstated ownership stake, erroneous percentage | Same-working-day correction with visible note |
| **F2** | Attribution or quote error | Misattributed quote, incorrect source citation, wrong spokesperson attribution | Same-working-day correction with visible note |
| **F3** | Headline or summary overstates body | Headline claims "collapse" but article describes "decline"; summary misrepresents nuanced findings | Within 24h correction with visible note + original headline preserved |
| **F4** | Non-substantive error | Typo, formatting, broken link, minor grammatical error | Batched correction note (no urgency deadline) |
| **F5** | Legal or defamation-risk error | Potential libel, unauthorized private information, legally dubious claim | Immediate escalation to legal-researcher; unpublish unless cleared |

**Severity mapping**: F5 errors ALWAYS route through legal-researcher before any correction text is published. F1, F2, and F3 errors require fact-checker classification before correction. F4 errors are batched by style-editor.

## Flagging Intake

**Who can flag a potential error:**

- **Reporter self-report** — Re-reading own published work and discovering an error
- **Fact-checker post-publish audit** — Routine review of published articles against the source-verification-ledger
- **Reader/external report** — Communications from any channel (comments, email, social media) routed to any agent
- **Visual-editor on graphic errors** — Discoveries during figure maintenance or reuse

**Where flags land:** A single corrections queue owned by pm. All flags, regardless of source, are logged in a triage file at `docs/output/corrections-triage.md` with columns: date_flagged, article_slug, flag_source, preliminary_class, status.

## Adjudication

**Classification workflow:**

1. **Triage** — pm acknowledges receipt within 4 hours and assigns preliminary classification
2. **Fact-checker review** — For F1/F2/F3 errors, fact-checker verifies the error against the source-verification-ledger and the original sources. Determines the correct information.
3. **Legal-researcher gate** — For F5 errors or any potential defamation issue, legal-researcher MUST sign off before any correction text is published. No exceptions.
4. **pm decision** — pm makes the final call on classification and correction path. Disagreements between fact-checker and other agents are resolved by pm; legal-researcher has veto on F5 items.

**Response deadlines:**

| Class | Response Deadline |
|-------|-------------------|
| F1 | Same working day (within 8 hours of classification) |
| F2 | Same working day (within 8 hours of classification) |
| F3 | Within 24 hours of classification |
| F4 | Batched weekly (no urgency deadline) |
| F5 | Immediate escalation; unpublish until legal-researcher clears |

## Correction Protocol

**What a correction looks like in the artifact:**

All substantive corrections (F1, F2, F3) include:

1. **In-place fix** — The error is corrected in the body text
2. **Appended correction note** — A visible block at the end of the article with the following template:

```markdown
## Correction Notice

**Original error:** [Brief description of what was wrong]  
**Corrected to:** [What is now correct]  
**Correction date:** [YYYY-MM-DD]  
**Adjudicated by:** [pm / fact-checker / legal-researcher]  
**Class:** [F1/F2/F3]
```

**Headline corrections (F3):** The original headline is preserved in the correction note. Example:

```markdown
**Original headline:** "Company X stock collapses 20%"  
**Corrected headline:** "Company X stock declines 12%"
```

**Preserved strikethrough or quoted original:** For F1 and F2 substantive changes, the original text may be quoted in the correction note but NEVER silently altered. The correction note is the only place where the "before" state appears — no inline strikethrough or other visual editing marks in the article body.

**F4 non-substantive errors:** Fixed silently; batched correction note appears weekly at `docs/output/corrections-log.md` without individual article notes.

## Corrections Register

**Persistent log location:** `docs/output/corrections-log.md` (single workspace-wide log)

**Table columns:**

| Column | Description |
|--------|-------------|
| correction_date | ISO 8601 date (YYYY-MM-DD) |
| article_slug | Article identifier or URL slug |
| class | F1/F2/F3/F4/F5 |
| summary | One-line description of the error and correction |
| adjudicator | pm, fact-checker, or legal-researcher |
| resolution | "Corrected with note", "Unpublished", "Batched" |

**Per-article corrections section (optional):** If a single article accumulates multiple corrections, a per-article `_corrections.md` file may be added to the article's `deliverables/drafts/<article>/` directory. This file references the main register and provides article-specific context.

## Unpublish vs Correct

**Decision rule:**

- **Correct in place with note** — Default for F1, F2, F3, and F4 errors. The article remains live; errors are fixed; correction note is appended.
- **Unpublish** — Reserved for F5 errors where legal-researcher advises that the article poses defamation or legal risk, OR for articles that are fundamentally unsound due to complete sourcing failure.
- **Placeholder note** — When an article is unpublished, a placeholder note is left behind stating "This article was removed on [date] pending further review. Contact [newsroom contact] for more information." Never a 404-style disappearance.

**pm authority:** The unpublish decision requires pm approval. Legal-researcher has veto authority on F5 items and can recommend unpublish; pm executes.

## Source-Verification-Ledger Integration

**Correction updates to the ledger:**

When a correction affects the source-verification-ledger (i.e., the error was sourcing-related or the correct information requires new sources), the fact-checker must:

1. **Update the ledger** — Add a new row documenting the correction, with the correct sources and verification status
2. **Re-verify NEWS-R1 compliance** — The two-source rule must be satisfied for the corrected claim. If the correction introduces a single-source claim, the article is flagged for further review before republish.
3. **Reference the correction** — The ledger update must reference the corrections-log entry date for traceability.

**Reporter accountability:** Self-reported errors discovered by the reporter are logged with the reporter's name in the "flag_source" column. Repeated self-reports trigger a pm review of the reporter's workflow but are never penalized — transparency is encouraged, not punished.

## Role Summary Table

| Agent | Corrections Responsibility |
|-------|---------------------------|
| **pm** | Queue owner; adjudicator; final decision-maker; executes unpublish decisions; maintains corrections-log |
| **fact-checker** | Classifies F1/F2/F3 errors; verifies errors against the source-verification-ledger; updates ledger post-correction; re-verifies NEWS-R1 compliance |
| **legal-researcher** | F5 gatekeeper; must sign off before any legal-risk correction is published; recommends unpublish for defamation risk |
| **reporter** | Self-report duty — encouraged to re-read own published work and flag errors; provides correct information for reporter-originated errors |
| **style-editor** | F4 batching — fixes non-substantive errors and maintains weekly batched correction notes |
| **visual-editor** | Graphic correction path — flags errors in infographics; provides corrected SVG versions; updates figure manifests |
| **financial-analyst** | Numeric re-verification — verifies corrected figures against DART data when market-data errors are discovered |

## Related Skills and Rules

- **source-verification-ledger** — Evidence records that corrections reference and update
- **NEWS-R1** — Two-source rule that must be re-verified after sourcing-related corrections
- **financial-journalism-style-guide.md** — Style conventions that correction notes follow (Korean register if applicable)

---

*This workflow is modeled after Reuters' published-corrections discipline, adapted to the co-news newsroom's agent-driven workflow and source-verification requirements.*
