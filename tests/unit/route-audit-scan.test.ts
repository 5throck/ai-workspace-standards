/**
 * Tests for route-audit-scan.ts — the fleet-general write-route audit tripwire
 * (T-20261029-005; generalized from co-newbiz PR #742 FR-SEC-07, spec
 * docs/designs/2026-10-29-route-audit-scan-fleet-design.md).
 *
 * Coverage (design §6 unit-test list):
 * - POST route reaching an audit token in its local import graph → PASS;
 * - POST route not reaching one → FAIL naming file:line;
 * - GET-only route files ignored (not write routes);
 * - depth-3 import-graph walk semantics (token at each level; 4th hop not followed);
 * - allowlist entry with a valid reason honored; wildcard rejected;
 *   stale (non-write-route) path rejected; too-short reason rejected;
 * - no-API-surface → SKIP (exit-0 contribution, skipReason names the looked-for roots);
 * - schema routeAudit block: custom token patterns honored, malformed block is a
 *   hard RouteAuditConfigError (never silent fallback);
 * - declaration guard: `function audit(` never counts, call sites do;
 * - lockstep pin: workspace-schema routeAudit.auditTokenPatterns === the
 *   script's documented co-newbiz defaults;
 * - CLI: exit 1 + file:line on stdout for an offender, exit 0 on SKIP.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  importBasename,
  MAX_DEPTH,
  DEFAULT_AUDIT_TOKEN_PATTERNS,
  RouteAuditConfigError,
  compileAuditTokenPatterns,
  defaultRouteAuditConfig,
  discoverRouteFiles,
  firstWriteLine,
  hasAuditToken,
  isDefinitionMatch,
  loadRouteAuditConfig,
  scanRouteAudit,
  writeMethods,
  type RouteAuditConfig,
} from '../../scripts/route-audit-scan.ts';

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..');
const SCRATCH = path.resolve(import.meta.dir, '..', '.temp', 'route-audit-scan-test');
const SCRIPT_SRC = path.join(REPO_ROOT, 'scripts', 'route-audit-scan.ts');

/** Write a file under the scratch project. */
function put(rel: string, content: string): string {
  const p = path.join(SCRATCH, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

/** Config with the default (co-newbiz) token patterns and the given allowlist/sharedInfra. */
function cfg(over: Partial<Omit<RouteAuditConfig, 'source'>> = {}): RouteAuditConfig {
  const d = defaultRouteAuditConfig();
  return { auditTokenPatterns: over.auditTokenPatterns ?? d.auditTokenPatterns, allowlist: over.allowlist ?? {}, sharedInfra: over.sharedInfra ?? [], source: 'defaults' };
}

beforeEach(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));
afterEach(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));

// ---------------------------------------------------------------------------
// Detection primitives
// ---------------------------------------------------------------------------

describe('writeMethods / firstWriteLine', () => {
  test('both function and const export forms detected; line anchored at the export', () => {
    const src = [
      'import { db } from "./db";',
      '',
      'export async function POST(req: Request) {',
      '  return db.insert(audit);',
      '}',
      '',
      'export const DELETE = async () => {',
      '  return new Response(null, { status: 204 });',
      '};',
    ].join('\n');
    expect(writeMethods(src)).toEqual(['POST', 'DELETE']);
    expect(firstWriteLine(src)).toBe(3);
  });

  test('GET-only file yields no write methods (ignored downstream)', () => {
    const src = 'export async function GET() { return Response.json({ ok: true }); }\n';
    expect(writeMethods(src)).toEqual([]);
  });
});

describe('hasAuditToken / isDefinitionMatch (declaration guard)', () => {
  const tokens = compileAuditTokenPatterns(DEFAULT_AUDIT_TOKEN_PATTERNS);

  test('call site counts: await appendAudit(', () => {
    expect(hasAuditToken('await appendAudit("x", ev);', tokens)).toBe(true);
  });
  test('declaration never counts: export function appendAudit(', () => {
    expect(hasAuditToken('export function appendAudit(entry: Audit) {', tokens)).toBe(false);
    expect(isDefinitionMatch('export function appendAudit(entry: Audit) {', 'export function '.length)).toBe(true);
  });
  test('SQL token counts; wrapped local audit( helper counts', () => {
    expect(hasAuditToken('db.run("INSERT INTO audit_log (ts) VALUES ($1)");', tokens)).toBe(true);
    expect(hasAuditToken('const r = audit("login_failed");', tokens)).toBe(true);
  });
  test('no token → false', () => {
    expect(hasAuditToken('console.log("nothing to audit here");', tokens)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scan scenarios (fixtures under <scratch>/app/api/...)
// ---------------------------------------------------------------------------

describe('scanRouteAudit', () => {
  test('1. POST route reaching an audit token in its own file → PASS', () => {
    put('app/api/things/route.ts', [
      'import { appendAudit } from "@/lib/audit";',
      'export async function POST(req: Request) {',
      '  await appendAudit("thing.created", {});',
      '  return Response.json({ ok: true });',
      '}',
      '',
    ].join('\n'));
    const r = scanRouteAudit(SCRATCH, cfg());
    expect(r.skipped).toBe(false);
    expect(r.writeRoutes).toBe(1);
    expect(r.unaudited).toEqual([]);
    expect(r.allowlistErrors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test('2. POST route not reaching a token → FAIL naming file:line', () => {
    const p = put('app/api/quiet/route.ts', [
      'export async function POST(req: Request) {',
      '  return Response.json({ ok: true });',
      '}',
      '',
    ].join('\n'));
    const r = scanRouteAudit(SCRATCH, cfg());
    expect(r.ok).toBe(false);
    expect(r.unaudited).toHaveLength(1);
    expect(r.unaudited[0]!.methods).toEqual(['POST']);
    expect(r.unaudited[0]!.route).toBe('app/api/quiet/route.ts');
    expect(r.unaudited[0]!.line).toBe(1);
    expect(r.unaudited[0]!.file).toBe(p);
  });

  test('3. GET-only route files are ignored entirely', () => {
    put('app/api/health/route.ts', 'export async function GET() { return Response.json({ ok: true }); }\n');
    const r = scanRouteAudit(SCRATCH, cfg());
    expect(r.writeRoutes).toBe(0);
    expect(r.unaudited).toEqual([]);
    expect(r.ok).toBe(true);
  });

  test('4. depth-3 graph walk: token at hop 1, 2, 3 counts; hop 4 is not followed', () => {
    for (const hops of [1, 2, 3]) {
      fs.rmSync(SCRATCH, { recursive: true, force: true });
      // route -> l1 -> l2 -> l3 -> l4 chain; the token lives at level `hops`.
      put('app/api/chain/route.ts', [
        'export async function POST() {',
        '  await handler();',
        '  return Response.json({ ok: true });',
        '}',
        'import { handler } from "../../lib/l1";',
        '',
      ].join('\n'));
      const levels = ['l1', 'l2', 'l3', 'l4'];
      levels.forEach((name, i) => {
        const next = levels[i + 1];
        const body: string[] = [];
        if (i + 1 === hops) body.push('export async function handler() { await appendAudit("hop", {}); }');
        else if (next) body.push(`import { handler } from "./${next}";`, 'export async function handler() { await handler(); }');
        else body.push('export async function handler() { /* deepest, no token */ }');
        put(`app/lib/${name}.ts`, body.join('\n') + '\n');
      });
      const r = scanRouteAudit(SCRATCH, cfg());
      expect(r.unaudited, `token at hop ${hops}`).toHaveLength(hops <= 3 ? 0 : 1);
    }
    // Explicit hop-4 case (fresh scratch): token only in l4 → out of budget.
    fs.rmSync(SCRATCH, { recursive: true, force: true });
    put('app/api/chain/route.ts', 'import { handler } from "../../lib/l1";\nexport async function POST() { await handler(); return Response.json({}); }\n');
    put('app/lib/l1.ts', 'import { handler } from "./l2";\nexport async function handler() { return handler(); }\n');
    put('app/lib/l2.ts', 'import { handler } from "./l3";\nexport async function handler() { return handler(); }\n');
    put('app/lib/l3.ts', 'import { handler } from "./l4";\nexport async function handler() { return handler(); }\n');
    put('app/lib/l4.ts', 'export async function handler() { await appendAudit("too deep", {}); }\n');
    expect(MAX_DEPTH).toBe(3);
    expect(scanRouteAudit(SCRATCH, cfg()).unaudited).toHaveLength(1);
  });

  test('cycle-safe: mutual imports do not hang or double-count', () => {
    put('app/api/cyc/route.ts', 'import { h } from "../../lib/a";\nexport async function POST() { await h(); return Response.json({}); }\n');
    put('app/lib/a.ts', 'import { h as b } from "./b";\nexport async function h() { return b(); }\n');
    put('app/lib/b.ts', 'import { h as a } from "./a";\nexport async function h() { return a(); }\n');
    const r = scanRouteAudit(SCRATCH, cfg());
    expect(r.unaudited).toHaveLength(1); // no token anywhere in the cycle
  });

  test('5. allowlist entry with a valid reason honored; too-short reason still errors', () => {
    put('app/api/draft/route.ts', 'export async function POST() { return Response.json({ draft: true }); }\n');
    const honored = scanRouteAudit(SCRATCH, cfg({ allowlist: { 'app/api/draft/route.ts': 'LLM draft generator: nothing is persisted.' } }));
    expect(honored.unaudited).toEqual([]);
    expect(honored.ok).toBe(true);
    const short = scanRouteAudit(SCRATCH, cfg({ allowlist: { 'app/api/draft/route.ts': 'draft' } }));
    expect(short.ok).toBe(false);
    expect(short.allowlistErrors.some((e) => e.includes('needs a reason'))).toBe(true);
  });

  test('6. wildcard allowlist entry rejected', () => {
    put('app/api/one/route.ts', 'export async function POST() { await appendAudit("x", {}); return Response.json({}); }\n');
    const r = scanRouteAudit(SCRATCH, cfg({ allowlist: { 'app/api/*/route.ts': 'blanket exemption attempt here' } }));
    expect(r.allowlistErrors.some((e) => e.includes('wildcard'))).toBe(true);
    expect(r.ok).toBe(false);
  });

  test('7. stale allowlist path (not a discovered write route) rejected', () => {
    put('app/api/live/route.ts', 'export async function POST() { await appendAudit("x", {}); return Response.json({}); }\n');
    const gone = scanRouteAudit(SCRATCH, cfg({ allowlist: { 'app/api/removed/route.ts': 'Route was deleted in the last sweep, sadly.' } }));
    expect(gone.allowlistErrors.some((e) => e.includes('not a write route (stale?)'))).toBe(true);
    expect(gone.ok).toBe(false);
  });

  test('8. no API surface → SKIP with the looked-for roots in the reason', () => {
    put('docs/note.md', 'no app/ or src/ here at all\n');
    const r = scanRouteAudit(SCRATCH, cfg());
    expect(r.skipped).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.skipReason).toContain('app/**/route.ts');
    expect(r.skipReason).toContain('src/**/route.ts');
  });

  test('sharedInfra basenames never contribute route-level tokens', () => {
    put('app/api/si/route.ts', 'import { ensureAuth } from "../../lib/auth";\nexport async function POST() { await ensureAuth(); return Response.json({}); }\n');
    put('app/lib/auth.ts', 'export function audit(kind: string) { return kind; }\nexport async function ensureAuth() { audit("login_failure"); }\n');
    // Without the exclusion the infra file's login-failure token passes the route (co-newbiz SHARED_INFRA gap).
    const without = scanRouteAudit(SCRATCH, cfg());
    expect(without.unaudited).toHaveLength(0);
    // With the exclusion auth.ts is unresolvable from the route → the route is unaudited.
    const withInfra = scanRouteAudit(SCRATCH, cfg({ sharedInfra: ['auth.ts'] }));
    expect(withInfra.unaudited.map((u) => u.route)).toEqual(['app/api/si/route.ts']);
    // A NON-infra file carrying the call site still counts: si2 reaches audit() via wrap.ts.
    put('app/api/si2/route.ts', 'import { wrapped } from "../../lib/wrap";\nexport async function POST() { await wrapped(); return Response.json({}); }\n');
    put('app/lib/wrap.ts', 'import { audit } from "./auth";\nexport async function wrapped() { audit("si2.action"); }\n');
    const counts = scanRouteAudit(SCRATCH, cfg({ sharedInfra: ['auth.ts'] }));
    expect(counts.unaudited.map((u) => u.route)).toEqual(['app/api/si/route.ts']);
  });
});

// ---------------------------------------------------------------------------
// Config loading (the ONE mechanism: routeAudit block, designLint precedent)
// ---------------------------------------------------------------------------

describe('loadRouteAuditConfig', () => {
  test('missing schema file → co-newbiz defaults', () => {
    const c = loadRouteAuditConfig(SCRATCH);
    expect(c.source).toBe('defaults');
    expect(c.auditTokenPatterns).toEqual([...DEFAULT_AUDIT_TOKEN_PATTERNS]);
  });

  test('schema block present → honored, source=schema; custom token names work', () => {
    put('docs/workspace-schema.json', JSON.stringify({ routeAudit: { auditTokenPatterns: ['writeAuditTrail\\s*\\('], allowlist: {} } }));
    put('app/api/custom/route.ts', 'export async function POST() { await writeAuditTrail("x"); return Response.json({}); }\n');
    const c = loadRouteAuditConfig(SCRATCH);
    expect(c.source).toBe('schema');
    const r = scanRouteAudit(SCRATCH, c);
    expect(r.unaudited).toEqual([]); // default patterns would NOT have caught writeAuditTrail
    expect(r.configSource).toBe('schema');
  });

  test('present-but-malformed block is a hard RouteAuditConfigError (never silent fallback)', () => {
    put('docs/workspace-schema.json', JSON.stringify({ routeAudit: { auditTokenPatterns: 'appendAudit(' } }));
    expect(() => loadRouteAuditConfig(SCRATCH)).toThrow(RouteAuditConfigError);
    put('docs/workspace-schema.json', JSON.stringify({ routeAudit: { auditTokenPatterns: ['(unbalanced'] } }));
    expect(() => loadRouteAuditConfig(SCRATCH)).toThrow(RouteAuditConfigError);
  });

  test('lockstep pin: schema routeAudit.auditTokenPatterns === script defaults (grep-level rot guard)', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'workspace-schema.json'), 'utf8')) as {
      routeAudit?: { auditTokenPatterns?: string[] };
    };
    expect(schema.routeAudit?.auditTokenPatterns).toEqual([...DEFAULT_AUDIT_TOKEN_PATTERNS]);
  });
});

// ---------------------------------------------------------------------------
// CLI (exit codes + offender output shape)
// ---------------------------------------------------------------------------

describe('CLI', () => {
  test('offender → exit 1 with file:line on stdout', () => {
    put('app/api/cli-bad/route.ts', 'export async function POST() { return Response.json({}); }\n');
    const res = spawnSync('bun', [SCRIPT_SRC, '--dir', SCRATCH], { encoding: 'utf8' });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('app/api/cli-bad/route.ts:1');
    expect(res.stdout).toContain('FAIL');
  });

  test('no API surface → exit 0 with SKIP line', () => {
    put('docs/note.md', 'empty project\n');
    const res = spawnSync('bun', [SCRIPT_SRC, '--dir', SCRATCH], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('SKIP');
  });

  test('clean write routes → exit 0 PASS; --json machine report', () => {
    put('app/api/cli-ok/route.ts', 'export async function POST() { await appendAudit("ok", {}); return Response.json({}); }\n');
    expect(spawnSync('bun', [SCRIPT_SRC, '--dir', SCRATCH], { encoding: 'utf8' }).status).toBe(0);
    const res = spawnSync('bun', [SCRIPT_SRC, '--dir', SCRATCH, '--json'], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout) as { ok: boolean; writeRoutes: number; configSource: string };
    expect(parsed.ok).toBe(true);
    expect(parsed.writeRoutes).toBe(1);
    expect(parsed.configSource).toBe('defaults');
  });

  test('unknown argument → die() usage error', () => {
    const res = spawnSync('bun', [SCRIPT_SRC, '--bogus'], { encoding: 'utf8' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('unknown argument');
  });
});

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

describe('discoverRouteFiles', () => {
  test('walks app/ and src/, skips node_modules/dist/dot-dirs, dedupes and sorts', () => {
    put('app/api/a/route.ts', 'export const POST = () => Response.json({});\n');
    put('src/app/api/b/route.ts', 'export const POST = () => Response.json({});\n');
    put('node_modules/x/route.ts', 'export const POST = () => Response.json({});\n');
    put('dist/y/route.ts', 'export const POST = () => Response.json({});\n');
    put('app/.next/cache/route.ts', 'export const POST = () => Response.json({});\n');
    const files = discoverRouteFiles(SCRATCH).map((f) => f.split('\\').join('/').slice(SCRATCH.length + 1));
    expect(files).toEqual(['app/api/a/route.ts', 'src/app/api/b/route.ts']);
  });
});

describe('importBasename (v1.0.1 win32 sharedInfra fix)', () => {
  test('segments both separators on every platform', () => {
    expect(importBasename('app/lib/auth.ts')).toBe('auth.ts');
    expect(importBasename('app\\lib\\auth.ts')).toBe('auth.ts');
    expect(importBasename('D:\\a\\pkg\\src\\lib\\auth.ts')).toBe('auth.ts');
    expect(importBasename('auth.ts')).toBe('auth.ts');
  });
});
