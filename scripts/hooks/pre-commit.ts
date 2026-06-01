#!/usr/bin/env bun
/**
 * pre-commit.ts — TS-based pre-commit hook.
 * Replaces the legacy bash/ps1 hooks.
 * @version 1.3.0
 */

import { $ } from "bun";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

async function main() {
  const stagedOutput = await $`git diff --cached --name-only`.text();
  const staged = stagedOutput.split('\n').filter(Boolean);
  if (staged.length === 0) process.exit(0);

  const memoryOnly = staged.every(f => f.startsWith('memory/'));

  console.log("=== TS Pre-commit Hook ===");

  // Check current project path - use staged files to detect project
  const currentPath = process.cwd();
  const projectPath = staged.length > 0 ? staged[0].split(/[/\\]/)[0] : '';
  const isAbapVibeProject = staged.some(f => f.includes('abap_vibe_coding_mig') || f.includes('abap_vibe_coding'));

  console.log(`[DEBUG] Current path: ${currentPath}`);
  console.log(`[DEBUG] Project path: ${projectPath}`);
  console.log(`[DEBUG] Staged files: ${staged.slice(0, 3).join(', ')}`);
  console.log(`[DEBUG] Is abap project: ${isAbapVibeProject}`);
  console.log(`[DEBUG] SYNC_ACTIVE: ${process.env.SYNC_ACTIVE}`);
  console.log(`[DEBUG] DEV_SYNC_CONTEXT: ${process.env.DEV_SYNC_CONTEXT}`);

  // abap projects use vsp-sync.ts instead of dev-sync.ts, skip SYNC_ACTIVE check
  if (!isAbapVibeProject && process.env.SYNC_ACTIVE !== "1") {
    console.error("\x1b[31m[FAIL]\x1b[0m Direct git commits are restricted. Please use the /sync skill to commit and push changes.");
    console.error("\x1b[33m[WARN]\x1b[0m --no-verify is FORBIDDEN in this workspace — it bypasses secret scanning and all quality gates. Use /sync instead.");
    process.exit(1);
  }

  const expectedContext = process.env.DEV_SYNC_CONTEXT;
  if (!isAbapVibeProject && (!expectedContext || !existsSync('.sync_context.tmp') || readFileSync('.sync_context.tmp', 'utf-8') !== expectedContext)) {
    console.error("\x1b[31m[FAIL]\x1b[0m Execution context validation failed. Direct environment variable manipulation detected.");
    console.error("\x1b[33m[WARN]\x1b[0m Please use the /sync skill to commit and push changes.");
    process.exit(1);
  }

  // 1. Auto-update Markdown "Last Updated" dates
  const mdStaged = staged.filter(f => f.toLowerCase().endsWith('.md'));
  if (mdStaged.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    for (const file of mdStaged) {
      try {
        let content = readFileSync(file, 'utf-8');
        if (content.includes('Last Updated:')) {
          content = content.replace(/Last Updated: \d{4}-\d{2}-\d{2}/g, `Last Updated: ${today}`);
          writeFileSync(file, content, 'utf-8');
          await $`git add ${file}`;
        }
      } catch (e) { /* ignore */ }
    }
  }

  // 1-A. Auto-date CHANGELOG.md [Unreleased]
  if (staged.includes('CHANGELOG.md')) {
    const today = new Date().toISOString().slice(0, 10);
    let content = readFileSync('CHANGELOG.md', 'utf-8');
    let lines = content.split('\n');
    let inUnreleased = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## [Unreleased]')) inUnreleased = true;
      else if (lines[i].startsWith('## [') && !lines[i].startsWith('## [Unreleased]')) inUnreleased = false;
      
      if (inUnreleased && /^\s*-\s+/.test(lines[i]) && !lines[i].match(/\*\*\[\d{4}-\d{2}-\d{2}\]\*\*: /)) {
        lines[i] = lines[i].replace(/^(\s*-\s+)/, `$1**[${today}]**: `);
      }
    }
    writeFileSync('CHANGELOG.md', lines.join('\n'), 'utf-8');
    await $`git add CHANGELOG.md`;
  }

  // 2. Block .env files
  const envStaged = staged.filter(f => /^\.env$|^\.env\.[^s]|(\/|\\)\.env$|(\/|\\)\.env\.[^s]/.test(f));
  if (envStaged.length > 0) {
    console.error("\x1b[31m[FAIL]\x1b[0m Attempt to commit .env file detected.");
    process.exit(1);
  }

  // 2-A. Block merge conflict markers
  const textStaged = staged.filter(f => !f.match(/\.(png|jpg|jpeg|gif|ico|pdf|zip|tar|gz|mp4|webm|bin|exe|dll)$/i));
  for (const file of textStaged) {
    if (!existsSync(file)) continue;
    try {
      const content = readFileSync(file, 'utf-8');
      if (/^<<<<<<<\s/m.test(content) || /^=======\r?\n/m.test(content) || /^>>>>>>>\s/m.test(content)) {
        if (/^<<<<<<<\s/m.test(content) || /^>>>>>>>\s/m.test(content)) {
          console.error(`\x1b[31m[FAIL]\x1b[0m Merge conflict marker detected in ${file}`);
          process.exit(1);
        }
      }
    } catch { /* ignore binary read errors */ }
  }

  // 2-B. Enforce English Only in CHANGELOG.md (PR artifact)
  // memory/*.md files are session logs — Korean is acceptable (user's active language)
  const docsToCheck = staged.filter(f => /^CHANGELOG\.md$/.test(f.replace(/\\/g, '/')));
  for (const file of docsToCheck) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf-8');
    if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(content)) {
      console.error(`\x1b[31m[FAIL]\x1b[0m Non-English characters (Korean) detected in ${file}`);
      process.exit(1);
    }
  }

  // 3. Memory Cleanup & Validation
  const memoryStaged = staged.filter(f => /^memory\//.test(f.replace(/\\/g, '/')));
  if (memoryStaged.length > 0) {
    console.log("\n=== Memory Format Validation ===");
    try {
      await $`bun scripts/verify-memory.ts --verify ${memoryStaged}`.quiet();
    } catch {
      console.log("\x1b[33m[WARN]\x1b[0m Memory format: some entries use legacy format");
    }
  }

  // 3.5. Lifecycle-only audit (fast pre-commit check)
  // Skip workspace audit for abap projects (they have their own audit)
  if (!memoryOnly && !isAbapVibeProject) {
    console.log("\n=== Lifecycle Audit (Pre-commit Gatekeeper) ===");
    try {
      await $`bun scripts/audit.ts --lifecycle-only`;
      console.log("\x1b[32m[PASS]\x1b[0m Lifecycle audit: all lifecycle checks passed");
    } catch {
      console.error("\x1b[31m[FAIL]\x1b[0m Lifecycle audit detected drift - commit blocked.");
      console.error("\x1b[33m[INFO]\x1b[0m Run 'bun scripts/audit.ts --lifecycle-only' to see details.");
      process.exit(1);
    }
  }

  // 4. Audits
  // Skip workspace audit for abap projects (they run their own project-specific audit)
  if (!memoryOnly && !isAbapVibeProject) {
    console.log("\n=== Workspace Audit ===");
    try {
      await $`bun scripts/audit.ts`;
    } catch {
      process.exit(1);
    }
  }

  const templateStaged = staged.filter(f => /^templates\//.test(f.replace(/\\/g, '/')));
  if (templateStaged.length > 0) {
    console.log("\n=== Template Lifecycle Validation ===");
    try {
      await $`bun scripts/validate-templates.ts`;
      console.log("\x1b[32m[PASS]\x1b[0m Template validation: all checks passed");
    } catch {
      console.error("\x1b[31m[FAIL]\x1b[0m Template validation failed - commit blocked.");
      process.exit(1);
    }
  }

  // 5. README sync check
  const readmeStaged = staged.some(f => /README(\_ko)?\.md$/.test(f));
  if (readmeStaged) {
    console.log("\n=== README Synchronization ===");
    try {
      await $`bun scripts/verify-readme-sync.ts --pre-commit`;
      console.log("\x1b[32m[PASS]\x1b[0m README sync: all hashes match");
    } catch {
      console.error("\x1b[31m[FAIL]\x1b[0m README sync check failed — commit blocked.");
      process.exit(1);
    }
  }

  // 6. Lifecycle compliance check (Tier 1 Gatekeeper)
  // Skip for abap projects (they manage their own lifecycle)
  const scriptStaged = staged.filter(f => /^scripts\/.*\.ts$/.test(f.replace(/\\/g, '/')));
  const scriptsMdStaged = staged.includes('scripts/SCRIPTS.md');

  if (!isAbapVibeProject && scriptStaged.length > 0 && !scriptsMdStaged) {
    console.log("\n=== Lifecycle Compliance Check ===");
    console.error("\x1b[31m[FAIL]\x1b[0m scripts/*.ts files were modified but scripts/SCRIPTS.md was not updated.");
    console.error("");
    console.error("Modified script files:");
    for (const script of scriptStaged) {
      console.error(`  - ${script}`);
    }
    console.error("");
    console.error("Required actions:");
    console.error("  1. Register new scripts in scripts/SCRIPTS.md");
    console.error("  2. Bump version for modified scripts in scripts/SCRIPTS.md");
    console.error("  3. Stage the updated scripts/SCRIPTS.md:");
    console.error("     git add scripts/SCRIPTS.md");
    console.error("");
    process.exit(1);
  }

  // 6b. Platform Skill/Command lifecycle check (non-blocking WARN)
  const claudeSkillStaged = staged.filter(f => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(f.replace(/\\/g, '/')));
  const geminiSkillStaged = staged.filter(f => /^\.gemini\/skills\/[^/]+\/SKILL\.md$/.test(f.replace(/\\/g, '/')));
  const claudeCommandStaged = staged.filter(f => /^\.claude\/commands\/[^/]+\.md$/.test(f.replace(/\\/g, '/')));
  const geminiCommandStaged = staged.filter(f => /^\.gemini\/commands\/[^/]+\.md$/.test(f.replace(/\\/g, '/')));

  for (const f of [...claudeSkillStaged, ...geminiSkillStaged]) {
    try {
      const content = readFileSync(f, 'utf-8');
      if (!/^version:\s*\d+\.\d+\.\d+/m.test(content)) {
        console.error(`\x1b[33m[WARN]\x1b[0m ${f}: missing 'version:' in frontmatter — add version: 1.0.0 for new skills`);
      }
    } catch { /* file may be deleted */ }
  }

  for (const f of claudeCommandStaged) {
    const commonPath = f.replace(/^\.claude\//, 'templates/common/.claude/').replace(/\\/g, '/');
    if (!existsSync(commonPath)) {
      console.error(`\x1b[33m[WARN]\x1b[0m ${f} — templates/common counterpart missing: ${commonPath}`);
      console.error(`       Run platform-command-lifecycle-manager skill to propagate.`);
    }
  }

  for (const f of geminiCommandStaged) {
    const commonPath = f.replace(/^\.gemini\//, 'templates/common/.gemini/').replace(/\\/g, '/');
    if (!existsSync(commonPath)) {
      console.error(`\x1b[33m[WARN]\x1b[0m ${f} — templates/common counterpart missing: ${commonPath}`);
      console.error(`       Run platform-command-lifecycle-manager skill to propagate.`);
    }
  }

  // 7. Secret scan
  console.log("\n=== Secret scan ===");
  try {
    const hasGitleaks = await $`gitleaks version`.nothrow().quiet();
    if (hasGitleaks.exitCode === 0) {
      const configArg = existsSync('.gitleaks.toml') ? ['--config', '.gitleaks.toml'] : [];
      await $`gitleaks protect --staged --no-banner --log-level error ${configArg}`;
      console.log("\x1b[32m[PASS]\x1b[0m gitleaks: no secrets detected");
    } else {
      const diff = await $`git diff --cached -U0`.text();
      const added = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n');
      const patterns = [
        /(password|passwd|secret|api_key|apikey|access_token|auth_token)\s*=\s*['"][^'"]{8,}['"]/i,
        /AKIA[0-9A-Z]{16}/,
        /ghp_[0-9a-zA-Z]{36}/,
        /sk-[0-9a-zA-Z]{48}/
      ];
      for (const p of patterns) {
        if (p.test(added)) {
          console.error(`\x1b[31m[FAIL]\x1b[0m Possible secret detected by regex.`);
          process.exit(1);
        }
      }
      console.log("\x1b[32m[PASS]\x1b[0m Regex secret scan: nothing detected");
    }
  } catch (e) {
    console.error("\x1b[31m[FAIL]\x1b[0m Secret scan failed or secrets detected. Commit blocked.");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Hook error:", err);
  process.exit(1);
});
