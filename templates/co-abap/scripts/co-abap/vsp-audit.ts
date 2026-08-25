#!/usr/bin/env bun
// vsp-audit.ts - ATC rule-pack audit: validates atc-rulepack.json and prints the deterministic check selection per change type
// Usage: bun scripts/co-abap/vsp-audit.ts [--change-type <feature|refactor|hotfix|transport-release>] [--list]
// @version 1.1.0

import path from "node:path";
import * as fs from "node:fs";

const scriptDir = path.dirname(import.meta.path);
const rulepackPath = path.join(scriptDir, "atc-rulepack.json");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

const VALID_SEVERITY_GATES = new Set(["blocker", "should"]);
const VALID_TOOLS = new Set(["SyntaxCheck", "RunATCCheck", "RunUnitTests", "GetCodeCoverage"]);

interface RulepackCheck {
  id: string;
  tool: string;
  atc_variant: string;
  severity_gate: string;
  owner: string;
  source: string;
}

interface RulepackChangeType {
  description: string;
  checks: RulepackCheck[];
}

interface Rulepack {
  rulepack_version: string;
  description: string;
  change_types: Record<string, RulepackChangeType>;
}

function integrityAudit(rulepack: Rulepack): { passed: boolean; errors: string[]; totalChecks: number } {
  const errors: string[] = [];
  let totalChecks = 0;

  // Check rulepack_version present and semver-shaped
  if (!rulepack.rulepack_version) {
    errors.push("[FAIL] rulepack_version missing");
  } else {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(rulepack.rulepack_version)) {
      errors.push(`[FAIL] rulepack_version '${rulepack.rulepack_version}' is not semver-shaped (X.Y.Z)`);
    }
  }

  // Check at least 1 change type
  const changeTypes = Object.keys(rulepack.change_types);
  if (changeTypes.length === 0) {
    errors.push("[FAIL] No change types defined");
  }

  // Check each profile
  for (const [typeName, typeConfig] of Object.entries(rulepack.change_types)) {
    const checks = typeConfig.checks;

    // Every profile has at least 1 check
    if (!checks || checks.length === 0) {
      errors.push(`[FAIL] Change type '${typeName}' has no checks`);
      continue;
    }

    // Every check has required fields
    for (let i = 0; i < checks.length; i++) {
      const check = checks[i];
      totalChecks++;

      if (!check.id) {
        errors.push(`[FAIL] Change type '${typeName}' check ${i}: missing 'id'`);
      }
      if (!check.tool) {
        errors.push(`[FAIL] Change type '${typeName}' check ${i}: missing 'tool'`);
      }
      if (!check.atc_variant) {
        errors.push(`[FAIL] Change type '${typeName}' check ${i}: missing 'atc_variant'`);
      }
      if (!check.severity_gate) {
        errors.push(`[FAIL] Change type '${typeName}' check ${i}: missing 'severity_gate'`);
      }
      if (!check.owner) {
        errors.push(`[FAIL] Change type '${typeName}' check ${i}: missing 'owner'`);
      }
      if (!check.source) {
        errors.push(`[FAIL] Change type '${typeName}' check ${i}: missing 'source'`);
      }

      // Validate severity_gate values
      if (check.severity_gate && !VALID_SEVERITY_GATES.has(check.severity_gate)) {
        errors.push(`[FAIL] Change type '${typeName}' check ${i}: invalid severity_gate '${check.severity_gate}' (must be blocker or should)`);
      }

      // Validate tool values
      if (check.tool && !VALID_TOOLS.has(check.tool)) {
        errors.push(`[FAIL] Change type '${typeName}' check ${i}: invalid tool '${check.tool}' (must be SyntaxCheck, RunATCCheck, RunUnitTests, or GetCodeCoverage)`);
      }
    }

    // Check ID uniqueness within profile
    const ids = checks.map(c => c.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      errors.push(`[FAIL] Change type '${typeName}' has duplicate check IDs: ${[...new Set(duplicates)].join(", ")}`);
    }
  }

  return { passed: errors.length === 0, errors, totalChecks };
}

function printList(rulepack: Rulepack): void {
  console.log("Available change types:");
  for (const [typeName, typeConfig] of Object.entries(rulepack.change_types)) {
    console.log(`  ${typeName.padEnd(20)} - ${typeConfig.description}`);
  }
}

function printChangeTypeTable(rulepack: Rulepack, changeType: string): void {
  if (!rulepack.change_types[changeType]) {
    console.error(`${RED}[FAIL] unknown change type: ${changeType}${RESET}`);
    console.error("Run with --list to see available change types.");
    process.exit(1);
  }

  const typeConfig = rulepack.change_types[changeType];
  const checks = typeConfig.checks;

  console.log(`\nChange type: ${changeType}`);
  console.log(`Description: ${typeConfig.description}\n`);

  // Print table header
  console.log("| id".padEnd(30) + "| tool".padEnd(20) + "| atc_variant".padEnd(20) + "| severity_gate".padEnd(18) + "| owner");
  console.log("-".repeat(110));

  // Print table rows
  let blockerCount = 0;
  let shouldCount = 0;

  for (const check of checks) {
    console.log(
      `| ${check.id}`.padEnd(30) +
      `| ${check.tool}`.padEnd(20) +
      `| ${check.atc_variant}`.padEnd(20) +
      `| ${check.severity_gate}`.padEnd(18) +
      `| ${check.owner}`
    );

    if (check.severity_gate === "blocker") blockerCount++;
    if (check.severity_gate === "should") shouldCount++;
  }

  console.log();
  console.log(`vsp-audit: change type '${changeType}' -> ${checks.length} checks (${blockerCount} blocker / ${shouldCount} should)`);
  console.log("Run via the VSP tools named in the tool column; ATC selections go to RunATCCheck.");
}

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let changeTypeArg: string | null = null;
  let listMode = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--list") {
      listMode = true;
    } else if (args[i] === "--change-type" && i + 1 < args.length) {
      changeTypeArg = args[i + 1];
      i++;
    }
  }

  // Load rulepack
  if (!fs.existsSync(rulepackPath)) {
    console.error(`${RED}[FAIL] rulepack not found: ${rulepackPath}${RESET}`);
    process.exit(1);
  }

  const rulepackContent = fs.readFileSync(rulepackPath, "utf8");
  let rulepack: Rulepack;
  try {
    rulepack = JSON.parse(rulepackContent);
  } catch (e) {
    console.error(`${RED}[FAIL] invalid JSON in atc-rulepack.json: ${e}${RESET}`);
    process.exit(1);
  }

  // Run integrity audit (always)
  const audit = integrityAudit(rulepack);

  if (!audit.passed) {
    console.error(`${RED}rulepack integrity audit FAILED:${RESET}`);
    for (const error of audit.errors) {
      console.error(error);
    }
    process.exit(1);
  }

  console.log(`${GREEN}[PASS] rulepack integrity: ${Object.keys(rulepack.change_types).length} change types, ${audit.totalChecks} checks total${RESET}\n`);

  // Handle --list
  if (listMode) {
    printList(rulepack);
    return;
  }

  // Handle --change-type
  if (changeTypeArg) {
    printChangeTypeTable(rulepack, changeTypeArg);
    return;
  }

  // No args: summary of all types
  console.log("Change type summary:");
  for (const [typeName, typeConfig] of Object.entries(rulepack.change_types)) {
    const checks = typeConfig.checks;
    const blockers = checks.filter(c => c.severity_gate === "blocker").length;
    const shoulds = checks.filter(c => c.severity_gate === "should").length;
    console.log(`  ${typeName.padEnd(20)} ${checks.toString().padStart(2)} checks (${blockers} blocker / ${shoulds} should)`);
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`vsp-audit: ${e}`);
    process.exit(1);
  });
}

export { main };
