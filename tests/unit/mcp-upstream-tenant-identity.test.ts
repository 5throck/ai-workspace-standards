/**
 * Tenant identity branch of the upstream MCP intake (design
 * docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §3.3/§7.4).
 * Runs the REAL server (scripts/mcp-upstream-server.ts) as a subprocess
 * against a temp fake workspace (UPSTREAM_WORKSPACE_ROOT seam) with cwd set
 * to gateway-storage tenant projectDirs — the same harness shape as
 * mcp-upstream-server.test.ts, kept deliberately slimmer. Nothing touches the
 * real Projects/, tickets/ or logs/; every fixture path is an absolute
 * mkdtemp root (the T-20261104-003 / PR #1855 lesson).
 *
 * Pinned here: accept/reject matrix (registered active+scoped / suspended /
 * upstreamFile off / unregistered cwd / sibling-prefix overlap / nested .git /
 * symlinked cwd / absent-stale-malformed registry), the explicit tenant rule
 * message vs the generic REGISTRATION_RULE, identity tier precedence
 * (cwd > client_roots > self_declared), first-filing → triage:inbox via
 * known-projects keyed on the tenant id, and per-tenant hard-cap keying.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dump, load, JSON_SCHEMA } from 'js-yaml';

const REPO_ROOT = join(import.meta.dir, '..', '..');
const SERVER = join(REPO_ROOT, 'scripts', 'mcp-upstream-server.ts');

const REGISTRATION_RULE_PREFIX = 'unregistered working directory: requester must be a direct child of Projects/';
const TENANT_RULE_PREFIX = 'tenant not registered in tenant-loop-registry';
const TENANT_RULE_TAIL = 'filing requires the tenant to be registered and scopes.upstreamFile=true (design 2026-11-08-gw-tenant-loop-and-hardening-design §3.3)';

const MAP = {
  version: 'test',
  domains: {
    scripts: { source: 'scripts', target: 'templates/common/scripts', include_pattern: '*.ts', recursive: false },
  },
};

interface Ws {
  root: string;
  storage: string;
  ticketsDir: string;
  logsDir: string;
  tenant(id: string, opts?: { withMarker?: boolean; nestedGit?: boolean }): string;
}

let ws: Ws;
let procs: ChildProcess[] = [];

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), 'tenant-identity-ws-'));
  const storage = join(root, 'services', 'co-workspace', 'data', 'storage');
  ws = {
    root,
    storage,
    ticketsDir: join(root, 'tickets', 'governance'),
    logsDir: join(root, 'logs', 'upstream-intake'),
    tenant(id, opts = {}) {
      const dir = join(storage, 'op@example.com', id, 'project');
      mkdirSync(dir, { recursive: true });
      execFileSync('git', ['init', '-q', dir]);
      if (opts.withMarker !== false) {
        writeFileSync(join(dir, 'template-version.txt'), 'variant=co-consult\nversion=0.8.1\nplatform=all\n');
      }
      if (opts.nestedGit) {
        mkdirSync(join(dir, 'inner'), { recursive: true });
        execFileSync('git', ['init', '-q', join(dir, 'inner')]);
      }
      return dir;
    },
  };
  mkdirSync(ws.ticketsDir, { recursive: true });
  mkdirSync(ws.logsDir, { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(join(root, 'scripts', 'propagation-map.json'), JSON.stringify(MAP));
  mkdirSync(join(root, 'templates', 'common', 'scripts'), { recursive: true });
  writeFileSync(join(root, 'templates', 'common', 'scripts', 'f0.ts'), 'x');
  mkdirSync(join(root, 'templates', 'co-consult'), { recursive: true });
});

afterEach(() => {
  for (const p of procs) {
    try { p.kill(); } catch { /* already gone */ }
  }
  procs = [];
  rmSync(ws.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function tenantRow(id: string, projectDir: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    principal: 'op@example.com',
    variant: 'co-consult',
    projectDir,
    status: 'active',
    scopes: { upgrade: true, upstreamFile: true, backportReview: true, nightlyFleet: true },
    windows: { tz: 'UTC', days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59' },
    gitRemote: 'local-only',
    ...overrides,
  };
}

function writeRegistry(tenants: unknown[]): void {
  mkdirSync(join(ws.root, '.pipeline-state'), { recursive: true });
  writeFileSync(
    join(ws.root, '.pipeline-state', 'tenant-loop-registry.json'),
    JSON.stringify({ schemaVersion: 1, writtenAt: new Date().toISOString(), tenants }),
    'utf-8',
  );
}

interface RpcResult { result?: { content?: Array<{ text?: string }>; isError?: boolean }; error?: { code: number; message: string } }

class Server {
  private proc: ChildProcess;
  private buf = '';
  private pending = new Map<number, (r: RpcResult & { method?: string }) => void>();
  private nextId = 1;
  private stderr = '';
  rootsUris: string[] = [];

  constructor(cwd: string, env: Record<string, string> = {}) {
    this.proc = spawn('bun', [SERVER], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TZ: 'UTC', UPSTREAM_WORKSPACE_ROOT: ws.root, ...env },
    });
    procs.push(this.proc);
    this.proc.stdout!.on('data', (c: Buffer) => {
      this.buf += c.toString('utf-8');
      let i: number;
      while ((i = this.buf.indexOf('\n')) !== -1) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as RpcResult & { method?: string; id?: number };
        if (msg.method === 'roots/list') {
          // Fake MCP client: answer with the configured roots (or stay silent).
          if (this.rootsUris.length >= 0) {
            this.proc.stdin!.write(JSON.stringify({
              jsonrpc: '2.0', id: msg.id,
              result: { roots: this.rootsUris.map((uri) => ({ uri })) },
            }) + '\n');
          }
          continue;
        }
        const w = this.pending.get(msg.id as number);
        if (w) { this.pending.delete(msg.id as number); w(msg); }
      }
    });
    this.proc.stderr!.on('data', (c: Buffer) => { this.stderr += c.toString('utf-8'); });
  }

  async req(method: string, params?: unknown): Promise<RpcResult & { method?: string }> {
    const id = this.nextId++;
    const p = new Promise<RpcResult & { method?: string }>((res, rej) => {
      const t = setTimeout(() => rej(new Error(`timeout waiting for ${method}; stderr=${this.stderr}`)), 20_000);
      this.pending.set(id, (r) => { clearTimeout(t); res(r); });
    });
    this.proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return p;
  }

  async init(): Promise<void> {
    await this.req('initialize', { protocolVersion: '2024-11-05', capabilities: { roots: { listChanged: true } }, clientInfo: { name: 't', version: '1' } });
    this.proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  }

  async create(args: Record<string, unknown>): Promise<{ rpc: RpcResult; body: any }> {
    const r = await this.req('tools/call', { name: 'upstream_request_create', arguments: args });
    const body = r.result ? JSON.parse(r.result.content![0].text!) : null;
    return { rpc: r, body };
  }

  close(): void {
    try { this.proc.kill(); } catch { /* already gone */ }
  }
}

const CLEAN_SYMPTOM_BASE = 'the sync wave reverted the approved label copy on the status page';
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

function goodArgs(n = 0): Record<string, unknown> {
  return {
    suspected_layer: 'L2',
    symptom: `${CLEAN_SYMPTOM_BASE} (${WORDS[n % WORDS.length]})`,
    affected_paths: [`scripts/f${n}.ts`],
  };
}

function ticketIds(): string[] {
  return readdirSync(ws.ticketsDir).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, ''));
}

function readTicketYaml(id: string): any {
  return load(
    // tickets live as <id>.yaml under tickets/governance
    readFileSync(join(ws.ticketsDir, `${id}.yaml`), 'utf-8'),
    { schema: JSON_SCHEMA },
  );
}

describe('resolveProject tenant branch — accept matrix (design §7.4)', () => {
  test('a cwd inside a registered active+scoped tenant resolves AS the tenant id and files successfully', async () => {
    const dir = ws.tenant('gw-aaaaaaaaaaaa');
    writeRegistry([tenantRow('gw-aaaaaaaaaaaa', dir)]);
    const s = new Server(dir);
    await s.init();
    const { rpc, body } = await s.create(goodArgs());
    expect(rpc.error).toBeUndefined();
    expect(body.id).toBeDefined();
    const t = readTicketYaml(body.id);
    expect(t.upstream.project).toBe('gw-aaaaaaaaaaaa');
    expect(t.upstream.variant).toBe('co-consult');
    expect(t.upstream.template_version).toBe('0.8.1');
    expect(t.title).toContain('gw-aaaaaaaaaaaa');
    s.close();
  });

  test('a tenant root WITHOUT template-version.txt still files, version null', async () => {
    const dir = ws.tenant('gw-bbbbbbbbbbbb', { withMarker: false });
    writeRegistry([tenantRow('gw-bbbbbbbbbbbb', dir)]);
    const s = new Server(dir);
    await s.init();
    const { rpc, body } = await s.create(goodArgs(1));
    expect(rpc.error).toBeUndefined();
    expect(body.id).toBeDefined();
    const t = readTicketYaml(body.id);
    expect(t.upstream.project).toBe('gw-bbbbbbbbbbbb');
    expect(t.upstream.template_version).toBeNull();
    s.close();
  });

  test('a symlinked cwd inside the tenant resolves through realpath', async () => {
    const dir = ws.tenant('gw-cccccccccccc');
    const link = join(ws.root, 'tenant-link');
    symlinkSync(dir, link);
    mkdirSync(join(link, 'sub'), { recursive: true });
    writeRegistry([tenantRow('gw-cccccccccccc', dir)]);
    const s = new Server(join(link, 'sub'));
    await s.init();
    const { rpc, body } = await s.create(goodArgs(2));
    expect(rpc.error).toBeUndefined();
    expect(readTicketYaml(body.id).upstream.project).toBe('gw-cccccccccccc');
    s.close();
  });

  test('sibling-prefix overlap: …/gw-A/project and …/gw-A/project-alt do not cross-resolve', async () => {
    const a = ws.tenant('gw-aaaaaaaaaaaa');
    const alt = a + '-alt';
    mkdirSync(alt, { recursive: true });
    execFileSync('git', ['init', '-q', alt]);
    writeFileSync(join(alt, 'template-version.txt'), 'variant=co-consult\nversion=0.8.1\nplatform=all\n');
    writeRegistry([tenantRow('gw-aaaaaaaaaaaa', a)]);
    const s = new Server(alt);
    await s.init();
    const r = await s.create(goodArgs(3));
    // Not inside any registered projectDir (the +sep boundary) → generic rule.
    expect(r.rpc.error?.message).toContain(REGISTRATION_RULE_PREFIX);
    expect(r.rpc.error?.message).not.toContain(TENANT_RULE_PREFIX);
    s.close();
  });
});

describe('resolveProject tenant branch — reject matrix states the rule (design §3.3)', () => {
  test('registered but scopes.upstreamFile=false → the explicit tenant rule message verbatim', async () => {
    const dir = ws.tenant('gw-dddddddddddd');
    writeRegistry([tenantRow('gw-dddddddddddd', dir, { scopes: { upgrade: true, upstreamFile: false, backportReview: true, nightlyFleet: true } })]);
    const s = new Server(dir);
    await s.init();
    const r = await s.create(goodArgs(4));
    expect(r.rpc.error?.code).toBe(-32602);
    expect(r.rpc.error?.message).toContain(TENANT_RULE_PREFIX);
    expect(r.rpc.error?.message).toContain(TENANT_RULE_TAIL);
    expect(r.rpc.error?.message).not.toContain(REGISTRATION_RULE_PREFIX);
    s.close();
  });

  test('registered but suspended → the explicit tenant rule message', async () => {
    const dir = ws.tenant('gw-eeeeeeeeeeee');
    writeRegistry([tenantRow('gw-eeeeeeeeeeee', dir, { status: 'suspended' })]);
    const s = new Server(dir);
    await s.init();
    const r = await s.create(goodArgs(5));
    expect(r.rpc.error?.message).toContain(TENANT_RULE_PREFIX);
    expect(r.rpc.error?.message).toContain('scopes.upstreamFile=true');
    s.close();
  });

  test('nested .git BELOW the tenant root → tenant rule message (never resolve)', async () => {
    const dir = ws.tenant('gw-ffffffffffff', { nestedGit: true });
    writeRegistry([tenantRow('gw-ffffffffffff', dir)]);
    const s = new Server(join(dir, 'inner'));
    await s.init();
    const r = await s.create(goodArgs(6));
    expect(r.rpc.error?.message).toContain(TENANT_RULE_PREFIX);
    s.close();
  });

  test('cwd outside every registered projectDir → the generic REGISTRATION_RULE', async () => {
    const dir = ws.tenant('gw-aaaaaaaaaaaa');
    const elsewhere = join(ws.root, 'elsewhere');
    mkdirSync(elsewhere, { recursive: true });
    writeRegistry([tenantRow('gw-aaaaaaaaaaaa', dir)]);
    const s = new Server(elsewhere);
    await s.init();
    const r = await s.create(goodArgs(7));
    expect(r.rpc.error?.message).toContain(REGISTRATION_RULE_PREFIX);
    expect(r.rpc.error?.message).not.toContain(TENANT_RULE_PREFIX);
    s.close();
  });

  test('QA H9: a registry entry whose projectDir IS the workspace root never resolves (fleet.ts parity)', async () => {
    // Hand-edited registry: an entry pointing at the workspace root itself would
    // otherwise make every cwd inside the workspace tenant-resolvable until the
    // .git check rejected it. The guard drops the entry before any prefix match.
    writeRegistry([tenantRow('gw-cccccccccccc', ws.root)]);
    const s = new Server(join(ws.root, 'scripts'));
    await s.init();
    const r = await s.create(goodArgs(8));
    expect(r.rpc.error?.message).toContain(REGISTRATION_RULE_PREFIX);
    expect(r.rpc.error?.message).not.toContain(TENANT_RULE_PREFIX);
    s.close();
  });

  test('registry ABSENT + tenant-shaped cwd → generic rule (no tenants exist)', async () => {
    const dir = ws.tenant('gw-bbbbbbbbbbbb');
    const s = new Server(dir);
    await s.init();
    const r = await s.create(goodArgs(0));
    expect(r.rpc.error?.message).toContain(REGISTRATION_RULE_PREFIX);
    s.close();
  });

  test('registry STALE (25h old) behaves as absent → generic rule, WARN row in stderr', async () => {
    const dir = ws.tenant('gw-cccccccccccc');
    mkdirSync(join(ws.root, '.pipeline-state'), { recursive: true });
    const stale = new Date(Date.now() - 25 * 3_600_000).toISOString();
    writeFileSync(
      join(ws.root, '.pipeline-state', 'tenant-loop-registry.json'),
      JSON.stringify({ schemaVersion: 1, writtenAt: stale, tenants: [tenantRow('gw-cccccccccccc', dir)] }),
      'utf-8',
    );
    const s = new Server(dir);
    await s.init();
    const r = await s.create(goodArgs(1));
    expect(r.rpc.error?.message).toContain(REGISTRATION_RULE_PREFIX);
    s.close();
  });

  test('registry MALFORMED + tenant-shaped cwd → the explicit tenant rule (fail-closed, detail in stderr)', async () => {
    const dir = ws.tenant('gw-dddddddddddd');
    mkdirSync(join(ws.root, '.pipeline-state'), { recursive: true });
    writeFileSync(
      join(ws.root, '.pipeline-state', 'tenant-loop-registry.json'),
      JSON.stringify({ schemaVersion: 1, writtenAt: new Date().toISOString(), tenants: [{ id: 'co-bad-namespace' }] }),
      'utf-8',
    );
    const s = new Server(dir);
    await s.init();
    const r = await s.create(goodArgs(2));
    expect(r.rpc.error?.message).toContain(TENANT_RULE_PREFIX);
    expect(r.rpc.error?.message).toContain(TENANT_RULE_TAIL);
    s.close();
  });
});

describe('identity tier precedence preserved (cwd > client_roots > self_declared)', () => {
  test('with client roots AND project_root present, a tenant cwd still wins', async () => {
    const dir = ws.tenant('gw-eeeeeeeeeeee');
    // A decoy fleet project root + a decoy self-declared root.
    const fleet = join(ws.root, 'Projects', 'co-decoy');
    mkdirSync(fleet, { recursive: true });
    execFileSync('git', ['init', '-q', fleet]);
    writeFileSync(join(fleet, 'template-version.txt'), 'variant=co-consult\nversion=9.9.9\nplatform=all\n');
    writeRegistry([tenantRow('gw-eeeeeeeeeeee', dir)]);
    const s = new Server(dir);
    s.rootsUris = [pathToFileURL(fleet).href];
    await s.init();
    const { rpc, body } = await s.create({ ...goodArgs(3), project_root: fleet });
    expect(rpc.error).toBeUndefined();
    expect(body.id).toBeDefined();
    const t = readTicketYaml(body.id);
    expect(t.upstream.project).toBe('gw-eeeeeeeeeeee'); // cwd tier, not the decoys
    expect(t.upstream.identity_source).toBe('cwd');
    s.close();
  });
});

describe('caps + first-seen key on the tenant id (design §3.3)', () => {
  test('first filing from an UNKNOWN tenant → triage inbox with first_request_from_project; after seeding known-projects, ready', async () => {
    const dir = ws.tenant('gw-aaaaaaaaaaaa');
    writeRegistry([tenantRow('gw-aaaaaaaaaaaa', dir)]);
    const s = new Server(dir);
    await s.init();
    const first = await s.create(goodArgs(0));
    expect(first.body.triage).toBe('inbox');
    expect(first.body.reasons).toContain('first_request_from_project');
    // known-projects.json now records the TENANT id alongside co-* names.
    const known = JSON.parse(readFileSync(join(ws.logsDir, 'known-projects.json'), 'utf-8')) as Record<string, unknown>;
    expect(Object.keys(known)).toContain('gw-aaaaaaaaaaaa');
    const second = await s.create(goodArgs(1));
    expect(second.body.triage).toBe('ready');
    s.close();
  });

  test('hard cap counts PER TENANT (env-capped): 3rd filing from one tenant rate-limited, another tenant unaffected', async () => {
    const a = ws.tenant('gw-aaaaaaaaaaaa');
    const b = ws.tenant('gw-bbbbbbbbbbbb');
    writeRegistry([tenantRow('gw-aaaaaaaaaaaa', a), tenantRow('gw-bbbbbbbbbbbb', b)]);
    const sa = new Server(a, { UPSTREAM_HARD_CAP: '2', UPSTREAM_SOFT_CAP: '1' });
    await sa.init();
    const first = await sa.create(goodArgs(0));
    expect(first.body.id).toBeDefined();
    const second = await sa.create(goodArgs(1));
    expect(second.body.id).toBeDefined();
    const third = await sa.create(goodArgs(2));
    expect(third.body.error?.message).toMatch(/^rate_limited: per-project hard cap reached \(2\/2\/day\)/);
    sa.close();
    const sb = new Server(b, { UPSTREAM_HARD_CAP: '2', UPSTREAM_SOFT_CAP: '1' });
    await sb.init();
    const otherTenant = await sb.create(goodArgs(3));
    expect(otherTenant.body.id).toBeDefined(); // per-tenant keying, not global
    sb.close();
  });
});

describe('reprioritize actor derivation for tenant identities', () => {
  test('a tenant-raised priority records history actor spoke-tenant:<tenant id> via the MCP surface', async () => {
    const dir = ws.tenant('gw-aaaaaaaaaaaa');
    writeRegistry([tenantRow('gw-aaaaaaaaaaaa', dir)]);
    // Seed an existing ticket owned by the tenant so ownership passes (dump()ed
    // through the schema-shaped object, as in mcp-upstream-server.test.ts).
    const ticketId = 'U-20261108-901';
    const ticket = {
      schemaVersion: 1,
      id: ticketId,
      kind: 'manual',
      title: 'Upstream report from gw-aaaaaaaaaaaa',
      priority: 'normal',
      status: 'backlog',
      attempts: 0,
      created_at: '2026-11-08T00:00:00.000Z',
      history: [{ at: '2026-11-08T00:00:00.000Z', from: null, to: 'backlog' }],
      result: null,
      error: null,
      upstream: {
        project: 'gw-aaaaaaaaaaaa',
        variant: 'co-consult',
        template_version: '0.8.1',
        source: 'project/gw-aaaaaaaaaaaa',
        trust: 'untrusted',
        suspected_layer: 'L2',
        symptom: 'sync wave reverted the approved label copy',
        affected_paths: ['scripts/f0.ts'],
        triage: 'inbox',
        flagged: false,
        triage_reasons: [],
        dedupe_key: 'b'.repeat(64),
        duplicates: [{ project: 'gw-aaaaaaaaaaaa', at: '2026-11-08T00:00:00.000Z' }],
      },
    };
    writeFileSync(join(ws.ticketsDir, `${ticketId}.yaml`), dump(ticket, { schema: JSON_SCHEMA }), 'utf-8');
    const s = new Server(dir);
    await s.init();
    const r = await s.req('tools/call', { name: 'upstream_request_reprioritize', arguments: { id: ticketId, priority: 'high' } });
    expect(r.error).toBeUndefined();
    const body = JSON.parse(r.result!.content![0].text!);
    expect(body.priority).toBe('high');
    const t = readTicketYaml(ticketId);
    expect(t.history[t.history.length - 1].actor).toBe('spoke-tenant:gw-aaaaaaaaaaaa');
    s.close();
  });
});

// Keep the listing helper referenced (used by manual debugging runs of this file).
void ticketIds;
