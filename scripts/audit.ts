// @version 2.29.1
// v2.28.0: nul-redirect lint no longer scans .bat/.cmd — cmd.exe `>nul` targets the NUL device and
//           is the idiomatic, safe Windows batch redirect; the literal-file hazard is POSIX-only.
// v2.26.0: New checkProjectDocMarkerDrift() (WARN-only, local-only) — detects when a
//           Projects/co-*/CLAUDE.md or GEMINI.md has fewer COMMON-CLAUDE/COMMON-GEMINI managed
//           blocks than templates/common/{CLAUDE,GEMINI}.md, meaning upgrade-project.ts has lost
//           its merge point for that file (happened to co-price/co-abap in 2026-08 when both
//           files were hand-rewritten without preserving the marker comments).
// v2.25.1: (previous)
// v2.25.0: Variant-scanning checks now skip untracked templates/co-* directories so
//           WIP template scaffolds on disk do not block commits. Tracked variant set
//           is computed once via git ls-files at module load.
// v2.21.1: fix(lint+types): stripComment now strips trailing \r before matching — under
//           core.autocrlf checkouts the $ anchors never matched, so the > nul lint flagged
//           its own prose comments (ported from co-abap 2.21.2); validators import switched
//           to a non-literal specifier so variant checkouts type-check (L0-only module)
// v2.15.0: New checkStalePromotedContent() — WARN-only check flagging docs/<variant>.context.md
//   sections that duplicate a same-heading section already present in the common
//   templates/common/docs/context.md. checkVariantContextCommonization() only ever compared
//   variants against EACH OTHER, so a section promoted into the common file (ADR-0050 Part 3)
//   but left behind in one or more variant files went undetected once fewer than 2 variants
//   still carried it — exactly the gap that let co-abap/co-architect/co-consult/co-game's
//   "Git / PR Workflow" duplicates linger unnoticed after the promotion PR (ai-workspace-standards
//   #578/#579) until a manual follow-up review caught them.
// v2.14.1: checkVariantContextCommonization()'s section-parsing extracted to
//   helpers/context-sections.ts (shared with the new promote-context-section.ts) —
//   behavior-preserving refactor, no output change.
// v2.14.0: New checkVariantContextCommonization() — WARN-only cross-variant check flagging
//   docs/<variant>.context.md sections that duplicate the same-heading section in another
//   variant's context.md by >50% overlap (ADR-0050 Part 3, mirrors checkVariantScriptDrift()).
// v2.13.3: docs/context.md missing now FAILs (not just Warns) for L2/L3 projects —
//   previously any project without it was silently assumed to be the workspace root,
//   letting create-l3-scaffold.ts's missing-context.md defect pass audit undetected.
// v2.13.1: Homoglyph check (3.7) now skips docs/adr/ and docs/designs/ — these
//   legitimately use Greek letters as math notation, not homoglyph-attack candidates.
import { $ } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { parsePmMd, extractVariantOverrides } from './helpers/pm-md-parser.ts';
import { sourceShellInjectionPatterns } from './helpers/security-validator.ts';
import { splitIntoSections, getContentLines } from './helpers/context-sections.ts';
import * as url from 'node:url';
import { detectEncoding, detectHomoglyphs, detectZeroWidthChars, readUTF8File } from './lib/encoding-utils.ts';

const _TRACKED_CO_VARIANTS: Set<string> | null = (() => {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--', 'templates/'], { encoding: 'utf-8' }).trim();
    const dirs = new Set<string>();
    if (!out) return dirs;
    for (const line of out.split('\n')) {
      const m = line.match(/^templates\/(co-[^/]+)\//);
      if (m) dirs.add(m[1]);
    }
    return dirs;
  } catch { return null; }
})();

function isCoVariantTracked(name: string): boolean {
  if (!_TRACKED_CO_VARIANTS) return true;
  return _TRACKED_CO_VARIANTS.has(name);
}

// Check for --lifecycle-only flag
const LIFECYCLE_ONLY = process.argv.includes('--lifecycle-only');
const SKIP_MEMORY = process.argv.includes('--skip-memory');
const SPEC_CHECK = process.argv.includes('--spec-check');
const GOVERNANCE_CHECK = process.argv.includes('--governance-check');

// ADR-0055 Stage 2: spec-relevance exemption escape hatch (--spec-exempt=E3[,E5] or SYNC_SPEC_EXEMPT env).
// Valid codes map 1:1 to the AGENTS.md §5.1.1 Design Gate exemption categories.
const SPEC_EXEMPT_CATEGORIES: Record<string, string> = {
  E1: 'memory-log',
  E2: 'changelog',
  E3: 'hotfix-typo',
  E4: 'pure-readme',
  E5: 'sync-only',
};
const specExemptArg = process.argv.find(a => a.startsWith('--spec-exempt='));
const SPEC_EXEMPT_RAW = specExemptArg ? specExemptArg.slice('--spec-exempt='.length) : (process.env.SYNC_SPEC_EXEMPT ?? '');
const SPEC_EXEMPT_CODES = SPEC_EXEMPT_RAW.split(/[,\s]+/).map(c => c.trim()).filter(Boolean);

// Project context path (used in multiple checks)
const projectCtxPath = path.join('docs', 'context.md');

// Color helpers
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let errors = 0;

function Pass(msg: string) {
    console.log(`${GREEN}[PASS] ${msg}${RESET}`);
}
function Fail(msg: string) {
    console.error(`${RED}[FAIL] ${msg}${RESET}`);
    errors++;
}
function Warn(msg: string) {
    console.log(`${YELLOW}[WARN] ${msg}${RESET}`);
}

console.log(`${CYAN}=== audit.ts - workspace standards check ===${RESET}`);
if (LIFECYCLE_ONLY) {
    console.log(`${CYAN}Running lifecycle-only checks (fast pre-commit mode)${RESET}\n`);
}

// 1. CHANGELOG.md must exist
if (fs.existsSync('CHANGELOG.md')) {
    Pass('CHANGELOG.md exists');
} else {
    Fail('CHANGELOG.md missing');
}

// 2. CONSTITUTION.md must be accessible (workspace root / L1 template context only —
//    L2 variant templates and L3 projects intentionally omit CONSTITUTION.md and use
//    docs/context.md instead; variant.json, when present, also marks a generated project copy)
// isWorkspaceRoot is reused below (§6-8) to tell "we ARE the workspace root" apart from
// "we're a scaffolded project that's simply missing its docs/context.md" — the two cases
// look identical if you only check for docs/context.md's absence.
const isWorkspaceRoot = fs.existsSync('CONSTITUTION.md') || fs.existsSync('../CONSTITUTION.md') || fs.existsSync('../../CONSTITUTION.md');
if (isWorkspaceRoot) {
    Pass('CONSTITUTION.md accessible');
} else if (fs.existsSync('docs/context.md') || fs.existsSync('variant.json')) {
    Pass('CONSTITUTION.md check skipped (L2/L3 project — uses docs/context.md)');
} else {
    Fail('CONSTITUTION.md not found (expected at ./, ../, or ../../)');
}

// 2.5. Constitution section files must exist and be non-empty (workspace root only)
if (fs.existsSync('CONSTITUTION.md') && fs.existsSync('docs/constitution')) {
    const content = readUTF8File('CONSTITUTION.md');
    const regex = /docs\/constitution\/([\w.-]+\.md)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const ref = match[1];
        const filePath = path.join('docs', 'constitution', ref);
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
            Pass(`constitution section: ${ref}`);
        } else {
            Fail(`constitution section missing or empty: ${filePath}`);
        }
    }
}

// 2.6. Web URL link validation
if (!LIFECYCLE_ONLY) {
    // Collect all files to scan for web URLs
    const urlCheckFiles: string[] = [];
    if (fs.existsSync('AGENTS.md')) urlCheckFiles.push('AGENTS.md');
    const ctxPath = path.join('templates', 'common', 'docs', 'context.md');
    if (fs.existsSync(ctxPath)) urlCheckFiles.push(ctxPath);

    // Add variant AGENTS.md files (templates/co-*/AGENTS.md)
    const templateDir = path.join('templates');
    if (fs.existsSync(templateDir)) {
        for (const entry of fs.readdirSync(templateDir, { withFileTypes: true })) {
            if (entry.isDirectory() && entry.name.startsWith('co-')) {
                const variantAgents = path.join(templateDir, entry.name, 'AGENTS.md');
                if (fs.existsSync(variantAgents)) urlCheckFiles.push(variantAgents);
            }
        }
    }

    // Add constitution docs (docs/constitution/*.md)
    const constitutionDir = path.join('docs', 'constitution');
    if (fs.existsSync(constitutionDir)) {
        for (const entry of fs.readdirSync(constitutionDir, { withFileTypes: true })) {
            if (!entry.isDirectory() && entry.name.endsWith('.md')) {
                urlCheckFiles.push(path.join(constitutionDir, entry.name));
            }
        }
    }

    if (urlCheckFiles.length > 0) {
        let linkErrors = 0;
        const urlRegex = /https:\/\/raw\.githubusercontent\.com\/5throck\/ai-workspace-standards\/main\/CONSTITUTION\.md#[\w-]+/g;

        for (const filePath of urlCheckFiles) {
            const content = readUTF8File(filePath);
            let match;
            while ((match = urlRegex.exec(content)) !== null) {
                const url = match[0];
                try {
                    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
                    if (!response.ok) throw new Error('Bad status');
                } catch {
                    linkErrors++;
                    errors++;
                    console.log(`${RED}FAIL${RESET} Dead link detected in ${filePath}: ${url}`);
                }
            }
            urlRegex.lastIndex = 0;
        }

        if (linkErrors === 0) {
            Pass('Web URL validation: all external links resolve');
        }
    }
}

// 3. CHANGELOG.md must have [Unreleased] section
if (fs.existsSync('CHANGELOG.md')) {
    const cl = readUTF8File('CHANGELOG.md');
    if (cl.includes('[Unreleased]')) {
        Pass('CHANGELOG.md has [Unreleased] section');
    } else {
        Fail("CHANGELOG.md is missing '[Unreleased]' section");
    }
}

// 3.2. Decision records soft-check (ADR-0061): fires only when docs/decisions/
// exists — adoption is per-project opt-in, never a day-one gate. Validates the
// DEC frontmatter shape (required keys + status vocabulary) and warns, never
// fails, so malformed prose cannot block a pipeline; it just becomes visible.
if (fs.existsSync('docs/decisions') && fs.statSync('docs/decisions').isDirectory()) {
    const decFiles = fs.readdirSync('docs/decisions')
        .filter((f) => /^DEC-\d{8}-\d{2}\.md$/.test(f))
        .sort();
    if (decFiles.length === 0) {
        Warn('Decision records: docs/decisions/ exists but holds no DEC-YYYYMMDD-NN.md files');
    } else {
        let decWarns = 0;
        const REQUIRED_DEC_FIELDS = ['id', 'date', 'agent', 'decision', 'alternatives', 'status'];
        for (const f of decFiles) {
            const relPath = 'docs/decisions/' + f;
            const raw = readUTF8File(relPath);
            const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
            if (!fmMatch) {
                Warn(`Decision record ${f}: no frontmatter block`);
                decWarns++;
                continue;
            }
            // Deliberately regex-based, not yaml.load: audit.ts runs in L2/L3
            // projects where js-yaml may not be installed, and every REQUIRED
            // DEC field is a plain scalar line.
            const fmText = fmMatch[1];
            const scalar = (field: string): string | undefined => {
                const m = new RegExp(`^${field}:\\s*(.*)$`, 'm').exec(fmText);
                const v = m ? m[1].trim() : undefined;
                return v && v !== '' && v !== '<...>' ? v : undefined;
            };
            const fm: Record<string, string | undefined> = {};
            for (const field of REQUIRED_DEC_FIELDS) fm[field] = scalar(field);
            for (const field of REQUIRED_DEC_FIELDS) {
                if (fm[field] === undefined) {
                    Warn(`Decision record ${f}: missing required field '${field}'`);
                    decWarns++;
                }
            }
            if (fm['id'] !== undefined && fm['id'] !== f.replace(/\.md$/, '')) {
                Warn(`Decision record ${f}: frontmatter id does not match filename`);
                decWarns++;
            }
            const status = fm['status'] ?? '';
            if (status && !['proposed', 'accepted', 'superseded'].includes(status)) {
                Warn(`Decision record ${f}: status '${status}' outside proposed|accepted|superseded`);
                decWarns++;
            }
        }
        if (decWarns === 0) {
            Pass(`Decision records: ${decFiles.length} file(s), frontmatter shape valid`);
        }
    }
}


// 3.5. UTF-8 BOM check for Markdown files
if (!LIFECYCLE_ONLY) {
    let bomErrors = 0;
    let searchDirs = ['.'];
    if (!fs.existsSync(projectCtxPath) && fs.existsSync('templates')) {
    searchDirs = ['agents', 'docs', 'memory', 'scripts', 'skills', 'templates', '.claude'];
    if (fs.existsSync('.')) {
        for (const file of fs.readdirSync('.')) {
            if (file.endsWith('.md')) {
                const buf = fs.readFileSync(file);
                if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
                    Fail(`UTF-8 BOM found in ${file} - files must be UTF-8 without BOM`);
                    bomErrors++;
                }
            }
        }
    }
}

function walkDir(dir: string, callback: (fPath: string) => void) {
    if (!fs.existsSync(dir)) return;
    const SKIP_DIRS = new Set(['node_modules', '.git', '.bun', '.temp']);
    for (const f of fs.readdirSync(dir)) {
        if (SKIP_DIRS.has(f)) continue;
        const dirPath = path.join(dir, f);
        if (!fs.existsSync(dirPath)) continue;
        try {
            const isDirectory = fs.statSync(dirPath).isDirectory();
            if (isDirectory) {
                walkDir(dirPath, callback);
            } else {
                callback(dirPath);
            }
        } catch {
            // Ignore transient files deleted during concurrent test runs
        }
    }
}

for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
        walkDir(dir, (filePath) => {
            if (filePath.replace(/\\/g, '/').includes('memory/archive/')) return;
            if (filePath.endsWith('.md') && !filePath.includes('node_modules') && !filePath.includes('.git')) {
                const buf = fs.readFileSync(filePath);
                if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
                    Fail(`UTF-8 BOM found in ${filePath} - files must be UTF-8 without BOM`);
                    bomErrors++;
                }
            }
        });
    }
}
if (bomErrors === 0) { Pass('UTF-8 BOM check: all markdown files are clean'); }
else { errors += bomErrors; }

// 3.6. CRLF line ending check for source files
if (!LIFECYCLE_ONLY) {
    let crlfFound = 0;
    const CRLF_DIRS = ['agents', 'docs', 'memory', 'scripts', 'skills', 'tests'];
    const CRLF_EXTENSIONS = new Set(['.md', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml']);
    const CRLF_SKIP_PREFIXES = ['node_modules/', '.git/', 'templates/', 'memory/archive/'];

    for (const dir of CRLF_DIRS) {
        if (!fs.existsSync(dir)) continue;
        const stat = fs.statSync(dir);
        if (!stat.isDirectory()) continue;

        walkDir(dir, (filePath) => {
            const ext = path.extname(filePath);
            if (!CRLF_EXTENSIONS.has(ext)) return;

            const normalizedPath = filePath.replace(/\\/g, '/');
            if (CRLF_SKIP_PREFIXES.some(p => normalizedPath.includes(p))) return;

            try {
                const detection = detectEncoding(filePath);
                if (detection.lineEndings === 'crlf' || detection.lineEndings === 'mixed') {
                    // WARN during initial rollout — workspace has widespread CRLF on Windows.
                    // Upgrade to FAIL after bulk normalization is complete.
                    Warn(`CRLF/Mixed line endings in ${filePath} — use LF only`);
                    crlfFound++;
                }
            } catch { /* skip unreadable files */ }
        });
    }

    if (crlfFound === 0) {
        Pass('CRLF line ending check: all source files use LF');
    }
}

// 3.7. Homoglyph detection for source files
if (!LIFECYCLE_ONLY) {
    let homoglyphErrors = 0;
    const HOMOGLYPH_DIRS = ['agents', 'docs', 'memory', 'scripts', 'skills', 'tests'];
    const HOMOGLYPH_EXTENSIONS = new Set(['.md', '.ts', '.tsx', '.js', '.jsx']);
    // docs/adr/ and docs/designs/ legitimately use Greek letters (sigma, theta,
    // gamma, etc.) as mathematical notation in architecture/algorithm documentation
    // — not homoglyph-attack candidates. Excluded rather than flagged per-occurrence.
    const HOMOGLYPH_SKIP_PREFIXES = ['node_modules/', '.git/', 'templates/', 'memory/archive/', 'docs/adr/', 'docs/designs/'];

    for (const dir of HOMOGLYPH_DIRS) {
        if (!fs.existsSync(dir)) continue;
        const stat = fs.statSync(dir);
        if (!stat.isDirectory()) continue;

        walkDir(dir, (filePath) => {
            const ext = path.extname(filePath);
            if (!HOMOGLYPH_EXTENSIONS.has(ext)) return;

            const normalizedPath = filePath.replace(/\\/g, '/');
            if (HOMOGLYPH_SKIP_PREFIXES.some(p => normalizedPath.includes(p))) return;

            try {
                const content = readUTF8File(filePath);
                const matches = detectHomoglyphs(content);
                if (matches.length > 0) {
                    // Report first 5 matches per file to avoid spam
                    const shown = matches.slice(0, 5);
                    for (const m of shown) {
                        Fail(`Homoglyph (${m.range}) in ${filePath}:${m.line}:${m.column} — '${m.char}' (${m.codePoint})`);
                    }
                    if (matches.length > 5) {
                        Fail(`... and ${matches.length - 5} more homoglyph(s) in ${filePath}`);
                    }
                    homoglyphErrors += matches.length;
                }
            } catch { /* skip unreadable files */ }
        });
    }

    if (homoglyphErrors === 0) {
        Pass('Homoglyph check: no confusable Unicode characters found');
    }
    errors += homoglyphErrors;
}

// 3.8. Zero-width character detection
if (!LIFECYCLE_ONLY) {
    let zwErrors = 0;
    const ZW_DIRS = ['agents', 'docs', 'memory', 'scripts', 'skills', 'tests'];
    const ZW_EXTENSIONS = new Set(['.md', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml']);
    const ZW_SKIP_PREFIXES = ['node_modules/', '.git/', 'templates/', 'memory/archive/'];

    for (const dir of ZW_DIRS) {
        if (!fs.existsSync(dir)) continue;
        const stat = fs.statSync(dir);
        if (!stat.isDirectory()) continue;

        walkDir(dir, (filePath) => {
            const ext = path.extname(filePath);
            if (!ZW_EXTENSIONS.has(ext)) return;

            const normalizedPath = filePath.replace(/\\/g, '/');
            if (ZW_SKIP_PREFIXES.some(p => normalizedPath.includes(p))) return;

            try {
                const content = readUTF8File(filePath);
                const matches = detectZeroWidthChars(content);
                // U+FEFF (BOM) and U+2060 (word joiner) have legitimate uses in
                // source code (BOM-stripping regexes, code-fence escapes).
                // Report as WARN, not FAIL. All other zero-width chars are FAIL.
                const BENIGN_CODEPOINTS = new Set(['U+FEFF', 'U+2060']);
                if (matches.length > 0) {
                    const shown = matches.slice(0, 5);
                    for (const m of shown) {
                        if (BENIGN_CODEPOINTS.has(m.codePoint)) {
                            Warn(`Zero-width char in ${filePath}:${m.line}:${m.column} — ${m.description} (${m.codePoint})`);
                        } else {
                            Fail(`Zero-width char in ${filePath}:${m.line}:${m.column} — ${m.description} (${m.codePoint})`);
                            zwErrors++;
                        }
                    }
                    if (matches.length > 5) {
                        Fail(`... and ${matches.length - 5} more zero-width char(s) in ${filePath}`);
                        zwErrors += matches.length - 5;
                    }
                }
            } catch { /* skip unreadable files */ }
        });
    }

    if (zwErrors === 0) {
        Pass('Zero-width character check: no invisible Unicode characters found');
    }
    errors += zwErrors;
}
}

// 4. AGENTS.md must exist
if (fs.existsSync('AGENTS.md')) { Pass('AGENTS.md exists'); }
else { Fail('AGENTS.md missing (required for agent-first projects)'); }

// 5. At least one agent file must exist in agents/
if (fs.existsSync('agents') && fs.readdirSync('agents').some(f => f.endsWith('.md'))) {
    Pass('agents/ has agent files');
} else {
    Fail('agents/ is empty or missing - create at least agents/pm.md');
}

// 6-8. Project-level checks
if (!LIFECYCLE_ONLY) {
    if (fs.existsSync(projectCtxPath)) {
    const ctx = readUTF8File(projectCtxPath);
    if (/^## Coding Guidelines/m.test(ctx)) {
        Pass('docs/context.md has ## Coding Guidelines');
    } else {
        Fail("docs/context.md is missing '## Coding Guidelines' section");
    }

    if (fs.existsSync('.env.sample')) {
        Pass('.env.sample exists');
    } else {
        Warn('.env.sample not found - add one if this project uses environment variables');
    }

    // S-02: .sh/.ps1 parity check removed (dead code after ADR-0036 TypeScript migration)

    // S-03: .githooks parity check - Suppressed (Git Bash assumed on Windows)
    // if (fs.existsSync('.githooks')) { ... }


    // Check: no non-standard .md files at project root (file organization policy)
    const STANDARD_ROOT_MD = new Set([
        'README.md', 'README_ko.md', 'CHANGELOG.md', 'AGENTS.md',
        'SECURITY.md', 'CONSTITUTION.md', 'CLAUDE.md', 'GEMINI.md',
        'PROMOTION_CHECKLIST.md', '_ORIGIN.md', '_COMMON_VERSION.md'
    ]);
    const rootMdFiles = fs.readdirSync('.')
        .filter(f => f.endsWith('.md') && !STANDARD_ROOT_MD.has(f));
    if (rootMdFiles.length > 0) {
        Fail(`Non-standard .md files found at project root: ${rootMdFiles.join(', ')} — move to docs/ or memory/ per File Organization Policy`);
    } else {
        Pass('Project root: no non-standard .md files (File Organization Policy compliant)');
    }

    // Check: docs/research/*.md files should have a ## References section (Research Standards)
    const researchDir = path.join('docs', 'research');
    if (fs.existsSync(researchDir)) {
        const researchFiles = fs.readdirSync(researchDir).filter(f => f.endsWith('.md'));
        const missingRefs = researchFiles.filter(f => {
            const content = readUTF8File(path.join(researchDir, f));
            return !content.includes('## References') && !content.includes('## Sources');
        });
        if (missingRefs.length > 0) {
            Warn(`Research files missing ## References section: ${missingRefs.join(', ')} — add citations per Research Standards policy`);
        } else if (researchFiles.length > 0) {
            Pass('docs/research/: all research files have ## References section');
        }
    }
} else if (isWorkspaceRoot) {
    Warn('docs/context.md not found - skipping project-level checks (workspace root)');
} else {
    Fail('docs/context.md missing — every scaffolded L2/L3 project must carry an immutable docs/context.md (SSOT: templates/common/docs/context.md). This usually means the project was created before create-l3-scaffold.ts copied this file (fixed in v1.10.1) — copy templates/common/docs/context.md into docs/context.md to repair it.');
}
}

// S-04: Script modification parity check based on SCRIPTS.md
if (!LIFECYCLE_ONLY && fs.existsSync(path.join('scripts', 'SCRIPTS.md'))) {
    const statusOutput = (await $`git status --porcelain scripts/`.quiet().nothrow()).text();
    const modifiedScripts = new Set<string>();
    for (const line of statusOutput.split('\n')) {
        if (line.length < 4) continue;
        const fileStr = line.substring(3);
        const files = fileStr.split(' -> ');
        const filePath = files[files.length - 1].trim().replace(/^"|"$/g, '');
        if (filePath.startsWith('scripts/')) {
            modifiedScripts.add(filePath.substring(8));
        }
    }

    if (modifiedScripts.size > 0) {
        const scriptsMd = readUTF8File(path.join('scripts', 'SCRIPTS.md'));
        const registryLines = scriptsMd.split('\n').filter(l => l.startsWith('| `'));
        
        let pairErrors = 0;
        for (const line of registryLines) {
            const parts = line.split('|').map(p => p.trim());
            if (parts.length >= 9) {
                const scriptName = parts[1].replace(/`/g, '');
                const pairField = parts[8];
                
                if (modifiedScripts.has(scriptName) && pairField.startsWith('pair: ')) {
                    const pairName = pairField.substring(6).trim();
                    if (!modifiedScripts.has(pairName)) {
                        Fail(`script modification parity: ${scriptName} is modified but its pair ${pairName} is not`);
                        pairErrors++;
                    }
                }
            }
        }
        if (pairErrors === 0) {
            Pass('script modification parity: all paired scripts are modified together');
        }
    }
}

// Skills registry cross-check (nested-layout aware: variants like co-safety group
// skills under category directories — daily/, domains/<axis>/<domain>/, … — that
// carry no SKILL.md themselves. A directory with no direct SKILL.md whose subtree
// contains one is a category directory, not a broken skill.)
function hasSkillMdRecursive(dir: string): boolean {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        if (fs.existsSync(path.join(dir, e.name, 'SKILL.md'))) return true;
        if (hasSkillMdRecursive(path.join(dir, e.name))) return true;
    }
    return false;
}
for (const skillsDir of ['skills', path.join('.claude', 'skills')]) {
    if (fs.existsSync(skillsDir)) {
        for (const dir of fs.readdirSync(skillsDir)) {
            const fullDir = path.join(skillsDir, dir);
            if (fs.statSync(fullDir).isDirectory()) {
                const skillMd = path.join(fullDir, 'SKILL.md');
                if (fs.existsSync(skillMd)) {
                    Pass(`skill exists: ${skillMd}`);
                } else if (dir === '_meta' || hasSkillMdRecursive(fullDir)) {
                    Pass(`skill category/metadata directory: ${fullDir}${path.sep}`);
                } else {
                    Fail(`skill directory missing SKILL.md: ${fullDir}${path.sep}`);
                }
            }
        }
    }
}

// Lifecycle Audits
const hasBun = (await $`bun --version`.quiet().nothrow()).exitCode === 0;
if (hasBun) {
    if (fs.existsSync(path.join('scripts', 'agent-lifecycle-audit.ts'))) {
        const out = await $`bun ${path.join('scripts', 'agent-lifecycle-audit.ts')} --json`.quiet().nothrow();
        if (/"errors":\s*\[\]/.test(out.text())) {
            Pass('Agent audit: all agents healthy');
        } else {
            Fail("Agent audit detected issues (run 'bun scripts/agent-lifecycle-audit.ts' to see details)");
        }
    }
    if (fs.existsSync(path.join('scripts', 'skill-lifecycle-audit.ts'))) {
        const out = await $`bun ${path.join('scripts', 'skill-lifecycle-audit.ts')} --json`.quiet().nothrow();
        if (/"errors":\s*\[\]/.test(out.text())) {
            Pass('Skill audit: all skills healthy');
        } else {
            Fail("Skill audit detected issues (run 'bun scripts/skill-lifecycle-audit.ts' to see details)");
        }
    }
    // Variant registry validators (scripts/validators/ — the framework CONSTITUTION.md §6.6
    // documents as audit-enforced). This wiring is L0-only: `scripts/validators/` is a layer-L0
    // directory and is not propagated to templates/common/scripts/, so the existsSync guard
    // makes the L1 copy of this file skip the check rather than crash.
    // First wired 2026-08-21 — before that the framework was imported by nothing (dead code),
    // which is how `phase: active`/`beta` drift and 6 unparseable SKILL.md frontmatters went
    // unnoticed. Error-severity findings Fail the audit; warnings stay visible as WARN.
    if (fs.existsSync(path.join('scripts', 'validators', 'index.ts')) && fs.existsSync('templates')) {
        // Non-literal specifier: scripts/validators/ is L0-only (never propagated), and a
        // literal specifier is statically resolved by tsc in variant checkouts — TS2307 even
        // though this existsSync guard makes the import unreachable there. Resolved to a
        // file URL so runtime ESM resolution is cwd/module-independent.
        const validatorsUrl = new URL('./validators/index.ts', import.meta.url).href;
        const { runAllValidators } = await import(validatorsUrl);
        let validatorErrors = 0;
        let validatorWarnings = 0;
        for (const variant of fs.readdirSync('templates').filter(d => d.startsWith('co-') && isCoVariantTracked(d))) {
            const variantDir = path.join('templates', variant);
            const vjPath = path.join(variantDir, 'variant.json');
            if (!fs.existsSync(vjPath)) continue;
            let variantJson: Record<string, unknown>;
            try { variantJson = JSON.parse(readUTF8File(vjPath)); } catch { continue; }
            const agentsDir = path.join(variantDir, 'agents');
            const agentFiles = fs.existsSync(agentsDir)
                ? fs.readdirSync(agentsDir).filter(f => f.endsWith('.md') && !f.startsWith('README'))
                : [];
            const rawSkills = (variantJson as { skills?: unknown }).skills ?? [];
            const skillFiles = (rawSkills as unknown[]).map(s => (typeof s === 'string' ? s : (s as { name?: string })?.name ?? ''));
            const results = await runAllValidators({
                variantDir,
                variantType: (variantJson as { variant_type?: string }).variant_type ?? variant,
                variantJson: variantJson as Record<string, any>,
                agentFiles,
                skillFiles,
                policy: null,
            });
            for (const r of results) {
                if (r.skipped) continue;
                for (const issue of r.issues ?? []) {
                    if (issue.severity === 'error') {
                        Fail(`Variant registry validation [${variant}] ${issue.category}: ${issue.message}`);
                        validatorErrors++;
                    } else if (issue.severity === 'warning') {
                        validatorWarnings++;
                    }
                }
            }
        }
        if (validatorErrors === 0) {
            Pass(`Variant registry validation: all variants clean (${validatorWarnings} warning(s) surfaced)`);
        }
    }
    if (fs.existsSync(path.join('scripts', 'verify-scripts.ts'))) {
        const out = await $`bun ${path.join('scripts', 'verify-scripts.ts')} --verify`.quiet().nothrow();
        if (out.exitCode !== 0)
            Fail("Script registry detected issues (run 'bun scripts/verify-scripts.ts --verify' to see details)");
        else
            Pass("Script registry: all scripts verified");
    }
    if (fs.existsSync(path.join('scripts', 'validate-skills.ts'))) {
        const out = await $`bun ${path.join('scripts', 'validate-skills.ts')}`.quiet().nothrow();
        if (out.exitCode !== 0)
            Fail("Skill validation detected issues (run 'bun scripts/validate-skills.ts' to see details)");
        else
            Pass("Skill validation: all skills valid");
    }
    if (fs.existsSync(path.join('scripts', 'validate-agents.ts'))) {
        const out = await $`bun ${path.join('scripts', 'validate-agents.ts')}`.quiet().nothrow();
        if (out.exitCode !== 0)
            Fail("Agent validation detected issues (run 'bun scripts/validate-agents.ts' to see details)");
        else
            Pass("Agent validation: all agents valid");
    }
    if (fs.existsSync(path.join('scripts', 'readme-lifecycle-audit.ts')) && fs.existsSync('templates')) {
        const out = await $`bun ${path.join('scripts', 'readme-lifecycle-audit.ts')} --json`.quiet().nothrow();
        if (out.exitCode !== 0)
            Fail("README lifecycle audit detected issues (run 'bun scripts/readme-lifecycle-audit.ts' to see details)");
        else
            Pass("README lifecycle audit: all READMEs healthy");
    }
    if (fs.existsSync(path.join('scripts', 'verify-memory.ts')) && fs.existsSync('CONSTITUTION.md') && !SKIP_MEMORY) {
        // explicitly skip any files located in memory/archive/
        const memoryFiles = fs.readdirSync('memory')
            .filter(f => f.endsWith('.md') && fs.statSync(path.join('memory', f)).isFile())
            .map(f => path.join('memory', f));

        // We do not pass explicit files to verify-memory.ts to avoid triggering its pre-commit mode (which only checks the last entry),
        // but verify-memory.ts natively only reads files in memory/ directly.
        const out = await $`bun ${path.join('scripts', 'verify-memory.ts')}`.quiet().nothrow();
        if (out.exitCode !== 0)
            Warn("Memory log format issues detected (run 'bun scripts/verify-memory.ts' to see details)");
        else
            Pass("Memory logs: format valid");
    } else if (SKIP_MEMORY) {
        // Skip memory check when --skip-memory flag is provided
        Pass("Memory logs: check skipped (--skip-memory flag)");
    }
    if (fs.existsSync(path.join('scripts', 'lifecycle-sync-audit.ts'))) {
        const out = await $`bun ${path.join('scripts', 'lifecycle-sync-audit.ts')} --json`.quiet().nothrow();
        if (out.exitCode !== 0)
            Fail("Lifecycle sync audit detected issues (run 'bun scripts/lifecycle-sync-audit.ts' to see details)");
        else
            Pass("Lifecycle sync audit: all artifacts in sync");
    }
    // Platform lifecycle verification (Check E/F/G/H)
    if (fs.existsSync(path.join('scripts', 'verify-platform-lifecycle.ts'))) {
        try {
            await $`bun ${path.join('scripts', 'verify-platform-lifecycle.ts')}`.nothrow();
        } catch { /* non-blocking */ }
    }

    // Script lifecycle verification: version headers
    if (fs.existsSync('scripts') && fs.existsSync(path.join('scripts', 'SCRIPTS.md'))) {
        const versionHeaderPass = verifyScriptVersionHeaders();
        if (!versionHeaderPass) {
            errors++;
        }
    }

    // Script lifecycle verification: registry consistency
    if (fs.existsSync('scripts') && fs.existsSync(path.join('scripts', 'SCRIPTS.md'))) {
        const registryConsistencyPass = verifyScriptRegistryConsistency();
        if (!registryConsistencyPass) {
            errors++;
        }
    }
} else {
    Warn('Bun not installed - skipping lifecycle audits');
}

/**
 * Verify that all TypeScript scripts have @version headers
 */
function verifyScriptVersionHeaders(): boolean {
    const scriptsDir = path.join('scripts');
    if (!fs.existsSync(scriptsDir)) {
        return true; // Not applicable
    }

    const scripts = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.ts'));
    for (const script of scripts) {
        const scriptPath = path.join(scriptsDir, script);
        const content = readUTF8File(scriptPath);
        if (!content.match(/@version\s+\d+\.\d+\.\d+/)) {
            Fail(`Missing @version header in ${script}`);
            return false;
        }
    }
    Pass('All scripts have version headers');
    return true;
}

/**
 * Verify that SCRIPTS.md matches actual script versions
 */
function verifyScriptRegistryConsistency(): boolean {
    const scriptsDir = path.join('scripts');
    const scriptsMdPath = path.join(scriptsDir, 'SCRIPTS.md');

    if (!fs.existsSync(scriptsMdPath)) {
        return true; // Not applicable
    }

    const scripts = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.ts') && !f.startsWith('test-'));
    const scriptsMdContent = readUTF8File(scriptsMdPath);

    for (const script of scripts) {
        const scriptPath = path.join(scriptsDir, script);
        const scriptContent = readUTF8File(scriptPath);
        const versionMatch = scriptContent.match(/@version\s+(\d+\.\d+\.\d+)/);

        if (!versionMatch) {
            Fail(`${script} has no version`);
            return false;
        }

        const version = versionMatch[1];
        const scriptName = path.basename(script);

        // Check if script is mentioned in SCRIPTS.md
        if (!scriptsMdContent.includes(scriptName)) {
            Fail(`${scriptName} not found in SCRIPTS.md`);
            return false;
        }

        // Check if version is mentioned in SCRIPTS.md
        if (!scriptsMdContent.includes(version)) {
            Fail(`${scriptName} @${version} not found in SCRIPTS.md`);
            return false;
        }
    }
    Pass('SCRIPTS.md consistency verified');
    return true;
}

// 3.7. Language validation: Korean-only markdown files outside ko/ and locales/ko/
if (!LIFECYCLE_ONLY) {
    console.log(""); // Add spacing before language validation output
    const langValidate = await $`bun ${path.join('scripts', 'validate-md-language.ts')}`.nothrow();
if (langValidate.exitCode === 0) {
    Pass('Language validation: no Korean-only markdown files found');
} else {
    Fail('Language validation: Korean-only markdown files detected');
    errors++;
}
}

// Agent/Skill State Synchronization Check
if (!LIFECYCLE_ONLY && fs.existsSync('AGENTS.md') && fs.existsSync('agents')) {
    let syncErrors = 0;
    const agentsContent = readUTF8File('AGENTS.md');

    for (const file of fs.readdirSync('agents')) {
        if (!file.endsWith('.md')) continue;
        const agentFile = path.join('agents', file);
        const agentName = path.basename(file, '.md');
        const content = readUTF8File(agentFile);
        
        const statusMatch = /^status:\s*(.+)$/m.exec(content);
        if (statusMatch) {
            const fileStatus = statusMatch[1].trim();
            const agentsRegex = new RegExp(`\`${agentName}\\.md\`[\\s\\S]*?status:\\s*(\\w+)`);
            const agentsMatch = agentsRegex.exec(agentsContent);
            if (agentsMatch) {
                const agentsMdStatus = agentsMatch[1].trim();
                if (fileStatus !== agentsMdStatus) {
                    Fail(`Agent state mismatch: ${agentName} (file=${fileStatus}, AGENTS.md=${agentsMdStatus})`);
                    syncErrors++;
                }
            }
        }
    }
    
    if (syncErrors === 0) {
        Pass('Agent state synchronization: all agents in sync');
    } else {
        errors += syncErrors;
    }
}

// Cross-Platform Command Parity Check
const claudeCommandsDir = path.join('.claude', 'commands');
if (!LIFECYCLE_ONLY && fs.existsSync(claudeCommandsDir)) {
    let parityWarnings = 0;
    for (const file of fs.readdirSync(claudeCommandsDir)) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(claudeCommandsDir, file);
        const content = readUTF8File(filePath);
        if (/^gemini-parity:\s*skip/m.test(content)) continue;
        
        const geminiCmd = path.join('.gemini', 'commands', file);
        if (!fs.existsSync(geminiCmd)) {
            Warn(`Command parity gap: .claude/commands/${file} has no matching .gemini/commands/${file} (add 'gemini-parity: skip' to frontmatter for intentional Claude-only commands)`);
            parityWarnings++;
        }
    }
    if (parityWarnings === 0) {
        Pass('Command parity: all .claude/commands/ files have matching .gemini/commands/ files');
    }
}

// L2 variant structural integrity check
function checkL2VariantIntegrity() {
  const templatesDir = 'templates';
  if (!fs.existsSync(templatesDir)) return;

  const variants = fs.readdirSync(templatesDir)
    .filter(d => d.startsWith('co-') && fs.statSync(path.join(templatesDir, d)).isDirectory() && isCoVariantTracked(d));

  if (variants.length === 0) return;

  // Required files every L2 variant must have
  const requiredFiles = [
    'AGENTS.md',
    'README.md',
    'variant.json',
    'agents',          // directory
    '.claude/settings.json',
    '.gemini/settings.json',
  ];

  let missingCount = 0;
  for (const variant of variants) {
    const variantDir = path.join(templatesDir, variant);
    for (const required of requiredFiles) {
      const fullPath = path.join(variantDir, required);
      if (!fs.existsSync(fullPath)) {
        Warn(`L2 integrity: templates/${variant}/${required} is missing`);
        missingCount++;
      }
    }

    const pmMdPath = path.join(variantDir, 'agents', 'pm.md');
    if (fs.existsSync(pmMdPath)) {
      const pmContent = readUTF8File(pmMdPath);
      const hasVariantOverrides = pmContent.includes('variant_overrides:');
      const hasExtendsPattern = pmContent.includes('extends:');
      const isResolved = pmContent.startsWith('# @resolved-from:');
      if (!hasVariantOverrides && !hasExtendsPattern && !isResolved && !pmContent.includes('<!-- VARIANT-SECTION: governance-workflow -->')) {
        Fail(`L2 integrity: templates/${variant}/agents/pm.md is missing '<!-- VARIANT-SECTION: governance-workflow -->' block`);
        missingCount++;
      }
      const lineCount = pmContent.split('\n').length;
      if (lineCount >= 200) {
        Fail(`L2 integrity: templates/${variant}/agents/pm.md has ${lineCount} lines (must be < 200 to prevent L0 duplication bug)`);
        missingCount++;
      }
    }
  }

  if (missingCount === 0) {
    Pass(`L2 variant integrity: all ${variants.length} variants have required structure`);
  }
}

// Check: Variant context.md guidelines section
function checkVariantContextGuidelinesSection() {
  const templatesDir = 'templates';
  if (!fs.existsSync(templatesDir)) return;

  const variants = fs.readdirSync(templatesDir)
    .filter(d => d.startsWith('co-') && fs.statSync(path.join(templatesDir, d)).isDirectory() && isCoVariantTracked(d));

  if (variants.length === 0) return;

  const missing: string[] = [];
  for (const variant of variants) {
    const docsDir = path.join(templatesDir, variant, 'docs');
    if (!fs.existsSync(docsDir)) continue;
    for (const file of fs.readdirSync(docsDir)) {
      if (!file.endsWith('.context.md')) continue;
      const filePath = path.join(docsDir, file);
      const content = readUTF8File(filePath);
      if (!content.includes('VARIANT-INJECT: guidelines [REQUIRED]')) {
        missing.push(`templates/${variant}/docs/${file}`);
      }
    }
  }

  if (missing.length === 0) {
    const total = variants.reduce((count, variant) => {
      const docsDir = path.join(templatesDir, variant, 'docs');
      if (!fs.existsSync(docsDir)) return count;
      return count + fs.readdirSync(docsDir).filter(f => f.endsWith('.context.md')).length;
    }, 0);
    Pass(`Variant guidelines section: all ${total} variant context.md files have VARIANT-INJECT: guidelines [REQUIRED]`);
  } else {
    Fail(`Variant guidelines section: missing VARIANT-INJECT: guidelines [REQUIRED] in:\n${missing.map(f => `  - ${f}`).join('\n')}`);
  }
}

// Check: Variant specialist agent files have all 7 required Layer 1 sections
function checkVariantAgentSections() {
  const REQUIRED_SECTIONS = [
    '## Role',
    '## ⚠️ PM-ONLY INVOCATION',
    '## Responsibilities',
    '## Output Format',
    '## Constraints',
    '## Meeting Participation',
    '## Dispatch Protocol',
  ];

  const templatesDir = 'templates';
  if (!fs.existsSync(templatesDir)) return;

  const variants = fs.readdirSync(templatesDir)
    .filter(d => d.startsWith('co-') && fs.statSync(path.join(templatesDir, d)).isDirectory() && isCoVariantTracked(d));

  if (variants.length === 0) return;

  const failures: string[] = [];
  for (const variant of variants) {
    const agentsDir = path.join(templatesDir, variant, 'agents');
    if (!fs.existsSync(agentsDir)) continue;
    const agentFiles = fs.readdirSync(agentsDir)
      .filter(f => f.endsWith('.md') && f !== 'pm.md' && !f.startsWith('_') && !f.startsWith('README'));
    for (const file of agentFiles) {
      const filePath = path.join(agentsDir, file);
      const content = readUTF8File(filePath);
      const missing = REQUIRED_SECTIONS.filter(s => !content.includes(s));
      if (missing.length > 0) {
        failures.push(`templates/${variant}/agents/${file}: missing ${missing.map(s => `"${s}"`).join(', ')}`);
      }
    }
  }

  if (failures.length === 0) {
    Pass('Variant agent sections: all specialist agents have required Layer 1 sections');
  } else {
    // Warn (not Fail) until all variants complete migration to canonical agent structure
    failures.forEach(f => Warn(`Variant agent sections: ${f}`));
  }
}

// Check: Variant skill SKILL.md files have all 5 required sections and 7 required frontmatter fields
function checkVariantSkillSections() {
  const REQUIRED_SECTIONS = [
    '## Context',
    '## When to Use',
    '## Execution Steps',
    '## Output Format',
    '## Related Skills',
  ];
  const REQUIRED_FRONTMATTER = ['name', 'description', 'version', 'status', 'owner', 'last_reviewed', 'prerequisites'];

  const templatesDir = 'templates';
  if (!fs.existsSync(templatesDir)) return;

  const variants = fs.readdirSync(templatesDir)
    .filter(d => d.startsWith('co-') && fs.statSync(path.join(templatesDir, d)).isDirectory() && isCoVariantTracked(d));

  if (variants.length === 0) return;

  const sectionFailures: string[] = [];
  const frontmatterFailures: string[] = [];

  for (const variant of variants) {
    const skillsDir = path.join(templatesDir, variant, 'skills');
    if (!fs.existsSync(skillsDir)) continue;
    const slugs = fs.readdirSync(skillsDir)
      .filter(d => fs.statSync(path.join(skillsDir, d)).isDirectory());
    for (const slug of slugs) {
      const skillPath = path.join(skillsDir, slug, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;
      const content = readUTF8File(skillPath);

      // Skip files marked with audit_exception (e.g., PM reference cards that use a different structure)
      if (/^audit_exception:/m.test(content)) continue;

      const missingSections = REQUIRED_SECTIONS.filter(s => !content.includes(s));
      if (missingSections.length > 0) {
        sectionFailures.push(`templates/${variant}/skills/${slug}/SKILL.md: missing ${missingSections.map(s => `"${s}"`).join(', ')}`);
      }

      const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
      if (fmMatch) {
        const fm = fmMatch[1];
        const missingFields = REQUIRED_FRONTMATTER.filter(f => !new RegExp(`^${f}:`, 'm').test(fm));
        if (missingFields.length > 0) {
          frontmatterFailures.push(`templates/${variant}/skills/${slug}/SKILL.md: missing frontmatter fields: ${missingFields.join(', ')}`);
        }
      } else {
        frontmatterFailures.push(`templates/${variant}/skills/${slug}/SKILL.md: no YAML frontmatter found`);
      }
    }
  }

  const allFailures = [...sectionFailures, ...frontmatterFailures];
  if (allFailures.length === 0) {
    Pass('Variant skill sections: all skills have required sections and frontmatter');
  } else {
    allFailures.forEach(f => Fail(`Variant skill sections: ${f}`));
    errors += allFailures.length;
  }
}

// Variant JSON schema validation
function checkVariantJsonSchema() {
  const schemaPath = path.join('docs', 'templates', 'variant.schema.json');
  const templatesDir = 'templates';
  if (!fs.existsSync(schemaPath) || !fs.existsSync(templatesDir)) return;

  const variants = fs.readdirSync(templatesDir)
    .filter(d => d.startsWith('co-') && fs.statSync(path.join(templatesDir, d)).isDirectory() && isCoVariantTracked(d));

  if (variants.length === 0) return;

  let schemaWarnings = 0;
  for (const variant of variants) {
    const variantJsonPath = path.join(templatesDir, variant, 'variant.json');
    if (!fs.existsSync(variantJsonPath)) continue;

    try {
      const content = readUTF8File(variantJsonPath);
      const variantData = JSON.parse(content);

      // Validate required fields per variant.schema.json
      const required = ['name', 'description', 'status', 'version', 'lifecycle'];
      const missing = required.filter(f => !(f in variantData));
      if (missing.length > 0) {
        Warn(`Variant schema: templates/${variant}/variant.json missing required field(s): ${missing.join(', ')}`);
        schemaWarnings++;
      }

      // Validate name pattern: ^co-[a-z]+$
      if (variantData.name && !/^co-[a-z]+$/.test(variantData.name)) {
        Warn(`Variant schema: templates/${variant}/variant.json name "${variantData.name}" does not match pattern ^co-[a-z]+$`);
        schemaWarnings++;
      }

      // Validate status enum
      const validStatuses = ['draft', 'beta', 'stable', 'deprecated'];
      if (variantData.status && !validStatuses.includes(variantData.status)) {
        Warn(`Variant schema: templates/${variant}/variant.json has invalid status "${variantData.status}" (expected: ${validStatuses.join(', ')})`);
        schemaWarnings++;
      }

      // Validate version semver pattern
      if (variantData.version && !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(variantData.version)) {
        Warn(`Variant schema: templates/${variant}/variant.json version "${variantData.version}" does not match semver pattern MAJOR.MINOR.PATCH`);
        schemaWarnings++;
      }

      // Validate lifecycle required fields
      if (variantData.lifecycle) {
        const lcRequired = ['statusSince', 'lastTransition'];
        const lcMissing = lcRequired.filter(f => !(f in variantData.lifecycle));
        if (lcMissing.length > 0) {
          Warn(`Variant schema: templates/${variant}/variant.json lifecycle missing required field(s): ${lcMissing.join(', ')}`);
          schemaWarnings++;
        }
      }

      // Conditional: beta requires betaEngagements
      if (variantData.status === 'beta' && variantData.lifecycle && !('betaEngagements' in variantData.lifecycle)) {
        Warn(`Variant schema: templates/${variant}/variant.json status=beta but lifecycle.betaEngagements is missing`);
        schemaWarnings++;
      }

      // Conditional: stable requires stablePromotedOn
      if (variantData.status === 'stable' && variantData.lifecycle && !('stablePromotedOn' in variantData.lifecycle)) {
        Warn(`Variant schema: templates/${variant}/variant.json status=stable but lifecycle.stablePromotedOn is missing`);
        schemaWarnings++;
      }

      // Conditional: deprecated requires deprecatedOn
      if (variantData.status === 'deprecated' && variantData.lifecycle && !('deprecatedOn' in variantData.lifecycle)) {
        Warn(`Variant schema: templates/${variant}/variant.json status=deprecated but lifecycle.deprecatedOn is missing`);
        schemaWarnings++;
      }

      // skills[].file convention check
      if (Array.isArray(variantData.skills)) {
        for (const skill of variantData.skills) {
          if (skill.name && !skill.file) {
            Warn(`Variant schema: templates/${variant}/variant.json skills[] entry "${skill.name}" missing "file" field (expected: "skills/${skill.name}/SKILL.md")`);
            schemaWarnings++;
          }
        }
      }
    } catch (e: any) {
      Warn(`Variant schema: templates/${variant}/variant.json parse error: ${e.message}`);
      schemaWarnings++;
    }
  }

  if (schemaWarnings === 0) {
    Pass(`Variant JSON schema: all ${variants.length} variant.json files validated`);
  }
}

// Template dependency mirror check
function checkTemplateDependencyMirror() {
  const rootPkgPath = path.join('package.json');
  const templatePkgPath = path.join('templates', 'common', 'package.json');

  // Skip if template package.json doesn't exist (L1/L3 context)
  if (!fs.existsSync(templatePkgPath)) {
    return;
  }

  // Parse both package.json files
  let rootPkg: any;
  let templatePkg: any;
  try {
    rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
    templatePkg = JSON.parse(fs.readFileSync(templatePkgPath, 'utf-8'));
  } catch (e: any) {
    Fail(`Template dependency mirror: failed to parse package.json files — ${e.message}`);
    return;
  }

  const sections: Array<'dependencies' | 'devDependencies'> = ['dependencies', 'devDependencies'];
  let driftFound = false;

  for (const section of sections) {
    const rootSection = rootPkg[section] || {};
    const templateSection = templatePkg[section] || {};

    // Check shared keys for drift
    for (const key of Object.keys(templateSection)) {
      if (key in rootSection) {
        const rootVersion = rootSection[key];
        const templateVersion = templateSection[key];

        if (rootVersion !== templateVersion) {
          Fail(`Template dep drift: templates/common/package.json ${section}.${key} "${templateVersion}" != root "${rootVersion}" — fix: bun scripts/sync-template-deps.ts --apply`);
          driftFound = true;
        }
      }
    }
  }

  // Check engines drift
  if (rootPkg.engines && templatePkg.engines) {
    for (const field of Object.keys(rootPkg.engines)) {
      if (field in templatePkg.engines && templatePkg.engines[field] !== rootPkg.engines[field]) {
        Fail(`Template dep drift: templates/common/package.json engines.${field} "${templatePkg.engines[field]}" != root "${rootPkg.engines[field]}" — fix: bun scripts/sync-template-deps.ts --apply`);
        driftFound = true;
      }
    }
  }

  if (!driftFound) {
    Pass('template dependency mirror: shared dep versions match root package.json');
  }
}

// Stale shell/script reference check
if (!LIFECYCLE_ONLY) {
function checkStaleShellReferences() {
    const filesToScan: string[] = [
        'CLAUDE.md',
        'README.md',
        'AGENTS.md',
        'GEMINI.md',
        'docs/constitution/09-operations-workflow.md',
        '.githooks/pre-push',
        '.githooks/commit-msg',
    ];

    // Add any .md files in docs/governance/
    const govDir = path.join('docs', 'governance');
    if (fs.existsSync(govDir)) {
        for (const f of fs.readdirSync(govDir)) {
            if (f.endsWith('.md')) filesToScan.push(path.join(govDir, f));
        }
    }

    // Add any SKILL.md files in skills/*/
    if (fs.existsSync('skills')) {
        for (const dir of fs.readdirSync('skills')) {
            const skillMd = path.join('skills', dir, 'SKILL.md');
            if (fs.existsSync(skillMd)) filesToScan.push(skillMd);
        }
    }

    let staleErrors = 0;
    for (const filePath of filesToScan) {
        if (!fs.existsSync(filePath)) continue;
        const content = readUTF8File(filePath);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            // Skip lines that are documentation examples (e.g. anti-pattern tables with backtick-quoted examples)
            // A line is an example if the pattern only appears inside backticks
            const strippedLine = line.replace(/`[^`]*`/g, '');
            const re = /(?:bash|node)\s+scripts\/([\w.-]+\.(sh|ps1|ts))/g;
            let match: RegExpExecArray | null;
            while ((match = re.exec(strippedLine)) !== null) {
                const refFile = match[1];
                const refExt = match[2];
                // For .ts files, only flag when invoked with 'node' (bun is fine)
                const runner = match[0].split(' ')[0];
                if (refExt === 'ts' && runner !== 'node') continue;
                const scriptPath = path.join('scripts', refFile);
                if (!fs.existsSync(scriptPath)) {
                    Fail(`Stale shell reference: ${filePath}:${idx + 1} references non-existent scripts/${refFile}`);
                    staleErrors++;
                }
            }
        });
    }

    if (staleErrors === 0) {
        Pass('Stale shell reference check: no stale references found');
    }
}
checkStaleShellReferences();

// Shell-injection-shaped source scan (WARN-only, first-pass heuristic).
// See docs/designs/2026-08-16-august-regression-coverage-design.md for full
// FAIL-vs-WARN reasoning and pattern-calibration notes. TODO: revisit
// promoting this to Fail() once the false-positive rate is empirically known
// after a full audit cycle.
function checkShellInjectionPatterns() {
    // Self-contained recursive directory walk (the module-level `walkDir` is
    // block-scoped to an earlier `if (!LIFECYCLE_ONLY)` block and is not
    // visible here).
    function walkScanDir(dir: string, callback: (fPath: string) => void) {
        if (!fs.existsSync(dir)) return;
        const SKIP_DIRS = new Set(['node_modules', '.git', '.bun', '.temp']);
        for (const f of fs.readdirSync(dir)) {
            if (SKIP_DIRS.has(f)) continue;
            const dirPath = path.join(dir, f);
            if (!fs.existsSync(dirPath)) continue;
            try {
                const isDirectory = fs.statSync(dirPath).isDirectory();
                if (isDirectory) {
                    walkScanDir(dirPath, callback);
                } else {
                    callback(dirPath);
                }
            } catch {
                // Ignore transient files deleted during concurrent test runs
            }
        }
    }

    const scanRoots = ['scripts'];
    if (fs.existsSync('templates')) {
        for (const variant of fs.readdirSync('templates')) {
            if (!variant.startsWith('co-') || !isCoVariantTracked(variant)) continue;
            const variantScriptsDir = path.join('templates', variant, 'scripts');
            if (fs.existsSync(variantScriptsDir)) scanRoots.push(variantScriptsDir);
        }
    }

    let warnCount = 0;
    for (const root of scanRoots) {
        if (!fs.existsSync(root)) continue;
        walkScanDir(root, (filePath) => {
            if (filePath.includes('node_modules')) return;
            const normalized = filePath.replace(/\\/g, '/');
            if (!normalized.endsWith('.ts')) return;
            if (normalized.endsWith('.test.ts') || normalized.endsWith('.d.ts')) return;

            let content: string;
            try {
                content = readUTF8File(filePath);
            } catch {
                return;
            }

            for (const sourcePattern of sourceShellInjectionPatterns) {
                sourcePattern.pattern.lastIndex = 0;
                const matches = content.matchAll(sourcePattern.pattern);
                for (const foundMatch of matches) {
                    const matchIndex = foundMatch.index ?? 0;
                    const upToMatch = content.slice(0, matchIndex);
                    const lineNo = upToMatch.split('\n').length;
                    const remediationText = sourcePattern.remediation;
                    const patternLabel = sourcePattern.name;
                    Warn(`Shell injection pattern: ${filePath}:${lineNo} matched "${patternLabel}" - ${remediationText}`);
                    warnCount++;
                }
            }
        });
    }

    if (warnCount === 0) {
        Pass('Shell injection pattern scan: no matches found');
    } else {
        Warn(`Shell injection pattern scan: ${warnCount} match(es) found (WARN-only, first-pass heuristic)`);
    }
}
checkShellInjectionPatterns();

// Design-lint gate (blocking): token SSOT compliance for UI source directories.
// Scope/escape-hatch are schema-driven (docs/workspace-schema.json `designLint`:
// { enabled, scanRoots, allowlist }) so variants/projects without UI sources or
// with grandfathered literals are not false-failed. Runs the promoted L0+L1
// scripts/design-lint.ts (token-usage-lint skill companion). Blocking per the
// 2026-09-06 unified plan decision; see
// docs/designs/2026-09-06-universal-design-extension-design.md §3.
function checkDesignLint() {
    const lintScript = path.join('scripts', 'design-lint.ts');
    if (!fs.existsSync(lintScript)) {
        Pass('Design-lint gate: scripts/design-lint.ts not present — skipped');
        return;
    }
    const schemaPath = path.join('docs', 'workspace-schema.json');
    let config: { enabled?: boolean; scanRoots?: string[] } = {};
    if (fs.existsSync(schemaPath)) {
        try {
            config = JSON.parse(readUTF8File(schemaPath) || '{}')?.designLint ?? {};
        } catch { /* schema unreadable — treat as disabled below */ }
    }

    if (config.enabled !== true) {
        Pass('Design-lint gate: disabled (workspace-schema.json designLint.enabled) — skipped');
        return;
    }
    const roots = (config.scanRoots ?? []).filter((r) => fs.existsSync(r));
    if (roots.length === 0) {
        Pass('Design-lint gate: no configured scan roots present — skipped');
        return;
    }
    const result = spawnSync('bun', [lintScript, '--dir', ...roots], { encoding: 'utf-8' });
    if (result.status === 0) {
        Pass(`Design-lint gate: token SSOT compliance CLEAN across ${roots.length} scan root(s)`);
    } else {
        Fail(`Design-lint gate: should-be-token finding(s) in UI source — run: bun scripts/design-lint.ts --dir ${roots.join(' --dir ')} (exempt literals with a "design-token-exempt: <reason>" comment or list them in workspace-schema.json designLint)`);
    }
}
checkDesignLint();

// Variant script drift detection (WARN-only, first-pass heuristic).
// Flags templates/co-*/scripts files that duplicate templates/common/scripts files by >50% content overlap.
// See docs/designs/2026-08-16-august-regression-coverage-design.md §2 for design, rationale, and denominator choice.
function checkVariantScriptDrift() {
    // Build a map of basename -> full path for all templates/common/scripts/**/*.ts
    const commonScriptMap = new Map<string, string>();

    function populateCommonMap() {
        const commonDir = path.join('templates', 'common', 'scripts');
        if (!fs.existsSync(commonDir)) return;

        function walkDir(dir: string) {
            for (const entry of fs.readdirSync(dir)) {
                const fullPath = path.join(dir, entry);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        walkDir(fullPath);
                    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
                        const basename = path.basename(fullPath);
                        // Store the first occurrence; later ones are ignored (unlikely in practice)
                        if (!commonScriptMap.has(basename)) {
                            commonScriptMap.set(basename, fullPath);
                        }
                    }
                } catch {
                    // Ignore transient files
                }
            }
        }
        walkDir(commonDir);
    }

    populateCommonMap();

    // Helper: extract non-blank, non-comment-only trimmed lines
    function getContentLines(content: string): Set<string> {
        const lines = new Set<string>();
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            // Skip blank lines and comment-only lines
            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
                lines.add(trimmed);
            }
        }
        return lines;
    }

    // Helper: compute line-overlap similarity using |intersection| / min(|A|,|B|)
    function computeSimilarity(contentA: string, contentB: string): number {
        const linesA = getContentLines(contentA);
        const linesB = getContentLines(contentB);

        if (linesA.size === 0 || linesB.size === 0) return 0;

        // Compute intersection
        let intersection = 0;
        for (const line of linesA) {
            if (linesB.has(line)) intersection++;
        }

        // Denominator: min(|A|, |B|) to catch copy-paste-then-extend patterns
        const denominator = Math.min(linesA.size, linesB.size);
        return denominator > 0 ? intersection / denominator : 0;
    }

    // Scan templates/co-*/scripts/**/*.ts
    let warnCount = 0;
    const templatesDir = path.join('templates');
    if (fs.existsSync(templatesDir)) {
        for (const variant of fs.readdirSync(templatesDir)) {
            if (!variant.startsWith('co-') || !isCoVariantTracked(variant)) continue;
            const variantScriptsDir = path.join(templatesDir, variant, 'scripts');
            if (!fs.existsSync(variantScriptsDir)) continue;

            function walkVariantScripts(dir: string) {
                for (const entry of fs.readdirSync(dir)) {
                    const fullPath = path.join(dir, entry);
                    try {
                        const stat = fs.statSync(fullPath);
                        if (stat.isDirectory()) {
                            walkVariantScripts(fullPath);
                        } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')) {
                            const basename = path.basename(fullPath);
                            const commonPath = commonScriptMap.get(basename);
                            if (commonPath) {
                                let variantContent: string;
                                let commonContent: string;
                                try {
                                    variantContent = readUTF8File(fullPath);
                                    commonContent = readUTF8File(commonPath);
                                } catch {
                                    return;
                                }

                                const similarity = computeSimilarity(commonContent, variantContent);
                                if (similarity > 0.50) {
                                    const percent = (similarity * 100).toFixed(1);
                                    const remediationNote = 'ADR-0050 Part 1: variant-local scripts must not duplicate common/ logic; compose/call common instead.';
                                    Warn(`Script drift detected: ${fullPath} (${percent}% similar to ${commonPath}) - ${remediationNote}`);
                                    warnCount++;
                                }
                            }
                        }
                    } catch {
                        // Ignore transient files
                    }
                }
            }
            walkVariantScripts(variantScriptsDir);
        }
    }

    if (warnCount === 0) {
        Pass('Variant script drift check: no high-similarity duplicates found');
    } else {
        Warn(`Variant script drift check: ${warnCount} match(es) found (WARN-only, first-pass heuristic)`);
    }
}
checkVariantScriptDrift();

// Project CLAUDE.md / GEMINI.md managed-block drift detection (WARN-only, local-only).
// upgrade-project.ts syncs the COMMON-CLAUDE:START/END and COMMON-GEMINI:START/END managed
// blocks in each project's CLAUDE.md / GEMINI.md against templates/common/{CLAUDE,GEMINI}.md.
// If a project's file is ever hand-rewritten without preserving those markers (as happened to
// co-price and co-abap in 2026-08), upgrade-project.ts silently loses its merge point and the
// file drifts out of sync forever after. Projects/ is gitignored and not present in CI, so this
// only runs against whatever `Projects/co-*` checkouts exist on the local machine.
function checkProjectDocMarkerDrift() {
    const projectsDir = 'Projects';
    if (!fs.existsSync(projectsDir)) {
        Pass('Project CLAUDE.md/GEMINI.md marker drift check: Projects/ not present locally, skipped');
        return;
    }

    function countMarkers(filePath: string, markerLabel: string): number {
        if (!fs.existsSync(filePath)) return -1; // file absent, not a drift signal
        try {
            const content = readUTF8File(filePath);
            const matches = content.match(new RegExp(`<!-- ${markerLabel}:START -->`, 'g'));
            return matches ? matches.length : 0;
        } catch {
            return -1;
        }
    }

    const expectedClaude = countMarkers(path.join('templates', 'common', 'CLAUDE.md'), 'COMMON-CLAUDE');
    const expectedGemini = countMarkers(path.join('templates', 'common', 'GEMINI.md'), 'COMMON-GEMINI');

    let warnCount = 0;
    for (const entry of fs.readdirSync(projectsDir)) {
        if (!entry.startsWith('co-')) continue;
        const projectDir = path.join(projectsDir, entry);
        if (!fs.statSync(projectDir).isDirectory()) continue;

        if (expectedClaude > 0) {
            const actual = countMarkers(path.join(projectDir, 'CLAUDE.md'), 'COMMON-CLAUDE');
            if (actual >= 0 && actual < expectedClaude) {
                Warn(`CLAUDE.md drift: Projects/${entry}/CLAUDE.md has ${actual}/${expectedClaude} COMMON-CLAUDE managed blocks vs templates/common/CLAUDE.md — run 'bun scripts/upgrade-project.ts Projects/${entry}' or verify markers were not stripped by a hand rewrite.`);
                warnCount++;
            }
        }
        if (expectedGemini > 0) {
            const actual = countMarkers(path.join(projectDir, 'GEMINI.md'), 'COMMON-GEMINI');
            if (actual >= 0 && actual < expectedGemini) {
                Warn(`GEMINI.md drift: Projects/${entry}/GEMINI.md has ${actual}/${expectedGemini} COMMON-GEMINI managed blocks vs templates/common/GEMINI.md — run 'bun scripts/upgrade-project.ts Projects/${entry}' or verify markers were not stripped by a hand rewrite.`);
                warnCount++;
            }
        }
    }

    if (warnCount === 0) {
        Pass('Project CLAUDE.md/GEMINI.md marker drift check: no drift found');
    } else {
        Warn(`Project CLAUDE.md/GEMINI.md marker drift check: ${warnCount} project file(s) drifted from the template baseline`);
    }
}
checkProjectDocMarkerDrift();

// Cross-variant context commonization check (WARN-only, first-pass heuristic).
// Flags docs/<variant>.context.md sections that duplicate the SAME-heading section in
// another variant's context.md by >50% content overlap — a candidate for promotion into
// the shared docs/context.md (ADR-0050 Part 3), or extraction into a shared skill if only
// a subset of variants need it. Mirrors checkVariantScriptDrift()'s similarity heuristic,
// scoped per markdown section instead of per whole file.
function checkVariantContextCommonization() {
    const templatesDir = 'templates';
    if (!fs.existsSync(templatesDir)) return;

    const variants = fs.readdirSync(templatesDir)
        .filter(d => d.startsWith('co-') && fs.statSync(path.join(templatesDir, d)).isDirectory() && isCoVariantTracked(d));
    if (variants.length < 2) return; // nothing to compare cross-variant

    type Section = { variant: string; heading: string; lines: Set<string> };
    const sections: Section[] = [];

    for (const variant of variants) {
        const docsDir = path.join(templatesDir, variant, 'docs');
        if (!fs.existsSync(docsDir)) continue;
        for (const file of fs.readdirSync(docsDir)) {
            if (!file.endsWith('.context.md')) continue;
            const content = readUTF8File(path.join(docsDir, file));
            for (const { heading, body } of splitIntoSections(content)) {
                const bodyLines = getContentLines(body);
                if (bodyLines.size >= 3) { // skip trivial/near-empty sections
                    sections.push({ variant, heading, lines: bodyLines });
                }
            }
        }
    }

    // Group by normalized heading — only compare sections that answer the same question.
    const byHeading = new Map<string, Section[]>();
    for (const s of sections) {
        if (!byHeading.has(s.heading)) byHeading.set(s.heading, []);
        byHeading.get(s.heading)!.push(s);
    }

    // Aggregate per heading rather than reporting every pair — a heading shared across
    // N variants produces up to N*(N-1)/2 pairwise matches, which buries the one decision
    // that actually matters ("is this heading common enough to promote?") under noise.
    let flaggedHeadings = 0;
    const totalVariantCount = variants.length;
    for (const [heading, group] of byHeading) {
        const involved = new Set<string>();
        let minSim = 1, maxSim = 0;
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const a = group[i], b = group[j];
                if (a.variant === b.variant) continue;
                let intersection = 0;
                for (const line of a.lines) if (b.lines.has(line)) intersection++;
                const denominator = Math.min(a.lines.size, b.lines.size);
                const similarity = denominator > 0 ? intersection / denominator : 0;
                if (similarity > 0.50) {
                    involved.add(a.variant);
                    involved.add(b.variant);
                    minSim = Math.min(minSim, similarity);
                    maxSim = Math.max(maxSim, similarity);
                }
            }
        }
        if (involved.size > 0) {
            flaggedHeadings++;
            const range = minSim === maxSim ? `${(minSim * 100).toFixed(0)}%` : `${(minSim * 100).toFixed(0)}-${(maxSim * 100).toFixed(0)}%`;
            const variantList = [...involved].sort().join(', ');
            Warn(`Context commonization candidate: "${heading}" section is >50% similar (${range} overlap) across ${involved.size}/${totalVariantCount} variants: ${variantList} — consider promoting to docs/context.md if shared by most variants, or a shared skill if only a subset (ADR-0050 Part 3)`);
        }
    }

    if (flaggedHeadings === 0) {
        Pass('Context commonization check: no high-similarity cross-variant sections found');
    } else {
        Warn(`Context commonization check: ${flaggedHeadings} section heading(s) flagged across variants (WARN-only, first-pass heuristic — see ADR-0050 Part 3)`);
    }
}
checkVariantContextCommonization();

// Stale promoted-content check (WARN-only). Complements checkVariantContextCommonization():
// that check only compares variants against EACH OTHER, so once a shared section is promoted
// into the common docs/context.md (ADR-0050 Part 3) and cleaned up in most variants, a single
// remaining variant-file duplicate falls below the "2+ variants" threshold and goes silently
// undetected. This check instead compares every docs/<variant>.context.md section directly
// against templates/common/docs/context.md's own sections — a >50% overlap here means the
// variant's copy is stale and should simply be deleted (promote-context-section.ts already did
// the promotion; nothing left to decide).
function checkStalePromotedContent() {
    const commonContextPath = path.join('templates', 'common', 'docs', 'context.md');
    if (!fs.existsSync(commonContextPath)) return;

    const templatesDir = 'templates';
    if (!fs.existsSync(templatesDir)) return;
    const variants = fs.readdirSync(templatesDir)
        .filter(d => d.startsWith('co-') && fs.statSync(path.join(templatesDir, d)).isDirectory() && isCoVariantTracked(d));
    if (variants.length === 0) return;

    const commonSections = splitIntoSections(readUTF8File(commonContextPath));
    const commonByHeading = new Map<string, Set<string>>();
    for (const { heading, body } of commonSections) {
        const bodyLines = getContentLines(body);
        if (bodyLines.size >= 3) commonByHeading.set(heading, bodyLines);
    }
    if (commonByHeading.size === 0) return;

    let flaggedCount = 0;
    for (const variant of variants) {
        const docsDir = path.join(templatesDir, variant, 'docs');
        if (!fs.existsSync(docsDir)) continue;
        for (const file of fs.readdirSync(docsDir)) {
            if (!file.endsWith('.context.md')) continue;
            const filePath = path.join(docsDir, file);
            const content = readUTF8File(filePath);
            for (const { heading, body } of splitIntoSections(content)) {
                const commonLines = commonByHeading.get(heading);
                if (!commonLines) continue;
                const variantLines = getContentLines(body);
                if (variantLines.size < 3) continue;
                let intersection = 0;
                for (const line of variantLines) if (commonLines.has(line)) intersection++;
                const denominator = Math.min(variantLines.size, commonLines.size);
                const similarity = denominator > 0 ? intersection / denominator : 0;
                if (similarity > 0.50) {
                    flaggedCount++;
                    Warn(`Stale promoted content: ${filePath} § "${heading}" is ${(similarity * 100).toFixed(0)}% similar to the already-promoted docs/context.md § "${heading}" — this variant copy is likely a leftover duplicate and should be removed (ADR-0050 Part 3)`);
                }
            }
        }
    }

    if (flaggedCount === 0) {
        Pass('Stale promoted content check: no variant sections duplicate already-promoted common content');
    } else {
        Warn(`Stale promoted content check: ${flaggedCount} variant section(s) duplicate content already promoted to docs/context.md (WARN-only — see ADR-0050 Part 3)`);
    }
}
checkStalePromotedContent();

// Script sync: validated by bun scripts/propagate-to-templates.ts --dry-run --domain scripts
checkL2VariantIntegrity();
checkVariantContextGuidelinesSection();
checkVariantAgentSections();
checkVariantSkillSections();
checkVariantJsonSchema();
checkTemplateDependencyMirror();
}

// Workspace root detection: presence of CONSTITUTION.md (and absence of variant.json)
// distinguishes the governance root from generated project copies.
const IS_WORKSPACE_ROOT = fs.existsSync('CONSTITUTION.md') && !fs.existsSync('variant.json');

// Check: Agent files must have a non-empty ## Required Tools section (workspace root only)
if (IS_WORKSPACE_ROOT && fs.existsSync('agents')) {
    const agentFiles = fs.readdirSync('agents').filter(f =>
        f.endsWith('.md') && f !== '_COMMON.md' && f !== 'README.md'
    );
    let missingSection = 0;
    let emptySection = 0;
    for (const file of agentFiles) {
        const filePath = path.join('agents', file);
        const content = readUTF8File(filePath);
        const sectionIdx = content.indexOf('## Required Tools');
        if (sectionIdx === -1) {
            Fail(`Agent file missing Required Tools section: ${file}`);
            missingSection++;
        } else {
            // Check if the section has any table rows: look for a '|' line after the header
            const afterSection = content.slice(sectionIdx + '## Required Tools'.length);
            const hasTableRow = /^\|[^|]+\|/m.test(afterSection.split(/^##\s/m)[0]);
            if (!hasTableRow) {
                Warn(`Agent Required Tools section is empty: ${file}`);
                emptySection++;
            }
        }
    }
    if (missingSection === 0 && emptySection === 0) {
        Pass('Agent Required Tools sections: all present');
    }
    errors += missingSection;
}

// Check: AGENTS.md PM Direct Execution Scope synced to templates/co-*/AGENTS.md (workspace root only)
if (IS_WORKSPACE_ROOT && fs.existsSync('AGENTS.md')) {
    const agentsMdContent = readUTF8File('AGENTS.md');
    const hasPmScope = agentsMdContent.includes('### PM Direct Execution Scope');
    if (hasPmScope) {
        const templatesDir = 'templates';
        let syncWarnings = 0;
        let checkedVariants = 0;
        if (fs.existsSync(templatesDir)) {
            for (const entry of fs.readdirSync(templatesDir)) {
                if (!entry.startsWith('co-') || !isCoVariantTracked(entry)) continue;
                const variantAgentsMd = path.join(templatesDir, entry, 'AGENTS.md');
                if (!fs.existsSync(variantAgentsMd)) continue;
                const variantContent = readUTF8File(variantAgentsMd);
                // Only check variants that have a pm agent entry
                const hasPmEntry = /\|\s*pm\s*\|/.test(variantContent)
                    || /pm\.md/.test(variantContent)
                    || /\*\*pm\*\*/.test(variantContent);
                if (!hasPmEntry) continue;
                checkedVariants++;
                if (!variantContent.includes('### PM Direct Execution Scope')) {
                    Warn(`AGENTS.md PM Direct Execution Scope not synced to: templates/${entry}/AGENTS.md`);
                    syncWarnings++;
                }
                // Check for §-numbered structure and VARIANT-* placeholder markers (required for l3-to-variant-pipeline.ts injection)
                const requiredMarkers = [
                    'VARIANT-AGENTS-START',
                    'VARIANT-AGENT-DETAILS-START',
                    'VARIANT-DISPATCH-TRIGGERS-START',
                    'VARIANT-PHASE-GATE-START',
                    'VARIANT-SUBAGENT-ROSTER-START',
                    'VARIANT-ROLE-BOUNDARY-START',
                ];
                const missingMarkers = requiredMarkers.filter(m => !variantContent.includes(`<!-- ${m} -->`));
                if (missingMarkers.length > 0) {
                    Fail(`templates/${entry}/AGENTS.md missing VARIANT-* markers: ${missingMarkers.join(', ')} — regenerate using L0 workspace script: regenerate-agents-md.ts --variant ${entry}`);
                    syncWarnings++;
                }
                if (!variantContent.includes('## §1:') || !variantContent.includes('## §3:') || !variantContent.includes('## §5:')) {
                    Fail(`templates/${entry}/AGENTS.md missing §-numbered section structure (§1/§3/§5) — regenerate using L0 workspace script: regenerate-agents-md.ts --variant ${entry}`);
                    syncWarnings++;
                }
            }
        }
        if (syncWarnings === 0) {
            Pass('AGENTS.md PM Direct Scope: synced');
        }
    }
}

// Check: Workspace root should not contain stray test artifacts or unauthorized files
if (IS_WORKSPACE_ROOT) {
    // Windows reserved device names. Observed producers (2026-08-21): a `bun build` whose output
    // path resolved to `nul` left a physical file inside templates/co-deck/, which — gitignored
    // and thus invisible to review — copyDir shipped into every scaffold from that variant.
    // The sweep below therefore covers tracked trees, not just untracked scratch dirs.
    const WINDOWS_DEVICE_NAMES = new Set([
        'nul', 'NUL', 'con', 'CON', 'prn', 'PRN', 'aux', 'AUX',
        'com1','com2','com3','com4','com5','com6','com7','com8','com9',
        'COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9',
        'lpt1','lpt2','lpt3','lpt4','lpt5','lpt6','lpt7','lpt8','lpt9',
        'LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9',
    ]);

    let strayFound = 0;
    try {
        const schemaRaw = readUTF8File(path.join('docs', 'workspace-schema.json'));
        const schema = JSON.parse(schemaRaw);
        const allowedFiles: string[] = schema?.rootAllowlist?.files ?? [];
        const allowedDirs: string[] = schema?.rootAllowlist?.dirs ?? [];

        // Only scan git-tracked top-level items — ignore untracked local directories (e.g. test projects)
        const gitLsResult = spawnSync('git', ['ls-files', '--cached'], { encoding: 'utf-8' });
        const trackedItems = new Set((gitLsResult.stdout || '').trim().split('\n').filter(Boolean).map(f => f.split('/')[0]));
        const items = fs.readdirSync('.');
        for (const item of items) {
            // Check and auto-delete Windows device name artifacts regardless of tracking status
            if (WINDOWS_DEVICE_NAMES.has(item)) {
                try {
                    let rmResult;
                    if (process.platform === 'win32') {
                        rmResult = spawnSync('bash', ['-c', 'rm -f -- "$1"', 'rm', item], { encoding: 'utf-8' });
                    } else {
                        rmResult = spawnSync('bash', ['-c', 'rm -f -- "$1"', 'rm', item], { encoding: 'utf-8' });
                    }
                    // Shell-free fallback — never interpolate filenames into a command line
                    if (rmResult.status !== 0) {
                        try {
                            fs.rmSync(item, { force: true });
                            rmResult = { ...rmResult, status: 0, stderr: '' };
                        } catch (e) {
                            rmResult = { ...rmResult, status: 1, stderr: String(e) };
                        }
                    }
                    if (rmResult.status === 0) {
                        Warn(`Auto-deleted Windows device name artifact: ${item} (external tool wrote to Git Bash "nul" filename)`);
                        continue;
                    } else {
                        Fail(`Windows device name artifact '${item}' could not be deleted: ${rmResult.stderr}`);
                        strayFound++;
                    }
                } catch (e) {
                    Fail(`Windows device name artifact '${item}' could not be deleted: ${e}`);
                    strayFound++;
                }
            }

            // Skip untracked local items entirely
            if (!trackedItems.has(item)) continue;
            const isDir = fs.statSync(item).isDirectory();
            if (isDir) {
                if (!allowedDirs.includes(item)) {
                    // Exception: valid project directories (have AGENTS.md or variant.json)
                    const hasAgentsMd = fs.existsSync(path.join(item, 'AGENTS.md'));
                    const hasVariantJson = fs.existsSync(path.join(item, 'variant.json'));
                    if (hasAgentsMd || hasVariantJson) {
                        // Valid project directory — skip
                        continue;
                    }
                    Fail(`Stray directory in workspace root: ${item} (not in rootAllowlist — check workspace-schema.json)`);
                    strayFound++;
                }
            } else {
                if (!allowedFiles.includes(item)) {
                    Fail(`Stray file in workspace root: ${item} (not in rootAllowlist — move to tests/ or scripts/)`);
                    strayFound++;
                }
            }
        }
        // Sweep RECURSIVELY into local project directories too. The root-level loop above only
        // sees './nul'; in practice these artifacts land inside scaffolded project dirs (observed
        // 2026-08-21 in two of six freshly scaffolded projects), where nothing ever cleaned them.
        // They then block deletion of the whole directory from PowerShell — Remove-Item resolves
        // 'nul' to the Win32 device rather than the file — which is the actual user-visible pain.
        // Depth matters: a device-name file at ANY depth blocks deleting every parent above it,
        // so a one-level sweep would leave the same symptom one directory down.
        // No repo script writes '> nul' (verified by full-tree scan; Check "nul redirect" below
        // now enforces that), so the producer is an external tool and cannot be fixed at the
        // source from here — sweeping is what makes recurrence self-healing.
        // Closes Layer 3 of the 2026-08-07 meeting
        // (memory/archive/meeting-2026-08-07-prevent-nul-file-creation.md).
        const SWEEP_SKIP_DIRS = new Set(['node_modules', '.git', '.venv', '.bun', 'dist', 'build', '.next', 'coverage']);
        let nestedSwept = 0;
        const sweepDeviceNames = (dir: string, depth: number): void => {
            if (depth > 8) return; // guard against pathological trees / symlink loops
            let entries: fs.Dirent[];
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
            for (const entry of entries) {
                const entryPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (SWEEP_SKIP_DIRS.has(entry.name)) continue;
                    sweepDeviceNames(entryPath, depth + 1);
                    continue;
                }
                if (!WINDOWS_DEVICE_NAMES.has(entry.name)) continue;
                // Shell-free: never interpolate the filename into a command line. Pass a
                // FORWARD-SLASH path: Git Bash's rm treats backslashes as escapes/quoting quirks.
                // Trust only the exit status for success — fs.existsSync() is unreliable here
                // because Win32 device-name resolution makes it return true for paths that
                // no longer exist (and false for backslash forms that do). Observed live:
                // rm exited 0 and the file was gone, yet existsSync(path.join(...)) was true,
                // producing a false "could not be auto-deleted" warning.
                const posixPath = entryPath.split(path.sep).join('/');
                const rm = spawnSync('bash', ['-c', 'rm -f -- "$1"', 'rm', posixPath], { encoding: 'utf-8' });
                if (rm.status === 0) {
                    Warn(`Auto-deleted Windows device name artifact: ${entryPath} (blocks directory deletion from PowerShell)`);
                    nestedSwept++;
                } else {
                    Warn(`Windows device name artifact '${entryPath}' could not be auto-deleted — remove it from Git Bash with: rm -f -- "${posixPath}"`);
                }
            }
        };
        // Sweep EVERY top-level directory, tracked or not. Tracked trees matter as much as
        // untracked ones — a device-name file inside templates/ is gitignored (the template's
        // own .gitignore lists NUL), so it never shows in git status, yet the scaffold's
        // copyDir ignores .gitignore and ships it into every project made from that variant.
        // That exact case (templates/co-deck/nul, created 2026-08-17, propagated into every
        // co-deck scaffold) is why this sweep covers templates/ now.
        for (const item of fs.readdirSync('.')) {
            if (item.startsWith('.') || SWEEP_SKIP_DIRS.has(item)) continue;
            let isDir = false;
            try { isDir = fs.statSync(item).isDirectory(); } catch { continue; }
            if (isDir) sweepDeviceNames(item, 1);
        }
        if (strayFound === 0 && nestedSwept === 0) {
            Pass('Workspace root is clean from stray test artifacts');
        }
    } catch (_e) {
        Warn('Could not read docs/workspace-schema.json for stray-artifact check — skipping');
    }
}

// Check: `> nul` redirect linting — prevent the artifact at the source
// Layer 4 of the 2026-08-07 meeting (memory/archive/meeting-2026-08-07-prevent-nul-file-creation.md).
// The sweep above is remediation; this is prevention. On Windows, `> nul` / `2> nul` in a shell
// context can materialize a physical file named `nul` that then blocks deleting the whole
// directory tree from PowerShell. CONSTITUTION.md §8 bans the pattern outright: use
// `> /dev/null 2>&1` in Bash, or `$null` / `Out-Null` in PowerShell.
//
// A full-tree scan on 2026-08-21 found zero violations in workspace source, so this check starts
// clean and exists to keep it that way. Scanning is limited to executable file types — .md is
// deliberately excluded because the governance docs quote the banned pattern in order to ban it.
// Comment lines are stripped before matching for the same reason (audit.ts's own comments above
// discuss `> nul` at length).
if (!LIFECYCLE_ONLY) {
    const NUL_REDIRECT = /(?:^|[^\w/])(?:[12]|&)?>\s*nul(?![\w./\\-])/i;
    // .bat/.cmd are excluded: cmd.exe `>nul` redirects to the NUL *device* and
    // can never materialize a file named `nul` — the hazard this lint targets
    // only exists in POSIX shells (bash creates a literal file). Flagging the
    // idiomatic Windows batch redirect was a false positive (observed on
    // co-architect's setup.bat, 2026-08-29).
    const LINT_EXTS = ['.ts', '.js', '.mjs', '.sh', '.ps1'];
    const LINT_SKIP_DIRS = new Set(['node_modules', '.git', '.venv', '.bun', 'dist', 'build', '.next', 'coverage', 'Projects']);
    const LINT_ROOTS = ['scripts', 'templates', '.githooks', 'tests'];

    /** Strip line comments so prose *about* the banned pattern isn't mistaken for a use of it.
     * Trailing \r is removed first: under core.autocrlf checkouts lines end CRLF, and the
     * end-anchors below would otherwise fail to match, leaving comments unstripped. */
    const stripComment = (line: string): string =>
        line
            .replace(/\r$/, '')
            .replace(/^\s*(?:\/\/|#|<#|\*).*$/, '')
            .replace(/\s+(?:\/\/|#)\s.*$/, '');

    let nulLintHits = 0;
    let nulLintScanned = 0;
    const lintDir = (dir: string, depth: number): void => {
        if (depth > 10) return;
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            const entryPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (LINT_SKIP_DIRS.has(entry.name)) continue;
                lintDir(entryPath, depth + 1);
                continue;
            }
            const isHook = dir.includes('.githooks');
            if (!isHook && !LINT_EXTS.some(ext => entry.name.endsWith(ext))) continue;
            let content: string;
            try { content = fs.readFileSync(entryPath, 'utf-8'); } catch { continue; }
            nulLintScanned++;
            content.split('\n').forEach((line, i) => {
                // Escape hatch for lines that must contain the literal pattern — e.g. this check's
                // own diagnostic strings below, which quote what they forbid.
                if (line.includes('nul-lint-ignore')) return;
                if (NUL_REDIRECT.test(stripComment(line))) {
                    Fail(`Banned '> nul' redirect at ${entryPath}:${i + 1} — creates an undeletable Windows device-name file. Use '> /dev/null 2>&1' (Bash) or '$null' / 'Out-Null' (PowerShell).`); // nul-lint-ignore
                    nulLintHits++;
                }
            });
        }
    };
    for (const root of LINT_ROOTS) {
        if (fs.existsSync(root)) lintDir(root, 1);
    }
    if (nulLintHits === 0) {
        Pass(`'> nul' redirect check: no banned redirects found (${nulLintScanned} files scanned)`); // nul-lint-ignore
    }
}

// Check: L0 Leakage (CONSTITUTION.md references in templates)
if (!LIFECYCLE_ONLY && fs.existsSync('templates')) {
    let leakageErrors = 0;
    // Matches: CONSTITUTION.md (literal), docs/constitution/ or docs\constitution\ path patterns
    const L0_LEAK_PATTERN = /CONSTITUTION\.md|docs[\/\\]constitution[\/\\]/i;
    const SKIP_DIRS = new Set(['node_modules', '.git', '.bun']);
    const checkLeakage = (dir: string) => {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                if (SKIP_DIRS.has(item)) continue;
                const dirName = path.basename(itemPath);
                if (dirName.startsWith('co-') && !isCoVariantTracked(dirName)) continue;
                checkLeakage(itemPath);
            } else if (stat.isFile() && itemPath.endsWith('.md')) {
                const content = readUTF8File(itemPath);
                if (L0_LEAK_PATTERN.test(content) && !content.includes('intentional-duplicate')) {
                    Fail(`L0 Leakage: ${itemPath} contains unauthorized reference to CONSTITUTION`);
                    leakageErrors++;
                }
            }
        }
    };
    checkLeakage('templates');
    if (leakageErrors === 0) {
        Pass('L0 Leakage check: no unauthorized CONSTITUTION references in templates');
    }
}

// Check: GitHub Actions workflow permission hygiene (workspace root and templates)
if (!LIFECYCLE_ONLY) {
    const workflowDirs = ['.github/workflows'];
    if (fs.existsSync('templates')) {
        workflowDirs.push('templates/common/.github/workflows');
    }
    let permChecked = 0;
    let permErrors = 0;
    for (const wfDir of workflowDirs) {
        if (!fs.existsSync(wfDir)) continue;
        for (const item of fs.readdirSync(wfDir)) {
            if (!item.endsWith('.yml') && !item.endsWith('.yaml')) continue;
            const wfPath = path.join(wfDir, item);
            // Skip comment-only lines so commented-out examples don't trigger
            const content = readUTF8File(wfPath)
                .split(String.fromCharCode(10))
                .filter((l: string) => !l.trimStart().startsWith('#'))
                .join(String.fromCharCode(10));
            permChecked++;
            if (/permissions:[\s\S]{0,60}(all|write-all)|write-all/i.test(content)) {
                Fail(`Workflow permission over-grant: ${wfPath} requests write-all/all permissions`);
                permErrors++;
            } else if (!/permissions:/.test(content)) {
                Warn(`Workflow without explicit permissions block (defaults may over-grant): ${wfPath}`);
            }
        }
    }
    if (permChecked > 0 && permErrors === 0) {
        Pass(`Workflow permission hygiene: ${permChecked} workflow files checked, no write-all grants`);
    }
}

// Check: L0-only agent files should not exist in templates/co-*/agents/
if (fs.existsSync('templates')) {
    const L0_ONLY_AGENTS = ['lifecycle-manager.md'];
    let l0OnlyErrors = 0;
    const templatesDir = 'templates';

    for (const entry of fs.readdirSync(templatesDir)) {
        if (!entry.startsWith('co-') || !isCoVariantTracked(entry)) continue;
        const variantAgentsDir = path.join(templatesDir, entry, 'agents');
        if (!fs.existsSync(variantAgentsDir)) continue;

        for (const l0OnlyAgent of L0_ONLY_AGENTS) {
            const agentPath = path.join(variantAgentsDir, l0OnlyAgent);
            if (fs.existsSync(agentPath)) {
                Fail(`L0-only agent: ${l0OnlyAgent} found in templates/${entry}/agents/ - this agent should only exist at workspace root (agents/)`);
                l0OnlyErrors++;
            }
        }
    }

    if (l0OnlyErrors === 0) {
        Pass('L0-only agent check: no L0-only agents found in templates/co-*/agents/');
    }
}

// Check: Template scripts must retain executable bit
if (fs.existsSync('templates')) {
    let executableErrors = 0;
    const checkExecutable = (dir: string) => {
        const SKIP_DIRS = new Set(['node_modules', '.git', '.bun']);
        for (const item of fs.readdirSync(dir)) {
            if (SKIP_DIRS.has(item)) continue;
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                checkExecutable(itemPath);
            } else if (stat.isFile()) {
                if (item.endsWith('.sh') || item.endsWith('.ps1')) {
                    try {
                        const out = execFileSync('git', ['ls-files', '--stage', itemPath.replace(/\\/g, '/')], { encoding: 'utf-8' });
                        if (out.startsWith('100644')) {
                            Fail(`Template script lost executable bit: ${itemPath}`);
                            executableErrors++;
                        }
                    } catch (e) {
                        // Ignore if file is untracked or git command fails
                    }
                }
            }
        }
    };
    checkExecutable('templates');
    if (executableErrors === 0) {
        Pass('Templates executable bit check: all scripts retain executable bit');
    }
}

// Check: templates/VERSION must have a corresponding git tag
if (fs.existsSync('templates')) {
    const versionFile = 'templates/VERSION';
    if (fs.existsSync(versionFile)) {
        try {
            const version = readUTF8File(versionFile).trim();
            const tagOut = execFileSync('git', ['tag', '-l', `template-v${version}`], { encoding: 'utf-8' }).trim();
            if (tagOut === '') {
                Warn(`Template version ${version} in templates/VERSION has no corresponding git tag. Run: bun scripts/tag-template.ts`);
            } else {
                Pass(`Template version tag: template-v${version} published`);
            }
        } catch (e) {
            Warn(`Could not verify template version tag: ${e}`);
        }
    }
}

// Check: shellcheck on .sh files (optional — warn only if shellcheck not installed)
{
    const shFiles = fs.existsSync('scripts')
        ? fs.readdirSync('scripts').filter(f => f.endsWith('.sh')).map(f => `scripts/${f}`)
        : [];
    if (shFiles.length > 0) {
        try {
            execFileSync(process.platform === 'win32' ? 'where' : 'which', ['shellcheck'], { stdio: 'ignore' });
            // shellcheck available
            let scErrors = 0;
            for (const shFile of shFiles) {
                try {
                    execFileSync('shellcheck', ['--shell=bash', shFile], { encoding: 'utf-8', stdio: 'pipe' });
                } catch (e: any) {
                    Fail(`shellcheck: ${shFile}\n${e.stdout || e.message}`);
                    scErrors++;
                }
            }
            if (scErrors === 0) Pass(`shellcheck: all ${shFiles.length} shell scripts passed`);
        } catch {
            Warn('shellcheck not installed — skipping shell lint (install via: brew install shellcheck)');
        }
    }
}

// Check: Platform parity (ADR-0033) - L0 → L1/L2 file synchronization
if (!LIFECYCLE_ONLY && fs.existsSync(path.join('scripts', 'test-platform-parity.ts'))) {
    const parityCheck = await $`bun ${path.join('scripts', 'test-platform-parity.ts')}`.quiet().nothrow();
    if (parityCheck.exitCode === 0) {
        Pass('Platform parity: L0 → L1/L2 files in sync');
    } else if (parityCheck.exitCode === 2) {
        Warn('Platform parity: warnings detected (run with --verbose for details)');
    } else {
        Fail('Platform parity: L0 → L1/L2 files out of sync (run: bun scripts/test-platform-parity.ts --verbose)');
        errors++;
    }
}

// Check: pm.md consistency (L0 → L1 → L2 alignment)
if (!LIFECYCLE_ONLY && IS_WORKSPACE_ROOT) {
    function checkPmConsistency(): boolean {
        const l0PmPath = 'agents/pm.md';
        const l1PmPath = 'templates/common/agents/pm.md';

        if (!fs.existsSync(l0PmPath) || !fs.existsSync(l1PmPath)) {
            return true; // Not applicable
        }

	        const l0Content = readUTF8File(l0PmPath);
	        const l1Content = readUTF8File(l1PmPath);

        // Extract YAML frontmatter sections
        const extractYamlSection = (content: string, sectionStart: string, sectionEnd: string): string => {
            const startIdx = content.indexOf(sectionStart);
            if (startIdx === -1) return '';
            const endIdx = content.indexOf(sectionEnd, startIdx);
            if (endIdx === -1) return '';
            return content.slice(startIdx, endIdx + sectionEnd.length);
        };

        // Extract core YAML fields from L0 (excluding L0-only fields)
        const l0YamlMatch = l0Content.match(/^---\n([\s\S]+?)\n---/);
        if (!l0YamlMatch) {
            Fail('L0 pm.md: missing YAML frontmatter');
            return false;
        }
        const l0Yaml = l0YamlMatch[1];

        // L1 YAML should have L1-only fields: formal_name, multi-line description
        const l1YamlMatch = l1Content.match(/^---\n([\s\S]+?)\n---/);
        if (!l1YamlMatch) {
            Fail('L1 pm.md: missing YAML frontmatter');
            return false;
        }
        const l1Yaml = l1YamlMatch[1];

        // Check for L1-only fields presence
        if (!l1Yaml.includes('formal_name:')) {
            Fail('L1 pm.md: missing L1-only field "formal_name"');
            return false;
        }

        // Check that L0-only fields are NOT in L1
        const l0OnlyFields = ['lifecycle:', 'role:'];
        for (const field of l0OnlyFields) {
            const fieldRegex = new RegExp(`^${field}`, 'm');
            if (fieldRegex.test(l1Yaml)) {
                Fail(`L1 pm.md: contains L0-only field "${field}" - should be removed`);
                return false;
            }
        }

        // L1 extends pattern validation (ADR-0033)
        // L1 can use pure YAML extends pattern OR VARIANT-SECTION markers
        const l1Parsed = parsePmMd(l1PmPath);

        // Define required variant sections for L2 validation (used below)
        const requiredVariantSections = [
            'governance-workflow',
            'agent-roster',
            'dispatch-protocol'
        ];

        if (l1Parsed.isValid && l1Parsed.extendsPath) {
            // L1 uses new extends pattern - validate YAML fields only
            Pass('L1 pm.md: uses YAML extends pattern (ADR-0033)');

            // Check that extends points to L0
            // l1Parsed.extendsPath is absolute path, extract filename to check
            const extendsBasename = path.basename(l1Parsed.extendsPath);
            if (extendsBasename !== 'pm.md' || !l1Parsed.extendsPath.includes('agents')) {
                Fail(`L1 pm.md: extends should point to "../../agents/pm.md" or "../../../agents/pm.md"`);
                return false;
            }

            // Check for remove_sections if present
            if (Object.keys(l1Parsed.variantOverrides).length > 0) {
                Pass('L1 pm.md: has remove_sections configured');
            }
        } else {
            // Legacy L1 pattern - require VARIANT-SECTION markers
            for (const section of requiredVariantSections) {
                const marker = `<!-- VARIANT-SECTION: ${section} -->`;
                const endMarker = `<!-- END VARIANT-SECTION -->`;
                if (!l1Content.includes(marker) || !l1Content.includes(endMarker)) {
                    Fail(`L1 pm.md: missing VARIANT-SECTION markers for "${section}"`);
                    return false;
                }
            }
        }

        // Check L2 variants
        const templatesDir = 'templates';
        if (fs.existsSync(templatesDir)) {
            const variants = fs.readdirSync(templatesDir)
                .filter(d => d.startsWith('co-') && fs.statSync(path.join(templatesDir, d)).isDirectory() && isCoVariantTracked(d));

            for (const variant of variants) {
                const l2PmPath = path.join(templatesDir, variant, 'agents', 'pm.md');
                if (!fs.existsSync(l2PmPath)) continue;

	                const l2Content = readUTF8File(l2PmPath);

	                const hasVariantOverrides = l2Content.includes('variant_overrides:');
                const hasExtendsPattern = l2Content.includes('extends:');
                const isResolved = l2Content.startsWith('# @resolved-from:');
                if (!hasVariantOverrides && !hasExtendsPattern && !isResolved) {
                    // L2 should have VARIANT-SECTION markers (if not using extends: skeleton)
                    for (const section of requiredVariantSections) {
                        const marker = `<!-- VARIANT-SECTION: ${section} -->`;
                        if (!l2Content.includes(marker)) {
                            Fail(`L2 ${variant}/agents/pm.md: missing VARIANT-SECTION marker for "${section}"`);
                            return false;
                        }
                    }
                }

                // L2 should NOT have full L0 content (line count check)
                const l2Lines = l2Content.split('\n').length;
                if (l2Lines >= 200) {
                    Fail(`L2 ${variant}/agents/pm.md: ${l2Lines} lines (too long - may contain L0 duplication bug)`);
                    return false;
                }

                // L2 YAML should NOT have L0-only fields, except `lifecycle:` for variants
                // that ship their own recursive validate-agents.ts requiring
                // lifecycle.phase/lifecycle.governance on every agents/**/*.md file
                // (e.g. co-safety) — see docs/architecture/extends-pattern.md schema table.
                const variantsAllowingLifecycle = new Set(['co-safety']);
                const l2OnlyFields = variantsAllowingLifecycle.has(variant)
                    ? l0OnlyFields.filter(f => f !== 'lifecycle:')
                    : l0OnlyFields;
                const l2YamlMatch = l2Content.match(/^---\n([\s\S]+?)\n---/);
                if (l2YamlMatch) {
                    const l2Yaml = l2YamlMatch[1];
                    for (const field of l2OnlyFields) {
                        const fieldRegex = new RegExp(`^${field}`, 'm');
                        if (fieldRegex.test(l2Yaml)) {
                            Fail(`L2 ${variant}/agents/pm.md: contains L0-only field "${field}"`);
                            return false;
                        }
                    }

                    // L2 YAML variant_overrides validation (if present)
                    if (l2Yaml.includes('variant_overrides:')) {
                        const parsed = parsePmMd(l2PmPath);
                        if (parsed.isValid && Object.keys(parsed.variantOverrides).length > 0) {
                            Pass(`L2 ${variant}/agents/pm.md: has valid variant_overrides`);

                            // With YAML variant_overrides, VARIANT-SECTION markers are no longer required
                            // in L2 files, so we don't warn about them missing.
                        } else {
                            Warn(`L2 ${variant}/agents/pm.md: variant_overrides field present but parsing failed`);
                        }
                    }
                }
            }
        }

        Pass('pm.md consistency: L0 → L1 → L2 alignment verified');
        return true;
    }

    const pmConsistencyPass = checkPmConsistency();
    if (!pmConsistencyPass) {
        errors++;
    }
}

// 27. Variant-specific audit checks
const variantAuditPath = path.join('scripts', 'audit-variant.ts');
if (fs.existsSync(variantAuditPath)) {
    console.log(`\n${CYAN}🔄 Running variant-specific audit checks via ${variantAuditPath}...${RESET}`);
    try {
        execFileSync('bun', [variantAuditPath], { stdio: 'inherit' });
        Pass('Variant-specific audit checks passed');
    } catch (e) {
        Fail('Variant-specific audit checks failed');
    }
}

// ── Spec Registry Checks (--spec-check mode) ─────────────────────
// ADR-0055 Stage 2 (2026-08-23): relevance check is FAIL; stale/missing-spec stay WARN.
// NOTE: guarded by SPEC_CHECK alone (not !LIFECYCLE_ONLY) because dev-sync.ts's
// only call site passes --spec-check --lifecycle-only together; gating on
// !LIFECYCLE_ONLY here made this block permanently unreachable.
if (SPEC_CHECK) {
    // Validate exemption codes (runs whenever SPEC_CHECK is active OR if codes were provided without --spec-check)
    if (SPEC_EXEMPT_CODES.length > 0) {
        const invalidCodes = SPEC_EXEMPT_CODES.filter(c => !SPEC_EXEMPT_CATEGORIES[c]);
        if (invalidCodes.length > 0) {
            Fail(`Invalid --spec-exempt code(s): ${invalidCodes.join(', ')} — valid codes: E1 (memory-log), E2 (changelog), E3 (hotfix-typo), E4 (pure-readme), E5 (sync-only) (AGENTS.md §5.1.1)`);
            // Skip the rest of spec-check on invalid codes (the Fail alone produces exit 1)
            // Note: we must exit the SPEC_CHECK block early here
        } else {
            console.log('── spec relevance EXEMPT: ' + SPEC_EXEMPT_CODES.map(c => `${c} (${SPEC_EXEMPT_CATEGORIES[c]})`).join(', ') + ' ──');
        }
    }

    // Only proceed if exemption codes were valid (or none provided)
    const invalidCodes = SPEC_EXEMPT_CODES.filter(c => !SPEC_EXEMPT_CATEGORIES[c]);
    if (invalidCodes.length === 0) {
        const SPEC_REGISTRY = path.join('docs', 'specs', 'registry.json');
        if (!fs.existsSync(SPEC_REGISTRY)) {
            Warn('Spec registry not found at docs/specs/registry.json — run: bun scripts/spec-register.ts to initialize');
        } else {
        interface SpecEntry { id: string; file: string; status: string; created: string; last_updated: string; }
        interface Registry { specs: SpecEntry[]; }
	        const registry: Registry = JSON.parse(readUTF8File(SPEC_REGISTRY));

        // Check 1: modified code files with no associated spec
        let changedFiles: string[] = [];
        try {
            const { stdout } = await $`git diff --name-only HEAD`.quiet().nothrow();
            changedFiles = stdout.toString().trim().split('\n').filter(Boolean);
        } catch (err) {
          console.error(`[audit] Error: ${err}`);
        }

        const codeChangedDirs = ['scripts/', 'templates/', 'agents/'];
        const changedCode = changedFiles.filter(f => codeChangedDirs.some(d => f.startsWith(d)));
        const changedSpecArea = changedFiles.some(f =>
            f.startsWith('docs/specs/') || f.startsWith('docs/designs/'));
        if (changedCode.length > 0) {
            const RECENT_DAYS = 7;
            const now = Date.now();
            const recentActiveSpec = registry.specs.some(s => {
                if (s.status !== 'approved' && s.status !== 'implemented') return false;
                const updated = Date.parse(s.last_updated);
                return !isNaN(updated) && (now - updated) <= RECENT_DAYS * 86400 * 1000;
            });
            // Relevance is diff-recency-based, not true per-file spec-to-code mapping
            // (out of scope for this pass — see docs/designs/2026-08-16-spec-registry-enforcement-design.md).
            const relevant = changedSpecArea || recentActiveSpec;
            if (!relevant) {
                if (SPEC_EXEMPT_CODES.length > 0 && SPEC_EXEMPT_CODES.every(c => SPEC_EXEMPT_CATEGORIES[c])) {
                    console.log('ℹ️  spec relevance check skipped (exempt)');
                } else {
                    Fail(`Spec check: ${changedCode.length} code file(s) changed but no recent/relevant spec activity (diff doesn't touch docs/specs|docs/designs, and no approved/implemented spec updated within ${RECENT_DAYS}d) — consider running the brainstorming skill or spec-register.ts`);
                }
            } else {
                Pass('Spec check: code changes covered by spec registry activity');
            }
        }

        // Check 2: stale approved specs (approved but not implemented after 14 days)
        const STALE_DAYS = 14;
        const now = Date.now();
        const staleSpecs = registry.specs.filter(s => {
            if (s.status !== 'approved') return false;
            const created = Date.parse(s.created);
            return !isNaN(created) && (now - created) > STALE_DAYS * 86400 * 1000;
        });
        if (staleSpecs.length > 0) {
            for (const s of staleSpecs) {
                Warn(`Spec check: "${s.id}" has been approved for >${STALE_DAYS} days without implementation — update status or implement`);
            }
        } else if (registry.specs.length > 0) {
            Pass('Spec check: no stale approved specs');
        }

        // Check 3: spec file existence
        let missingSpecFiles = 0;
        for (const s of registry.specs) {
            if (!fs.existsSync(s.file)) {
                Warn(`Spec check: registered spec file missing: ${s.file} (id: ${s.id})`);
                missingSpecFiles++;
            }
        }
        if (missingSpecFiles === 0 && registry.specs.length > 0) {
            Pass(`Spec check: all ${registry.specs.length} spec file(s) exist`);
        }
        }
    }
}

// ── ADR Governance Linkage Checks (--governance-check mode, warn-only) ─────────────
// NOTE: dev-sync step 3.97 now invokes `verify-adr-governance.ts --strict` as a
// blocking gate on ADR-linkage findings (Stage 2 of ADR-0059). This audit flag path
// remains a non-blocking diagnostic — no flags forwarded to the spawned script here.
if (GOVERNANCE_CHECK) {
    const { status, stdout, stderr } = spawnSync('bun', ['scripts/verify-adr-governance.ts'], {
        encoding: 'utf-8',
    });
    console.log(stdout);
    if (stderr) {
        console.error(stderr);
    }
    if (status !== 0) {
        Fail('ADR governance linkage check failed with operational error — script exited non-zero');
    }
}

console.log("");
if (errors === 0) {
    console.log(`${GREEN}✅ All checks passed.${RESET}`);
    if (import.meta.main) {
      process.exit(0);
    }
} else {
    console.log(`${RED}❌ ${errors} check(s) failed. Fix before committing.${RESET}`);
    if (import.meta.main) {
      process.exit(1);
    }
}
