#!/usr/bin/env bun
// @version 1.2.0
// list-template-versions.ts - List available template versions

import { $ } from "bun";
import * as path from "node:path";

/**
 * Template-version-aware tag comparator (issue #2192 blocker 6): parses the
 * `template-vX.Y.Z` shape and compares the numeric components, so v0.30.0
 * sorts after v0.9.0 (the lexical `.sort()` reported v0.9.0 as latest and
 * printed a false VERSION-mismatch warning). Tags that do not match the
 * shape sort last, stably — Array.prototype.sort is stable, so equal
 * comparators (two unknowns, or identical versions) keep input order.
 */
export function compareTemplateTags(a: string, b: string): number {
  const parse = (tag: string): [number, number, number] | null => {
    const m = /^template-v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa && pb) {
    for (let i = 0; i < 3; i++) {
      if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
  }
  if (pa && !pb) return -1; // known shape before unknown shape
  if (!pa && pb) return 1;
  return 0; // two unknown shapes — stability keeps input order
}

if (import.meta.main) {
  const CYAN = "\x1b[36m";
  const GREEN = "\x1b[32m";
  const YELLOW = "\x1b[33m";
  const RED = "\x1b[31m";
  const DARKGRAY = "\x1b[90m";
  const RESET = "\x1b[0m";

  const scriptDir = import.meta.dir;
  const workspaceRoot = path.resolve(scriptDir, "..");

  console.log(`${CYAN}Available template versions:${RESET}`);
  console.log("");

  const tagsResult = await $`git -C ${workspaceRoot} tag -l ${"template-v*"}`.quiet().nothrow();
  const tagsRaw = tagsResult.stdout.toString().trim();

  const tags = tagsRaw ? tagsRaw.split("\n").filter(Boolean).sort(compareTemplateTags) : [];

  if (tags.length === 0) {
    console.log(`${DARKGRAY}  (no tagged versions found)${RESET}`);
    console.log("");
    console.log(`${DARKGRAY}  Current (untagged) version:${RESET}`);
    const versionFile = path.join(workspaceRoot, "templates", "VERSION");
    const vf = Bun.file(versionFile);
    if (await vf.exists()) {
      const v = (await vf.text()).trim();
      console.log(`${GREEN}  → ${v} (latest, untagged)${RESET}`);
    }
  } else {
    for (const tag of tags) {
      const version = tag.replace(/^template-v/, "");
      console.log(`${GREEN}  → ${version}  (${tag})${RESET}`);
    }
  }

  // Version mismatch check
  const versionFile = path.join(workspaceRoot, "templates", "VERSION");
  const vf = Bun.file(versionFile);
  if (await vf.exists()) {
    const workspaceVersion = (await vf.text()).trim();
    if (tags.length === 0) {
      // Already printed the untagged version above — no tag to compare against
    } else {
      const latestTag = tags[tags.length - 1];
      const latestTagVersion = latestTag.replace(/^template-v/, "");
      console.log("");
      if (workspaceVersion !== latestTagVersion) {
        console.log(`${YELLOW}⚠  VERSION mismatch detected:${RESET}`);
        console.log(`${YELLOW}   templates/VERSION = ${workspaceVersion}  (workspace)${RESET}`);
        console.log(`${YELLOW}   Latest tag        = ${latestTagVersion}  (${latestTag})${RESET}`);
        console.log(`${YELLOW}   Run: bun scripts/tag-template.ts to publish a new tag${RESET}`);
      } else {
        console.log(`${DARKGRAY}✓ templates/VERSION matches latest tag (${workspaceVersion})${RESET}`);
      }
    }
  }

  console.log("");
  if (process.platform === "win32") {
    console.log(`${DARKGRAY}Usage: .\\scripts\\new-project.ps1 my-project -Version X.Y.Z${RESET}`);
    console.log(`${DARKGRAY}       (omit -Version to use the latest template)${RESET}`);
  } else {
    console.log(`${DARKGRAY}Usage: bash scripts/new-project.sh my-project --version X.Y.Z${RESET}`);
    console.log(`${DARKGRAY}       (omit --version to use the latest template)${RESET}`);
  }
}
