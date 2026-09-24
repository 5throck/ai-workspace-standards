#!/usr/bin/env bun
// @version 1.2.0
// v1.2.0 (2026-09-25, T-20260924-003 — spec
//          docs/designs/2026-09-25-inventory-decisions-batch-design.md R2.3):
//          the settling pass generalizes extends-stub resolution from pm.md-only
//          to EVERY agents/*.md carrying `extends:` frontmatter (the 13 variant
//          i18n-specialist.md stubs resolve here too); pm.md keeps the H12
//          canonical-prose check and the L1-B metadata strip.
// v1.1.0 (2026-09-23, pre-adoption GitHub repo readiness — spec
//          2026-09-23-pre-adoption-github-repo-design): pre-flight warns when the project
//          has no GitHub remote and points at scripts/ensure-github-repo.ts (check →
//          create → push → verify) so the history is safe off-machine before migration.
// v1.0.0 (2026-09-23, adopt-project conversion — spec 2026-09-23-adopt-project-conversion):
//          In-place conversion of an existing external project into a workspace-standard
//          project (as if delivered by new-project.ts), preserving project content and
//          git history. Automates docs/variant-conversion-guide.md §3 "Scenario B".
//
// Architecture (PM meeting 2026-09-23, memory/meeting-2026-09-23-adopt-project-plan-review.md):
//   thin orchestrator over scripts/upgrade-project.ts (the delivery engine, subprocess
//   boundary — files-only contract, no stdout parsing). Scan/plan logic lives in
//   scripts/helpers/adopt-plan.ts (pure, unit-testable). Safety model:
//     - Colliding foreign files are COPIED (never moved) to a backup dir OUTSIDE the
//       project repo before delivery, so the tree stays porcelain-clean and the engine's
//       `git stash push -u` never fires; after delivery the copies are restored into
//       scripts/_legacy/ (de-executed) — the engine may overwrite the originals.
//     - Foreign skills are protected from the engine's registry prunes by seeding
//       variant.json skill_manifest.variant_specific; the seed file is added to
//       .git/info/exclude (invisible to status AND to stash -u) and deleted post-delivery.
//     - Refusal-grade pre-flight findings (secret-shaped tracked files, hook-manager
//       conflicts, gitleaks hits in pre-existing content) abort regardless of --yes.
//     - Success contract for the subprocess: exit 0 AND a fresh delivery manifest
//       (the engine has an exit-0 abort path at its missing-marker prompt).
//     - No auto-commit; guided recovery = recorded HEAD SHA + backup dir.

import {
  existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, chmodSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  buildAdoptionPlan, detectHookManagerConflicts, findSecretShapedFiles, type AdoptionPlan,
} from './helpers/adopt-plan.ts';
import { resolveAgentExtendsStub, stripL1BMetadata } from './helpers/resolve-pm-stub.ts';
import { isCanonicalPmStubBody } from './helpers/scaffold-markers.ts';
import { applyContextTemplate, DEFAULT_PM_ROLE_DESCRIPTIONS } from './helpers/template-utils.ts';
import { substituteFiles } from './helpers/substitute-placeholders.ts';
import { blankL0Refs } from './helpers/l0-ref-policy.ts';
import { setStateFile, resetStateFile, saveState, loadState, type PipelineState } from './lib/pipeline-state.ts';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const WORKSPACE_ROOT = resolve(import.meta.dir, '..');
const TEMPLATES_DIR = join(WORKSPACE_ROOT, 'templates');
const COMMON_DIR = join(TEMPLATES_DIR, 'common');
const VARIANT_NAME_RE = /^co-[a-z][a-z0-9-]{1,30}$/;
const GOVERNED_PLATFORM_TWINS = ['CLAUDE.md', 'GEMINI.md', 'CODEX.md'];
const GOVERNED_GITHOOKS = new Set(['pre-commit', 'pre-push', 'commit-msg', 'post-checkout', 'pre-rebase', 'README.md']);

function fail(msg: string): never {
  console.error(`${RED}${msg}${RESET}`);
  process.exit(1);
}

function git(cwd: string, ...args: string[]): { status: number; out: string } {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return { status: r.status ?? 1, out: (r.stdout || '').trim() };
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

// ── CLI args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  // last-wins: a repeated flag overrides the earlier value (predictable override semantics)
  for (let i = args.length - 2; i >= 0; i--) {
    if (args[i] === flag) return args[i + 1];
  }
  return undefined;
}
const VALUE_FLAGS = new Set(['--variant', '--platform', '--project']);
const DRY_RUN = args.includes('--dry-run');
const YES = args.includes('--yes') || args.includes('-y') || process.env.CI === 'true' || process.env.CI === '1';
const platform = getArg('--platform') ?? 'all';
let variant = getArg('--variant') ?? '';
const positional = args.find((a, i) => !a.startsWith('--') && (i === 0 || args[i - 1]?.startsWith('--') !== true || !VALUE_FLAGS.has(args[i - 1])));
const projectArg = getArg('--project') ?? positional;

if (!projectArg) {
  console.error('Usage: bun scripts/adopt-project.ts <project-path> --variant co-<x> [--platform all|claude|antigravity|codex] [--dry-run] [--yes]');
  process.exit(1);
}
if (!['all', 'claude', 'antigravity', 'codex'].includes(platform)) {
  fail(`Invalid --platform '${platform}' (all|claude|antigravity|codex)`);
}

const projectDir = resolve(projectArg);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — PRE-FLIGHT (hard checks; refusals are --yes-proof)
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${CYAN}=== adopt-project: convert an existing project to the workspace standard ===${RESET}`);
console.log(`Project: ${projectDir}`);

if (!existsSync(projectDir) || !statSync(projectDir).isDirectory()) fail(`Project directory not found: ${projectDir}`);
if (projectDir === WORKSPACE_ROOT) fail('Target is the workspace root — adoption needs a project directory.');

const bunCheck = spawnSync('bun', ['--version'], { encoding: 'utf8' });
if (bunCheck.status !== 0) {
  console.error(`${RED}[FAIL] bun not found.${RESET} Every workspace script and the pre-commit hook require bun.`);
  console.error('       Install bun first:  curl -fsSL https://bun.sh/install | bash   (or: brew install oven-sh/bun/bun)');
  process.exit(1);
}

if (git(projectDir, 'rev-parse', '--git-dir').status !== 0) fail('Not a git repository — adoption requires git (history preservation is the rollback story).');

// Adoption-state detection runs BEFORE the clean-tree check: a freshly adopted (not yet
// committed) project has a dirty tree by design, and the operator must be told the
// maintenance path, not scolded about cleanliness.
const markerPath = join(projectDir, '.claude', 'template-version.txt');
const ctxCommonPath = join(projectDir, 'docs', 'context.md');
const stateFile = join(WORKSPACE_ROOT, 'tests', '.temp', `adopt-project-state-${createHash('sha256').update(projectDir).digest('hex').slice(0, 12)}.json`);
const resuming = existsSync(stateFile);

if (!resuming && existsSync(markerPath)) {
  const ctxVariantExists = existsSync(join(projectDir, 'docs', `${variant || readMarkerVariant(markerPath)}.context.md`));
  if (existsSync(ctxCommonPath) && ctxVariantExists) {
    fail('This project is already adopted (marker + context files all present).\n'
      + '       Use the maintenance path instead: bun scripts/upgrade-project.ts <project-path> --variant <v>');
  }
  console.log(`${YELLOW}⚠️  Partial provenance detected (marker without full context files) — repair path: adopt will rewrite provenance and deliver what is missing.${RESET}`);
}

const porcelain = git(projectDir, 'status', '--porcelain').out;
if (porcelain && !resuming) {
  fail('Working tree is not clean. Commit or stash everything first — adoption needs a clean baseline for its rollback story.\n'
    + `  ${YELLOW}git -C ${projectDir} status --porcelain${RESET}`);
}

// GitHub baseline advisory (v1.1.0): adoption preserves history locally, but an
// off-machine copy should exist BEFORE migrating. Non-fatal — the operator decides.
if (!git(projectDir, 'remote', '-v').out.includes('github.com')) {
  console.log(`${YELLOW}⚠️  No GitHub remote configured — migrate only after the history is safe off-machine.${RESET}`);
  console.log(`       Run first:  bun scripts/ensure-github-repo.ts ${projectDir}   (checks, creates, pushes, verifies)`);
}

const headSha = git(projectDir, 'rev-parse', 'HEAD');
const head = headSha.status === 0 ? headSha.out : '';

function readMarkerVariant(marker: string): string {
  try {
    return (readFileSync(marker, 'utf8').match(/^variant=(.*)$/m)?.[1] ?? '').trim();
  } catch { return ''; }
}

// Refusal-grade: secret-shaped TRACKED files (their content enters engine stashes/backup scope).
const trackedFiles = git(projectDir, 'ls-files').out ? git(projectDir, 'ls-files').out.split('\n').filter(Boolean) : [];
const secretFiles = findSecretShapedFiles(trackedFiles);
if (secretFiles.length > 0) {
  fail(`Refusing: secret-shaped files are tracked in this repo (--yes cannot bypass this):\n`
    + secretFiles.map(f => `       - ${f}`).join('\n')
    + `\n       Remove them from tracking (git rm --cached) or relocate before adopting.\n`
    + `       The delivered .gitignore + pre-commit gates will keep them out afterwards.`);
}
const hookFindings = detectHookManagerConflicts(projectDir);
if (hookFindings.length > 0) {
  fail(`Refusing: competing hook managers detected (--yes cannot bypass this):\n`
    + hookFindings.map(f => `       - [${f.kind}] ${f.detail}`).join('\n')
    + `\n       Adopt installs .githooks/ + core.hooksPath enforcement; remove or migrate the\n`
    + `       hook managers above first (their prepare scripts would silently re-disable the\n`
    + `       workspace gates on the next bun install).`);
}

console.log(`${GREEN}✅ Pre-flight OK${RESET}${head ? ` (HEAD ${head.slice(0, 10)})` : ' (no commits yet)'}`);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — VARIANT SELECTION
// ═══════════════════════════════════════════════════════════════════════════════
const availableVariants = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory() && e.name.startsWith('co-'))
  .map(e => e.name)
  .sort();

if (!variant) {
  console.log(`\nNo --variant given. Valid variants:`);
  for (const v of availableVariants) {
    let status = '';
    try { status = JSON.parse(readFileSync(join(TEMPLATES_DIR, v, 'variant.json'), 'utf8')).status ?? ''; } catch { /* stub */ }
    console.log(`  - ${v}${status ? `  (${status})` : ''}`);
  }
  process.exit(1);
}
if (!VARIANT_NAME_RE.test(variant)) fail(`Invalid variant name '${variant}' (expected co-<slug>).`);
const variantDir = join(TEMPLATES_DIR, variant);
if (!existsSync(variantDir)) fail(`Variant template not found: templates/${variant}\n       Valid variants: ${availableVariants.join(', ')}`);

let variantStatus = '';
try { variantStatus = JSON.parse(readFileSync(join(variantDir, 'variant.json'), 'utf8')).status ?? ''; } catch { /* none */ }
if (variantStatus && variantStatus !== 'stable') {
  if (YES) {
    console.log(`${YELLOW}⚠️  Variant '${variant}' status is '${variantStatus}' (non-stable) — proceeding via --yes/CI (documented new-project parity).${RESET}`);
  } else {
    const answer = prompt(`Variant '${variant}' status is '${variantStatus}' (non-stable). Proceed? [y/N] `) ?? '';
    if (!['y', 'Y'].includes(answer)) { console.log('Aborted.'); process.exit(0); }
  }
}

// Adoption's own target policy (outside-Projects consent is NOT laundered through --yes).
const projectsRoot = join(WORKSPACE_ROOT, 'Projects');
if (!projectDir.startsWith(projectsRoot) && !YES) {
  fail(`Target is outside Projects/ (${relative(WORKSPACE_ROOT, projectDir) || projectDir}).\n`
    + `       Pass --yes to adopt a project outside the canonical Projects/ layout.`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — SCAN · PLAN · CONFIRM
// ═══════════════════════════════════════════════════════════════════════════════
const projectName = basename(projectDir);
const plan: AdoptionPlan = buildAdoptionPlan({
  variant, platform, projectName, commonDir: COMMON_DIR, variantDir, projectDir, trackedFiles,
});

console.log(`\n${CYAN}--- Adoption plan ---${RESET}`);
console.log(`Delivered paths (effective template tree): ${plan.deliveredPathCount}`);
console.log(`Colliding foreign files (preserved to scripts/_legacy/): ${plan.collisions.length}`);
for (const c of plan.collisions.slice(0, 20)) console.log(`  ⚠️  ${c.rel}  [${c.claimPass}]`);
if (plan.collisions.length > 20) console.log(`  … and ${plan.collisions.length - 20} more`);
console.log(`Retained foreign scripts (will be registered in scripts/SCRIPTS.md): ${plan.retainedForeignScripts.length}`);
for (const s of plan.retainedForeignScripts) console.log(`  + ${s}`);
console.log(`Foreign skills (protected via variant.json skill_manifest seed): ${plan.foreignSkills.length}`);
for (const s of plan.foreignSkills) console.log(`  🛡️  ${s}`);
console.log(`Workflow traces kept as-is (coexistence): ${plan.workflowTraces.length}`);
for (const t of plan.workflowTraces) console.log(`  📄 ${t.rel}  (${t.kind})`);

console.log(`\n${CYAN}Workflow adjustment${RESET} — after adoption this project routes work through the PM Gateway:`);
console.log(`  user → PM triage → Design Gate (unless exempt) → specialist dispatch → QA gate → /sync PR`);
console.log(`  Existing traces above are PRESERVED; platform twins get workspace managed-blocks appended;`);
console.log(`  no CI file is overwritten without its own backup entry.`);

let declinedAgents: string[] = [];
let selectedCountry = '';
if (!YES) {
  const proceed = prompt('Proceed with adoption as planned? [Y/n] ') ?? '';
  if (['n', 'N'].includes(proceed)) { console.log('Aborted.'); process.exit(0); }

  if (plan.roster.length > 0) {
    const all = prompt(`Adopt the full variant agent roster (${plan.roster.join(', ')})? [Y/n] `) ?? '';
    if (['n', 'N'].includes(all)) {
      for (const agent of plan.roster) {
        const keep = prompt(`  adopt agent '${agent}'? [Y/n] `) ?? '';
        if (['n', 'N'].includes(keep)) declinedAgents.push(agent);
      }
    }
  }

  const countryCfg = readCountryConfig(variantDir);
  if (countryCfg.countries.length > 0) {
    console.log(`Available jurisdictions: ${countryCfg.countries.join(', ')} (empty = region-neutral)`);
    const answer = (prompt('Target jurisdiction [region-neutral]: ') ?? '').trim();
    if (answer) selectedCountry = answer;
  }
} else {
  console.log(`${YELLOW}--yes/CI: accepting plan defaults (full roster, region-neutral country).${RESET}`);
}

function readCountryConfig(vDir: string): { profilesDir: string; countries: string[] } {
  try {
    const cfg = JSON.parse(readFileSync(join(vDir, 'variant.json'), 'utf8')).country_config ?? {};
    const profilesDir = (cfg.profiles_dir as string) ?? 'docs/countries';
    const pDir = join(vDir, profilesDir);
    const countries = existsSync(pDir)
      ? readdirSync(pDir, { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== 'ACTIVE.md').map(e => e.name)
      : [];
    return { profilesDir, countries };
  } catch { return { profilesDir: 'docs/countries', countries: [] }; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — PRE-DELIVERY SAFETY (tree stays porcelain-clean)
// ═══════════════════════════════════════════════════════════════════════════════
const startedAt = new Date().toISOString();
const backupDir = join(WORKSPACE_ROOT, 'tests', '.temp', `adopt-backup-${Date.now()}`);
let state: PipelineState | null = null;
if (!DRY_RUN) {
  // State lives OUTSIDE the project repo during the run — a state file inside the
  // project would dirty the tree and hand the engine's `git stash -u` a victim
  // (meeting P0-3). On success it is removed; on failure it drives resume.
  setStateFile(stateFile);
  state = loadState() ?? {
    status: 'in_progress', currentPhase: 'adopt_preflight', startedAt, variantName: variant,
    l3ProjectPath: projectDir, rollbackActions: [], context: {},
  };
  state.currentPhase = 'adopt_predelivery';
  state.context = {
    ...(state.context as Record<string, unknown>),
    projectDir, backupDir, platform, selectedCountry, declinedAgents,
    deliveryDone: (state.context as Record<string, unknown>).deliveryDone ?? false,
    predeliveryDone: true,
  };
  saveState(state);
}

if (!DRY_RUN) {
  mkdirSync(backupDir, { recursive: true });
  for (const c of plan.collisions) {
    const src = join(projectDir, c.rel);
    const dest = join(backupDir, c.rel);
    mkdirSync(dirname(dest), { recursive: true });
    // COPY, never move: removing a tracked file would dirty the tree and trip the
    // engine's stash; the engine overwrites the original and settling archives the copy.
    writeFileSync(dest, readFileSync(src));
    console.log(`  📦 backed up ${c.rel} → ${relative(WORKSPACE_ROOT, dest)}`);
  }
  // Foreign-skill manifest seed — invisible to git status and to `stash -u` via info/exclude.
  if (plan.foreignSkills.length > 0) {
    const tplVariantJson = JSON.parse(readFileSync(join(variantDir, 'variant.json'), 'utf8')) as Record<string, unknown>;
    const manifest = (tplVariantJson.skill_manifest ?? {}) as Record<string, unknown>;
    const existing = Array.isArray(manifest.variant_specific) ? manifest.variant_specific as Array<Record<string, unknown>> : [];
    const have = new Set(existing.map(e => String(e.name ?? '')));
    const merged = [...existing, ...plan.foreignSkills.filter(s => !have.has(s)).map(s => ({ name: s, reason: 'adopted foreign skill (adopt-project)' }))];
    const seeded = { ...tplVariantJson, skill_manifest: { ...manifest, variant_specific: merged } };
    writeFileSync(join(projectDir, 'variant.json'), JSON.stringify(seeded, null, 2) + '\n');
    appendInfoExclude(projectDir, 'variant.json');
    console.log(`  🛡️  seeded variant.json skill_manifest with ${plan.foreignSkills.length} foreign skill(s) (info/exclude-protected)`);
  }
}

function appendInfoExclude(project: string, line: string): void {
  const excludePath = join(project, '.git', 'info', 'exclude');
  mkdirSync(dirname(excludePath), { recursive: true });
  let content = '';
  try { content = readFileSync(excludePath, 'utf8'); } catch { /* new file */ }
  const marker = `# adopt-project: ${line}`;
  if (!content.includes(marker)) {
    writeFileSync(excludePath, content.trimEnd() + (content.trim() ? '\n' : '') + `${marker}\n${line}\n`);
  }
}

function removeInfoExclude(project: string, line: string): void {
  const excludePath = join(project, '.git', 'info', 'exclude');
  if (!existsSync(excludePath)) return;
  const lines = readFileSync(excludePath, 'utf8').split('\n');
  const kept = lines.filter((l, i) => {
    if (l === line) return false;
    if (l === `# adopt-project: ${line}` && lines[i + 1] === line) return false;
    return true;
  });
  writeFileSync(excludePath, kept.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — DELIVERY (upgrade-project subprocess)
// ═══════════════════════════════════════════════════════════════════════════════
const manifestPath = join(projectDir, '.claude', 'last-upgrade-delivery.json');
const manifestMtimeBefore = existsSync(manifestPath) ? statSync(manifestPath).mtimeMs : 0;

console.log(`\n${CYAN}--- Delivery (upgrade-project engine) ---${RESET}`);
const engine = spawnSync(process.execPath, [
  join(WORKSPACE_ROOT, 'scripts', 'upgrade-project.ts'),
  projectDir, '--variant', variant, '--platform', platform, '--yes', ...(DRY_RUN ? ['--dry-run'] : []),
], { stdio: 'inherit', cwd: WORKSPACE_ROOT });

if (DRY_RUN) {
  console.log(`\n${CYAN}--- Planned settling pass (skipped in --dry-run) ---${RESET}`);
  console.log(`  restore ${plan.collisions.length} collision copy(ies) into scripts/_legacy/ (de-executed)`);
  console.log(`  register ${plan.retainedForeignScripts.length} retained foreign script(s) in scripts/SCRIPTS.md`);
  console.log(`  resolve agents/pm.md extends-stub + strip L1-B metadata`);
  console.log(`  seed memory/MEMORY.md, docs/README pair, CHANGELOG.md (add-if-missing)`);
  console.log(`  generate docs/${variant}.context.md + Template Provenance footer (if absent)`);
  console.log(`  blankL0Refs sweep + placeholder substitution scoped to delivered files`);
  console.log(`  package.json create-or-merge + bun install + graft build + hooksPath re-assert`);
  console.log(`  gitleaks scan (tree + history) and audit smoke (report-only)`);
  console.log(`\nDry-run complete — no changes were written.`);
  process.exit(0);
}

const manifestFresh = existsSync(manifestPath) && statSync(manifestPath).mtimeMs > manifestMtimeBefore;
if (engine.status !== 0 || !manifestFresh) {
  console.error(`\n${RED}Delivery did not complete (engine exit ${engine.status}${manifestFresh ? '' : ', no fresh delivery manifest'}).${RESET}`);
  console.error(`Guided recovery (never automatic):`);
  if (head) console.error(`  git -C ${projectDir} reset --hard ${head} && git -C ${projectDir} clean -fd`);
  console.error(`  Collision backups: ${backupDir}`);
  console.error(`  Engine stash (if any): git -C ${projectDir} stash list`);
  process.exit(1);
}
console.log(`${GREEN}✅ Delivery complete.${RESET}`);
if (!state) fail('Internal: state missing after delivery (non-dry-run path).');
state.currentPhase = 'adopt_settling';
state.context = { ...(state.context as Record<string, unknown>), deliveryDone: true, headAtDelivery: head };
saveState(state);

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6 — SETTLING POST-PASS
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${CYAN}--- Settling post-pass ---${RESET}`);
const report = {
  deliveredManifest: [] as string[],
  restoredToLegacy: [] as string[],
  registeredScripts: [] as string[],
  seeds: [] as string[],
  substituted: [] as string[],
  platformRemoved: [] as string[],
  country: selectedCountry || 'region-neutral',
  env: { hooksPath: false, bunInstall: false, graft: false, gitleaksFindings: -1, auditSmoke: 'not-run' },
};

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { files?: string[] };
report.deliveredManifest = manifest.files ?? [];
const deliveredSet = new Set(report.deliveredManifest);

// 1. Restore collision copies into scripts/_legacy/ (de-executed archive).
for (const c of plan.collisions) {
  const backupFile = join(backupDir, c.rel);
  if (!existsSync(backupFile)) continue;
  const relUnderLegacy = c.rel.startsWith('scripts/') ? c.rel.slice('scripts/'.length) : c.rel.replace(/^\//, '');
  const dest = join(projectDir, 'scripts', '_legacy', relUnderLegacy);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, readFileSync(backupFile));
  try { chmodSync(dest, 0o644); } catch { /* non-executable by default on this FS */ }
  report.restoredToLegacy.push(relative(projectDir, dest));
}
if (report.restoredToLegacy.length > 0) console.log(`  🗄️  ${report.restoredToLegacy.length} foreign file(s) archived under scripts/_legacy/`);

// 2. Register retained foreign scripts (audit's registry-consistency gate needs rows).
// The engine never delivers scripts/SCRIPTS.md (registry is scaffold-time) — seed the
// project's copy from templates/common first so registration has a table to append to.
const projScriptsMd = join(projectDir, 'scripts', 'SCRIPTS.md');
if (!existsSync(projScriptsMd) && existsSync(join(COMMON_DIR, 'scripts', 'SCRIPTS.md'))) {
  mkdirSync(dirname(projScriptsMd), { recursive: true });
  writeFileSync(projScriptsMd, readFileSync(join(COMMON_DIR, 'scripts', 'SCRIPTS.md'), 'utf8'));
  report.seeds.push('scripts/SCRIPTS.md');
  console.log('  📋 scripts/SCRIPTS.md seeded from templates/common (project registry snapshot)');
}
if (plan.retainedForeignScripts.length > 0 && existsSync(projScriptsMd)) {
  let registry = readFileSync(projScriptsMd, 'utf8');
  const registryHeaderEnd = registry.indexOf('\n## ', registry.indexOf('## Registry'));
  for (const rel of plan.retainedForeignScripts) {
    const abs = join(projectDir, rel);
    let content = readFileSync(abs, 'utf8');
    if (!/@version\s+\d+\.\d+\.\d+/.test(content)) {
      content = `// @version 0.0.1\n` + content;
      writeFileSync(abs, content);
    }
    const name = rel.slice('scripts/'.length);
    if (!registry.includes(`\`${name}\``)) {
      const row = `| \`${name}\` | L0 | 0.0.1 | active | Adopted foreign script (adopt-project 2026-09-23) | —| L0 | —|\n`;
      registry = registryHeaderEnd === -1
        ? registry.trimEnd() + '\n' + row
        : registry.slice(0, registryHeaderEnd).trimEnd() + '\n' + row + registry.slice(registryHeaderEnd);
      report.registeredScripts.push(name);
    }
  }
  writeFileSync(projScriptsMd, registry);
  if (report.registeredScripts.length > 0) console.log(`  📋 ${report.registeredScripts.length} retained foreign script(s) registered in scripts/SCRIPTS.md`);
}

// 3. Remove the seeded variant.json (scaffold parity) + its info/exclude entry.
const seededVariantJson = join(projectDir, 'variant.json');
if (existsSync(seededVariantJson) && plan.foreignSkills.length > 0) {
  rmSync(seededVariantJson);
  removeInfoExclude(projectDir, 'variant.json');
  console.log('  🗑️  variant.json seed removed (scaffold parity)');
}

// 4. agents/*.md: self-contained (extends-stub resolution) + pm L1-B strip.
// v1.2.0 (T-20260924-003, R2.3): resolution generalized from pm.md-only to EVERY
// agents/*.md carrying `extends:` frontmatter (the 13 variant i18n-specialist.md
// stubs resolve here too); pm.md keeps the H12 canonical-prose check injected.
let pmResolvedAsStub = false;
{
  const projAgentsDir = join(projectDir, 'agents');
  if (existsSync(projAgentsDir)) {
    for (const fname of readdirSync(projAgentsDir).filter(f => f.endsWith('.md')).sort()) {
      const agentPath = join(projAgentsDir, fname);
      const stub = resolveAgentExtendsStub(
        agentPath,
        join(COMMON_DIR, 'agents', fname),
        variant,
        fname === 'pm.md' ? { isCanonicalStubBody: isCanonicalPmStubBody } : undefined,
      );
      if (stub.resolved) {
        if (fname === 'pm.md') pmResolvedAsStub = true;
        console.log(`  ✅ agents/${fname}: extends-stub resolved against templates/common body${stub.nonCanonical ? ' (H12: non-canonical prose body discarded — see transcript)' : ''}`);
      }
    }
  }
}
const projPmMd = join(projectDir, 'agents', 'pm.md');
if (existsSync(projPmMd)) {
  stripL1BMetadata(projPmMd);
  if (!pmResolvedAsStub) console.log('  ✅ agents/pm.md: L1-B metadata stripped');
}

// 5. docs/<variant>.context.md + Template Provenance footer.
const ctxVariantPath = join(projectDir, 'docs', `${variant}.context.md`);
const version = readFileSync(join(TEMPLATES_DIR, 'VERSION'), 'utf8').trim();
if (!existsSync(ctxVariantPath) && existsSync(join(COMMON_DIR, 'docs', 'variant.context.template.md'))) {
  applyContextTemplate(join(COMMON_DIR, 'docs', 'variant.context.template.md'), ctxVariantPath, {
    variantName: variant,
    version,
    pmRoleDescription: DEFAULT_PM_ROLE_DESCRIPTIONS[variant] ?? 'Workflow management, dispatch, quality gates',
  });
  console.log(`  ✅ docs/${variant}.context.md generated from the canonical template`);
}
if (existsSync(ctxVariantPath) && !readFileSync(ctxVariantPath, 'utf8').includes('Template-Version:')) {
  const jurisdiction = selectedCountry ? `- **Target-Jurisdiction**: ${selectedCountry}\n` : '- **Target-Jurisdiction**: region-neutral\n';
  appendFile(ctxVariantPath, `\n## Template Provenance\n\n- **Template-Version**: ${version}\n- **Template-Variant**: ${variant}\n${jurisdiction}`);
  console.log(`  ✅ Template Provenance footer appended to docs/${variant}.context.md`);
}

// 6-8. Add-if-missing seeds: memory index, docs README pair, CHANGELOG.
seedIfMissing(join(projectDir, 'memory', 'MEMORY.md'),
  `# Memory Index\n\n## Sessions\n\n| Date | Summary |\n|------|---------|\n\n## Meetings\n\n| Date | Topic | File |\n|------|-------|------|\n\n## ADRs\n\n| Date | ADR | Decision |\n|------|-----|----------|\n`, 'memory/MEMORY.md');
for (const doc of ['docs/README.md', 'docs/README_ko.md']) {
  const src = join(COMMON_DIR, 'docs', '_common', basename(doc));
  if (existsSync(src)) seedIfMissing(join(projectDir, doc), readFileSync(src, 'utf8'), doc);
}
seedIfMissing(join(projectDir, 'CHANGELOG.md'), readFileSync(join(COMMON_DIR, 'CHANGELOG.md'), 'utf8'), 'CHANGELOG.md');

function seedIfMissing(dest: string, content: string, label: string): void {
  if (existsSync(dest)) return;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
  report.seeds.push(label);
}
if (report.seeds.length > 0) console.log(`  🌱 seeded (add-if-missing): ${report.seeds.join(', ')}`);

function appendFile(path: string, text: string): void {
  writeFileSync(path, readFileSync(path, 'utf8').trimEnd() + text);
}

// 9. blankL0Refs sweep — scoped to delivered .md files.
let blanked = 0;
for (const rel of deliveredSet) {
  if (!rel.endsWith('.md')) continue;
  const abs = join(projectDir, rel);
  if (!existsSync(abs)) continue;
  const original = readFileSync(abs, 'utf8');
  const cleaned = blankL0Refs(original);
  if (cleaned !== original) { writeFileSync(abs, cleaned); blanked++; }
}
if (blanked > 0) console.log(`  🧹 blanked L0 CONSTITUTION references in ${blanked} delivered file(s)`);

// 10. Scoped placeholder substitution (delivery-manifest files only).
const substituted = substituteFiles([...deliveredSet].filter(rel => existsSync(join(projectDir, rel))), projectDir, {
  projectName, description: 'An adopted project', characteristics: '', variantName: variant,
  countryDisplayName: selectedCountry || '',
});
report.substituted = substituted;
if (substituted.length > 0) console.log(`  🔤 placeholders substituted in ${substituted.length} delivered file(s)`);

// 11. .gitattributes merge=ours rule (scaffold parity; guarded append).
const gitattributesPath = join(projectDir, '.gitattributes');
if (existsSync(gitattributesPath)) {
  const ga = readFileSync(gitattributesPath, 'utf8');
  if (!ga.includes('docs/context.md')) {
    appendFile(gitattributesPath, '\ndocs/context.md merge=ours\n');
    console.log('  📎 docs/context.md merge=ours appended to .gitattributes');
  }
}

// 13. Country: ACTIVE.md + marker rewrite (marker country= beats ACTIVE.md — repair trap).
if (selectedCountry) {
  const cfg = readCountryConfig(variantDir);
  const activeSrc = join(variantDir, cfg.profilesDir, selectedCountry, 'ACTIVE.md');
  const activeDest = join(projectDir, cfg.profilesDir, 'ACTIVE.md');
  if (existsSync(activeSrc)) {
    mkdirSync(dirname(activeDest), { recursive: true });
    writeFileSync(activeDest, readFileSync(activeSrc, 'utf8'));
    console.log(`  🌍 ACTIVE.md → ${selectedCountry} (${cfg.profilesDir}/ACTIVE.md)`);
  }
  if (existsSync(markerPath)) {
    // Adopt owns the provenance rewrite: the engine detected 'none' because no country
    // carrier existed pre-delivery, and a 'country=none' marker would defeat ACTIVE.md
    // on every future upgrade (detection precedence — meeting Scaffolding R2).
    const markerContent = readFileSync(markerPath, 'utf8');
    if (!markerContent.match(new RegExp(`^country=${selectedCountry}$`, 'm'))) {
      writeFileSync(markerPath, markerContent.replace(/^country=.*$/m, `country=${selectedCountry}`));
    }
  }
}

// 14. package.json create-or-merge (project keys win; strip hook-manager prepare scripts).
settlePackageJson(projectDir, COMMON_DIR, report);

/**
 * package.json settling: WITHOUT a project package.json, copy the template's (name
 * slugified) so `bun run audit` etc. and the delivered scripts' deps exist. WITH a
 * foreign package.json, merge the workspace script surface into it: missing `scripts`
 * entries are added (existing keys stay project-owned), workspace deps are unioned in,
 * engines/overrides carried over — and any hook-manager prepare script is stripped
 * (refusal-grade conflicts were already handled pre-flight; this is belt-and-suspenders).
 * `workspace-scripts` is never written into a foreign file (project-ownership marker).
 */
function settlePackageJson(
  project: string,
  commonDir: string,
  report: { seeds: string[] },
): void {
  const tplPkgPath = join(commonDir, 'package.json');
  const projPkgPath = join(project, 'package.json');
  if (!existsSync(tplPkgPath)) return;
  const tpl = JSON.parse(readFileSync(tplPkgPath, 'utf8')) as Record<string, any>;
  if (!existsSync(projPkgPath)) {
    const seeded = { ...tpl, name: projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-') };
    delete (seeded as Record<string, unknown>)['workspace-scripts'];
    writeFileSync(projPkgPath, JSON.stringify(seeded, null, 2) + '\n');
    report.seeds.push('package.json');
    return;
  }
  const proj = JSON.parse(readFileSync(projPkgPath, 'utf8')) as Record<string, any>;
  proj.scripts = { ...(tpl.scripts ?? {}), ...(proj.scripts ?? {}) };
  if (proj.scripts.prepare && /husky|simple-git-hooks|lefthook/.test(String(proj.scripts.prepare))) {
    delete proj.scripts.prepare;
  }
  for (const depKey of ['dependencies', 'devDependencies']) {
    if (tpl[depKey]) proj[depKey] = { ...tpl[depKey], ...(proj[depKey] ?? {}) };
  }
  if (tpl.overrides) proj.overrides = { ...tpl.overrides, ...(proj.overrides ?? {}) };
  if (tpl.engines && !proj.engines) proj.engines = tpl.engines;
  writeFileSync(projPkgPath, JSON.stringify(proj, null, 2) + '\n');
  console.log('  🔧 package.json merged (project keys kept; workspace script surface added)');
}

// 15. scripts-snapshot.json (version map baseline for future upgrades).
spawnSync(process.execPath, [join(WORKSPACE_ROOT, 'scripts', 'helpers', 'write-scripts-snapshot.ts'),
  projectDir, new Date().toISOString().slice(0, 10), variant, join(COMMON_DIR, 'scripts')], { stdio: 'inherit', cwd: WORKSPACE_ROOT });

// 16. Platform profile — root twins + .codex only (never platform skill mirrors).
if (platform === 'claude') removeIfDelivered('GEMINI.md');
if (platform === 'antigravity') removeIfDelivered('CLAUDE.md');
for (const f of walkFiles(projectDir)) {
  if (f.endsWith('.cmd')) rmSync(f);
}
function removeIfDelivered(rel: string): void {
  const abs = join(projectDir, rel);
  if (deliveredSet.has(rel) && existsSync(abs)) {
    rmSync(abs);
    report.platformRemoved.push(rel);
  }
}
if (report.platformRemoved.length > 0) console.log(`  🧹 platform profile removed: ${report.platformRemoved.join(', ')}`);

// 17. Skill-table injection into docs/<variant>.context.md (non-fatal no-op without markers).
spawnSync(process.execPath, [join(WORKSPACE_ROOT, 'scripts', 'helpers', 'inject-skills.ts'), projectDir], { stdio: 'inherit', cwd: WORKSPACE_ROOT });

// 19-20. bun install, then hooksPath re-assert (belt-and-suspenders, meeting Security #2).
console.log('  📦 bun install…');
const install = spawnSync('bun', ['install'], { stdio: 'inherit', cwd: projectDir });
report.env.bunInstall = install.status === 0;
if (install.status !== 0) console.log(`${YELLOW}  ⚠️  bun install failed (non-fatal) — run it manually in the project.${RESET}`);
git(projectDir, 'config', 'core.hooksPath', '.githooks');
report.env.hooksPath = git(projectDir, 'config', 'core.hooksPath').out.includes('.githooks');
console.log(`  🪝 core.hooksPath = .githooks ${report.env.hooksPath ? 'verified' : '(NOT set — check manually)'}`);

// 21. graft build chain (global binary → bunx fallback; non-fatal).
console.log('  🌱 graft build…');
const graftDirect = spawnSync('graft', ['build'], { stdio: 'inherit', cwd: projectDir });
if (graftDirect.status !== 0) {
  const graftBunx = spawnSync('bunx', ['@nanonets/graft', 'build'], { stdio: 'inherit', cwd: projectDir });
  report.env.graft = graftBunx.status === 0;
  if (graftBunx.status !== 0) console.log(`${YELLOW}  ⚠️  graft build unavailable (non-fatal) — run 'graft build' in the project later.${RESET}`);
} else {
  report.env.graft = true;
}

// 22. gitleaks scan of pre-existing content (report-only; refusal-grade scan happens pre-flight when available).
console.log('  🔒 gitleaks working-tree scan…');
const gitleaks = spawnSync('gitleaks', ['detect', '--no-git', '--redact'], { cwd: projectDir, stdio: 'inherit' });
if (gitleaks.status === 0) { report.env.gitleaksFindings = 0; console.log('  🔒 gitleaks working-tree scan: clean'); }
else if (gitleaks.status === 1) { report.env.gitleaksFindings = -2; console.log(`${YELLOW}  ⚠️  gitleaks found potential secrets in pre-existing content — review before pushing.${RESET}`); }
else console.log(`${YELLOW}  ⚠️  gitleaks binary unavailable — history/worktree scan skipped (install gitleaks for full coverage).${RESET}`);

// 23. Audit smoke — the project's own gate, proving the delivered scripts run.
console.log('  🩺 audit smoke (bun scripts/audit.ts --skip-memory)…');
const smoke = spawnSync(process.execPath, ['scripts/audit.ts', '--skip-memory'], { cwd: projectDir, stdio: 'inherit' });
report.env.auditSmoke = smoke.status === 0 ? 'pass' : 'fail';
if (smoke.status !== 0) {
  console.log(`${YELLOW}  ⚠️  audit smoke FAILED — review the output above; likely pre-existing foreign content to reconcile.${RESET}`);
} else {
  console.log('  ✅ audit smoke passed');
}

// 24. Decisions record (post-delivery — outside the engine's stash window).
const decisionsDir = join(projectDir, '.claude');
mkdirSync(decisionsDir, { recursive: true });
writeFileSync(join(decisionsDir, 'adopt-project-decisions.json'), JSON.stringify({
  timestamp: new Date().toISOString(), variant, platform, projectName,
  plan, declinedAgents, selectedCountry: selectedCountry || null,
  report,
}, null, 2) + '\n');

// 25. Complete + clear the outside state file.
if (state) {
  state.status = 'completed';
  state.completedAt = new Date().toISOString();
  saveState(state);
  rmSync(stateFile, { force: true });
  resetStateFile();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 7 — REPORT
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${GREEN}=== Adoption complete ===${RESET}`);
console.log(`Delivered files      : ${report.deliveredManifest.length}`);
console.log(`Archived to _legacy  : ${report.restoredToLegacy.length}`);
console.log(`Registered scripts   : ${report.registeredScripts.length}`);
console.log(`Seeds (add-if-missing): ${report.seeds.length}`);
console.log(`Country              : ${report.country}`);
console.log(`Env                  : bun-install=${report.env.bunInstall ? 'ok' : 'failed'} hooksPath=${report.env.hooksPath ? 'ok' : 'unset'} graft=${report.env.graft ? 'ok' : 'skipped'} audit-smoke=${report.env.auditSmoke}`);
console.log(`\nNext steps:`);
console.log(`  1. Review:  git -C ${projectDir} diff HEAD`);
if (plan.collisions.length > 0) console.log(`  2. Archived originals: scripts/_legacy/ (de-executed) + ${backupDir}`);
console.log(`  ${plan.collisions.length > 0 ? '3' : '2'}. Commit when satisfied (adoption never commits for you).`);
console.log(`  Future maintenance: bun scripts/upgrade-project.ts <project-path>`);
