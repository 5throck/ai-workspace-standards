#!/usr/bin/env bun
/**
 * Translation Helper Tool for README Files
 * @version 1.0.0
 *
 * Purpose: Helps translators identify what changed between README.md versions
 * and provides guidance for updating translations.
 *
 * Usage:
 *   bun scripts/translate-readme.ts [--from README.md] [--to README_ko.md] [--dry-run]
 *
 * Features:
 *   - Shows diff between source and target files
 *   - Identifies new, modified, and deleted sections
 *   - Provides translation guidance without overwriting files
 *   - Checks hash synchronization status
 */

import { $ } from "bun";
import { readFileSync, existsSync } from "fs";
import path, { join } from "path";
import { createHash } from "node:crypto";

interface SectionChange {
    type: "new" | "modified" | "deleted";
    section: string;
    lineRange: string;
}

interface TranslationStatus {
    inSync: boolean;
    sourceHash: string | null;
    targetHash: string | null;
}

/**
 * Strips the leading frontmatter block (--- ... ---) and returns the body.
 */
function stripFrontmatter(content: string): string {
    const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
    return match ? match[1] : content;
}

/**
 * Returns the raw frontmatter block as a string, or null if absent.
 */
function extractFrontmatter(content: string): string | null {
    const match = content.match(/^(---\r?\n[\s\S]*?\r?\n---)\r?\n/);
    return match ? match[1] : null;
}

/**
 * Computes SHA-256 of the file body (content after stripping frontmatter).
 */
function computeContentHash(filePath: string): string {
    const content = readFileSync(filePath, "utf-8");
    const body = stripFrontmatter(content);
    return createHash("sha256").update(body, "utf-8").digest("hex");
}

/**
 * Reads a frontmatter field value by key, or null if not found.
 */
function getFrontmatterField(filePath: string, key: string): string | null {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8");
    const fm = extractFrontmatter(content);
    if (!fm) return null;
    const match = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : null;
}

/**
 * Checks if content hashes are synchronized between source and target.
 */
function checkHashSync(sourcePath: string, targetPath: string): TranslationStatus {
    const sourceHash = getFrontmatterField(sourcePath, "content_hash");
    const targetHash = getFrontmatterField(targetPath, "translated_from_hash");

    return {
        inSync: sourceHash === targetHash,
        sourceHash,
        targetHash,
    };
}

/**
 * Attempts to get git diff between two files.
 */
async function getGitDiff(sourcePath: string, targetPath: string): Promise<string> {
    try {
        const diffOutput = await $`git diff --no-index --unified=5 ${sourcePath} ${targetPath}`.text();
        return diffOutput;
    } catch (error: any) {
        // git diff returns exit code 1 when files differ, which is expected
        if (error.stdout) {
            return error.stdout.toString();
        }
        return "";
    }
}

/**
 * Analyzes diff to identify section changes.
 */
function analyzeSectionChanges(diff: string): SectionChange[] {
    const changes: SectionChange[] = [];
    const lines = diff.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect new sections (lines starting with +##)
        if (line.match(/^\+\s*#{1,3}\s+(.+)/)) {
            const sectionName = line.replace(/^\+\s*#{1,3}\s+/, "").trim();
            changes.push({
                type: "new",
                section: sectionName,
                lineRange: `around line ${i}`,
            });
        }

        // Detect deleted sections (lines starting with -##)
        if (line.match(/^-\s*#{1,3}\s+(.+)/)) {
            const sectionName = line.replace(/^-\s*#{1,3}\s+/, "").trim();
            changes.push({
                type: "deleted",
                section: sectionName,
                lineRange: `around line ${i}`,
            });
        }
    }

    return changes;
}

/**
 * Formats hash for display (truncated to 12 chars).
 */
function formatHash(hash: string | null): string {
    if (!hash) return "N/A";
    return hash.slice(0, 12) + "…";
}

/**
 * Displays translation guidance.
 */
function displayGuidance(
    sourcePath: string,
    targetPath: string,
    status: TranslationStatus,
    changes: SectionChange[],
    diff: string,
    dryRun: boolean
): void {
    console.log("\n📋 Translation Guide: Translation Status Check\n");

    // Hash synchronization status
    if (!status.inSync) {
        console.log("⚠️  Warning: Content hashes are out of sync!");
        console.log(`   Source content_hash:          ${formatHash(status.sourceHash)}`);
        console.log(`   Target translated_from_hash:  ${formatHash(status.targetHash)}`);
    } else {
        console.log("✅ Content hashes are synchronized.");
    }

    // Section changes
    if (changes.length > 0) {
        console.log("\nChanges detected:");
        for (const change of changes) {
            const emoji = change.type === "new" ? "➕" : change.type === "deleted" ? "🗑️" : "✏️";
            console.log(`   ${emoji} ${change.type}: "${change.section}" (${change.lineRange})`);
        }
    } else {
        console.log("\nNo section changes detected.");
    }

    // Diff preview (truncated for readability)
    if (diff.length > 0) {
        const previewLines = diff.split("\n").slice(0, 30);
        console.log("\nDiff preview (first 30 lines):");
        console.log("─".repeat(80));
        console.log(previewLines.join("\n"));
        if (diff.split("\n").length > 30) {
            console.log("\n... (diff truncated, use --full-diff to see complete output)");
        }
        console.log("─".repeat(80));
    }

    // Next steps
    console.log("\nNext steps:");
    if (!status.inSync || changes.length > 0) {
        console.log("   1. Review the changes above");
        console.log("   2. Update README_ko.md accordingly");
        console.log("   3. Update frontmatter in README_ko.md:");
        if (status.sourceHash) {
            console.log(`      translated_from_hash: ${status.sourceHash}`);
        }
        console.log("   4. Verify: bun scripts/verify-readme-sync.ts --pre-commit");
    } else {
        console.log("   ✓ No updates needed - translations are current!");
    }

    if (dryRun) {
        console.log("\n🔍 Dry-run mode: No files were modified.");
    }
}

async function main() {
    const args = process.argv.slice(2);

    let sourcePath = "README.md";
    let targetPath = "README_ko.md";
    let dryRun = false;

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--from" && i + 1 < args.length) {
            sourcePath = args[++i];
        } else if (arg === "--to" && i + 1 < args.length) {
            targetPath = args[++i];
        } else if (arg === "--dry-run" || arg === "-n") {
            dryRun = true;
        } else if (arg === "--help" || arg === "-h") {
            console.log(`
Translation Helper Tool for README Files

Usage:
  bun scripts/translate-readme.ts [options]

Options:
  --from <path>     Source README path (default: README.md)
  --to <path>       Target translation path (default: README_ko.md)
  --dry-run, -n     Preview mode without modifying files
  --help, -h        Show this help message

Features:
  - Shows diff between source and target files
  - Identifies new, modified, and deleted sections
  - Provides translation guidance without overwriting files
  - Checks hash synchronization status

Examples:
  # Preview changes between README.md and README_ko.md
  bun scripts/translate-readme.ts --dry-run

  # Check specific files
  bun scripts/translate-readme.ts --from templates/common/README.md --to templates/common/README_ko.md
`);
            process.exit(0);
        }
    }

    // Guard against path traversal: both paths must resolve within the project root
    const projectRoot = path.resolve(__dirname, '..');
    const resolvedSource = path.resolve(sourcePath);
    const resolvedTarget = path.resolve(targetPath);

    if (!resolvedSource.startsWith(projectRoot + path.sep) && resolvedSource !== projectRoot) {
        console.error('[translate-readme] Path must be within the project root.');
        process.exit(1);
    }
    if (!resolvedTarget.startsWith(projectRoot + path.sep) && resolvedTarget !== projectRoot) {
        console.error('[translate-readme] Path must be within the project root.');
        process.exit(1);
    }

    // Validate files exist
    if (!existsSync(sourcePath)) {
        console.error(`❌ Error: Source file not found: ${sourcePath}`);
        process.exit(1);
    }

    if (!existsSync(targetPath)) {
        console.error(`❌ Error: Target file not found: ${targetPath}`);
        console.error(`   Hint: Create ${targetPath} first, or check the path.`);
        process.exit(1);
    }

    // Check hash synchronization
    const status = checkHashSync(sourcePath, targetPath);

    // Get diff
    const diff = await getGitDiff(sourcePath, targetPath);

    // Analyze changes
    const changes = analyzeSectionChanges(diff);

    // Display guidance
    displayGuidance(sourcePath, targetPath, status, changes, diff, dryRun);

    process.exit(0);
}

main();