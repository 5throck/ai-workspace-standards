#!/usr/bin/env bun
// @version 1.5.1
// v1.5.1 (2026-10-04): provenance comment path updated — docs/superpowers/specs moved under docs/archive/superpowers (docs consolidation).
// v1.5.0 (2026-10-03, T-20261003-003): optional upstream.identity_source (cwd | client_roots |
//           self_declared) plus upstreamIdentitySource() legacy defaulting (design Appendix E.5).
// v1.4.0 (2026-10-02, T-20261002-007): upstream cross-field invariants — project
//           format ^co-[a-z0-9-]{1,40}$, template_version/variant string|null,
//           triage↔status consistency (inbox ⇒ backlog|done; ready ⇒ waiting|review|done),
//           done ⇒ resolution present, resolution summary required + https pr_url +
//           string template_version (review M2).
// v1.3.1 (2026-10-01): upstream tickets must use a U-YYYYMMDD-NNN id and carry no inputs.
// v1.3.0 (2026-10-01): add upstream request block (kind: manual only, design
//           docs/designs/2026-10-01-upstream-request-mcp-design.md §5).
// v1.2.0 (T-20260917-003): attempts is validated against history — it must
//           equal the count of failed → waiting transitions, so the field can
//           no longer sit at an unmaintained value.
// @l2-propagate: false
// ticket-schema.ts — Pure schema types, state machine, and validation for the
// Phase A Service Ticket + Kanban system. No file I/O here (see ticket-store.ts).
// Design: docs/archive/superpowers/specs/2026-07-16-service-ticket-kanban-design.md

export const CURRENT_SCHEMA_VERSION = 1;

export type Status = 'backlog' | 'waiting' | 'running' | 'review' | 'done' | 'failed';
export type Kind = 'service' | 'manual';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type RunType = 'skill' | 'script';
export type UpstreamLayer = 'L1' | 'L2' | 'unsure';
export type UpstreamTriage = 'inbox' | 'ready';
export type UpstreamIdentitySource = 'cwd' | 'client_roots' | 'self_declared';
export const UPSTREAM_IDENTITY_SOURCES: readonly UpstreamIdentitySource[] = ['cwd', 'client_roots', 'self_declared'];

/** Design Appendix E.5.3: a legacy ticket without the field reads as self_declared when its
 * triage_reasons carry identity:self_declared, otherwise as cwd. */
export function upstreamIdentitySource(u: { identity_source?: unknown; triage_reasons?: unknown }): UpstreamIdentitySource {
  if (typeof u.identity_source === 'string' && (UPSTREAM_IDENTITY_SOURCES as readonly string[]).includes(u.identity_source)) {
    return u.identity_source as UpstreamIdentitySource;
  }
  return Array.isArray(u.triage_reasons) && u.triage_reasons.includes('identity:self_declared') ? 'self_declared' : 'cwd';
}

export interface RunDef {
  type: RunType;
  ref: string;
}

export interface ServiceDef {
  id: string;
  name: string;
  description?: string;
  run: RunDef;
  inputs?: string[];
}

export interface ScheduleEntry {
  service: string;
  cron: string;
}

export interface Catalog {
  schemaVersion: number;
  services: ServiceDef[];
  schedule?: ScheduleEntry[];
}

export interface HistoryEntry {
  at: string;
  from: Status | null;
  to: Status;
}

export interface UpstreamBlock {
  project: string;                           // e.g. "co-work" — server-derived
  variant: string | null;                   // from project's template-version.txt (root; legacy .claude/ accepted)
  template_version: string | null;          // at intake time
  source: string;                           // "project/<name>" — server-set
  trust: 'untrusted';                       // constant
  suspected_layer: UpstreamLayer;
  symptom: string;
  affected_paths: string[];
  local_workaround_diff?: string;
  repro?: string;
  identity_source?: UpstreamIdentitySource; // who attested the project identity (absent on legacy tickets)
  triage: UpstreamTriage;
  flagged: boolean;
  triage_reasons: string[];                 // failed auto-ready conditions
  dedupe_key: string;                       // sha256 hash, hex
  duplicates: Array<{ project: string; at: string }>;  // merged reports
  resolution?: {
    outcome: 'fixed' | 'rejected' | 'local-only' | 'duplicate';
    pr_url?: string;
    template_version?: string;               // template release containing the fix
    summary?: string;                        // PM-written, trusted
  };
}

export interface Ticket {
  schemaVersion: number;
  id: string;
  kind: Kind;
  service?: string;
  title?: string;
  inputs?: Record<string, string>;
  priority: Priority;
  status: Status;
  /** Failure-retry count — derivable from history: every failed → waiting
   *  transition is one retry. validateTicket enforces the equality so the
   *  field cannot drift into unmaintained state (T-20260917-003). */
  attempts: number;
  created_at: string;
  /** ISO YYYY-MM-DD. Governance Backlog eligibility gate, orthogonal to `status` —
   * absent means always eligible. See docs/designs/2026-08-16-governance-backlog-design.md. */
  not_before?: string;
  history: HistoryEntry[];
  result: string | null;
  error: string | null;
  upstream?: UpstreamBlock;  // optional, allowed only on kind: manual
}

/** Adjacency-only state machine. `--force` in the CLI bypasses this; every other
 * caller (schema validation, `next`, `ticket-run`) must go through canTransition. */
export const TRANSITIONS: Record<Status, Status[]> = {
  backlog: ['waiting'],
  waiting: ['running', 'review'], // running: pulled by `next` (service). review: manual ticket picked up directly by a human.
  running: ['review', 'failed'],
  review: ['done'],
  failed: ['waiting'],
  done: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

const ID_PATTERN = /^[a-z0-9-]+$/;
// Allowlist for run.ref — must match one of these depending on run.type.
const SCRIPT_REF_PATTERN = /^scripts\/[a-z0-9-]+\.ts$/;
const SKILL_REF_PATTERN = /^[a-z0-9-]+$/;
const INPUT_NAME_PATTERN = /^[a-z0-9_-]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fail(msg: string): never {
  throw new Error(`[ticket-schema] ${msg}`);
}

export function validateCatalog(obj: unknown): asserts obj is Catalog {
  if (typeof obj !== 'object' || obj === null) fail('catalog must be an object');
  const c = obj as Record<string, unknown>;
  if (c.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    fail(`catalog schemaVersion must be ${CURRENT_SCHEMA_VERSION} (got: ${JSON.stringify(c.schemaVersion)})`);
  }
  if (!Array.isArray(c.services)) fail('catalog.services must be an array');
  const seenIds = new Set<string>();
  for (const [i, svc] of (c.services as unknown[]).entries()) {
    if (typeof svc !== 'object' || svc === null) fail(`services[${i}] must be an object`);
    const s = svc as Record<string, unknown>;
    if (typeof s.id !== 'string' || !ID_PATTERN.test(s.id)) fail(`services[${i}].id invalid: ${JSON.stringify(s.id)}`);
    if (seenIds.has(s.id as string)) fail(`duplicate service id: ${s.id}`);
    seenIds.add(s.id as string);
    if (typeof s.name !== 'string' || s.name.length === 0) fail(`services[${i}].name must be a non-empty string`);
    if (typeof s.run !== 'object' || s.run === null) fail(`services[${i}].run must be an object`);
    const run = s.run as Record<string, unknown>;
    if (run.type !== 'skill' && run.type !== 'script') fail(`services[${i}].run.type must be 'skill' or 'script'`);
    if (typeof run.ref !== 'string') fail(`services[${i}].run.ref must be a string`);
    const refPattern = run.type === 'script' ? SCRIPT_REF_PATTERN : SKILL_REF_PATTERN;
    if (!refPattern.test(run.ref as string)) fail(`services[${i}].run.ref fails allowlist for type '${run.type}': ${JSON.stringify(run.ref)}`);
    if (s.inputs !== undefined) {
      if (!Array.isArray(s.inputs) || !(s.inputs as unknown[]).every(x => typeof x === 'string' && INPUT_NAME_PATTERN.test(x))) {
        fail(`services[${i}].inputs must be an array of ^[a-z0-9_-]+$ strings`);
      }
    }
  }
}

export function validateTicket(obj: unknown): asserts obj is Ticket {
  if (typeof obj !== 'object' || obj === null) fail('ticket must be an object');
  const t = obj as Record<string, unknown>;
  if (t.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    fail(`ticket schemaVersion must be ${CURRENT_SCHEMA_VERSION} (got: ${JSON.stringify(t.schemaVersion)})`);
  }
  if (typeof t.id !== 'string' || t.id.length === 0) fail('ticket.id must be a non-empty string');
  if (t.kind !== 'service' && t.kind !== 'manual') fail(`ticket.kind must be 'service' or 'manual'`);
  if (t.kind === 'manual' && t.service !== undefined) {
    fail('manual tickets must not carry a service field — a manual ticket is never executable');
  }
  if (t.kind === 'service' && (typeof t.service !== 'string' || t.service.length === 0)) {
    fail('service tickets must declare a non-empty service field referencing the catalog');
  }
  const validPriorities: Priority[] = ['low', 'normal', 'high', 'urgent'];
  if (!validPriorities.includes(t.priority as Priority)) fail(`ticket.priority invalid: ${JSON.stringify(t.priority)}`);
  const validStatuses: Status[] = ['backlog', 'waiting', 'running', 'review', 'done', 'failed'];
  if (!validStatuses.includes(t.status as Status)) fail(`ticket.status invalid: ${JSON.stringify(t.status)}`);
  if (typeof t.attempts !== 'number' || t.attempts < 0) fail('ticket.attempts must be a non-negative number');
  if (t.not_before !== undefined && (typeof t.not_before !== 'string' || !ISO_DATE_PATTERN.test(t.not_before))) {
    fail(`ticket.not_before must be an ISO YYYY-MM-DD string: ${JSON.stringify(t.not_before)}`);
  }
  if (!Array.isArray(t.history)) fail('ticket.history must be an array');
  // attempts must equal the number of failed → waiting transitions in history —
  // the field is a derived retry count, not independent state (T-20260917-003).
  const expectedAttempts = (t.history as unknown[]).filter(
    (h) => (h as HistoryEntry).from === 'failed' && (h as HistoryEntry).to === 'waiting',
  ).length;
  if (t.attempts !== expectedAttempts) {
    fail(`ticket.attempts (${t.attempts}) must equal the number of failed → waiting history transitions (${expectedAttempts})`);
  }
  if (t.inputs !== undefined) {
    if (typeof t.inputs !== 'object' || t.inputs === null) fail('ticket.inputs must be an object');
    for (const key of Object.keys(t.inputs as Record<string, unknown>)) {
      if (!INPUT_NAME_PATTERN.test(key)) fail(`ticket.inputs key fails allowlist: ${JSON.stringify(key)}`);
    }
  }
  // Upstream block validation (design 2026-10-01-upstream-request-mcp-design.md §5)
  if (t.upstream !== undefined) {
    if (t.kind !== 'manual') fail('upstream block is allowed only on kind: manual');
    if (t.service !== undefined) fail('upstream tickets must not carry a service field');
    if (t.inputs !== undefined) fail('upstream tickets must not carry inputs');
    if (!/^U-\d{8}-\d{3,4}$/.test(t.id as string)) fail(`upstream ticket id must match U-YYYYMMDD-NNN: ${JSON.stringify(t.id)}`);
    const u = t.upstream as Record<string, unknown>;
    // T-20261002-007 (M2): format checks — project identity, intake version/variant types.
    if (typeof u.project !== 'string' || !/^co-[a-z0-9-]{1,40}$/.test(u.project)) fail(`upstream.project must match ^co-[a-z0-9-]{1,40}$: ${JSON.stringify(u.project)}`);
    if (u.template_version !== undefined && u.template_version !== null && typeof u.template_version !== 'string') fail('upstream.template_version must be a string or null');
    if (u.variant !== undefined && u.variant !== null && typeof u.variant !== 'string') fail('upstream.variant must be a string or null');
    if (u.trust !== 'untrusted') fail('upstream.trust must be "untrusted"');
    if (typeof u.source !== 'string' || !/^project\/[a-z0-9-]+$/.test(u.source)) fail(`upstream.source must match ^project/[a-z0-9-]+$: ${JSON.stringify(u.source)}`);
    if (u.source !== `project/${u.project}`) fail(`upstream.source must equal "project/${u.project}", got "${u.source}"`);
    if (u.suspected_layer !== 'L1' && u.suspected_layer !== 'L2' && u.suspected_layer !== 'unsure') fail(`upstream.suspected_layer must be L1 | L2 | unsure`);
    if (typeof u.symptom !== 'string' || u.symptom.length < 20 || u.symptom.length > 2000) fail('upstream.symptom must be 20-2000 chars');
    if (!Array.isArray(u.affected_paths)) fail('upstream.affected_paths must be an array');
    if (u.affected_paths.length === 0 || u.affected_paths.length > 10) fail('upstream.affected_paths must have 1-10 items');
    for (const p of u.affected_paths as unknown[]) {
      if (typeof p !== 'string' || p.length > 200 || !/^(?!\/)(?!.*\.\.)[A-Za-z0-9._\-\/]+$/.test(p)) {
        fail(`upstream.affected_paths entry fails pattern: ${JSON.stringify(p)}`);
      }
    }
    if (u.local_workaround_diff !== undefined) {
      if (typeof u.local_workaround_diff !== 'string' || u.local_workaround_diff.length > 8000) fail('upstream.local_workaround_diff must be ≤8000 chars');
    }
    if (u.repro !== undefined) {
      if (typeof u.repro !== 'string' || u.repro.length > 2000) fail('upstream.repro must be ≤2000 chars');
    }
    if (u.identity_source !== undefined && !(UPSTREAM_IDENTITY_SOURCES as readonly unknown[]).includes(u.identity_source)) {
      fail(`upstream.identity_source must be one of: ${UPSTREAM_IDENTITY_SOURCES.join(', ')}`);
    }
    if (u.triage !== 'inbox' && u.triage !== 'ready') fail('upstream.triage must be inbox | ready');
    // T-20261002-007 (M2): triage↔status consistency — the store writes them in
    // step, so a file where they disagree is hand-editing or a crashed write.
    const triageStatusConsistent = u.triage === 'inbox'
      ? (t.status === 'backlog' || t.status === 'done')
      : (t.status === 'waiting' || t.status === 'review' || t.status === 'done');
    if (!triageStatusConsistent) {
      fail(`upstream.triage ${JSON.stringify(u.triage)} is inconsistent with status ${JSON.stringify(t.status)} (inbox ⇒ backlog|done; ready ⇒ waiting|review|done)`);
    }
    if (typeof u.flagged !== 'boolean') fail('upstream.flagged must be a boolean');
    if (!Array.isArray(u.triage_reasons)) fail('upstream.triage_reasons must be an array');
    if (typeof u.dedupe_key !== 'string' || u.dedupe_key.length === 0) fail('upstream.dedupe_key must be a non-empty string');
    if (!Array.isArray(u.duplicates)) fail('upstream.duplicates must be an array');
    for (const dup of u.duplicates as unknown[]) {
      if (typeof dup !== 'object' || dup === null) fail('upstream.duplicates entry must be an object');
      const d = dup as Record<string, unknown>;
      if (typeof d.project !== 'string' || d.project.length === 0) fail('upstream.duplicates[].project must be a non-empty string');
      if (typeof d.at !== 'string' || d.at.length === 0) fail('upstream.duplicates[].at must be a non-empty string');
    }
    if (t.status === 'done' && u.resolution === undefined) fail('upstream ticket at status done requires upstream.resolution (T-20261002-007)');
    if (u.resolution !== undefined) {
      if (typeof u.resolution !== 'object' || u.resolution === null) fail('upstream.resolution must be an object');
      const res = u.resolution as Record<string, unknown>;
      const validOutcomes = ['fixed', 'rejected', 'local-only', 'duplicate'];
      if (!validOutcomes.includes(res.outcome as string)) fail(`upstream.resolution.outcome must be one of: ${validOutcomes.join(', ')}`);
      // T-20261002-007 (M2): resolution shape — summary required, https pr_url, string template_version.
      if (typeof res.summary !== 'string' || (res.summary as string).trim() === '') fail('upstream.resolution.summary must be a non-empty string');
      if (res.pr_url !== undefined && (typeof res.pr_url !== 'string' || !/^https:\/\/\S+$/.test(res.pr_url))) {
        fail('upstream.resolution.pr_url must be an https URL');
      }
      if (res.template_version !== undefined && (typeof res.template_version !== 'string' || (res.template_version as string).trim() === '')) {
        fail('upstream.resolution.template_version must be a non-empty string');
      }
    }
  }
}
