// @version 1.0.0
#!/usr/bin/env bun
// install-bun.ts - Bun runtime installer
// Usage: bun scripts/install-bun.ts
// Note: This script requires Bun to already be installed (bootstrap paradox).
//       For initial installation, use the shell scripts or visit https://bun.sh

import { $ } from "bun";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

async function main() {
  console.log("📦 Checking Bun installation...");

  try {
    const { stdout } = await $`bun --version`.quiet().nothrow();
    const version = stdout.toString().trim();
    console.log(`${GREEN}✅ Bun is already installed: ${version}${RESET}`);
    console.log("");
    console.log("To upgrade, run: bun upgrade");
    return;
  } catch {
    // Bun not found via $ — check PATH manually
  }

  // Check if bun exists on PATH via which/where
  const os = process.platform;
  try {
    if (os === "win32") {
      const { stdout } = await $`where bun`.quiet().nothrow();
      if (stdout.toString().trim()) {
        const { stdout: verOut } = await $`bun --version`.quiet().nothrow();
        console.log(`${GREEN}✅ Bun is already installed: ${verOut.toString().trim()}${RESET}`);
        return;
      }
    } else {
      const { stdout } = await $`which bun`.quiet().nothrow();
      if (stdout.toString().trim()) {
        const { stdout: verOut } = await $`bun --version`.quiet().nothrow();
        console.log(`${GREEN}✅ Bun is already installed: ${verOut.toString().trim()}${RESET}`);
        return;
      }
    }
  } catch {
    // bun not on PATH
  }

  console.log(`${YELLOW}⚠️  Bun is not installed.${RESET}`);
  console.log("");
  console.log("Install Bun manually:");
  console.log("  • macOS/Linux: curl -fsSL https://bun.sh/install | bash");
  console.log("  • Windows:     powershell -c \"irm bun.sh/install.ps1 | iex\"");
  console.log("  • Or visit:    https://bun.sh");
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`install-bun: ${e}`);
    process.exit(1);
  });
}

export { main };
