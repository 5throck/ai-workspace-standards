/**
 * Pure-helper suites for the sync-overwrite-policy delivery-decision engine
 * (T-20261030-002 — spec docs/designs/2026-10-31-test-budget-split-design.md,
 * stage 1 of 2): extracted verbatim from
 * tests/unit/upgrade-decision-log.test.ts v1.4.0 so the engine suites' budget
 * blast radius (scripts/test-runner.ts FILE_TIME_BUDGETS) can never drag the
 * pure helpers again. Engine growth no longer re-runs these suites' cost.
 *
 * Coverage (unchanged from the source suites):
 * - upgrade-policy decision-log helpers (sync-overwrite-policy): D1
 *   classification (classifyProjectState), baselineKeyFor lifecycleless
 *   keys, the DECISION_SEVERITY_CONTRACT, tombstoneGuard (B1 regression),
 *   resolveDisposition (ERROR default-skip / adopt flip / EVOLVED deliver),
 *   globToRegExp anchoring + the a-doublestar-slash-b zero-segment
 *   semantics (T-20261028-002), manifestHasUnresolvedErrors, and isDeliveredDiff
 *   v1/v2 manifest compatibility.
 * - backfillStubFrontmatter (T-20261028-010 stub FM backfill): the pure
 *   scalar-backfill contract (fill from counterpart + delivery date,
 *   byte-identical no-op, non-stub ownership guard, body preservation,
 *   CRLF, invalid delivery date).
 *
 * All assertions are byte-verbatim from tests/unit/upgrade-decision-log.test.ts
 * v1.4.0 (the extraction moves describes, never expectations).
 *
 * @version 1.3.0 (2026-11-12: overwrite-protection PR-B — E3 resolveEqualVersionDisposition table, vintage UNBASELINED row, PROJECT_AHEAD verdict, E4 pendingKindForDecision / mergePendingBackport)
 * v1.2.0 (2026-11-11: overwrite-protection PR-A — E1 EVOLVED_PRESERVE verdict matrix, E2 marker counting/markerLoss, supersetCheck)
 * v1.1.0 (2026-11-11: resolveUnbaselinedDisposition four-cell matrix + new verdict severities — T-20261110-009/012)
 */
import { describe, test, expect } from 'bun:test';

import {
  DECISION_SEVERITY_CONTRACT,
  backfillStubFrontmatter,
  baselineKeyFor,
  LOCAL_PATCH_MARKER_RE,
  classifyProjectState,
  countLocalPatchMarkers,
  globToRegExp,
  isDeliveredDiff,
  lifecyclelessText,
  manifestHasUnresolvedErrors,
  markerLoss,
  markerLossDetail,
  mergePendingBackport,
  pendingKindForDecision,
  resolveDisposition,
  resolveEqualVersionDisposition,
  resolveUnbaselinedDisposition,
  sha256Hex,
  supersetCheck,
  tombstoneGuard,
  type DecisionBaseline,
  type PendingBackportEntry,
  type ProjectStateVerdict,
} from '../../scripts/lib/upgrade-policy.ts';

/** The L1 file whose co-design deletion is the U-001 resurrection vector —
 *  the tombstoneGuard pin targets it (same rel as the engine suites). */
const WORKFLOWS_REL = 'docs/governance/agents/workflows.md';

// ═════════════════════════════════════════════════════════════════════════════
// Pure helpers (D1 classification, D2 disposition, D3 severity contract)
// ═════════════════════════════════════════════════════════════════════════════
describe('upgrade-policy decision-log helpers (sync-overwrite-policy)', () => {
  const project = 'project bytes\n';
  const deliverable = 'template bytes v2\n';
  const baselineOf = (content: string): DecisionBaseline => ({ hash: sha256Hex(content), templateVersion: '0.20.1' });

  test('classifyProjectState: UNTOUCHED / IN_SYNC / PROJECT_EVOLVED / NO_BASELINE', () => {
    const base = baselineOf('delivered bytes\n');
    // Project content == delivered baseline → UNTOUCHED.
    const untouched = classifyProjectState('docs/x.md', 'delivered bytes\n', deliverable, base);
    expect(untouched.state).toBe('UNTOUCHED');
    expect(untouched.templateChanged).toBe(true); // today's deliverable differs from the baseline
    // Project already equals today's deliverable → IN_SYNC (no clobber possible).
    const inSync = classifyProjectState('docs/x.md', deliverable, deliverable, base);
    expect(inSync.state).toBe('IN_SYNC');
    expect(inSync.matchesDeliverable).toBe(true);
    // Project differs from both baseline and deliverable → PROJECT_EVOLVED.
    const evolved = classifyProjectState('docs/x.md', project, deliverable, base);
    expect(evolved.state).toBe('PROJECT_EVOLVED');
    expect(evolved.templateChanged).toBe(true);
    // No baseline → degrade (first run after the policy lands).
    const noBaseline = classifyProjectState('docs/x.md', project, deliverable, undefined);
    expect(noBaseline.state).toBe('NO_BASELINE');
    expect(noBaseline.templateChanged).toBe(false);
  });

  test('classifyProjectState: template-unchanged evolution reports templateChanged=false', () => {
    // Baseline == today's deliverable (template content unchanged since delivery).
    const base = baselineOf(deliverable);
    const evolved = classifyProjectState('docs/x.md', project, deliverable, base);
    expect(evolved.state).toBe('PROJECT_EVOLVED');
    expect(evolved.templateChanged).toBe(false);
  });

  test('baselineKeyFor: raw bytes for plain files, lifecycleless bytes for agents/', () => {
    expect(baselineKeyFor('docs/x.md', 'a\n')).toBe(sha256Hex('a\n'));
    const withLifecycle = '---\nname: x\nversion: 1.0.0\nlifecycle:\n  phase: production\nlast_updated: 2026-01-01\n---\nbody\n';
    const withNewDate = withLifecycle.replace('2026-01-01', '2026-10-27');
    // The agents/ key ignores the lifecycle block and the re-stamped date.
    expect(baselineKeyFor('agents/x.md', withLifecycle)).toBe(baselineKeyFor('agents/x.md', withNewDate));
    expect(baselineKeyFor('agents/x.md', withLifecycle)).toBe(sha256Hex(lifecyclelessText(withLifecycle)));
  });

  test('DECISION_SEVERITY_CONTRACT: ERROR/WARN/INFO assignments (design §7)', () => {
    expect(DECISION_SEVERITY_CONTRACT.CONFLICT).toBe('ERROR');
    expect(DECISION_SEVERITY_CONTRACT.EVOLVED).toBe('WARN');
    expect(DECISION_SEVERITY_CONTRACT.DRIFT_PRESERVE).toBe('WARN');
    expect(DECISION_SEVERITY_CONTRACT.SKELETON_COLLISION).toBe('WARN');
    expect(DECISION_SEVERITY_CONTRACT.SEED_SKIP).toBe('INFO');
    expect(DECISION_SEVERITY_CONTRACT.STUB_SKIP).toBe('INFO');
    expect(DECISION_SEVERITY_CONTRACT.ADOPT).toBe('INFO');
    // v1.31.0 verdicts (2026-10-29-delivery-bookkeeping-engine B1/D1): both
    // INFO — a retraction is expected mechanics and a pinned stub version is
    // sanctioned divergence (WARN would fire on every legitimate pin).
    expect(DECISION_SEVERITY_CONTRACT.TOMBSTONE_CLEARED).toBe('INFO');
    expect(DECISION_SEVERITY_CONTRACT.STUB_VERSION_DIVERGENCE).toBe('INFO');
  });

  test('tombstoneGuard: no fire for a path whose entries were cleared (B1 regression)', () => {
    // The clear grant drops matching tombstones AND carried-forward baselines
    // (94a390945) — with both gone the D2 fire condition
    // `absent && (tombstones[rel] || baselines[rel])` cannot fire, so the next
    // run delivers the path as a clean NEW.
    const cleared = { tombstones: {}, baselines: {} };
    expect(tombstoneGuard(WORKFLOWS_REL, cleared, true).fires).toBe(false);
    // The catch-22 the baseline drop prevents: a retained baseline re-fires
    // TOMBSTONED (ERROR) on the next run.
    const baselineOnly = { tombstones: {}, baselines: { [WORKFLOWS_REL]: { hash: 'h', templateVersion: '0.0.0' } } };
    const fired = tombstoneGuard(WORKFLOWS_REL, baselineOnly, true);
    expect(fired.fires).toBe(true);
    expect(fired.verdict).toBe('TOMBSTONED');
    expect(fired.severity).toBe('ERROR');
  });

  test('resolveDisposition: ERROR default-skip, adopt flip, EVOLVED_PRESERVE skip, non-evolved pass-through', () => {
    const evolvedChanged = { state: 'PROJECT_EVOLVED' as const, matchesDeliverable: false, templateChanged: true };
    const evolvedUnchanged = { state: 'PROJECT_EVOLVED' as const, matchesDeliverable: false, templateChanged: false };
    // Default: CONFLICT (ERROR), delivery skipped.
    const def = resolveDisposition(evolvedChanged, 'docs/x.md', { mode: 'default' });
    expect(def.deliver).toBe(false);
    expect(def.verdict).toBe('CONFLICT');
    expect(def.severity).toBe('ERROR');
    // Explicit adopt-template: deliver + ADOPT (INFO).
    const adopted = resolveDisposition(evolvedChanged, 'docs/x.md', { mode: 'adopt-template', matches: () => true });
    expect(adopted).toEqual({ deliver: true, verdict: 'ADOPT', severity: 'INFO', detail: expect.any(String) });
    // Glob narrowing: only matching paths adopt.
    const narrowed = resolveDisposition(evolvedChanged, 'docs/x.md', {
      mode: 'adopt-template', matches: (rel) => globToRegExp('docs/other.md').test(rel),
    });
    expect(narrowed.deliver).toBe(false);
    // Template content unchanged → E1 (DEC-20261111-01 D1): EVOLVED_PRESERVE (WARN), SKIP.
    const unchanged = resolveDisposition(evolvedUnchanged, 'docs/x.md', { mode: 'default' });
    expect(unchanged.deliver).toBe(false);
    expect(unchanged.verdict).toBe('EVOLVED_PRESERVE');
    expect(unchanged.severity).toBe('WARN');
    // Non-evolved states pass through (the caller logs its own verdict).
    const untouched = resolveDisposition({ state: 'UNTOUCHED', matchesDeliverable: false, templateChanged: true }, 'docs/x.md', { mode: 'default' });
    expect(untouched.deliver).toBe(true);
  });

  test('globToRegExp: **, *, ? with anchoring', () => {
    expect(globToRegExp('docs/**').test('docs/a/b.md')).toBe(true);
    expect(globToRegExp('docs/**').test('agents/a.md')).toBe(false);
    expect(globToRegExp('docs/*.md').test('docs/a.md')).toBe(true);
    expect(globToRegExp('docs/*.md').test('docs/sub/a.md')).toBe(false);
    expect(globToRegExp('docs/?.md').test('docs/a.md')).toBe(true);
    expect(globToRegExp('docs/?.md').test('docs/ab.md')).toBe(false);
  });

  test('globToRegExp: /**/ zero-segment semantics (T-20261028-002)', () => {
    // a/**/b must match a/b (zero intermediate segments) and any depth below.
    expect(globToRegExp('a/**/b').test('a/b')).toBe(true);
    expect(globToRegExp('a/**/b').test('a/x/b')).toBe(true);
    expect(globToRegExp('a/**/b').test('a/x/y/b')).toBe(true);
    expect(globToRegExp('a/**/b').test('a/x/c')).toBe(false);
    // leading **/ matches top level.
    expect(globToRegExp('**/b').test('b')).toBe(true);
    expect(globToRegExp('**/b').test('x/b')).toBe(true);
    // trailing /** and bare ** keep the pre-1.26.0 semantics.
    expect(globToRegExp('a/**').test('a/x/y')).toBe(true);
    expect(globToRegExp('**').test('anything/at/all')).toBe(true);
  });

  test('manifestHasUnresolvedErrors: v2 with ERROR → true; clean v2 and v1 → false', () => {
    expect(manifestHasUnresolvedErrors({
      schemaVersion: 2, files: [], baselines: {},
      decisions: [{ path: 'a', policy: 'SYNC', pass: 'P', verdict: 'CONFLICT', severity: 'ERROR', detail: 'x' }],
    })).toBe(true);
    expect(manifestHasUnresolvedErrors({
      schemaVersion: 2, files: [], baselines: {},
      decisions: [{ path: 'a', policy: 'SYNC', pass: 'P', verdict: 'ADOPT', severity: 'INFO', detail: 'x' }],
    })).toBe(false);
    // v1-shaped manifest: no decisions key at all.
    expect(manifestHasUnresolvedErrors({ timestamp: '...', files: ['a'] })).toBe(false);
    expect(manifestHasUnresolvedErrors(null)).toBe(false);
    expect(manifestHasUnresolvedErrors('garbage')).toBe(false);
  });

  test('isDeliveredDiff accepts v1 and v2 manifest shapes (files array is the contract)', () => {
    const changed = ['docs/a.md', 'CHANGELOG.md', 'memory/2026-10-27.md'];
    const v1 = { timestamp: 't', files: ['docs/a.md'] };
    const v2 = {
      schemaVersion: 2, timestamp: 't', project: 'p', templateVersion: '1', templateSha: 's', baseSha: 'b',
      files: ['docs/a.md'], baselines: { 'docs/a.md': { hash: 'h', templateVersion: '1' } }, decisions: [],
    };
    expect(isDeliveredDiff(changed, v1.files)).toBe(true);
    expect(isDeliveredDiff(changed, JSON.parse(JSON.stringify(v2)).files)).toBe(true);
    expect(isDeliveredDiff(['docs/other.md'], v2.files)).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Stub frontmatter scalar backfill (T-20261028-010 — spec
// docs/designs/2026-10-28-stub-frontmatter-backfill-design.md)
// ═════════════════════════════════════════════════════════════════════════════
describe('backfillStubFrontmatter (T-20261028-010 stub FM backfill)', () => {
  const DATE = '2026-10-28';
  // The variant-stub counterpart shape (templates/<variant>/agents/pm.md):
  // scalar tier, quoted version, its own authoring last_updated.
  const counterpart = [
    '---',
    'extends: ../../common/agents/pm.md',
    'name: pm',
    'version: "2.1.0"',
    'last_updated: "2026-10-27"',
    'status: active',
    'tier: medium',
    'model: inherit',
    '---',
    '',
    'Stub-pointer body — project-owned, never touched.',
    '',
  ].join('\n');
  const BODY = '\nFixture stub body line that stays project-owned.\n';

  test('all three missing → tier/version from the counterpart, last_updated = delivery date, INFO contract row', () => {
    const stub = `---\nextends: ../../../agents/pm.md\nname: pm\nstatus: active\n---${BODY}`;
    const out = backfillStubFrontmatter(stub, counterpart, DATE);
    expect(out.changed).toBe(true);
    expect(out.filled).toEqual(['tier', 'version', 'last_updated']);
    expect(out.content).toContain('tier: medium');
    expect(out.content).toContain('version: "2.1.0"');
    // last_updated is the DELIVERY date, not the counterpart's authoring date.
    expect(out.content).toContain(`last_updated: ${DATE}`);
    expect(out.content).not.toContain('2026-10-27');
    // Body bytes unchanged; existing frontmatter keys not reordered.
    expect(out.content.endsWith(`---\nextends: ../../../agents/pm.md\nname: pm\nstatus: active\ntier: medium\nversion: "2.1.0"\nlast_updated: ${DATE}\n---${BODY}`)).toBe(true);
    expect(DECISION_SEVERITY_CONTRACT.STUB_FM_BACKFILL).toBe('INFO');
  });

  test('all fields present → byte-identical no-op (no write, no row)', () => {
    const stub = `---\nextends: ../../../agents/pm.md\nname: pm\nversion: "2.0.1"\nlast_updated: "2026-08-28"\nstatus: active\ntier: medium\n---${BODY}`;
    const out = backfillStubFrontmatter(stub, counterpart, DATE);
    expect(out).toEqual({ content: stub, changed: false, filled: [] });
  });

  test('non-stub content (no extends:) is never touched — helper-level ownership guard', () => {
    const resolved = `---\nname: pm\nstatus: active\nversion: "1.0.0"\ntier: medium\n---${BODY}`;
    const missingTier = `---\nname: pm\nstatus: active\n---${BODY}`;
    expect(backfillStubFrontmatter(resolved, counterpart, DATE)).toEqual({ content: resolved, changed: false, filled: [] });
    expect(backfillStubFrontmatter(missingTier, counterpart, DATE)).toEqual({ content: missingTier, changed: false, filled: [] });
  });

  test('body bytes unchanged in every case; partial absence fills only the missing keys', () => {
    const hasVersion = `---\nextends: ../../../agents/pm.md\nname: pm\nversion: "2.0.1"\nstatus: active\n---${BODY}`;
    const out = backfillStubFrontmatter(hasVersion, counterpart, DATE);
    expect(out.changed).toBe(true);
    expect(out.filled).toEqual(['tier', 'last_updated']);
    expect(out.content.endsWith(BODY)).toBe(true);
    expect(out.content).not.toContain('version: "2.1.0"'); // existing value untouched
    // A map-form or absent template tier side fills nothing (never invent structure).
    const noTierCounterpart = counterpart.replace('\ntier: medium', '');
    const tierMissing = `---\nextends: ../../../agents/pm.md\nname: pm\nstatus: active\n---${BODY}`;
    const out2 = backfillStubFrontmatter(tierMissing, noTierCounterpart, DATE);
    expect(out2.filled).toEqual(['version', 'last_updated']);
    expect(out2.content.endsWith(BODY)).toBe(true);
    // Empty-value tier key is treated as present (v1.24.0 contract: never invent structure).
    const emptyTier = `---\nextends: ../../../agents/pm.md\nname: pm\nversion: "2.0.1"\nlast_updated: "2026-08-28"\ntier:\nstatus: active\n---${BODY}`;
    expect(backfillStubFrontmatter(emptyTier, counterpart, DATE).content).toBe(emptyTier);
  });

  test('CRLF stubs stay CRLF; invalid delivery date leaves last_updated unfilled', () => {
    const stub = '---\r\nextends: ../../../agents/pm.md\r\nname: pm\r\nstatus: active\r\n---\r\n\r\nCRLF body.\r\n';
    const out = backfillStubFrontmatter(stub, counterpart.replace(/\n/g, '\r\n'), DATE);
    expect(out.changed).toBe(true);
    expect(out.filled).toEqual(['tier', 'version', 'last_updated']);
    expect(out.content).toContain('tier: medium\r\nversion: "2.1.0"\r\nlast_updated: 2026-10-28\r\n');
    expect(out.content.endsWith('---\r\n\r\nCRLF body.\r\n')).toBe(true);
    const badDate = backfillStubFrontmatter(stub, counterpart, '2026-10-28T00:00:00Z');
    expect(badDate.filled).toEqual(['tier', 'version']);
    expect(badDate.content).not.toContain('last_updated:');
  });
});

describe('resolveUnbaselinedDisposition (T-20261110-009 A1 — marker x adopt-grant)', () => {
  const none = { mode: 'default' as const };
  const adopt = { mode: 'adopt-template' as const, matches: () => true };
  test('marked, no grant → CONFLICT (ERROR), no delivery', () => {
    const o = resolveUnbaselinedDisposition('docs/x.md', true, none);
    expect([o.deliver, o.verdict, o.severity]).toEqual([false, 'CONFLICT', 'ERROR']);
  });
  test('marked, adopt grant → ADOPT (INFO), deliver', () => {
    const o = resolveUnbaselinedDisposition('docs/x.md', true, adopt);
    expect([o.deliver, o.verdict, o.severity]).toEqual([true, 'ADOPT', 'INFO']);
  });
  test('unmarked, no grant → UNBASELINED_OVERWRITE (WARN), deliver', () => {
    const o = resolveUnbaselinedDisposition('docs/x.md', false, none);
    expect([o.deliver, o.verdict, o.severity]).toEqual([true, 'UNBASELINED_OVERWRITE', 'WARN']);
  });
  test('unmarked, adopt grant → ADOPT (INFO), deliver', () => {
    const o = resolveUnbaselinedDisposition('docs/x.md', false, adopt);
    expect([o.deliver, o.verdict, o.severity]).toEqual([true, 'ADOPT', 'INFO']);
  });
  test('new verdict severities (T-20261110-009/012)', () => {
    expect(DECISION_SEVERITY_CONTRACT.UNBASELINED_OVERWRITE).toBe('WARN');
    expect(DECISION_SEVERITY_CONTRACT.UNVERSIONED_SKIP).toBe('WARN');
    expect(DECISION_SEVERITY_CONTRACT.BEHAVIOR_REGRESSION).toBe('ERROR');
    expect(DECISION_SEVERITY_CONTRACT.VERIFY_SKIPPED).toBe('INFO');
  });
});

describe('E1 EVOLVED_PRESERVE verdict matrix (DEC-20261111-01 D1, design §4.2)', () => {
  const none = { mode: 'default' as const };
  const adopt = { mode: 'adopt-template' as const, matches: () => true };
  const narrow = { mode: 'adopt-template' as const, matches: (rel: string) => rel === 'docs/other.md' };
  const cell = (state: 'UNTOUCHED' | 'IN_SYNC' | 'PROJECT_EVOLVED' | 'NO_BASELINE', templateChanged: boolean) =>
    ({ state, matchesDeliverable: state === 'IN_SYNC', templateChanged });

  test('PROJECT_EVOLVED + template unchanged + no grant → EVOLVED_PRESERVE (WARN), SKIP', () => {
    const o = resolveDisposition(cell('PROJECT_EVOLVED', false), 'docs/x.md', none);
    expect([o.deliver, o.verdict, o.severity]).toEqual([false, 'EVOLVED_PRESERVE', 'WARN']);
    expect(o.detail).toContain('baseline kept');
  });
  test('PROJECT_EVOLVED + template unchanged + adopt grant → ADOPT (INFO), deliver', () => {
    const o = resolveDisposition(cell('PROJECT_EVOLVED', false), 'docs/x.md', adopt);
    expect([o.deliver, o.verdict, o.severity]).toEqual([true, 'ADOPT', 'INFO']);
  });
  test('a glob grant that does not cover the path still preserves', () => {
    const o = resolveDisposition(cell('PROJECT_EVOLVED', false), 'docs/x.md', narrow);
    expect([o.deliver, o.verdict]).toEqual([false, 'EVOLVED_PRESERVE']);
  });
  test('PROJECT_EVOLVED + template changed: CONFLICT (ERROR) SKIP unchanged; adopt grant → ADOPT', () => {
    const c = resolveDisposition(cell('PROJECT_EVOLVED', true), 'docs/x.md', none);
    expect([c.deliver, c.verdict, c.severity]).toEqual([false, 'CONFLICT', 'ERROR']);
    const a = resolveDisposition(cell('PROJECT_EVOLVED', true), 'docs/x.md', adopt);
    expect([a.deliver, a.verdict, a.severity]).toEqual([true, 'ADOPT', 'INFO']);
  });
  test.each(['UNTOUCHED', 'IN_SYNC', 'NO_BASELINE'] as const)('%s passes through (caller row, deliver)', (state) => {
    for (const changed of [true, false]) {
      const o = resolveDisposition(cell(state, changed), 'docs/x.md', none);
      expect([o.deliver, o.verdict, o.severity]).toEqual([true, 'UPDATE', 'INFO']);
    }
  });
  test('verdict severities: EVOLVED_PRESERVE WARN, MARKER_LOSS ERROR (joins the D3.1 ERROR set)', () => {
    expect(DECISION_SEVERITY_CONTRACT.EVOLVED_PRESERVE).toBe('WARN');
    expect(DECISION_SEVERITY_CONTRACT.MARKER_LOSS).toBe('ERROR');
    expect(manifestHasUnresolvedErrors({ decisions: [{ severity: DECISION_SEVERITY_CONTRACT.MARKER_LOSS }] })).toBe(true);
    expect(manifestHasUnresolvedErrors({ decisions: [{ severity: DECISION_SEVERITY_CONTRACT.EVOLVED_PRESERVE }] })).toBe(false);
  });
  test('classifier regression: a project-only edit with an unchanged template is PROJECT_EVOLVED/templateChanged=false', () => {
    // co-deck decisions/gates.yaml shape: baseline = template bytes; project added a gate.
    const tpl = 'gates:\n  - id: G1\n';
    const base = { hash: sha256Hex(tpl), templateVersion: '0.0.0' };
    const v = classifyProjectState('decisions/gates.yaml', `${tpl}  - id: DG-DECK-06\n`, tpl, base);
    expect(v.state).toBe('PROJECT_EVOLVED');
    expect(v.templateChanged).toBe(false);
    expect(resolveDisposition(v, 'decisions/gates.yaml', none).verdict).toBe('EVOLVED_PRESERVE');
  });
});

describe('E2 LOCAL-PATCH marker recognition and marker-loss predicate (DEC-20261111-01 D4, design §4.3)', () => {
  const FORMS = [
    '/* LOCAL-PATCH(upstream-request: U-20261105-004) */',
    '/* LOCAL-PATCH (design: DG-DECK-06 Pretendard fallback) */',
    '# LOCAL-PATCH(project-local): extra CI leg',
    '<!-- LOCAL-PATCH U-20261108-002 -->',
  ];
  test.each(FORMS)('every marker form is recognized and counted: %s', (form) => {
    expect(LOCAL_PATCH_MARKER_RE.test(`before\n${form}\nafter`)).toBe(true);
    expect(countLocalPatchMarkers(`a\n${form}\nb`)).toBe(1);
  });
  test('count is per occurrence across forms; unmarked text counts 0', () => {
    expect(countLocalPatchMarkers(FORMS.join('\n'))).toBe(4);
    expect(countLocalPatchMarkers('plain text, no markers\n')).toBe(0);
    // word boundary: a longer token is not a marker
    expect(countLocalPatchMarkers('LOCAL-PATCHES are discussed here')).toBe(0);
  });
  test('markerLoss is null when the count is preserved or grows', () => {
    expect(markerLoss(`x\n${FORMS[0]}\n`, `y\n${FORMS[1]}\n`)).toBeNull(); // replacement keeps the count (documented coarseness)
    expect(markerLoss('x\n', `y\n${FORMS[0]}\n`)).toBeNull();
    expect(markerLoss('', '')).toBeNull();
  });
  test('markerLoss reports the delta when the count drops', () => {
    expect(markerLoss(FORMS.join('\n'), FORMS[0])).toEqual({ lost: 3, before: 4, after: 1 });
    expect(markerLoss(FORMS[2], 'template without markers\n')).toEqual({ lost: 1, before: 1, after: 0 });
  });
  test('template prose that mentions the term loses nothing (count-delta, not presence)', () => {
    const prose = 'Mark patches with `LOCAL-PATCH(upstream-request: <id>)`. LOCAL-PATCH also appears here. LOCAL-PATCH thrice.';
    expect(markerLoss(prose, prose)).toBeNull();
    // a project copy with one extra real marker loses exactly one
    expect(markerLoss(`${prose}\n${FORMS[1]}`, prose)).toEqual({ lost: 1, before: 4, after: 3 });
  });
  test('markerLossDetail names the counts and the override', () => {
    const d = markerLossDetail({ lost: 2, before: 3, after: 1 });
    expect(d).toContain('3 → 1');
    expect(d).toContain('MARKER_LOSS');
    expect(d).toContain('--disposition adopt-template');
  });
  test('A1: every marker form flips an unbaselined divergence to CONFLICT (ERROR)', () => {
    for (const form of FORMS) {
      const marked = LOCAL_PATCH_MARKER_RE.test(form);
      const o = resolveUnbaselinedDisposition('docs/x.md', marked, { mode: 'default' });
      expect([o.deliver, o.verdict, o.severity]).toEqual([false, 'CONFLICT', 'ERROR']);
    }
  });
});

describe('E1 supersetCheck (the automated half of audit remedy R8)', () => {
  test('passes when the deliverable carries every project-authored line', () => {
    const base = 'a\nb\n';
    const project = 'a\nb\nproject line\n';
    const deliverable = 'a\nb\nproject line\ntemplate extra\n';
    expect(supersetCheck(project, [base], deliverable)).toEqual({ ok: true, missing: [] });
  });
  test('fails and names the project-authored lines the deliverable lacks (U-20261105-004 false "fixed" shape)', () => {
    const base = 'a\nb\n';
    const project = 'a\nb\npatch hunk 1\npatch hunk 2\n';
    const r = supersetCheck(project, [base], 'a\nb\n');
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['patch hunk 1', 'patch hunk 2']);
  });
  test('lines present in any base text are not project-authored; blank lines and CRLF are ignored', () => {
    const r = supersetCheck('a\r\n\r\nold vintage line\r\n', ['old vintage line\n', 'a\n'], 'a\n');
    expect(r.ok).toBe(true);
  });
  test('without any base every non-blank project line is project-authored', () => {
    expect(supersetCheck('x\ny\n', [], 'x\n')).toEqual({ ok: false, missing: ['y'] });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PR-B: E3 equal-version resolver, vintage row, PROJECT_AHEAD, E4 pending writer rule
// ═════════════════════════════════════════════════════════════════════════════
describe('E3 resolveEqualVersionDisposition (design §4.4 table)', () => {
  const cls = (state: ProjectStateVerdict['state']): ProjectStateVerdict => ({
    state,
    matchesDeliverable: false,
    templateChanged: state === 'UNTOUCHED',
  });
  test('baseline-untouched provenance: DRIFT_RESTORED at INFO, restore', () => {
    const o = resolveEqualVersionDisposition(cls('UNTOUCHED'), 'baseline', false);
    expect([o.deliver, o.verdict, o.severity]).toEqual([true, 'DRIFT_RESTORED', 'INFO']);
  });
  test('vintage provenance (any state): DRIFT_RESTORED at INFO, restore — the cdf316143 suppress rule', () => {
    for (const st of ['NO_BASELINE', 'PROJECT_EVOLVED'] as const) {
      const o = resolveEqualVersionDisposition(cls(st), 'vintage', false);
      expect([o.deliver, o.verdict, o.severity]).toEqual([true, 'DRIFT_RESTORED', 'INFO']);
      expect(o.detail).toContain('vintage');
    }
  });
  test('no provenance, PROJECT_EVOLVED or NO_BASELINE, no grant: CONFLICT (ERROR), SKIP', () => {
    for (const st of ['NO_BASELINE', 'PROJECT_EVOLVED'] as const) {
      const o = resolveEqualVersionDisposition(cls(st), 'none', false);
      expect([o.deliver, o.verdict, o.severity]).toEqual([false, 'CONFLICT', 'ERROR']);
    }
  });
  test('no provenance with an adopt grant: ADOPT (INFO), restore', () => {
    const o = resolveEqualVersionDisposition(cls('PROJECT_EVOLVED'), 'none', true);
    expect([o.deliver, o.verdict, o.severity]).toEqual([true, 'ADOPT', 'INFO']);
  });
});

describe('E3 resolveUnbaselinedDisposition vintage row', () => {
  const none = { mode: 'default' } as const;
  test('vintage-proven, no grant: ADOPT (INFO) — even when the copy carries a marker', () => {
    for (const marked of [false, true]) {
      const o = resolveUnbaselinedDisposition('x.css', marked, none, true);
      expect([o.deliver, o.verdict, o.severity]).toEqual([true, 'ADOPT', 'INFO']);
      expect(o.detail).toContain('vintage-proven');
    }
  });
  test('non-vintage rows are unchanged: unmarked WARN-deliver, marked CONFLICT-skip', () => {
    expect(resolveUnbaselinedDisposition('x.css', false, none, false).verdict).toBe('UNBASELINED_OVERWRITE');
    expect(resolveUnbaselinedDisposition('x.css', true, none).verdict).toBe('CONFLICT');
  });
});

describe('E3/E4 PROJECT_AHEAD verdict and pending writer rule', () => {
  test('PROJECT_AHEAD is WARN in the severity contract', () => {
    expect(DECISION_SEVERITY_CONTRACT.PROJECT_AHEAD).toBe('WARN');
  });
  test('pendingKindForDecision maps the gate-set verdicts; WARN CONFLICT and others are not candidates', () => {
    expect(pendingKindForDecision('PROJECT_AHEAD', 'WARN')).toBe('PROJECT_AHEAD');
    expect(pendingKindForDecision('EVOLVED_PRESERVE', 'WARN')).toBe('EVOLVED_PRESERVE');
    expect(pendingKindForDecision('UNBASELINED_OVERWRITE', 'WARN')).toBe('UNBASELINED');
    expect(pendingKindForDecision('MARKER_LOSS', 'ERROR')).toBe('MARKER_LOSS');
    expect(pendingKindForDecision('CONFLICT', 'ERROR')).toBe('CONFLICT');
    expect(pendingKindForDecision('CONFLICT', 'WARN')).toBeNull();
    expect(pendingKindForDecision('DRIFT_RESTORED', 'INFO')).toBeNull();
    expect(pendingKindForDecision('ADOPT', 'INFO')).toBeNull();
  });
  test('mergePendingBackport carries firstSeen forward while pending, stamps new paths, drops departed ones, sorts, dedups', () => {
    const prior: PendingBackportEntry[] = [
      { path: 'a.ts', kind: 'PROJECT_AHEAD', projectHash: 'h1', firstSeen: '2026-01-02', firstSeenTemplateVersion: '0.20.0' },
      { path: 'gone.ts', kind: 'CONFLICT', projectHash: 'h2', firstSeen: '2026-01-03', firstSeenTemplateVersion: '0.20.0' },
    ];
    const out = mergePendingBackport(
      [
        { path: 'z.ts', kind: 'EVOLVED_PRESERVE', projectHash: 'h3' },
        { path: 'a.ts', kind: 'PROJECT_AHEAD', projectHash: 'h1b', projectVersion: '2.0.0', templateVersion: '1.0.0' },
        { path: 'a.ts', kind: 'MARKER_LOSS', projectHash: 'dup' },
      ],
      prior,
      '2026-11-12',
      '0.30.0',
    );
    expect(out.map((e) => e.path)).toEqual(['a.ts', 'z.ts']);
    expect(out[0]).toMatchObject({ kind: 'PROJECT_AHEAD', projectHash: 'h1b', firstSeen: '2026-01-02', firstSeenTemplateVersion: '0.20.0' });
    expect(out[1]).toMatchObject({ firstSeen: '2026-11-12', firstSeenTemplateVersion: '0.30.0' });
    expect(mergePendingBackport([], prior, '2026-11-12', '0.30.0')).toEqual([]);
  });
});
