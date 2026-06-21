# Meeting Transcript
**Date**: 2026-06-21
**Topic**: English-only documentation policy exception for Korean legal/regulatory content
**Participants**: architect, auditor, research
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Current workspace policy (CONSTITUTION.md, CLAUDE.md §4, variant context.md files) mandates English for all markdown documents. However, legal/regulatory documents (법령, 조례, 규정) may require Korean as the legally authoritative language. The meeting was convened to design a narrow, auditable exception.

Three agenda items:
1. Exception scope definition — which documents qualify
2. Exception declaration method — how to mark exceptions
3. audit.ts logic update — how to enforce the new rule

---

## Transcript

### Round 1

**[architect]**: (Round 1)

The English-only policy exists because the workspace operates across Claude and Gemini platforms, and inter-agent communication is English-based. Operational documents (agents, skills, governance) must remain English for platform independence.

However, content documents are different. Legal statutes and regulations are artifacts in themselves — not operational guides. This distinction is the core design principle:

- **Operational documents** (agents/, skills/, docs/governance/, CONSTITUTION.md): English mandatory — no exceptions
- **Content documents** (presentations/, research/, statutory texts): may follow content language — exception eligible

Proposed exception criteria — file must meet at least one:
1. **Legal authority**: statutory texts, ordinances, contracts where Korean original has legal force
2. **Translation infeasibility**: legal terminology where English translation distorts meaning or creates legal uncertainty
3. **Source material**: Korean primary sources collected by research agent (original text quotation sections)

Preferred declaration method: **frontmatter**. Folder rules are inflexible; filename prefixes harm readability. Frontmatter embeds intent in the file itself and survives moves and renames.

```yaml
---
lang: ko
lang_reason: legal   # legal | source-material | proper-noun
lang_authority: 국가법령정보센터   # optional — source or authority
---
```

Question to auditor: How does current `audit.ts` Korean detection work, and how complex would frontmatter-based exception handling be?

---

**[auditor]**: (Round 1)

Fully agree with architect's operational vs. content document distinction.

Current `audit.ts` Korean detection logic:
1. Collect official markdown files (agents/, skills/, docs/, templates/ subtrees)
2. Check for Korean Unicode range (가-힣, U+AC00–U+D7A3)
3. Check if path is an exception folder (ko/, locales/ko/)
4. Flag as [FAIL] if Korean found outside exception folders

**Technical complexity of frontmatter exceptions**: Low. The script already reads file contents — adding a `lang: ko` check is ~10–15 lines.

Governance requirement: exceptions must be **traceable**. The `lang_reason` field is mandatory, not optional. Audit must also validate that `lang_reason` is one of the permitted values.

Proposed audit logic:
```
File contains Korean (U+AC00–U+D7A3):
  → Exception folder (ko/, locales/ko/) → PASS
  → frontmatter has lang: ko:
      lang_reason in [legal, source-material, proper-noun] → PASS + INFO log
      lang_reason missing or invalid → FAIL "lang_reason required: legal|source-material|proper-noun"
  → Neither condition met → FAIL "Korean content detected without lang: ko declaration"
```

`lang_authority` field: treat as reference-only, not validated by audit.

Question to research: What file paths does Korean content actually appear in during research agent operation? Is it always under presentations/, or are there other locations?

---

**[research]**: (Round 1)

Korean content appears in several file types during actual research operations:

1. **`presentations/<project>/research_notes.md`**: Frequent Korean primary source quotations from government policy reports and academic journals. Currently in audit scope.

2. **`presentations/<project>/source-verification.md`**: Source-verifier records Korean article titles and authors verbatim. E.g., `Author: 김○○, Title: 「AI 거버넌스 규정 제정 방향」`. Translation reduces accuracy.

3. **`presentations/<project>/slide_deck.md`**: Korean lecture content is inherently Korean.

**Key question**: Whether `presentations/` is currently scanned by audit.ts is critical. If it's already excluded, the practical exception surface is much narrower — only files in templates/, agents/, skills/, docs/ that happen to need Korean.

**Two real exception cases**:
- **Case A**: Standalone statutory text files (e.g., `docs/regulations/개인정보보호법.md`)
- **Case B**: Research notes with mixed English analysis and Korean primary source quotations — file-level frontmatter cannot cleanly handle these

For Case B, inline markers might be needed.

Question to architect: Is a design that supports both file-level and section-level exceptions realistic, or should we restrict to file-level only?

---

### Round 2

**[architect]**: (Round 2)

On Case B (mixed-language files): recommend **file-level exceptions only**. Inline markers (e.g., `<!-- ko-start -->`) increase audit complexity severely — the parser must understand markdown structure, and marker errors (missing pairs, nesting) make the audit unreliable. Simplicity creates reliability.

Practical solution for Case B: file splitting.

```
presentations/<project>/
  research_notes.md          ← English summaries/analysis (audited)
  research_notes_sources.md  ← Korean primary source quotations (lang: ko declared)
```

The `lang: ko + lang_reason: source-material` declaration on the split file covers Case B cleanly.

Proposed scan path policy:

| Path | Scanned | Notes |
|------|---------|-------|
| agents/, skills/, docs/governance/ | ✅ required | English mandatory zone |
| templates/*/agents/, templates/*/skills/ | ✅ required | L1 English mandatory |
| templates/*/docs/*.context.md | ✅ required | Operational docs |
| presentations/ | ❌ excluded | Content artifacts |
| docs/regulations/ (new) | ✅ optional scan + exception allowed | lang: ko declaration passes |
| memory/ | ❌ excluded | Already excluded |

Question to auditor: Do you agree to restrict `lang_reason` to exactly three values (`legal`, `source-material`, `proper-noun`)? And does the same frontmatter approach cover files under templates/ paths (e.g., `templates/co-work/docs/regulations/`)?

---

**[auditor]**: (Round 2)

Confirmed: `lang_reason` restricted to three values. Definitions to be included in CONSTITUTION.md:

| Value | Condition |
|-------|-----------|
| `legal` | Statutory texts, ordinances, regulations, contracts where Korean original has legal force |
| `source-material` | Primary source quotations where translation would compromise academic accuracy |
| `proper-noun` | Files dominated by proper nouns (institution names, place names, person names) |

**templates/ path handling**: Same frontmatter works regardless of path. audit.ts checks frontmatter first, then path. However, `templates/*/agents/*.md` and `templates/*/skills/*.md` must be **explicitly excluded from frontmatter exceptions** — agent and skill definitions are operational documents and must remain English under any circumstance.

**Final audit logic (confirmed)**:

```
Scan target file contains Korean (U+AC00–U+D7A3):
  1. Path is exception folder (ko/, locales/ko/, presentations/, memory/) → PASS
  2. Path is protected path (agents/*.md, skills/*.md) → FAIL (frontmatter exception not permitted)
  3. frontmatter has lang: ko:
       lang_reason in [legal, source-material, proper-noun] → PASS + INFO log
       lang_reason missing or invalid value → FAIL "lang_reason required: legal|source-material|proper-noun"
  4. None of the above → FAIL "Korean content detected without lang: ko declaration"
```

**Proposed CONSTITUTION.md language**:

```markdown
### Language Policy Exception — Korean Legal/Regulatory Content

The English-only policy admits a narrow exception for files where Korean is legally
or academically mandatory. To declare an exception, add to the file's frontmatter:

    lang: ko
    lang_reason: legal   # legal | source-material | proper-noun

Exception is NOT available for: agents/*.md, skills/*.md, CONSTITUTION.md,
CLAUDE.md, GEMINI.md, AGENTS.md, or any variant context.md file.
```

---

**[research]**: (Round 2)

Auditor's confirmed logic and CONSTITUTION.md language are endorsed.

Coverage verification:
- `presentations/` exclusion: if already excluded from current audit, existing research_notes.md and source-verification.md are unaffected ✅
- Standalone statutory files in docs/regulations/ or templates/co-work/docs/regulations/: frontmatter covers it ✅
- Agent/skill files exception prohibition: agreed. agents/research.md must remain English ✅

**One additional clarification**: For `lang_reason: source-material`, files may contain both English analysis and Korean quotations (mixed content). The audit should PASS these files — the restriction is on undeclared Korean, not on mixed-language files that have been explicitly declared. "File contains Korean" is the trigger, not "file is Korean-only."

**Required update scope**: The exception rule must appear consistently in:
- CONSTITUTION.md (primary definition)
- CLAUDE.md §4 Language Policy (Claude platform)
- GEMINI.md equivalent section (Antigravity platform)
- Each variant context.md Language Policy item (for platform parity)

---

## Synthesis

**[auditor]**: (Synthesis)

All three agenda items reached clear consensus.

**Points of Agreement**:

1. **Exception scope**: Operational documents (agents/, skills/, CONSTITUTION.md, CLAUDE.md, GEMINI.md, variant context.md) — English mandatory with no exceptions. Content documents may declare `lang: ko` with `lang_reason`. `lang_reason` is mandatory, restricted to three values: `legal`, `source-material`, `proper-noun`.

2. **Declaration method**: Frontmatter only (`lang: ko` + `lang_reason: <value>`). No inline markers. Mixed-language files (English + Korean quotations) are permitted under `source-material` declaration. File splitting recommended for clean separation.

3. **audit.ts logic**: 4-stage judgment (exception folder → protected path → frontmatter check → FAIL). Protected paths (agents/*.md, skills/*.md) disallow frontmatter exceptions. PASS emits INFO log for traceability.

**Open Questions**: None — full consensus reached.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| C-01 | architect | Medium | Add Language Policy Exception section to CONSTITUTION.md — frontmatter method, `lang_reason` value definitions, protected path list | L0-only | Next |
| C-02 | architect | Low | Update CLAUDE.md §4 Language Policy — sync with CONSTITUTION.md exception rule | Claude | Next |
| C-03 | architect | Low | Update GEMINI.md equivalent section — platform parity with C-02 | Antigravity | Next |
| C-04 | auditor | Medium | Modify `audit.ts` Korean detection logic — implement 4-stage judgment, `lang_reason` allowlist validation, INFO log on PASS | Both | Next |
| C-05 | architect | Low | Update Language Policy item in all 6 variant context.md files (co-deck, co-work, etc.) | Both | Next |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | File with `lang: ko` + valid `lang_reason` passes audit despite Korean content | `bun scripts/audit.ts` on test file |
| 2 | File with `lang: ko` but no/invalid `lang_reason` fails audit with specific error message | `bun scripts/audit.ts` on test file |
| 3 | File under agents/ or skills/ fails audit even with valid `lang: ko` frontmatter | `bun scripts/audit.ts` on test file |
| 4 | File without `lang: ko` declaration fails audit when Korean content present | Existing behavior preserved |
| 5 | PASS with `lang: ko` emits INFO log identifying the file and lang_reason | Audit stdout inspection |
