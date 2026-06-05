// @version 2.5.3
import { $ } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';

// Check for --lifecycle-only flag
const LIFECYCLE_ONLY = process.argv.includes('--lifecycle-only');

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

// 2. CONSTITUTION.md must be accessible
if (fs.existsSync('CONSTITUTION.md') || fs.existsSync('../CONSTITUTION.md')) {
    Pass('CONSTITUTION.md accessible');
} else {
    Fail('CONSTITUTION.md not found (expected at ./ or ../)');
}

// 2.5. Constitution section files must exist and be non-empty (workspace root only)
if (fs.existsSync('CONSTITUTION.md') && fs.existsSync('docs/constitution')) {
    const content = fs.readFileSync('CONSTITUTION.md', 'utf-8');
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
            const content = fs.readFileSync(filePath, 'utf-8');
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
    const cl = fs.readFileSync('CHANGELOG.md', 'utf-8');
    if (cl.includes('[Unreleased]')) {
        Pass('CHANGELOG.md has [Unreleased] section');
    } else {
        Fail("CHANGELOG.md is missing '[Unreleased]' section");
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
    for (const f of fs.readdirSync(dir)) {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
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
    const ctx = fs.readFileSync(projectCtxPath, 'utf-8');
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

    if (fs.existsSync('scripts')) {
        const scriptFiles = fs.readdirSync('scripts');
        const shFiles = scriptFiles.filter(f => f.endsWith('.sh') && !f.startsWith('test-'));
        const ps1Files = scriptFiles.filter(f => f.endsWith('.ps1') && !f.startsWith('test-'));

        // S-02: Bidirectional parity check — both directions, Fail (not Warn)
        let parityOk = true;
        for (const f of shFiles) {
            const base = path.basename(f, '.sh');
            if (!fs.existsSync(path.join('scripts', `${base}.ps1`))) {
                Fail(`script parity: ${f} has no matching ${base}.ps1`);
                parityOk = false;
            }
        }
        for (const f of ps1Files) {
            const base = path.basename(f, '.ps1');
            if (!fs.existsSync(path.join('scripts', `${base}.sh`))) {
                Fail(`script parity: ${f} has no matching ${base}.sh`);
                parityOk = false;
            }
        }
        if (parityOk) {
            Pass(`script parity: all .sh/.ps1 pairs present (${shFiles.length} pairs, test-* excluded)`);
        }

    }

    // S-03: .githooks parity check - Suppressed (Git Bash assumed on Windows)
    // if (fs.existsSync('.githooks')) { ... }


    // Check: no non-standard .md files at project root (file organization policy)
    const STANDARD_ROOT_MD = new Set([
        'README.md', 'README_ko.md', 'CHANGELOG.md', 'AGENTS.md',
        'SECURITY.md', 'CONSTITUTION.md', 'CLAUDE.md', 'GEMINI.md'
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
            const content = fs.readFileSync(path.join(researchDir, f), 'utf-8');
            return !content.includes('## References') && !content.includes('## Sources');
        });
        if (missingRefs.length > 0) {
            Warn(`Research files missing ## References section: ${missingRefs.join(', ')} — add citations per Research Standards policy`);
        } else if (researchFiles.length > 0) {
            Pass('docs/research/: all research files have ## References section');
        }
    }
} else {
    Warn('docs/context.md not found - skipping project-level checks (workspace root)');
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
        const scriptsMd = fs.readFileSync(path.join('scripts', 'SCRIPTS.md'), 'utf-8');
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

// Skills registry cross-check
for (const skillsDir of ['skills', path.join('.claude', 'skills')]) {
    if (fs.existsSync(skillsDir)) {
        for (const dir of fs.readdirSync(skillsDir)) {
            const fullDir = path.join(skillsDir, dir);
            if (fs.statSync(fullDir).isDirectory()) {
                const skillMd = path.join(fullDir, 'SKILL.md');
                if (fs.existsSync(skillMd)) {
                    Pass(`skill exists: ${skillMd}`);
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
    if (fs.existsSync(path.join('scripts', 'verify-scripts.ts'))) {
        const out = await $`bun ${path.join('scripts', 'verify-scripts.ts')} --verify`.quiet().nothrow();
        if (out.exitCode !== 0)
            Fail("Script registry detected issues (run 'bun scripts/verify-scripts.ts --verify' to see details)");
        else
            Pass("Script registry: all scripts verified");
    }
    if (fs.existsSync(path.join('scripts', 'readme-lifecycle-audit.ts')) && fs.existsSync('templates')) {
        const out = await $`bun ${path.join('scripts', 'readme-lifecycle-audit.ts')} --json`.quiet().nothrow();
        if (out.exitCode !== 0)
            Fail("README lifecycle audit detected issues (run 'bun scripts/readme-lifecycle-audit.ts' to see details)");
        else
            Pass("README lifecycle audit: all READMEs healthy");
    }
    if (fs.existsSync(path.join('scripts', 'verify-memory.ts')) && fs.existsSync('CONSTITUTION.md')) {
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
        const content = fs.readFileSync(scriptPath, 'utf-8');
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

    const scripts = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.ts') && f !== 'test-');
    const scriptsMdContent = fs.readFileSync(scriptsMdPath, 'utf-8');

    for (const script of scripts) {
        const scriptPath = path.join(scriptsDir, script);
        const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
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
    const agentsContent = fs.readFileSync('AGENTS.md', 'utf-8');
    
    for (const file of fs.readdirSync('agents')) {
        if (!file.endsWith('.md')) continue;
        const agentFile = path.join('agents', file);
        const agentName = path.basename(file, '.md');
        const content = fs.readFileSync(agentFile, 'utf-8');
        
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
        const content = fs.readFileSync(filePath, 'utf-8');
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

// Script sync check: workspace root scripts/ vs templates/common/scripts/
function checkScriptSync() {
    const rootScriptsDir = 'scripts';
    const templateScriptsDir = path.join('templates', 'common', 'scripts');

    if (!fs.existsSync(rootScriptsDir) || !fs.existsSync(templateScriptsDir)) {
        return; // Not applicable in this context
    }

    const rootFiles = new Set(
        fs.readdirSync(rootScriptsDir).filter(f => f.endsWith('.ts'))
    );
    const templateFiles = new Set(
        fs.readdirSync(templateScriptsDir).filter(f => f.endsWith('.ts'))
    );

    const sharedFiles = [...rootFiles].filter(f => templateFiles.has(f));

    let divergentCount = 0;
    for (const file of sharedFiles) {
        const rootContent = fs.readFileSync(path.join(rootScriptsDir, file));
        const templateContent = fs.readFileSync(path.join(templateScriptsDir, file));
        const rootHash = crypto.createHash('sha256').update(rootContent).digest('hex');
        const templateHash = crypto.createHash('sha256').update(templateContent).digest('hex');
        if (rootHash !== templateHash) {
            Fail(`Script sync: scripts/${file} differs from templates/common/scripts/${file}`);
            divergentCount++;
        }
    }

    if (divergentCount === 0) {
        Pass(`Script sync: workspace root and templates/common/scripts/ are in sync (${sharedFiles.length} shared files)`);
    }
}

// L2 variant structural integrity check
function checkL2VariantIntegrity() {
  const templatesDir = 'templates';
  if (!fs.existsSync(templatesDir)) return;

  const variants = fs.readdirSync(templatesDir)
    .filter(d => d.startsWith('co-') && fs.statSync(path.join(templatesDir, d)).isDirectory());

  if (variants.length === 0) return;

  // Required files every L2 variant must have
  const requiredFiles = [
    'CLAUDE.md',
    'GEMINI.md',
    'AGENTS.md',
    'README.md',
    'variant.json',
    'scripts/SCRIPTS.md',
    'agents',          // directory
    'scripts',         // directory
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
  }

  if (missingCount === 0) {
    Pass(`L2 variant integrity: all ${variants.length} variants have required structure`);
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
        '.githooks/pre-push.ps1',
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
        const content = fs.readFileSync(filePath, 'utf-8');
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
checkScriptSync();
checkL2VariantIntegrity();
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
        const content = fs.readFileSync(filePath, 'utf-8');
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
    const agentsMdContent = fs.readFileSync('AGENTS.md', 'utf-8');
    const hasPmScope = agentsMdContent.includes('### PM Direct Execution Scope');
    if (hasPmScope) {
        const templatesDir = 'templates';
        let syncWarnings = 0;
        let checkedVariants = 0;
        if (fs.existsSync(templatesDir)) {
            for (const entry of fs.readdirSync(templatesDir)) {
                if (!entry.startsWith('co-')) continue;
                const variantAgentsMd = path.join(templatesDir, entry, 'AGENTS.md');
                if (!fs.existsSync(variantAgentsMd)) continue;
                const variantContent = fs.readFileSync(variantAgentsMd, 'utf-8');
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
            }
        }
        if (syncWarnings === 0) {
            Pass('AGENTS.md PM Direct Scope: synced');
        }
    }
}

// Check: Workspace root should not contain stray test artifacts or unauthorized files
if (IS_WORKSPACE_ROOT) {
    let strayFound = 0;
    try {
        const schemaRaw = fs.readFileSync(path.join('docs', 'workspace-schema.json'), 'utf-8');
        const schema = JSON.parse(schemaRaw);
        const allowedFiles: string[] = schema?.rootAllowlist?.files ?? [];
        const allowedDirs: string[] = schema?.rootAllowlist?.dirs ?? [];

        const items = fs.readdirSync('.');
        for (const item of items) {
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
        if (strayFound === 0) {
            Pass('Workspace root is clean from stray test artifacts');
        }
    } catch (_e) {
        Warn('Could not read docs/workspace-schema.json for stray-artifact check — skipping');
    }
}

// Check: Template scripts must retain executable bit
if (fs.existsSync('templates')) {
    let executableErrors = 0;
    const checkExecutable = (dir: string) => {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                checkExecutable(itemPath);
            } else if (stat.isFile()) {
                if (item.endsWith('.sh') || item.endsWith('.ps1') || item.endsWith('.ts')) {
                    try {
                        const out = execSync(`git ls-files --stage "${itemPath.replace(/\\/g, '/')}"`, { encoding: 'utf-8' });
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
            const version = fs.readFileSync(versionFile, 'utf-8').trim();
            const tagOut = execSync(`git tag -l "template-v${version}"`, { encoding: 'utf-8' }).trim();
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

console.log("");
if (errors === 0) {
    console.log(`${GREEN}✅ All checks passed.${RESET}`);
    process.exit(0);
} else {
    console.log(`${RED}❌ ${errors} check(s) failed. Fix before committing.${RESET}`);
    process.exit(1);
}
