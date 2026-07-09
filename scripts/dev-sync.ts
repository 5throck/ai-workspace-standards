// @version 1.3.5
import { $ } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolve } from 'node:path';
import { withRetry, DEFAULT_CONFIG } from './retry-handler.ts';
import { hasNonEnglish } from './lib/language-guard.ts';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// Workspace root guard — dev-sync must run from the workspace root it belongs to.
// Using import.meta.dir (script location) prevents CWD mismatches when two clones exist.
const expectedRoot = resolve(import.meta.dir, '..');
const actualCwd = process.cwd();
if (path.resolve(actualCwd) !== expectedRoot) {
    console.error(`${RED}❌ dev-sync: CWD mismatch.${RESET}`);
    console.error(`   Expected: ${expectedRoot}`);
    console.error(`   Current:  ${actualCwd}`);
    console.error(`   Run from the workspace root: cd ${expectedRoot}`);
    if (import.meta.main) {
      process.exit(1);
    }
}

const msg = process.argv.slice(2).join(' ') || "chore: update";

// Language gate — commit messages / PR titles must be English (CONSTITUTION.md §3).
// Runs before any git mutation so a non-English message never reaches a commit or PR
// (previously this was only checked late, inside gen-pr-body.ts, and its failure was
// silently swallowed by the PR-creation fallback below). Shared detector also catches
// Japanese/Chinese, not just Korean — see scripts/lib/language-guard.ts.
if (hasNonEnglish(msg)) {
    console.log(`${RED}❌ Commit message / PR title must be written in English (CONSTITUTION.md §3).${RESET}`);
    console.log(`${YELLOW}   Translate the message and re-run: /sync "<english message>"${RESET}`);
    if (import.meta.main) {
      process.exit(1);
    }
}

const dateObj = new Date();
const date = dateObj.toISOString().split('T')[0]; // yyyy-MM-dd

if (!fs.existsSync('memory')) fs.mkdirSync('memory');

let gitStatus = "";
try {
    const { stdout } = await $`git status --short`.quiet().nothrow();
    gitStatus = stdout.toString().trim();
} catch (err) {
  console.error(`[dev-sync] Error: ${err}`);
}

let fileLines = "- N/A";
if (gitStatus) {
    fileLines = gitStatus.split('\n').filter(Boolean).map(line => {
        const f = line.replace(/^.{2}\s+/, '').trim();
        return `- \`${f}\` — modified`;
    }).join('\n');
}

let separator = "";
const memoryFile = path.join('memory', `${date}.md`);
if (fs.existsSync(memoryFile)) { separator = "\n---\n\n"; }

const template = `${separator}## Session Summary
${msg}

## Changes
${fileLines}

## Decisions
- None

## Open Issues
- None
`;

fs.appendFileSync(memoryFile, template, 'utf8');

// 2. Update MEMORY.md index
try {
    await $`bun run scripts/sync-md.ts ${date} "${msg}"`;
} catch (e) {
    console.log(`${RED}❌ sync-md.ts failed: ${e}${RESET}`);
    if (import.meta.main) {
      process.exit(1);
    }
}

// 2.5 Generate scripts/README.md
const genReadmeTs = path.join('scripts', 'generate-scripts-readme.ts');
if (fs.existsSync(genReadmeTs)) {
    try {
        await $`bun ${genReadmeTs}`;
    } catch (e) {
        console.log(`${RED}❌ generate-scripts-readme.ts failed: ${e}${RESET}`);
        if (import.meta.main) {
          process.exit(1);
        }
    }
}

// 3. Block if [Unreleased] section has no bullet items
if (fs.existsSync('CHANGELOG.md')) {
    const clCheck = fs.readFileSync('CHANGELOG.md', 'utf-8');
    const match = /## \[Unreleased\]([\s\S]*?)(?=\n## |$)/.exec(clCheck);
    if (match) {
        const unreleasedSection = match[1];
        if (!/^\s*-\s+/m.test(unreleasedSection)) {
            console.log("");
            console.log(`${RED}❌ CHANGELOG.md [Unreleased] section has no entries.${RESET}`);
            console.log(`${YELLOW}   Run: /changelog 'type: description' to add an entry before syncing.${RESET}`);
            console.log("");
            if (import.meta.main) {
              process.exit(1);
            }
        }
    }
}

// 3.6 Warn about deprecated scripts
if (fs.existsSync('SCRIPTS.md')) {
    const content = fs.readFileSync('SCRIPTS.md', 'utf-8');
    const lines = content.split('\n');
    let hasDeprecated = false;
    for (const line of lines) {
        if (/^\|.*\|.*deprecated/.test(line)) {
            if (!hasDeprecated) {
                console.log(`${YELLOW}⚠️  Deprecated scripts detected in SCRIPTS.md:${RESET}`);
                hasDeprecated = true;
            }
            const parts = line.split('|');
            if (parts.length >= 3) {
                console.log(`   - ${parts[1].trim()}`);
            }
        }
    }
    if (hasDeprecated) {
        console.log("   Consider removing or updating these scripts.");
        console.log("");
    }
}

// 3.7 L0/L1 script drift check
const hasBun = (await $`bun --version`.quiet().nothrow()).exitCode === 0;
if (hasBun) {
    const verifyScripts = path.join('scripts', 'verify-scripts.ts');
    if (fs.existsSync(verifyScripts)) {
        await $`bun ${verifyScripts} --check-drift`.quiet().nothrow();
    }
}

// 3.8 Archive old memory files
const archiveMemoryTs = path.join('scripts', 'archive-memory.ts');
if (fs.existsSync(archiveMemoryTs)) {
    await $`bun ${archiveMemoryTs}`;
}

// 3.9 Spec registry check (non-blocking — warns if approved specs are stale or code has no spec)
const specRegPath = path.join('docs', 'specs', 'registry.json');
if (fs.existsSync(specRegPath)) {
    await $`bun scripts/audit.ts --spec-check --lifecycle-only`.quiet().nothrow();
}

// 4. Audit gate — call audit.ts directly (platform-independent, no shell intermediary)
const auditRes = await $`bun scripts/audit.ts`.nothrow();

if (auditRes.exitCode !== 0) {
    if (import.meta.main) {
      process.exit(1);
    }
}

// 4.5. Generate VERSION_MANIFEST.md
const genManifestTs = path.join('scripts', 'generate-version-manifest.ts');
if (fs.existsSync(genManifestTs)) {
    const genRes = await $`bun ${genManifestTs}`.quiet().nothrow();
    if (genRes.exitCode !== 0) {
        console.log(`${RED}❌ VERSION_MANIFEST.md generation failed${RESET}`);
        console.log(`${RED}   ${genRes.stderr.toString().trim()}${RESET}`);
        if (import.meta.main) {
          process.exit(1);
        }
    }
    console.log(`${GREEN}✓ VERSION_MANIFEST.md generated${RESET}`);
}

// 4.7 L0→L1 publish (workspace root only)
const isWorkspaceRoot = fs.existsSync('templates/common') && fs.existsSync('scripts/propagation-map.json');
// L0 context: CONSTITUTION.md exists at workspace root — publish failures are fatal here.
const isL0Context = fs.existsSync('CONSTITUTION.md');
if (isWorkspaceRoot) {
    console.log('\n📦 Publishing L0→L1 (scripts, skills, commands)...');
    try {
        const publishRes = await $`bun scripts/propagate-to-templates.ts --apply`.nothrow();
        if (publishRes.exitCode !== 0) {
            if (isL0Context) {
                console.log(`${RED}❌ L0→L1 publish failed — fatal in L0 context (CONSTITUTION.md present)${RESET}`);
                if (import.meta.main) {
                  process.exit(1);
                }
            } else {
                console.log(`${YELLOW}⚠️  L0→L1 publish failed — continuing sync${RESET}`);
            }
        }
    } catch (e) {
        if (isL0Context) {
            console.log(`${RED}❌ L0→L1 publish failed — fatal in L0 context (CONSTITUTION.md present)${RESET}`);
            if (import.meta.main) {
              process.exit(1);
            }
        } else {
            console.log(`${YELLOW}⚠️  L0→L1 publish failed — continuing sync${RESET}`);
        }
    }
}

// 5. Branch -> commit -> push -> PR
let currentBranch = "";
try {
    const { stdout } = await $`git rev-parse --abbrev-ref HEAD`.quiet().nothrow();
    currentBranch = stdout.toString().trim();
} catch (err) {
  console.error(`[dev-sync] Error: ${err}`);
}

let branch = currentBranch;
if (currentBranch === "main" || currentBranch === "master") {
    let slug = msg.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').toLowerCase().replace(/-$/, '');
    slug = slug.substring(0, Math.min(40, slug.length));
    
    // yyyyMMdd-HHmmss
    const pad = (n: number) => n.toString().padStart(2, '0');
    const d = new Date();
    const timestamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    
    branch = `pr/${timestamp}-${slug}`;
    try {
        await $`git checkout -b ${branch}`.nothrow();
    } catch {
        console.log(`${RED}❌ Failed to create branch '${branch}'${RESET}`);
        if (import.meta.main) {
          process.exit(1);
        }
    }
} else {
    console.log(`${CYAN}ℹ️  Already on branch '${branch}' - committing here without creating a new branch.${RESET}`);
}

// 6. Guard against sensitive files — checks both new (untracked) and modified
// (already-tracked) files, since an already-tracked secret-like file that gets
// edited would otherwise slip past a check that only looked at untracked paths.
try {
    const untrackedRes = await $`git ls-files --others --exclude-standard`.quiet().nothrow();
    const modifiedRes = await $`git diff --name-only HEAD`.quiet().nothrow();
    const untracked = untrackedRes.stdout.toString().trim().split('\n').filter(Boolean);
    const modified = modifiedRes.stdout.toString().trim().split('\n').filter(Boolean);
    const candidates = [...new Set([...untracked, ...modified])];
    const sensitivePattern = /\.(pem|key|p12|pfx|jks|keystore)$|^\.env(\.[^sa]|$)|credentials\.json|service.?account\.json|secrets\.ya?ml/;
    const sensitive = candidates.filter(f => sensitivePattern.test(f));

    if (sensitive.length > 0) {
        console.log(`${RED}❌ Potentially sensitive files detected (new or modified) - refusing git add -A:${RESET}`);
        sensitive.forEach(s => console.log(`   ${s}`));
        console.log(`${YELLOW}   Stage files explicitly with 'git add <file>' or add them to .gitignore.${RESET}`);
        if (import.meta.main) {
          process.exit(1);
        }
    }
} catch (err) {
  console.error(`[dev-sync] Error: ${err}`);
}

try {
    const addRes = await $`git add -A`.nothrow();
    if (addRes.exitCode !== 0) throw new Error(addRes.stderr.toString());
} catch (e) {
    console.log(`${RED}❌ git add failed: ${e}${RESET}`);
    if (import.meta.main) {
      process.exit(1);
    }
}

const syncContext = crypto.randomUUID();
process.env.SYNC_ACTIVE = "1";
process.env.DEV_SYNC_CONTEXT = syncContext;
// Write to git repo root — hooks run from there, not from CWD
const repoRootResult = await $`git rev-parse --show-toplevel`.quiet().nothrow();
const repoRoot = repoRootResult?.stdout?.toString().trim() || '';

// Sweep stale sync-context files left behind by a killed/crashed run. Each run's
// filename is unique (embeds its own UUID), so — unlike the old fixed-name scheme,
// where the next run's write silently overwrote a stale leftover — an interrupted
// run's file is never reclaimed on its own and would otherwise accumulate forever.
const STALE_MS = 60 * 60 * 1000; // 1 hour — generous margin over any real sync run
try {
    const sweepDir = repoRoot || '.';
    for (const entry of fs.readdirSync(sweepDir)) {
        if (!/^\.sync_context\..+\.tmp$/.test(entry)) continue;
        const entryPath = path.join(sweepDir, entry);
        try {
            if (Date.now() - fs.statSync(entryPath).mtimeMs > STALE_MS) {
                fs.unlinkSync(entryPath);
            }
        } catch { /* another process may have already removed it — ignore */ }
    }
} catch (err) {
  console.error(`[dev-sync] Error: ${err}`);
}

// Filename is unique per run (embeds the context UUID) — a shared fixed name
// would race when two /sync runs overlap in the same repo (e.g. concurrent
// Agent Teams teammates), letting one run's commit validate against another's token.
const tmpFileName = `.sync_context.${syncContext}.tmp`;
process.env.DEV_SYNC_CONTEXT_FILE = tmpFileName;
const tmpPath = repoRoot ? path.join(repoRoot, tmpFileName) : tmpFileName;
fs.writeFileSync(tmpPath, syncContext);

const cleanupTmp = () => { try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (err) {
  console.error(`[dev-sync] Error: ${err}`);
} };
process.on('exit', cleanupTmp);

try {
    const commitRes = await $`git commit -m ${msg}`.nothrow();
    cleanupTmp();
    if (commitRes.exitCode !== 0) throw new Error(commitRes.stderr.toString());
} catch (e) {
    cleanupTmp();
    console.log(`${RED}❌ git commit failed: ${e}${RESET}`);
    if (import.meta.main) {
      process.exit(1);
    }
}

const pushRetry = await withRetry(
    () => $`git push -u origin ${branch}`.nothrow(),
    { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: any) => r.exitCode === 0 },
    'git push'
);
const pushProc = pushRetry.result as { exitCode: number; stderr: { toString(): string } } | undefined;
if (!pushRetry.success) {
    const errMsg = pushProc?.stderr.toString().trim() || pushRetry.lastError?.message || 'unknown error';
    console.log(`${RED}❌ git push failed: ${errMsg}${RESET}`);
    if (import.meta.main) {
      process.exit(1);
    }
}

// 7. Generate PR body and open PR — but skip creation if a PR already exists for
// this branch (e.g. re-running /sync to push a follow-up commit onto an open PR).
// The push above already updated it; calling `gh pr create` again would just fail
// with "a pull request ... already exists", masking the fact that the commit/push
// actually succeeded.
const existingPrRes = await $`gh pr view ${branch} --json url --jq .url`.quiet().nothrow();
const existingPrUrl = existingPrRes.exitCode === 0 ? existingPrRes.stdout.toString().trim() : '';

if (existingPrUrl) {
    console.log(`${GREEN}✓ PR already exists for '${branch}' — commit pushed, no new PR needed:${RESET}`);
    console.log(`  ${existingPrUrl}`);
} else {
    // Note: msg already passed the language gate above, so a non-zero exit here means
    // gen-pr-body.ts hit a non-language failure (e.g. AI-generated body came back
    // non-English) — safe to fall back to the template/--fill paths below, but surface
    // the reason instead of silently swallowing it.
    let prBody = "";
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

    let prCreateRetry: Awaited<ReturnType<typeof withRetry>>;
    if (prBody) {
        prCreateRetry = await withRetry(
            () => $`gh pr create --title ${msg} --body ${prBody}`.nothrow(),
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: any) => r.exitCode === 0 },
            'gh pr create'
        );
    } else if (fs.existsSync(path.join('.github', 'pull_request_template.md'))) {
        const prTpl = fs.readFileSync(path.join('.github', 'pull_request_template.md'), 'utf-8');
        prCreateRetry = await withRetry(
            () => $`gh pr create --title ${msg} --body ${prTpl}`.nothrow(),
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: any) => r.exitCode === 0 },
            'gh pr create'
        );
    } else {
        prCreateRetry = await withRetry(
            () => $`gh pr create --fill`.nothrow(),
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: any) => r.exitCode === 0 },
            'gh pr create'
        );
    }

    if (!prCreateRetry.success) {
        const errMsg = prCreateRetry.lastError?.message || 'unknown error';
        console.log(`${RED}❌ gh pr create failed: ${errMsg}${RESET}`);
        if (import.meta.main) {
          process.exit(1);
        }
    }
}
