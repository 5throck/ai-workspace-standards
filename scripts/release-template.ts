#!/usr/bin/env bun
// @version 1.0.0
// release-template.ts - Atomically bump templates/VERSION, cut templates/CHANGELOG.md, and run tag-template.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const workspaceRoot = path.resolve(import.meta.dir, '..');
const versionPath = path.join(workspaceRoot, 'templates', 'VERSION');
const changelogPath = path.join(workspaceRoot, 'templates', 'CHANGELOG.md');

function usage(exitCode = 1): never {
  console.log(`Usage: bun scripts/release-template.ts (--version X.Y.Z | --bump patch|minor|major) [--date YYYY-MM-DD] [--notes "text"] [--dry-run] [--no-tag] [--push]`);
  process.exit(exitCode);
}

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

const dryRun = process.argv.includes('--dry-run');
const noTag = process.argv.includes('--no-tag');
const push = process.argv.includes('--push');
const requestedVersion = argValue('--version');
const bump = argValue('--bump');
const releaseDate = argValue('--date') ?? new Date().toISOString().slice(0, 10);
const notes = argValue('--notes');

if (process.argv.includes('--help') || process.argv.includes('-h')) usage(0);
if (!existsSync(versionPath)) throw new Error(`Missing ${path.relative(workspaceRoot, versionPath)}`);
if (!existsSync(changelogPath)) throw new Error(`Missing ${path.relative(workspaceRoot, changelogPath)}`);
if ((requestedVersion ? 1 : 0) + (bump ? 1 : 0) !== 1) usage();
if (bump && !['patch', 'minor', 'major'].includes(bump)) usage();
if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) throw new Error(`Invalid --date: ${releaseDate}`);

function parseSemver(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSemver(a: string, b: string): number {
  const av = parseSemver(a);
  const bv = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (av[i] !== bv[i]) return av[i] - bv[i];
  }
  return 0;
}

function bumpedVersion(current: string, kind: string): string {
  const [major, minor, patch] = parseSemver(current);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function isEmptyUnreleased(block: string): boolean {
  return block
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !/^###\s+/.test(line))
    .length === 0;
}

function cutChangelog(content: string, version: string): string {
  const header = /^## \[Unreleased\]\s*$/m.exec(content);
  if (!header) throw new Error('templates/CHANGELOG.md is missing "## [Unreleased]"');

  const afterHeader = header.index + header[0].length;
  const rest = content.slice(afterHeader);
  const nextHeading = /\n## \[/.exec(rest);
  const blockEnd = nextHeading ? afterHeader + nextHeading.index : content.length;
  const unreleasedBlock = content.slice(afterHeader, blockEnd).trim();

  const releasedBody = unreleasedBlock && !isEmptyUnreleased(unreleasedBlock)
    ? unreleasedBlock
    : `### Changed\n- **[${releaseDate}]**: Template release ${version}.${notes ? ` ${notes}` : ''}`;

  const replacement = `## [Unreleased]\n\n## [${version}] - ${releaseDate}\n${releasedBody}\n`;
  return content.slice(0, header.index) + replacement + content.slice(blockEnd).replace(/^\n?/, '\n');
}

const currentVersion = readFileSync(versionPath, 'utf-8').trim();
const nextVersion = requestedVersion ?? bumpedVersion(currentVersion, bump!);
parseSemver(nextVersion);
if (compareSemver(nextVersion, currentVersion) <= 0) {
  throw new Error(`Next version ${nextVersion} must be greater than current templates/VERSION ${currentVersion}`);
}

const oldVersionText = readFileSync(versionPath, 'utf-8');
const oldChangelogText = readFileSync(changelogPath, 'utf-8');
const newVersionText = `${nextVersion}\n`;
const newChangelogText = cutChangelog(oldChangelogText, nextVersion);

console.log(`${CYAN}Template release${RESET}`);
console.log(`  Current : ${currentVersion}`);
console.log(`  Next    : ${nextVersion}`);
console.log(`  Date    : ${releaseDate}`);
console.log(`  Tag     : ${noTag ? '(skipped)' : `template-v${nextVersion}${push ? ' (push)' : ' (local only)'}`}`);

if (dryRun) {
  console.log(`${YELLOW}Dry run — no files changed and no tag created.${RESET}`);
  process.exit(0);
}

let wroteFiles = false;
try {
  writeFileSync(versionPath, newVersionText, 'utf-8');
  writeFileSync(changelogPath, newChangelogText, 'utf-8');
  wroteFiles = true;

  if (!noTag) {
    const tagArgs = ['scripts/tag-template.ts'];
    if (!push) tagArgs.push('--no-push');
    if (push) tagArgs.push('--fail-on-push-error');
    const result = spawnSync(process.execPath, tagArgs, { cwd: workspaceRoot, stdio: 'inherit' });
    if (result.status !== 0) {
      throw new Error(`tag-template failed with exit code ${result.status}`);
    }
  }

  console.log(`${GREEN}✅ Template release ${nextVersion} prepared.${RESET}`);
} catch (err) {
  if (wroteFiles) {
    writeFileSync(versionPath, oldVersionText, 'utf-8');
    writeFileSync(changelogPath, oldChangelogText, 'utf-8');
    spawnSync('git', ['-C', workspaceRoot, 'tag', '-d', `template-v${nextVersion}`], { stdio: 'ignore' });
  }
  console.error(`${RED}✗ Release failed; VERSION/CHANGELOG restored.${RESET}`);
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}