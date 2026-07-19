#!/usr/bin/env bun
/**
 * Financial Statement Analysis Pipeline
 * End-to-end runner: Validation → Normalization → KPI → Driver Tree → Report
 *
 * @version 1.0.0
 * Usage:
 *   bun scripts/financial-pipeline.ts <dart-json-path> [--company <name>] [--output-dir <dir>]
 * @module financial-pipeline
 */

import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

function usage(): never {
  console.error("Usage: bun scripts/financial-pipeline.ts <dart-json-path> [--company <name>] [--output-dir <dir>]");
  process.exit(1);
}

/**
 * Spawn a Python script and capture its stdout.
 * On Windows, uses `shell: true` because Bun strips backslashes from spawn args,
 * and Windows AppExecutionAlias stubs require shell resolution.
 */
function runPythonScript(
  scriptName: string,
  args: string[],
): Promise<string> {
  return new Promise((resolveFn, reject) => {
    const scriptDir = dirname(process.argv[1]);
    const scriptPath = resolve(scriptDir, "..", "..", "python", scriptName);
    const pythonBin = process.platform === "win32" ? "python" : "python3";
    const proc = spawn(pythonBin, [scriptPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      shell: process.platform === "win32",
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptName} exited with code ${code}: ${stderr}`));
      } else {
        resolveFn(stdout);
      }
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  const dartPath = resolve(args[0]);
  if (!existsSync(dartPath)) {
    console.error(`Error: DART file not found: ${dartPath}`);
    process.exit(1);
  }

  // Parse optional arguments
  const companyFlagIdx = args.indexOf("--company");
  const companyName = companyFlagIdx >= 0 && args[companyFlagIdx + 1]
    ? args[companyFlagIdx + 1]
    : "unknown";

  const outputDirFlagIdx = args.indexOf("--output-dir");
  const scriptDir = dirname(process.argv[1]);
  const outputDir = outputDirFlagIdx >= 0 && args[outputDirFlagIdx + 1]
    ? resolve(args[outputDirFlagIdx + 1])
    : resolve(scriptDir, "..", "deliverables", companyName);

  const today = new Date().toISOString().slice(0, 10);

  // Create output directories
  const dirs = ["validation", "canonical", "kpi", "driver-tree", "reports"];
  for (const dir of dirs) {
    mkdirSync(join(outputDir, dir), { recursive: true });
  }

  // Also symlink/copy dart data
  const dartDestDir = join(outputDir, "dart");
  if (!existsSync(dartDestDir)) {
    mkdirSync(dartDestDir, { recursive: true });
    const dartData = readFileSync(dartPath, "utf-8");
    writeFileSync(join(dartDestDir, `dart-${today}.json`), dartData, "utf-8");
    console.log(`📋 DART data copied to: ${dartDestDir}`);
  }

  console.log(`\n🚀 Financial Statement Analysis Pipeline`);
  console.log(`   Company: ${companyName}`);
  console.log(`   Input:   ${dartPath}`);
  console.log(`   Output:  ${outputDir}\n`);

  // ① DART collection — already done (k-dart skill)
  console.log("✅ ① DART Collection — using existing data");

  // ② Validation
  console.log("🔄 ② Running Validation Engine...");
  const validationOutput = join(outputDir, "validation", `validation-report-${today}.json`);
  const validationJson = await runPythonScript("validate.py", [dartPath]);
  writeFileSync(validationOutput, validationJson, "utf-8");
  const validationReport = JSON.parse(validationJson);
  console.log(`   ✅ Validation complete: ${validationReport.summary.pass_rate}% pass rate (${validationReport.summary.passed}/${validationReport.summary.total_checks})`);

  // ③ Normalization
  console.log("🔄 ③ Running Normalization...");
  const canonicalOutput = join(outputDir, "canonical", `canonical-model-${today}.json`);
  const mappingPath = resolve(scriptDir, "..", "..", "python", "mappings", "ifrs_general.json");
  const canonicalJson = await runPythonScript("normalize.py", [dartPath, mappingPath]);
  writeFileSync(canonicalOutput, canonicalJson, "utf-8");
  const canonicalModel = JSON.parse(canonicalJson);
  console.log(`   ✅ Normalization complete: ${canonicalModel.meta.coverage.coverage_pct}% field coverage (${canonicalModel.meta.coverage.mapped}/${canonicalModel.meta.coverage.total_fields})`);

  // ④ KPI Extraction
  console.log("🔄 ④ Extracting KPIs...");
  const kpiOutput = join(outputDir, "kpi", `kpi-report-${today}.json`);
  const kpiJson = await runPythonScript("kpi.py", [canonicalOutput]);
  writeFileSync(kpiOutput, kpiJson, "utf-8");
  console.log(`   ✅ KPI extraction complete`);

  // ⑤ ROIC Value Driver Tree
  console.log("🔄 ⑤ Building ROIC Value Driver Tree...");
  const treeOutput = join(outputDir, "driver-tree", `driver-tree-${today}.json`);
  const treeJson = await runPythonScript("driver_tree.py", [canonicalOutput]);
  writeFileSync(treeOutput, treeJson, "utf-8");
  console.log(`   ✅ Driver tree complete`);

  // ⑥ Report Generation
  console.log("🔄 ⑥ Generating Markdown Report...");
  const reportOutput = join(outputDir, "reports", `financial-analysis-${companyName}-${today}.md`);
  // Import and run report generator
  const { generateReport } = await import("./financial-report.ts");
  const report = generateReport(canonicalModel, validationReport, JSON.parse(kpiJson), JSON.parse(treeJson));
  writeFileSync(reportOutput, report, "utf-8");
  console.log(`   ✅ Report saved to: ${reportOutput}`);

  console.log(`\n🎉 Pipeline complete! All outputs in: ${outputDir}`);
  console.log(`   ├── validation/validation-report-${today}.json`);
  console.log(`   ├── canonical/canonical-model-${today}.json`);
  console.log(`   ├── kpi/kpi-report-${today}.json`);
  console.log(`   ├── driver-tree/driver-tree-${today}.json`);
  console.log(`   └── reports/financial-analysis-${companyName}-${today}.md`);
}

main().catch((err) => {
  console.error(`Pipeline failed: ${err.message}`);
  process.exit(1);
});
