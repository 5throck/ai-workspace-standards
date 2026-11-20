#!/usr/bin/env bun
// @version 1.0.0
// run-manifest.ts — run ledger for the unified batch runner (meeting 2026-11-20, issue A)
//
// v1.0.0 (2026-11-20, meeting-2026-11-20-batch-runner-hardening): the runner's
//   manifest was a pre-run HEAD census (`prerunHeads` only) while the REVERT rule
//   claimed reversibility "from the run manifest" and AC-4 claimed auditable merge
//   history. Two consecutive nights (2026-11-19, 2026-11-20) produced manifests with
//   zero merge rows, so a revert could not be reconstructed and the run was not
//   auditable. This CLI makes the manifest a write-on-merge ledger with a schema
//   verify that FAILS (exit 2) when a required array is absent or unparsable, so the
//   merge predicate can require a successful write (condition 7, ADR-0105 Decision 2
//   amendment).
//
// Usage:
//   bun scripts/run-manifest.ts init   --run <id> [--repo <path> ...] [--date YYYY-MM-DD]
//   bun scripts/run-manifest.ts step   --step <NAME> --status <begin|complete|failed|skipped-budget> [--reason <text>]
//   bun scripts/run-manifest.ts merge  --pr <number> --repo <name> --sha <sha> [--kind real|wall-exception]
//   bun scripts/run-manifest.ts skip   --step <NAME> --reason <text>
//   bun scripts/run-manifest.ts repair --file <path> --reason <text>
//   bun scripts/run-manifest.ts review --project <name> --tier <baseline-only|scoped|full> --outcome <pass|fail> [--basis <head>]
//   bun scripts/run-manifest.ts verify [--require-merged]
//
// Exit codes: 0 ok · 1 usage/IO · 2 schema verify failed · 3 no merges recorded while --require-merged
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const STATE_DIR = ".pipeline-state";
const REQUIRED_ARRAYS = [
  "mergedPRs",
  "sanctionedRepairs",
  "billingWallEvidence",
  "skippedBudget",
  "steps",
  "projectReviews",
] as const;

type Manifest = Record<string, unknown> & {
  run: string;
  started: string;
  prerunHeads: Record<string, unknown>;
  mergedPRs: unknown[];
  sanctionedRepairs: unknown[];
  billingWallEvidence: unknown[];
  skippedBudget: unknown[];
  steps: unknown[];
  projectReviews: unknown[];
};

function die(msg: string, code = 1): never {
  console.error(`✗ run-manifest: ${msg}`);
  process.exit(code);
}

function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseArgs(argv: string[]): { cmd: string; flags: Record<string, string[]> } {
  const [cmd, ...rest] = argv;
  const flags: Record<string, string[]> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) die(`unexpected argument '${a}'`);
    const key = a.slice(2);
    const val = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : "true";
    if (!flags[key]) flags[key] = [];
    flags[key].push(val);
  }
  return { cmd: cmd ?? "", flags };
}

function one(flags: Record<string, string[]>, k: string): string | undefined {
  return flags[k]?.[0];
}

function manifestPath(flags: Record<string, string[]>): string {
  const date = one(flags, "date") ?? todayLocal();
  return join(STATE_DIR, `run-manifest-${date}.json`);
}

function readManifest(p: string): Manifest {
  if (!existsSync(p)) die(`no manifest at ${p} — run 'init' first`);
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Manifest;
  } catch (e) {
    die(`manifest unparsable: ${(e as Error).message}`, 2);
  }
}

/** Atomic write: temp + rename, so a killed run cannot leave a half-written ledger. */
function writeManifest(p: string, m: Manifest): void {
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(m, null, 1)}\n`);
  renameSync(tmp, p);
}

function gitHead(repo: string): string {
  try {
    return execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const { cmd, flags } = parseArgs(process.argv.slice(2));
const path = manifestPath(flags);

switch (cmd) {
  case "init": {
    const run = one(flags, "run");
    if (!run) die("init requires --run <id>");
    mkdirSync(STATE_DIR, { recursive: true });
    const repos = flags.repo ?? ["."];
    const prerunHeads: Record<string, unknown> = {};
    for (const r of repos) {
      let branch = "?";
      try {
        branch = execFileSync("git", ["-C", r, "branch", "--show-current"], { encoding: "utf8" }).trim();
      } catch {
        /* non-repo path — recorded as unknown, not fatal */
      }
      prerunHeads[r] = { branch, head: gitHead(r) };
    }
    const m: Manifest = {
      run,
      started: new Date().toISOString(),
      prerunHeads,
      mergedPRs: [],
      sanctionedRepairs: [],
      billingWallEvidence: [],
      skippedBudget: [],
      steps: [],
      projectReviews: [],
    };
    if (existsSync(path)) die(`manifest already exists at ${path} — refusing to overwrite a live ledger`);
    writeManifest(path, m);
    console.log(`✓ manifest initialized: ${path} (${repos.length} repo(s))`);
    break;
  }

  case "step": {
    const m = readManifest(path);
    const step = one(flags, "step");
    const status = one(flags, "status");
    if (!step || !status) die("step requires --step <NAME> --status <begin|complete|failed|skipped-budget>");
    if (!["begin", "complete", "failed", "skipped-budget"].includes(status)) die(`bad status '${status}'`);
    m.steps.push({ step, status, at: new Date().toISOString(), reason: one(flags, "reason") ?? null });
    writeManifest(path, m);
    console.log(`✓ step ${step} → ${status}`);
    break;
  }

  case "merge": {
    const m = readManifest(path);
    const pr = one(flags, "pr");
    const repo = one(flags, "repo");
    const sha = one(flags, "sha");
    if (!pr || !repo || !sha) die("merge requires --pr <n> --repo <name> --sha <sha>");
    if (!/^[0-9a-f]{7,40}$/.test(sha)) die(`sha '${sha}' is not a git sha`);
    const kind = one(flags, "kind") ?? "real";
    if (!["real", "wall-exception"].includes(kind)) die(`bad --kind '${kind}'`);
    if (m.mergedPRs.some((x) => (x as { pr: string }).pr === pr && (x as { repo: string }).repo === repo)) {
      console.log(`= merge ${repo}#${pr} already recorded`);
      break;
    }
    m.mergedPRs.push({ pr, repo, sha, kind, at: new Date().toISOString(), order: m.mergedPRs.length + 1 });
    if (kind === "wall-exception") {
      m.billingWallEvidence.push({ pr, repo, at: new Date().toISOString(), evidence: one(flags, "evidence") ?? null });
    }
    writeManifest(path, m);
    console.log(`✓ merge recorded: ${repo}#${pr} @ ${sha.slice(0, 10)} (${kind}, order ${m.mergedPRs.length})`);
    break;
  }

  case "skip": {
    const m = readManifest(path);
    const step = one(flags, "step");
    const reason = one(flags, "reason");
    if (!step || !reason) die("skip requires --step <NAME> --reason <text>");
    m.skippedBudget.push({ step, reason, at: new Date().toISOString() });
    writeManifest(path, m);
    console.log(`✓ skip recorded: ${step} — ${reason}`);
    break;
  }

  case "repair": {
    const m = readManifest(path);
    const file = one(flags, "file");
    const reason = one(flags, "reason");
    if (!file || !reason) die("repair requires --file <path> --reason <text>");
    m.sanctionedRepairs.push({ file, reason, at: new Date().toISOString() });
    writeManifest(path, m);
    console.log(`✓ sanctioned repair recorded: ${file}`);
    break;
  }

  case "review": {
    const m = readManifest(path);
    const project = one(flags, "project");
    const tier = one(flags, "tier");
    const outcome = one(flags, "outcome");
    if (!project || !tier || !outcome) die("review requires --project <name> --tier <tier> --outcome <pass|fail>");
    if (!["baseline-only", "scoped", "full"].includes(tier)) die(`bad --tier '${tier}'`);
    if (!["pass", "fail"].includes(outcome)) die(`bad --outcome '${outcome}'`);
    m.projectReviews.push({
      project,
      tier,
      outcome,
      basis: one(flags, "basis") ?? null,
      at: new Date().toISOString(),
    });
    writeManifest(path, m);
    console.log(`✓ review recorded: ${project} (${tier}, ${outcome})`);
    break;
  }

  case "verify": {
    const m = readManifest(path);
    const problems: string[] = [];
    for (const key of REQUIRED_ARRAYS) {
      if (!Array.isArray(m[key])) problems.push(`missing required array '${key}'`);
    }
    if (typeof m.run !== "string" || !m.run) problems.push("missing 'run'");
    if (typeof m.started !== "string" || !m.started) problems.push("missing 'started'");
    if (!m.prerunHeads || typeof m.prerunHeads !== "object") problems.push("missing 'prerunHeads'");
    if (problems.length > 0) {
      console.error(`✗ manifest schema verify FAILED (${path})`);
      for (const p of problems) console.error(`   - ${p}`);
      process.exit(2);
    }
    if (flags["require-merged"] && m.mergedPRs.length === 0) {
      console.error(`✗ manifest has zero mergedPRs rows while --require-merged was passed (${path})`);
      process.exit(3);
    }
    console.log(
      `✓ manifest verify passed: ${m.mergedPRs.length} merge(s), ${m.skippedBudget.length} skip(s), ` +
        `${m.sanctionedRepairs.length} repair(s), ${m.projectReviews.length} review(s)`,
    );
    break;
  }

  default:
    die(`unknown command '${cmd}' (init|step|merge|skip|repair|review|verify)`);
}
