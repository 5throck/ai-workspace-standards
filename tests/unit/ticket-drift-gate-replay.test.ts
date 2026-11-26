// @version 1.0.0
// tests/unit/ticket-drift-gate-replay.test.ts — 3.87 gate REPLAY (T-20261127-001a,
// spec docs/designs/2026-11-27-ticket-store-drift-and-nextid-design.md §6): each test
// builds a fixture tree (memory file + store files), then spawns a subprocess that
// runs the SAME production code path as dev-sync step 3.87 — helpers/ticket-drift.ts
// driftCheck() + reportDriftFindings() — against that tree, and asserts the printed
// lines AND the exit code:
//   (1) AMBIGUOUS fixture — a memory file citing an id double-resident in
//       governance+service stores (the 2026-11-26 incident shape that FATALed every
//       sync with the misleading not-found diagnostic) → AMBIGUOUS non-fatal lines,
//       exit 0.
//   (2) NOT-FOUND fixture — a cited id resolving nowhere → the FATAL block, exit 1.
// The harness is written into each fixture tmpdir and imports the helper by absolute
// path, so the replay exercises the production module (with its guarded dynamic
// import of the production ticket-store), not a re-implementation.
import { test, expect, describe, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HELPER = join(import.meta.dir, '..', '..', 'scripts', 'helpers', 'ticket-drift.ts');

// Same KST arithmetic as scripts/helpers/kst-time.ts (machine-TZ independent).
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function kstDate(): string {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
const prefix = `T-${kstDate().replace(/-/g, '')}`;

function makeFixtureTree(name: string): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), `drift-replay-${name}-`));
  mkdirSync(join(root, 'memory'), { recursive: true });
  mkdirSync(join(root, 'tickets'), { recursive: true });
  mkdirSync(join(root, 'tickets', 'governance'), { recursive: true });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** The gate harness: mirrors dev-sync step 3.87's consumption exactly — driftCheck
 * over the cwd-relative store layout, reportDriftFindings for print + verdict,
 * exit 1 only on the fatal verdict. */
function harnessSource(): string {
  return `
const { driftCheck, reportDriftFindings } = await import(${JSON.stringify(HELPER)});
const drift = await driftCheck({
  memoryDir: "memory",
  serviceDir: "tickets",
  governanceDir: "tickets/governance",
});
const verdict = reportDriftFindings(drift);
if (verdict === "fatal") process.exit(1);
`;
}

async function runGate(fixtureRoot: string): Promise<{ code: number; out: string }> {
  const harnessPath = join(fixtureRoot, 'gate-harness.ts');
  writeFileSync(harnessPath, harnessSource(), 'utf-8');
  const proc = Bun.spawn(['bun', 'run', harnessPath], {
    cwd: fixtureRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code: code ?? -1, out: out + err };
}

const cleanups: Array<() => void> = [];
afterAll(() => {
  for (const fn of cleanups) fn();
});

describe('step-3.87 gate replay (T-20261127-001a spec §6)', () => {
  test('AMBIGUOUS fixture: id double-resident in governance+service → non-fatal AMBIGUOUS lines, exit 0', async () => {
    const { root, cleanup } = makeFixtureTree('ambiguous');
    cleanups.push(cleanup);
    const id = `${prefix}-901`;
    // The incident shape: the id exists as real files in BOTH stores.
    writeFileSync(join(root, 'tickets', 'governance', `${id}.yaml`), `id: ${id}\n`, 'utf-8');
    writeFileSync(join(root, 'tickets', `${id}.yaml`), `id: ${id}\n`, 'utf-8');
    writeFileSync(
      join(root, 'memory', '2026-11-27.md'),
      `## Session\nnightly merge cited ${id} (double-resident fixture)\n`,
      'utf-8',
    );
    const r = await runGate(root);
    expect(r.code).toBe(0);
    expect(r.out).toContain('resolve in MULTIPLE stores (AMBIGUOUS — provenance problem, not a loss)');
    expect(r.out).toContain(`${id} cited at`);
    // The gate prints the store paths as passed (cwd-relative, exactly what
    // dev-sync's step 3.87 shows in production).
    expect(r.out).toContain(`BOTH stores: ${join('tickets', 'governance', `${id}.yaml`)} and ${join('tickets', `${id}.yaml`)}`);
    expect(r.out).toContain('Non-fatal');
    expect(r.out).toContain('memory-drift check passed');
    expect(r.out).not.toContain('resolve in NO store or archive');
  });

  test('NOT-FOUND fixture: genuinely-missing id → FATAL block, exit 1', async () => {
    const { root, cleanup } = makeFixtureTree('notfound');
    cleanups.push(cleanup);
    const id = `${prefix}-902`;
    writeFileSync(
      join(root, 'memory', '2026-11-27.md'),
      `## Session\nsilent-loss fixture: ${id} cited, exists nowhere\n`,
      'utf-8',
    );
    const r = await runGate(root);
    expect(r.code).toBe(1);
    expect(r.out).toContain('resolve in NO store or archive');
    expect(r.out).toContain(`${id} cited at`);
    expect(r.out).toContain('restore the vanished ticket file');
    expect(r.out).not.toContain('memory-drift check passed');
  });
});
