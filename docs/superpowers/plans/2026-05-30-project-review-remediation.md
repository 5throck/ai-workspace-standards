# Project Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Critical, High, Moderate, and Low issues identified in the 2026-05-30 comprehensive project review across workspace root and templates/.

**Architecture:** Issues are grouped into 5 independent domain groups (A–E), each handled by a specialist agent. Groups A–E can be dispatched in parallel with no shared file conflicts. Each group commits independently.

**Tech Stack:** Bun, TypeScript, GitHub Actions YAML, Markdown

---

## File Map

### Group A — Automation/Code
| Action | File |
|--------|------|
| Modify | `scripts/hooks/pre-commit.ts:8` |
| Modify | `.githooks/commit-msg` |
| Modify | `.githooks/post-checkout` |
| Modify | `scripts/verify-scripts.ts` (add --check-drift doc comment) |
| Create | `tests/integration/workspace-smoke.test.ts` |

### Group B — Documentation
| Action | File |
|--------|------|
| Modify | `CLAUDE.md` §1 (settings.json description) |
| Modify | `docs/lifecycle/README.md` (Korean → English) |
| Modify | `docs/governance/skill-update-procedure.md` (Korean → English) |
| Modify | `docs/governance/variant/co-design/phases.md` |
| Modify | `docs/governance/variant/co-develop/phases.md` |
| Modify | `docs/governance/variant/co-security/phases.md` |
| Modify | `docs/governance/variant/co-work/phases.md` |
| Modify | `docs/governance/variant/common/phases.md` |
| Modify | `docs/superpowers/plans/2026-05-28-variant-parity-sync.md` (Korean char) |
| Modify | `AGENTS.md` (phase numbering 6→7, Skills table path format) |
| Modify | `CONSTITUTION.md` §5.6 (agent:create.ts → agent-create.ts) |
| Modify | `GEMINI.md` (Unicode broken character fix) |
| Modify | `templates/co-design/README.md` (status update) |
| Modify | `templates/co-work/README.md` (status update) |
| Modify | `templates/CHANGELOG.md` (add missing dates) |

### Group C — Templates/Scaffolding
| Action | File |
|--------|------|
| Modify | `templates/common/common-contract.json` (add 3 skills) |
| Modify | `templates/common/.github/workflows/ci.yml` (audit cmd + setup-bun) |
| Modify | `templates/co-security/agents/pm.md` (security domain content) |
| Modify | `templates/co-security/agents/pentester.md` (add frontmatter) |
| Modify | `templates/co-security/agents/red-team-lead.md` (add frontmatter) |
| Modify | `templates/co-security/agents/threat-modeler.md` (add frontmatter) |
| Modify | `templates/co-security/agents/patch-engineer.md` (add frontmatter) |
| Modify | `templates/co-security/agents/report-writer.md` (add frontmatter) |
| Modify | `.claude/commands/new-project.md` (add gemini-parity: skip) |
| Modify | `templates/common/.claude/commands/new-project.md` (fix C:\git path + setup.ts ref) |
| Create | `templates/common/skills/project-review/SKILL.md` (copy from skills/) |

### Group D — Security
| Action | File |
|--------|------|
| Modify | `.github/workflows/test.yml` (SHA pin actions, restrict checks:write) |
| Modify | `templates/common/.github/workflows/ci.yml` (SHA pin actions) |
| Create | `.github/CODEOWNERS` |

### Group E — Lifecycle/Governance
| Action | File |
|--------|------|
| Modify | `skills/audit-workspace/SKILL.md` (add metadata.type) |
| Modify | `skills/security-scan/SKILL.md` (add metadata.type) |
| Modify | `skills/simulate-project-creation/SKILL.md` (add metadata.type) |
| Modify | `skills/validate-docs-links/SKILL.md` (add metadata.type) |
| Modify | `.claude/skills/audit-workspace/SKILL.md` (add metadata.type) |
| Modify | `.claude/skills/security-scan/SKILL.md` (add metadata.type) |
| Modify | `.claude/skills/simulate-project-creation/SKILL.md` (add metadata.type) |
| Modify | `.claude/skills/validate-docs-links/SKILL.md` (add metadata.type) |
| Modify | `AGENTS.md` Skills Location Reference (add workspace-root sync rule) |

---

## Group A: Automation/Code Fixes

**Dispatcher:** automation-engineer | Tier: Medium

### Task A1: Fix `existsSync` import in pre-commit.ts (C2)

**Files:**
- Modify: `scripts/hooks/pre-commit.ts:8`

- [ ] **Step 1: Read the current import line**

Read `scripts/hooks/pre-commit.ts` lines 1–15 to confirm exact import syntax.

- [ ] **Step 2: Add `existsSync` to the import**

Change line 8 from:
```typescript
import { readFileSync, writeFileSync } from "node:fs";
```
To:
```typescript
import { readFileSync, writeFileSync, existsSync } from "node:fs";
```

- [ ] **Step 3: Verify `join` import is used**

Check if `join` from `"node:path"` (line 9) is actually used in the file. If unused, remove it to keep the import clean.

- [ ] **Step 4: Run pre-commit dry-run to verify no syntax errors**

```bash
bun scripts/hooks/pre-commit.ts 2>&1 | head -5
```
Expected: Hook initializes and exits (may exit 0 with "No staged files" or run normally).

- [ ] **Step 5: Commit**

```bash
git add scripts/hooks/pre-commit.ts
git commit -m "fix: add existsSync import to pre-commit hook — secret scan was broken"
```

---

### Task A2: Fix `python3` dependency in commit-msg hook (H10)

**Files:**
- Modify: `.githooks/commit-msg`

- [ ] **Step 1: Read the commit-msg hook**

```bash
cat .githooks/commit-msg
```

- [ ] **Step 2: Find the python3 block**

Locate the Korean character enforcement section that calls `python3 -c ...`.

- [ ] **Step 3: Replace with Bun-based check or add explicit warning**

Replace the `python3 -c` call with a portable shell fallback:
```bash
# Korean character check — use python3 if available, else warn and skip
if command -v python3 >/dev/null 2>&1; then
  # existing python3 check here
else
  echo "[WARN] python3 not found — Korean character check skipped. Install python3 to enforce." >&2
fi
```

This makes the failure visible (warn) rather than silent (pass).

- [ ] **Step 4: Test on current system**

```bash
echo "test commit" | bash .githooks/commit-msg
```
Expected: exits 0 with or without python3 warning.

- [ ] **Step 5: Commit**

```bash
git add .githooks/commit-msg
git commit -m "fix: make python3 check in commit-msg hook explicit-warn instead of silent-skip"
```

---

### Task A3: Document `AI_AUTOSTART=0` bypass in post-checkout hook (L2)

**Files:**
- Modify: `.githooks/post-checkout`

- [ ] **Step 1: Read the post-checkout hook**

```bash
cat .githooks/post-checkout
```

- [ ] **Step 2: Add opt-out documentation comment and check**

At the top of the AI CLI auto-launch section, add:
```bash
# AI auto-launch can be disabled by setting AI_AUTOSTART=0 in your shell profile.
if [ "${AI_AUTOSTART:-1}" = "0" ]; then
  exit 0
fi
```

- [ ] **Step 3: Commit**

```bash
git add .githooks/post-checkout
git commit -m "docs: add AI_AUTOSTART=0 opt-out for post-checkout AI auto-launch"
```

---

### Task A4: Document `--check-drift` flag in verify-scripts.ts (L3)

**Files:**
- Modify: `scripts/verify-scripts.ts`

- [ ] **Step 1: Read the usage/help section of verify-scripts.ts**

```bash
grep -n "usage\|--check\|--verify\|--generate\|--report" scripts/verify-scripts.ts
```

- [ ] **Step 2: Add `--check-drift` to the usage comment/block**

Find the usage display block and add `--check-drift` alongside `--verify`, `--generate`, `--report` with a short description: "Check for scripts listed in package.json but missing from scripts/ (drift detection)".

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-scripts.ts
git commit -m "docs: document --check-drift flag in verify-scripts.ts usage"
```

---

### Task A5: Add minimum smoke integration test (M4)

**Files:**
- Create: `tests/integration/workspace-smoke.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// tests/integration/workspace-smoke.test.ts
import { describe, it, expect } from "bun:test";
import { existsSync } from "node:fs";

describe("workspace smoke tests", () => {
  it("audit.ts exists", () => {
    expect(existsSync("scripts/audit.ts")).toBe(true);
  });

  it("pre-commit hook exists", () => {
    expect(existsSync("scripts/hooks/pre-commit.ts")).toBe(true);
  });

  it("validate-templates.ts exists", () => {
    expect(existsSync("scripts/validate-templates.ts")).toBe(true);
  });

  it("common-contract.json exists", () => {
    expect(existsSync("templates/common/common-contract.json")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
bun test tests/integration/workspace-smoke.test.ts
```
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/workspace-smoke.test.ts
git commit -m "test: add workspace smoke integration tests so push gate is not empty"
```

---

## Group B: Documentation Fixes

**Dispatcher:** docs-writer | Tier: Medium

### Task B1: Fix CLAUDE.md §1 settings.json description (C1)

**Files:**
- Modify: `CLAUDE.md:29`

- [ ] **Step 1: Read CLAUDE.md lines 28–55**

- [ ] **Step 2: Replace the stale description**

Replace the paragraph starting "The workspace `.claude/settings.json` is currently `{}` - **PostToolUse hooks are disabled**..." with an accurate description:

```markdown
The workspace `.claude/settings.json` has **PreToolUse** and **SessionStart** hooks enabled:
- `PreToolUse` on `Write|Edit|Bash` → runs `bun scripts/check-pm-approval.ts` (PM-approval gate)
- `SessionStart` → runs `bun scripts/clear-pm-approval.ts` (clears approval flag)
- **PostToolUse hooks are currently disabled.** Audit is enforced via the pre-commit hook and the `dev-sync.ts` pipeline.
```

Also update the table at the bottom of §1 to accurately reflect the hook state.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: fix stale settings.json description in CLAUDE.md §1 — PreToolUse hooks are active"
```

---

### Task B2: Fix Korean language policy violations in docs/ (C5)

**Files:**
- Modify: `docs/lifecycle/README.md`
- Modify: `docs/governance/skill-update-procedure.md`
- Modify: `docs/governance/variant/co-design/phases.md`
- Modify: `docs/governance/variant/co-develop/phases.md`
- Modify: `docs/governance/variant/co-security/phases.md`
- Modify: `docs/governance/variant/co-work/phases.md`
- Modify: `docs/governance/variant/common/phases.md`
- Modify: `docs/superpowers/plans/2026-05-28-variant-parity-sync.md`

- [ ] **Step 1: Audit all Korean content**

```bash
# Search for Korean characters (Hangul range) in docs/
grep -rn $'[\xE3\x84\xB1-\xE3\x85\x8E\xE3\x85\xA1-\xE3\x85\xA3\xEA\xB0\x80-\xED\x9E\xA3]' docs/ --include="*.md" -l
# Or use Python: python3 -c "import re,sys; [print(l) for l in open(sys.argv[1]) if re.search(r'[AC00-D7A3 (Hangul syllables) and 1100-11FF (Hangul Jamo)㄰-㆏]', l)]"
```

- [ ] **Step 2: For each file, translate Korean prose to English**

For `docs/lifecycle/README.md`: translate all Korean headings, paragraphs, and bullet points to English. Preserve the document structure.

For `docs/governance/skill-update-procedure.md`: translate Korean sections to English.

For `docs/governance/variant/*/phases.md` (5 files): translate Korean phase descriptions to English.

For `docs/superpowers/plans/2026-05-28-variant-parity-sync.md`: find and replace the Korean character(s) with English equivalent.

- [ ] **Step 3: Verify no Korean remains outside ko/ directories**

```bash
# Verify no Korean characters (Hangul) remain in docs/
python3 -c "
import re, os
ko = re.compile(r'[AC00-D7A3 (Hangul syllables) and 1100-11FF (Hangul Jamo)㄰-㆏]')
for root, dirs, files in os.walk('docs'):
    for f in files:
        if f.endswith('.md') and not f.endswith('_ko.md'):
            path = os.path.join(root, f)
            for i, line in enumerate(open(path, encoding='utf-8'), 1):
                if ko.search(line):
                    print(f'{path}:{i}: {line.strip()}')
"
```
Expected: 0 matches.

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "fix: translate Korean content in docs/ to English per language policy"
```

---

### Task B3: Fix phase numbering to 7-phase in AGENTS.md (H1, M6)

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Read AGENTS.md lines 165–200 (Harness Engineering Workflow)**

- [ ] **Step 2: Update the 6-phase diagram to 7-phase**

The Harness Engineering Workflow section currently shows Phase 0–5 (6 phases). Update it to match the canonical 7-phase model (Phase 0, 1-2, 3, 4, 5, 6):

- Phase 5 label: change from "Finalization" to "Quality Assurance"
- Add Phase 6: "Lifecycle Finalization (PM-owned) — lifecycle-manager updates governance records"

- [ ] **Step 3: Fix "6-phase" reference in AGENTS.md anchor text**

Search for any inline text saying "6-phase" or "6 phases" in AGENTS.md and update to "7-phase" / "7 phases".

- [ ] **Step 4: Fix Skills table path format inconsistency (L1)**

In AGENTS.md Skills table, standardize all skill paths to include `/SKILL.md`:
- `skills/project-review` → `skills/project-review/SKILL.md`
- Any other entries missing the `/SKILL.md` suffix.

- [ ] **Step 5: Add Skills Location Reference governance rule for workspace-root skills (L6)**

In the "Skills Location Reference" section, add:
```
> **Workspace-root-originated skills**: Skills added directly to `.claude/skills/` 
> (not via `templates/common/skills/`) must be annotated with `gemini-parity: skip` 
> in their SKILL.md frontmatter and documented in AGENTS.md with a `workspace-only: true` note.
```

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md
git commit -m "docs: fix phase numbering to 7-phase model in AGENTS.md harness workflow section"
```

---

### Task B4: Fix CONSTITUTION.md agent script name typo (M2)

**Files:**
- Modify: `CONSTITUTION.md`

- [ ] **Step 1: Find the incorrect reference**

```bash
grep -n "agent:create\|agent:delete\|agent:verify" CONSTITUTION.md
```

- [ ] **Step 2: Replace colon notation with hyphen notation**

Replace `agent:create.ts`, `agent:delete.ts`, `agent:verify.ts` → `agent-create.ts`, `agent-delete.ts`, `agent-verify.ts`

- [ ] **Step 3: Verify correct file names exist**

```bash
ls scripts/agent-create.ts scripts/agent-delete.ts scripts/agent-verify.ts
```

- [ ] **Step 4: Commit**

```bash
git add CONSTITUTION.md
git commit -m "fix: correct agent script names in CONSTITUTION.md §5.6 (colon → hyphen)"
```

---

### Task B5: Fix broken Unicode in GEMINI.md (M3)

**Files:**
- Modify: `GEMINI.md`

- [ ] **Step 1: Find the broken character**

```bash
grep -n $'\xEC\xA8\x8C' GEMINI.md
```

- [ ] **Step 2: Replace with proper separator**

Replace the broken Unicode character (U+EC8C — a garbled Korean syllable from a mojibake encoding issue) with ` / ` or ` | ` — whichever matches the surrounding context (platform path separator for Windows/macOS).

- [ ] **Step 3: Commit**

```bash
git add GEMINI.md
git commit -m "fix: replace garbled Unicode character in GEMINI.md (CP949 artifact)"
```

---

### Task B6: Update co-design and co-work README status (H6)

**Files:**
- Modify: `templates/co-design/README.md`
- Modify: `templates/co-work/README.md`

- [ ] **Step 1: Read both files (first 15 lines each)**

- [ ] **Step 2: Replace "Planned — not yet available" with stable status**

Change:
```
> **Status**: Planned — not yet available
```
To:
```
> **Status**: Stable (v1.0.0) — ready for use
```

Also update any "coming soon" language in the body to reflect the variant is active.

- [ ] **Step 3: Commit**

```bash
git add templates/co-design/README.md templates/co-work/README.md
git commit -m "docs: update co-design and co-work README status to stable v1.0.0"
```

---

### Task B7: Fix stale script references in docs (M1) and add CHANGELOG dates (L4)

**Files:**
- Modify: `docs/lifecycle/README.md` (`.sh` → `.ts` script references)
- Modify: `templates/CHANGELOG.md` (add missing dates)

- [ ] **Step 1: Fix script references in docs/lifecycle/README.md**

```bash
grep -n "validate-agents.sh\|validate-skills.sh\|doc/lifecycle" docs/lifecycle/README.md
```

Replace:
- `bun scripts/validate-agents.sh` → `bun scripts/validate-agents.ts`
- `bun scripts/validate-skills.sh` → `bun scripts/validate-skills.ts`
- `doc/lifecycle/` (singular) → `docs/lifecycle/` (plural)

- [ ] **Step 2: Also fix in docs/governance/skill-update-procedure.md**

```bash
grep -n "doc/lifecycle" docs/governance/skill-update-procedure.md
```
Replace `doc/lifecycle/` → `docs/lifecycle/`

- [ ] **Step 3: Add missing dates to templates/CHANGELOG.md**

Read `templates/CHANGELOG.md` and add approximate dates to versions 0.1.0, 0.2.0, 0.3.0 based on git history:
```bash
git log --oneline templates/CHANGELOG.md
```
Use the commit dates to fill in `[0.3.0] - YYYY-MM-DD` format.

- [ ] **Step 4: Commit**

```bash
git add docs/lifecycle/README.md docs/governance/skill-update-procedure.md templates/CHANGELOG.md
git commit -m "fix: correct stale script .sh→.ts references in docs and add CHANGELOG dates"
```

---

## Group C: Template/Scaffolding Fixes

**Dispatcher:** scaffolding-expert | Tier: Medium

### Task C1: Add 3 missing skills to common-contract.json (C3)

**Files:**
- Modify: `templates/common/common-contract.json`

- [ ] **Step 1: Read current common-contract.json**

- [ ] **Step 2: Add three missing skill entries to `common_skills`**

Add after the `agent-lifecycle-manager` entry:

```json
"script-lifecycle-manager": {
  "source": "skills/script-lifecycle-manager/SKILL.md",
  "version": "1.0.0",
  "overridable": false,
  "description": "Script lifecycle management — tracks script health and deprecation"
},
"simulate-project-creation": {
  "source": "skills/simulate-project-creation/SKILL.md",
  "version": "1.0.0",
  "overridable": false,
  "description": "Simulates new-project scaffolding for dry-run validation"
},
"validate-docs-links": {
  "source": "skills/validate-docs-links/SKILL.md",
  "version": "1.0.0",
  "overridable": false,
  "description": "Validates documentation cross-references and link integrity"
}
```

- [ ] **Step 3: Verify JSON is valid**

```bash
bun -e "JSON.parse(require('fs').readFileSync('templates/common/common-contract.json','utf8')); console.log('valid')"
```
Expected: `valid`

- [ ] **Step 4: Run validate-templates to check**

```bash
bun scripts/validate-templates.ts 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add templates/common/common-contract.json
git commit -m "fix: add 3 missing skills to common-contract.json (script-lifecycle-manager, simulate-project-creation, validate-docs-links)"
```

---

### Task C2: Fix ci.yml audit command and add setup-bun (C4)

**Files:**
- Modify: `templates/common/.github/workflows/ci.yml`

- [ ] **Step 1: Read the full ci.yml**

- [ ] **Step 2: Update the audit job**

Replace:
```yaml
  audit:
    name: Documentation Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run audit.sh
        run: bash scripts/audit.sh
```

With:
```yaml
  audit:
    name: Documentation Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --cwd scripts
        continue-on-error: true

      - name: Run audit
        run: bun scripts/audit.ts
```

- [ ] **Step 3: Verify YAML is valid**

```bash
bun -e "require('js-yaml').load(require('fs').readFileSync('templates/common/.github/workflows/ci.yml','utf8')); console.log('valid')" 2>/dev/null || python3 -c "import yaml; yaml.safe_load(open('templates/common/.github/workflows/ci.yml')); print('valid')"
```

- [ ] **Step 4: Commit**

```bash
git add templates/common/.github/workflows/ci.yml
git commit -m "fix: update template ci.yml to use bun scripts/audit.ts instead of bash scripts/audit.sh"
```

---

### Task C3: Update co-security pm.md for security domain (C6)

**Files:**
- Modify: `templates/co-security/agents/pm.md`

- [ ] **Step 1: Read the full co-security pm.md**

- [ ] **Step 2: Read co-develop pm.md for comparison**

Read `templates/co-develop/agents/pm.md` to see what security-domain-specific overrides should look like.

- [ ] **Step 3: Replace generic examples with security-domain examples**

Change the `description` and `examples` fields:

```yaml
description: >
  PM orchestrator for security engagements — owns team assembly, authorization verification, 
  threat model validation, and engagement finalization. Use when: starting any security task,
  coordinating red team / patch agents, reviewing scope changes, or closing findings.
examples:
  - user: "Begin a penetration test on the web application"
    assistant: "Running Phase 0 Team Assembly to verify authorization document, then Phase 2 Threat Model validation."
  - user: "A critical finding was discovered"
    assistant: "Logging finding to docs/findings/FIND-NNNN.md and coordinating patch-engineer for remediation."
```

- [ ] **Step 4: Commit**

```bash
git add templates/co-security/agents/pm.md
git commit -m "fix: update co-security pm.md with security-domain description and examples"
```

---

### Task C4: Add standard frontmatter to co-security agents (H7)

**Files:**
- Modify: `templates/co-security/agents/pentester.md`
- Modify: `templates/co-security/agents/red-team-lead.md`
- Modify: `templates/co-security/agents/threat-modeler.md`
- Modify: `templates/co-security/agents/patch-engineer.md`
- Modify: `templates/co-security/agents/report-writer.md`

- [ ] **Step 1: Read each agent file to see current frontmatter**

```bash
head -15 templates/co-security/agents/pentester.md
head -15 templates/co-security/agents/red-team-lead.md
head -15 templates/co-security/agents/threat-modeler.md
head -15 templates/co-security/agents/patch-engineer.md
head -15 templates/co-security/agents/report-writer.md
```

- [ ] **Step 2: Add missing `status:` field to each**

For each file that lacks `status: active`, add it to the YAML frontmatter block. Standard pattern from co-develop agents:
```yaml
status: active
```

- [ ] **Step 3: Add missing `lifecycle:` block to align with workspace agent standard**

```yaml
lifecycle:
  phase: active
  created: "2026-05-27"
  last_updated: "2026-05-30"
  governance: lifecycle-manager
```

- [ ] **Step 4: Commit**

```bash
git add templates/co-security/agents/
git commit -m "fix: add status and lifecycle frontmatter to co-security agent files"
```

---

### Task C5: Add gemini-parity skip to new-project command (H8)

**Files:**
- Modify: `.claude/commands/new-project.md`

- [ ] **Step 1: Read .claude/commands/new-project.md frontmatter**

```bash
head -10 .claude/commands/new-project.md
```

- [ ] **Step 2: Add gemini-parity: skip to frontmatter**

Add to the YAML frontmatter:
```yaml
gemini-parity: skip
gemini-parity-reason: "Uses Claude Code native Agent tool which has no Gemini CLI equivalent"
```

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/new-project.md
git commit -m "docs: add gemini-parity skip annotation to new-project command"
```

---

### Task C6: Fix hardcoded path and setup.ts reference in template new-project.md (M5, M10)

**Files:**
- Modify: `templates/common/.claude/commands/new-project.md`

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Fix hardcoded C:\git path**

Replace:
```
Run from the workspace root (`C:\git`).
```
With:
```
Run from the workspace root (your `C:\<workspace>` directory).
```

- [ ] **Step 3: Fix setup.ts reference**

Replace `bun scripts/setup.ts` with `bash scripts/setup.sh` (the existing cross-platform file).

- [ ] **Step 4: Commit**

```bash
git add templates/common/.claude/commands/new-project.md
git commit -m "fix: remove hardcoded C:\\git path and fix setup.ts→setup.sh in template new-project command"
```

---

### Task C7: Add project-review skill to templates/common/skills/ (M11)

**Files:**
- Create: `templates/common/skills/project-review/SKILL.md`

- [ ] **Step 1: Read the workspace-root skill**

Read `skills/project-review/SKILL.md` in full.

- [ ] **Step 2: Copy to templates/common/skills/**

Create `templates/common/skills/project-review/SKILL.md` with identical content.

- [ ] **Step 3: Verify it now matches skills/ and .claude/skills/**

```bash
diff skills/project-review/SKILL.md templates/common/skills/project-review/SKILL.md
diff skills/project-review/SKILL.md .claude/skills/project-review/SKILL.md
```
Expected: no diff.

- [ ] **Step 4: Run validate-templates**

```bash
bun scripts/validate-templates.ts 2>&1 | grep -i "project-review\|error\|warn"
```

- [ ] **Step 5: Commit**

```bash
git add templates/common/skills/project-review/
git commit -m "fix: add project-review skill to templates/common/skills/ for template propagation"
```

---

### Task C8: Document/cleanup test-* sandbox directories (M12)

**Files:**
- Modify: `.gitignore` (if not already covering test-* dirs)

- [ ] **Step 1: Check git status of test directories**

```bash
git status --short | grep "test-"
ls -d test-* 2>/dev/null
```

- [ ] **Step 2: Confirm they're not tracked**

```bash
git ls-files test-co-design-migration test-co-develop test-co-work test-final test-ps-debug test-ps-final test-ps-final-fixed 2>/dev/null
```
Expected: no output (untracked). If any are tracked, do NOT delete without user confirmation.

- [ ] **Step 3: Add sandbox pattern to .gitignore if not present**

Check `.gitignore` for a `test-*/` entry. If absent, document the cleanup:

Add a comment to `.gitignore`:
```gitignore
# Scaffolding test output directories (generated by scripts/test-new-project.ts)
test-*/
```

- [ ] **Step 4: Delete the untracked directories**

```bash
rm -rf test-co-design-migration test-co-develop test-co-work test-final test-ps-debug test-ps-final test-ps-final-fixed
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: add test-*/ to .gitignore and remove scaffolding test artifacts from workspace root"
```

---

## Group D: Security Fixes

**Dispatcher:** security-expert | Tier: Medium

### Task D1: Pin GitHub Actions to SHA (H2)

**Files:**
- Modify: `.github/workflows/test.yml`
- Modify: `templates/common/.github/workflows/ci.yml`

- [ ] **Step 1: Get current SHA for each action**

Look up SHA pins for:
- `actions/checkout@v4` → `11bd71901bbe5b1630ceea73d27597364c9af683`
- `oven-sh/setup-bun@v2` → `4bc047ad317be86e772e62e09a80d557c476c58a`
- `actions/upload-artifact@v4` → `ea165f8d65b6e75b540449e92b4886f43607fa02`
- `gitleaks/gitleaks-action@v2` → check current v2 SHA

Note: Exact SHAs should be verified against the actions' GitHub repos. Use the SHAs above as a starting reference and verify they match the v4/v2 tags.

- [ ] **Step 2: Update .github/workflows/test.yml**

Replace all floating-tag uses with SHA-pinned versions:
```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4
- uses: oven-sh/setup-bun@4bc047ad317be86e772e62e09a80d557c476c58a # v2
- uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
```

- [ ] **Step 3: Also restrict `checks: write` scope (M9)**

In `test.yml`, move `checks: write` from the top-level `permissions` to only the specific job that needs it, and add `if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository` condition to prevent fork PRs from getting write access.

- [ ] **Step 4: Update templates/common/.github/workflows/ci.yml**

Pin `actions/checkout@v4` and `gitleaks/gitleaks-action@v2` to SHAs.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/test.yml templates/common/.github/workflows/ci.yml
git commit -m "security: pin GitHub Actions to commit SHAs to prevent supply-chain tag mutation"
```

---

### Task D2: Create workspace CODEOWNERS (H3)

**Files:**
- Create: `.github/CODEOWNERS`

- [ ] **Step 1: Read templates/common/.github/CODEOWNERS for the placeholder pattern**

- [ ] **Step 2: Create .github/CODEOWNERS at workspace root**

```
# Workspace CODEOWNERS
# Protect critical governance files — all changes require PM review.
# Replace @your-team with your actual GitHub team or username.

# Critical governance files
CLAUDE.md @your-team
AGENTS.md @your-team
CONSTITUTION.md @your-team
GEMINI.md @your-team

# Agent definitions
/agents/ @your-team

# Hooks and scripts
/scripts/ @your-team
/.githooks/ @your-team

# Template system
/templates/ @your-team
```

Note: Replace `@your-team` with actual GitHub team/user handles before merging.

- [ ] **Step 3: Commit**

```bash
git add .github/CODEOWNERS
git commit -m "security: add CODEOWNERS to workspace root for critical file protection"
```

---

## Group E: Lifecycle/Governance Fixes

**Dispatcher:** lifecycle-manager | Tier: Medium

### Task E1: Add `metadata.type` to 4 skill files (M7)

**Files:**
- Modify: `skills/audit-workspace/SKILL.md`
- Modify: `skills/security-scan/SKILL.md`
- Modify: `skills/simulate-project-creation/SKILL.md`
- Modify: `skills/validate-docs-links/SKILL.md`
- Modify: `.claude/skills/audit-workspace/SKILL.md`
- Modify: `.claude/skills/security-scan/SKILL.md`
- Modify: `.claude/skills/simulate-project-creation/SKILL.md`
- Modify: `.claude/skills/validate-docs-links/SKILL.md`

- [ ] **Step 1: Read an existing skill with metadata.type for reference**

```bash
grep -A3 "metadata" skills/skill-lifecycle-manager/SKILL.md
```

- [ ] **Step 2: Determine correct type for each skill**

- `audit-workspace`: `process` (governs workflow)
- `security-scan`: `process` (governs workflow)
- `simulate-project-creation`: `process` (workflow simulation)
- `validate-docs-links`: `process` (validation workflow)

- [ ] **Step 3: Add metadata.type to each skill's frontmatter in both skills/ and .claude/skills/**

For each SKILL.md, add to the YAML frontmatter:
```yaml
metadata:
  type: process
```

- [ ] **Step 4: Verify all 8 files updated**

```bash
grep -l "metadata:" skills/audit-workspace/SKILL.md skills/security-scan/SKILL.md skills/simulate-project-creation/SKILL.md skills/validate-docs-links/SKILL.md
```
Expected: 4 files listed.

- [ ] **Step 5: Commit**

```bash
git add skills/ .claude/skills/
git commit -m "fix: add metadata.type frontmatter to 4 skills missing the field"
```

---

### Task E2: Document workspace-schema.json propagation (M8)

**Files:**
- Modify: `AGENTS.md` (add propagation note to Skills Location Reference or relevant section)

- [ ] **Step 1: Check if workspace-schema.json files are identical**

```bash
diff workspace-schema.json templates/common/workspace-schema.json
```

- [ ] **Step 2: If they differ, investigate which is canonical**

The root `workspace-schema.json` is the SSOT. If they differ, update `templates/common/workspace-schema.json` to match root.

- [ ] **Step 3: Document the propagation relationship**

In `AGENTS.md`, find the section discussing `workspace-schema.json` (or add to §Architecture / Scripts section):

```markdown
> **Schema propagation**: `workspace-schema.json` at the workspace root is the SSOT.
> `templates/common/workspace-schema.json` is a copy and must be kept in sync manually
> after any schema changes. Run `diff workspace-schema.json templates/common/workspace-schema.json`
> to verify parity before committing.
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md templates/common/workspace-schema.json
git commit -m "docs: document workspace-schema.json propagation and sync relationship"
```

---

### Task E3: Add ui-ux-pro-max gemini-parity declaration (H9)

**Files:**
- Modify: `.claude/skills/ui-ux-pro-max/SKILL.md`

- [ ] **Step 1: Read the SKILL.md frontmatter**

```bash
head -20 .claude/skills/ui-ux-pro-max/SKILL.md
```

- [ ] **Step 2: Add gemini-parity declaration to frontmatter**

```yaml
gemini-parity: skip
gemini-parity-reason: "Workspace-root-only skill — not propagated to templates/common/skills/"
workspace-only: true
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/ui-ux-pro-max/SKILL.md
git commit -m "docs: add gemini-parity skip and workspace-only annotations to ui-ux-pro-max skill"
```

---

## Final Verification

After all groups complete:

- [ ] **Run full audit**

```bash
bun scripts/audit.ts
```
Expected: 0 ERRORs.

- [ ] **Run validate-templates**

```bash
bun scripts/validate-templates.ts
```
Expected: 0 errors, 0 warnings across all variants.

- [ ] **Run integration tests**

```bash
bun test tests/integration/
```
Expected: all pass.

- [ ] **Verify no Korean outside ko/ directories**

```bash
# Verify no Korean characters remain outside ko/ directories
python3 -c "
import re, os
ko = re.compile(r'[AC00-D7A3 (Hangul syllables) and 1100-11FF (Hangul Jamo)㄰-㆏]')
for d in ['docs', 'agents', 'skills']:
    for root, dirs, files in os.walk(d):
        for f in files:
            if f.endswith('.md') and not f.endswith('_ko.md'):
                path = os.path.join(root, f)
                for i, line in enumerate(open(path, encoding='utf-8'), 1):
                    if ko.search(line):
                        print(f'{path}:{i}: {line.strip()}')
"
```
Expected: 0 matches.

- [ ] **Check pre-commit hook parses correctly**

```bash
bun --check scripts/hooks/pre-commit.ts
```
Expected: no type errors.
