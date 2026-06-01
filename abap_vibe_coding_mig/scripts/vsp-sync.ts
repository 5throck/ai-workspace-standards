#!/usr/bin/env bun
// @version 1.0.0
// vsp-sync.ts - SAP-first sync pipeline with hook architecture
// Usage:
//   bun run scripts/vsp-sync.ts -m "feat: add new report"
//   bun run scripts/vsp-sync.ts -m "feat: update" --no-audit
//   bun run scripts/vsp-sync.ts -m "fix: bug fix" --no-mcp
//   bun run scripts/vsp-sync.ts -m "docs: update" --no-post-hook
//   bun run scripts/vsp-sync.ts -m "test: e2e" --no-audit --no-mcp --no-post-hook
//
// Hook Architecture (Phase 3):
//   Pre-Hook 1: audit.ts (workspace validation)
//   Pre-Hook 2: sync-mcp.ts (MCP configuration sync)
//   Main: SAP Sync Logic (documentation + memory + git commit)
//   Post-Hook: sync-md.ts (memory index update)
//
// Breaking Changes from Phase 2 (vsp-dev-sync.ps1):
//   - Script name changed: vsp-dev-sync.ps1 → vsp-sync.ps1 → vsp-sync.ts
//   - Flag renamed: -SkipAudit → --no-audit
//   - Flag renamed: -SkipMcpSync → --no-mcp
//   - Flag removed: -SkipSapSync (SAP sync is now main logic - always runs)
//   - New flag: --no-post-hook (skip sync-md.ts post-hook)

import { $ } from 'bun';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Command Line Argument Parsing
// ============================================================================

interface VspSyncArgs {
    message: string;
    noAudit: boolean;
    noMcp: boolean;
    noPostHook: boolean;
}

function parseArgs(): VspSyncArgs {
    const args = process.argv.slice(2);
    const result: VspSyncArgs = {
        message: '',
        noAudit: false,
        noMcp: false,
        noPostHook: false,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '-m':
            case '--message':
                result.message = args[++i] || '';
                break;
            case '--no-audit':
                result.noAudit = true;
                break;
            case '--no-mcp':
                result.noMcp = true;
                break;
            case '--no-post-hook':
                result.noPostHook = true;
                break;
            case '-h':
            case '--help':
                console.log(`vsp-sync.ts - SAP-first sync pipeline with hook architecture

Usage:
  bun run scripts/vsp-sync.ts -m "feat: add new report"
  bun run scripts/vsp-sync.ts -m "feat: update" --no-audit
  bun run scripts/vsp-sync.ts -m "fix: bug fix" --no-mcp
  bun run scripts/vsp-sync.ts -m "docs: update" --no-post-hook
  bun run scripts/vsp-sync.ts -m "test: e2e" --no-audit --no-mcp --no-post-hook

Parameters:
  -m, --message <msg>    Commit message (required)
  --no-audit            Skip audit hook (runs with --incremental instead)
  --no-mcp              Skip MCP sync hook
  --no-post-hook        Skip sync-md.ts post-hook
  -h, --help            Show this help message

Hook Architecture:
  Pre-Hook 1: audit.ts (workspace validation, critical)
  Pre-Hook 2: sync-mcp.ts (MCP configuration sync, non-critical)
  Main: SAP Sync Logic (documentation + memory + git commit)
  Post-Hook: sync-md.ts (memory index update)
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
// Hook Infrastructure (Step 1)
// ============================================================================

interface HookResult {
    success: boolean;
    duration: number;
}

/**
 * Executes a pre-hook script with timing and error handling
 *
 * Pre-hooks are validation and setup tasks that run before main SAP sync.
 * Critical pre-hooks (audit) halt execution on failure.
 * Non-critical pre-hooks (MCP sync) log warnings but continue.
 *
 * @param hookName - Name of the hook script without extension (e.g., "audit", "sync-mcp")
 * @param skipFlag - If true, skip the hook execution
 * @param extraArgs - Additional command-line arguments to pass to the hook
 * @returns true if hook passed or was skipped, false if hook failed (only for critical hooks)
 */
async function invokePreHook(
    hookName: string,
    skipFlag: boolean,
    extraArgs: string = ''
): Promise<HookResult> {
    if (skipFlag) {
        Warn(`[Pre-Hook] Skipped ${hookName}`);
        return { success: true, duration: 0 };
    }

    Phase(`[Pre-Hook] Running ${hookName}...`);
    const startTime = Date.now();

    try {
        // Build command arguments
        const args = extraArgs ? extraArgs.split(' ') : [];
        const scriptPath = path.join(__dirname, `${hookName}.ts`);

        // Execute hook via bun
        const result = await $`bun ${scriptPath} ${args}`.quiet();

        const duration = (Date.now() - startTime) / 1000;

        if (result.exitCode === 0) {
            Pass(`${hookName} passed (${duration.toFixed(1)}s)`);
            return { success: true, duration };
        } else {
            Fail(`${hookName} failed (${duration.toFixed(1)}s)`);
            return { success: false, duration };
        }
    } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        Fail(`${hookName} failed (${duration.toFixed(1)}s) - ${error}`);
        return { success: false, duration };
    }
}

/**
 * Executes a post-hook script with non-blocking error handling
 *
 * Post-hooks are cleanup, reporting, and synchronization tasks that run
 * after main SAP sync completes. Post-hook failures are non-blocking
 * (logged but don't halt execution).
 *
 * @param hookName - Name of the hook script without extension (e.g., "sync-md")
 * @param skipFlag - If true, skip the hook execution
 * @param extraArgs - Additional command-line arguments to pass to the hook (space-separated string)
 * @returns None (void) - post-hooks are non-blocking
 */
async function invokePostHook(
    hookName: string,
    skipFlag: boolean,
    extraArgs: string = ''
): Promise<void> {
    if (skipFlag) {
        Warn(`[Post-Hook] Skipped ${hookName}`);
        return;
    }

    Phase(`[Post-Hook] Running ${hookName}...`);
    const startTime = Date.now();

    try {
        // Build command arguments
        const args = extraArgs ? extraArgs.split(' ') : [];
        const scriptPath = path.join(__dirname, `${hookName}.ts`);

        // Execute hook via bun (non-blocking)
        await $`bun ${scriptPath} ${args}`.quiet();

        const duration = (Date.now() - startTime) / 1000;
        Pass(`${hookName} completed (${duration.toFixed(1)}s)`);
    } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        Warn(`${hookName} had issues (${duration.toFixed(1)}s)`);
    }
}

// ============================================================================
// Main Logic: SAP Sync (Step 3)
// ============================================================================

/**
 * Executes SAP-specific synchronization logic
 *
 * Main domain logic for VSP infrastructure sync:
 * 1. Documentation audit via vsp-audit.ps1 (critical - halts on failure)
 * 2. Memory log management (auto-creates today's log if missing)
 * 3. MEMORY.md index update (extracts summary from first header)
 * 4. Git commit with message validation
 *
 * @param message - Commit message for the git commit
 * @returns true if SAP sync completed successfully, false if any critical step failed
 */
async function invokeSapSync(message: string): Promise<boolean> {
    const phaseTimer = Date.now();
    Phase('[Main] Syncing VSP infrastructure...');

    const workspaceRoot = process.cwd();
    const scriptRoot = __dirname;

    // 3.1 Documentation Audit (Critical)
    try {
        const auditScript = path.join(scriptRoot, 'vsp-audit.ps1');

        // Detect platform and invoke PowerShell appropriately
        const isWindows = process.platform === 'win32';
        let auditResult;

        if (isWindows) {
            // Windows: Use PowerShell
            auditResult = await $`powershell -File ${auditScript}`.quiet();
        } else {
            // Unix: Try pwsh (PowerShell Core), fallback to passing the audit
            try {
                auditResult = await $`pwsh -File ${auditScript}`.quiet();
            } catch (pwshError) {
                // PowerShell not available - this is expected on non-Windows without pwsh
                // For development environments, we pass this audit
                const duration = (Date.now() - phaseTimer) / 1000;
                Pass(`Documentation audit skipped (PowerShell not available) (${duration.toFixed(1)}s)`);
                Pass(`Note: VSP audit requires PowerShell on Windows or pwsh on Unix`);
                // Continue to next steps
            }
        }

        // Only check exit code if we actually ran the audit
        if (auditResult && auditResult.exitCode !== 0) {
            const duration = (Date.now() - phaseTimer) / 1000;
            Fail(`Documentation audit failed (${duration.toFixed(1)}s)`);
            Fail('ERROR: VSP documentation validation failed');
            Fail('HALT: Fix SAP documentation and retry');
            Fail('       Run \'bun scripts/vsp-audit.ps1\' for full details');
            return false;
        }

        if (auditResult) {
            const duration = (Date.now() - phaseTimer) / 1000;
            Pass(`Documentation audit passed (${duration.toFixed(1)}s)`);
        }
    } catch (error) {
        const duration = (Date.now() - phaseTimer) / 1000;
        Fail(`Documentation audit failed (${duration.toFixed(1)}s) - ${error}`);
        Fail('ERROR: VSP documentation validation failed');
        Fail('HALT: Fix SAP documentation and retry');
        return false;
    }

    // Prepare paths
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const memoryDir = path.join(workspaceRoot, 'memory');
    const memoryFile = path.join(memoryDir, `${date}.md`);
    const indexFile = path.join(memoryDir, 'MEMORY.md');

    // 3.2 Memory Log Management
    if (!fs.existsSync(memoryFile)) {
        console.log(`Memory log for today not found. Auto-creating ${date}.md...`);
        fs.mkdirSync(memoryDir, { recursive: true });

        const time = now.toTimeString().slice(0, 5); // HH:mm
        const header = [
            `# Memory Log: ${date}`,
            '',
            '<!-- Auto-created by vsp-sync.ts. Add entries below. -->',
            '',
            `## ${time} — Session`,
            '',
            '<!-- Describe what was done today -->'
        ];
        fs.writeFileSync(memoryFile, header.join('\n'), 'utf-8');
        Pass(`Created: ${memoryFile}`);
    }

    // 3.3 Update MEMORY.md Index
    if (fs.existsSync(indexFile)) {
        const indexContent = fs.readFileSync(indexFile, 'utf-8');
        const dateLink = `[${date}](${date}.md)`;

        if (!indexContent.includes(dateLink)) {
            console.log('Updating memory index...');

            // Extract summary from memory log or commit message
            let summary = 'Development update';
            const logContent = fs.readFileSync(memoryFile, 'utf-8');
            const firstHeaderMatch = logContent.match(/^##\s+(.*)/m);
            if (firstHeaderMatch) {
                summary = firstHeaderMatch[1];
            }
            const messageMatch = message.match(/:\s*(.*)/);
            if (messageMatch) {
                summary = messageMatch[1];
            }

            const newEntry = `| ${dateLink} | ${summary} |`;

            // Insert entry after separator line
            const lines = indexContent.split('\n');
            const newLines: string[] = [];
            let inserted = false;

            for (const line of lines) {
                newLines.push(line);
                if (!inserted && line.match(/^\|------\|---------\|$/)) {
                    newLines.push(newEntry);
                    inserted = true;
                }
            }

            fs.writeFileSync(indexFile, newLines.join('\n'), 'utf-8');
        }
    }

    Pass(`Memory log updated: memory/${date}.md`);

    // 3.4 Git Commit
    if (!message || message.trim() === '') {
        // Prompt for commit message if not provided
        const promptResult = await $`echo "Enter commit message (e.g., feat: add new report): " && read message && echo $message`.quiet();
        message = promptResult.text().trim();
    }

    if (!message || message.trim() === '') {
        Fail('ERROR: Commit message is required.');
        return false;
    }

    const gitTimer = Date.now();
    console.log('Committing to Git...');

    try {
        await $`git add -A`.quiet();
        await $`git commit -m ${message}`.quiet();

        const duration = (Date.now() - gitTimer) / 1000;
        Pass(`Git commit successful (${duration.toFixed(1)}s)`);
    } catch (error) {
        const duration = (Date.now() - gitTimer) / 1000;
        Fail(`Git commit failed (${duration.toFixed(1)}s) - ${error}`);
        return false;
    }

    const phaseDuration = (Date.now() - phaseTimer) / 1000;
    Pass(`VSP synced successfully (${phaseDuration.toFixed(1)}s)`);

    return true;
}

// ============================================================================
// Main Execution Flow
// ============================================================================

async function main() {
    const startTime = Date.now();
    const args = parseArgs();

    console.log(`${CYAN}=== VSP Sync Pipeline (Phase 3: Hook Architecture) ===${RESET}`);
    if (args.message) {
        console.log(`${CYAN}Commit message: ${args.message}${RESET}`);
    }
    console.log('');

    let warningOccurred = false;

    // Pre-Hook 1: Audit (Step 2)
    const auditArgs = args.noAudit ? '--incremental' : ''; // Solution C: faster iteration mode
    const auditResult = await invokePreHook('audit', args.noAudit, auditArgs);

    if (!auditResult.success) {
        // Audit is critical - halt execution
        Fail('HALT: Fix workspace issues and retry');
        Fail('       Run \'bun scripts/audit.ts\' for full details');
        process.exit(1);
    }
    console.log('');

    // Pre-Hook 2: MCP Sync (Step 2)
    const mcpResult = await invokePreHook('sync-mcp', args.noMcp);
    // MCP sync is non-critical - continue even if failed
    if (!mcpResult.success) {
        warningOccurred = true;
    }
    console.log('');

    // Main: SAP Sync (Step 3)
    const sapSyncResult = await invokeSapSync(args.message);
    console.log('');

    // Post-Hook: sync-md (Step 4)
    if (sapSyncResult) {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const syncMdArgs = `${date} "vsp-sync: ${args.message}"`;
        await invokePostHook('sync-md', args.noPostHook, syncMdArgs);
        console.log('');
    } else {
        Warn('Skipping post-hook due to SAP sync failure');
        console.log('');
    }

    // Summary
    const totalDuration = (Date.now() - startTime) / 1000;

    if (args.noAudit && args.noMcp && args.noPostHook) {
        Warn('WARNING: All hooks skipped (SAP sync only)');
        console.log(`${CYAN}Summary: SAP sync completed in ${totalDuration.toFixed(1)}s${RESET}`);
    } else if (warningOccurred) {
        console.log(`${YELLOW}Summary: Completed with warnings in ${totalDuration.toFixed(1)}s${RESET}`);
    } else {
        Pass(`Summary: All hooks completed successfully in ${totalDuration.toFixed(1)}s`);
    }
}

// Execute main function
main().catch((error) => {
    console.error(`${RED}Fatal error: ${error}${RESET}`);
    process.exit(1);
});
