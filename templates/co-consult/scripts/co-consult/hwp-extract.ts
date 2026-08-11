#!/usr/bin/env bun
/**
 * HWP Extraction Orchestrator
 * Spawns python/extract_hwp.py to parse HWP 5.0 OLE-compound-file + zlib
 * BodyText streams and extract document text without requiring the
 * 한글(Hancom) program installed.
 *
 * @version 1.0.0
 * Usage:
 *   bun scripts/co-consult/hwp-extract.ts <path-to.hwp> [--output <output-path>]
 * @module hwp-extract
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

function usage(): never {
  console.error("Usage: bun scripts/co-consult/hwp-extract.ts <path-to.hwp> [--output <output-path>]");
  process.exit(1);
}

/**
 * Quote a path argument for safe interpolation into the Windows shell.
 * Used because spawn() is invoked with `shell: true` on win32 (see comment
 * in financial-pipeline.ts) — that shell resolution otherwise passes
 * user-derived path arguments to cmd.exe without escaping, which is a
 * shell-injection-shaped risk if a path contains shell metacharacters.
 * No-op on non-Windows platforms where shell:false is used.
 */
function winQuote(path: string): string {
  return process.platform === "win32" ? `"${path.replace(/"/g, '\\"')}"` : path;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  const hwpPath = resolve(args[0]);
  const outputFlagIdx = args.indexOf("--output");
  const outputPath = outputFlagIdx >= 0 && args[outputFlagIdx + 1]
    ? resolve(args[outputFlagIdx + 1])
    : null;

  if (!existsSync(hwpPath)) {
    console.error(`Error: HWP file not found: ${hwpPath}`);
    process.exit(1);
  }

  const scriptDir = dirname(process.argv[1]);
  const scriptPath = resolve(scriptDir, "..", "..", "python", "extract_hwp.py");
  const pythonBin = process.platform === "win32" ? "python" : "python3";

  const proc = spawn(pythonBin, [scriptPath, winQuote(hwpPath)], {
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
      console.error(`python/extract_hwp.py exited with code ${code}`);
      if (stderr) console.error(stderr);
      process.exit(code ?? 1);
    }

    if (outputPath) {
      const dir = dirname(outputPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(outputPath, stdout, "utf-8");
      console.log(`Extracted text saved to: ${outputPath}`);
    } else {
      console.log(stdout);
    }
  });
}

main();
