import { $ } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
if (fs.existsSync('AGENTS.md') || fs.existsSync(path.join('templates', 'common', 'docs', 'context.md'))) {
    let linkErrors = 0;
    
    // Check AGENTS.md web URLs
    if (fs.existsSync('AGENTS.md')) {
        const content = fs.readFileSync('AGENTS.md', 'utf-8');
        const regex = /https:\/\/raw\.githubusercontent\.com\/5throck\/ai-workspace-standards\/main\/CONSTITUTION\.md#[\w-]+/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const url = match[0];
            try {
                const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
                if (!response.ok) throw new Error('Bad status');
            } catch {
                Fail(`Dead link detected in AGENTS.md: ${url}`);
                linkErrors++;
            }
        }
    }

    // Check templates/common/docs/context.md web URLs
    const ctxPath = path.join('templates', 'common', 'docs', 'context.md');
    if (fs.existsSync(ctxPath)) {
        const content = fs.readFileSync(ctxPath, 'utf-8');
        const regex = /https:\/\/raw\.githubusercontent\.com\/5throck\/ai-workspace-standards\/main\/CONSTITUTION\.md#[\w-]+/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const url = match[0];
            try {
                const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
                if (!response.ok) throw new Error('Bad status');
            } catch {
                Fail(`Dead link detected in templates/common/docs/context.md: ${url}`);
                linkErrors++;
            }
        }
    }

    if (linkErrors === 0) {
        Pass('Web URL validation: all external links resolve');
    } else {
        errors += linkErrors;
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
let bomErrors = 0;
let searchDirs = ['.'];
const projectCtxPath = path.join('docs', 'context.md');
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
        for (const file of fs.readdirSync('scripts')) {
            if (file.endsWith('.sh')) {
                const baseName = path.basename(file, '.sh');
                const ps1 = path.join('scripts', `${baseName}.ps1`);
                if (fs.existsSync(ps1)) {
                    Pass(`script parity: ${file} / ${baseName}.ps1`);
                } else {
                    Warn(`script parity gap: ${file} has no matching .ps1`);
                }
            }
        }
    }
} else {
    Warn('docs/context.md not found - skipping project-level checks (workspace root)');
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
} else {
    Warn('Bun not installed - skipping lifecycle audits');
}

// 3.7. Language validation: Korean-only markdown files outside ko/ and locales/ko/
console.log(""); // Add spacing before language validation output
const langValidate = await $`bun ${path.join('scripts', 'validate-md-language.ts')}`.nothrow();
if (langValidate.exitCode === 0) {
    Pass('Language validation: no Korean-only markdown files found');
} else {
    Fail('Language validation: Korean-only markdown files detected');
    errors++;
}

// Agent/Skill State Synchronization Check
if (fs.existsSync('AGENTS.md') && fs.existsSync('agents')) {
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
if (fs.existsSync(claudeCommandsDir)) {
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

console.log("");
if (errors === 0) {
    console.log(`${GREEN}✅ All checks passed.${RESET}`);
    process.exit(0);
} else {
    console.log(`${RED}❌ ${errors} check(s) failed. Fix before committing.${RESET}`);
    process.exit(1);
}
