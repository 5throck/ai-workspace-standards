#!/usr/bin/env bun
// @version 1.0.0
// auto-release-template.ts — nightly automatic template release step
// (spec docs/designs/2026-09-27-auto-template-release-design.md; ADR-0089
// runner host, inserted between Phase I landing and Phase II start).
//
// Classifies the pending delivered-template diff against the current release
// tag, then composes the existing atomic helpers — it never reimplements the
// VERSION bump or the changelog cut and never pushes:
//   bun scripts/release-template.ts --bump <level> --notes "..." --no-tag
// Landing (dev-sync PR + merge) and post-merge tagging
// (bun scripts/tag-template.ts --fail-on-push-error) belong to the caller.
//
// Usage:
//   bun scripts/auto-release-template.ts            # plan mode (default; read-only)
//   bun scripts/auto-release-template.ts --plan     # same, explicit
//   bun scripts/auto-release-template.ts --dry-run  # alias for --plan (design §7 wording)
//   bun scripts/auto-release-template.ts --release  # live: synthesize [Unreleased] entry + bump
//
// Exit codes:
//   0 = plan computed (or release completed)
//   2 = manual-review — the runner files a ticket and skips the release
//   3 = no pending delivered changes — no-op, nothing mutated
//   1 = error (guard refusal, git failure, release-helper failure)
//
// Guards: templates/VERSION must be semver; --release additionally requires a
// clean tree (git status --porcelain empty). Plan mode is read-only and only
// warns on a dirty tree (the classification diff is commit-range based, so a
// dirty tree cannot change it).

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { die, fatalError, logError, ErrorPhase } from './lib/error-handling.ts';
import { localDateISO } from './lib/local-date.ts';
import {
  classifyTemplateChanges,
  isSemver,
  type ClassifyResult,
} from './lib/template-release-classify.ts';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const workspaceRoot = path.resolve(import.meta.dir, '..');
const versionPath = path.join(workspaceRoot, 'templates', 'VERSION');
const changelogPath = path.join(workspaceRoot, 'templates', 'CHANGELOG.md');

function usage(exitCode = 1): never {
  console.log(`Usage: bun scripts/auto-release-template.ts [--plan | --dry-run | --release]`);
  console.log(`  --plan / --dry-run / (default)  read-only classification of the pending template diff`);
  console.log(`  --release                       synthesize the [Unreleased] entry and bump via release-template.ts --no-tag`);
  console.log(`Exit codes: 0 ok / 2 manual-review / 3 no pending changes / 1 error`);
  process.exit(exitCode);
}

// ── CLI parsing ──────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) usage(0);
const wantsRelease = argv.includes('--release');
const wantsPlan = argv.includes('--plan') || argv.includes('--dry-run');
if (wantsRelease && wantsPlan) die('--plan and --release are mutually exclusive.');
const releaseMode = wantsRelease;

// ── Guards ───────────────────────────────────────────────────────────────────

const currentVersion = readFileSync(versionPath, 'utf-8').trim();
if (!isSemver(currentVersion)) {
  die(`templates/VERSION '${currentVersion}' is not semver X.Y.Z — refuse to run (design R6b).`);
}

function git(args: string[], label: string): string {
  const result = spawnSync('git', ['-C', workspaceRoot, ...args], { encoding: 'utf-8' });
  if (result.status !== 0) {
    die(`git ${label} failed (exit ${result.status}): ${(result.stderr ?? '').trim()}`);
  }
  return result.stdout ?? '';
}

const porcelain = git(['status', '--porcelain'], 'status --porcelain');
if (porcelain.trim()) {
  if (releaseMode) {
    die(`working tree is not clean — --release requires a clean tree (design R12). Commit or land the pending changes first.`);
  }
  console.log(`${YELLOW}⚠ Working tree is not clean; plan mode is read-only, continuing.${RESET}`);
}

// ── Pending diff + tag facts ─────────────────────────────────────────────────

const diffRange = `template-v${currentVersion}..HEAD`;
const diffOut = git(
  ['diff', '-M', diffRange, '--name-status', '--', 'templates/'],
  `diff -M ${diffRange} --name-status -- templates/`,
);
const rows = diffOut.split('\n');

const tagName = `template-v${currentVersion}`;
const tagOut = git(['tag', '-l', tagName], `tag -l ${tagName}`).trim();
const tagExists = tagOut === tagName;
const allTags = git(['tag', '-l', 'template-v*'], 'tag -l template-v*')
  .split('\n')
  .map((t) => t.trim())
  .filter(Boolean);
const otherTemplateTagsExist = allTags.some((t) => t !== tagName);

// ── Classification (R4: print the table in both modes) ──────────────────────

const result: ClassifyResult = classifyTemplateChanges(rows, {
  currentVersion,
  tagExists,
  otherTemplateTagsExist,
});

const c = result.counts;
const summary = `A ${c.added} / M ${c.modified} / D ${c.deleted} / R ${c.renamed}${c.other ? ` / other ${c.other}` : ''}`;

console.log(`${CYAN}Template auto-release plan${RESET}`);
console.log(`  Current version : ${currentVersion}`);
console.log(`  Diff base       : ${diffRange}`);
console.log(`  Tag present     : ${tagExists ? 'yes' : 'NO'}${otherTemplateTagsExist ? ' (older template-v* tags exist)' : ''}`);
console.log(`  Scoped rows     : ${c.scopedTotal} (delivered path endpoints ${c.deliveredPaths})`);
console.log(`  Per status      : ${summary}`);
const dirSummary = Object.entries(c.byDir)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([d, n]) => `${d} ${n}`)
  .join(' / ');
console.log(`  Per directory   : ${dirSummary || '(none)'}`);
console.log(`  Level           : ${result.level.toUpperCase()}`);
if (result.nextVersion) console.log(`  Next version    : ${result.nextVersion}`);
for (const [family, list] of Object.entries(result.samples)) {
  if (list.length) console.log(`  Sample ${family.padEnd(8)}: ${list.join(' | ')}`);
}

// ── No-op / manual-review exits (R3, R6) ────────────────────────────────────

if (result.level === 'no-op') {
  console.log(`${GREEN}No pending delivered template changes — nothing to release, nothing mutated.${RESET}`);
  process.exit(3);
}

if (result.level === 'manual-review') {
  console.error(`${RED}Manual review required — no auto-release (design R6):${RESET}`);
  for (const reason of result.reasons) console.error(`  - ${reason}`);
  console.error(`File one ticket (bun scripts/ticket.ts create auto-template-release --priority high) and skip the release.`);
  process.exit(2);
}

console.log(`  Class summary   : ${summary}`);

// ── Release mode ─────────────────────────────────────────────────────────────

if (!releaseMode) {
  console.log(`${YELLOW}Dry run — no files changed.${RESET}`);
  console.log(`To release: bun scripts/auto-release-template.ts --release`);
  process.exit(0);
}

const releaseDate = localDateISO();
const notes = `auto-release ${releaseDate}: ${c.scopedTotal} delivered paths (${summary})`;
const entryLine = `- **[${releaseDate}]**: ${notes}`;

function synthesizeUnreleasedEntry(content: string, line: string): { content: string; inserted: boolean } {
  const lines = content.split('\n');
  const headerIdx = lines.findIndex((l) => /^## \[Unreleased\]\s*$/.test(l));
  if (headerIdx === -1) {
    throw new Error('templates/CHANGELOG.md is missing "## [Unreleased]"');
  }
  if (lines.some((l) => l === line)) return { content, inserted: false }; // idempotent re-run
  let blockEnd = lines.length;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (/^## \[/.test(lines[i])) {
      blockEnd = i;
      break;
    }
  }
  let changedIdx = -1;
  for (let i = headerIdx + 1; i < blockEnd; i++) {
    if (/^### Changed\s*$/.test(lines[i])) {
      changedIdx = i;
      break;
    }
  }
  if (changedIdx !== -1) {
    lines.splice(changedIdx + 1, 0, line); // first bullet of the existing Changed subsection
  } else {
    lines.splice(headerIdx + 1, 0, '', '### Changed', line);
  }
  return { content: lines.join('\n'), inserted: true };
}

const prTitle = `chore(templates): auto-release v${result.nextVersion} (${result.level}, ${c.scopedTotal} delivered paths)`;

console.log(`${CYAN}Releasing ${result.level} v${result.nextVersion} (date ${releaseDate})${RESET}`);

let preRunChangelog: string | null = null;
try {
  // R8: synthesize the [Unreleased] entry so the auto-release provenance lands
  // in the cut section even when [Unreleased] is already non-empty.
  // release-template.ts cutChangelog preserves a non-empty [Unreleased]
  // verbatim and falls back to --notes when empty — both paths covered.
  preRunChangelog = readFileSync(changelogPath, 'utf-8');
  const synthesized = synthesizeUnreleasedEntry(preRunChangelog, entryLine);
  if (synthesized.inserted) writeFileSync(changelogPath, synthesized.content, 'utf-8');

  // Compose the atomic helper. NEVER --push, NEVER touch templates/VERSION
  // here: release-template.ts owns both writes and restores them on failure.
  const bumpArgs = [
    'scripts/release-template.ts',
    '--bump',
    result.level as string,
    '--notes',
    notes,
    '--no-tag',
  ];
  const bump = spawnSync(process.execPath, bumpArgs, { cwd: workspaceRoot, stdio: 'inherit' });
  if (bump.status !== 0) {
    throw new Error(`release-template.ts failed with exit code ${bump.status}`);
  }

  const releasedVersion = readFileSync(versionPath, 'utf-8').trim();
  console.log(`${GREEN}templates/VERSION is now ${releasedVersion}.${RESET}`);
  console.log('');
  console.log(`${CYAN}Next steps (caller: ADR-0089 nightly runner):${RESET}`);
  console.log(`  1. Land the bump via dev-sync PR '${prTitle}'`);
  console.log(`     (touches only templates/VERSION and templates/CHANGELOG.md); merge under ADR-0089 R27.`);
  console.log(`  2. After the merge: bun scripts/tag-template.ts --fail-on-push-error`);
  process.exit(0);
} catch (err) {
  // Restore the pre-run changelog byte-for-byte (release-template.ts restores
  // its own files; our synthesis is ours to roll back) so a failed night
  // leaves the tree exactly as it entered.
  if (preRunChangelog !== null) {
    try {
      writeFileSync(changelogPath, preRunChangelog, 'utf-8');
    } catch {
      // best-effort restore only
    }
  }
  logError(
    fatalError(
      ErrorPhase.SCRIPT_EXECUTION,
      'AUTO_TEMPLATE_RELEASE_FAILED',
      err instanceof Error ? err.message : String(err),
      undefined,
      'File one ticket (bun scripts/ticket.ts create auto-template-release --priority high), continue Phase II (design R15).',
    ),
  );
  process.exit(1);
}
