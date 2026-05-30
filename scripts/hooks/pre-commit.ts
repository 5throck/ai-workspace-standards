#!/usr/bin/env bun
/**
 * pre-commit.ts — TS-based pre-commit hook.
 * Replaces the legacy bash/ps1 hooks.
 */

import { $ } from "bun";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

async function main() {
  const stagedOutput = await $`git diff --cached --name-only`.text();
  const staged = stagedOutput.split('\n').filter(Boolean);
  if (staged.length === 0) process.exit(0);

  const memoryOnly = staged.every(f => f.startsWith('memory/'));

  console.log("=== TS Pre-commit Hook ===");

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

  // 2-B. Enforce English Only in PR Artifacts
  const docsToCheck = staged.filter(f => /^memory\/.*\.md$|^CHANGELOG\.md$/.test(f.replace(/\\/g, '/')));
  for (const file of docsToCheck) {
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

  // 4. Audits
  if (!memoryOnly) {
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

  // 5. Secret scan
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
