---
schemaVersion: 1.0.0
spec-id: scaffold-fresh-audit-remediation
---

# Scaffold Fresh-Audit Remediation — 2026-09-16

## 1. Overview

Lands the three defect tickets from the 2026-09-16 real co-develop scaffold
test: `bun scripts/new-project.ts "X" --variant co-develop` produced a
project whose own `bun scripts/audit.ts` failed 40 checks, while existing
upgraded projects (e.g. `Projects/co-develop`) pass with 0. Acceptance bar:
a fresh scaffold of the same shape passes its own audit with 0 FAIL.

| Ticket | Severity | Root cause | Fix |
|--------|----------|------------|-----|
| T-20260916-009 | HIGH | The `<!-- WORKSPACE-MANAGED: tier-model-mapping -->` block in templates/common/AGENTS.md has no L1→L2 delivery channel: §3.6 sits OUTSIDE the COMMON-AGENTS:START/END marker-inject zone, and all variant templates carried stale 2-model prose with no marker wrapper | Data fix (all 13 variant AGENTS.md) + new `managed-block-parity` validator arm (PM-04, Error) |
| T-20260916-010 | HIGH | 11 of 13 variant templates shipped a stub docs/VERSION_MANIFEST.md; the project audit's skills↔manifest parity check treats the stub as a complete registry (37 FAILs + 1 summary FAIL) and the --check drift gate regenerates a full manifest and fails on the stub (1 FAIL); co-abap/co-price ship none — inconsistent either way | Templates stop shipping stubs; new-project.ts generates the full manifest post-delivery; upgrade path regenerates in place; new `variant-version-manifest` validator arm (Error) |
| T-20260916-011 | NORMAL | validate-model-registry.ts reads CODEX.md unconditionally; projects scaffolded without the codex platform have neither CODEX.md nor .codex/ → "could not read CODEX.md" ERROR | Platform-delivery awareness: the codex prose target self-skips with a visible note when the platform was not delivered |

## 2. Before/after anchors

### T-009 — tier-model-mapping delivery channel

Before (all 13 variant templates were supposed to carry the block; reality
found during implementation is annotated):

- 11 of 13 variant AGENTS.md carried STALE 2-model prose at §3.6, unwrapped
  (e.g. `templates/co-develop/AGENTS.md` line 216):
  `- **High-tier**: Complex reasoning, architectural design, planning (claude-opus-5-0 / gemini-3.1-pro)`
- `templates/co-abap/AGENTS.md` and `templates/co-price/AGENTS.md` carry an
  older, structurally different document with NO §3.6 section at all — the
  ticket's "ALL 13 at ~line 216" premise did not hold for these two.
- templates/common/AGENTS.md carries the current 3-model mapping as TWO
  marker-wrapped blocks under the same key `tier-model-mapping` (§3.6 tier
  list, lines 153-157; §5.3 Model-column note, lines 466-468), plus the
  graft block (`graft repo context graph`) — the only managed block the
  variants carried, byte-identical in all 13 (verified before the fix).

After:

- The 11 standard variants carry BOTH common blocks, marker-wrapped,
  byte-identical to the L1 copies: the stale §3.6 prose lines were replaced
  by the wrapped tier list, and the unwrapped §5.3 note line was replaced by
  the wrapped note block.
- co-abap/co-price gained a full L1-shaped `### §3.6 3-Tier Strategy`
  section (intro + both wrapped blocks) at the closest structural
  equivalent: co-abap before `## Universal Baseline Behaviors`, co-price
  before `## §4: PM Subagent Dispatch Protocol`. This is a reported
  structural divergence handled by insertion — NOT an allowlist exception.
  No legitimate divergence requiring the intentional-duplicate mechanism
  surfaced; the escape hatch was not used.
- Fresh scaffolds now copy the current 3-model block into the project, and
  the project's model-registry gate passes (see §6).

### T-010 — stub manifest retirement

Before: `templates/co-develop/docs/VERSION_MANIFEST.md` line 3:
`> Stub. This variant inherits version governance from the workspace root.`
with static version cells (`1.0.0` vs templates/VERSION `0.6.0`);
`templates/co-safety/docs/VERSION_MANIFEST.md` was a stale 155-line
generated manifest from 2026-08-28 (Windows path separators in the
Location cell); co-abap/co-price shipped nothing.

After: all 11 stubs are deleted (git rm). No variant template ships
docs/VERSION_MANIFEST.md; the file exists in a project only as generated
state.

### T-011 — codex platform skip

Before (`scripts/validate-model-registry.ts` Step 8): the `CODEX.md`
prose target was read unconditionally; a codex-opt-out project failed with
`ERROR: CODEX.md: could not read CODEX.md`.

After: the target is skipped with a visible note
(`ℹ️  CODEX.md 3-Tier mapping: skipped (codex platform not delivered)`).
L0/L1 contexts, where every target file exists, are behaviorally unchanged.

## 3. Design decisions

### 3.1 T-010 adjudication: generation, not stub shipping

A project is a standalone repo whose steady-state manifest is the full
generated one (the upgrade flow's contexts already regenerated it:
`Projects/co-develop/docs/VERSION_MANIFEST.md` is full, generated
2026-09-15). Templates cannot ship generated manifests without going stale
in template CI — the co-safety stub proved exactly that. Therefore:

1. **Data**: the 11 stubs are deleted from templates/co-*/docs/.
2. **Scaffold**: new-project.ts §7.8 (new) runs the PROJECT's own
   `scripts/generate-version-manifest.ts` with `cwd = projectDir`, after
   content delivery and BEFORE the post-scaffold audit — mirroring the §7.6
   skill-graph generation pattern (bun + project cwd, loud non-fatal
   warn-and-continue). It must not silently skip: a missing generator or
   bun logs a warning, and the audit immediately after enforces the
   VERSION_MANIFEST gates either way. Invoke semantics live in the pure
   `decideManifestGeneration()` (helpers/scaffold-markers.ts §2.5) so the
   decision is unit-testable.
3. **Upgrade**: upgrade-project.ts gains a post-upgrade regeneration step
   (mirroring the skill-graph regeneration), so a project still carrying a
   retired stub gets a full manifest on its next upgrade — the
   "pruned/replaced" bookkeeping. Pruning alone would leave projects with
   NO manifest, which the audit's gates would then reject; regeneration
   restores the steady state directly.
4. **Policy**: docs/VERSION_MANIFEST.md joins REGENERATED_FILES in
   lib/upgrade-policy.ts. Without this the deny-list-by-default policy
   (TEMPLATE TREE SYNC / SYNC fallback) would deliver any future template
   copy OVER a project's generated manifest. `check-upgrade-coverage.ts
   --strict` stays green: the effective template tree no longer contains
   the file, so no claim is exercised for it.
5. **Validator**: new `variant-version-manifest` arm (Error) in
   validate-templates.ts — variant templates must NOT ship
   docs/VERSION_MANIFEST.md (stub or otherwise; a full manifest in a
   template would go stale in template CI). This makes the 11/13
   divergence class impossible.

### 3.2 T-009 parity validator design

New `managed-block-parity` arm (PM-04, Error) in validate-templates.ts,
placed after PM-02 (marker-zone-parity):

- **Extraction** (`extractKeyedBlocks`): every
  `<!-- WORKSPACE-MANAGED: <key> --> … <!-- /WORKSPACE-MANAGED -->` block,
  keyed by whitespace-normalized key. An unterminated block is surfaced as
  an Error, never silently dropped.
- **Comparison** (`compareKeyedBlocks`): per-key SET of normalized
  contents (CRLF→LF, per-line trailing-whitespace trim, outer blank lines
  trimmed). Set semantics because duplicates are legitimate:
  templates/common/AGENTS.md itself carries two `tier-model-mapping`
  blocks with different content. Violations:
  - key present in common, absent in variant → Error (no delivery channel);
  - common content missing from the variant's wrapped set → Error
    (wrapped-absent / content-divergent);
  - variant carries a keyed block common does not → Error (a variant-only
    managed block would be unioned into projects by upgrade MERGE with no
    common source) — this is the reporting path for any future divergence;
    the intentional-duplicate mechanism remains available but was NOT
    needed.
- Primitives live in scripts/lib/managed-block-parity.ts (new, L0+L1) and
  are unit-tested against synthetic trees plus the real-tree invariant.

### 3.3 T-011 guard design

New scripts/lib/platform-delivery.ts (L0+L1):
`partitionProseTargetsByDelivery(targets, exists)` classifies each prose
target before reading: CODEX.md is the codex-platform target and skips with
reason `codex platform not delivered` when neither CODEX.md nor .codex/
exists (`isCodexPlatformDelivered` — either signal suffices, matching
ADR-0077 §10's profile semantics); every other target skips only when its
own file is absent. Skips are printed, never silent. The existence
predicate is injected, so the guard is testable without a filesystem.

## 4. Files changed

| File | Change | Version |
|------|--------|---------|
| templates/co-*/AGENTS.md (13) | T-009 data fix: both wrapped tier-model-mapping blocks delivered (11 replaced stale prose + unwrapped note; co-abap/co-price gained §3.6 section) | template data |
| templates/co-*/docs/VERSION_MANIFEST.md (11) | T-010: deleted (git rm) | template data |
| scripts/lib/managed-block-parity.ts | NEW: keyed-block extraction + set-parity comparison | 1.0.0 |
| scripts/lib/platform-delivery.ts | NEW: codex delivery detection + prose-target partitioning | 1.0.0 |
| scripts/validate-templates.ts | NEW arms: `managed-block-parity` (PM-04), `variant-version-manifest` | 1.31.0 → 1.32.0 |
| scripts/validate-model-registry.ts | Codex platform-delivery skip guard | 1.3.0 → 1.4.0 |
| scripts/new-project.ts | §7.8 post-delivery manifest generation | 1.18.0 → 1.19.0 |
| scripts/upgrade-project.ts | Post-upgrade manifest regeneration | 1.28.0 → 1.29.0 |
| scripts/lib/upgrade-policy.ts | docs/VERSION_MANIFEST.md → REGENERATED_FILES | 1.5.0 → 1.6.0 |
| scripts/helpers/scaffold-markers.ts | §2.5: manifest relpath constants + decideManifestGeneration | 1.1.0 → 1.2.0 |
| scripts/SCRIPTS.md + templates/common/scripts/SCRIPTS.md | Registry rows + changelog entry (L1 is the hand-maintained mirror) | — |

Propagation: `bun scripts/propagate-to-templates.ts --apply` refreshes the
L1 mirrors (validate-templates.ts, validate-model-registry.ts, both libs,
scaffold-markers.ts). new-project.ts and upgrade-project.ts are L0-only
(verified against the L1 scripts/ tree: no mirror files ship).

## 5. Test plan

- tests/unit/managed-block-parity.test.ts (NEW): marker parsing, whitespace
  normalization, duplicate-key accumulation, unterminated-block issues,
  missing-key/missing-content/extra-content verdicts, and the real-tree
  invariant that common and ALL 13 variants are at parity right now.
- tests/unit/platform-delivery.test.ts (NEW): codex delivery detection,
  partitioning (codex-opt-out skip, bare .codex/ active, non-codex skips,
  full-context no-op), real-root zero-skip invariant.
- tests/unit/version-manifest-generation.test.ts (NEW):
  decideManifestGeneration truth table, generator ships from
  templates/common, no variant ships a manifest, claim is REGENERATED.
- tests/unit/upgrade-policy.test.ts: docs/VERSION_MANIFEST.md moved from
  the TEMPLATE TREE SYNC gap list to the REGENERATED list.

## 6. Verification (acceptance bar)

`bun scripts/new-project.ts "devtest-verify-0916" --variant co-develop`
then `cd Projects/devtest-verify-0916 && bun scripts/audit.ts` must report
**0 FAIL** (the failing test reported 40). Additional assertions: project
AGENTS.md §3.6 lists 3 models per tier; docs/VERSION_MANIFEST.md is a full
generated manifest (no "Stub." line); no "could not read CODEX.md" error.
The test project is deleted after verification.

## 7. Accessibility

Backend/CLI-only work (validator arms, scaffold/upgrade flow steps, pure
libs, template data, unit tests). No user-facing UI is produced. Exempt
from ADR-0065 WCAG scope; the WCAG 2.1 AA baseline does not apply.

## 8. Preview Verification

Non-UI work — no rendered surface exists to screenshot. Exempt from
ADR-0070 preview verification; verification is via the executed battery
(unit suite, validate-templates, typecheck, audit, scripts suite,
lifecycle-sync-audit, review-baseline, check-upgrade-coverage --strict)
plus the real-scaffold acceptance run of §6.

## 9. Deliberately left out

- `scripts/create-l3-scaffold.ts` still writes a stub docs/VERSION_MANIFEST.md
  into L3 dev scaffolds (tests/.temp drafts). L3 scaffolds are throwaway
  variant-development drafts, not delivered projects, and are outside the
  acceptance bar. If an L3 draft is ever promoted while carrying the stub,
  the new `variant-version-manifest` arm fails closed at the promotion gate
  and the stub is deleted before publish — the invariant holds without
  changing the L3 flow.
- Root AGENTS.md managed blocks are not part of the parity arm (the design
  scopes the guard to templates/common → templates/co-*).
