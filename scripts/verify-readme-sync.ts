import { $ } from "bun";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const REQUIRED_DIRS = [".", "templates/common", "templates/co-design", "templates/co-develop", "templates/co-work"];

function getSyncVersion(filePath: string): number | null {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8");
    const match = content.match(/^sync_version:\s*(\d+)/m);
    return match ? parseInt(match[1], 10) : null;
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
            const enVer = getSyncVersion(enPath);
            const koVer = getSyncVersion(koPath);
            
            if (enVer === null || koVer === null) {
                console.error(`\x1b[31m[FAIL]\x1b[0m ${dir}: Missing sync_version frontmatter.`);
                errors++;
            } else if (enVer !== koVer) {
                console.error(`\x1b[31m[FAIL]\x1b[0m ${dir}: Version mismatch (EN: ${enVer}, KO: ${koVer}).`);
                errors++;
            } else {
                console.log(`\x1b[32m[PASS]\x1b[0m ${dir}: READMEs synced at version ${enVer}.`);
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
        const stagedFiles = diffOutput.split('\n').filter(Boolean);
        
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
            
            if (enStaged || koStaged) {
                if (enStaged && !koStaged) {
                    console.error(`\x1b[31m[FAIL]\x1b[0m ${enFile} is staged, but ${koFile} is NOT staged!`);
                    errors++;
                } else if (!enStaged && koStaged) {
                    console.error(`\x1b[31m[FAIL]\x1b[0m ${koFile} is staged, but ${enFile} is NOT staged!`);
                    errors++;
                } else {
                    // Both staged. Check version.
                    const enVer = getSyncVersion(enFile);
                    const koVer = getSyncVersion(koFile);
                    if (enVer !== koVer) {
                        console.error(`\x1b[31m[FAIL]\x1b[0m Staged files ${enFile} and ${koFile} have mismatched sync_version (${enVer} vs ${koVer}).`);
                        errors++;
                    } else {
                        console.log(`\x1b[32m[PASS]\x1b[0m ${dir} staged READMEs are synchronized.`);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error running git diff", e);
    }
    
    return errors;
}

async function main() {
    const isPreCommit = process.argv.includes("--pre-commit");
    
    let totalErrors = 0;
    
    totalErrors += await runStaticAudit();
    
    if (isPreCommit) {
        totalErrors += await runDynamicAudit();
    }
    
    if (totalErrors > 0) {
        console.error(`\n\x1b[31mValidation failed with ${totalErrors} errors. Please fix README synchronization.\x1b[0m`);
        process.exit(1);
    } else {
        console.log(`\n\x1b[32mAll README synchronizations valid.\x1b[0m`);
        process.exit(0);
    }
}

main();
