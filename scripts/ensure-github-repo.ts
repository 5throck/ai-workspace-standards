#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-09-23, pre-adoption GitHub repo readiness — spec
//          2026-09-23-pre-adoption-github-repo-design): ensures an external project has a
//          GitHub-backed baseline BEFORE adopt-project migration runs. Performs the work
//          AND verifies it — exit 0 means "GitHub baseline is in place and carries the
//          local history", not merely "instructions were printed":
//            1. readiness checks (git repo, ≥1 commit, clean tree, gh auth)
//            2. GitHub remote detection (any remote pointing at github.com)
//            3. when absent: gh repo create (private by default) + origin + push
//            4. verification (mandatory on every path): gh repo view confirms existence
//               and visibility; git ls-remote confirms the local HEAD sha is on the
//               remote branch
//            5. prints the recommended adopt-project next step
//
// Usage:
//   bun scripts/ensure-github-repo.ts <project-path> [--org <org>] [--public] [--remote <name>] [--dry-run]

import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function fail(msg: string): never {
  console.error(`${RED}${msg}${RESET}`);
  process.exit(1);
}

function git(cwd: string, ...args: string[]): { status: number; out: string } {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return { status: r.status ?? 1, out: (r.stdout || '').trim() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pure helpers (exported for unit tests — no subprocesses, no filesystem writes)
// ═══════════════════════════════════════════════════════════════════════════════

export interface GitRemote { name: string; url: string }

/** Parse `git remote -v` output (fetch lines only). */
export function parseGitRemotes(output: string): GitRemote[] {
  const remotes = new Map<string, string>();
  for (const line of output.split('\n')) {
    const m = line.match(/^(\S+)\t(\S+) \(fetch\)$/);
    if (m) remotes.set(m[1], m[2]);
  }
  return [...remotes].map(([name, url]) => ({ name, url }));
}

/** Extract `owner/repo` from a github.com remote URL (https, ssh, or git protocol). */
export function parseOwnerRepo(url: string): string | null {
  const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** The GitHub remote, if any. */
export function findGithubRemote(remotes: GitRemote[]): GitRemote | null {
  return remotes.find(r => /github\.com[/:]/.test(r.url)) ?? null;
}

/** Slugify a directory name into a legal GitHub repo name. */
export function slugifyRepoName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

/** Build the `gh repo create` argv (without the leading `gh`). */
export function buildCreateArgs(opts: { name: string; org?: string; visibility: 'private' | 'public'; source: string; remote: string; push: boolean }): string[] {
  const target = opts.org ? `${opts.org}/${opts.name}` : opts.name;
  return [
    'repo', 'create', target,
    `--${opts.visibility}`,
    '--source', opts.source,
    '--remote', opts.remote,
    ...(opts.push ? ['--push'] : []),
  ];
}

/**
 * Does `git ls-remote` output contain the given HEAD sha on the branch ref?
 * Accepts either the exact branch or — when the branch is unknown — any ref
 * pointing at the sha (covers remote default-branch renames).
 */
export function headOnRemote(lsRemoteOutput: string, sha: string, branch?: string): boolean {
  if (!sha) return false;
  const refs = lsRemoteOutput.split('\n').map(l => l.match(/^(\S{40})\trefs\/heads\/(.+)$/)).filter(Boolean) as Array<[string, string, string]>;
  if (branch) return refs.some(([, s, b]) => s === sha && b === branch);
  return refs.some(([, s]) => s === sha);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════════

function main(): void {
const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  for (let i = args.length - 2; i >= 0; i--) {
    if (args[i] === flag) return args[i + 1];
  }
  return undefined;
}
const DRY_RUN = args.includes('--dry-run');
const PUBLIC = args.includes('--public');
const remoteName = getArg('--remote') ?? 'origin';
const org = getArg('--org');
const projectArg = args.find((a, i) => !a.startsWith('--') && (i === 0 || !['--org', '--remote'].includes(args[i - 1])));

if (!projectArg) {
  console.error('Usage: bun scripts/ensure-github-repo.ts <project-path> [--org <org>] [--public] [--remote <name>] [--dry-run]');
  process.exit(1);
}
const projectDir = resolve(projectArg);

console.log(`\n${CYAN}=== ensure-github-repo: pre-adoption GitHub baseline ===${RESET}`);
console.log(`Project: ${projectDir}`);

// ── 1. Readiness checks (these are adoption prerequisites too) ────────────────
if (!existsSync(projectDir)) fail(`Project directory not found: ${projectDir}`);
if (git(projectDir, 'rev-parse', '--git-dir').status !== 0) {
  fail('Not a git repository. Initialize and commit first:\n'
    + `  ${YELLOW}cd ${projectDir} && git init && git add -A && git commit -m "initial"${RESET}\n`
    + '       adopt-project requires a committed git baseline.');
}
const headSha = git(projectDir, 'rev-parse', 'HEAD');
if (headSha.status !== 0) {
  fail('Repository has no commits. adopt-project requires a committed baseline:\n'
    + `  ${YELLOW}cd ${projectDir} && git add -A && git commit -m "initial"${RESET}`);
}
const head = headSha.out;
const branch = git(projectDir, 'rev-parse', '--abbrev-ref', 'HEAD').out || 'main';
const porcelain = git(projectDir, 'status', '--porcelain').out;
if (porcelain) {
  console.log(`${YELLOW}⚠️  Working tree has uncommitted changes — they will NOT be pushed (adoption will also refuse them).${RESET}`);
  console.log(`  ${YELLOW}git -C ${projectDir} status --porcelain${RESET}`);
}
console.log(`${GREEN}✅ git baseline${RESET} (HEAD ${head.slice(0, 10)} on ${branch})${porcelain ? ' — uncommitted changes present' : ''}`);

// ── 2. gh availability + auth ──────────────────────────────────────────────────
const ghVersion = spawnSync('gh', ['--version'], { encoding: 'utf8' });
if (ghVersion.status !== 0) {
  fail('gh CLI not found. Install it, then authenticate:\n'
    + `  ${YELLOW}brew install gh && gh auth login${RESET}`);
}
const ghAuth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
if (ghAuth.status !== 0) {
  fail('gh is not authenticated. Run:\n'
    + `  ${YELLOW}gh auth login${RESET}`);
}
console.log(`${GREEN}✅ gh authenticated${RESET}`);

// ── 3. GitHub remote detection ─────────────────────────────────────────────────
const remotes = parseGitRemotes(git(projectDir, 'remote', '-v').out);
const githubRemote = findGithubRemote(remotes);
let ownerRepo: string | null = null;
let created = false;

if (githubRemote) {
  ownerRepo = parseOwnerRepo(githubRemote.url);
  console.log(`${GREEN}✅ GitHub remote found:${RESET} ${githubRemote.name} → ${ownerRepo ?? githubRemote.url}`);
} else if (remotes.length > 0) {
  console.log(`${YELLOW}⚠️  Remotes exist but none point at github.com — a GitHub baseline will be added as '${remoteName}'.${RESET}`);
}

// ── 4. Create + push when absent ───────────────────────────────────────────────
if (!githubRemote) {
  const repoName = slugifyRepoName(basename(projectDir));
  const visibility = PUBLIC ? 'public' : 'private';
  const createArgs = buildCreateArgs({ name: repoName, org, visibility, source: projectDir, remote: remoteName, push: true });
  console.log(`\nNo GitHub remote — creating ${visibility} repo ${org ? `${org}/` : ''}${repoName} and pushing ${branch}…`);
  if (DRY_RUN) {
    console.log(`  ${YELLOW}[DRY] gh ${createArgs.join(' ')}${RESET}`);
    console.log(`  ${YELLOW}[DRY] verification: gh repo view + git ls-remote (skipped in dry-run)${RESET}`);
    console.log(`\n${CYAN}Dry-run complete — nothing was created or pushed.${RESET}`);
    process.exit(0);
  }
  const createdProc = spawnSync('gh', createArgs, { encoding: 'utf8' });
  if (createdProc.status !== 0) {
    fail(`gh repo create failed:\n${createdProc.stderr || createdProc.stdout}`);
  }
  // Read the owner/repo back from the remote gh just added — more robust than
  // parsing gh auth output (org repos, renamed accounts, enterprise hosts).
  const remotesAfter = parseGitRemotes(git(projectDir, 'remote', '-v').out);
  ownerRepo = parseOwnerRepo(findGithubRemote(remotesAfter)?.url ?? '') ?? `${org ? `${org}/` : ''}${repoName}`;
  created = true;
  console.log(`${GREEN}✅ Repo created and pushed.${RESET}`);
}

// ── 5. VERIFICATION (mandatory on every path) ──────────────────────────────────
console.log(`\n${CYAN}--- Verification ---${RESET}`);
if (!ownerRepo) fail('Internal: no owner/repo resolved for verification.');
const view = spawnSync('gh', ['repo', 'view', ownerRepo, '--json', 'nameWithOwner,visibility,defaultBranchRef'], { encoding: 'utf8' });
if (view.status !== 0) {
  fail(`Verification FAILED: cannot view ${ownerRepo} (${(view.stderr || '').trim()}).\n`
    + '       The remote may point at a deleted or inaccessible repository — fix the remote or recreate the repo.');
}
let repoVisibility = 'unknown';
try { repoVisibility = (JSON.parse(view.stdout).visibility as string) ?? 'unknown'; } catch { /* non-fatal */ }

const ls = git(projectDir, 'ls-remote', remoteName || 'origin');
if (ls.status !== 0) fail(`Verification FAILED: cannot reach the remote ('git ls-remote' exit ${ls.status}).`);
const shaPresent = headOnRemote(ls.out, head, branch);
if (!shaPresent) {
  fail(`Verification FAILED: local HEAD ${head.slice(0, 10)} is NOT on the remote.\n`
    + `       Push manually:  ${YELLOW}git -C ${projectDir} push -u ${remoteName} ${branch}${RESET}`);
}
console.log(`${GREEN}✅ ${ownerRepo}${RESET} (${repoVisibility}) — remote branch carries local HEAD ${head.slice(0, 10)}`);

// ── 6. Next step ───────────────────────────────────────────────────────────────
console.log(`\n${GREEN}GitHub baseline is in place. Recommended next step — start the migration:${RESET}`);
console.log(`  ${CYAN}bun scripts/adopt-project.ts ${projectDir} --variant co-<x> --dry-run${RESET}   # preview`);
console.log(`  ${CYAN}bun scripts/adopt-project.ts ${projectDir} --variant co-<x>${RESET}             # adopt`);
console.log(`  Variant help: bun scripts/adopt-project.ts --help  (or pick from the menu by omitting --variant)`);
}

if (import.meta.main) main();
