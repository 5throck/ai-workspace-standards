#!/usr/bin/env bun
// @version 1.2.0
// verify-delivered-versions.ts — post-delivery verification (meeting 2026-11-20, issue D / R18)
//
// v1.1.0 (2026-11-25, T-20261124-011 — design
//          docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md §4.4):
//          the verifier names engine-preserved conflicts and detects overwrites.
//          (1) SWEEP — the candidate set is the manifest `files[]` ∪ the keys of
//          `baselines` (the set the engine has delivered, so common scripts and
//          agents are included) ∪ every `pendingBackport[].path` ∪ the template's
//          `scripts/**`. (2) LABEL — a path whose `pendingBackport[]` entry has
//          kind CONFLICT, or whose `decisions[]` entry has verdict CONFLICT, is
//          reported as kind `conflict` ("engine-preserved: adjudicate; never copy
//          the template file over it") instead of a plain `stale` row. (3) OVERWRITE
//          DETECTION — for such a path, when the project copy's baseline key
//          differs from `pendingBackport[].projectHash`, the finding is kind
//          `conflict-overwritten` (the 2026-11-24 incident as a mechanical check).
//          The key is `baselineKeyFor` (upgrade-policy.ts v1.49.0): raw SHA-256 of
//          the bytes for plain files, SHA-256 of the lifecycle-stripped text for
//          `agents/**` — the hash the engine records, so a preserved agent copy
//          compares equal. Exit codes unchanged: 0 clean · 1 findings · 2 usage/IO.
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
//   1. ABSENT               — a path listed in the delivery manifest that is missing
//                             on disk (or that the template has and the project
//                             does not, when the template side carries the file).
//   2. STALE                — project copy version is older than the template copy
//                             version (@version for scripts, frontmatter `version:`
//                             for markdown). Not emitted for a conflict path.
//   3. CONFLICT             — engine-preserved path: adjudicate, never overwrite.
//   4. CONFLICT-OVERWRITTEN — a preserved path whose project copy no longer hashes
//                             to the recorded `projectHash`.
//
// Usage:
//   bun scripts/verify-delivered-versions.ts --project Projects/<p> --template templates/<v>
//   [--manifest <path>] [--json]
//
// Exit codes: 0 clean · 1 findings · 2 usage/IO
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { baselineKeyFor, toPosixPath } from "./lib/upgrade-policy.ts";

export type FindingKind = "absent" | "stale" | "conflict" | "conflict-overwritten";
export type Finding = { kind: FindingKind; path: string; detail: string };

/** Input of the pure verification (design §4.4); paths are absolute directories. */
export type VerifyInput = {
  projectDir: string;
  templateDir: string;
  /** Parsed delivery manifest, or null when the project has none. */
  manifest: DeliveryManifest | null;
};

type PendingBackport = { path: string; kind: string; projectHash?: string };
type Decision = { path: string; verdict?: string };

export type DeliveryManifest = {
  files?: string[];
  templateVersion?: string;
  timestamp?: string;
  baselines?: Record<string, unknown>;
  decisions?: Decision[];
  pendingBackport?: PendingBackport[];
};

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

/** Run the verification and return its findings (deduplicated per kind+path). */
export function verifyDeliveredVersions(input: VerifyInput): Finding[] {
  const { projectDir, templateDir, manifest } = input;
  const findings: Finding[] = [];

  // Derive the candidate set: the delivery manifest's files[] ∪ baselines keys ∪
  // pendingBackport paths ∪ the template's files under `scripts/**`. When the
  // manifest is absent we fall back to the template tree (the wave's own
  // delivery obligation).
  const claimed = new Set<string>(manifest?.files ?? []);
  const candidates = new Set<string>(claimed);
  for (const rel of Object.keys(manifest?.baselines ?? {})) candidates.add(rel);
  for (const entry of manifest?.pendingBackport ?? []) candidates.add(entry.path);
  // A decisions[] CONFLICT row names a preserved path too (normally it also has a
  // pendingBackport entry; a manifest with only the decision row is still swept).
  for (const entry of manifest?.decisions ?? []) {
    if (entry.verdict === "CONFLICT") candidates.add(entry.path);
  }
  for (const entry of new Bun.Glob("scripts/**/*").scanSync({ cwd: templateDir, absolute: false })) {
    // Bun.Glob yields `\`-separated paths on Windows; manifest paths are POSIX-style.
    candidates.add(toPosixPath(entry));
  }

  // Engine-preserved paths: pendingBackport kind CONFLICT, or a decisions[] entry
  // with verdict CONFLICT.
  const preserved = new Map<string, PendingBackport | undefined>();
  for (const entry of manifest?.pendingBackport ?? []) {
    if (entry.kind === "CONFLICT" && !preserved.has(entry.path)) preserved.set(entry.path, entry);
  }
  for (const entry of manifest?.decisions ?? []) {
    if (entry.verdict === "CONFLICT" && !preserved.has(entry.path)) preserved.set(entry.path, undefined);
  }

  for (const rel of candidates) {
    const tPath = join(templateDir, rel);
    const pPath = join(projectDir, rel);
    const onDisk = existsSync(pPath);

    if (!onDisk && claimed.has(rel)) {
      findings.push({
        kind: "absent",
        path: rel,
        detail: "listed in .claude/last-upgrade-delivery.json but missing from the project",
      });
    }
    if (!onDisk && !claimed.has(rel) && existsSync(tPath)) {
      findings.push({ kind: "absent", path: rel, detail: "template ships this path; project has no copy" });
    }

    const preservedEntry = preserved.get(rel);
    if (preservedEntry !== undefined || preserved.has(rel)) {
      if (onDisk && preservedEntry?.projectHash) {
        const key = baselineKeyFor(rel, readFileSync(pPath, "utf8"));
        if (key !== preservedEntry.projectHash) {
          findings.push({
            kind: "conflict-overwritten",
            path: rel,
            detail:
              "engine-preserved CONFLICT path no longer hashes to the recorded projectHash — the project copy was overwritten; file a revert-class ticket",
          });
          continue;
        }
      }
      findings.push({
        kind: "conflict",
        path: rel,
        detail: "engine-preserved: adjudicate; never copy the template file over it",
      });
      continue;
    }

    // Version sweep — restricted to paths present template-side so project-only
    // files never produce noise.
    if (!existsSync(tPath) || !onDisk) continue;
    const tv = versionOf(tPath);
    const pv = versionOf(pPath);
    if (tv && pv && cmp(pv, tv) < 0) {
      findings.push({ kind: "stale", path: rel, detail: `project ${pv} < template ${tv}` });
    }
  }

  return [...new Map(findings.map((f) => [`${f.kind}:${f.path}`, f])).values()];
}

export function loadManifest(manifestPath: string): DeliveryManifest | null {
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")) as DeliveryManifest;
  } catch (e) {
    console.error(`✗ verify-delivered: delivery manifest unparsable (${(e as Error).message}): ${manifestPath}`);
    process.exit(2);
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flag = (k: string): string | undefined => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const die: (msg: string) => never = (msg) => {
    console.error(`✗ verify-delivered: ${msg}`);
    process.exit(2);
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
  const manifest = loadManifest(manifestPath);
  const claimed = new Set(manifest?.files ?? []);
  if (claimed.size === 0) {
    console.warn(
      `⚠ no delivery manifest at ${manifestPath} — falling back to the template tree as the obligation set ` +
        `(a missing manifest is itself a delivery-completeness gap)`,
    );
  }

  const unique = verifyDeliveredVersions({ projectDir, templateDir, manifest });
  const preservedCount = unique.filter((f) => f.kind === "conflict" || f.kind === "conflict-overwritten").length;

  if (asJson) {
    console.log(JSON.stringify({ project: projectArg, template: templateArg, findings: unique }, null, 1));
  } else if (unique.length === 0) {
    console.log(
      `✓ verify-delivered: ${claimed.size || "template-derived"} path(s) checked — every delivered path present, ` +
        `${preservedCount} conflict-preserved path(s), and no project copy older than ${manifest?.templateVersion ?? "the template"}`,
    );
  } else {
    console.error(`✗ verify-delivered: ${unique.length} finding(s) — the delivery is INCOMPLETE`);
    for (const f of unique) console.error(`   [${f.kind}] ${f.path} — ${f.detail}`);
    console.error(
      "   → do not record this delivery as successful; ship the missing files or file a revert-class ticket.",
    );
  }

  process.exit(unique.length === 0 ? 0 : 1);
}
