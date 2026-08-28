#!/usr/bin/env bun
// @version 1.0.2
// setup.ts - Post-scaffold environment setup
// Detects OS and tech stack, installs dependencies, audits licenses, copies .env,
// and makes initial commit.
//
// Supported stacks:
//   Node.js    package.json          → bun install  → license-checker audit
//   Python     requirements.txt /    → uv venv + uv pip install (fallback: python -m venv + pip)
//              pyproject.toml           → pip-licenses audit
//   Ruby       Gemfile               → bundle install
//   .NET       *.csproj / *.sln      → dotnet restore
//   Java       pom.xml (Maven)       → mvn dependency:resolve
//              build.gradle (Gradle) → ./gradlew dependencies
//   Go         go.mod                → go mod download
//   Rust       Cargo.toml            → cargo fetch
//   Elixir     mix.exs               → mix deps.get
//   C/C++      CMakeLists.txt        → cmake -B build (configure only)
//              Makefile              → info only (not run automatically)
//   Unknown    (none of the above)   → stack-setup agent invocation required
//
// Usage: bun scripts/setup.ts [--skip-install] [--skip-license-check] [--skip-commit] [--with-gemini-plugins]

import path from "node:path";
import * as fs from "node:fs";
import { $ } from "bun";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

// OSI-approved licenses accepted by default
const OSS_LICENSES =
  "MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;Apache-1.1;CC0-1.0;CC-BY-3.0;CC-BY-4.0;Unlicense;0BSD;PSF-2.0;Python-2.0;MPL-2.0;LGPL-2.0;LGPL-2.1;LGPL-3.0;Artistic-2.0;Zlib;BlueOak-1.0.0";

// Parse flags
const args = process.argv.slice(2);
const SKIP_INSTALL = args.includes("--skip-install");
const SKIP_LICENSE = args.includes("--skip-license-check");
const SKIP_COMMIT = args.includes("--skip-commit");
// Remote-code installs are opt-in: they clone/download and execute third-party code.
const WITH_GEMINI_PLUGINS = args.includes("--with-gemini-plugins");

function pass(msg: string) {
  console.log(`${GREEN}[PASS]${RESET} ${msg}`);
}
function info(msg: string) {
  console.log(`${CYAN}[INFO]${RESET} ${msg}`);
}
function warn(msg: string) {
  console.log(`${YELLOW}[WARN]${RESET} ${msg}`);
}

/** Check if a command exists on PATH */
async function cmdExists(cmd: string): Promise<boolean> {
  const { exitCode } = await $`command -v ${cmd}`.quiet().nothrow();
  return exitCode === 0;
}

/** Run a command, return true if successful, false otherwise */
async function run(cmd: string, ...args: string[]): Promise<boolean> {
  try {
    const { exitCode } = await $`${cmd} ${args}`.quiet().nothrow();
    return exitCode === 0;
  } catch {
    return false;
  }
}

async function licenseAuditNode() {
  if (SKIP_LICENSE) {
    info("Skipping license audit (--skip-license-check)");
    return;
  }
  info("Running Node.js license audit...");
  if (await cmdExists("bunx")) {
    const { exitCode } =
      await $`bunx license-checker --summary --onlyAllow ${OSS_LICENSES}`.quiet().nothrow();
    if (exitCode === 0) {
      pass("License audit passed - all packages use OSI-approved licenses");
    } else {
      warn("⚠  License audit flagged non-OSS packages. Review before committing.");
      warn("   Run: bunx license-checker --summary");
      warn("   Document any justified exceptions in docs/context.md § Non-OSS Dependencies");
    }
  } else {
    warn("bunx not available - skipping Node.js license audit");
  }
}

async function licenseAuditPython() {
  if (SKIP_LICENSE) {
    info("Skipping license audit (--skip-license-check)");
    return;
  }
  info("Running Python license audit...");
  if (await cmdExists("pip-licenses")) {
    const { stdout, exitCode } = await $`pip-licenses --format=csv`.quiet().nothrow();
    if (exitCode === 0) {
      const lines = stdout.toString().split("\n");
      const flagged = lines.filter(
        (l) =>
          l.toLowerCase() !== "name" &&
          /gpl-3|agpl|sspl|bsl|proprietary|commercial/i.test(l)
      );
      if (flagged.length === 0) {
        pass("License audit passed - no restrictive licenses detected");
      } else {
        warn("⚠  License audit flagged these packages:");
        flagged.forEach((l) => warn(`   ${l}`));
        warn("   Document any justified exceptions in docs/context.md § Non-OSS Dependencies");
      }
    } else {
      warn("pip-licenses failed - skipping audit");
    }
  } else {
    info("pip-licenses not installed - installing for audit...");
    const pipCmd = (await cmdExists("uv")) ? "uv" : "pip";
    const installed = await run(pipCmd, "install", "pip-licenses", "--quiet");
    if (installed) {
      await licenseAuditPython();
    } else {
      warn("Could not install pip-licenses - skipping Python license audit");
      warn("   Manual check: pip install pip-licenses && pip-licenses --format=csv");
    }
  }
}

async function main() {
  // Change to project root for all operations
  process.chdir(projectRoot);

  console.log(`${CYAN}=== setup.ts - environment setup ===${RESET}`);

  // ── OS detection ──────────────────────────────────────────────────────────────
  const osType =
    process.platform === "darwin"
      ? "macos"
      : process.platform === "linux"
        ? "linux"
        : "windows-bash";
  info(`Detected OS: ${osType}`);

  // ── Python toolchain resolution ──────────────────────────────────────────────
  const hasUv = await cmdExists("uv");
  let hasPython = false;
  try {
    const { exitCode } = await $`python3 --version`.quiet().nothrow();
    hasPython = exitCode === 0;
  } catch {
    try {
      const { exitCode } = await $`python --version`.quiet().nothrow();
      const { stdout } = await $`python --version`.quiet().nothrow();
      hasPython = exitCode === 0 && stdout.toString().includes("Python 3");
    } catch {
      hasPython = false;
    }
  }

  // ── 1. .env.sample → .env ─────────────────────────────────────────────────────
  if (fs.existsSync(".env.sample") && !fs.existsSync(".env")) {
    fs.copyFileSync(".env.sample", ".env");
    pass(".env created from .env.sample - fill in secrets before running the app");
  } else if (fs.existsSync(".env")) {
    info(".env already exists - skipping copy");
  }

  // ── 2. Dependency install + license audit (stack auto-detection) ──────────────
  if (!SKIP_INSTALL) {
    // ── Bun Agent Orchestration ────────────────────────────────────────────────
    if (fs.existsSync("scripts/package.json")) {
      if (await cmdExists("bun")) {
        info("Agent orchestration (Bun) detected - running bun install in scripts/");
        const { exitCode } = await $`cd scripts && bun install`.quiet().nothrow();
        if (exitCode === 0) pass("bun install complete");
      }
    }

    // ── Node.js ──────────────────────────────────────────────────────────────────
    if (fs.existsSync("package.json")) {
      if (await cmdExists("bun")) {
        info("Node.js project detected - running bun install");
        await $`bun install`.quiet().nothrow();
        pass("bun install complete");
        await licenseAuditNode();
      } else {
        warn("bun not found - install Bun from https://bun.sh");
      }
    }

    // ── Python (requirements.txt) ──────────────────────────────────────────────
    if (fs.existsSync("requirements.txt")) {
      info("Python project detected (requirements.txt)");
      // venv creation
      if (hasUv) {
        if (!fs.existsSync(".venv")) {
          info("Creating Python virtual environment with uv (.venv)...");
          await $`uv venv .venv`.quiet().nothrow();
          pass(".venv created (uv)");
        }
      } else if (hasPython) {
        if (!fs.existsSync(".venv")) {
          info("uv not found - creating .venv with python -m venv (fallback)");
          await $`python3 -m venv .venv`.quiet().nothrow();
          pass(".venv created (venv)");
        }
      } else {
        warn("Neither uv nor Python 3 found - skipping venv");
      }

      // Install requirements
      const pipCmd = hasUv ? "uv" : "pip";
      const { exitCode } = await $`${pipCmd} install -r requirements.txt`.quiet().nothrow();
      if (exitCode === 0) {
        pass(`Dependencies installed (requirements.txt) via ${pipCmd}`);
        await licenseAuditPython();
      }
    }

    // ── Python (pyproject.toml, no requirements.txt) ──────────────────────────
    if (fs.existsSync("pyproject.toml") && !fs.existsSync("requirements.txt")) {
      info("Python project detected (pyproject.toml)");
      const pipCmd = hasUv ? "uv" : "pip";
      const { exitCode } = await $`${pipCmd} install -e .`.quiet().nothrow();
      if (exitCode === 0) {
        pass(`Dependencies installed (pyproject.toml) via ${pipCmd}`);
        await licenseAuditPython();
      }
    }

    // ── Ruby ────────────────────────────────────────────────────────────────────
    if (fs.existsSync("Gemfile")) {
      if (await cmdExists("bundle")) {
        info("Ruby project detected - running bundle install");
        await $`bundle install`.quiet().nothrow();
        pass("bundle install complete");
        if (!SKIP_LICENSE && (await cmdExists("licensee"))) {
          info("Running Ruby license audit (licensee)...");
          await $`licensee detect --json`.quiet().nothrow();
        } else if (!SKIP_LICENSE) {
          info("  Optional license audit: gem install licensee && licensee detect");
        }
      } else {
        warn("bundle not found - run: gem install bundler");
      }
    }

    // ── .NET ────────────────────────────────────────────────────────────────────
    const dotnetFiles = fs.readdirSync(".").filter(
      (f) => /\.(csproj|sln|fsproj)$/.test(f)
    );
    // Also search subdirectories up to depth 3
    if (dotnetFiles.length === 0) {
      try {
        for (const dir of ["src", "lib", "app"]) {
          if (fs.existsSync(dir)) {
            const sub = fs.readdirSync(dir);
            dotnetFiles.push(...sub.filter((f) => /\.(csproj|sln|fsproj)$/.test(f)));
          }
        }
      } catch {
        // ignore
      }
    }
    if (dotnetFiles.length > 0) {
      if (await cmdExists("dotnet")) {
        info(`.NET project detected (${dotnetFiles[0]}) - running dotnet restore`);
        await $`dotnet restore`.quiet().nothrow();
        pass("dotnet restore complete");
      } else {
        warn("dotnet not found - install .NET SDK from https://dotnet.microsoft.com/download");
      }
    }

    // ── Java / Maven ────────────────────────────────────────────────────────────
    if (fs.existsSync("pom.xml")) {
      if (await cmdExists("mvn")) {
        info("Maven project detected - running mvn dependency:resolve -q");
        await $`mvn dependency:resolve -q`.quiet().nothrow();
        pass("mvn dependency:resolve complete");
      } else {
        warn("mvn not found - install Maven from https://maven.apache.org");
      }
    }

    // ── Java / Gradle ─────────────────────────────────────────────────────────
    if (fs.existsSync("build.gradle") || fs.existsSync("build.gradle.kts")) {
      const gradleCmd = fs.existsSync("./gradlew") ? "./gradlew" : "gradle";
      if (await cmdExists(gradleCmd)) {
        info(`Gradle project detected - running ${gradleCmd} dependencies (quiet)`);
        await $`${gradleCmd} dependencies -q`.quiet().nothrow();
        pass("Gradle dependencies resolved");
      } else {
        warn("Gradle not found - install from https://gradle.org");
      }
    }

    // ── Go ───────────────────────────────────────────────────────────────────────
    if (fs.existsSync("go.mod")) {
      if (await cmdExists("go")) {
        info("Go project detected - running go mod download");
        await $`go mod download`.quiet().nothrow();
        pass("go mod download complete");
      } else {
        warn("go not found - install Go from https://go.dev/dl/");
      }
    }

    // ── Rust ────────────────────────────────────────────────────────────────────
    if (fs.existsSync("Cargo.toml")) {
      if (await cmdExists("cargo")) {
        info("Rust project detected - running cargo fetch");
        await $`cargo fetch`.quiet().nothrow();
        pass("cargo fetch complete");
      } else {
        warn("cargo not found - install Rust from https://rustup.rs");
      }
    }

    // ── Elixir / Mix ────────────────────────────────────────────────────────────
    if (fs.existsSync("mix.exs")) {
      if (await cmdExists("mix")) {
        info("Elixir project detected - running mix deps.get");
        await $`mix deps.get`.quiet().nothrow();
        pass("mix deps.get complete");
      } else {
        warn("mix not found - install Elixir from https://elixir-lang.org");
      }
    }

    // ── C/C++ (CMake) ──────────────────────────────────────────────────────────
    if (fs.existsSync("CMakeLists.txt")) {
      if (await cmdExists("cmake")) {
        info("CMake project detected - configuring build (cmake -B build)");
        await $`cmake -B build -S .`.quiet().nothrow();
        pass("CMake configure complete - build artifacts in build/");
        info("  To build: cmake --build build");
      } else {
        warn("cmake not found - install from https://cmake.org");
      }
    }

    // ── C/C++ (plain Makefile, no CMake) ───────────────────────────────────────
    if (fs.existsSync("Makefile") && !fs.existsSync("CMakeLists.txt")) {
      if (await cmdExists("make")) {
        info("Makefile detected - 'make' available but NOT run automatically");
        info("  Run manually: make");
      }
    }

    // ── Unknown stack detection ────────────────────────────────────────────────
    const KNOWN_MANIFESTS = [
      "package.json", "requirements.txt", "pyproject.toml", "Gemfile",
      "go.mod", "Cargo.toml", "mix.exs",
      "pom.xml", "build.gradle", "build.gradle.kts",
      "CMakeLists.txt", "Makefile",
    ];
    const foundStack = KNOWN_MANIFESTS.some((m) => fs.existsSync(m)) || dotnetFiles.length > 0;

    if (!foundStack) {
      console.log("");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`${YELLOW}⚠  UNKNOWN STACK - manual setup required${RESET}`);
      console.log("");
      console.log("  No recognized project manifest found in this directory.");
      console.log("  Automatic dependency installation has been skipped.");
      console.log("");
      console.log("  To set up this project, invoke the stack-setup agent:");
      console.log("");
      console.log(`${CYAN}  Agent: agents/stack-setup.md${RESET}`);
      console.log("");
      console.log("  The agent will:");
      console.log("    1. Search for the correct setup procedure for your stack");
      console.log("    2. Perform a security review of all proposed commands");
      console.log("    3. Present the plan with risk assessment for your approval");
      console.log("    4. Execute ONLY after explicit confirmation");
      console.log("");
      console.log(`${RED}  ⛔ Do NOT run any install commands without agent security review.${RESET}`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
    }
  } else {
    info("Skipping dependency install (--skip-install)");
  }

  // ── 3. Gemini Plugins Setup (opt-in: --with-gemini-plugins) ──────────────────
  const superpowersDir = path.join(
    process.env.HOME || process.env.USERPROFILE || "",
    ".gemini", "config", "plugins", "superpowers"
  );
  if (WITH_GEMINI_PLUGINS) {
    if (!fs.existsSync(superpowersDir)) {
      info("Gemini superpowers plugin not found - installing globally...");
      fs.mkdirSync(path.dirname(superpowersDir), { recursive: true });
      const { exitCode } = await $`git clone https://github.com/obra/superpowers ${superpowersDir}`.quiet().nothrow();
      if (exitCode === 0) {
        pass("superpowers plugin installed successfully");
      } else {
        warn("Failed to install superpowers plugin");
      }
    }
  } else {
    info("Skipping Gemini superpowers plugin install (pass --with-gemini-plugins to enable).");
  }

  // ── 4. Install RTK (Rust Token Killer) ─────────────────────────────────────────
  if (osType === "macos" || osType === "linux") {
    if (!(await cmdExists("rtk"))) {
      info("Installing rtk (Rust Token Killer) for AI token optimization...");
      if (await cmdExists("brew")) {
        await $`brew install rtk`.quiet().nothrow();
        pass("rtk installed via Homebrew");
      } else if (await cmdExists("cargo")) {
        await $`cargo install --git https://github.com/rtk-ai/rtk`.quiet().nothrow();
        pass("rtk installed via Cargo");
      } else {
        warn("Neither Homebrew nor Cargo found - skipping rtk installation.");
      }
    } else {
      info("rtk is already installed.");
    }
  } else {
    info("Skipping rtk installation (Windows native is not fully supported).");
  }

  // ── 5. Install githooks ─────────────────────────────────────────────────────
  const githooksDir = path.join(projectRoot, ".githooks");
  if (fs.existsSync(githooksDir)) {
    const { exitCode: hookDir } = await $`git config core.hooksPath .githooks`.quiet().nothrow();
    if (hookDir === 0) {
      pass("Githooks configured (core.hooksPath → .githooks/)");
    } else {
      warn("Failed to set core.hooksPath — configure manually: git config core.hooksPath .githooks");
    }
  } else {
    info("No .githooks/ directory found — skipping githooks setup");
  }

  // ── 6. Initialize memory log ────────────────────────────────────────────────
  const dateStr = new Date().toISOString().split("T")[0];
  const memoryDir = path.join(projectRoot, "memory");
  if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

  const logPath = path.join(memoryDir, `${dateStr}.md`);
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(
      logPath,
      "## Session - chore: initial scaffold\n\n- Project successfully scaffolded from workspace templates.\n",
      "utf-8"
    );
  }

  const indexPath = path.join(memoryDir, "MEMORY.md");
  if (fs.existsSync(indexPath)) {
    const idxContent = fs.readFileSync(indexPath, "utf-8");
    if (!idxContent.includes(`[${dateStr}]`)) {
      fs.appendFileSync(
        indexPath,
        `| [${dateStr}](${dateStr}.md) | chore: initial scaffold |\n`
      );
    }
  }

  // ── 7. Initial commit ─────────────────────────────────────────────────────────
  if (!SKIP_COMMIT) {
    const { exitCode: gitDir } = await $`git rev-parse --git-dir`.quiet().nothrow();
    if (gitDir === 0) {
      await $`git add -A`.quiet().nothrow();
      const { exitCode } =
        await $`git commit -m ${"chore: initial scaffold\n\nCo-Authored-By: Claude <noreply@anthropic.com>"}`.quiet().nothrow();
      if (exitCode === 0) {
        pass("Initial commit created");
      } else {
        warn("Nothing to commit (already committed?)");
      }
    } else {
      warn("Not inside a git repository - skipping initial commit");
    }
  } else {
    info("Skipping initial commit (--skip-commit)");
  }

  console.log("");
  console.log(`${GREEN}✅ Setup complete.${RESET}`);
  console.log("");
  console.log("Next:");
  console.log("  git remote add origin <url>");
  console.log("  git push -u origin main");
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`setup: ${e}`);
    process.exit(1);
  });
}

export { main };
