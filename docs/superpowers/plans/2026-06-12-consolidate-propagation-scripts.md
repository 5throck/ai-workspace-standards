# Consolidate propagate-to-templates.ts + publish-to-template.ts

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `publish-to-template.ts` (1039 lines) into `propagate-to-templates.ts` (300 lines), producing a single authoritative L0→L1 sync tool and eliminating duplicate logic across both scripts.

**Architecture:** `propagate-to-templates.ts` becomes the unified tool. All unique capabilities from `publish-to-template.ts` (encoding check, `--governance-l1`, `--docs`, `--check-drift`, skills/commands propagation) are ported in. `publish-to-template.ts` is then deleted. `dev-sync.ts`, `package.json`, `SCRIPTS.md` are updated to point to the unified tool.

**Tech Stack:** TypeScript, Bun, Node.js `fs`/`crypto`, `propagation-map.json` (config SSOT)

---

## Files Touched

| Action | File | Reason |
|--------|------|--------|
| Modify | `scripts/propagate-to-templates.ts` | Absorb all features from publish-to-template.ts |
| Modify | `scripts/propagation-map.json` | Add skills/ and commands/ domains; fix hooks exclusion bug |
| Delete | `scripts/publish-to-template.ts` | Superseded |
| Modify | `scripts/dev-sync.ts` | Line 142: change call from publish to propagate |
| Modify | `package.json` | Remove `publish-to-template` script; update `propagate` |
| Modify | `scripts/SCRIPTS.md` | Remove publish-to-template entry; update propagate entry |
| Modify | `templates/common/scripts/SCRIPTS.md` | Same as above (L1 sync) |
| Modify | `scripts/audit.ts` | Remove `checkScriptSync()` — replaced by `propagate --dry-run --domain scripts` |
| Modify | `templates/common/scripts/audit.ts` | L1 sync of audit.ts change |

---

## Capability Map (what moves where)

| Feature | publish-to-template.ts | propagate-to-templates.ts (new) | Notes |
|---------|------------------------|--------------------------------|-------|
| Script sync (L0→L1) | SCRIPTS.md-driven, always-overwrite | propagation-map.json-driven, hash-compare | Merge: keep hash-compare; add `--force` flag for always-overwrite |
| Skills sync (L0→L1) | Hardcoded `skills/` walk | Add as `skills` domain in propagation-map.json | |
| Commands sync (L0→L1) | Hardcoded `.claude/commands/`, `.gemini/commands/` walk | Add as `claude-commands`, `gemini-commands` domains | |
| Encoding check (CP949) | Pre-publish gate | Port verbatim as pre-sync gate | |
| `--governance-l1` | L0→L1 CLAUDE/GEMINI/AGENTS with transforms | Port `applyGovernanceTransforms()` verbatim | |
| `--docs` | Marker injection L1→co-* variants | Port `publishDocs()` verbatim | |
| `--check-drift` | L1→L2 SHA-256 drift report | Already has domain structure; port L1→L2 collectDiffs variant | |
| `--force` | (default behavior) | New flag: skip hash check, always overwrite | |

---

## Task 1: Extend `propagation-map.json` with skills and commands domains

**Files:**
- Modify: `scripts/propagation-map.json`

- [ ] **Step 1: Read the current propagation-map.json**

```bash
cat scripts/propagation-map.json
```

- [ ] **Step 2: Add three new domains**

After the existing domains, add:

```json
"skills": {
  "description": "L0 skills/ → L1 templates/common/skills/",
  "source": "skills",
  "target": "templates/common/skills",
  "include_pattern": "*/SKILL.md",
  "recursive": true,
  "exclude": ["local", "external"],
  "note": "Skill directories excluded: local/ and external/ (variant-specific)"
},
"claude-commands": {
  "description": "L0 .claude/commands/ → L1 templates/common/.claude/commands/",
  "source": ".claude/commands",
  "target": "templates/common/.claude/commands",
  "include_pattern": "*.md",
  "recursive": false,
  "exclude": []
},
"gemini-commands": {
  "description": "L0 .gemini/commands/ → L1 templates/common/.gemini/commands/",
  "source": ".gemini/commands",
  "target": "templates/common/.gemini/commands",
  "include_pattern": "*.md",
  "recursive": false,
  "exclude": []
}
```

- [ ] **Step 3: Fix hooks exclusion bug**

In the `scripts-hooks` domain, add `pre-commit.ts` and `pre-push.ts` to the `exclude` array:

```json
"exclude": ["pre-commit.ts", "pre-push.ts"]
```

(These are L0-only per SCRIPTS.md but were previously NOT excluded, causing incorrect propagation.)

- [ ] **Step 4: Verify JSON is valid**

```bash
bun -e "JSON.parse(require('fs').readFileSync('scripts/propagation-map.json','utf8')); console.log('valid')"
```

Expected: `valid`

---

## Task 2: Port encoding check into `propagate-to-templates.ts`

**Files:**
- Modify: `scripts/propagate-to-templates.ts`

The encoding check from `publish-to-template.ts` (lines 34–181) detects CP949/Windows encoding corruption before any publish operation.

- [ ] **Step 1: Add `execSync` import and encoding constants**

After the existing imports at the top of the file, add:

```typescript
import { execSync } from 'node:child_process';

const TEXT_EXTENSIONS = new Set(['.md', '.ts', '.sh', '.ps1', '.json', '.yaml', '.yml', '.toml', '.txt', '.sample']);
const DOC_ONLY_EXTENSIONS = new Set(['.md', '.txt', '.yaml', '.yml', '.toml', '.sample']);
const REPLACEMENT_CHAR_RE = new RegExp(String.fromCodePoint(0xFFFD), 'g');
const ENCODING_CORRUPTION_PATTERNS: Array<{ pattern: RegExp; description: string; docOnly?: boolean }> = [
  { pattern: /\?\?/g, description: 'corrupted em-dash (—) or other multibyte UTF-8 char → ??', docOnly: true },
  { pattern: REPLACEMENT_CHAR_RE, description: 'Unicode replacement character (U+FFFD) — raw non-UTF-8 byte survived' },
];
interface EncodingViolation { file: string; pattern: string; lineNumbers: number[]; count: number; }
```

- [ ] **Step 2: Add `checkFileEncoding()` and `walkFilesForEncoding()` helper functions**

Port verbatim from `publish-to-template.ts` lines 60–102.

- [ ] **Step 3: Add `--skip-encoding-check` flag to CLI flags section**

```typescript
const SKIP_ENCODING = args.includes('--skip-encoding-check');
const FORCE         = args.includes('--force'); // always-overwrite, skip hash check
```

- [ ] **Step 4: Add encoding gate before `collectDiffs()` call in main**

After the `MAP_PATH` existence check, before `collectDiffs()`, add:

```typescript
if (!SKIP_ENCODING && APPLY) {
  const scanDirs = ['.', 'templates'];
  const allViolations: EncodingViolation[] = [];
  for (const scanDir of scanDirs) {
    if (!existsSync(scanDir)) continue;
    for (const file of walkFilesForEncoding(scanDir)) {
      allViolations.push(...checkFileEncoding(file));
    }
  }
  if (allViolations.length > 0) {
    console.error(`${C.red}❌ Encoding corruption detected — ${allViolations.length} violation(s). Fix before publishing.${C.reset}`);
    for (const v of allViolations) console.log(`   ${v.file}  [${v.count}×] ${v.pattern}`);
    process.exit(1);
  }
}
```

- [ ] **Step 5: Update `applyDiffs()` to respect `--force`**

Change the `if (d.status === 'in-sync') continue;` guard to:

```typescript
if (d.status === 'in-sync' && !FORCE) continue;
```

---

## Task 3: Port `--governance-l1` feature

**Files:**
- Modify: `scripts/propagate-to-templates.ts`

This feature copies CLAUDE.md, GEMINI.md, AGENTS.md from L0 to `templates/common/`, applying reference transformations (CONSTITUTION.md → docs/context.md, agent name substitutions, etc.)

- [ ] **Step 1: Add `GOVERNANCE_L1` flag**

```typescript
const GOVERNANCE_L1 = args.includes('--governance-l1');
```

- [ ] **Step 2: Port `GOVERNANCE_L1_FILES` constant, `applyGovernanceTransforms()`, and `publishGovernanceL1()` verbatim**

Copy from `publish-to-template.ts` lines 694–1035. These functions are self-contained and have no dependencies on publish-specific state.

Note: Replace `path.join(workspaceRoot, ...)` with `join(...)` calls (propagate uses relative paths from CWD). Verify `workspaceRoot` equivalent — in propagate-to-templates.ts the working directory is always the workspace root, so `workspaceRoot` = `process.cwd()`.

- [ ] **Step 3: Wire up at the bottom of main**

```typescript
if (GOVERNANCE_L1) {
  publishGovernanceL1(DRY_RUN);
}
```

---

## Task 4: Port `--docs` feature

**Files:**
- Modify: `scripts/propagate-to-templates.ts`

This feature injects `<!-- COMMON-CLAUDE:START/END -->` marked sections from L1 governance files into each `templates/co-*/` variant.

- [ ] **Step 1: Add `DOCS` flag**

```typescript
const DOCS = args.includes('--docs');
```

- [ ] **Step 2: Port `extractCommonSections()`, `replaceCommonSection()`, `publishDocs()` verbatim**

From `publish-to-template.ts` lines 561–684.

Same `workspaceRoot` note as Task 3 applies.

- [ ] **Step 3: Wire up at the bottom of main**

```typescript
if (DOCS) {
  publishDocs(DRY_RUN);
}
```

---

## Task 5: Port `--check-drift` feature (L1→L2)

**Files:**
- Modify: `scripts/propagate-to-templates.ts`

This feature shows L1 vs L2 drift (read-only). It already uses `propagation-map.json` internally in `publish-to-template.ts`.

- [ ] **Step 1: Add `CHECK_DRIFT` flag**

```typescript
const CHECK_DRIFT = args.includes('--check-drift');
```

- [ ] **Step 2: Add `parseScriptLayers` and `includeSkillInL1`/`includeScriptInL1` imports**

```typescript
import { parseScriptLayers, includeSkillInL1, includeScriptInL1 } from './helpers/layer-filter.js';
```

- [ ] **Step 3: Port `collectDiffsL1L2()` function (renamed to avoid collision with existing `collectDiffs()`)**

Port `collectDiffs()` from `publish-to-template.ts` lines 418–502, renaming it `collectDiffsL1L2()`. This version operates L1→L2 direction (loops over template variants).

- [ ] **Step 4: Wire up at the bottom of main**

```typescript
if (CHECK_DRIFT) {
  console.log(`\n${C.cyan}=== --check-drift: L1 vs L2 drift report (read-only) ===${C.reset}`);
  const drifts = collectDiffsL1L2(MAP_PATH);
  printTable(drifts);
  const outOfSync = drifts.filter(d => d.status !== 'in-sync');
  console.log(`Total checked: ${drifts.length}, Out of sync: ${outOfSync.length}`);
  if (outOfSync.length > 0) {
    console.log(`\nℹ️  L2 drift is expected under Fork Model (ADR-0031). Run create-l2-scaffold.ts to re-scaffold.`);
    process.exitCode = 1;
  }
}
```

---

## Task 6: Update the header comment with new unified usage

**Files:**
- Modify: `scripts/propagate-to-templates.ts`

- [ ] **Step 1: Replace the header block**

```typescript
/**
 * propagate-to-templates.ts — Unified L0→L1 sync tool
 *
 * Replaces publish-to-template.ts (deprecated). Single authoritative script for
 * all L0→L1 propagation. Config-driven via propagation-map.json (SSOT for exclusions).
 *
 * @version 2.0.0
 *
 * Usage:
 *   bun scripts/propagate-to-templates.ts [--dry-run|--apply] [--domain <name>] [flags]
 *
 * Flags:
 *   --dry-run          Default: show diffs without writing (exit 1 if out-of-sync)
 *   --apply            Write changed files to L1
 *   --force            With --apply: skip hash check, always overwrite
 *   --domain <name>    Filter to a single domain from propagation-map.json
 *   --governance-l1    Deploy CLAUDE.md, GEMINI.md, AGENTS.md L0→L1 with ref transforms
 *   --docs             Inject COMMON markers from L1 governance files into templates/co-* (L1→L2)
 *   --check-drift      L1 vs L2 drift report (read-only)
 *   --skip-encoding-check  Skip CP949 corruption check (not recommended)
 *
 * Domains (propagation-map.json):
 *   scripts            scripts/*.ts  L0→L1
 *   scripts-hooks      scripts/hooks/*.ts  L0→L1 (excl. pre-commit.ts, pre-push.ts)
 *   scripts-helpers    scripts/helpers/*.ts  L0→L1
 *   skills             skills/ SKILL.md files  L0→L1 (excl. local/, external/)
 *   claude-commands    .claude/commands/*.md  L0→L1
 *   gemini-commands    .gemini/commands/*.md  L0→L1
 *   [others]           see propagation-map.json for full list
 */
```

---

## Task 7: Update `dev-sync.ts`

**Files:**
- Modify: `scripts/dev-sync.ts`

- [ ] **Step 1: Update line 142**

Change:
```typescript
const publishRes = await $`bun scripts/publish-to-template.ts`.nothrow();
```

To:
```typescript
const publishRes = await $`bun scripts/propagate-to-templates.ts --apply`.nothrow();
```

- [ ] **Step 2: Verify dev-sync.ts still runs correctly (dry-run)**

```bash
bun scripts/dev-sync.ts --dry-run 2>&1 | head -30
```

---

## Task 8: Update `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove `publish-to-template` entry, update `propagate`**

Change:
```json
"publish-to-template": "bun scripts/publish-to-template.ts",
"propagate": "bun scripts/propagate-to-templates.ts",
```

To:
```json
"propagate": "bun scripts/propagate-to-templates.ts",
"propagate:apply": "bun scripts/propagate-to-templates.ts --apply",
"propagate:governance": "bun scripts/propagate-to-templates.ts --governance-l1 --apply",
"propagate:docs": "bun scripts/propagate-to-templates.ts --docs --apply",
"propagate:drift": "bun scripts/propagate-to-templates.ts --check-drift",
```

---

## Task 9: Remove `checkScriptSync()` from `audit.ts`

**Files:**
- Modify: `scripts/audit.ts`
- Modify: `templates/common/scripts/audit.ts`

The `checkScriptSync()` function (lines 549–581) is now redundant — `propagate-to-templates.ts --dry-run --domain scripts` covers the same check.

- [ ] **Step 1: Delete `checkScriptSync()` function and its call**

Remove lines 549–581 (function definition) and line 734 (`checkScriptSync()` call).

Replace the call site with:
```typescript
// Script sync validated via: bun scripts/propagate-to-templates.ts --dry-run --domain scripts
```

- [ ] **Step 2: Bump audit.ts @version to 2.7.0**

- [ ] **Step 3: Sync to L1**

```bash
cp scripts/audit.ts templates/common/scripts/audit.ts
```

- [ ] **Step 4: Verify audit still passes**

```bash
bun scripts/audit.ts
```

Expected: `✅ All checks passed.` (Script sync check removed, but still PASS overall)

---

## Task 10: Update `SCRIPTS.md` (L0 and L1)

**Files:**
- Modify: `scripts/SCRIPTS.md`
- Modify: `templates/common/scripts/SCRIPTS.md`

- [ ] **Step 1: Remove `publish-to-template.ts` row**

Delete the line: `| \`publish-to-template.ts\` | L0 | 1.8.0 | active | ...`

- [ ] **Step 2: Update `propagate-to-templates.ts` row**

Change version to `2.0.0` and update description to: `Unified L0→L1 sync tool (replaces publish-to-template.ts). Config-driven via propagation-map.json. Flags: --apply, --force, --governance-l1, --docs, --check-drift`

- [ ] **Step 3: Update narrative sections**

- Change `bun run publish-to-template` → `bun run propagate:apply` in the "L1 — Template snapshot" row
- Update the propagation rule paragraph

- [ ] **Step 4: Sync to L1**

```bash
cp scripts/SCRIPTS.md templates/common/scripts/SCRIPTS.md
```

---

## Task 11: Delete `publish-to-template.ts` and sync L1

**Files:**
- Delete: `scripts/publish-to-template.ts`
- Delete: `templates/common/scripts/publish-to-template.ts` (if exists)

- [ ] **Step 1: Verify publish-to-template.ts is no longer referenced anywhere**

```bash
grep -rn "publish-to-template" --include="*.ts" --include="*.md" --include="*.json" . | grep -v "CHANGELOG.md\|node_modules"
```

Expected: zero results (only CHANGELOG historical entries are acceptable)

- [ ] **Step 2: Delete the file**

```bash
rm scripts/publish-to-template.ts
```

Check if L1 copy exists and delete:
```bash
ls templates/common/scripts/publish-to-template.ts 2>/dev/null && rm templates/common/scripts/publish-to-template.ts
```

---

## Task 12: Bump version and run final audit

- [ ] **Step 1: Verify final version of `propagate-to-templates.ts`**

```bash
head -5 scripts/propagate-to-templates.ts
```

Expected: `@version 2.0.0`

- [ ] **Step 2: Run propagate --dry-run to confirm all domains work**

```bash
bun scripts/propagate-to-templates.ts --dry-run
```

Expected: Table output with all domains listed, no errors.

- [ ] **Step 3: Run full audit**

```bash
bun scripts/audit.ts
```

Expected: `✅ All checks passed.`

- [ ] **Step 4: Lifecycle update (N-1)**

Update `scripts/SCRIPTS.md` and `templates/common/scripts/SCRIPTS.md` version entries.

- [ ] **Step 5: Commit via /sync**

```
/sync "refactor: consolidate publish-to-template.ts into propagate-to-templates.ts (M-10)"
```

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `publish-to-template.ts` deleted, no references remain | `grep -rn publish-to-template . \| grep -v CHANGELOG` → 0 results |
| C-02 | All 6 domains (scripts, hooks, helpers, skills, claude-commands, gemini-commands) in propagation-map.json | `cat scripts/propagation-map.json \| grep '"source"'` |
| C-03 | `propagate-to-templates.ts --apply` correctly syncs scripts to L1 | Before/after SHA-256 comparison |
| C-04 | `--governance-l1` produces same output as old `publish-to-template.ts --governance-l1` | Manual diff comparison |
| C-05 | `bun scripts/audit.ts` passes (no Script sync failure) | exit 0 |
| C-06 | `dev-sync.ts` calls `propagate-to-templates.ts --apply` | grep |
| C-07 | hooks `pre-commit.ts`, `pre-push.ts` excluded in propagation-map.json | `cat scripts/propagation-map.json` |
