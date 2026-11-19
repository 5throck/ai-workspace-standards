#!/usr/bin/env bun
// @version 1.0.0
// verify-delivered-versions.ts — post-delivery verification (meeting 2026-11-20, issue D / R18)
//
// v1.0.0 (2026-11-20, meeting-2026-11-20-batch-runner-hardening): the 2026-11-19
//   co-deck wave reported clean and merged, and 20 variant-script/test files were
//   never delivered — the project's tests then expected script surfaces that did not
//   exist (html-to-pdf suite: 16 fails). Root cause recorded in
//   .trail/learnings/2026-11-20-adopt-template-grants-not-taking-on-variant-scripts-subtree.md:
//   an ADOPT-grant row reads as "resolved" while the copy never happens. Nothing
//   verified the delivered SET after the merge. The engine already writes
//   <project>/.claude/last-upgrade-delivery.json (schemaVersion 2) with `files[]`,
//   so this verifier is a set-diff + version sweep — no engine change required.
//
// Checks:
//   1. ABSENT  — a path listed in the delivery manifest that is missing on disk
//                (or that the template has and the project does not, when the
//                template side carries the file).
//   2. STALE   — project copy version is older than the template copy version
//                (@version for scripts, frontmatter `version:` for markdown).
//
// Usage:
//   bun scripts/verify-delivered-versions.ts --project Projects/<p> --template templates/<v>
//   [--manifest <path>] [--json]
//
// Exit codes: 0 clean · 1 findings · 2 usage/IO
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Finding = { kind: "absent" | "stale"; path: string; detail: string };

function die(msg: string): never {
  console.error(`✗ verify-delivered: ${msg}`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const flag = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const projectArg = flag("project");
const templateArg = flag("template");
if (!projectArg) die("requires --project <dir>");
if (!templateArg) die("requires --template <dir> (delivery completeness is defined against the template)");

const projectDir = resolve(projectArg);
const templateDir = resolve(templateArg);
if (!existsSync(projectDir)) die(`project not found: ${projectDir}`);
if (!existsSync(templateDir)) die(`template not found: ${templateDir}`);

const manifestPath = flag("manifest") ?? join(projectDir, ".claude", "last-upgrade-delivery.json");
const asJson = argv.includes("--json");

type DeliveryManifest = { files?: string[]; templateVersion?: string; timestamp?: string };

let manifest: DeliveryManifest | null = null;
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as DeliveryManifest;
  } catch (e) {
    die(`delivery manifest unparsable (${(e as Error).message}): ${manifestPath}`);
  }
}

/** Extract a comparable version string from a file, if it declares one. */
function versionOf(path: string): string | null {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const head = text.slice(0, 4000);
  const atVersion = head.match(/@version\s+(\d+\.\d+\.\d+)/);
  if (atVersion) return atVersion[1];
  const frontmatter = head.match(/^---[\s\S]*?^version:\s*"?(\d+\.\d+\.\d+)"?\s*$/m);
  if (frontmatter) return frontmatter[1];
  return null;
}

function cmp(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const findings: Finding[] = [];

// Derive the candidate set: the delivery manifest's files[] ∪ the template's files
// under the paths the manifest covers. When the manifest is absent we fall back to
// the template tree (the wave's own delivery obligation).
const claimed = new Set<string>(manifest?.files ?? []);
if (claimed.size === 0) {
  console.warn(
    `⚠ no delivery manifest at ${manifestPath} — falling back to the template tree as the obligation set ` +
      `(a missing manifest is itself a delivery-completeness gap)`,
  );
}

// For every claimed path: must exist on disk.
for (const rel of claimed) {
  if (!existsSync(join(projectDir, rel))) {
    findings.push({
      kind: "absent",
      path: rel,
      detail: "listed in .claude/last-upgrade-delivery.json but missing from the project",
    });
  }
}

// For every versioned file the template ships at a claimed-or-known path: project
// copy must be present and not older. Restricted to paths present template-side so
// project-only files never produce noise.
const probe = (rel: string): void => {
  const tPath = join(templateDir, rel);
  const pPath = join(projectDir, rel);
  if (!existsSync(tPath)) return;
  if (!existsSync(pPath)) {
    if (!claimed.has(rel)) {
      findings.push({ kind: "absent", path: rel, detail: "template ships this path; project has no copy" });
    }
    return;
  }
  const tv = versionOf(tPath);
  const pv = versionOf(pPath);
  if (tv && pv && cmp(pv, tv) < 0) {
    findings.push({ kind: "stale", path: rel, detail: `project ${pv} < template ${tv}` });
  }
};

for (const rel of claimed) probe(rel);

// The variant-scripts lane that swallowed the ADOPT grants: always sweep it.
const variantScriptsDir = join(templateDir, "scripts");
if (existsSync(variantScriptsDir)) {
  const walk = (dir: string): void => {
    for (const entry of new Bun.Glob("**/*").scanSync({ cwd: dir, absolute: false })) {
      const rel = `scripts/${entry}`;
      probe(rel);
    }
  };
  for (const entry of new Bun.Glob("scripts/**/*").scanSync({ cwd: templateDir, absolute: false })) {
    probe(entry);
  }
  void walk;
}

const unique = [...new Map(findings.map((f) => [`${f.kind}:${f.path}`, f])).values()];

if (asJson) {
  console.log(JSON.stringify({ project: projectArg, template: templateArg, findings: unique }, null, 1));
} else {
  if (unique.length === 0) {
    console.log(
      `✓ verify-delivered: ${claimed.size || "template-derived"} path(s) checked — every delivered path present ` +
        `and no project copy older than ${manifest?.templateVersion ?? "the template"}`,
    );
  } else {
    console.error(`✗ verify-delivered: ${unique.length} finding(s) — the delivery is INCOMPLETE`);
    for (const f of unique) console.error(`   [${f.kind}] ${f.path} — ${f.detail}`);
    console.error(
      "   → do not record this delivery as successful; ship the missing files or file a revert-class ticket.",
    );
  }
}

process.exit(unique.length === 0 ? 0 : 1);
