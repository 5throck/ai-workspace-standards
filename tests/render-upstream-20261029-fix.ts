// One-shot (T-20261029-001): re-render corrupted result + upstream.resolution.summary
// fields on the eight U-20261028 tickets whose prose was mangled by the PM's
// nested-shell-interpolation resolve command (fragments like "((((((( [ 008 = 020 ]").
// Clean summaries are hardcoded here — never interpolate shell output into ticket prose.
// Run: bun tests/render-upstream-20261029-fix.ts [--apply]  (dry-run default)
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

const PREFIX = 'Fixed in the upstream-adjudication mechanical batch (design docs/designs/2026-10-29-upstream-adjudication-mechanical-batch-design.md, registered implemented): ';
const SUMMARIES: Record<string, string> = {
  '008': 'COMMON-AGENTS delivery sentence qualified as workspace-root contract + B-A14 transform (qualification + §3.7.5 L0-only link stripped in L1 renditions); all 14 variant AGENTS.md re-injected.',
  '009': 'regenerate-agents-md v1.4.0 — VARIANT-PHASE-GATE now emits header+separator rows; empty phases render Phase —; co-abap AGENTS.md regenerated in place.',
  '010': 'context.md Standard Root Files gains CODEX.md + HERMES.md (single hand-maintained source; no L0 docs/context.md exists).',
  '011': 'skill-lifecycle-audit v1.9.0 — LC/MV block moved out of the IS_WORKSPACE_ROOT gate; delivered projects now report lifecycle-record gaps honestly.',
  '015': 'templates/co-abap install-vsp v1.2.0 — SAP_PASSWORD export guidance replaced with .env chmod 600 / keychain wording; re-delivery clears the project LOCAL-PATCH.',
  '017': 'co-safety audit-variant v1.2.0 — gate 0 parses skill_manifest.variant_specific, JSON.parse guarded, normalized path used; 4/4 skills resolve.',
  '018': 'pre-push v1.7.0 — gitleaks gains --config .gitleaks.toml under existsSync (pre-commit guard shape); the U-004 rider sentence (custom patterns belong in .gitleaks.toml) added to the hook header.',
  '020': 'ci.yml audit-job comment/guard states the dependency posture honestly for non-root-package layouts.',
};
const apply = process.argv.includes('--apply');
for (const [n, clean] of Object.entries(SUMMARIES)) {
  const p = `tickets/governance/U-20261028-${n}.yaml`;
  const raw = readFileSync(p, 'utf-8');
  const t = Bun.YAML.parse(raw);
  const res = `${PREFIX}${clean}`;
  const badRes = /\[ 0[0-9]+ =|\(\(\(\(\(\(\(/.test(t.result ?? '');
  const badSum = /\[ 0[0-9]+ =|\(\(\(\(\(\(\(/.test(t.upstream?.resolution?.summary ?? '');
  if (!badRes && !badSum) { console.log(`U-${n}: clean, skip`); continue; }
  console.log(`U-${n}: ${badRes ? 'result ' : ''}${badSum ? 'resolution.summary ' : ''}corrupt → re-render (${res.length} chars)`);
  if (!apply) continue;
  t.result = res;
  t.upstream.resolution.summary = res;
  // serialize: yaml stringify, keep key order via original text splice where possible
  // (simplest robust form: full yaml dump — the schema is flat, no comments in these files)
  const out = Bun.YAML.stringify(t);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, out);
  renameSync(tmp, p);
}
console.log(apply ? 'applied' : 'dry-run — re-run with --apply');
