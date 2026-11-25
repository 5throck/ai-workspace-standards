#!/usr/bin/env bun
// @version 1.1.0
// contained-run.ts — run project code without the runner's authority (meeting 2026-11-20, issue C)
//
// v1.1.0 (2026-11-25, PM finding 2 — design
//   docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md §4.9):
//   dependency location for a scripts-scoped manifest. `manifestDir` is the
//   project root when <project>/package.json exists; otherwise <project>/scripts
//   when <project>/scripts/package.json exists (design 2026-11-24-co-safety
//   scripts manifest). The node_modules check and the lifecycle-script refusal
//   both read from `manifestDir`, so a lifecycle script in scripts/package.json
//   is now refused (exit 3) instead of going unchecked. No install, every other
//   refusal and the dirty-tree assertion are unchanged.
//
// v1.0.0 (2026-11-20, meeting-2026-11-20-batch-runner-hardening): the v3 prompt made
//   STEP E/I run each project's own `bun scripts/audit.ts` and test suite directly in
//   the runner session — inheriting GH_TOKEN/GITHUB_TOKEN, reach to ../.. and
//   .pipeline-state, and the out-of-repo automation store. The security-expert called
//   this critical ("project-controlled code with runner authority"); the
//   automation-engineer supplied the implementable shape (env allowlist not bare
//   `env -i`, detached process-group kill for the deadline, node_modules required and
//   never installed, pre/post dirty-tree assertion instead of a hardlink mirror in v1).
//
// Containment provided here (v1):
//   · environment allowlist — only PATH/HOME(scratch)/TMPDIR/LANG/BUN_INSTALL_CACHE_DIR/GIT_CONFIG_GLOBAL
//   · credential deny — no GITHUB_TOKEN/GH_TOKEN/ANTHROPIC*/ZAI*/AWS*/NPM_TOKEN/SSH_AUTH_SOCK
//   · lifecycle-script refusal — package.json with preinstall/postinstall/prepare is
//     fail-closed (they execute arbitrary code before any test could be reviewed)
//   · per-project wall timeout, enforced by killing the process GROUP
//   · pre/post `git status --porcelain` assertion — a review must not mutate the tree
//
// Residual risk (recorded, not closed — see meeting transcript PRESERVED DISSENT):
//   unrestricted filesystem reads, arbitrary egress, and a project-authored
//   `scripts/audit.ts` still decides its own verdict.
//
// Usage:
//   bun scripts/contained-run.ts --project Projects/<p> -- bun scripts/audit.ts
//   bun scripts/contained-run.ts --project Projects/<p> --timeout 600 -- bun run test
//
// Exit codes: 0 command passed · 1 command failed · 2 usage · 3 refused (lifecycle
//   script or node_modules missing) · 4 tree mutated by the run · 124 timeout
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function die(msg: string, code = 2): never {
  console.error(`✗ contained-run: ${msg}`);
  process.exit(code);
}

const argv = process.argv.slice(2);
const flag = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const projectArg = flag("project");
if (!projectArg) die("requires --project <dir>");
const projectDir = resolve(projectArg);
if (!existsSync(projectDir)) die(`project not found: ${projectDir}`);

const sep = argv.indexOf("--");
if (sep < 0 || sep === argv.length - 1) die("requires '-- <command...>'");
const command = argv.slice(sep + 1);
const timeoutSec = Number(flag("timeout") ?? "900");
if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) die("bad --timeout");

// ── Dependency location (v1.1.0): the root manifest wins; a scripts-scoped
// manifest is accepted only when the project has no root package.json ─────────
const rootManifestDir = join(projectDir, "package.json");
const scriptsManifestDir = join(projectDir, "scripts", "package.json");
const manifestDir: string | null = existsSync(rootManifestDir)
  ? projectDir
  : existsSync(scriptsManifestDir)
    ? join(projectDir, "scripts")
    : null;

// ── Refuse lifecycle scripts: they run before any reviewable artifact ──────────
const pkgPath = manifestDir === null ? "" : join(manifestDir, "package.json");
if (manifestDir !== null) {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      scripts?: Record<string, string>;
      trustedDependencies?: string[];
    };
    const lifecycle = ["preinstall", "install", "postinstall", "prepare"].filter((k) => pkg.scripts?.[k]);
    if (lifecycle.length > 0) {
      die(
        `refused — ${pkgPath} declares lifecycle script(s) ${lifecycle.join(", ")}; ` +
          `these execute arbitrary code before anything can be reviewed. Adjudicate before running project code.`,
        3,
      );
    }
    if (Array.isArray(pkg.trustedDependencies) && pkg.trustedDependencies.length > 0) {
      console.warn(
        `⚠ package.json declares trustedDependencies (${pkg.trustedDependencies.length}) — not installed by this tool`,
      );
    }
  } catch (e) {
    die(`${pkgPath} unparsable (${(e as Error).message})`, 3);
  }
}

// ── Require node_modules; NEVER install (absence = SKIPPED, not FAIL) ─────────
if (manifestDir === null || !existsSync(join(manifestDir, "node_modules"))) {
  die(
    `node_modules absent in ${manifestDir ?? `${projectDir} (no package.json at the project root or under scripts/)`} — this tool never installs. The caller must SKIP ` +
      `(not FAIL) the project's suite for tonight and record the skip in the run manifest.`,
    3,
  );
}

// ── Environment allowlist (not bare env -i: bun needs PATH and HOME) ─────────
const scratchHome = mkdtempSync(join(tmpdir(), "contained-home-"));
const gitConfig = join(scratchHome, ".gitconfig");
Bun.write(gitConfig, "[user]\n\tname = contained-run\n\temail = contained-run@localhost\n");
// PATH: the standard system dirs plus ONLY the directory of the running runtime
// (so nvm/volta-installed bun and node resolve) — never the full inherited PATH.
const runtimeDir = process.execPath.slice(0, process.execPath.lastIndexOf("/")) || "/usr/bin";
const pathParts = ["/usr/bin", "/bin", "/usr/sbin", "/sbin", runtimeDir];
const env: Record<string, string> = {
  PATH: [...new Set(pathParts)].join(":"),
  HOME: scratchHome,
  TMPDIR: scratchHome,
  LANG: process.env.LANG ?? "en_US.UTF-8",
  GIT_CONFIG_GLOBAL: gitConfig,
  GIT_TERMINAL_PROMPT: "0",
  CI: "1",
};
if (process.env.BUN_INSTALL_CACHE_DIR) env.BUN_INSTALL_CACHE_DIR = process.env.BUN_INSTALL_CACHE_DIR;
// Denied by omission — listed explicitly so a future edit cannot "helpfully" forward them.
const DENIED = [
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN",
  "ACTIONS_TOKEN",
  "ANTHROPIC_API_KEY",
  "ZAI_API_KEY",
  "OPENAI_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "NPM_TOKEN",
  "SSH_AUTH_SOCK",
];
for (const k of DENIED) delete env[k];

function porcelain(): string {
  try {
    return execFileSync("git", ["-C", projectDir, "status", "--porcelain"], { encoding: "utf8" });
  } catch {
    return "";
  }
}

const before = porcelain();
const started = Date.now();

const child = spawn(command[0], command.slice(1), {
  cwd: projectDir,
  env,
  stdio: "inherit",
  detached: true, // own process group → the deadline kill reaches grandchildren
});

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  try {
    if (child.pid) process.kill(-child.pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}, timeoutSec * 1000);

const exitCode: number = await new Promise((resolveExit) => {
  child.on("error", (e) => {
    clearTimeout(timer);
    console.error(`✗ contained-run: spawn failed for '${command[0]}' — ${e.message}`);
    resolveExit(1);
  });
  child.on("exit", (code, signal) => {
    clearTimeout(timer);
    if (timedOut) resolveExit(124);
    else if (signal) resolveExit(1);
    else resolveExit(code ?? 1);
  });
});

const after = porcelain();
const mutated = before !== after;

rmSync(scratchHome, { recursive: true, force: true });

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `· contained-run: ${command.join(" ")} → exit ${exitCode} in ${secs}s (env-scrubbed, group-killed on ${timeoutSec}s)`,
);
if (mutated) {
  console.error("✗ contained-run: the project tree changed during the run — a review must not mutate state.");
  process.exit(4);
}
if (timedOut) console.error(`✗ contained-run: timed out after ${timeoutSec}s`);
process.exit(exitCode);
