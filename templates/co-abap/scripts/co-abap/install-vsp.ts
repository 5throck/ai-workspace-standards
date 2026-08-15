#!/usr/bin/env bun
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
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(target, Buffer.from(buffer));

    // Verify download is non-empty
    const stat = fs.statSync(target);
    if (stat.size === 0) {
      console.error(`${RED}Error: Download failed or file is empty.${RESET}`);
      fs.unlinkSync(target);
      process.exit(1);
    }

    // Make executable (non-Windows)
    if (!isWindows) {
      fs.chmodSync(target, 0o755);
    }
  } catch (e) {
    console.error(`${RED}Error: Download failed: ${e}${RESET}`);
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
