#!/usr/bin/env bun
// @version 1.1.0
// vsp-publish.ts - Harness Packaging & Publishing Hook
// Standardized packaging script to sanitize and copy core framework assets to the plugin repository.
// Usage: bun scripts/co-abap/vsp-publish.ts "feat: align with main reference implementation"
//   (requires CLAUDE_PLUGIN_ROOT env var pointing at the target co-abap_plugin checkout)
//
// v1.1.0 (spec docs/designs/2026-10-05-consult-abap-develop-review-remediation-design.md, AH6):
//   - sourceDir is the PROJECT ROOT (two levels up from scripts/co-abap/), not scripts/ —
//     agents/, skills/, docs/ paths resolve correctly now
//   - ASSETS rebuilt against the actual template layout: dropped entries that do not
//     exist (.claude/commands, docs/prd-template.md, docs/task-template.md,
//     docs/plugin-setup.md, scripts/sync-md.ts, .mcp.json.sample) and moved the vsp
//     scripts to their real scripts/co-abap/ paths; added atc-rulepack.json
//     (vsp-audit.ts's data dependency)
//   - a missing required source asset is an ERROR that aborts the run, not a warn-skip

import { $ } from "bun";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";

const scriptDir = path.dirname(import.meta.path);
// scripts/co-abap/ → project root (two levels up), so agents/skills/scripts
// paths in ASSETS resolve against the scaffolded project layout.
const sourceDir = path.resolve(scriptDir, "..", "..");

interface Asset {
  source: string;
  target: string;
  isFolder: boolean;
}

// Every entry verified to exist in the template layout (2026-10-06).
const ASSETS: Asset[] = [
  { source: "agents", target: "agents", isFolder: true },
  { source: "skills", target: "skills", isFolder: true },
  { source: path.join("scripts", "co-abap", "install-vsp.ts"), target: path.join("scripts", "co-abap", "install-vsp.ts"), isFolder: false },
  { source: path.join("scripts", "co-abap", "vsp-audit.ts"), target: path.join("scripts", "co-abap", "vsp-audit.ts"), isFolder: false },
  { source: path.join("scripts", "co-abap", "vsp-task.ts"), target: path.join("scripts", "co-abap", "vsp-task.ts"), isFolder: false },
  { source: path.join("scripts", "co-abap", "atc-rulepack.json"), target: path.join("scripts", "co-abap", "atc-rulepack.json"), isFolder: false },
];

function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function md5(filePath: string): string {
  return crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
}

function syncAssets(targetDir: string): boolean {
  console.log(`${GREEN}Copying core assets to plugin...${RESET}`);
  let missingRequired = false;

  for (const asset of ASSETS) {
    const srcPath = path.join(sourceDir, asset.source);
    const tgtPath = path.join(targetDir, asset.target);

    if (!fs.existsSync(srcPath)) {
      // Required asset missing from the source tree is fatal — publishing a
      // partial plugin silently is worse than failing loudly.
      console.error(`${RED}  [!] Required source asset not found: ${srcPath}${RESET}`);
      missingRequired = true;
      continue;
    }

    if (asset.isFolder) {
      // Clean target directory first to prevent orphaned files
      if (fs.existsSync(tgtPath)) fs.rmSync(tgtPath, { recursive: true, force: true });
      fs.mkdirSync(tgtPath, { recursive: true });
      fs.cpSync(srcPath, tgtPath, { recursive: true });
      console.log(`${GRAY}  [+] Synced Folder: ${asset.source} -> ${asset.target}${RESET}`);
    } else {
      fs.mkdirSync(path.dirname(tgtPath), { recursive: true });
      fs.copyFileSync(srcPath, tgtPath);
      console.log(`${GRAY}  [+] Synced File  : ${asset.source} -> ${asset.target}${RESET}`);
    }
  }

  return !missingRequired;
}

function verifyAssets(targetDir: string): boolean {
  console.log(`${GREEN}Verifying copied assets integrity...${RESET}`);
  let verifyFailed = false;

  for (const asset of ASSETS) {
    const srcPath = path.join(sourceDir, asset.source);
    const tgtPath = path.join(targetDir, asset.target);

    if (!fs.existsSync(srcPath)) continue;

    if (asset.isFolder) {
      for (const sf of listFilesRecursive(srcPath)) {
        const relPath = path.relative(srcPath, sf);
        const tf = path.join(tgtPath, relPath);

        if (!fs.existsSync(tf)) {
          console.error(`${RED}  [!] Missing target file: ${path.join(asset.target, relPath)}${RESET}`);
          verifyFailed = true;
          continue;
        }
        if (md5(sf) !== md5(tf)) {
          console.error(`${RED}  [!] Hash mismatch in file: ${path.join(asset.target, relPath)}${RESET}`);
          verifyFailed = true;
        }
      }
    } else {
      if (!fs.existsSync(tgtPath)) {
        console.error(`${RED}  [!] Missing target file: ${asset.target}${RESET}`);
        verifyFailed = true;
        continue;
      }
      if (md5(srcPath) !== md5(tgtPath)) {
        console.error(`${RED}  [!] Hash mismatch in file: ${asset.target}${RESET}`);
        verifyFailed = true;
      }
    }
  }

  return !verifyFailed;
}

async function commitAndPush(targetDir: string, commitMessage: string): Promise<void> {
  console.log(`${GREEN}Staging and committing in target plugin repository...${RESET}`);

  const branchRes = await $`git -C ${targetDir} rev-parse --abbrev-ref HEAD`.quiet().nothrow();
  const branch = branchRes.stdout.toString().trim();

  await $`git -C ${targetDir} add -A`.quiet().nothrow();
  const statusRes = await $`git -C ${targetDir} status --porcelain`.quiet().nothrow();
  const status = statusRes.stdout.toString().trim();

  if (!status) {
    console.log(`${YELLOW}No changes detected in plugin repository. Distribution up to date.${RESET}`);
    return;
  }

  const commitRes = await $`git -C ${targetDir} commit -m ${commitMessage}`.nothrow();
  if (commitRes.exitCode !== 0) {
    console.error(`${RED}  [!] Commit failed.${RESET}`);
    process.exit(1);
  }

  console.log(`${GREEN}Pushing to remote origin ${branch}...${RESET}`);
  const pushRes = await $`git -C ${targetDir} push origin ${branch}`.nothrow();
  if (pushRes.exitCode !== 0) {
    console.error(`${RED}  [!] Push failed.${RESET}`);
    process.exit(1);
  }

  console.log(`${GREEN}Distribution successfully pushed!${RESET}`);
}

async function main() {
  // Collapse newlines/control chars — single-line message is safe for git -m
  const commitMessage = process.argv.slice(2).join(" ").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();

  console.log(`${CYAN}--- Harness Packaging & Publishing Hook ---${RESET}`);

  const targetDir = process.env.CLAUDE_PLUGIN_ROOT;
  if (!targetDir) {
    console.error(`${RED}  [!] CLAUDE_PLUGIN_ROOT is not set.${RESET}`);
    console.error(`  [!] Usage: CLAUDE_PLUGIN_ROOT=/path/to/co-abap_plugin bun scripts/co-abap/vsp-publish.ts "<message>"`);
    process.exit(1);
  }
  if (!fs.existsSync(targetDir)) {
    console.error(`${RED}  [!] Target plugin directory '${targetDir}' does not exist.${RESET}`);
    process.exit(1);
  }

  if (!syncAssets(targetDir)) {
    console.error(`${RED}Asset sync FAILED - required source assets are missing. Aborting.${RESET}`);
    process.exit(1);
  }

  if (!verifyAssets(targetDir)) {
    console.error(`${RED}Integrity check FAILED. Assets do not match.${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}Integrity verification PASSED. All copied assets match 100%.${RESET}`);

  if (commitMessage) {
    await commitAndPush(targetDir, commitMessage);
  }

  console.log(`${GREEN}Harness packaging complete!${RESET}`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`vsp-publish: ${e}`);
    process.exit(1);
  });
}

export { main, syncAssets, verifyAssets, ASSETS };
