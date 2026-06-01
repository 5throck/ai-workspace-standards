#!/usr/bin/env bun
/**
 * @file        git-sync.ts
 * @summary     Commits and pushes all changes to the current branch
 * @version     1.0.0
 * @license     MIT
 * @description Platform-neutral git sync script using Bun shell commands.
 *              Supports custom commit messages via CLI argument.
 *              Validates git repository status and handles errors gracefully.
 *
 * @usage       bun scripts/git-sync.ts [message]
 * @example     bun scripts/git-sync.ts "feat: add new feature"
 * @example     bun scripts/git-sync.ts
 *
 * @features
 * - Cross-platform git operations (Windows, macOS, Linux)
 * - Automatic branch detection
 * - Colored terminal output (success, warning, error)
 * - Change detection before commit
 * - Graceful error handling
 * - Default commit message with override option
 *
 * @author      Automation Engineer
 * @copyright   2026
 */

import { $ } from 'bun';
import chalk from 'chalk';

/**
 * GitSync configuration interface
 */
interface GitSyncConfig {
  message: string;
}

/**
 * Parse command-line arguments
 */
function parseArgs(): GitSyncConfig {
  const args = process.argv.slice(2);
  const message = args[0] || 'chore: auto-sync documentation and configuration';
  return { message };
}

/**
 * Get current git branch name
 */
async function getCurrentBranch(): Promise<string> {
  try {
    const result = await $`git rev-parse --abbrev-ref HEAD`.quiet();
    return result.stdout.toString().trim();
  } catch (error) {
    throw new Error('Failed to get current branch. Are you in a git repository?');
  }
}

/**
 * Check if there are changes to commit
 */
async function hasChanges(): Promise<boolean> {
  try {
    const result = await $`git status --porcelain`.quiet();
    return result.stdout.toString().trim().length > 0;
  } catch (error) {
    throw new Error('Failed to check git status');
  }
}

/**
 * Stage all changes
 */
async function stageChanges(): Promise<void> {
  try {
    await $`git add -A`.quiet();
  } catch (error) {
    throw new Error('Failed to stage changes');
  }
}

/**
 * Commit changes with message
 */
async function commitChanges(message: string): Promise<void> {
  try {
    const result = await $`git commit -m ${message}`.quiet();
    if (result.exitCode !== 0) {
      throw new Error('Git commit failed');
    }
  } catch (error) {
    throw new Error('Failed to commit changes');
  }
}

/**
 * Push changes to remote
 */
async function pushChanges(branch: string): Promise<void> {
  try {
    await $`git push origin ${branch}`.quiet();
  } catch (error) {
    throw new Error(`Failed to push changes to origin/${branch}`);
  }
}

/**
 * Main git sync workflow
 */
async function gitSync(config: GitSyncConfig): Promise<void> {
  console.log(chalk.cyan('--- Git Sync ---'));

  try {
    // Get current branch
    const branch = await getCurrentBranch();
    console.log(chalk.blue(`Branch: ${branch}`));

    // Stage all changes
    await stageChanges();

    // Check if there are changes to commit
    const changesExist = await hasChanges();

    if (changesExist) {
      // Commit and push
      await commitChanges(config.message);
      await pushChanges(branch);
      console.log(chalk.green('✓ Successfully synced to Git'));
    } else {
      console.log(chalk.yellow('No changes to sync'));
    }

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('✗ Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Entry point - parse args and execute
 */
(async () => {
  const config = parseArgs();
  await gitSync(config);
})();

