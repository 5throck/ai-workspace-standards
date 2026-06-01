#!/usr/bin/env bun
// @version 1.0.0
// vsp-publish.ts - Standardized packaging script to copy framework assets to plugin repository
// Usage:
//   bun run scripts/vsp-publish.ts --target-dir "C:/path/to/plugin" --message "feat: align with main reference implementation"
//   bun run scripts/vsp-publish.ts --target-dir "$CLAUDE_PLUGIN_ROOT" --message "feat: update plugin assets"
//
// Copies core assets to plugin repository with hash verification and optional commit/push

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
const { spawn } = await import('child_process');

// ============================================================================
// Command Line Argument Parsing
// ============================================================================

interface VspPublishArgs {
    targetDir: string;
    message: string;
}

function parseArgs(): VspPublishArgs {
    const args = process.argv.slice(2);
    const result: VspPublishArgs = {
        targetDir: '',
        message: '',
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--target-dir':
                result.targetDir = args[++i] || '';
                break;
            case '--message':
                result.message = args[++i] || '';
                break;
            case '-h':
            case '--help':
                console.log(`vsp-publish.ts - Standardized packaging script to copy framework assets to plugin repository

Usage:
  bun run scripts/vsp-publish.ts --target-dir "C:/path/to/plugin" --message "feat: align with main reference implementation"
  bun run scripts/vsp-publish.ts --target-dir "$CLAUDE_PLUGIN_ROOT" --message "feat: update plugin assets"

Parameters:
  --target-dir <path>    Target plugin directory (CLAUDE_PLUGIN_ROOT environment variable or --target-dir required)
  --message <msg>        Commit message (optional - if provided, will commit and push to plugin repo)
  -h, --help             Show this help message

Environment Variables:
  CLAUDE_PLUGIN_ROOT     Target directory for plugin assets (can be overridden with --target-dir)

Examples:
  bun run scripts/vsp-publish.ts --target-dir "C:\\plugins\\abap_vibe_coding_plugin" --message "feat: update framework"
  bun run scripts/vsp-publish.ts --message "chore: sync assets" (uses CLAUDE_PLUGIN_ROOT env var)
`);
                process.exit(0);
            default:
                console.error(`Unknown argument: ${arg}`);
                console.error('Use --help for usage information');
                process.exit(1);
        }
    }

    return result;
}

// ============================================================================
// Color Helpers
// ============================================================================

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function Pass(msg: string) {
    console.log(`${GREEN}✓ ${msg}${RESET}`);
}

function Fail(msg: string) {
    console.error(`${RED}✗ ${msg}${RESET}`);
}

function Warn(msg: string) {
    console.warn(`${YELLOW}⚠ ${msg}${RESET}`);
}

function Phase(msg: string) {
    console.log(`${CYAN}${msg}${RESET}`);
}

// ============================================================================
// Core Functionality
// ============================================================================

interface AssetConfig {
    source: string;
    target: string;
    isFolder: boolean;
}

/**
 * Main packaging and publishing logic
 *
 * Steps:
 * 1. Resolve and validate target directory
 * 2. Define assets to copy (folders and files)
 * 3. Copy each asset with proper directory structure
 * 4. Verify integrity with hash checking
 * 5. Optional: Commit and push to plugin repository
 *
 * @param targetDir - Target plugin directory path
 * @param commitMessage - Optional commit message for plugin repository
 * @returns true if successful, false if failed
 */
async function publishAssets(targetDir: string, commitMessage: string): Promise<boolean> {
    const startTime = Date.now();
    Phase('--- Harness Packaging & Publishing Hook ---');

    const scriptRoot = __dirname;
    const sourceDir = path.dirname(scriptRoot);

    // 1. Resolve and validate target directory
    if (!targetDir) {
        Fail('CLAUDE_PLUGIN_ROOT is not set and --target-dir was not provided.');
        Fail('Usage: $env:CLAUDE_PLUGIN_ROOT=\'C:\\path\\to\\abap_vibe_coding_plugin\' bun run scripts/vsp-publish.ts --message "<message>"');
        return false;
    }

    if (!fs.existsSync(targetDir)) {
        Fail(`Target plugin directory '${targetDir}' does not exist.`);
        return false;
    }

    // 2. Define Assets to Copy
    const assets: AssetConfig[] = [
        { source: 'agents', target: 'agents', isFolder: true },
        { source: 'skills', target: 'skills', isFolder: true },
        { source: '.claude/commands', target: 'commands', isFolder: true },
        { source: 'docs/prd-template.md', target: 'docs/prd-template.md', isFolder: false },
        { source: 'docs/task-template.md', target: 'docs/task-template.md', isFolder: false },
        { source: 'docs/plugin-setup.md', target: 'docs/plugin-setup.md', isFolder: false },
        { source: 'scripts/install-vsp.ps1', target: 'scripts/install-vsp.ps1', isFolder: false },
        { source: 'scripts/install-vsp.sh', target: 'scripts/install-vsp.sh', isFolder: false },
        { source: 'scripts/sync-md.ps1', target: 'scripts/sync-md.ps1', isFolder: false },
        { source: 'scripts/sync-md.sh', target: 'scripts/sync-md.sh', isFolder: false },
        { source: 'scripts/vsp-audit.ps1', target: 'scripts/vsp-audit.ps1', isFolder: false },
        { source: 'scripts/vsp-audit.sh', target: 'scripts/vsp-audit.sh', isFolder: false },
        { source: 'scripts/vsp-sync.ps1', target: 'scripts/vsp-sync.ps1', isFolder: false },
        { source: 'scripts/vsp-sync.sh', target: 'scripts/vsp-sync.sh', isFolder: false },
        { source: 'scripts/vsp-task.ps1', target: 'scripts/vsp-task.ps1', isFolder: false },
        { source: 'scripts/vsp-task.sh', target: 'scripts/vsp-task.sh', isFolder: false },
        { source: '.mcp.json.sample', target: '.mcp.json.sample', isFolder: false }
    ];

    // 3. Copy assets
    Pass('Copying core assets to plugin...');
    const copyResults = copyAssets(sourceDir, targetDir, assets);
    if (!copyResults.success) {
        Fail('Asset copying failed');
        return false;
    }

    // 4. Hash verification
    Pass('Verifying copied assets integrity...');
    const verifyResult = verifyAssetIntegrity(sourceDir, targetDir, assets);
    if (!verifyResult.success) {
        Fail('Integrity check FAILED. Assets do not match.');
        return false;
    }

    // 5. Commit and push (optional)
    if (commitMessage) {
        if (!await commitAndPush(targetDir, commitMessage)) {
            Fail('Failed to commit and push to plugin repository');
            return false;
        }
    }

    const duration = (Date.now() - startTime) / 1000;
    Pass(`Harness packaging complete! (${duration.toFixed(1)}s)`);
    return true;
}

/**
 * Copies assets from source to target directory
 *
 * @param sourceDir - Source directory path
 * @param targetDir - Target directory path
 * @param assets - Array of asset configurations
 * @returns Object containing success status and any errors
 */
function copyAssets(sourceDir: string, targetDir: string, assets: AssetConfig[]): { success: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const asset of assets) {
        const srcPath = path.join(sourceDir, asset.source);
        const tgtPath = path.join(targetDir, asset.target);

        if (!fs.existsSync(srcPath)) {
            Warn(`Source path '${srcPath}' not found. Skipping.`);
            continue;
        }

        try {
            if (asset.isFolder) {
                // Clean target directory first to prevent orphaned files
                if (fs.existsSync(tgtPath)) {
                    fs.rmSync(tgtPath, { recursive: true, force: true });
                }
                fs.mkdirSync(tgtPath, { recursive: true });
                copyDirectory(srcPath, tgtPath);
                console.log(`  [+] Synced Folder: ${asset.source} -> ${asset.target}`);
            } else {
                const parentTgt = path.dirname(tgtPath);
                if (!fs.existsSync(parentTgt)) {
                    fs.mkdirSync(parentTgt, { recursive: true });
                }
                fs.copyFileSync(srcPath, tgtPath);
                console.log(`  [+] Synced File  : ${asset.source} -> ${asset.target}`);
            }
        } catch (error) {
            errors.push(`Failed to copy ${asset.source}: ${error}`);
            Fail(`  [!] Error copying ${asset.source}: ${error}`);
        }
    }

    return { success: errors.length === 0, errors };
}

/**
 * Recursively copies directory contents
 *
 * @param src - Source directory path
 * @param dest - Destination directory path
 */
function copyDirectory(src: string, dest: string): void {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Verifies asset integrity using MD5 hash comparison
 *
 * @param sourceDir - Source directory path
 * @param targetDir - Target directory path
 * @param assets - Array of asset configurations
 * @returns Object containing success status and any errors
 */
function verifyAssetIntegrity(sourceDir: string, targetDir: string, assets: AssetConfig[]): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    let verifyFailed = false;

    for (const asset of assets) {
        const srcPath = path.join(sourceDir, asset.source);
        const tgtPath = path.join(targetDir, asset.target);

        if (!fs.existsSync(srcPath)) {
            continue;
        }

        try {
            if (asset.isFolder) {
                // Verify all files in the folder
                const srcFiles = getAllFiles(srcPath);
                for (const sfPath of srcFiles) {
                    const relPath = path.relative(srcPath, sfPath);
                    const tfPath = path.join(tgtPath, relPath);

                    if (!fs.existsSync(tfPath)) {
                        errors.push(`Missing target file: ${asset.target}${path.sep}${relPath}`);
                        console.log(`  [!] Missing target file: ${asset.target}${path.sep}${relPath}`);
                        verifyFailed = true;
                        continue;
                    }

                    const srcHash = md5File(sfPath);
                    const tgtHash = md5File(tfPath);
                    if (srcHash !== tgtHash) {
                        errors.push(`Hash mismatch in file: ${asset.target}${path.sep}${relPath}`);
                        console.log(`  [!] Hash mismatch in file: ${asset.target}${path.sep}${relPath}`);
                        verifyFailed = true;
                    }
                }
            } else {
                // Verify single file
                if (!fs.existsSync(tgtPath)) {
                    errors.push(`Missing target file: ${asset.target}`);
                    console.log(`  [!] Missing target file: ${asset.target}`);
                    verifyFailed = true;
                    continue;
                }

                const srcHash = md5File(srcPath);
                const tgtHash = md5File(tgtPath);
                if (srcHash !== tgtHash) {
                    errors.push(`Hash mismatch in file: ${asset.target}`);
                    console.log(`  [!] Hash mismatch in file: ${asset.target}`);
                    verifyFailed = true;
                }
            }
        } catch (error) {
            errors.push(`Error verifying ${asset.source}: ${error}`);
            Fail(`  [!] Error verifying ${asset.source}: ${error}`);
        }
    }

    if (!verifyFailed) {
        Pass('Integrity verification PASSED. All copied assets match 100%.');
    }

    return { success: !verifyFailed, errors };
}

/**
 * Gets all files in a directory recursively
 *
 * @param dir - Directory path
 * @returns Array of file paths
 */
function getAllFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getAllFiles(fullPath));
        } else {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Calculates MD5 hash of a file
 *
 * @param filePath - File path
 * @returns MD5 hash string
 */
function md5File(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

/**
 * Commits and pushes changes to plugin repository
 *
 * @param targetDir - Target plugin directory path
 * @param commitMessage - Commit message
 * @returns true if successful, false if failed
 */
async function commitAndPush(targetDir: string, commitMessage: string): Promise<boolean> {
    const currDir = process.cwd();

    try {
        process.chdir(targetDir);
        Pass('Staging and committing in target plugin repository...');

        const { spawn } = await import('child_process');
        const git = (cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
            return new Promise((resolve, reject) => {
                const process = spawn(cmd, args, { encoding: 'utf8' });
                let stdout = '';
                let stderr = '';

                process.stdout.on('data', (data) => stdout += data);
                process.stderr.on('data', (data) => stderr += data);
                process.on('close', (code) => resolve({ stdout, stderr, exitCode: code || 0 }));
                process.on('error', (error) => reject(error));
            });
        };

        // Get current branch
        const branchResult = await git('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
        const branch = branchResult.stdout.trim();

        // Add all files
        await git('git', ['add', '-A']);

        // Check if there are changes
        const statusResult = await git('git', ['status', '--porcelain']);
        if (statusResult.stdout.trim() === '') {
            Warn('No changes detected in plugin repository. Distribution up to date.');
            return true;
        }

        // Commit and push
        await git('git', ['commit', '-m', commitMessage]);
        Pass(`Commit successful: ${commitMessage}`);

        await git('git', ['push', 'origin', branch]);
        Pass('Pushed to remote origin ' + branch);
        Pass('Distribution successfully pushed!');

        return true;
    } catch (error) {
        Fail(`Failed to commit and push inside the target repository: ${error}`);
        return false;
    } finally {
        process.chdir(currDir);
    }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
    const startTime = Date.now();
    const args = parseArgs();

    console.log(`${CYAN}=== VSP Publish ===${RESET}`);
    if (args.targetDir) {
        console.log(`Target directory: ${args.targetDir}`);
    }
    if (args.message) {
        console.log(`Commit message: ${args.message}`);
    }
    console.log('');

    // Use CLAUDE_PLUGIN_ROOT env var if targetDir not provided
    const targetDir = args.targetDir || process.env.CLAUDE_PLUGIN_ROOT || '';

    // Bun.spawn is imported at the top

    publishAssets(targetDir, args.message).then((success) => {
        const duration = (Date.now() - startTime) / 1000;

        if (success) {
            if (!args.message) {
                console.log(`${GREEN}Summary: Assets copied successfully in ${duration.toFixed(1)}s${RESET}`);
            } else {
                Pass(`Summary: Distribution completed in ${duration.toFixed(1)}s`);
            }
        } else {
            Fail(`Summary: Publishing failed after ${duration.toFixed(1)}s`);
            process.exit(1);
        }
    }).catch((error) => {
        const duration = (Date.now() - startTime) / 1000;
        Fail(`Summary: Publishing failed after ${duration.toFixed(1)}s - ${error}`);
        process.exit(1);
    });
}

// Execute main function
try {
    await main();
} catch (error) {
    console.error(`${RED}Fatal error: ${error}${RESET}`);
    process.exit(1);
}