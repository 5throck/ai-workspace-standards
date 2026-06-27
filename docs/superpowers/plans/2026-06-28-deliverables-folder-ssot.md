# `deliverables/` Folder + SSOT Output Path Centralization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move engagement deliverable output paths from scattered `docs/` hard-coding to a centralized `deliverables/` folder structure with `co-consult.context.md` as the single source of truth for all output destination paths.

**Architecture:** Introduce a top-level `deliverables/` directory (with `reports/`, `drafts/`, `research/`, `presentations/` subdirectories) created at scaffolding time. All 41 hard-coded path references across 9 agent files and 2 skill files are replaced by SSOT reference directives pointing to the Output Destination Mapping table in `co-consult.context.md`. Two scaffold scripts (`new-project.ts`, `create-l2-scaffold.ts`) are updated to create these folders automatically.

**Tech Stack:** TypeScript (Node.js `fs`, `path`), Markdown, existing scaffolding tooling (`bun`)

**Spec:** `docs/superpowers/specs/2026-06-28-deliverables-folder-ssot-design.md`

---

### Task 1: Update `scripts/new-project.ts` — Add `deliverables/` folder creation

**Files:**
- Modify: `scripts/new-project.ts:337` (insert between variant copy and step 2.5)

- [ ] **Step 1: Add deliverables/ creation logic after variant template copy**

Insert the following block after line 337 (`console.log('  ✅ Variant templates copied');`) and before line 339 (step 2.5 L1-B metadata stripping). The logic reads the variant name and creates the folder structure only for co-consult:

```typescript
// ── 2.3b. Create deliverables/ subdirectories (co-consult) ───────────────────
if (variant === 'co-consult') {
  const delRoot = join(projectDir, 'deliverables');
  const delDirs = [
    { name: 'reports', desc: 'Final deliverables, client-ready reports' },
    { name: 'drafts', desc: 'Work-in-progress documents and drafts' },
    { name: 'research', desc: 'Research notes, source materials, data' },
    { name: 'presentations', desc: 'Client presentation decks' },
  ];
  for (const d of delDirs) {
    const dir = join(delRoot, d.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'README.md'), [
      `# deliverables/${d.name}/`,
      '',
      d.desc + '.',
      '',
      '## Output Destination',
      '',
      'See Output Destination Mapping in `docs/co-consult.context.md` for per-agent paths and naming conventions.',
      '',
    ].join('\n'));
  }
  console.log('  ✅ deliverables/{reports,drafts,research,presentations}/ created');
}
```

- [ ] **Step 2: Verify the insertion point is correct**

Read `scripts/new-project.ts` and confirm the new block sits between line 337 and the step 2.5 comment. The `variant` variable is already available at this scope (defined earlier in the script).

- [ ] **Step 3: Commit**

```bash
git add scripts/new-project.ts
git commit -m "feat(scaffold): create deliverables/ subdirectories for co-consult at scaffolding time"
```

---

### Task 2: Update `scripts/create-l2-scaffold.ts` — Update consulting domain dirs

**Files:**
- Modify: `scripts/create-l2-scaffold.ts:500` (DOMAIN_DOC_DIRS.consulting)

- [ ] **Step 1: Update DOMAIN_DOC_DIRS and createDomainDocs for consulting**

Change the `consulting` entry in `DOMAIN_DOC_DIRS` (line 500) from:
```typescript
consulting: ["reports", "deliverables", "research"],
```
to:
```typescript
consulting: ["deliverables/reports", "deliverables/drafts", "deliverables/research", "deliverables/presentations"],
```

Then update the `createDomainDocs` function (line 521-522) to use nested `path.join` for paths containing `/`:

Change line 522 from:
```typescript
gitkeep(path.join(projectDir, "docs", d));
```
to:
```typescript
gitkeep(path.join(projectDir, d));
```

This works because the entries now already include `"docs"` vs `"deliverables/..."` prefixes — the function should just join with `projectDir` directly.

- [ ] **Step 2: Verify other domain entries are unaffected**

Check that `ehs`, `development`, `design` entries still work correctly. Since their entries like `"reports"` would resolve to `<projectDir>/reports` instead of `<projectDir>/docs/reports`, update them too:

Change lines 497-499 from:
```typescript
ehs: ["reports", "procedures", "blueprint"],
development: ["drafts", "reports", "research"],
design: ["drafts", "reports", "research"],
```
to:
```typescript
ehs: ["docs/reports", "docs/procedures", "docs/blueprint"],
development: ["docs/drafts", "docs/reports", "docs/research"],
design: ["docs/drafts", "docs/reports", "docs/research"],
```

And update `DEFAULT_DOC_DIRS` (line 502) from:
```typescript
const DEFAULT_DOC_DIRS = ["drafts", "reports", "research"];
```
to:
```typescript
const DEFAULT_DOC_DIRS = ["docs/drafts", "docs/reports", "docs/research"];
```

This ensures all domains use explicit full relative paths and the `gitkeep` call can simply `path.join(projectDir, d)` without a hardcoded `"docs"` prefix.

- [ ] **Step 3: Commit**

```bash
git add scripts/create-l2-scaffold.ts
git commit -m "feat(scaffold): update DOMAIN_DOC_DIRS to use explicit paths, add deliverables/ for consulting"
```

---

### Task 3: Update `co-consult.context.md` — SSOT path migration

**Files:**
- Modify: `templates/co-consult/docs/co-consult.context.md:230-256` (folder table + output mapping + on-demand note)

- [ ] **Step 1: Update the File Organization Policy table (lines 230-238)**

Replace the current folder structure table and on-demand note with:

```markdown
| Folder | Purpose |
|--------|----------|
| `deliverables/reports/` | Final deliverables, client-ready reports |
| `deliverables/drafts/` | Work-in-progress documents and drafts |
| `deliverables/research/` | Research notes, source materials, data |
| `deliverables/presentations/` | Client presentation decks |
| `memory/` | Session logs, meeting transcripts |

> **Note**: The `deliverables/` subdirectories and their README.md files are created automatically during project scaffolding.
```

- [ ] **Step 2: Update the Output Destination Mapping table (lines 244-256)**

Replace all `docs/reports/` → `deliverables/reports/`, `docs/drafts/` → `deliverables/drafts/`, `docs/research/` → `deliverables/research/`, `docs/presentations/` → `deliverables/presentations/` in the table. The updated table:

```markdown
| Agent | Output Type | Destination | Naming Convention |
|-------|-------------|-------------|-------------------|
| Industry Expert | Industry analysis reports, trend briefings | `deliverables/reports/` | `{topic}-industry-analysis-{YYYY-MM-DD}.md` |
| Industry Expert | Regulatory overviews | `deliverables/research/` | `{topic}-regulatory-{YYYY-MM-DD}.md` |
| Strategy Analyst | Research findings, competitive analyses, financial models | `deliverables/research/` | `{topic}-{report-type}-{YYYY-MM-DD}.md` |
| Data Analyst | Data analysis reports, model outputs | `deliverables/research/` | `{topic}-data-analysis-{YYYY-MM-DD}.md` |
| Subject Matter Expert | Functional analysis reports, benchmarking | `deliverables/research/` | `{topic}-{function}-analysis-{YYYY-MM-DD}.md` |
| Change Management Partner | Culture statements, readiness assessments | `deliverables/research/` | `{topic}-change-assessment-{YYYY-MM-DD}.md` |
| Communications Lead | Consulting reports, stakeholder comms | `deliverables/reports/` | `{deliverable-type}-{YYYY-MM-DD}.md` |
| Communications Lead | Executive presentations | `deliverables/presentations/` | `{deck-title}-{YYYY-MM-DD}.md` |
| Solutions Architect | Architecture documents, feasibility assessments | `deliverables/reports/` | `{topic}-architecture-{YYYY-MM-DD}.md` |
| Workstream Lead | Status reports, execution plans, risk logs | `deliverables/drafts/` | `{workstream}-{report-type}-{YYYY-MM-DD}.md` |
| Delivery Manager | Project status reports, stakeholder trackers | `deliverables/drafts/` | `delivery-{report-type}-{YYYY-MM-DD}.md` |
```

- [ ] **Step 3: Update Domain Rule 6 (line 267)**

Replace the current text with stronger SSOT enforcement:

```markdown
6. All agent-produced deliverables MUST be saved to their designated output folder per the **Output Destination Mapping** table above. Agents MUST read this table before saving any file. Do not hard-code output paths in agent or skill definitions — this table is the single source of truth. Create the destination folder if it does not exist.
```

- [ ] **Step 4: Commit**

```bash
git add templates/co-consult/docs/co-consult.context.md
git commit -m "docs(co-consult): migrate output paths from docs/ to deliverables/, strengthen SSOT directive"
```

---

### Task 4: Replace hard-coded paths in 9 agent files with SSOT reference

**Files:**
- Modify: `templates/co-consult/agents/communications-lead.md:93-98`
- Modify: `templates/co-consult/agents/industry-expert.md:145-149`
- Modify: `templates/co-consult/agents/solutions-architect.md:147-152`
- Modify: `templates/co-consult/agents/delivery-manager.md:93-98`
- Modify: `templates/co-consult/agents/workstream-lead.md:134-139`
- Modify: `templates/co-consult/agents/change-management-partner.md:142-147`
- Modify: `templates/co-consult/agents/data-analyst.md:155-159`
- Modify: `templates/co-consult/agents/sme.md:159-163`
- Modify: `templates/co-consult/agents/strategy-analyst.md:93-99`

- [ ] **Step 1: Replace Output Destination sections in all 9 agent files**

For each agent file, replace the entire `## Output Destination` section (heading + bullet list + create-folder line) with this unified SSOT reference block:

```markdown
## Output Destination

> **Single Source of Truth**: See Output Destination Mapping in `docs/co-consult.context.md`.
> This table defines the exact destination folder and naming convention for every deliverable this agent produces.
> Agent MUST read this table before saving any file. Do not hard-code output paths.
```

**Agent-specific replacement targets** (the `old_string` for each file):

**communications-lead.md** (lines 93-98):
```
## Output Destination

- Consulting reports and stakeholder communications → `docs/reports/{deliverable-type}-{YYYY-MM-DD}.md`
- Executive presentations and slide decks → `docs/presentations/{deck-title}-{YYYY-MM-DD}.md`
- User guides and documentation packages → `docs/reports/{topic}-guide-{YYYY-MM-DD}.md`
- Create the target folder if it does not exist before saving.
```

**industry-expert.md** (lines 145-149):
```
## Output Destination

- Industry analysis reports and trend briefings → `docs/reports/{topic}-industry-analysis-{YYYY-MM-DD}.md`
- Regulatory landscape overviews → `docs/research/{topic}-regulatory-{YYYY-MM-DD}.md`
- Create the target folder if it does not exist before saving.
```

**solutions-architect.md** (lines 147-152):
```
## Output Destination

- Architecture documents and technical designs → `docs/reports/{topic}-architecture-{YYYY-MM-DD}.md`
- Implementation roadmaps → `docs/reports/{topic}-roadmap-{YYYY-MM-DD}.md`
- Feasibility assessments → `docs/reports/{topic}-feasibility-{YYYY-MM-DD}.md`
- Create the target folder if it does not exist before saving.
```

**delivery-manager.md** (lines 93-98):
```
## Output Destination

- Project status reports and stakeholder trackers → `docs/drafts/delivery-{report-type}-{YYYY-MM-DD}.md`
- Risk and issue logs → `docs/drafts/delivery-risk-log-{YYYY-MM-DD}.md`
- Meeting notes → `docs/drafts/delivery-meeting-notes-{YYYY-MM-DD}.md`
- Create the target folder if it does not exist before saving.
```

**workstream-lead.md** (lines 134-139):
```
## Output Destination

- Status reports and execution plans → `docs/drafts/{workstream}-{report-type}-{YYYY-MM-DD}.md`
- Risk and issue logs → `docs/drafts/{workstream}-risk-log-{YYYY-MM-DD}.md`
- Quality gate checklists → `docs/drafts/{workstream}-quality-gate-{YYYY-MM-DD}.md`
- Create the target folder if it does not exist before saving.
```

**change-management-partner.md** (lines 142-147):
```
## Output Destination

- Culture statements and change narratives → `docs/research/{topic}-change-assessment-{YYYY-MM-DD}.md`
- Organizational readiness assessments → `docs/research/{topic}-readiness-{YYYY-MM-DD}.md`
- Stakeholder alignment maps → `docs/research/{topic}-stakeholder-alignment-{YYYY-MM-DD}.md`
- Create the target folder if it does not exist before saving.
```

**data-analyst.md** (lines 155-159):
```
## Output Destination

- Data analysis reports → `docs/research/{topic}-data-analysis-{YYYY-MM-DD}.md`
- Model outputs and dashboards → `docs/research/{topic}-data-model-{YYYY-MM-DD}.md`
- Create the target folder if it does not exist before saving.
```

**sme.md** (lines 159-163):
```
## Output Destination

- Functional analysis reports → `docs/research/{topic}-{function}-analysis-{YYYY-MM-DD}.md`
- Benchmarking summaries → `docs/research/{topic}-benchmarking-{YYYY-MM-DD}.md`
- Create the target folder if it does not exist before saving.
```

**strategy-analyst.md** (lines 93-99):
```
## Output Destination

- Research findings reports → `docs/research/{topic}-research-{YYYY-MM-DD}.md`
- Competitive landscape analyses → `docs/research/{topic}-competitive-{YYYY-MM-DD}.md`
- Financial models → `docs/research/{topic}-financial-model-{YYYY-MM-DD}.md`
- Strategic options frameworks → `docs/research/{topic}-strategic-options-{YYYY-MM-DD}.md`
- Create the target folder if it does not exist before saving.
```

**The replacement for ALL agent files** (same for every agent):
```markdown
## Output Destination

> **Single Source of Truth**: See Output Destination Mapping in `docs/co-consult.context.md`.
> This table defines the exact destination folder and naming convention for every deliverable this agent produces.
> Agent MUST read this table before saving any file. Do not hard-code output paths.
```

- [ ] **Step 2: Verify no remaining `docs/reports`, `docs/drafts`, `docs/research`, `docs/presentations` in any agent file**

Run a grep across `templates/co-consult/agents/` to confirm zero remaining matches.

- [ ] **Step 3: Commit**

```bash
git add templates/co-consult/agents/
git commit -m "refactor(co-consult): replace hard-coded output paths in agent files with SSOT reference"
```

---

### Task 5: Replace hard-coded paths in 2 skill files with SSOT reference

**Files:**
- Modify: `templates/co-consult/skills/consulting-report-writing/SKILL.md:71`
- Modify: `templates/co-consult/skills/executive-presentation/SKILL.md:53`

- [ ] **Step 1: Replace Save Output To in consulting-report-writing/SKILL.md**

Replace (line 71):
```
> **Save Output To**: `docs/reports/{deliverable-type}-{YYYY-MM-DD}.md` — create the folder if it does not exist.
```
with:
```
> **Save Output To**: See Output Destination Mapping in `docs/co-consult.context.md` for destination folder and naming convention. Create the folder if it does not exist. Do not hard-code output paths.
```

- [ ] **Step 2: Replace Save Output To in executive-presentation/SKILL.md**

Replace (line 53):
```
> **Save Output To**: `docs/presentations/{deck-title}-{YYYY-MM-DD}.md` — create the folder if it does not exist.
```
with:
```
> **Save Output To**: See Output Destination Mapping in `docs/co-consult.context.md` for destination folder and naming convention. Create the folder if it does not exist. Do not hard-code output paths.
```

- [ ] **Step 3: Verify no remaining hard-coded output paths in skills/**

Run a grep across `templates/co-consult/skills/` to confirm zero remaining matches for `docs/reports`, `docs/drafts`, `docs/research`, `docs/presentations`.

- [ ] **Step 4: Commit**

```bash
git add templates/co-consult/skills/
git commit -m "refactor(co-consult): replace hard-coded output paths in skill files with SSOT reference"
```

---

### Task 6: Consistency audit — Verify zero remaining hard-coded paths

**Files:** None (verification only)

- [ ] **Step 1: Grep entire `templates/co-consult/` for residual `docs/reports`, `docs/drafts`, `docs/research`, `docs/presentations`**

Run:
```bash
grep -r "docs/reports\|docs/drafts\|docs/research\|docs/presentations" templates/co-consult/ --include="*.md"
```

Expected: Zero matches. If any remain, investigate and fix.

- [ ] **Step 2: Grep `scripts/` for residual old consulting domain paths**

Run:
```bash
grep -n "consulting" scripts/create-l2-scaffold.ts
```

Expected: The consulting entry shows the updated `deliverables/...` paths.

- [ ] **Step 3: Verify `co-consult.context.md` is the only file with `deliverables/reports`, `deliverables/drafts`, `deliverables/research`, `deliverables/presentations` in the templates/co-consult directory**

Run:
```bash
grep -r "deliverables/reports\|deliverables/drafts\|deliverables/research\|deliverables/presentations" templates/co-consult/ --include="*.md"
```

Expected: Only `templates/co-consult/docs/co-consult.context.md` should match (the SSOT). Agent and skill files should reference "Output Destination Mapping" but not contain literal `deliverables/` paths.
