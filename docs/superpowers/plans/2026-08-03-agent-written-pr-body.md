# Agent-Written PR Body Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `claude -p` dependency from PR body generation by having the agent invoking `/sync` write the PR body itself, with `dev-sync.ts` accepting it via `--body-file`.

**Architecture:** `gen-pr-body.ts` becomes template-only (AI mode + prompt sanitizer deleted). `dev-sync.ts` gains `--body-file <path>` argument parsing; when the file exists it validates English and submits via `gh pr create --body-file`, otherwise the existing fallback chain (template → `pull_request_template.md` → `--fill`) is unchanged. `skills/sync/SKILL.md` instructs the agent to generate the body and save it to `<git-dir>/sync-pr-body.md`.

**Tech Stack:** Bun (TypeScript), `bun` shell templating, `gh` CLI.

**Workspace adaptation note:** Direct `git commit` is blocked by the pre-commit hook (requires `/sync` context env vars). This plan therefore performs edits + verification in tasks 1–6 and a single `/sync` commit+push+PR as the final task, per workspace governance (AGENTS.md §8).

**L0/L1 substitution rule:** L0 files reference `CONSTITUTION.md`; their `templates/common/` (L1) mirrors differ only by using `context.md` instead. Apply every L0 edit to the L1 copy with that substitution.

---

### Task 1: `scripts/gen-pr-body.ts` — remove AI mode (L0)

**Files:**
- Modify: `scripts/gen-pr-body.ts` (whole file — see full replacement below)

- [ ] **Step 1: Replace `scripts/gen-pr-body.ts` entirely**

New content (removes `withRetry` import, `today`, `getDiffStat`, `sanitizeForPrompt`, and the whole Claude AI mode; version `1.1.5 → 1.2.0`):

```ts
#!/usr/bin/env bun
/**
 * gen-pr-body.ts - Generate a structured PR body from commit message + diff
 * Usage: bun run scripts/gen-pr-body.ts "<commit message>"
 * Output: PR body markdown (stdout)
 * @version 1.2.0
 *
 * Behaviour:
 *   Builds a structured template PR body from the commit message + file list.
 *
 *   NOTE (1.2.0): AI-mode generation via the `claude -p` CLI was removed. The
 *   agent invoking /sync writes the PR body itself (see skills/sync/SKILL.md)
 *   and passes it to dev-sync.ts via --body-file; this script remains the
 *   template fallback and language-validation point for the pipeline.
 */

import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { hasNonEnglish } from './lib/language-guard.ts';

const commitMsg = process.argv.slice(2).join(' ');
if (!commitMsg) {
  process.stderr.write('Usage: bun run scripts/gen-pr-body.ts "<commit message>"\n');
  if (import.meta.main) {
    process.exit(1);
  }
}

// ── Language validation ───────────────────────────────────────────────────────
// PR titles, bodies, and commit messages must be in English — see CONSTITUTION.md §3
// (workspace root) or docs/context.md §3 (variant projects, which omit CONSTITUTION.md).
// Detection (Korean/Japanese/Chinese) lives in scripts/lib/language-guard.ts, shared
// with dev-sync.ts and pre-commit.ts so the three enforcement points can't drift.
const LANGUAGE_POLICY_REF = existsSync('CONSTITUTION.md') ? 'CONSTITUTION.md §3' : 'docs/context.md §3';

function validateLanguage(text: string, label = 'PR body'): void {
  if (hasNonEnglish(text)) {
    process.stderr.write(
      `\x1b[31m[FAIL]\x1b[0m Non-English characters detected in ${label}.\n` +
      `       ${LANGUAGE_POLICY_REF} mandates all PR titles and bodies must be written in English.\n` +
      `       Translate the content to English before generating the PR.\n`
    );
    process.exit(1);
  }
}

// Validate commit message used as PR title/summary
validateLanguage(commitMsg, 'commit message / PR title');

// ── Collect changed files ──────────────────────────────────────────────────────
async function getFiles(): Promise<string> {
  let result = (await $`git diff --name-only HEAD~1 HEAD`.quiet().nothrow()).stdout.toString().trim();
  if (!result) result = (await $`git diff --cached --name-only`.quiet().nothrow()).stdout.toString().trim();
  if (!result) result = (await $`git show --name-only --format= HEAD`.quiet().nothrow()).stdout.toString().trim();
  return result;
}

const filesRaw = await getFiles();

const fileList = filesRaw
  .split('\n')
  .filter(Boolean)
  .slice(0, 30)
  .map(f => `- ${f}`)
  .join('\n') || '';

// ── Fallback mode: structured template with auto-filled fields ────────────────
const fallback = `## Why
${commitMsg}

## What Changed
${fileList}

## Test Plan
- [ ] \`bun scripts/audit.ts\` passes
- [ ] CHANGELOG.md updated under \`[Unreleased]\`

## Security Checklist
- [ ] No secrets, credentials, or API keys committed
- [ ] No \`.env\` files staged (use \`.env.sample\` for templates)
- [ ] Dependencies unchanged or reviewed for new CVEs

## Notes
None

---
`;

validateLanguage(fallback, 'fallback PR body');
process.stdout.write(fallback);
```

- [ ] **Step 2: Verify no `claude` reference remains and script runs**

Run: `grep -n "claude" scripts/gen-pr-body.ts`
Expected: no output (exit 1).

Run: `bun scripts/gen-pr-body.ts "feat: test template body" | head -5`
Expected: prints `## Why` / `feat: test template body` template — no LLM invocation.

---

### Task 2: `scripts/dev-sync.ts` — add `--body-file` (L0)

**Files:**
- Modify: `scripts/dev-sync.ts:1` (version header)
- Modify: `scripts/dev-sync.ts:29` (argument parsing)
- Modify: `scripts/dev-sync.ts:413-449` (PR body selection + creation)

- [ ] **Step 1: Bump version header**

Replace:
```ts
// @version 1.3.6
```
With:
```ts
// @version 1.4.0
```

- [ ] **Step 2: Replace the argument-parsing line**

Replace:
```ts
const msg = process.argv.slice(2).join(' ') || "chore: update";
```
With:
```ts
// ── Argument parsing ──────────────────────────────────────────────────────────
// --body-file <path> (or --body-file=<path>) is consumed here and removed from
// the commit-message args. The agent invoking /sync writes the PR body itself to
// that file (see skills/sync/SKILL.md); when absent, the PR-creation fallback
// chain below still applies.
const rawArgs = process.argv.slice(2);
let bodyFilePath = '';
const msgArgs: string[] = [];
for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === '--body-file') {
    bodyFilePath = rawArgs[++i] || '';
  } else if (arg.startsWith('--body-file=')) {
    bodyFilePath = arg.slice('--body-file='.length);
  } else {
    msgArgs.push(arg);
  }
}
const msg = msgArgs.join(' ') || "chore: update";
```

- [ ] **Step 3: Replace the PR body selection + creation block**

Replace the block from `let prBody = "";` (line 417) through the end of the `else` `--fill` branch (line 449) with:

```ts
    // PR body selection:
    //   1. --body-file provided by the agent (skills/sync/SKILL.md) → validate
    //      English, submit via `gh pr create --body-file` (no shell escaping).
    //   2. gen-pr-body.ts template fallback (commit message + file list).
    //   3. .github/pull_request_template.md.
    //   4. gh pr create --fill.
    let prBody = "";
    let bodySourceFile = "";
    if (bodyFilePath) {
        if (!fs.existsSync(bodyFilePath)) {
            console.log(`${YELLOW}⚠️  --body-file not found (${bodyFilePath}) — falling back to template/--fill${RESET}`);
        } else {
            const agentBody = fs.readFileSync(bodyFilePath, 'utf-8').trim();
            if (!agentBody) {
                console.log(`${YELLOW}⚠️  --body-file is empty — falling back to template/--fill${RESET}`);
            } else {
                // Same English gate as the commit message above.
                if (hasNonEnglish(agentBody)) {
                    console.log(`${RED}❌ Agent-written PR body must be written in English (CONSTITUTION.md §3).${RESET}`);
                    console.log(`${YELLOW}   Regenerate the body in English and re-run /sync.${RESET}`);
                    if (import.meta.main) {
                        process.exit(1);
                    }
                }
                prBody = agentBody;
                bodySourceFile = bodyFilePath;
            }
        }
    }

    if (!prBody) {
        // Note: msg already passed the language gate above, so a non-zero exit here
        // means gen-pr-body.ts hit a non-language failure — safe to fall back to the
        // template/--fill paths below, but surface the reason instead of silently
        // swallowing it.
        try {
            const genRes = await $`bun run scripts/gen-pr-body.ts "${msg}"`.quiet().nothrow();
            if (genRes.exitCode !== 0) {
                console.log(`${YELLOW}⚠️  gen-pr-body.ts failed — falling back to template/--fill:${RESET}`);
                console.log(genRes.stderr.toString().trim());
            }
            prBody = genRes.stdout.toString().trim();
        } catch (err) {
            console.error(`[dev-sync] Error: ${err}`);
        }
    }

    let prCreateRetry: Awaited<ReturnType<typeof withRetry>>;
    if (bodySourceFile) {
        prCreateRetry = await withRetry(
            () => $`gh pr create --title ${msg} --body-file ${bodySourceFile}`.nothrow(),
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: { exitCode: number }) => r.exitCode === 0 },
            'gh pr create'
        );
    } else if (prBody) {
        prCreateRetry = await withRetry(
            () => $`gh pr create --title ${msg} --body ${prBody}`.nothrow(),
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: { exitCode: number }) => r.exitCode === 0 },
            'gh pr create'
        );
    } else if (fs.existsSync(path.join('.github', 'pull_request_template.md'))) {
        const prTpl = fs.readFileSync(path.join('.github', 'pull_request_template.md'), 'utf-8');
        prCreateRetry = await withRetry(
            () => $`gh pr create --title ${msg} --body ${prTpl}`.nothrow(),
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: { exitCode: number }) => r.exitCode === 0 },
            'gh pr create'
        );
    } else {
        prCreateRetry = await withRetry(
            () => $`gh pr create --fill`.nothrow(),
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: { exitCode: number }) => r.exitCode === 0 },
            'gh pr create'
        );
    }
```

- [ ] **Step 4: Type-check**

Run: `bunx tsc --noEmit`
Expected: exit 0 (tsconfig covers `scripts/**/*.ts`, strict + noUnusedLocals — all imports still used).

---

### Task 3: `skills/sync/SKILL.md` — agent body-writing instructions (L0)

**Files:**
- Modify: `skills/sync/SKILL.md`

- [ ] **Step 1: Bump frontmatter**

Replace:
```yaml
version: 1.1.0
last_reviewed: 2026-07-10
```
With:
```yaml
version: 1.2.0
last_reviewed: 2026-08-03
```

- [ ] **Step 2: Restructure `## Execution Steps`**

Replace the entire Execution Steps section (from `## Execution Steps` through the line `3. If audit fails, fix the reported issue before re-running.`) with:

```markdown
## Execution Steps

1. **Write the PR body** (the agent writes it — never shell out to an LLM CLI):
   - Inspect the change: `git diff HEAD~1 --stat` and `git diff HEAD~1 --name-only` (first 30 files).
   - Write the body in English using EXACTLY this structure (keep all section headers, fill placeholders):

     ## Why
     [1-3 sentences: what problem does this solve and why now?]

     ## What Changed
     [concise bullet list of actual changes — be specific, not generic]

     ## Test Plan
     - [ ] `bun scripts/audit.ts` passes
     - [ ] [add relevant manual or automated test steps]

     ## Security Checklist
     - [ ] No secrets, credentials, or API keys committed
     - [ ] No `.env` files staged (use `.env.sample` for templates)
     - [ ] Dependencies unchanged or reviewed for new CVEs

     ## Notes
     [Breaking changes, deployment steps, or reviewer guidance. Write 'None' if not applicable.]

     ---

   - Save it to `<git-dir>/sync-pr-body.md`, where `<git-dir>` is `git rev-parse --git-dir` (e.g. `.git/sync-pr-body.md`) — outside the working tree so it is never committed.

2. Run the sync script with the provided arguments, passing the body file:
   ```bash
   bun scripts/dev-sync.ts --body-file "$(git rev-parse --git-dir)/sync-pr-body.md" "$ARGUMENTS"
   ```

3. The pipeline executes the following steps in order:

| Step | Name | Fatal? | Description |
|------|------|:------:|-------------|
| 0 | CWD Guard | **FATAL** | Verifies script runs from workspace root; exits if CWD mismatches `import.meta.dir/..` |
| 1 | Language Gate | **FATAL** | Commit message / PR title must be English (CONSTITUTION.md S3); blocks non-English via `language-guard.ts` |
| 2 | Memory Session Entry | **FATAL** | Appends session summary (changes, decisions, open issues) to `memory/YYYY-MM-DD.md` |
| 2 | MEMORY.md Index Sync | **FATAL** | Updates `memory/MEMORY.md` index via `sync-md.ts` |
| 2.5 | scripts/README.md Generation | **FATAL** | Regenerates `scripts/README.md` via `generate-scripts-readme.ts` if the script exists |
| 3 | CHANGELOG.md Check | **FATAL** | Checks `CHANGELOG.md [Unreleased]` — **blocks and exits** if empty (agent must add entries first via `/changelog` or manual edit) |
| 3.6 | Deprecated Script Warnings | non-fatal | Scans `SCRIPTS.md` for deprecated scripts and prints warnings |
| 3.7 | L0/L1 Script Drift Check | non-fatal | Runs `verify-scripts.ts --check-drift` to detect drift between L0 and L1 script copies |
| 3.8 | Memory File Archival | non-fatal | Runs `archive-memory.ts` to archive old memory files |
| 3.9 | Spec Registry Check | non-fatal | Runs `audit.ts --spec-check --lifecycle-only` to warn about stale specs |
| 4 | AUDIT GATE | **FATAL** | Runs `audit.ts` — must exit 0 before proceeding |
| 4.5 | VERSION_MANIFEST.md Generation | **FATAL** | Generates `VERSION_MANIFEST.md` via `generate-version-manifest.ts` |
| 4.7 | L0 to L1 Publish | **FATAL** (L0) / non-fatal (L1) | Propagates scripts, skills, commands, docs via `propagate-to-templates.ts --apply`; fatal only in L0 context (CONSTITUTION.md present) |
| 4.8 | Skill Sync to Platforms | non-fatal | Runs `sync-skills.ts` to distribute skills to `.claude/skills/`, `.gemini/skills/`, `.agents/skills/`; warnings only |
| 5 | Branch Creation | **FATAL** | Creates `pr/<timestamp>-<slug>` branch if on main/master; reuses existing branch otherwise |
| 6 | Sensitive File Guard + Git Add/Commit/Push | **FATAL** | Guards against `.pem`, `.key`, `.env`, `credentials.json`, etc.; runs `git add -A`, `git commit`, `git push` |
| 7 | PR Creation | **FATAL** | If `--body-file` was passed, validates it (English) and opens the PR via `gh pr create --body-file`; otherwise falls back to `gen-pr-body.ts` template, `.github/pull_request_template.md`, then `gh pr create --fill`; idempotent — updates existing PR if one already exists for the branch |

4. If audit fails, fix the reported issue before re-running.
```

- [ ] **Step 3: Update `## PR Language Rule`**

Replace:
```markdown
## PR Language Rule

All PR titles and bodies generated by this command **must be written in English**, regardless of the active session language. Never write Korean or any other language in `gh pr create` or `gh pr edit` calls.
```
With:
```markdown
## PR Language Rule

All PR titles and bodies generated by this command **must be written in English**, regardless of the active session language. This applies to the agent-written body in step 1 and to any `gh pr create` / `gh pr edit` calls — `dev-sync.ts` blocks non-English bodies at the same `language-guard` gate used for commit messages.
```

---

### Task 4: `scripts/SCRIPTS.md` — version + purpose updates (L0)

**Files:**
- Modify: `scripts/SCRIPTS.md:63` (dev-sync version row)
- Modify: `scripts/SCRIPTS.md:68` (gen-pr-body version row)
- Modify: `scripts/SCRIPTS.md:258-260` (gen-pr-body section)

- [ ] **Step 1: Update dev-sync version row**

Replace:
```
| `dev-sync.ts` | L0 | 1.3.6 | active | —| —| L0+L1 | —|
```
With:
```
| `dev-sync.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
```

- [ ] **Step 2: Update gen-pr-body version row**

Replace:
```
| `gen-pr-body.ts` | L0 | 1.1.5 | active | —| —| L0+L1 | —|
```
With:
```
| `gen-pr-body.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
```

- [ ] **Step 3: Update gen-pr-body purpose section**

Replace:
```
#### `gen-pr-body.ts`
**Purpose**: Generates PR body from commit log and memory log. Called by `dev-sync.ts`.
**Usage**: Invoked automatically. Can be called standalone: `bun run gen-pr-body "msg"`
```
With:
```
#### `gen-pr-body.ts`
**Purpose**: Generates a structured template PR body from commit message + file list — template fallback for `dev-sync.ts`. (AI-mode generation via `claude -p` was removed in 1.2.0; the agent writes the PR body itself per `skills/sync/SKILL.md`.)
**Usage**: Invoked automatically. Can be called standalone: `bun run gen-pr-body "msg"`
```

---

### Task 5: L1 copies in `templates/common/`

**Files:**
- Modify: `templates/common/scripts/gen-pr-body.ts`
- Modify: `templates/common/scripts/dev-sync.ts`
- Modify: `templates/common/skills/sync/SKILL.md`
- Modify: `templates/common/scripts/SCRIPTS.md`

- [ ] **Step 1: Mirror Task 1 into `templates/common/scripts/gen-pr-body.ts`**

Apply the identical full-file replacement, but substitute the L1 wording in the language-validation comment block:
- `CONSTITUTION.md §3 (workspace root) or docs/context.md §3 (variant projects, which omit CONSTITUTION.md)` → `context.md §3 (workspace root) or docs/context.md §3 (variant projects, which omit context.md)`
- `const LANGUAGE_POLICY_REF = existsSync('CONSTITUTION.md') ? 'CONSTITUTION.md §3' : 'docs/context.md §3';` → `const LANGUAGE_POLICY_REF = existsSync('context.md') ? 'context.md §3' : 'docs/context.md §3';`

(Header doc-comment references `skills/sync/SKILL.md` stay identical — SKILL.md exists at both levels.)

- [ ] **Step 2: Mirror Task 2 into `templates/common/scripts/dev-sync.ts`**

Apply the identical edits (`@version 1.4.0`, argument parsing, PR body block) with the L1 substitution in the English-gate messages:
- `(CONSTITUTION.md §3)` → `(context.md §3)` in the two `console.log` lines added in step 3 of Task 2.
- The other CONSTITUTION.md references already differ in L1 — leave them as-is.

- [ ] **Step 3: Mirror Task 3 into `templates/common/skills/sync/SKILL.md`**

Apply the identical edits, with the existing L1 substitution:
- Step-3 table row 1: `CONSTITUTION.md S3` → `context.md S3`
- Row 4.7: `fatal only in L0 context (CONSTITUTION.md present)` → `fatal only in L0 context (context.md present)`

- [ ] **Step 4: Mirror Task 4 into `templates/common/scripts/SCRIPTS.md`**

SCRIPTS.md is identical between L0 and L1 — apply the same three edits verbatim.

- [ ] **Step 5: Verify L0/L1 parity (expect only the known context.md diffs)**

Run: `diff scripts/dev-sync.ts templates/common/scripts/dev-sync.ts | grep -c "^[<>]"`
Expected: only the `context.md`/`CONSTITUTION.md` lines differ (6 lines, all `*md §3` wording). If any non-wording diff appears, fix the L1 mirror.

---

### Task 6: Verification + sync

**Files:**
- Verify: all edited files

- [ ] **Step 1: Type-check all L0 scripts**

Run: `bunx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Standalone smoke test of template fallback**

Run: `bun scripts/gen-pr-body.ts "feat: smoke test" | head -8`
Expected: `## Why` header, no `claude` invocation, exit 0.

- [ ] **Step 3: Confirm no `claude -p` remains anywhere in the pipeline**

Run: `grep -rn "claude -p\|claude --version" scripts/ templates/common/`
Expected: no output.

- [ ] **Step 4: Commit + push + PR via `/sync`**

Run: `/sync "refactor(scripts): replace claude -p PR body generation with agent-written body"`
- The agent writes the PR body itself (per the updated skill) and passes `--body-file`.
- This also propagates L0→L1 (step 4.7), regenerates `scripts/README.md` + `VERSION_MANIFEST.md`, and syncs the platform skill copies (step 4.8).
- Expected: audit passes, PR opened with the agent-written body.

---

## Self-Review

**Spec coverage:**
- Remove `claude` detection/generation → Task 1 (gen-pr-body), Task 6 Step 3
- `--body-file` support + `--body-file` gh flag + English validation → Task 2
- SKILL.md agent instructions + `<git-dir>` via `git rev-parse --git-dir` → Task 3
- SCRIPTS.md purpose/version updates → Task 4
- L1 propagation → Task 5
- Edge cases (no body → fallback chain, non-English body → gate, standalone invocation, existing-PR idempotency) → Task 2 (fallback chain preserved), Task 6 Step 2
- L2 variants out of scope → documented in design doc, not planned here

**Placeholders:** none — every step has concrete code or commands.

**Type consistency:** `bodyFilePath` (parsed in Task 2 Step 2) and `bodySourceFile` / `prBody` (Task 2 Step 3) naming consistent; `hasNonEnglish` already imported at `dev-sync.ts:7`; `withRetry`/`DEFAULT_CONFIG` still used in dev-sync (import untouched).
