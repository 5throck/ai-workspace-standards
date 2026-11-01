# docs/ Reorganization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Co-locate all 16 project ADRs in `docs/adr/`, give `designs/` and `plans/` crisp non-overlapping roles via an origin rule, fold the single-file `docs/programs/` category, and prune untracked root cruft — with zero broken cross-references.

**Architecture:** Pure file relocation (`git mv` preserves history) plus a grep-driven cross-reference rewrite. The reference update has two distinct flavors — **full-path** refs (`docs/designs/ADR-NNN-…`) rewritten by a uniform `sed`, and **bare relative** links (`](ADR-NNN-…md)`) in files that stay behind, which need a `../adr/` prefix. Two judgment-call docs (`docs/README.md`, `DOCS-001-design.md`) get manual taxonomy rewrites. Verification is a grep that must come back empty (except documented false-positives and exempt historical logs).

**Tech Stack:** Git Bash (`git mv`, GNU `sed -i`, `git grep`), `bun scripts/audit.ts`, `/sync` pipeline. No source code is touched.

---

## Critical scope notes — READ BEFORE STARTING

These supersede / correct the approved spec (`docs/superpowers/specs/2026-08-02-docs-reorganization-design.md`).

1. **Governance: no direct commits.** Workspace CLAUDE.md forbids `git commit`/`git push`/`--no-verify`. Every change accumulates on the branch and ships via the **single final `/sync`** (Task 8). Do NOT commit per-task.

2. **The spec's §7.1 list (11 files) undercounted.** A pre-flight grep found ~13 *additional* staying-files that link to moving ADRs by **bare relative link** (e.g. `](ADR-007-appspec-rendering-architecture.md)` inside `AXIS-001-design.md`). These break when the target leaves `docs/designs/`. This plan's grep-driven discovery (Task 1 + the sed in Task 4/5) is the **authoritative** edit list — do not trust the spec's filename list alone.

3. **`.zcode/plans/` is UNTRACKED** (`git ls-files .zcode/plans/` is empty) → editor session state, same exemption as `memory/`. Do not edit it; it is not in the repo.

4. **Zero `.py` path references** to moving ADRs exist. MCP tool docstrings cite ADRs by **ID** (`ADR-007 Rule 1`), not by file path. IDs are preserved (no ADR is renumbered), so docstrings are untouched. Confirmed via `git grep "docs/designs/ADR-" -- "*.py"` = 0 hits (excluding the stationary `ADR-face-elevation`).

5. **Stationary false-positive:** `docs/designs/ADR-face-elevation-architecture.md` has **no number** and is not part of the `ADR-NNN` sequence → it **STAYS** in `designs/` (spec §10 R4). Every ref to it (in `src/`, `skills/`, `CHANGELOG.md`, several `docs/`) is a false positive — **never edit these**. The sed regexes below target `ADR-0NN-` (digit after the hyphen) precisely to avoid matching `ADR-face-`.

6. **Exempt historical logs (do not edit):** `CHANGELOG.md`, `memory/*.md`, `docs/superpowers/plans/*.md`, `docs/superpowers/specs/*.md`. Per spec §3 (superpowers/ is the brainstorming skill's zone — untouched) and §7.3 (CHANGELOG/memory are immutable logs). Stale paths there are expected.

---

## File structure (what changes)

**Moves (`git mv`, 18 files):**
- `docs/designs/ADR-{001,002,004..015}-*.md` (14 files) → `docs/adr/` (names preserved)
- `docs/designs/MCP-000-zwcad-mcp-server-plan.md` → `docs/plans/`
- `docs/designs/ELEV-001-v1-changelog.md` → `docs/release/`
- `docs/designs/POSTMORTEM-010-mcp-tool-registry.md` → `docs/reference/`
- `docs/programs/production-readiness-program.md` → `docs/firm-governance/`

**Deletions (untracked/gitignored — zero git impact):**
- `output/` (21M), `workflow_output/` (16K), `backups/` (empty), and the now-empty `docs/programs/` dir

**Path-reference edits (grep-derived, ~15 tracked .md files):**
- Full-path refs (`docs/designs/ADR-0NN-…`, `docs/designs/MCP-000-…`, `docs/designs/ELEV-001-v1-changelog…`, `docs/designs/POSTMORTEM-010…`, `docs/programs/production-readiness-program`) → uniform `sed`
- Bare relative links (`](ADR-0NN-…md)`) in staying files → `../adr/` prefix
- Manual taxonomy rewrite: `docs/README.md`, `docs/designs/DOCS-001-design.md`

---

## Task 1: Pre-flight — confirm baseline state

**Files:** none modified (capture only).

- [ ] **Step 1.1: Confirm branch and that PR #212 is merged**

Run:
```bash
git branch --show-current
gh pr view 212 --json state -q .state
```
Expected: `chore/docs-reorganization` and `MERGED`. If PR #212 is somehow not merged, stop and surface it (Sequential Branch Dependency Rule) — though the branches touch disjoint file sets (geometry src/tests vs docs/), so parallel branching is justified either way.

- [ ] **Step 1.2: Confirm the 18 source files exist exactly where the move map says**

Run:
```bash
ls docs/designs/ | grep -E '^ADR-0(0[124-9]|1[0-5])-'   # expect 14 lines
ls docs/designs/MCP-000-zwcad-mcp-server-plan.md docs/designs/ELEV-001-v1-changelog.md docs/designs/POSTMORTEM-010-mcp-tool-registry.md
ls docs/programs/production-readiness-program.md
```
Expected: all present. (If any ADR is missing, STOP — the move map is stale.)

- [ ] **Step 1.3: Capture the baseline reference map (save to a temp file for the Task 7 diff)**

Run:
```bash
git grep -n -E "ADR-0(0[124-9]|1[0-5])-|MCP-000-zwcad-mcp-server-plan|ELEV-001-v1-changelog|POSTMORTEM-010-mcp-tool-registry|production-readiness-program" -- "*.md" > /tmp/docs-reorg-before.txt
wc -l /tmp/docs-reorg-before.txt
```
Expected: a non-empty hit list (the authoritative scope). Keep this file — Task 7 re-runs the same grep and confirms only false-positives + exempt logs remain.

- [ ] **Step 1.4: Confirm destination dirs exist**

Run:
```bash
for d in docs/adr docs/plans docs/release docs/firm-governance docs/reference; do printf "%s: " "$d"; [ -d "$d" ] && echo exists || echo MISSING; done
```
Expected: all `exists` (the moves target existing dirs). If any MISSING, `mkdir -p` it first.

---

## Task 2: Move the 18 files (`git mv`)

**Files:** 18 source paths (see File structure). History-preserving moves.

- [ ] **Step 2.1: Move the 14 ADRs into `docs/adr/`**

Run:
```bash
for n in 001 002 004 005 006 007 008 009 010 011 012 013 014 015; do
  f=$(ls docs/designs/ADR-${n}-*.md)
  git mv "$f" "docs/adr/$(basename "$f")"
done
```
Expected: no output (success). `ls docs/adr/` now shows `0036-…`, `0037-…`, plus the 14 `ADR-0NN-…` files = 16 total.

- [ ] **Step 2.2: Move the 3 other `docs/designs/` extractions**

Run:
```bash
git mv docs/designs/MCP-000-zwcad-mcp-server-plan.md docs/plans/
git mv docs/designs/ELEV-001-v1-changelog.md          docs/release/
git mv docs/designs/POSTMORTEM-010-mcp-tool-registry.md docs/reference/
```
Expected: each command silent (success).

- [ ] **Step 2.3: Move the one `docs/programs/` file and remove the empty dir**

Run:
```bash
git mv docs/programs/production-readiness-program.md docs/firm-governance/
rmdir docs/programs   # only succeeds if empty — confirms nothing else hid there
```
Expected: `rmdir` succeeds silently. If it errors "Directory not empty", STOP and inspect `ls -la docs/programs/` — do not delete a non-empty dir blindly.

- [ ] **Step 2.4: Verify history is preserved**

Run:
```bash
git log --follow --oneline -1 docs/adr/ADR-001-architecture-graph.md
```
Expected: a commit hash + message that predates this reorg (proves `git mv` tracked the rename).

---

## Task 3: Delete root local cruft (untracked, gitignored)

**Files:** `output/`, `workflow_output/`, `backups/` at repo root.

- [ ] **Step 3.1: Confirm the three dirs hold no tracked content before deleting**

The invariant that matters is "no tracked files inside," regardless of `.gitignore` state. (`output/` is gitignored; `workflow_output/` and `backups/` are untracked but NOT gitignored — all three have zero tracked files.)

Run:
```bash
for d in output workflow_output backups; do printf "%s: " "$d"; [ -z "$(git ls-files "$d")" ] && echo "no tracked content (safe)" || echo "TRACKED CONTENT — STOP"; done
```
Expected: all three `no tracked content (safe)`. If any says TRACKED CONTENT, STOP — do not delete; surface it.

- [ ] **Step 3.2: Delete them**

Run:
```bash
rm -rf output workflow_output backups
```
Expected: silent. `git status` should still show only the staged moves + the untracked spec/plan (these dirs must NOT appear in `git status` since they were ignored).

---

## Task 4: Rewrite full-path references (uniform `sed`)

**Files (tracked .md, excluding judgment-call + historical):** all files containing full-path refs to moving files, EXCEPT `docs/README.md` and `docs/designs/DOCS-001-design.md` (handled manually in Task 6 — their move-map tables describe the *old* layout and must not be blindly rewritten) and the exempt historical logs.

- [ ] **Step 4.1: Rewrite full-path ADR refs**

Run:
```bash
for n in 001 002 004 005 006 007 008 009 010 011 012 013 014 015; do
  files=$(git grep -l "docs/designs/ADR-${n}-" -- "*.md" \
            | grep -vE 'CHANGELOG\.md|memory/|\.zcode/|docs/superpowers/|docs/README\.md|docs/designs/DOCS-001-design\.md')
  [ -n "$files" ] && echo "$files" | xargs sed -i "s#docs/designs/ADR-${n}-#docs/adr/ADR-${n}-#g"
done
```
Expected: silent. The `grep -vE` filter deliberately excludes README, DOCS-001, and historical logs.

- [ ] **Step 4.2: Rewrite the 4 non-ADR full-path refs**

Run:
```bash
for pair in \
  "docs/designs/MCP-000-zwcad-mcp-server-plan:docs/plans/MCP-000-zwcad-mcp-server-plan" \
  "docs/designs/ELEV-001-v1-changelog:docs/release/ELEV-001-v1-changelog" \
  "docs/designs/POSTMORTEM-010-mcp-tool-registry:docs/reference/POSTMORTEM-010-mcp-tool-registry" \
  "docs/programs/production-readiness-program:docs/firm-governance/production-readiness-program"
do
  old=${pair%%:*}; new=${pair##*:}
  files=$(git grep -l "$old" -- "*.md" \
            | grep -vE 'CHANGELOG\.md|memory/|\.zcode/|docs/superpowers/|docs/README\.md|docs/designs/DOCS-001-design\.md')
  [ -n "$files" ] && echo "$files" | xargs sed -i "s#${old}#${new}#g"
done
```
Expected: silent.

- [ ] **Step 4.3: Verify no full-path moving refs remain outside exempt files**

Run:
```bash
git grep -n -E "docs/designs/ADR-0(0[124-9]|1[0-5])-|docs/designs/MCP-000-zwcad-mcp-server-plan|docs/designs/ELEV-001-v1-changelog|docs/designs/POSTMORTEM-010-mcp-tool-registry|docs/programs/production-readiness-program" -- "*.md" \
  | grep -vE 'CHANGELOG\.md|memory/|\.zcode/|docs/superpowers/'
```
Expected: **only** hits inside `docs/README.md` and `docs/designs/DOCS-001-design.md` (those are fixed in Task 6). If any OTHER file appears, loop its ref back through Step 4.1/4.2. Empty output = perfect.

---

## Task 5: Prefix bare relative links in staying files

**Why:** Files that STAY in `docs/designs/` (or sit in `docs/plans/`, `docs/reference/`) link to moving ADRs by bare same-folder link, e.g. `](ADR-007-appspec-rendering-architecture.md)`. Once the target moves to `docs/adr/`, that link breaks. All these source dirs are one level under `docs/`, so the correct prefix is uniformly `../adr/`. (The 14 ADRs' *mutual* bare links need NO change — they move together and stay same-folder. `DOCS-001` and `README.md` are handled in Task 6.)

- [ ] **Step 5.1: Prefix bare ADR links in the staying files**

Run:
```bash
staying_files=$(git grep -l -E "\]\(ADR-0(0[124-9]|1[0-5])-" -- "*.md" \
                  | grep -vE 'CHANGELOG\.md|memory/|\.zcode/|docs/superpowers/|docs/README\.md|docs/designs/DOCS-001-design\.md|docs/adr/')
echo "$staying_files"
for n in 001 002 004 005 006 007 008 009 010 011 012 013 014 015; do
  echo "$staying_files" | xargs -r sed -i "s#\](ADR-${n}-#\](../adr/ADR-${n}-#g"
done
```
Expected: `echo "$staying_files"` prints the authoritative list. **Approximate contents (the grep output is authoritative when it diverges):** `AXIS-001`, `CEIL-001`, `CLOSED-LOOP-001`, `GRAPH-001`, `PIPELINE-001`, `PKG-001`, `REVIEW-AGENT-001`, `SECT-001`, `TAKEOFF-001`, `TEST-001`, `AI-002`, `AI-003`, `FACADE-001`, `FACADE-002` (all in `docs/designs/`), plus `docs/plans/2026-07-09-v3-completion-roadmap.md`. Note: `docs/reference/cad-intelligence-vision.md` and `cad-system-roadmap.md` use **full-path** refs only (handled by Task 4), so they do NOT appear here. Trust `git grep -l` over this prose list.

The regex `\](ADR-${n}-` matches only link targets with no `/` before `ADR` (true relative links). It cannot match `](../adr/ADR-…)` (already has `/`) or `](docs/adr/ADR-…)` (also has `/`), so already-rewritten full-path links are safe.

- [ ] **Step 5.2: Verify no bare moving-ADR links remain in staying files**

Run:
```bash
git grep -n -E "\]\(ADR-0(0[124-9]|1[0-5])-" -- "*.md" \
  | grep -vE 'CHANGELOG\.md|memory/|\.zcode/|docs/superpowers/|docs/adr/'
```
Expected: empty. (Files now read `](../adr/ADR-0NN-…)`.) Any remaining hit = a link the sed missed; fix it manually.

- [ ] **Step 5.3: Fix `../designs/ADR-0NN-` relative links (third flavor — found during execution)**

Files in `docs/reference/` (and similar) link to moving ADRs as `](../designs/ADR-0NN-…md)` — a relative path with a `../designs/` prefix. Neither Task 4's full-path pattern nor Step 5.1's bare `](ADR-0` pattern catches these. They break when the target leaves `designs/`. Discovered live: `docs/reference/cad-intelligence-status.md` (ADR-001/002/015), `cad-intelligence-vision.md` (ADR-004 + a pre-existing stale `../decisions/ADR-001-`), `cad-system-roadmap.md` (ADR-001). Same depth under `docs/`, so prefix is `../adr/`.

Run:
```bash
for n in 001 002 004 005 006 007 008 009 010 011 012 013 014 015; do
  files=$(git grep -l "\](../designs/ADR-${n}-" -- "*.md" | grep -vE 'CHANGELOG\.md|memory/|\.zcode/|docs/superpowers/|docs/adr/')
  [ -n "$files" ] && echo "$files" | xargs sed -i "s#\](\.\./designs/ADR-${n}-#\](../adr/ADR-${n}-#g"
done
# Pre-existing stale link (bonus fix): ](../decisions/ADR-001- -> ](../adr/ADR-001-
sed -i 's#\](\.\./decisions/ADR-001-#\](../adr/ADR-001-#g' docs/reference/cad-intelligence-vision.md
# Bare ELEV-001-v1-changelog link in a staying designs/ file -> ../release/
sed -i 's#\](ELEV-001-v1-changelog\.md#\](../release/ELEV-001-v1-changelog.md#g' docs/designs/ELEV-001-design.md
```

- [ ] **Step 5.4: Comprehensive re-verify — NO link target to a moving file remains (any path form)**

Run:
```bash
git grep -noE "\]\([^)]*ADR-0(0[124-9]|1[0-5])-[A-Za-z0-9_-]+\.md" -- "*.md" \
  | grep -vE 'CHANGELOG\.md|memory/|\.zcode/|docs/superpowers/|docs/adr/' \
  | grep -vE '\]\(\.\./adr/ADR-|\]\(docs/adr/ADR-'
git grep -noE "\]\([^)]*(MCP-000-zwcad-mcp-server-plan|ELEV-001-v1-changelog|POSTMORTEM-010-mcp-tool-registry|production-readiness-program)\.md" -- "*.md" \
  | grep -vE 'CHANGELOG\.md|memory/|\.zcode/|docs/superpowers/' \
  | grep -vE '\]\(docs/(plans|release|reference|firm-governance)/|\]\(\.\./(release|reference|firm-governance|plans)/'
```
Expected: both empty. (Backtick code-span filename *mentions* — e.g. `` `ADR-002-…md` `` in `AI-002` — are prose, not links, and are left as evocative ID-anchored references; they do not break.)

---

## Task 6: Manual taxonomy edits (judgment calls)

**Files:** `docs/README.md`, `docs/designs/DOCS-001-design.md`. These need human-grade editing, not blind sed.

- [ ] **Step 6.1: Rewrite `docs/README.md`**

Read `docs/README.md`, then:
- **`designs/` row:** was described as holding "Architecture Decision Records (ADR series)". Rewrite to: feature/technical designs only — ADRs have moved to `docs/adr/`.
- **`programs/` row:** delete it entirely (category dissolved; its sole occupant moved to `firm-governance/`).
- **Placement-rule flow:** add `docs/adr/` as the ADR home; remove any step routing to `programs/`; ensure the rule still routes hand-written designs→`designs/`, plans→`plans/`, and points skill-generated specs/plans at `superpowers/`.

Verify: `grep -n "programs\|ADR series" docs/README.md` should return nothing stale.

- [ ] **Step 6.2: Update `docs/designs/DOCS-001-design.md`**

Read `docs/designs/DOCS-001-design.md`. This doc is the original taxonomy decision record; its §2 move-map tables are a **frozen historical record** of the *prior* consolidation — do NOT blindly rewrite path strings inside those historical tables. Instead:
- **Live/forward-looking navigation links** to files that moved: update to the new location (`docs/adr/…`, `docs/firm-governance/production-readiness-program.md`). Use the same full-path form already used elsewhere in the doc.
- **The `docs/programs/` addendum (≈ lines 255–275, spec §10 R3):** append a short dated note recording the **reversal** — `docs/programs/` was dissolved on 2026-08-02 because its single occupant did not earn a permanent top-level category; `production-readiness-program.md` moved to `docs/firm-governance/`. Keep the original addendum text above it (traceability — record the rationale, don't erase it).
- **Line ~123 `ELEV-001-v1-changelog` row** (the deprecated-file table): update its path to `docs/release/ELEV-001-v1-changelog.md` (spec §7.1 flagged this as a live ref that breaks on move).

Verify: the doc reads consistently — historical tables untouched, live links resolve, reversal recorded.

---

## Task 7: Final verification

**Files:** none modified (checks only).

- [ ] **Step 7.1: Re-run the baseline grep — expect only false-positives + exempt logs**

Run:
```bash
git grep -n -E "ADR-0(0[124-9]|1[0-5])-|MCP-000-zwcad-mcp-server-plan|ELEV-001-v1-changelog|POSTMORTEM-010-mcp-tool-registry|production-readiness-program" -- "*.md" \
  | grep -vE 'ADR-face-elevation' > /tmp/docs-reorg-after.txt
wc -l /tmp/docs-reorg-after.txt
```
Then manually confirm every surviving line in `/tmp/docs-reorg-after.txt` is EITHER:
- an exempt historical log (`CHANGELOG.md`, `memory/`, `.zcode/`, `docs/superpowers/`), OR
- a reference to the **stationary** `ADR-face-elevation-architecture` (false positive), OR
- an **ID** reference (`ADR-007`, `ADR-015` — not a file path; these are fine), OR
- inside `DOCS-001` / `README.md` historical tables (frozen record).

Any line that is a live path/relative link to a moved file = a miss; loop back to Task 4/5/6.

- [ ] **Step 7.2: Confirm `docs/programs/` is gone and destinations populated**

Run:
```bash
test -d docs/programs && echo "PROGRAMS STILL EXISTS — STOP" || echo "programs dissolved"
ls docs/adr/ | wc -l          # expect 16
ls docs/plans/MCP-000-zwcad-mcp-server-plan.md docs/release/ELEV-001-v1-changelog.md docs/reference/POSTMORTEM-010-mcp-tool-registry.md docs/firm-governance/production-readiness-program.md
```
Expected: `programs dissolved`; `16`; the four moved files present.

- [ ] **Step 7.3: Audit gate**

Run:
```bash
bun scripts/audit.ts
```
Expected: exit 0. (Per spec §8, audit only checks root-level `.md` naming and `docs/research/*.md` References — neither affected. If it fails, read the failure and fix before proceeding.)

- [ ] **Step 7.4: `pytest` smoke (should be a no-op)**

Run:
```bash
pytest tests/test_reasoning_*.py -q 2>&1 | tail -3
```
Expected: normal pass. No source code under `docs/` is imported by tests, so this is a sanity check that nothing incidental broke. (Full suite not required — docs-only change.)

---

## Task 8: Ship via `/sync`

**Files:** all of the above + this plan + the spec.

- [ ] **Step 8.1: Run the sync pipeline**

Run (via the Skill tool or `/sync`):
```bash
bun scripts/dev-sync.ts "chore(docs): reorganize scattered design and plan docs into coherent taxonomy"
```
This runs memlog → sync-md → changelog → audit → version manifest → branch → commit → push → PR. Per workspace governance this is the ONLY commit path. The English PR title/body are enforced by the pipeline.

- [ ] **Step 8.2: Confirm the PR opened**

Run:
```bash
gh pr view --json number,title,state -q '"PR #\(.number): \(.title) [\(.state)]"'
```
Expected: the new PR, open. Note it in `memory/2026-08-02.md`.

---

## Risks (carried from spec §10, plus plan-level additions)

- **R1 — Missed relative link** (plan-level): the spec's path-prefix grep missed ~13 bare-relative linkers; this plan's Task 5 + the Step 7.1 grep close that gap. The `git grep "\]\(ADR-0…" ` pattern is the authoritative detector.
- **R3 — `docs/programs/` removal reverses DOCS-001's addendum.** Recorded explicitly in Task 6.2 (append reversal note, keep original for traceability).
- **R4 — `ADR-face-elevation-architecture` is unnumbered and stays.** The sed regexes target `ADR-0NN-` (digit) so they cannot match it; Step 7.1 separately filters its false-positive refs.
- **R5 — DOCS-001 historical tables (plan-level):** blind sed would corrupt frozen move-map tables ("No change — already in the right place" next to a now-moved path). Mitigation: DOCS-001 is excluded from Tasks 4–5 and edited manually in Task 6.2.
