#!/usr/bin/env bun
/**
 * verify-agent-deliverables.ts — Agent Execution Result Verification
 * @version 1.0.0
 *
 * Purpose: Verify that files reported as "created" by agents actually exist.
 * Prevents "report forgery" where agents claim completion without actual deliverables.
 *
 * Usage:
 *   bun scripts/verify-agent-deliverables.ts <file1> <file2> ...
 *
 * Tier 2 (Sentinel): Part of 3-Tier QA Framework
 */

import { existsSync, statSync } from "fs";
import { readFileSync } from "fs";

interface VerificationResult {
    file: string;
    exists: boolean;
    hasContent: boolean;
    registeredInScriptsMd: boolean;
    errors: string[];
}

/**
 * Verify a single deliverable file.
 */
function verifyFile(filePath: string): VerificationResult {
    const result: VerificationResult = {
        file: filePath,
        exists: false,
        hasContent: false,
        registeredInScriptsMd: false,
        errors: [],
    };

    // Check if file exists
    if (!existsSync(filePath)) {
        result.errors.push(`File does not exist: ${filePath}`);
        return result;
    }
    result.exists = true;

    // Check if file has content
    try {
        const stats = statSync(filePath);
        if (stats.size === 0) {
            result.errors.push(`File is empty (0 bytes): ${filePath}`);
        } else {
            result.hasContent = true;
        }
    } catch (e) {
        result.errors.push(`Cannot read file size: ${filePath} - ${e}`);
    }

    // Check if registered in SCRIPTS.md (for scripts only)
    if (filePath.match(/^scripts\/.*\.ts$/)) {
        try {
            const scriptsMd = readFileSync("scripts/SCRIPTS.md", "utf-8");
            const fileName = filePath.replace(/^scripts\//, "");
            if (scriptsMd.includes(fileName)) {
                result.registeredInScriptsMd = true;
            } else {
                result.errors.push(`Script not registered in scripts/SCRIPTS.md: ${filePath}`);
            }
        } catch (e) {
            // SCRIPTS.md might not exist, ignore
        }
    }

    return result;
}

/**
 * Main verification function.
 */
async function main() {
    const filesToVerify = process.argv.slice(2);

    if (filesToVerify.length === 0) {
        console.log("Usage: bun scripts/verify-agent-deliverables.ts <file1> <file2> ...");
        console.log("\nVerifies that files reported as created by agents actually exist.");
        process.exit(0);
    }

    console.log("=== Tier 2 Sentinel: Agent Deliverable Verification ===\n");

    let allPassed = true;
    const results: VerificationResult[] = [];

    for (const file of filesToVerify) {
        const result = verifyFile(file);
        results.push(result);

        if (result.errors.length > 0) {
            allPassed = false;
            console.error(`❌ ${file}`);
            for (const error of result.errors) {
                console.error(`   ${error}`);
            }
        } else {
            console.log(`✅ ${file}`);
            console.log(`   Exists: ${result.exists}, Has content: ${result.hasContent}, Registered: ${result.registeredInScriptsMd || "N/A"}`);
        }
    }

    console.log();

    if (allPassed) {
        console.log(`✅ All ${results.length} deliverable(s) verified successfully.`);
        process.exit(0);
    } else {
        const failedCount = results.filter(r => r.errors.length > 0).length;
        console.error(`❌ ${failedCount}/${results.length} deliverable(s) failed verification.`);
        console.error("\nAgent execution result verification failed. This indicates a potential");
        console.error("\"report forgery\" where an agent claimed completion without actual deliverables.");
        process.exit(1);
    }
}

main().catch(err => {
    console.error("Verification error:", err);
    process.exit(1);
});