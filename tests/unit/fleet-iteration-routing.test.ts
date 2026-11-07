/**
 * Structural routing guard for the fleet membership SSOT (design
 * docs/designs/2026-11-07-fleet-membership-ssot-design.md §5/§9.3,
 * DEC-20261107-01) — two layers so both drift directions fail CI:
 *
 * 1. PINNED CONSUMERS route through the helper: each fleet-iteration site
 *    (design §3.1 A1–A8) imports scripts/lib/fleet.ts.
 * 2. NEW ENUMERATORS CANNOT SNEAK IN: every .ts file under scripts/ that both
 *    (a) calls readdirSync and (b) references a 'Projects' path literal must
 *    be either a pinned A-site, the helper itself (scripts/lib/fleet.ts), or
 *    an explicitly allowlisted C-class site — AND no file outside
 *    scripts/lib/fleet.ts may carry a `startsWith('co-')` prefix filter
 *    within a Projects-readdir source window. An unregistered hit fails with
 *    "classify this Projects/ enumerator — fleet iteration or not?".
 *
 * Source-level pins over brittle behavioral mocks — the same structural-guard
 * style as the workspace's existing suites. The scripts' own suites continue
 * to cover their per-project behavior.
 */

import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '..', '..');
const SCRIPTS_DIR = join(REPO_ROOT, 'scripts');

/** Design §3.1 A1–A8 — the fleet-iteration sites, pinned by path. */
const PINNED_FLEET_ITERATION_FILES = [
  'scripts/resync-audit.ts', // A1
  'scripts/backport-diff.ts', // A2
  'scripts/evidence-backport-scan.ts', // A3
  'scripts/skill-graph-fleet-report.ts', // A4
  'scripts/fleet-script-parity.ts', // A5
  'scripts/audit.ts', // A6 (checkProjectDocMarkerDrift)
  'scripts/validate-templates.ts', // A7 (country-config, variant.json gate kept) + A8 (identity placeholders)
];

/**
 * C-class sites (design §3.3) plus single-project B-class tools whose
 * `Projects` literal is a destination/join, not a fleet enumeration.
 * Each entry carries its design citation as the justifying comment.
 */
const ENUMERATOR_ALLOWLIST: Record<string, string> = {
  // C1: hub roster comes from hub_topology registry; PROJECTS_DIR resolves Projects/<hub>
  'scripts/hub-probe.ts': 'C1: hub roster from hub_topology, not a glob (design §3.3 C1)',
  // C2: bootstrap destination + stale .bootstrap-* temp-dir sweep — not membership
  'scripts/hub-bootstrap.ts': 'C2: bootstrap destination/temp hygiene (design §3.3 C2)',
  // C3: comments only; its readdirSync enumerates templates/ (L2)
  'scripts/dev-sync.ts': 'C3: comments only; readdirSync is templates/ L2 (design §3.3 C3/C8)',
  // C4: comments only (references audit.ts Projects guard)
  'scripts/lifecycle-sync-audit.ts': 'C4: comments only (design §3.3 C4)',
  // C6: ENCODING_SKIP_DIRS contains 'Projects' — exclusion from an encoding sweep
  'scripts/propagate-to-templates.ts': 'C6: ENCODING_SKIP_DIRS entry, not membership (design §3.3 C6)',
  // C10: E2E fixture destination path
  'scripts/test-l3-to-variant-promotion.ts': 'C10: E2E fixture path (design §3.3 C10)',
  // B1: projectsRoot join for the outside-Projects guard; variant readdir is templates/ (C8)
  'scripts/upgrade-project.ts': 'B1 target guard join; variant discovery is templates/ L2 (design §3.2 B1, §3.3 C8)',
  // B2: projectsRoot join for the outside-Projects guard; variant readdir is templates/ (C8)
  'scripts/adopt-project.ts': 'B2 target guard join; variant discovery is templates/ L2 (design §3.2 B2, §3.3 C8)',
  // B3: scaffold destination join (design §3.2 B3)
  'scripts/new-project.ts': 'B3 scaffold destination join (design §3.2 B3)',
  // B4: scaffold destination join (design §3.2 B4)
  'scripts/create-l3-scaffold.ts': 'B4 scaffold destination join (design §3.2 B4)',
  // B8: identity gate — deliberately NOT coupled to membership (design §3.2 B8/§6.2.6)
  'scripts/mcp-upstream-server.ts': 'B8 upstream identity gate, membership-orthogonal (design §6.2 item 6)',
  // C6-genus: lint/scan skip-dir entry
  'scripts/helpers/local-patch-scan.ts': 'skip-dir entry in a scan exclusion set (C6-genus, design §3.3 C6)',
};

/** Files where the Projects literal + readdirSync pair is expected. */
const HELPER_FILE = 'scripts/lib/fleet.ts';

function listScriptFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...listScriptFiles(full));
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function relScript(path: string): string {
  return path.slice(REPO_ROOT.length + 1);
}

/**
 * True when the file's source contains a `startsWith('co-')` filter whose
 * preceding source window (8 lines) both calls readdirSync and references a
 * 'Projects' literal — i.e. a co- prefix filter applied to a Projects/
 * directory enumeration.
 */
function coFilterNearProjectsReaddir(source: string): string | null {
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/startsWith\(\s*['"]co-['"]\s*\)/.test(lines[i])) continue;
    const from = Math.max(0, i - 8);
    const window = lines.slice(from, i + 1).join('\n');
    if (/readdirSync/.test(window) && /['"]Projects['"]/.test(window)) {
      return `line ${i + 1}: startsWith('co-') filter within a Projects/ readdir window`;
    }
  }
  return null;
}

describe('layer 1 — pinned fleet-iteration consumers route through lib/fleet.ts', () => {
  test('each A1–A8 site imports scripts/lib/fleet.ts', () => {
    for (const rel of PINNED_FLEET_ITERATION_FILES) {
      const source = readFileSync(join(REPO_ROOT, rel), 'utf-8');
      expect(source).toMatch(/from\s+['"](\.\.?\/)+lib\/fleet\.ts['"]/);
    }
  });

  test('no pinned site (nor ANY script outside the helper) carries a co- prefix filter on a Projects/ readdir', () => {
    const offenders: string[] = [];
    for (const abs of listScriptFiles(SCRIPTS_DIR)) {
      const rel = relScript(abs);
      if (rel === HELPER_FILE) continue; // the literal-prefix pattern lives ONLY here
      const source = readFileSync(abs, 'utf-8');
      const hit = coFilterNearProjectsReaddir(source);
      if (hit) offenders.push(`${rel}: ${hit}`);
    }
    expect(offenders).toEqual([]);
  });

  test('the helper itself is the only file allowed to derive membership by the co- prefix', () => {
    const helper = readFileSync(join(REPO_ROOT, HELPER_FILE), 'utf-8');
    expect(helper).toMatch(/startsWith\(['"]co-['"]\)/);
  });

  test('DELIVERY DEVIATION PIN (DEC-20261107-01 condition 7): the helper mirror is delivered L0+L1 byte-identical, the registry is NOT', () => {
    // Design §11 wanted the fleet helper strictly L0-only, but three of its
    // A-sites (A3/A6/A8) live in L0+L1-delivered scripts, so the IC-01
    // import-closure gate forces the leaf pure-module helper into the
    // delivered closure (ADR-0073 Amendment 4 fix policy). The OPERATIVE §11
    // rule is preserved and pinned here: the registry docs/fleet-membership.json
    // must NEVER appear under templates/ — a delivered helper copy reads the
    // PROJECT's own registry (absent → zero exclusions → historical behavior),
    // so no workspace membership state ever reaches L1/L2.
    const l1Helper = join(REPO_ROOT, 'templates', 'common', 'scripts', 'lib', 'fleet.ts');
    expect(existsSync(l1Helper)).toBe(true);
    expect(readFileSync(l1Helper, 'utf-8')).toBe(readFileSync(join(REPO_ROOT, HELPER_FILE), 'utf-8'));
    expect(existsSync(join(REPO_ROOT, 'templates', 'common', 'docs', 'fleet-membership.json'))).toBe(false);
    expect(existsSync(join(REPO_ROOT, 'templates', 'common', 'fleet-membership.json'))).toBe(false);
    // fleet-list.ts (the runner CLI) stays strictly L0 — no delivered copy.
    expect(existsSync(join(REPO_ROOT, 'templates', 'common', 'scripts', 'fleet-list.ts'))).toBe(false);
  });
});

describe('layer 2 — every Projects/ enumerator is registered', () => {
  test('every scripts .ts file pairing readdirSync with a Projects literal is pinned, the helper, or allowlisted', () => {
    const unregistered: string[] = [];
    for (const abs of listScriptFiles(SCRIPTS_DIR)) {
      const rel = relScript(abs);
      if (rel === HELPER_FILE) continue;
      const source = readFileSync(abs, 'utf-8');
      const enumerates = /readdirSync/.test(source);
      const mentionsProjects = /['"]Projects['"]/.test(source);
      if (!(enumerates && mentionsProjects)) continue;
      if (PINNED_FLEET_ITERATION_FILES.includes(rel)) continue;
      if (ENUMERATOR_ALLOWLIST[rel]) continue;
      unregistered.push(rel);
    }
    if (unregistered.length > 0) {
      throw new Error(
        'classify this Projects/ enumerator — fleet iteration or not? (design 2026-11-07-fleet-membership-ssot-design §3):\n'
        + unregistered.map((f) => `  - ${f}`).join('\n'),
      );
    }
    expect(unregistered).toEqual([]);
  });

  test('allowlist entries actually exist on disk (the guard self-heals when sites are removed)', () => {
    for (const rel of Object.keys(ENUMERATOR_ALLOWLIST)) {
      expect(statSync(join(REPO_ROOT, rel)).isFile()).toBe(true);
    }
  });
});
