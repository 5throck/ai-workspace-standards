#!/usr/bin/env bun
// @version 1.0.0
// vsp-task.ts - Creates new task file in scratch/tasks/ from template
// Usage:
//   bun run scripts/vsp-task.ts --name "task-name"
//   bun run scripts/vsp-task.ts --name "feature-request"
//
// Creates task-YYYY-MM-DD-NNN.md with sequential numbering and path adjustments

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Command Line Argument Parsing
// ============================================================================

interface VspTaskArgs {
    name: string;
}

function parseArgs(): VspTaskArgs {
    const args = process.argv.slice(2);
    const result: VspTaskArgs = {
        name: 'new-task',
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--name':
                result.name = args[++i] || '';
                break;
            case '-h':
            case '--help':
                console.log(`vsp-task.ts - Creates new task file in scratch/tasks/ from template

Usage:
  bun run scripts/vsp-task.ts --name "task-name"
  bun run scripts/vsp-task.ts --name "feature-request"

Parameters:
  --name <name>    Task name (default: "new-task")
  -h, --help       Show this help message

Example:
  bun run scripts/vsp-task.ts --name "add-customer-report"
  Creates: scratch/tasks/task-YYYY-MM-DD-001.md
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

/**
 * Creates a new task file in scratch/tasks/ from template with sequential numbering
 *
 * Main logic:
 * 1. Get current date in YYYY-MM-DD format
 * 2. Check/create scratch/tasks/ directory
 * 3. Find next sequence number from existing files
 * 4. Load template from docs/task-template.md or fallback to minimal template
 * 5. Replace placeholders (date/time, user request)
 * 6. Adjust relative paths for depth (docs/ vs scratch/tasks/)
 * 7. Write file to scratch/tasks/
 *
 * @param taskName - Task name to include in the file
 * @returns Path to created task file
 */
function createTaskFile(taskName: string): string {
    const scriptRoot = __dirname;
    const workspaceRoot = path.dirname(scriptRoot);

    // 1. Get current date in YYYY-MM-DD format
    const date = new Date().toISOString().split('T')[0];
    const dateTime = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    // 2. Define paths
    const scratchDir = path.join(workspaceRoot, 'scratch', 'tasks');
    const templateFile = path.join(workspaceRoot, 'docs', 'task-template.md');
    const nextSeq = findNextSequenceNumber(scratchDir, date);
    const seqStr = nextSeq.toString().padStart(3, '0');
    const targetFileName = `task-${date}-${seqStr}.md`;
    const targetFilePath = path.join(scratchDir, targetFileName);

    // 3. Create scratch directory if it doesn't exist
    if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
        Pass(`Created directory: ${scratchDir}`);
    }

    // 4. Load template or create minimal fallback
    let content: string;
    if (!fs.existsSync(templateFile)) {
        Warn('task-template.md not found. Using minimal template.');
        content = generateMinimalTemplate(dateTime, taskName);
    } else {
        content = fs.readFileSync(templateFile, 'utf-8');
        content = replaceTemplatePlaceholders(content, dateTime, taskName);
    }

    // 5. Write the file
    fs.writeFileSync(targetFilePath, content, 'utf-8');
    Pass(`Created new task: ${targetFileName}`);
    Pass(`Path: ${targetFilePath}`);

    return targetFilePath;
}

/**
 * Finds the next available sequence number for task files
 *
 * @param scratchDir - Path to scratch/tasks directory
 * @param date - Current date in YYYY-MM-DD format
 * @returns Next sequence number (1-based, zero-padded to 3 digits)
 */
function findNextSequenceNumber(scratchDir: string, date: string): number {
    if (!fs.existsSync(scratchDir)) {
        return 1;
    }

    try {
        const files = fs.readdirSync(scratchDir);
        const matchingFiles = files.filter(file => file.startsWith(`task-${date}-`));

        if (matchingFiles.length === 0) {
            return 1;
        }

        // Extract sequence numbers from file names
        const sequenceNumbers = matchingFiles
            .map(file => {
                const match = file.match(/task-${date}-(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(num => !isNaN(num));

        if (sequenceNumbers.length === 0) {
            return 1;
        }

        const maxSequence = Math.max(...sequenceNumbers);
        return maxSequence + 1;
    } catch (error) {
        Warn(`Error reading scratch directory: ${error}`);
        return 1;
    }
}

/**
 * Replaces template placeholders with actual values
 *
 * @param content - Template content string
 * @param dateTime - Current date and time in YYYY-MM-DD HH:mm:ss format
 * @param taskName - Task name to insert
 * @returns Template content with placeholders replaced
 */
function replaceTemplatePlaceholders(content: string, dateTime: string, taskName: string): string {
    // Replace date and time placeholder
    content = content.replace('<!-- date and time -->', dateTime);

    // Replace user request placeholder
    content = content.replace('<!-- paste original user request verbatim -->', `Request for: ${taskName}`);

    // Adjust relative paths since task is created in scratch/tasks/ (two levels deep) instead of docs/ (one level deep)
    content = content.replace(/\]\(\.\.\/skills\//g, '](../../skills/');

    return content;
}

/**
 * Generates minimal template when task-template.md is not found
 *
 * @param dateTime - Current date and time
 * @param taskName - Task name to insert
 * @returns Minimal template content
 */
function generateMinimalTemplate(dateTime: string, taskName: string): string {
    return `# Task —${dateTime}

## 0. Request

**Received by (PM)**: ${dateTime}
**User Request**:
> Request for: ${taskName}

**Classification**: <!-- Debug / Graph Analysis / Interface / Infra / ABAP Dev -->
**Package**: \`$TMP\`

## 1. Business Analysis

## 2. Technical Design

## 3. Implementation Log

## 4. QA / Test Results

## 5. Finalization
`;
}

// ============================================================================
// Main Execution
// ============================================================================

function main() {
    const startTime = Date.now();
    const args = parseArgs();

    console.log(`${CYAN}=== VSP Task Creator ===${RESET}`);
    console.log(`Task name: ${args.name}`);
    console.log('');

    try {
        const targetFilePath = createTaskFile(args.name);

        const duration = (Date.now() - startTime) / 1000;
        Pass(`Task creation completed (${duration.toFixed(1)}s)`);
    } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        Fail(`Task creation failed (${duration.toFixed(1)}s) - ${error}`);
        process.exit(1);
    }
}

// Execute main function
try {
    main();
} catch (error) {
    console.error(`${RED}Fatal error: ${error}${RESET}`);
    process.exit(1);
}