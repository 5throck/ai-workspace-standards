# Meeting Transcript
**Date**: 2026-05-27
**Topic**: CONSTITUTION.md restructuring — hub-and-spoke split with section files linked from index
**Participants**: pm, architect, auditor
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

**[Facilitator]**:

Today's agenda: CONSTITUTION.md has grown to 843 lines across 8 major sections and is becoming unwieldy. We are here to decide whether and how to split it into multiple files, and how those files should relate to the original. Architect opens with a structural proposal; Auditor challenges anything that might create consistency risk.

---

**Architect**: (Round 1)

CONSTITUTION.md currently has 8 sections ranging from 38 to 114 lines each, plus a session log that was accidentally prepended — itself a structural signal. At 843 lines, no AI tool will confidently hold the full document in working memory alongside task files, and humans are not reading it cover-to-cover either.

Proposal: a **hub-and-spoke model**. CONSTITUTION.md becomes a compact index (~80–120 lines) containing the workspace overview, a one-paragraph summary of each section, and a relative link to the full section file. Each spoke file lives in `docs/constitution/`:

```
docs/constitution/
├── 01-folder-structure.md
├── 02-memory-system.md
├── 03-pr-workflow.md
├── 04-i18n.md
├── 05-multi-agent-architecture.md
├── 05.6-agent-lifecycle.md
├── 06-skills.md
├── 06.5-script-lifecycle.md
├── 07-new-project.md
└── 08-coding-guidelines.md
```

CONSTITUTION.md section headers become one-liner summaries with `→ [Full details](docs/constitution/NN-slug.md)` links. Existing `§N` anchor references resolve correctly because the hub preserves heading anchors — the section files carry the body text.

Question to Auditor: does anchor-preservation satisfy your cross-reference integrity concern?

---

**Auditor**: (Round 1)

The hub-and-spoke model is structurally sound, but two consistency risks must be addressed.

**Risk 1 — Reference resolution**: Dozens of `CONSTITUTION.md §5` citations exist in `CLAUDE.md`, `GEMINI.md`, `agents/*.md`, `AGENTS.md`, and hook comments. Markdown anchor links resolve correctly if the hub preserves heading anchors. Plain-text citations still direct readers to CONSTITUTION.md, which points to the full section. Satisfied on this point.

**Risk 2 — Tool-loading regression** (the critical one): AI tools currently load CONSTITUTION.md as a single document at session start. After the split, the hub gives orientation only. Unless tools are explicitly instructed to also load `docs/constitution/*.md` files, they will operate on incomplete rules. `CLAUDE.md` currently says "read CONSTITUTION.md for workspace standards" — a 120-line index means Claude misses §8 Coding Guidelines entirely unless it follows every link.

Counter-proposal: **selective extraction only**. Pull §5 Multi-Agent Architecture (107 lines) and §8 Coding Guidelines (107 lines) into standalone files; keep everything else inline. The hub remains ~630 lines, tool-loading does not regress, and the two heaviest sections become self-contained references.

Question to Architect: does partial extraction satisfy maintainability, or does the full file require complete restructure?

---

**Architect**: (Round 2)

Auditor's tool-loading regression concern is valid but addressable. Passive loading at 843 lines is already imperfect — context window budgets are real. The split surfaces a loading problem that already exists and gives a mechanism to fix it explicitly.

The mechanism: a **`## Required Reading` block** at the top of CONSTITUTION.md, before the index:

```markdown
## Required Reading
> AI tools MUST load these files at session start in addition to this document:
> - `docs/constitution/05-multi-agent-architecture.md`
> - `docs/constitution/08-coding-guidelines.md`
```

`CLAUDE.md` and `GEMINI.md` update from "read CONSTITUTION.md" to "read CONSTITUTION.md and its Required Reading list." One surgical edit to two files.

On Auditor's selective extraction: 630 lines still does not solve the AI context problem — it solves human readability only. The full split at 80–120 lines forces the explicit loading pattern we actually need.

Concession to Auditor: each `docs/constitution/` file begins with a back-link header:
```markdown
> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §5 Multi-Agent Architecture
```
This preserves single-source-of-truth semantics.

Question to Auditor: does `Required Reading` block plus back-links endorse the full split?

---

**Auditor**: (Round 2)

Endorsing the full split on four conditions — these become the acceptance criteria:

1. **`Required Reading` block** in the hub CONSTITUTION.md, naming which section files must be loaded at session start.
2. **Back-link + canonical warning** in every `docs/constitution/` file: "Do not edit in isolation; changes must be reflected in the hub index."
3. **`audit.sh` extension**: verify existence and non-emptiness of all `docs/constitution/` files referenced by CONSTITUTION.md. Provides automated regression protection.
4. **Full propagation list**: Architect estimated 2 files for config updates; Auditor identified 4–6 (`CLAUDE.md`, `GEMINI.md`, `templates/common/docs/context.md`, variant CLAUDE.md files). Exact list must be enumerated before implementation.

With these four in scope, I endorse the full hub-and-spoke split.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Architect | Enumerate all files referencing CONSTITUTION.md; produce hub-and-spoke file structure spec | Design |
| A-02 | Architect | Draft hub CONSTITUTION.md (80–120 lines) with Required Reading block, section summaries, and links | Design |
| A-03 | Automation-Engineer | Create `docs/constitution/` directory; migrate each section into its file with back-link + canonical warning | Implementation |
| A-04 | Automation-Engineer | Update all AI config files (CLAUDE.md, GEMINI.md, variant files) to load Required Reading section files | Implementation |
| A-05 | Automation-Engineer | Extend `audit.sh` to verify existence and non-emptiness of all referenced `docs/constitution/` files | Implementation |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | CONSTITUTION.md hub is 80–120 lines with Required Reading block and section summary + link per section | Line count + manual review |
| C-02 | All 10 section files exist in `docs/constitution/` with back-link header and canonical warning | `ls docs/constitution/` + grep |
| C-03 | `audit.sh` checks for existence and non-emptiness of all section files | `bash scripts/audit.sh` passes |
| C-04 | All AI config files updated to reference Required Reading list | grep across CLAUDE.md, GEMINI.md, context.md files |
| C-05 | All existing `CONSTITUTION.md §N` anchor links resolve correctly on GitHub | Manual spot-check on PR |
