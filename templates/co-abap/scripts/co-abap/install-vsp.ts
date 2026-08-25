#!/usr/bin/env bun
// @version 1.0.1
// install-vsp.ts - Downloads and installs the vsp binary from GitHub Releases
// Source: https://github.com/oisee/vibing-steampunk
// Usage: bun scripts/install-vsp.ts [version]
//   version: optional tag, e.g. v2.38.1 (default: latest)

import path from "node:path";
import * as fs from "node:fs";
import { $ } from "bun";
import * as crypto from "node:crypto";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");

const REPO = "oisee/vibing-steampunk";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
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

  // Resolve version
  let version = process.argv.slice(2)[0] || "";
  if (!version) {
    console.log("Fetching latest release...");
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/releases/latest`
      );
      const data = (await res.json()) as { tag_name: string };
      version = data.tag_name;
    } catch {
      console.error(`${RED}Error: Failed to fetch latest version from GitHub API.${RESET}`);
      console.error("       Check your internet connection or visit:");
      console.error(`       https://github.com/${REPO}/releases`);
      process.exit(1);
    }
  }

  console.log(`Version : ${version}`);

  const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/${assetName}`;
  console.log(`URL     : ${downloadUrl}`);
  console.log("");

  // Download
  console.log("Downloading...");
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error("Download failed or file is empty.");
    }

    // Verify SHA256 checksum when the release publishes a <asset>.sha256 file.
    const actual = crypto.createHash("sha256").update(buffer).digest("hex");
    try {
      const sumRes = await fetch(`${downloadUrl}.sha256`);
      if (sumRes.ok) {
        const expected = (await sumRes.text()).trim().split(/\s+/)[0].toLowerCase();
        if (expected && expected !== actual) {
          throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`);
        }
        console.log(`${GREEN}✅ SHA256 verified: ${actual.slice(0, 12)}…${RESET}`);
      } else {
        console.warn(`${CYAN}⚠ No checksum asset at ${downloadUrl}.sha256 — skipping integrity check.${RESET}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Checksum mismatch")) {
        throw e;
      }
      console.warn(`${CYAN}⚠ Could not verify checksum: ${e instanceof Error ? e.message : e}${RESET}`);
    }

    fs.writeFileSync(target, buffer);

    // Make executable (non-Windows)
    if (!isWindows) {
      fs.chmodSync(target, 0o755);
    }
  } catch (e) {
    console.error(`${RED}Error: Download failed: ${e instanceof Error ? e.message : e}${RESET}`);
    console.error(`       Check that the release asset exists: ${downloadUrl}`);
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
