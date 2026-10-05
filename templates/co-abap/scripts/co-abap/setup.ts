#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0: Honest installs (spec docs/designs/2026-10-05-consult-abap-develop-review-remediation-design.md D4):
//         uv branch uses `uv pip install --python .venv` (uv install is not a subcommand) and
//         targets the created .venv; every pass() is preceded by an exit-code check and a
//         failed required step makes the overall exit non-zero; rtk install is gated behind
//         --with-rtk; Windows python detection uses exitCode fallthrough (nothrow never throws).
// v1.0.3: UNKNOWN-STACK guidance routes tool installation through the PM with the
//         security-review clause (spec docs/designs/2026-09-25-variant-hygiene-batch-design.md,
//         R3b) — the previous text invoked a setup agent this variant never shipped.
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
//   Unknown    (none of the above)   → manual setup via PM-approved tool installation
//
// Usage: bun scripts/co-abap/setup.ts [--skip-install] [--skip-license-check] [--skip-commit]
//        [--with-gemini-plugins] [--with-rtk]

import path from "node:path";
import * as fs from "node:fs";
import { $ } from "bun";

const scriptDir = path.dirname(import.meta.path);
// scripts/co-abap/ → project root (two levels up): .env, .venv, manifests and the
// git repo all live at the project root, not under scripts/.
const projectRoot = path.resolve(scriptDir, "..", "..");

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
// Global tool install (brew/cargo compiles third-party code and writes outside the
// project) — same opt-in policy as the gemini-plugins section above.
const WITH_RTK = args.includes("--with-rtk");

// Required install steps that failed. A failure here must make the overall exit
// non-zero — "PASS" is only printed when a step actually succeeded.
let requiredFailures = 0;

function pass(msg: string) {
  console.log(`${GREEN}[PASS]${RESET} ${msg}`);
}
function info(msg: string) {
  console.log(`${CYAN}[INFO]${RESET} ${msg}`);
}
function warn(msg: string) {
  console.log(`${YELLOW}[WARN]${RESET} ${msg}`);
}
/** Record a failed required step: warn (not pass) and count toward a non-zero exit. */
function failStep(msg: string) {
  warn(msg);
  requiredFailures++;
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

async function licenseAuditPython(attemptInstall = true) {
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
    if (!attemptInstall) {
      // Guard against infinite recursion: installing pip-licenses (e.g. into .venv
      // via uv) does not necessarily put it on PATH, so a retry would loop forever.
      warn("pip-licenses unavailable after install attempt - skipping Python license audit");
      warn("   Manual check: pip install pip-licenses && pip-licenses --format=csv");
      return;
    }
    info("pip-licenses not installed - installing for audit...");
    // `uv install` is not a subcommand - uv exposes pip-compatible installs via
    // `uv pip install` (which auto-discovers .venv in the project root).
    const installed = (await cmdExists("uv"))
      ? await run("uv", "pip", "install", "pip-licenses", "--quiet")
      : await run("pip", "install", "pip-licenses", "--quiet");
    if (installed) {
      await licenseAuditPython(false);
    } else {
      warn("Could not install pip-licenses - skipping Python license audit");
      warn("   Manual check: pip install pip-licenses && pip-licenses --format=csv");
    }
  }
}

/** Create .venv in the project root if missing. Returns true when .venv exists afterwards. */
async function ensurePythonVenv(hasUv: boolean, hasPython: boolean): Promise<boolean> {
  if (fs.existsSync(".venv")) return true;
  if (hasUv) {
    info("Creating Python virtual environment with uv (.venv)...");
    const { exitCode } = await $`uv venv .venv`.quiet().nothrow();
    if (exitCode === 0) {
      pass(".venv created (uv)");
      return true;
    }
    failStep("uv venv failed - create it manually: uv venv .venv");
    return false;
  }
  if (hasPython) {
    info("uv not found - creating .venv with python3 -m venv (fallback)...");
    const { exitCode } = await $`python3 -m venv .venv`.quiet().nothrow();
    if (exitCode === 0) {
      pass(".venv created (venv)");
      return true;
    }
    failStep("python3 -m venv failed - create it manually: python3 -m venv .venv");
    return false;
  }
  failStep("Neither uv nor Python 3 found - cannot create .venv");
  return false;
}

/** Path of the interpreter inside the project-root .venv (POSIX layout vs Windows layout). */
function venvPythonPath(): string {
  return process.platform === "win32"
    ? path.join(".venv", "Scripts", "python.exe")
    : path.join(".venv", "bin", "python");
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
  // exitCode-based fallthrough: .nothrow() shells never throw, so the previous
  // try/catch was dead code and Windows `python` was never probed. `python3`
  // wins when present; on Windows fall back to `python`, which may be the
  // Store alias (exit code 9009 / non-Python-3 banner) — hence the banner check.
  let hasPython = (await $`python3 --version`.quiet().nothrow()).exitCode === 0;
  if (!hasPython) {
    const py = await $`python --version`.quiet().nothrow();
    hasPython = py.exitCode === 0 && py.stdout.toString().includes("Python 3");
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
        else failStep("bun install in scripts/ failed - agent orchestration deps missing");
      }
    }

    // ── Node.js ──────────────────────────────────────────────────────────────────
    if (fs.existsSync("package.json")) {
      if (await cmdExists("bun")) {
        info("Node.js project detected - running bun install");
        const { exitCode } = await $`bun install`.quiet().nothrow();
        if (exitCode === 0) pass("bun install complete");
        else failStep("bun install failed - Node.js dependencies missing");
        await licenseAuditNode();
      } else {
        failStep("bun not found - install Bun from https://bun.sh");
      }
    }

    // ── Python (requirements.txt) ──────────────────────────────────────────────
    if (fs.existsSync("requirements.txt")) {
      info("Python project detected (requirements.txt)");
      if (await ensurePythonVenv(hasUv, hasPython)) {
        // Install requirements INTO the created .venv. `uv install` is not a
        // subcommand — uv exposes pip-compatible installs via `uv pip install`,
        // pointed at .venv explicitly. Plain pip has no venv awareness, so go
        // through the venv's own interpreter instead.
        const reqResult = hasUv
          ? await $`uv pip install -r requirements.txt --python .venv`.quiet().nothrow()
          : await $`${venvPythonPath()} -m pip install -r requirements.txt`.quiet().nothrow();
        if (reqResult.exitCode === 0) {
          pass(`Dependencies installed (requirements.txt) via ${hasUv ? "uv pip" : "venv pip"}`);
          await licenseAuditPython();
        } else {
          failStep("Python dependency install failed (requirements.txt) - review the errors above and re-run");
        }
      } else {
        failStep("No .venv available - Python dependencies not installed");
      }
    }

    // ── Python (pyproject.toml, no requirements.txt) ──────────────────────────
    if (fs.existsSync("pyproject.toml") && !fs.existsSync("requirements.txt")) {
      info("Python project detected (pyproject.toml)");
      if (await ensurePythonVenv(hasUv, hasPython)) {
        const reqResult = hasUv
          ? await $`uv pip install -e . --python .venv`.quiet().nothrow()
          : await $`${venvPythonPath()} -m pip install -e .`.quiet().nothrow();
        if (reqResult.exitCode === 0) {
          pass(`Dependencies installed (pyproject.toml) via ${hasUv ? "uv pip" : "venv pip"}`);
          await licenseAuditPython();
        } else {
          failStep("Python dependency install failed (pyproject.toml) - review the errors above and re-run");
        }
      } else {
        failStep("No .venv available - Python dependencies not installed");
      }
    }

    // ── Ruby ────────────────────────────────────────────────────────────────────
    if (fs.existsSync("Gemfile")) {
      if (await cmdExists("bundle")) {
        info("Ruby project detected - running bundle install");
        const { exitCode } = await $`bundle install`.quiet().nothrow();
        if (exitCode === 0) pass("bundle install complete");
        else failStep("bundle install failed - Ruby dependencies missing");
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
        const { exitCode } = await $`dotnet restore`.quiet().nothrow();
        if (exitCode === 0) pass("dotnet restore complete");
        else failStep("dotnet restore failed - .NET dependencies missing");
      } else {
        failStep("dotnet not found - install .NET SDK from https://dotnet.microsoft.com/download");
      }
    }

    // ── Java / Maven ────────────────────────────────────────────────────────────
    if (fs.existsSync("pom.xml")) {
      if (await cmdExists("mvn")) {
        info("Maven project detected - running mvn dependency:resolve -q");
        const { exitCode } = await $`mvn dependency:resolve -q`.quiet().nothrow();
        if (exitCode === 0) pass("mvn dependency:resolve complete");
        else failStep("mvn dependency:resolve failed - check pom.xml and repository access");
      } else {
        failStep("mvn not found - install Maven from https://maven.apache.org");
      }
    }

    // ── Java / Gradle ─────────────────────────────────────────────────────────
    if (fs.existsSync("build.gradle") || fs.existsSync("build.gradle.kts")) {
      const gradleCmd = fs.existsSync("./gradlew") ? "./gradlew" : "gradle";
      if (await cmdExists(gradleCmd)) {
        info(`Gradle project detected - running ${gradleCmd} dependencies (quiet)`);
        const { exitCode } = await $`${gradleCmd} dependencies -q`.quiet().nothrow();
        if (exitCode === 0) pass("Gradle dependencies resolved");
        else failStep("Gradle dependency resolution failed - check the build file");
      } else {
        failStep("Gradle not found - install from https://gradle.org");
      }
    }

    // ── Go ───────────────────────────────────────────────────────────────────────
    if (fs.existsSync("go.mod")) {
      if (await cmdExists("go")) {
        info("Go project detected - running go mod download");
        const { exitCode } = await $`go mod download`.quiet().nothrow();
        if (exitCode === 0) pass("go mod download complete");
        else failStep("go mod download failed - check go.mod and module proxy access");
      } else {
        failStep("go not found - install Go from https://go.dev/dl/");
      }
    }

    // ── Rust ────────────────────────────────────────────────────────────────────
    if (fs.existsSync("Cargo.toml")) {
      if (await cmdExists("cargo")) {
        info("Rust project detected - running cargo fetch");
        const { exitCode } = await $`cargo fetch`.quiet().nothrow();
        if (exitCode === 0) pass("cargo fetch complete");
        else failStep("cargo fetch failed - check Cargo.toml and registry access");
      } else {
        failStep("cargo not found - install Rust from https://rustup.rs");
      }
    }

    // ── Elixir / Mix ────────────────────────────────────────────────────────────
    if (fs.existsSync("mix.exs")) {
      if (await cmdExists("mix")) {
        info("Elixir project detected - running mix deps.get");
        const { exitCode } = await $`mix deps.get`.quiet().nothrow();
        if (exitCode === 0) pass("mix deps.get complete");
        else failStep("mix deps.get failed - check mix.exs and hex.pm access");
      } else {
        failStep("mix not found - install Elixir from https://elixir-lang.org");
      }
    }

    // ── C/C++ (CMake) ──────────────────────────────────────────────────────────
    if (fs.existsSync("CMakeLists.txt")) {
      if (await cmdExists("cmake")) {
        info("CMake project detected - configuring build (cmake -B build)");
        const { exitCode } = await $`cmake -B build -S .`.quiet().nothrow();
        if (exitCode === 0) pass("CMake configure complete - build artifacts in build/");
        else failStep("cmake configure failed - review CMakeLists.txt errors above");
        info("  To build: cmake --build build");
      } else {
        failStep("cmake not found - install from https://cmake.org");
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
      console.log("  To set up this project, install your stack's tooling manually:");
      console.log("");
      console.log(`${CYAN}  Route: request tool installation through the PM${RESET}`);
      console.log("");
      console.log("  The process:");
      console.log("    1. Identify the canonical installer for your stack");
      console.log("    2. Request installation through the PM, listing the proposed commands");
      console.log("    3. Every install command passes security review first");
      console.log("    4. Execute ONLY after explicit approval");
      console.log("");
      console.log(`${RED}  ⛔ Do NOT run any install commands without security review and explicit user approval.${RESET}`);
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

  // ── 4. Install RTK (Rust Token Killer) — opt-in: --with-rtk ─────────────────
  // `brew install` / `cargo install --git` compile third-party code and write
  // outside the project, so they never run by default (same policy as the
  // --with-gemini-plugins section above: no tool install without user opt-in).
  if (!WITH_RTK) {
    info("Skipping rtk install (pass --with-rtk to enable).");
  } else if (osType === "macos" || osType === "linux") {
    if (!(await cmdExists("rtk"))) {
      info("Installing rtk (Rust Token Killer) for AI token optimization...");
      if (await cmdExists("brew")) {
        const { exitCode } = await $`brew install rtk`.quiet().nothrow();
        if (exitCode === 0) pass("rtk installed via Homebrew");
        else warn("brew install rtk failed - install manually or continue without rtk");
      } else if (await cmdExists("cargo")) {
        const { exitCode } = await $`cargo install --git https://github.com/rtk-ai/rtk`.quiet().nothrow();
        if (exitCode === 0) pass("rtk installed via Cargo");
        else warn("cargo install rtk failed - install manually or continue without rtk");
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

  if (requiredFailures > 0) {
    console.error("");
    console.error(
      `${RED}❌ Setup finished with ${requiredFailures} failed required step(s).${RESET}`
    );
    console.error("   Review the [WARN] lines above, fix the causes, then re-run setup.ts.");
    process.exitCode = 1;
    return;
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
