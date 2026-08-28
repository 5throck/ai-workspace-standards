#!/usr/bin/env bun
/**
 * Industry Profile Schema Validator v1.0
 * Validates all industry-profiles/*.yaml against canonical schema requirements.
 *
 * Usage:
 *   bun industry-profiles/_validate.ts
 *   bun industry-profiles/_validate.ts --verbose
 *
 * Canonical required fields:
 *   profile_id, name, version, status, last_updated,
 *   industry_tier, agent, legal_basis (minItems: 3), key_hazards (minItems: 1)
 *
 * Canonical optional fields:
 *   display_name, workflows, uses_functional_services
 */

import * as yaml from "js-yaml";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename, resolve } from "node:path";

const PROFILES_DIR = resolve(import.meta.path, "..");
const VERBOSE = process.argv.includes("--verbose");

const VALID_STATUSES = new Set(["active", "inactive", "deprecated", "draft"]);
const VALID_TIERS = new Set(["industry", "functional", "cross-cutting"]);

interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warn";
}

interface ProfileResult {
  file: string;
  profileId: string | undefined;
  errors: ValidationError[];
  warnings: ValidationError[];
}

function validateProfile(filename: string, content: string): ProfileResult {
  const result: ProfileResult = { file: filename, profileId: undefined, errors: [], warnings: [] };

  let doc: unknown;
  try {
    doc = yaml.load(content, { schema: yaml.JSON_SCHEMA });
  } catch (e: any) {
    result.errors.push({ field: "parse", message: `YAML parse error: ${e.message}`, severity: "error" });
    return result;
  }

  if (!doc || typeof doc !== "object") {
    result.errors.push({ field: "root", message: "Document is not a valid YAML mapping", severity: "error" });
    return result;
  }

  const profile = doc as Record<string, unknown>;
  result.profileId = profile.profile_id as string | undefined;

  // --- profile_id ---
  if (!profile.profile_id) {
    result.errors.push({ field: "profile_id", message: "Missing required field: profile_id", severity: "error" });
  } else {
    const expectedId = basename(filename, ".yaml");
    if (profile.profile_id !== expectedId) {
      result.errors.push({
        field: "profile_id",
        message: `profile_id "${profile.profile_id}" does not match filename "${expectedId}"`,
        severity: "error",
      });
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(profile.profile_id as string)) {
      result.errors.push({
        field: "profile_id",
        message: `profile_id "${profile.profile_id}" is not kebab-case`,
        severity: "warn",
      });
    }
  }

  // --- name ---
  if (!profile.name) {
    result.errors.push({ field: "name", message: "Missing required field: name", severity: "error" });
  }

  // --- version ---
  if (!profile.version) {
    result.errors.push({ field: "version", message: "Missing required field: version", severity: "error" });
  } else if (typeof profile.version !== "string") {
    result.errors.push({ field: "version", message: "version must be a string (semver)", severity: "error" });
  }

  // --- status ---
  if (!profile.status) {
    result.errors.push({ field: "status", message: "Missing required field: status", severity: "error" });
  } else if (!VALID_STATUSES.has(profile.status as string)) {
    result.errors.push({
      field: "status",
      message: `Invalid status "${profile.status}". Must be one of: ${[...VALID_STATUSES].join(", ")}`,
      severity: "error",
    });
  }

  // --- last_updated ---
  if (!profile.last_updated) {
    result.errors.push({ field: "last_updated", message: "Missing required field: last_updated", severity: "error" });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.last_updated as string)) {
    result.errors.push({
      field: "last_updated",
      message: `Invalid date format "${profile.last_updated}". Expected YYYY-MM-DD`,
      severity: "error",
    });
  }

  // --- industry_tier ---
  if (!profile.industry_tier) {
    result.errors.push({ field: "industry_tier", message: "Missing required field: industry_tier", severity: "error" });
  } else if (!VALID_TIERS.has(profile.industry_tier as string)) {
    result.errors.push({
      field: "industry_tier",
      message: `Invalid industry_tier "${profile.industry_tier}". Must be one of: ${[...VALID_TIERS].join(", ")}`,
      severity: "error",
    });
  }

  // --- agent ---
  if (!profile.agent) {
    result.errors.push({ field: "agent", message: "Missing required field: agent", severity: "error" });
  } else if (typeof profile.agent !== "string" || !profile.agent.endsWith("-agent")) {
    result.warnings.push({
      field: "agent",
      message: `agent "${profile.agent}" does not follow naming convention (expected *-agent)`,
      severity: "warn",
    });
  }

  // --- legal_basis ---
  if (!profile.legal_basis) {
    result.errors.push({ field: "legal_basis", message: "Missing required field: legal_basis", severity: "error" });
  } else if (!Array.isArray(profile.legal_basis)) {
    result.errors.push({ field: "legal_basis", message: "legal_basis must be an array", severity: "error" });
  } else if (profile.legal_basis.length < 3) {
    result.errors.push({
      field: "legal_basis",
      message: `legal_basis has ${profile.legal_basis.length} items, minimum is 3`,
      severity: "error",
    });
  }

  // --- key_hazards ---
  if (!profile.key_hazards) {
    result.errors.push({ field: "key_hazards", message: "Missing required field: key_hazards", severity: "error" });
  } else if (!Array.isArray(profile.key_hazards)) {
    result.errors.push({ field: "key_hazards", message: "key_hazards must be an array", severity: "error" });
  } else if (profile.key_hazards.length < 1) {
    result.errors.push({
      field: "key_hazards",
      message: "key_hazards must have at least 1 item",
      severity: "error",
    });
  }

  // --- Optional field warnings ---
  if (!profile.display_name) {
    result.warnings.push({ field: "display_name", message: "Missing optional field: display_name", severity: "warn" });
  }

  if (!profile.description) {
    result.warnings.push({ field: "description", message: "Missing optional field: description", severity: "warn" });
  }

  return result;
}

// --- Main ---
async function main() {
  console.log("=== Industry Profile Schema Validator v1.0 ===\n");

  const files = await readdir(PROFILES_DIR);
  const yamlFiles = files.filter(
    (f) => f.endsWith(".yaml") && !f.startsWith("_schema") && !f.startsWith("_validate")
  );

  console.log(`Found ${yamlFiles.length} profile files in ${PROFILES_DIR}\n`);

  const results: ProfileResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let passCount = 0;
  let failCount = 0;

  for (const file of yamlFiles.sort()) {
    const content = await readFile(join(PROFILES_DIR, file), "utf-8");
    const result = validateProfile(file, content);
    results.push(result);

    const errorCount = result.errors.length;
    const warnCount = result.warnings.length;
    totalErrors += errorCount;
    totalWarnings += warnCount;

    if (errorCount === 0) {
      passCount++;
      const status = warnCount > 0 ? "PASS (warnings)" : "PASS";
      console.log(`  [PASS] ${file}${warnCount > 0 ? ` (${warnCount} warnings)` : ""}`);
    } else {
      failCount++;
      console.log(`  [FAIL] ${file} (${errorCount} errors, ${warnCount} warnings)`);
    }

    if (VERBOSE || errorCount > 0) {
      for (const err of result.errors) {
        console.log(`         ERROR: ${err.field} — ${err.message}`);
      }
      for (const warn of result.warnings) {
        if (VERBOSE) console.log(`         WARN:  ${warn.field} — ${warn.message}`);
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`  Total profiles:  ${yamlFiles.length}`);
  console.log(`  Passed:          ${passCount}`);
  console.log(`  Failed:          ${failCount}`);
  console.log(`  Total errors:    ${totalErrors}`);
  console.log(`  Total warnings:  ${totalWarnings}`);

  if (failCount > 0) {
    console.log("\n=== Failed Profiles ===");
    for (const r of results.filter((r) => r.errors.length > 0)) {
      console.log(`  ${r.file}:`);
      for (const err of r.errors) {
        console.log(`    - ${err.field}: ${err.message}`);
      }
    }
  }

  console.log("\n=== Status Profiles ===");
  const statusMap = new Map<string, string[]>();
  for (const r of results) {
    if (!r.profileId) continue;
    // re-read to get status
    const content = await readFile(join(PROFILES_DIR, r.file), "utf-8");
    const doc = yaml.load(content) as Record<string, unknown>;
    const status = (doc.status as string) || "unknown";
    if (!statusMap.has(status)) statusMap.set(status, []);
    statusMap.get(status)!.push(r.file);
  }
  for (const [status, files] of statusMap) {
    console.log(`  ${status}: ${files.length} profiles`);
    if (VERBOSE) for (const f of files) console.log(`    - ${f}`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
