#!/usr/bin/env bun
// @version 1.1.0
// install-vsp.ts - Downloads and installs the vsp binary from GitHub Releases
// Canonical source (verified 2026-10-06 via GitHub API): oisee/vibing-steampunk
// publishes actual vsp release assets (vsp-<os>-<arch>[.exe] + checksums.txt);
// 5throck/vsp — referenced by older docs — returns 404 for both the repo and
// its releases. Version is PINNED (no releases/latest lookup); bump
// PINNED_VERSION deliberately after re-verifying the release assets.
// Integrity is FAIL-CLOSED: the release's checksums.txt manifest must be
// fetchable and contain an entry for the asset, or the install aborts.
// Usage: bun scripts/co-abap/install-vsp.ts [version]
//   version: optional tag override, e.g. v2.61.0 (default: PINNED_VERSION)

import path from "node:path";
import * as fs from "node:fs";
import { $ } from "bun";
import * as crypto from "node:crypto";

const scriptDir = path.dirname(import.meta.path);
// scripts/co-abap/ → project root (two levels up): the binary is installed at the project root.
const projectRoot = path.resolve(scriptDir, "..", "..");

const REPO = "oisee/vibing-steampunk";
// Pinned 2026-10-06: latest verified release at remediation time (assets
// confirmed via GitHub API: 6 vsp binaries + checksums.txt + LICENSE + NOTICE).
const PINNED_VERSION = "v2.60.0";
const FETCH_TIMEOUT_MS = 30_000;

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function detectPlatform(): { platform: string; arch: string } {
  const os = process.platform;
  let platform: string;
  switch (os) {
    case "darwin":
      platform = "darwin";
      break;
    case "linux":
      platform = "linux";
      break;
    case "win32":
      platform = "windows";
      break;
    default:
      throw new Error(`Unsupported OS: ${os}`);
  }

  const arch = process.arch;
  let archName: string;
  switch (arch) {
    case "x64":
      archName = "amd64";
      break;
    case "ia32":
      archName = "386";
      break;
    case "arm64":
      archName = "arm64";
      break;
    case "arm":
      archName = "arm";
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  return { platform, arch: archName };
}

/**
 * Fail-closed checksum lookup: return the expected SHA256 for `assetName` from
 * the release's checksums.txt manifest. Throws when the manifest is missing,
 * unfetchable, or has no entry for the asset — an unverified binary of a
 * privileged tool is never written to disk.
 */
async function expectedChecksum(assetName: string, version: string): Promise<string> {
  const manifestUrl = `https://github.com/${REPO}/releases/download/${version}/checksums.txt`;
  let res: Response;
  try {
    res = await fetch(manifestUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    throw new Error(
      `checksum manifest unreachable (${manifestUrl}): ${e instanceof Error ? e.message : e}`
    );
  }
  if (!res.ok) {
    throw new Error(`checksum manifest unavailable (HTTP ${res.status}): ${manifestUrl}`);
  }
  const manifest = await res.text();
  for (const line of manifest.split("\n")) {
    // sha256sum format: "<64-hex>  <filename>" (binary marker "*" tolerated)
    const m = /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(line);
    if (m && m[2] === assetName) return m[1].toLowerCase();
  }
  throw new Error(`checksum manifest has no entry for '${assetName}': ${manifestUrl}`);
}

async function main() {
  const { platform, arch } = detectPlatform();
  const installDir = projectRoot;
  const isWindows = platform === "windows";

  const assetName = isWindows
    ? `vsp-${platform}-${arch}.exe`
    : `vsp-${platform}-${arch}`;
  const target = path.join(installDir, isWindows ? "vsp.exe" : "vsp");

  console.log("--- vsp Installer (vibing-steampunk) ---");
  console.log(`Repo    : https://github.com/${REPO}`);
  console.log(`Platform: ${platform} / ${arch}`);
  console.log(`Asset   : ${assetName}`);
  console.log(`Target  : ${target}`);
  console.log("");

  // Resolve version: explicit CLI argument wins; otherwise the pinned tag.
  // No releases/latest API call — installs are reproducible and reviewed.
  const version = process.argv.slice(2)[0] || PINNED_VERSION;

  console.log(`Version : ${version}`);

  const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/${assetName}`;
  console.log(`URL     : ${downloadUrl}`);
  console.log("");

  // Download
  console.log("Downloading...");
  try {
    const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error("Download failed or file is empty.");
    }

    // Verify SHA256 against the release's checksums.txt manifest (fail-closed:
    // a missing/unfetchable manifest or entry aborts the install).
    const actual = crypto.createHash("sha256").update(buffer).digest("hex");
    const expected = await expectedChecksum(assetName, version);
    if (expected !== actual) {
      throw new Error(
        `Checksum mismatch for ${assetName}: expected ${expected}, got ${actual} — refusing to install`
      );
    }
    console.log(`${GREEN}✅ SHA256 verified against checksums.txt: ${actual.slice(0, 12)}…${RESET}`);

    fs.writeFileSync(target, buffer);

    // Make executable (non-Windows)
    if (!isWindows) {
      fs.chmodSync(target, 0o755);
    }
  } catch (e) {
    console.error(`${RED}Error: Download or verification failed: ${e instanceof Error ? e.message : e}${RESET}`);
    console.error(`       Check that the release asset and checksums.txt exist: ${downloadUrl}`);
    process.exit(1);
  }

  console.log("");
  console.log(`${GREEN}✅ vsp ${version} installed successfully.${RESET}`);
  console.log(`   Binary: ${target}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Configure SAP connection in your environment:");
  console.log("     export SAP_URL=https://your-sap-host:44300");
  console.log("     export SAP_USER=your-username");
  console.log("     export SAP_PASSWORD=your-password");
  console.log("     export SAP_CLIENT=100");
  console.log(`  2. Verify binary: ${target} --version`);
  console.log(`  3. Test SAP connection: ${target} system info`);
  console.log("");
  console.log("  4. Install ZADT_VSP WebSocket infrastructure (required for debugging,");
  console.log("     RunReport, and RFC features):");
  console.log("     - In a Claude/Gemini session: 'Install VSP infrastructure to package $TMP'");
  console.log("     - Then complete SAP GUI steps (see docs/setup-guide.md §9-C):");
  console.log("       a) SAPC: register application ZADT_VSP with handler ZCL_VSP_APC_HANDLER (Stateful)");
  console.log("       b) SICF: activate service node /sap/bc/apc/sap/zadt_vsp");
  console.log(`     - Verify: ${target} system info  →  ZADT_VSP: installed`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`install-vsp: ${e}`);
    process.exit(1);
  });
}

export { main };
