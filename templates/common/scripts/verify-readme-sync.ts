// @version 1.1.1
import { $ } from "bun";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { createHash } from "node:crypto";

// Dynamic variant detection from templates/ directory
const variantDirs = existsSync('templates')
  ? readdirSync('templates')
      .filter(d => d.startsWith('co-') && statSync(`templates/${d}`).isDirectory())
      .map(d => `templates/${d}`)
  : [];

const REQUIRED_DIRS = [".", "templates/common", ...variantDirs];

/** Strips the leading frontmatter block (--- ... ---) and returns the body. */
function stripFrontmatter(content: string): string {
    const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
    return match ? match[1] : content;
}

/** Returns the raw frontmatter block as a string, or null if absent. */
function extractFrontmatter(content: string): string | null {
    const match = content.match(/^(---\r?\n[\s\S]*?\r?\n---)\r?\n/);
    return match ? match[1] : null;
}

/** Reads a frontmatter field value by key, or null if not found. */
function getFrontmatterField(filePath: string, key: string): string | null {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8");
    const fm = extractFrontmatter(content);
    if (!fm) return null;
    const match = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : null;
}

/** Returns true if the file has ANY frontmatter block (--- ... ---). */
function hasFrontmatter(filePath: string): boolean {
    if (!existsSync(filePath)) return false;
    const content = readFileSync(filePath, "utf-8");
    return /^---\r?\n[\s\S]*?\r?\n---/.test(content);
}

/**
 * Computes SHA-256 of the file body (content after stripping frontmatter).
 * Returns hex string.
 */
export function computeContentHash(filePath: string): string {
    const content = readFileSync(filePath, "utf-8");
    const body = stripFrontmatter(content);
    return createHash("sha256").update(body, "utf-8").digest("hex");
}

/**
 * Reads the file, recomputes content_hash from the body, and writes it back
 * into the frontmatter. Creates frontmatter if absent. Intended for maintainers.
 */
export function updateContentHash(filePath: string): void {
    const raw = readFileSync(filePath, "utf-8");
    const hash = computeContentHash(filePath);

    if (extractFrontmatter(raw)) {
        // Replace existing content_hash line or insert before closing ---
        let updated: string;
        if (/^content_hash:\s*.+$/m.test(raw)) {
            updated = raw.replace(/^content_hash:\s*.+$/m, `content_hash: ${hash}`);
        } else {
            // Insert before the closing ---
            updated = raw.replace(/^(---\r?\n[\s\S]*?)(---)/m, `$1content_hash: ${hash}\n$2`);
        }
        writeFileSync(filePath, updated, "utf-8");
    } else {
        // No frontmatter — prepend one
        const fm = `---\ncontent_hash: ${hash}\n---\n`;
        writeFileSync(filePath, fm + raw, "utf-8");
    }

    console.log(`\x1b[32m[UPDATED]\x1b[0m ${filePath} → content_hash: ${hash}`);
}

async function runStaticAudit(): Promise<number> {
    let errors = 0;
    console.log("=== README Synchronization Static Audit ===");

    for (const dir of REQUIRED_DIRS) {
        const enPath = join(dir, "README.md");
        const koPath = join(dir, "README_ko.md");

        const enExists = existsSync(enPath);
        const koExists = existsSync(koPath);

        if (enExists && koExists) {
            const enHasFm = hasFrontmatter(enPath);
            const koHasFm = hasFrontmatter(koPath);

            if (!enHasFm || !koHasFm) {
                // Old format — warn, do not error
                if (!enHasFm) {
                    console.warn(`\x1b[33m[WARN]\x1b[0m ${enPath}: No frontmatter found — needs migration to content_hash format. Run with --update-hashes.`);
                }
                if (!koHasFm) {
                    console.warn(`\x1b[33m[WARN]\x1b[0m ${koPath}: No frontmatter found — needs migration to translated_from_hash format.`);
                }
                continue;
            }

            const enHash = getFrontmatterField(enPath, "content_hash");
            const koHash = getFrontmatterField(koPath, "translated_from_hash");

            // content_hash was removed per ADR-0013 — absence is not an error
            if (enHash === null || koHash === null) {
                console.log(`\x1b[32m[PASS]\x1b[0m ${dir}: READMEs present; hash-sync tracking not active (see ADR-0013).`);
                continue;
            }

            if (enHash !== koHash) {
                console.error(`\x1b[31m[FAIL]\x1b[0m ${dir}: README.md has been updated — README_ko.md translation needs updating.`);
                console.error(`        README.md content_hash:          ${enHash}`);
                console.error(`        README_ko.md translated_from_hash: ${koHash}`);
                errors++;
            } else {
                console.log(`\x1b[32m[PASS]\x1b[0m ${dir}: READMEs are synchronized (hash: ${enHash.slice(0, 12)}…).`);
            }
        } else if (!enExists && !koExists) {
            if (dir !== ".") {
                console.log(`\x1b[33m[SKIP]\x1b[0m ${dir}: No README files found.`);
            } else {
                console.error(`\x1b[31m[FAIL]\x1b[0m ${dir}: Root must have README files.`);
                errors++;
            }
        } else {
            console.error(`\x1b[31m[FAIL]\x1b[0m ${dir}: Missing paired README. EN exists: ${enExists}, KO exists: ${koExists}`);
            errors++;
        }
    }

    return errors;
}

async function runDynamicAudit(): Promise<number> {
    let errors = 0;
    console.log("\n=== README Synchronization Dynamic Audit (Staged Files) ===");

    try {
        const diffOutput = await $`git diff --cached --name-only`.text();
        const stagedFiles = diffOutput.split("\n").filter(Boolean);

        const stagedReadmes = stagedFiles.filter(f => f.endsWith("README.md") || f.endsWith("README_ko.md"));

        if (stagedReadmes.length === 0) {
            console.log(`\x1b[33m[SKIP]\x1b[0m No README files are staged for commit.`);
            return 0;
        }

        for (const dir of REQUIRED_DIRS) {
            const enFile = dir === "." ? "README.md" : `${dir}/README.md`;
            const koFile = dir === "." ? "README_ko.md" : `${dir}/README_ko.md`;

            const enStaged = stagedFiles.includes(enFile);
            const koStaged = stagedFiles.includes(koFile);

            if (!enStaged && !koStaged) continue;

            const enExists = existsSync(enFile);
            const koExists = existsSync(koFile);

            if (enStaged && !koStaged) {
                // README.md staged alone: check if content_hash has changed vs what ko has
                if (enExists && koExists) {
                    const enHash = getFrontmatterField(enFile, "content_hash");
                    const koHash = getFrontmatterField(koFile, "translated_from_hash");
                    if (enHash && koHash && enHash !== koHash) {
                        console.error(`\x1b[31m[FAIL]\x1b[0m ${enFile} is staged with updated content_hash, but ${koFile} is NOT staged with a matching translated_from_hash.`);
                        console.error(`        README.md content_hash:          ${enHash}`);
                        console.error(`        README_ko.md translated_from_hash: ${koHash}`);
                        errors++;
                    } else if (!enHash) {
                        // content_hash absent — hash-sync tracking not active per ADR-0013
                        console.log(`\x1b[32m[PASS]\x1b[0m ${enFile} staged; hash-sync tracking not active (see ADR-0013).`);
                    } else {
                        console.log(`\x1b[32m[PASS]\x1b[0m ${enFile} staged; translated_from_hash in ${koFile} still matches — no translation update required.`);
                    }
                } else {
                    console.error(`\x1b[31m[FAIL]\x1b[0m ${enFile} is staged, but ${koFile} does not exist.`);
                    errors++;
                }
            } else if (!enStaged && koStaged) {
                console.error(`\x1b[31m[FAIL]\x1b[0m ${koFile} is staged, but ${enFile} is NOT staged!`);
                errors++;
            } else {
                // Both staged — verify content_hash == translated_from_hash
                const enHash = getFrontmatterField(enFile, "content_hash");
                const koHash = getFrontmatterField(koFile, "translated_from_hash");

                if (!enHash || !koHash) {
                    // content_hash/translated_from_hash absent — hash-sync tracking not active per ADR-0013
                    console.log(`\x1b[32m[PASS]\x1b[0m ${dir}: Staged READMEs present; hash-sync tracking not active (see ADR-0013).`);
                } else if (enHash !== koHash) {
                    console.error(`\x1b[31m[FAIL]\x1b[0m README.md has been updated — README_ko.md translation needs updating.`);
                    console.error(`        README.md content_hash:          ${enHash}`);
                    console.error(`        README_ko.md translated_from_hash: ${koHash}`);
                    errors++;
                } else {
                    console.log(`\x1b[32m[PASS]\x1b[0m ${dir}: Staged READMEs are synchronized (hash: ${enHash.slice(0, 12)}…).`);
                }
            }
        }
    } catch (e) {
        console.error("Error running git diff", e);
    }

    return errors;
}

async function runUpdateHashes(): Promise<void> {
    console.log("=== Updating content_hash in all README.md files ===");
    for (const dir of REQUIRED_DIRS) {
        const enPath = join(dir, "README.md");
        if (existsSync(enPath)) {
            updateContentHash(enPath);
        }
    }
    console.log("\nDone. Remember to also update translated_from_hash in README_ko.md files after translation.");
}

async function main() {
    const args = process.argv;
    const isPreCommit = args.includes("--pre-commit");
    const isUpdateHashes = args.includes("--update-hashes");

    if (isUpdateHashes) {
        await runUpdateHashes();
        process.exit(0);
    }

    let totalErrors = 0;

    totalErrors += await runStaticAudit();

    if (isPreCommit) {
        totalErrors += await runDynamicAudit();
    }

    if (totalErrors > 0) {
        console.error(`\n\x1b[31mValidation failed with ${totalErrors} error(s). Please fix README synchronization.\x1b[0m`);
        process.exit(1);
    } else {
        console.log(`\n\x1b[32mAll README synchronizations valid.\x1b[0m`);
        process.exit(0);
    }
}

main();
