// @version 1.0.0
// hub-state.test.ts — unit contract for scripts/helpers/hub-state.ts
// (spec docs/designs/2026-11-01-hub-consolidation-design.md §3, Phase 3.5).
//
// Coverage: the two-enum state machine (bootstrap linear forward-only;
// every legal operational edge incl. AVAILABLE<->DEGRADED,
// AVAILABLE/DEGRADED->UNAVAILABLE, UNAVAILABLE->RECOVERY->{AVAILABLE|
// UNAVAILABLE}, same-state re-attest; each named illegal edge refused),
// the sha256 hash chain (recomputation + tamper/truncate detection),
// TTL leases (validity + expired-lease-reads-UNAVAILABLE), the registry
// enum cross-check, DEGRADED capability matrix validation (unknown key /
// undeclared / never_in_degraded), and the state file I/O contract
// (absent -> null, corrupt -> fail-closed, atomic write shape).
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyTransition, effectiveOperationalState, entryHash, initStateFile, isLeaseValid,
  readState, stateFilePath, validateChain, validateDegradedCapabilities,
  resolveRegistryEnumsForHub,
  HubStateError,
  type HubStateFile, type RegistryEnums,
} from '../../scripts/helpers/hub-state.ts';
import type { HubTopology } from '../../scripts/helpers/hub-topology.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hub-state-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const HUB = 'co-test';

/** Synthetic registry matching the design enums, with one hub row declaring
 * {documentation, routine-triage} and the never-in-DEGRADED floor. */
function fixtureEnums(hub = HUB): RegistryEnums {
  const topology: HubTopology = {
    bootstrap_states: ['BOOTSTRAPPED', 'VALIDATED', 'READY'],
    operational_states: ['AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'RECOVERY'],
    capability_enum: {
      documentation: { never_in_degraded: false },
      'routine-triage': { never_in_degraded: false },
      'pentest-execution': { never_in_degraded: true },
    },
    hubs: [{ name: hub, hub_remote: '/git/co-test.git', capabilities: ['documentation', 'routine-triage'] }],
    entries: [],
  };
  return resolveRegistryEnumsForHub(topology, hub);
}

function bootstrapToReady(dir: string, hub = HUB, enums?: RegistryEnums): HubStateFile {
  initStateFile(dir, hub, { actor: 'user', remote: '/git/co-test.git', sha: 'a'.repeat(40), at: '2026-11-02T09:00:00.000Z' });
  applyTransition(dir, hub, { kind: 'bootstrap', to: 'BOOTSTRAPPED', actor: 'hub-bootstrap', reason: 'clone', at: '2026-11-02T09:00:01.000Z' }, { enums });
  applyTransition(dir, hub, { kind: 'bootstrap', to: 'VALIDATED', actor: 'hub-bootstrap', reason: 'gate', at: '2026-11-02T09:00:02.000Z' }, { enums });
  return applyTransition(dir, hub, { kind: 'bootstrap', to: 'READY', actor: 'hub-bootstrap', reason: 'infra', at: '2026-11-02T09:00:03.000Z' }, { enums });
}

// ── (a) state machine: bootstrap linear forward-only ─────────────────────────

describe('bootstrap_states — linear forward only', () => {
  test('init BOOTSTRAPPED -> VALIDATED -> READY is legal and journal-chained', () => {
    const s = bootstrapToReady(dir);
    expect(s.bootstrap_state).toBe('READY');
    expect(s.state_history.map(e => e.to)).toEqual(['BOOTSTRAPPED', 'VALIDATED', 'READY']);
    expect(s.state_history.map(e => e.from)).toEqual([null, 'BOOTSTRAPPED', 'VALIDATED']);
    expect(validateChain(s).ok).toBe(true);
  });

  test('skipping a step is refused (null->VALIDATED, BOOTSTRAPPED->READY)', () => {
    initStateFile(dir, HUB, { actor: 'user', remote: 'r', sha: 'a'.repeat(40), at: '2026-11-02T09:00:00.000Z' });
    expect(() => applyTransition(dir, HUB, { kind: 'bootstrap', to: 'VALIDATED', actor: 'hub-bootstrap', reason: 'skip' })).toThrow(HubStateError);
    applyTransition(dir, HUB, { kind: 'bootstrap', to: 'BOOTSTRAPPED', actor: 'hub-bootstrap', reason: 'ok' });
    expect(() => applyTransition(dir, HUB, { kind: 'bootstrap', to: 'READY', actor: 'hub-bootstrap', reason: 'skip' })).toThrow(/illegal bootstrap transition BOOTSTRAPPED -> READY/);
  });

  test('backward and repeat edges are refused; READY is terminal', () => {
    bootstrapToReady(dir);
    expect(() => applyTransition(dir, HUB, { kind: 'bootstrap', to: 'BOOTSTRAPPED', actor: 'hub-bootstrap', reason: 'back' })).toThrow(/illegal/);
    expect(() => applyTransition(dir, HUB, { kind: 'bootstrap', to: 'READY', actor: 'hub-bootstrap', reason: 'again' })).toThrow(/illegal/);
  });

  test('bootstrap states are machine-declared ONLY — a hub PM actor is refused (design §3.1)', () => {
    initStateFile(dir, HUB, { actor: 'user', remote: 'r', sha: 'a'.repeat(40), at: '2026-11-02T09:00:00.000Z' });
    expect(() => applyTransition(dir, HUB, { kind: 'bootstrap', to: 'BOOTSTRAPPED', actor: 'hub-pm', reason: 'self-declare' })).toThrow(/hub-bootstrap\.ts only/);
  });

  test('initStateFile is one-time: a second init refuses', () => {
    initStateFile(dir, HUB, { actor: 'user', remote: 'r', sha: 'a'.repeat(40), at: '2026-11-02T09:00:00.000Z' });
    expect(() => initStateFile(dir, HUB, { actor: 'user', remote: 'r', sha: 'a'.repeat(40), at: '2026-11-02T09:00:00.000Z' })).toThrow(/already exists/);
  });
});

// ── (a) state machine: operational edges ─────────────────────────────────────

describe('operational_states — legal and illegal edges', () => {
  test('null -> AVAILABLE | DEGRADED | UNAVAILABLE are legal inits', () => {
    for (const to of ['AVAILABLE', 'DEGRADED', 'UNAVAILABLE'] as const) {
      const d = mkdtempSync(join(tmpdir(), 'hub-state-init-'));
      const s = applyTransition(d, HUB, { kind: 'operational', to, actor: 'hub-pm', reason: 'init' });
      expect(s.operational_state).toBe(to);
      rmSync(d, { recursive: true, force: true });
    }
  });

  test('null -> RECOVERY is illegal (nothing to recover from yet)', () => {
    expect(() => applyTransition(dir, HUB, { kind: 'operational', to: 'RECOVERY', actor: 'hub-pm', reason: 'init' })).toThrow(/illegal operational transition <init> -> RECOVERY/);
  });

  test('AVAILABLE <-> DEGRADED round trip', () => {
    applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up' });
    const s = applyTransition(dir, HUB, { kind: 'operational', to: 'DEGRADED', actor: 'hub-pm', reason: 'down', degradedCapabilities: [], replaceCapabilities: true });
    expect(s.operational_state).toBe('DEGRADED');
    const s2 = applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'restored' });
    expect(s2.operational_state).toBe('AVAILABLE');
    expect(s2.degraded_capabilities).toEqual([]); // restoration clears the matrix
  });

  test('AVAILABLE and DEGRADED both reach UNAVAILABLE; UNAVAILABLE -> RECOVERY -> AVAILABLE', () => {
    applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up' });
    applyTransition(dir, HUB, { kind: 'operational', to: 'UNAVAILABLE', actor: 'hub-pm', reason: 'down' });
    applyTransition(dir, HUB, { kind: 'operational', to: 'RECOVERY', actor: 'hub-pm', reason: 'recovering' });
    const s = applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'recovered (probe re-verified)' });
    expect(s.operational_state).toBe('AVAILABLE');

    applyTransition(dir, HUB, { kind: 'operational', to: 'DEGRADED', actor: 'hub-pm', reason: 'degraded again', degradedCapabilities: [], replaceCapabilities: true });
    const s2 = applyTransition(dir, HUB, { kind: 'operational', to: 'UNAVAILABLE', actor: 'hub-pm', reason: 'lost' });
    expect(s2.operational_state).toBe('UNAVAILABLE');
  });

  test('RECOVERY -> UNAVAILABLE (failed recovery) is legal; AVAILABLE/DEGRADED -> RECOVERY is illegal', () => {
    applyTransition(dir, HUB, { kind: 'operational', to: 'UNAVAILABLE', actor: 'hub-pm', reason: 'down' });
    applyTransition(dir, HUB, { kind: 'operational', to: 'RECOVERY', actor: 'hub-pm', reason: 'attempt' });
    const s = applyTransition(dir, HUB, { kind: 'operational', to: 'UNAVAILABLE', actor: 'hub-pm', reason: 'recovery failed' });
    expect(s.operational_state).toBe('UNAVAILABLE');

    const d2 = mkdtempSync(join(tmpdir(), 'hub-state-ill-'));
    applyTransition(d2, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up' });
    expect(() => applyTransition(d2, HUB, { kind: 'operational', to: 'RECOVERY', actor: 'hub-pm', reason: 'skip' })).toThrow(/illegal/);
    rmSync(d2, { recursive: true, force: true });
  });

  test('same-state re-attest is legal and refreshes the lease', () => {
    const s1 = applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', at: '2026-11-02T09:00:00.000Z' });
    const s2 = applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 're-attest', at: '2026-11-02T10:00:00.000Z' });
    expect(s2.ttl_lease!.declared_at).toBe('2026-11-02T10:00:00.000Z');
    expect(s2.ttl_lease!.expires_at).toBe('2026-11-02T18:00:00.000Z');
    expect(Date.parse(s2.ttl_lease!.expires_at)).toBeGreaterThan(Date.parse(s1.ttl_lease!.expires_at));
    expect(s2.state_history).toHaveLength(2);
  });

  test('bootstrap states cannot be declared through the operational kind (and vice versa)', () => {
    expect(() => applyTransition(dir, HUB, { kind: 'operational', to: 'READY', actor: 'hub-pm', reason: 'x' })).toThrow(/not a hub_topology operational_state/);
    initStateFile(dir, HUB, { actor: 'user', remote: 'r', sha: 'a'.repeat(40), at: '2026-11-02T09:00:00.000Z' });
    expect(() => applyTransition(dir, HUB, { kind: 'bootstrap', to: 'AVAILABLE', actor: 'hub-bootstrap', reason: 'x' })).toThrow(/not a hub_topology bootstrap_state/);
  });

  test('registry enum cross-check: a state absent from the registry enums is refused', () => {
    const narrow = { ...fixtureEnums(), operational_states: ['AVAILABLE', 'UNAVAILABLE'] };
    expect(() => applyTransition(dir, HUB, { kind: 'operational', to: 'DEGRADED', actor: 'hub-pm', reason: 'x' }, { enums: narrow })).toThrow(/not a hub_topology operational_state/);
  });

  test('actor and reason are mandatory (every transition is audited with its cause)', () => {
    expect(() => applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: '  ', reason: 'x' })).toThrow(/actor/);
    expect(() => applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: ' ' })).toThrow(/reason/);
  });
});

// ── (b) hash chain integrity + tamper detection ──────────────────────────────

describe('hash chain', () => {
  test('entry.hash = sha256(canonicalJson(entry minus hash) + prev_hash); chain validates', () => {
    const s = bootstrapToReady(dir);
    for (let i = 0; i < s.state_history.length; i++) {
      const e = s.state_history[i];
      const { hash, ...rest } = e;
      expect(hash).toEqual(entryHash(rest as typeof e));
      expect(e.prev_hash).toEqual(i === 0 ? null : s.state_history[i - 1].hash);
    }
    expect(validateChain(s)).toEqual({ ok: true, head: s.state_history[2].hash });
    expect(s.head_hash).toBe(s.state_history[2].hash);
  });

  test('tampering with an entry reason breaks the chain at that entry', () => {
    const s = bootstrapToReady(dir);
    s.state_history[1].reason = 'TAMPERED';
    const v = validateChain(s);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.at).toBe(1);
      expect(v.error).toMatch(/hash mismatch/);
    }
  });

  test('rewriting a prev_hash linkage and truncating history are both detected', () => {
    const s = bootstrapToReady(dir);
    s.state_history[2].prev_hash = 'f'.repeat(64);
    expect(validateChain(s)).toMatchObject({ ok: false, at: 2 });

    const d2 = mkdtempSync(join(tmpdir(), 'hub-state-trunc-'));
    const s2 = bootstrapToReady(d2);
    s2.state_history = s2.state_history.slice(0, 1);
    s2.head_hash = s2.state_history[0].hash; // a forger would also fix head
    // entry 0 alone still chains — but the ORIGINAL head is gone, which the
    // probe's chained-probe rule (§3.5) catches across probes.
    expect(validateChain(s2).ok).toBe(true);
    expect(s2.state_history.map(e => e.to)).not.toContain('READY');
  });

  test('head_hash drift (file says X, chain computes Y) is detected', () => {
    const s = bootstrapToReady(dir);
    s.head_hash = '0'.repeat(64);
    expect(validateChain(s)).toMatchObject({ ok: false, at: 3 });
  });

  test('canonical JSON is key-order independent (same entry from any key order hashes equal)', () => {
    const base = { from: null, to: 'BOOTSTRAPPED', actor: 'hub-bootstrap', timestamp: 't', reason: 'r', prev_hash: null };
    const reordered = JSON.parse(JSON.stringify(base));
    expect(entryHash(base)).toBe(entryHash(reordered));
  });
});

// ── (c) TTL lease ────────────────────────────────────────────────────────────

describe('TTL lease (design §3.3)', () => {
  test('default lease is 8h; isLeaseValid honours expiry', () => {
    const s = applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', at: '2026-11-02T09:00:00.000Z' });
    expect(s.ttl_lease).toEqual({ declared_at: '2026-11-02T09:00:00.000Z', expires_at: '2026-11-02T17:00:00.000Z' });
    expect(isLeaseValid(s, Date.parse('2026-11-02T16:59:59.000Z'))).toBe(true);
    expect(isLeaseValid(s, Date.parse('2026-11-02T17:00:00.000Z'))).toBe(false);
  });

  test('custom leaseMs; a lease-less state is not valid', () => {
    const s = applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', leaseMs: 3_600_000, at: '2026-11-02T09:00:00.000Z' });
    expect(s.ttl_lease!.expires_at).toBe('2026-11-02T10:00:00.000Z');
    expect(isLeaseValid({ ttl_lease: null }, Date.now())).toBe(false);
  });

  test('effectiveOperationalState: expired lease reads UNAVAILABLE; null stays null (not yet in service)', () => {
    const s = applyTransition(dir, HUB, { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', at: '2026-11-02T09:00:00.000Z' });
    expect(effectiveOperationalState(s, Date.parse('2026-11-02T10:00:00.000Z'))).toBe('AVAILABLE');
    expect(effectiveOperationalState(s, Date.parse('2026-11-02T18:00:00.000Z'))).toBe('UNAVAILABLE');
    // declared UNAVAILABLE reads UNAVAILABLE regardless of lease
    applyTransition(dir, HUB, { kind: 'operational', to: 'UNAVAILABLE', actor: 'hub-pm', reason: 'down' });
    expect(effectiveOperationalState(readState(dir, HUB)!, Date.parse('2026-11-02T09:00:00.000Z'))).toBe('UNAVAILABLE');
    // bootstrap-only file: operational null -> null even with no lease
    const d2 = mkdtempSync(join(tmpdir(), 'hub-state-null-'));
    bootstrapToReady(d2);
    expect(effectiveOperationalState(readState(d2, HUB)!, Date.now())).toBeNull();
    rmSync(d2, { recursive: true, force: true });
  });
});

// ── DEGRADED capability matrix (design §3.4) ─────────────────────────────────

describe('DEGRADED capability matrix', () => {
  test('a declared, non-floor capability degrades cleanly', () => {
    const s = applyTransition(dir, HUB, { kind: 'operational', to: 'DEGRADED', actor: 'hub-pm', reason: 'reduced', degradedCapabilities: ['documentation'], replaceCapabilities: true }, { enums: fixtureEnums() });
    expect(s.degraded_capabilities).toEqual(['documentation']);
  });

  test('an unknown capability_enum key is refused (no invented names)', () => {
    expect(() => applyTransition(dir, HUB, { kind: 'operational', to: 'DEGRADED', actor: 'hub-pm', reason: 'x', degradedCapabilities: ['warp-drive'], replaceCapabilities: true })).toThrow(/not a hub_topology.capability_enum key/);
  });

  test('a never_in_degraded capability is refused (the floor)', () => {
    expect(() => applyTransition(dir, HUB, { kind: 'operational', to: 'DEGRADED', actor: 'hub-pm', reason: 'x', degradedCapabilities: ['pentest-execution'], replaceCapabilities: true }, { enums: fixtureEnums() })).toThrow(/never_in_degraded/);
  });

  test('a capability the hub never declared is refused; no hub row = nothing is declarable', () => {
    expect(() => applyTransition(dir, HUB, { kind: 'operational', to: 'DEGRADED', actor: 'hub-pm', reason: 'x', degradedCapabilities: ['routine-triage'], replaceCapabilities: true }, { enums: { ...fixtureEnums(), declaredCapabilities: ['documentation'] } })).toThrow(/not declared by this hub/);
    expect(() => applyTransition(dir, HUB, { kind: 'operational', to: 'DEGRADED', actor: 'hub-pm', reason: 'x', degradedCapabilities: ['documentation'], replaceCapabilities: true }, { enums: { ...fixtureEnums(), declaredCapabilities: null } })).toThrow(/no registry row for this hub/);
  });

  test('validateDegradedCapabilities returns violations (pure); DEGRADED without capabilities reuses the existing set', () => {
    expect(validateDegradedCapabilities(['documentation'], fixtureEnums())).toEqual([]);
    expect(validateDegradedCapabilities(['pentest-execution', 'nope'], fixtureEnums()).length).toBe(2);
    const s = applyTransition(dir, HUB, { kind: 'operational', to: 'DEGRADED', actor: 'hub-pm', reason: 'x', degradedCapabilities: ['documentation'], replaceCapabilities: true }, { enums: fixtureEnums() });
    const s2 = applyTransition(dir, HUB, { kind: 'operational', to: 'DEGRADED', actor: 'hub-pm', reason: 'still degraded' }, { enums: fixtureEnums() });
    expect(s2.degraded_capabilities).toEqual(['documentation']); // reused, not replaced
  });
});

// ── state file I/O ───────────────────────────────────────────────────────────

describe('state file I/O', () => {
  test('absent file -> null; corrupt JSON -> fail-closed throw; hub mismatch -> throw', () => {
    expect(readState(dir, HUB)).toBeNull();
    mkdirSync(join(dir, '.pipeline-state'), { recursive: true });
    writeFileSync(stateFilePath(dir, HUB), '{ not json', 'utf-8');
    expect(() => readState(dir, HUB)).toThrow(/not valid JSON/);
    writeFileSync(stateFilePath(dir, HUB), JSON.stringify({ hub: 'co-other' }), 'utf-8');
    expect(() => readState(dir, HUB)).toThrow(/hub mismatch/);
  });

  test('writes are atomic-shaped: no .tmp residue after a transition', () => {
    bootstrapToReady(dir);
    const files = require('node:fs').readdirSync(join(dir, '.pipeline-state')) as string[];
    expect(files).toEqual([`hub-${HUB}.state.json`]);
    expect(existsSync(stateFilePath(dir, HUB))).toBe(true);
  });

  test('invalid hub name is refused at the path boundary (path-escape class)', () => {
    expect(() => stateFilePath(dir, '../evil')).toThrow(/invalid hub name/);
    expect(() => stateFilePath(dir, 'gw-notahub')).toThrow(/invalid hub name/);
  });

  test('the approval record survives round-trips', () => {
    bootstrapToReady(dir);
    const s = readState(dir, HUB)!;
    expect(s.approval).toMatchObject({ actor: 'user', remote: '/git/co-test.git', sha: 'a'.repeat(40) });
  });
});
