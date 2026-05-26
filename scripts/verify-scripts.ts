#!/usr/bin/env bun
/**
 * verify-scripts.ts — Script Lifecycle Registry Verifier
 *
 * Validates that scripts/SCRIPTS.md Registry is in sync with actual script files,
 * enforces deprecation removal dates, and blocks on security advisories.
 *
 * Usage:
 *   bun scripts/verify-scripts.ts --verify    # CI / pre-commit: fail on drift
 *   bun scripts/verify-scripts.ts --generate  # Generate Registry draft from filesystem
 *   bun scripts/verify-scripts.ts --report    # Human-readable status report
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = drift, expired removal date, or active security advisory detected
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";

// ── Configuration ────────────────────────────────────────────────────────────

const SCRIPT_EXTENSIONS = [".sh", ".ps1", ".ts"];
const SCRIPTS_MD_FILENAME = "SCRIPTS.md";

// Resolve workspace root (this script lives in scripts/ or templates/common/scripts/)
function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "CONSTITUTION.md"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("Could not find workspace root (CONSTITUTION.md not found)");
}

const scriptDir = import.meta.dir;
const workspaceRoot = findWorkspaceRoot(scriptDir);
const scriptsDir = join(workspaceRoot, "templates", "common", "scripts");
const scriptsMdPath = join(scriptsDir, SCRIPTS_MD_FILENAME);

// ── Types ────────────────────────────────────────────────────────────────────

interface RegistryEntry {
  script: string;
  source: string;
  version: string;
  status: "active" | "deprecated" | "experimental";
  removalDate: string; // "—" or "YYYY-MM-DD"
  securityAdvisory: string; // "—" or "CVE-XXXX"
}

// ── Registry Parser ──────────────────────────────────────────────────────────

function parseRegistry(content: string): RegistryEntry[] {
  const lines = content.split("\n");
  const entries: RegistryEntry[] = [];

  let inRegistry = false;
  let headerParsed = false;

  for (const line of lines) {
    if (line.startsWith("## Registry")) {
      inRegistry = true;
      headerParsed = false;
      continue;
    }
    if (inRegistry && line.startsWith("## ")) {
      // Next section — stop
      break;
    }
    if (!inRegistry) continue;

    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.startsWith("|-")) continue;

    const cols = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

    if (!headerParsed) {
      headerParsed = true; // skip header row
      continue;
    }

    if (cols.length < 6) continue;

    // Strip backticks from script name
    const script = cols[0].replace(/`/g, "");
    const status = cols[3] as RegistryEntry["status"];

    entries.push({
      script,
      source: cols[1],
      version: cols[2],
      status,
      removalDate: cols[4],
      securityAdvisory: cols[5],
    });
  }

  return entries;
}

// ── Filesystem Scanner ───────────────────────────────────────────────────────

function getActualScripts(): string[] {
  if (!existsSync(scriptsDir)) return [];
  return readdirSync(scriptsDir)
    .filter(
      (f) =>
        SCRIPT_EXTENSIONS.some((ext) => f.endsWith(ext)) &&
        f !== SCRIPTS_MD_FILENAME
    )
    .sort();
}

// ── Verify Mode ──────────────────────────────────────────────────────────────

function verify(): boolean {
  let passed = true;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(scriptsMdPath)) {
    console.error(`❌ SCRIPTS.md not found at: ${scriptsMdPath}`);
    console.error(
      "   Run: bun scripts/verify-scripts.ts --generate  to create a draft"
    );
    return false;
  }

  const content = readFileSync(scriptsMdPath, "utf-8");
  const registry = parseRegistry(content);
  const actualScripts = getActualScripts();

  const registeredNames = new Set(registry.map((e) => e.script));
  const actualNames = new Set(actualScripts);

  // Check 0: Architecture compliance (.sh/.ps1 pairs and .ts orchestration)
  const shScripts = actualScripts.filter(s => s.endsWith('.sh')).map(s => s.replace('.sh', ''));
  const ps1Scripts = actualScripts.filter(s => s.endsWith('.ps1')).map(s => s.replace('.ps1', ''));
  
  for (const name of shScripts) {
    if (!ps1Scripts.includes(name)) {
      errors.push(`Missing cross-platform pair: \`${name}.ps1\` is missing for \`${name}.sh\``);
    }
  }
  for (const name of ps1Scripts) {
    if (!shScripts.includes(name)) {
      errors.push(`Missing cross-platform pair: \`${name}.sh\` is missing for \`${name}.ps1\``);
    }
  }
  for (const script of actualScripts) {
    if (script.includes('lifecycle') || script.includes('verify') || script.includes('validate') || script.includes('agent-') || script.includes('dispatch')) {
      if (!script.endsWith('.ts') && !script.endsWith('.md')) {
         errors.push(`Architecture violation: Orchestration script \`${script}\` must use Bun (.ts)`);
      }
    }
  }

  // Check 1: Scripts on disk but not in registry
  for (const script of actualScripts) {
    if (!registeredNames.has(script)) {
      errors.push(`Unregistered script: \`${script}\` — add to SCRIPTS.md Registry`);
    }
  }

  // Check 2: Scripts in registry but not on disk
  for (const entry of registry) {
    if (!actualNames.has(entry.script)) {
      errors.push(
        `Ghost entry: \`${entry.script}\` in Registry but not on disk — remove from SCRIPTS.md`
      );
    }
  }

  // Check 3: Security advisories — hard block
  const today = new Date().toISOString().slice(0, 10);
  for (const entry of registry) {
    if (entry.securityAdvisory !== "—" && entry.securityAdvisory !== "") {
      errors.push(
        `🔒 SECURITY ADVISORY on \`${entry.script}\`: ${entry.securityAdvisory} — update or remove this script immediately`
      );
    }
  }

  // Check 4: Expired removal dates — hard block
  for (const entry of registry) {
    if (entry.status === "deprecated" && entry.removalDate !== "—" && entry.removalDate !== "") {
      if (entry.removalDate <= today) {
        errors.push(
          `⏰ EXPIRED: \`${entry.script}\` removal-date ${entry.removalDate} has passed — delete this script and remove from Registry`
        );
      } else {
        // Upcoming removal — warn only
        const daysLeft = Math.ceil(
          (new Date(entry.removalDate).getTime() - new Date(today).getTime()) /
            86400000
        );
        warnings.push(
          `⚠️  DEPRECATED: \`${entry.script}\` — scheduled removal on ${entry.removalDate} (${daysLeft} days remaining)`
        );
      }
    }

    // Check 5: deprecated without removal-date
    if (entry.status === "deprecated" && (entry.removalDate === "—" || entry.removalDate === "")) {
      errors.push(
        `Missing removal-date for deprecated script: \`${entry.script}\` — add YYYY-MM-DD (min 90 days)`
      );
    }
  }

  // Output
  console.log(`\n=== verify-scripts.ts ===`);
  console.log(`Registry: ${scriptsMdPath}`);
  console.log(`Scripts dir: ${scriptsDir}\n`);

  if (warnings.length > 0) {
    for (const w of warnings) console.warn(w);
    console.log();
  }

  if (errors.length > 0) {
    for (const e of errors) console.error(`❌ ${e}`);
    console.log(`\n❌ ${errors.length} error(s) found — pre-commit blocked`);
    passed = false;
  } else {
    console.log(
      `✅ All ${registry.length} registered scripts verified (${warnings.length} warning(s))`
    );
  }

  return passed;
}

// ── Generate Mode ────────────────────────────────────────────────────────────

function generate(): void {
  const actualScripts = getActualScripts();

  if (!existsSync(scriptsMdPath)) {
    console.log(`ℹ️  SCRIPTS.md not found — generating from scratch`);
  } else {
    // Load existing registry to preserve metadata for known scripts
    const existing = readFileSync(scriptsMdPath, "utf-8");
    const existingRegistry = parseRegistry(existing);
    const existingMap = new Map(existingRegistry.map((e) => [e.script, e]));

    const rows = actualScripts.map((script) => {
      const known = existingMap.get(script);
      if (known) {
        // Preserve existing metadata
        return `| \`${known.script}\` | ${known.source} | ${known.version} | ${known.status} | ${known.removalDate} | ${known.securityAdvisory} |`;
      }
      return `| \`${script}\` | L0 | 1.0.0 | active | — | — |`;
    });

    // Replace Registry section in existing file
    const header =
      "| script | source | version | status | removal-date | security-advisory |\n" +
      "|--------|--------|---------|--------|--------------|-------------------|";

    const updated = existing.replace(
      /(\| script \|.*?\n\|[-| ]+\|\n)([\s\S]*?)(?=\n---|\n## )/,
      `${header}\n${rows.join("\n")}\n`
    );

    writeFileSync(scriptsMdPath, updated, "utf-8");
    console.log(
      `✅ Registry updated: ${rows.length} scripts (${actualScripts.length} on disk)`
    );
    console.log(`   Review SCRIPTS.md before committing — metadata is preserved for known scripts`);
    return;
  }

  // Fresh generate
  const rows = actualScripts
    .map(
      (s) => `| \`${s}\` | L0 | 1.0.0 | active | — | — |`
    )
    .join("\n");

  const draft = `# SCRIPTS.md — Script Lifecycle Registry

> Auto-generated draft. Review and fill in the Guide section before committing.

---

## Registry

| script | source | version | status | removal-date | security-advisory |
|--------|--------|---------|--------|--------------|-------------------|
${rows}

---

## Guide

<!-- Add human-readable documentation for each script here -->
`;

  writeFileSync(scriptsMdPath, draft, "utf-8");
  console.log(`✅ Generated SCRIPTS.md draft with ${actualScripts.length} scripts`);
  console.log(`   Path: ${scriptsMdPath}`);
  console.log(`   Next: fill in Guide section, then commit`);
}

// ── Report Mode ──────────────────────────────────────────────────────────────

function report(): void {
  if (!existsSync(scriptsMdPath)) {
    console.error(`❌ SCRIPTS.md not found. Run --generate first.`);
    process.exit(1);
  }

  const content = readFileSync(scriptsMdPath, "utf-8");
  const registry = parseRegistry(content);
  const actual = getActualScripts();
  const registeredNames = new Set(registry.map((e) => e.script));
  const today = new Date().toISOString().slice(0, 10);

  const active = registry.filter((e) => e.status === "active");
  const deprecated = registry.filter((e) => e.status === "deprecated");
  const experimental = registry.filter((e) => e.status === "experimental");
  const unregistered = actual.filter((s) => !registeredNames.has(s));
  const advisories = registry.filter((e) => e.securityAdvisory !== "—" && e.securityAdvisory !== "");

  console.log(`\n=== Script Lifecycle Report ===`);
  console.log(`Date: ${today}`);
  console.log(`Registry: ${registry.length} entries | Disk: ${actual.length} files\n`);

  console.log(`📦 Active (${active.length})`);
  for (const e of active) console.log(`   ✅ ${e.script} v${e.version}`);

  if (deprecated.length > 0) {
    console.log(`\n⚠️  Deprecated (${deprecated.length})`);
    for (const e of deprecated) {
      const expired = e.removalDate !== "—" && e.removalDate <= today;
      const marker = expired ? "❌ EXPIRED" : "⏰";
      console.log(`   ${marker} ${e.script} — removal: ${e.removalDate}`);
    }
  }

  if (experimental.length > 0) {
    console.log(`\n🧪 Experimental (${experimental.length})`);
    for (const e of experimental) console.log(`   🔬 ${e.script} v${e.version}`);
  }

  if (advisories.length > 0) {
    console.log(`\n🔒 Security Advisories (${advisories.length})`);
    for (const e of advisories) console.log(`   🚨 ${e.script}: ${e.securityAdvisory}`);
  }

  if (unregistered.length > 0) {
    console.log(`\n❓ Unregistered on disk (${unregistered.length})`);
    for (const s of unregistered) console.log(`   ➕ ${s}`);
  }

  console.log();
}

// ── Entry Point ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--generate")) {
  generate();
} else if (args.includes("--report")) {
  report();
} else if (args.includes("--verify") || args.length === 0) {
  const ok = verify();
  process.exit(ok ? 0 : 1);
} else {
  console.error(`Usage: bun scripts/verify-scripts.ts [--verify | --generate | --report]`);
  process.exit(1);
}
