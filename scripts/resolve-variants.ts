/**
 * Resolve Variants (L1-B Phase)
 *
 * Resolves `extends:` skeleton references in each templates/co-<star>/ variant,
 * writing fully-merged files in-place so that:
 *  - audit can validate complete content before new-project runs
 *  - new-project.sh only needs to do a simple cp (no merge-frontmatter step)
 *
 * Idempotency: files already marked `# @resolved-from:` are skipped
 * unless --force is passed.
 *
 * Usage:
 *   bun scripts/resolve-variants.ts [--force] [--variant co-develop]
 *
 * @version 1.0.0
 * @phase L1-B: Variant Pre-Resolution
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve as resolvePath } from 'path';
import { load as yamlLoad } from 'js-yaml';
import { readUTF8File, writeUTF8File } from './lib/encoding-utils.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const WORKSPACE_ROOT = resolvePath(import.meta.dir, '..');
const TEMPLATES_DIR = join(WORKSPACE_ROOT, 'templates');
const COMMON_DIR = join(TEMPLATES_DIR, 'common');
const RESOLVED_MARKER = '# @resolved-from:';

const ANSI = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

// ============================================================================
// CLI ARGS
// ============================================================================

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const VARIANT_FILTER = (() => {
  const idx = args.indexOf('--variant');
  return idx !== -1 ? args[idx + 1] : null;
})();

// ============================================================================
// LOGGING
// ============================================================================

function pass(msg: string) { console.log(`${ANSI.green}[PASS]${ANSI.reset} ${msg}`); }
function warn(msg: string) { console.log(`${ANSI.yellow}[WARN]${ANSI.reset} ${msg}`); }
function fail(msg: string) { console.log(`${ANSI.red}[FAIL]${ANSI.reset} ${msg}`); }
function info(msg: string) { console.log(`${ANSI.gray}      ${msg}${ANSI.reset}`); }

// ============================================================================
// FRONTMATTER UTILITIES
// ============================================================================

interface FrontmatterResult {
  frontmatter: Record<string, unknown>;
  body: string;
  raw: string;
}

function parseFrontmatter(content: string): FrontmatterResult {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content, raw: content };
  try {
    const fm = (yamlLoad(match[1]) as Record<string, unknown>) ?? {};
    return { frontmatter: fm, body: match[2], raw: content };
  } catch {
    return { frontmatter: {}, body: content, raw: content };
  }
}

function stringifyFrontmatter(fm: Record<string, unknown>, body: string): string {
  // Use js-yaml dump for clean YAML output
  const { dump } = require('js-yaml') as typeof import('js-yaml');
  const yamlStr = dump(fm, { lineWidth: 120, quotingType: '"', forceQuotes: false }).trimEnd();
  return `---\n${yamlStr}\n---\n${body}`;
}

// ============================================================================
// EXTENDS RESOLUTION
// ============================================================================

/**
 * Resolve a file with `extends:` by merging frontmatter and inheriting body
 * from the skeleton. Variant-specific fields (e.g. `variant:`) override.
 *
 * Returns the fully resolved content string, or null if not an extends file.
 */
function resolveExtendsFile(filePath: string): string | null {
  const content = readUTF8File(filePath);

  // Already resolved — skip unless --force
  if (content.includes(RESOLVED_MARKER) && !FORCE) return null;

  const { frontmatter: variantFm, body: variantBody } = parseFrontmatter(content);

  const extendsPath = variantFm['extends'] as string | undefined;
  if (!extendsPath) return null;

  // Resolve skeleton path relative to this file
  const skeletonAbs = resolvePath(dirname(filePath), extendsPath);
  if (!existsSync(skeletonAbs)) {
    warn(`Skeleton not found: ${extendsPath} (referenced from ${filePath})`);
    return null;
  }

  const skeletonContent = readUTF8File(skeletonAbs);
  const { frontmatter: skeletonFm, body: skeletonBody } = parseFrontmatter(skeletonContent);

  // --- Recursive resolution: skeleton may itself have extends ---
  // For now, resolve one level only (L2 → L1 only, not L2 → L1 → L0)
  // L1's extends: ../../../agents/pm.md is workspace-specific — not propagated
  let resolvedSkeletonFm = { ...skeletonFm };
  let resolvedSkeletonBody = skeletonBody;

  // If skeleton has extends: (L1 → L0), merge L0 into skeleton first
  if (resolvedSkeletonFm['extends']) {
    const l0Path = resolvePath(dirname(skeletonAbs), resolvedSkeletonFm['extends'] as string);
    if (existsSync(l0Path)) {
      const l0Content = readUTF8File(l0Path);
      const { frontmatter: l0Fm, body: l0Body } = parseFrontmatter(l0Content);
      resolvedSkeletonFm = { ...l0Fm, ...resolvedSkeletonFm };
      resolvedSkeletonBody = resolvedSkeletonBody || l0Body;
    }
    delete resolvedSkeletonFm['extends'];
  }

  // Merge: skeleton base + variant overrides (variant wins on conflict)
  const mergedFm: Record<string, unknown> = {
    ...resolvedSkeletonFm,
    ...variantFm,
  };
  // Remove extends: from merged result
  delete mergedFm['extends'];

  // Body: use skeleton body (full content), variant body is usually empty for skeletons
  const resolvedBody = variantBody.trim() ? variantBody : resolvedSkeletonBody;

  // Add @resolved-from comment before the frontmatter
  const resolvedFromComment = `${RESOLVED_MARKER} ${extendsPath}\n`;

  const { dump } = require('js-yaml') as typeof import('js-yaml');
  const yamlStr = dump(mergedFm, { lineWidth: 120 }).trimEnd();
  return `${resolvedFromComment}---\n${yamlStr}\n---\n${resolvedBody}`;
}

// ============================================================================
// VARIANT PROCESSORS
// ============================================================================

/**
 * Process agents/pm.md: resolve extends: skeleton
 */
function processPmMd(variantDir: string, variantName: string): boolean {
  const pmPath = join(variantDir, 'agents', 'pm.md');
  if (!existsSync(pmPath)) {
    warn(`[${variantName}] agents/pm.md not found — skipping`);
    return false;
  }

  const resolved = resolveExtendsFile(pmPath);
  if (resolved === null) {
    // Already resolved or no extends:
    const content = readUTF8File(pmPath);
    if (content.includes(RESOLVED_MARKER)) {
      info(`[${variantName}] agents/pm.md already resolved — skip (use --force to re-resolve)`);
    } else if (!content.includes('extends:')) {
      info(`[${variantName}] agents/pm.md has no extends: — treating as already complete`);
    }
    return false;
  }

  writeUTF8File(pmPath, resolved);
  pass(`[${variantName}] agents/pm.md resolved`);
  return true;
}

/**
 * Process variant.json: fill agents[] and skills[] from actual file scan
 */
function processVariantJson(variantDir: string, variantName: string): boolean {
  const vjPath = join(variantDir, 'variant.json');
  if (!existsSync(vjPath)) return false;

  const vj = JSON.parse(readUTF8File(vjPath)) as Record<string, unknown>;

  // Scan agents/
  const agentsDir = join(variantDir, 'agents');
  const agentList: Array<{ name: string; file: string }> = [];
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir)) {
      if (!f.endsWith('.md') || f.startsWith('README') || f === 'pm.md' || f.includes('handoff')) continue;
      agentList.push({ name: f.replace('.md', ''), file: `agents/${f}` });
    }
  }

  // Scan skills/
  const skillsDir = join(variantDir, 'skills');
  const skillList: Array<{ name: string }> = [];
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) skillList.push({ name: entry.name });
    }
  }

  // Only update if arrays are empty or --force
  const currentAgents = (vj['agents'] as unknown[]) ?? [];
  const currentSkills = (vj['skills'] as unknown[]) ?? [];
  if (!FORCE && currentAgents.length > 0 && currentSkills.length > 0) {
    info(`[${variantName}] variant.json agents/skills already populated — skip`);
    return false;
  }

  vj['agents'] = agentList;
  vj['skills'] = skillList;
  writeUTF8File(vjPath, JSON.stringify(vj, null, 2));
  pass(`[${variantName}] variant.json updated (${agentList.length} agents, ${skillList.length} skills)`);
  return true;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n=== resolve-variants.ts (L1-B Phase) ===\n');
  if (FORCE) console.log(`${ANSI.yellow}--force: re-resolving all files${ANSI.reset}\n`);

  // Discover variants
  if (!existsSync(TEMPLATES_DIR)) {
    fail(`templates/ directory not found at: ${TEMPLATES_DIR}`);
    process.exit(1);
  }

  const variants = readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('co-'))
    .map(e => e.name)
    .filter(name => !VARIANT_FILTER || name === VARIANT_FILTER);

  if (variants.length === 0) {
    warn('No variants found' + (VARIANT_FILTER ? ` matching --variant ${VARIANT_FILTER}` : ''));
    process.exit(0);
  }

  console.log(`Variants: ${variants.join(', ')}\n`);

  let totalResolved = 0;

  for (const variant of variants) {
    const variantDir = join(TEMPLATES_DIR, variant);
    console.log(`\n--- ${variant} ---`);

    let changed = false;
    if (processPmMd(variantDir, variant)) changed = true;
    if (processVariantJson(variantDir, variant)) changed = true;

    if (changed) totalResolved++;
    else info(`[${variant}] nothing to resolve`);
  }

  console.log(`\n=== Done: ${totalResolved}/${variants.length} variants updated ===`);
  if (totalResolved > 0) {
    console.log(`\n${ANSI.green}Run 'bun scripts/audit.ts' to verify resolved files.${ANSI.reset}`);
  }
}

main().catch(err => {
  console.error('\n❌ resolve-variants.ts failed:', err);
  process.exit(1);
});
