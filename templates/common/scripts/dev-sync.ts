// @version 1.8.0
// v1.7.8: feat(skill-graph): step 4.65 scope loop (ADR-0060 Amendment 2) — after the L0
//           unified graph gate, generate+verify every template scope (templates/common +
//           templates/co-*) so each variant template ships its own docs/skill-graph.json;
//           workspace-root-gated on templates/common so scaffolded projects never enter
//           the loop (their own local graph comes from the existing guarded calls).
//           Corrected the stale "generator is L0-only" comment.
// v1.7.7: fix(pipeline): step 3.95 QA pre-check ran bare `bun test` instead of `bun run test`
//           (the package.json script) — bare `bun test` recursively scans the whole CWD tree,
//           pulling in every nested Projects/*/ repo's test suite (Playwright visual regression,
//           MCP integration tests, etc.), turning a non-fatal check into a multi-minute noisy
//           detour. `bun run test` correctly delegates to the scoped `test-runner.ts integration`.
// v1.7.6: fix(pipeline): add step 4.62 cascade re-publish — heals template platform skill
//           copies after sync-skills step 4.6 updates root platform dirs (mirrors 4.5 gating)
// v1.7.3: feat(pipeline): add step 4.65 skill graph gate (ADR-0060) — generates and
//           verifies skill relationship graph before VERSION_MANIFEST generation
// v1.7.2: fix(pipeline): forward --spec-exempt via SYNC_SPEC_EXEMPT env instead of shell
//           interpolation — the interpolated " --spec-exempt=X" (leading space) reached
//           audit as a single argv word and defeated its startsWith parse, making the
//           ADR-0055 escape hatch inert on every /sync run (ported from co-abap 1.7.2)
// v1.7.1: fix(types): coerce Bun Shell stderr to string before .trim() (2 sites) and
//           widen the five withRetry isSuccess lambdas to the (result: unknown) contract
//           — typing-only, no behavior change (ported from co-abap docs/upstream-fix-list.md)
// v1.5.4: fix(pr-check): "PR already exists for branch" step now checks PR state —
//           previously `gh pr view <branch>` matched ANY PR regardless of state, so
//           reusing a branch name whose earlier PR was already MERGED/CLOSED caused
//           new commits to be pushed with zero PR coverage (silently reported as
//           "no new PR needed").
import { $ } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { withRetry, DEFAULT_CONFIG } from './retry-handler.ts';
import { hasNonEnglish } from './lib/language-guard.ts';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// Workspace root guard — dev-sync must run from the workspace root it belongs to.
// Using import.meta.dir (script location) prevents CWD mismatches when two clones exist.
const expectedRoot = path.resolve(import.meta.dir, '..');
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

// ── Argument parsing ──────────────────────────────────────────────────────────
// --body-file <path> (or --body-file=<path>) is consumed here and removed from
// the commit-message args. The agent invoking /sync writes the PR body itself to
// that file (see skills/sync/SKILL.md); when absent, the PR-creation fallback
// chain below still applies.
const rawArgs = process.argv.slice(2);
let bodyFilePath = '';
let specExempt = '';
const msgArgs: string[] = [];
for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === '--body-file') {
    bodyFilePath = rawArgs[++i] ?? '';
  } else if (arg.startsWith('--body-file=')) {
    bodyFilePath = arg.slice('--body-file='.length);
  } else if (arg.startsWith('--spec-exempt=')) {
    specExempt = arg.slice('--spec-exempt='.length);
  } else {
    msgArgs.push(arg);
  }
}
const msg = (msgArgs.join(' ') || "chore: update")
  // Collapse newlines/control chars — safe for git -m and gh --title arguments
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || "chore: update";

// Language gate — commit messages / PR titles must be English (context.md §3).
// Runs before any git mutation so a non-English message never reaches a commit or PR
// (previously this was only checked late, inside gen-pr-body.ts, and its failure was
// silently swallowed by the PR-creation fallback below). Shared detector also catches
// Japanese/Chinese, not just Korean — see scripts/lib/language-guard.ts.
if (hasNonEnglish(msg)) {
    console.log(`${RED}❌ Commit message / PR title must be written in English (context.md §3).${RESET}`);
    console.log(`${YELLOW}   Translate the message and re-run: /sync "<english message>"${RESET}`);
    if (import.meta.main) {
      process.exit(1);
    }
}

// Pre-flight Link Validation Gate — ensures markdown documentation links resolve.
try {
  const { exitCode } = await $`bun scripts/validate-docs-links.ts`.nothrow();
  if (exitCode !== 0) {
    console.error(`${RED}❌ Documentation link validation failed.${RESET}`);
    console.error(`${YELLOW}   Fix broken markdown links before syncing.${RESET}`);
    if (import.meta.main) {
      process.exit(1);
    }
  }
} catch (err) {
  console.error(`[dev-sync] Link validation check warning: ${err}`);
}

// Use local calendar date, not toISOString() (which is UTC) — on hosts west of
// UTC, a run in the evening local time would otherwise land on the *next* UTC
// day, and a run just after local midnight could still resolve to the
// *previous* UTC day, misfiling (or duplicating) the memlog entry.
const dateObj = new Date();
const date = [
  dateObj.getFullYear(),
  String(dateObj.getMonth() + 1).padStart(2, '0'),
  String(dateObj.getDate()).padStart(2, '0'),
].join('-'); // yyyy-MM-dd (local)

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

// Idempotency check: skip append if a Session Summary with the same
// commit message already exists for today (prevents duplicates when
// /sync is re-run on the same day).
let alreadyLogged = false;
if (fs.existsSync(memoryFile)) {
    const existing = fs.readFileSync(memoryFile, 'utf-8');
    // Match a Session Summary header followed by the same message
    const duplicatePattern = new RegExp(
        `^## Session Summary\\s*\\n${msg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'm'
    );
    alreadyLogged = duplicatePattern.test(existing);
}

if (alreadyLogged) {
    console.log(`${YELLOW}⚙ Session summary already logged for today — skipping append (idempotent).${RESET}`);
} else {
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
}

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
if (fs.existsSync(path.join('scripts', 'SCRIPTS.md'))) {
    const content = fs.readFileSync(path.join('scripts', 'SCRIPTS.md'), 'utf-8');
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
    const archiveRes = await $`bun ${archiveMemoryTs}`.nothrow();
    if (archiveRes.exitCode !== 0) {
        console.warn(`⚠️  Memory archival had issues (non-blocking, exit ${archiveRes.exitCode})`);
    }
}

// 3.9 Spec registry check (BLOCKING since ADR-0055 Stage 2 — the relevance check
// Fails when a code diff has no spec activity; stale/missing-spec stay WARN).
// Output is intentionally visible (no .quiet()); same idiom as step 3.97.
const specRegPath = path.join('docs', 'specs', 'registry.json');
if (fs.existsSync(specRegPath)) {
    // Pass the exemption via SYNC_SPEC_EXEMPT (documented env fallback in audit.ts):
    // interpolating ` --spec-exempt=X` into the Bun $ shell keeps the leading space in
    // a single argv word, which defeats audit's startsWith('--spec-exempt=') parse.
    const specEnv = specExempt ? { SYNC_SPEC_EXEMPT: specExempt } : {};
    const specRes = await $`bun scripts/audit.ts --spec-check --lifecycle-only`
        .env({ ...process.env, ...specEnv })
        .nothrow();
    if (specRes.exitCode !== 0) {
        console.error(`${RED}✗ Step 3.9: spec-check FAILED (exit ${specRes.exitCode})${RESET}`);
        console.error('  The diff touches code (scripts/templates/agents) with no relevant spec activity.');
        console.error('  Fix: update docs/specs/ (or docs/designs/) alongside the change, or legitimize the');
        console.error('  sync with --spec-exempt=E1..E5 (AGENTS.md §5.1.1 categories; e.g. --spec-exempt=E3 for a typo hotfix).');
        if (import.meta.main) process.exit(1);
    } else {
        console.log(`${GREEN}✓ Spec registry check passed${RESET}`);
    }
} else {
    console.log('📋 Step 3.9: skipped — no docs/specs/registry.json');
}

// 3.95 QA Pre-checks (non-fatal — unique checks from qa-gate.ts)
console.log('📋 Step 3.95: QA pre-checks...');
// Check 1: Project tests
if (fs.existsSync('package.json')) {
    try {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        if (pkg.scripts?.test) {
            // Bare `bun test` (no path) recursively scans the entire CWD tree for *.test.ts,
            // which includes every nested Projects/*/ repo (separate git repos scaffolded
            // from templates/ — see README.md § Repository Structure). That pulled in
            // unrelated suites (Playwright visual-regression, MCP integration, etc.) from
            // other projects, making this non-fatal check take many minutes and print noise
            // irrelevant to this repo. `bun run test` invokes the actual package.json script
            // (`bun scripts/test-runner.ts integration`), which is already correctly scoped
            // to this repo's own tests/ directory.
            const testResult = await $`bun run test`.nothrow();
            if (testResult.exitCode !== 0) {
                console.warn(`⚠️  Project tests failed (non-blocking, exit ${testResult.exitCode})`);
                if (testResult.stderr) console.warn(String(testResult.stderr).trim());
            }
        }
    } catch { /* ignore parse errors */ }
}
// Check 2: README_ko pair
if (fs.existsSync('README.md') && !fs.existsSync('README_ko.md')) {
    console.warn('⚠️  README_ko.md missing (non-blocking)');
}

// 3.96 Skill & decision-chain validators (fail-closed gates, ADR-0055/0061; reledgev
//      pipeline-coverage review 2026-08-29). Both are L0-scoped — scaffolded projects
//      skip via existsSync guards. Previously standalone-only (manual invocation),
//      which let relation/decision drift land unnoticed between syncs.
if (fs.existsSync('scripts/validate-skills.ts')) {
    console.log('📋 Step 3.96a: Skill lifecycle & relation validation...');
    const skillsRes = await $`bun scripts/validate-skills.ts`.nothrow();
    if (skillsRes.exitCode !== 0) {
        console.error(`${RED}❌ Step 3.96a: validate-skills.ts FAILED (exit ${skillsRes.exitCode})${RESET}`);
        console.error(`${YELLOW}   Fix: review relation metadata errors (form homogeneity, type vocabulary, target existence) in skills/ and templates/*/skills/, then re-run /sync.${RESET}`);
        if (import.meta.main) process.exit(1);
    } else {
        console.log(`${GREEN}✓ Skill lifecycle & relation validation passed${RESET}`);
    }
}
if (fs.existsSync('docs/decisions') && fs.existsSync('scripts/validate-decisions.ts')) {
    console.log('📋 Step 3.96b: Decision record chain validation...');
    const decRes = await $`bun scripts/validate-decisions.ts`.nothrow();
    if (decRes.exitCode !== 0) {
        console.error(`${RED}❌ Step 3.96b: validate-decisions.ts FAILED (exit ${decRes.exitCode})${RESET}`);
        console.error(`${YELLOW}   Fix: repair DEC frontmatter/chain links (evidence_refs ⊆ ledger, knowledge_refs existence) per ADR-0061, then re-run /sync.${RESET}`);
        if (import.meta.main) process.exit(1);
    } else {
        console.log(`${GREEN}✓ Decision record chain validation passed${RESET}`);
    }
}

// 3.97 ADR governance linkage gate (blocking — Stage 2 of ADR-0059).
//     The validator is L0-only (no docs/adr corpus exists in generated projects),
//     so this step is guarded by existsSync — scaffolded projects skip it.
if (fs.existsSync('scripts/verify-adr-governance.ts')) {
    console.log('📋 Step 3.97: ADR governance linkage check...');
    const govRes = await $`bun scripts/verify-adr-governance.ts --strict`.nothrow();
    if (govRes.exitCode !== 0) {
        console.error(`${RED}❌ ADR governance linkage check failed.${RESET}`);
        console.error(`${YELLOW}   One or more post-cutoff Accepted ADRs lack governance-doc references, or marker-drift findings exist.${RESET}`);
        console.error(`${YELLOW}   For linkage: Add ADR-00NN pointers to context.md, docs/constitution/, or docs/governance/ per docs/adr/0059 and re-run /sync.${RESET}`);
        console.error(`${YELLOW}   For marker-drift: Review the duplicated section, update it if stale, then re-seed with: bun scripts/verify-adr-governance.ts --update-marker-hashes${RESET}`);
        if (import.meta.main) {
            process.exit(1);
        }
    } else {
        console.log(`${GREEN}✓ ADR governance linkage check passed${RESET}`);
    }
} else {
    console.log('📋 Step 3.97: skipped — ADR governance validator is L0-only (not present in scaffolded projects)');
}

// 4.5 L0→L1 publish — must run BEFORE audit gate so that CONSTITUTION scrub
//     is applied to templates/common/ files before the L0-leakage check.
const isWorkspaceRoot = fs.existsSync('templates/common') && fs.existsSync('scripts/propagation-map.json');
// L0 context: context.md exists at workspace root — publish failures are fatal here.
const isL0Context = fs.existsSync('context.md');
if (isWorkspaceRoot) {
    console.log('\n📦 Publishing L0→L1 (scripts, skills, commands)...');
    try {
        const publishRes = await $`bun scripts/propagate-to-templates.ts --apply`.nothrow();
        if (publishRes.exitCode !== 0) {
            if (isL0Context) {
                console.log(`${RED}❌ L0→L1 publish failed — fatal in L0 context (context.md present)${RESET}`);
                if (import.meta.main) {
                  process.exit(1);
                }
            } else {
                console.log(`${YELLOW}⚠️  L0→L1 publish failed — continuing sync${RESET}`);
            }
        }
    } catch (e) {
        if (isL0Context) {
            console.log(`${RED}❌ L0→L1 publish failed — fatal in L0 context (context.md present)${RESET}`);
            if (import.meta.main) {
              process.exit(1);
            }
        } else {
            console.log(`${YELLOW}⚠️  L0→L1 publish failed — continuing sync${RESET}`);
        }
    }
}

// ── Step 4.52: Dependency version sync (root → templates/common) ──
//     Aligns shared dependency versions from root package.json to
//     templates/common/package.json and regenerates bun.lock.
//     Runs after 4.5 (propagate never touches package.json) and before
//     audit 4.9 so the dependency-mirror audit check passes on the
//     self-healed state. Files written here are swept into the same
//     commit by git add -A.
if (isWorkspaceRoot) {
    console.log('\n📦 Syncing dependency versions (root → templates/common)...');
    try {
        const depSyncRes = await $`bun scripts/sync-template-deps.ts --apply`.nothrow();
        if (depSyncRes.exitCode !== 0) {
            console.error(`${RED}❌ Dependency sync failed.${RESET}`);
            if (depSyncRes.stderr) {
                console.error(String(depSyncRes.stderr).trim());
            }
            if (import.meta.main) {
                process.exit(1);
            }
        } else {
            console.log(`${GREEN}✓ Dependency sync completed${RESET}`);
        }
    } catch (e) {
        console.error(`${RED}❌ Dependency sync failed: ${e}${RESET}`);
        if (import.meta.main) {
            process.exit(1);
        }
    }
}

// ── Step 4.55: COMMON-CONTEXT marker-rewrite drift check (WARN stage, L0-only) ──
// Per ADR-0062 + the ADR-0055 WARN-first playbook: the pilot propagation domains
// (constitution-context, variant-context) are checked for zone drift at sync time.
// Dry-run only — drift is reported as a WARN (non-fatal); the operator runs
// `bun scripts/propagate-to-templates.ts --marker-rewrite --domain <name> --apply`
// manually to refresh zones. Promotion to a hard gate waits for pilot soak.
// Wired 2026-08-25 after the 4-variant pilot held 0 would-overwrite across ~10 PRs
// (design doc: docs/designs/2026-08-24-marker-propagation-engine-design.md).
if (isWorkspaceRoot && isL0Context) {
    console.log('\n🔍 COMMON-CONTEXT marker-rewrite drift check (WARN stage)...');
    for (const domain of ['constitution-context', 'variant-context']) {
        try {
            const res = await $`bun scripts/propagate-to-templates.ts --marker-rewrite --domain ${domain}`.nothrow();
            const out = res.stdout.toString();
            const m = out.match(/Would overwrite: (\d+)/);
            const wouldOverwrite = m ? parseInt(m[1], 10) : null;
            if (res.exitCode !== 0) {
                console.log(`${YELLOW}⚠️  marker-rewrite check failed for domain '${domain}' (exit ${res.exitCode}) — investigate manually${RESET}`);
            } else if (wouldOverwrite === null) {
                console.log(`${YELLOW}⚠️  marker-rewrite output for domain '${domain}' had no drift counter — investigate manually${RESET}`);
            } else if (wouldOverwrite > 0) {
                console.log(`${YELLOW}⚠️  COMMON-CONTEXT drift in domain '${domain}': ${wouldOverwrite} zone(s) would be overwritten${RESET}`);
                console.log(`${YELLOW}   Refresh manually: bun scripts/propagate-to-templates.ts --marker-rewrite --domain ${domain} --apply${RESET}`);
            } else {
                console.log(`${GREEN}✓ COMMON-CONTEXT domain '${domain}' in sync (0 would-overwrite)${RESET}`);
            }
        } catch {
            console.log(`${YELLOW}⚠️  marker-rewrite check could not run for domain '${domain}' — investigate manually${RESET}`);
        }
    }
}

// 4.6 Skill sync to platform directories — must run BEFORE audit gate so
//     that templates/common/ platform skills are current.
console.log('📋 Step 4.6: Syncing skills to platform directories...');
const syncSkillsResult = await $`bun scripts/sync-skills.ts`.nothrow();
if (syncSkillsResult.exitCode !== 0) {
    console.warn(`⚠️  Skill sync had warnings (exit ${syncSkillsResult.exitCode}), continuing...`);
    if (syncSkillsResult.stderr) console.warn(String(syncSkillsResult.stderr).trim());
}

// 4.62 Cascade re-publish — unconditional second L0→L1 pass after skill sync.
//     Step 4.5 runs propagate-to-templates.ts --apply BEFORE step 4.6 sync-skills.ts
//     updates root platform dirs (.claude/.gemini/.agents/skills). This causes a lag:
//     4.5 compares stale platform copies to templates, then 4.6 updates platforms,
//     leaving template platform copies stale until the NEXT sync. Fix: re-run
//     propagate-to-templates.ts --apply unconditionally after 4.6 (new step 4.62).
//     Transforms are directional and idempotent, so the converged pass copies nothing.
//     Design doc: docs/designs/2026-08-25-pipeline-cascade-repass-design.md
if (isWorkspaceRoot) {
    console.log('📦 Step 4.62: Cascade re-publish (L0→L1 after skill sync)...');
    try {
        const repassRes = await $`bun scripts/propagate-to-templates.ts --apply`.nothrow();
        if (repassRes.exitCode !== 0) {
            if (isL0Context) {
                console.log(`${RED}❌ Cascade re-publish failed — fatal in L0 context${RESET}`);
                if (import.meta.main) {
                    process.exit(1);
                }
            } else {
                console.log(`${YELLOW}⚠️  Cascade re-publish failed — continuing sync${RESET}`);
            }
        } else {
            const stdout = repassRes.stdout.toString();
            if (stdout.includes('Nothing to apply')) {
                console.log(`${GREEN}✓ Step 4.62: template mirrors already converged (nothing to apply)${RESET}`);
            } else {
                const match = stdout.match(/Done\. (\d+) file\(s\) copied\./);
                if (match) {
                    const n = match[1];
                    console.log(`${GREEN}✓ Step 4.62: cascade re-publish complete — ${n} file(s) copied${RESET}`);
                } else {
                    console.log(`${GREEN}✓ Step 4.62: cascade re-publish complete${RESET}`);
                }
            }
        }
    } catch (e) {
        if (isL0Context) {
            console.log(`${RED}❌ Cascade re-publish failed — fatal in L0 context${RESET}`);
            if (import.meta.main) {
                process.exit(1);
            }
        } else {
            console.log(`${YELLOW}⚠️  Cascade re-publish failed — continuing sync${RESET}`);
        }
    }
}

// 4.65 Skill Graph Gate — generates and verifies skill relationship graph (ADR-0060
//     + Amendment 2). At the workspace root this covers the L0 unified graph plus a
//     generate+verify loop over every template scope (templates/common and
//     templates/co-* ship their own docs/skill-graph.json). Scaffolded projects have
//     no templates/ directory, so the scope loop skips; the project's own local
//     graph is emitted by the same guarded calls below (run-context auto-detection
//     tags project assets L3). Must run BEFORE VERSION_MANIFEST generation so graph
//     files are committed.
if (fs.existsSync('scripts/generate-skill-graph.ts')) {
    console.log('📋 Step 4.65: Skill relationship graph gate...');
    const graphGenRes = await $`bun scripts/generate-skill-graph.ts`.nothrow();
    if (graphGenRes.exitCode !== 0) {
        console.error(`${RED}❌ Skill graph generation failed.${RESET}`);
        console.error(`${YELLOW}   Run manually: bun scripts/generate-skill-graph.ts${RESET}`);
        if (import.meta.main) {
            process.exit(1);
        }
    }

    const graphVerifyRes = await $`bun scripts/verify-skill-graph.ts`.nothrow();
    if (graphVerifyRes.exitCode !== 0) {
        console.error(`${RED}❌ Skill graph verification failed.${RESET}`);
        console.error(`${YELLOW}   The committed skill graph does not match the current workspace state.${RESET}`);
        console.error(`${YELLOW}   Fix: Review changes to skills/, agents/, or variant.json, then re-run: bun scripts/generate-skill-graph.ts${RESET}`);
        if (import.meta.main) {
            process.exit(1);
        }
    }

    // Template scopes (workspace root only — projects have no templates/ directory).
    if (fs.existsSync('templates/common')) {
        const scopes = ['common'];
        for (const entry of fs.readdirSync('templates', { withFileTypes: true })) {
            if (entry.isDirectory() && entry.name.startsWith('co-')) scopes.push(entry.name);
        }
        for (const scope of scopes) {
            const scopeGenRes = await $`bun scripts/generate-skill-graph.ts --scope ${scope}`.nothrow();
            if (scopeGenRes.exitCode !== 0) {
                console.error(`${RED}❌ Skill graph generation failed for scope: ${scope}.${RESET}`);
                if (import.meta.main) {
                    process.exit(1);
                }
            }
            const scopeVerifyRes = await $`bun scripts/verify-skill-graph.ts --scope ${scope}`.nothrow();
            if (scopeVerifyRes.exitCode !== 0) {
                console.error(`${RED}❌ Skill graph verification failed for scope: ${scope}.${RESET}`);
                console.error(`${YELLOW}   Fix: bun scripts/generate-skill-graph.ts --scope ${scope}${RESET}`);
                if (import.meta.main) {
                    process.exit(1);
                }
            }
        }
        console.log(`${GREEN}✓ Skill graph scope artifacts verified (${scopes.length} scopes)${RESET}`);
    }

    console.log(`${GREEN}✓ Skill graph verification passed${RESET}`);
} else {
    console.log('📋 Step 4.65: skipped — skill graph generator not present in this context');
}

// 4.7 Generate VERSION_MANIFEST.md
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

// 4.9 Audit gate — call audit.ts directly (platform-independent, no shell intermediary)
//     Runs AFTER publish + skill sync so templates/common/ is up-to-date with scrub.
const auditRes = await $`bun scripts/audit.ts`.nothrow();

if (auditRes.exitCode !== 0) {
    if (import.meta.main) {
      process.exit(1);
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
        const branchExists = (await $`git show-ref --verify refs/heads/${branch}`.quiet().nothrow()).exitCode === 0;
        if (branchExists) {
            await $`git checkout ${branch}`.nothrow();
        } else {
            await $`git checkout -b ${branch}`.nothrow();
        }
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
    { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: unknown) => typeof r === "object" && r !== null && (r as { exitCode: number }).exitCode === 0 },
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

// 7. Generate PR body and open PR — but skip creation if an OPEN PR already exists
// for this branch (e.g. re-running /sync to push a follow-up commit onto an open PR).
// The push above already updated it; calling `gh pr create` again would just fail
// with "a pull request ... already exists", masking the fact that the commit/push
// actually succeeded.
// `gh pr view <branch>` resolves to ANY PR for that branch regardless of state —
// on a reused branch name whose earlier PR was already MERGED/CLOSED, that lookup
// still "succeeds" and this step would wrongly report "no new PR needed" while the
// new commits sit with zero PR coverage. Must check state explicitly.
const existingPrRes = await $`gh pr view ${branch} --json url,state --jq "if .state == \"OPEN\" then .url else \"\" end"`.quiet().nothrow();
const existingPrUrl = existingPrRes.exitCode === 0 ? existingPrRes.stdout.toString().trim() : '';

if (existingPrUrl) {
    console.log(`${GREEN}✓ PR already exists for '${branch}' — commit pushed, no new PR needed:${RESET}`);
    console.log(`  ${existingPrUrl}`);
} else {
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
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: unknown) => typeof r === "object" && r !== null && (r as { exitCode: number }).exitCode === 0 },
            'gh pr create'
        );
    } else if (prBody) {
        prCreateRetry = await withRetry(
            () => $`gh pr create --title ${msg} --body ${prBody}`.nothrow(),
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: unknown) => typeof r === "object" && r !== null && (r as { exitCode: number }).exitCode === 0 },
            'gh pr create'
        );
    } else if (fs.existsSync(path.join('.github', 'pull_request_template.md'))) {
        const prTpl = fs.readFileSync(path.join('.github', 'pull_request_template.md'), 'utf-8');
        prCreateRetry = await withRetry(
            () => $`gh pr create --title ${msg} --body ${prTpl}`.nothrow(),
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: unknown) => typeof r === "object" && r !== null && (r as { exitCode: number }).exitCode === 0 },
            'gh pr create'
        );
    } else {
        prCreateRetry = await withRetry(
            () => $`gh pr create --fill`.nothrow(),
            { ...DEFAULT_CONFIG, maxRetries: 3, initialDelay: 1000, isSuccess: (r: unknown) => typeof r === "object" && r !== null && (r as { exitCode: number }).exitCode === 0 },
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
