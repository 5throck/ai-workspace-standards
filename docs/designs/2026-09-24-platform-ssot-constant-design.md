# Platform-List SSOT Constant Design (Step 1 of the Platform-Parity Program)

- **Date**: 2026-09-24
- **Status**: Implemented (2026-09-24 — delivered with the platforms.ts SSOT and 10-site adoption in the same change set)
- **Owner**: Template Architect (design) → Automation Engineer (implementation)
- **Program context**: Step 1 of the approved 4-step platform-parity program. Step 2 fixes the six P1 platform bugs. Step 3 expands 12+ verifiers to 4-platform coverage. Step 4 documents the Claude Desktop App surface. Step 1 lays the constant foundation so Steps 2-3 reference one SSOT.
- **Spec id**: `2026-09-24-platform-ssot-constant-design` (registry: `docs/specs/registry.json`, source: `architect`)
- **Related ADRs**: ADR-0074 (Universal Design Gate), ADR-0079 (ASD-STE100 instruction standard), ADR-0065 (accessibility), ADR-0070 (preview verification), ADR-0036 (TypeScript-only scripts)

---

## 1. Summary

Create `scripts/lib/platforms.ts` v1.0.0 as the single source of truth for platform-list constants. It exports exactly two constants: `PLATFORM_SKILL_BASES` (5 elements, `skills/` SSOT first, then the four platform mirrors) and `PLATFORM_MIRROR_DIRS` (4 mirror elements, definition moved here from `platform-mirror-freshness.ts`, which re-exports it for back-compat). Adopt the constants at the 10 call sites where the constant replaces the existing literal byte-for-byte in value and order — a behavior-neutral refactor. All variant-shaped literals (4-element, 2-element, reordered 5-element, platform-name lists) stay untouched and are handed to Steps 2-3 or recorded as non-goals. No behavior changes, no new helpers, nothing speculative.

## 2. Background

### 2.1 Provenance: the three-audit convergence

Three independent audits converged on the same finding: the platform directory lists exist only as duplicated inline literals.

1. **Duplication audit** (Explore pass, this commit `c4afdca8`): the 5-element skill-base literal `['skills', '.claude/skills', '.gemini/skills', '.agents/skills', '.codex/skills']` appears 11 times across 6 files (verified below — 2 of the 11 diverge in element order). The only exported constant, `PLATFORM_MIRROR_DIRS`, covers the 4 mirror dirs and omits the `skills/` SSOT element.
2. **Cost audit**: onboarding a 5th agent platform today touches an estimated ~50 edit sites across constants, mirrors, propagation config, verifiers, and docs. The constant-level subset alone is 17 inline literals (11 five-element + 6 variant-shaped) plus the freshness constant.
3. **Drift audit**: the duplication has already produced live drift three times:
   - `templates/common/.{claude,gemini,agents}/skills/upgrade-project` sat stale at 1.4.1 while the codex mirror tracked 1.5.0 — the incident that produced `platform-mirror-freshness.ts` (T-20260916-008, recorded in its module docblock).
   - `.agents/skills` was missing from the `new-project.ts` sweep literal until the 2026-09-21 review C-1 (comment preserved at `scripts/new-project.ts:1264-1266`).
   - `verify-country-prune.ts` still carries 4-element literals without `.codex` (4 sites) — live latent drift today, queued as a Step 2 bug fix.

### 2.2 Verified literal inventory (commit c4afdca8)

Canonical-order 5-element sites (exact value-and-order match; adoption is behavior-neutral):

| Site | Shape |
|------|-------|
| `scripts/upgrade-project.ts:2509` | inline for-loop literal |
| `scripts/upgrade-project.ts:3032` | `sweepBases` const |
| `scripts/new-project.ts:1257` | inline for-loop literal |
| `scripts/new-project.ts:1267` | `projectSkillBases` const |
| `scripts/helpers/scaffold-markers.ts:475` | `skillBases` const |
| `scripts/helpers/scaffold-markers.ts:765` | `bases` const |
| `scripts/helpers/scaffold-markers.ts:802` | `bases` const |
| `scripts/helpers/scan-l3-project.ts:89` | object field `skills:` |
| `scripts/helpers/prune-country-scoped-assets.ts:138-143` | multi-line const, same element sequence |

Mirror-shaped exact match (4 elements, no `skills/` SSOT element, same order as `PLATFORM_MIRROR_DIRS`):

| Site | Shape |
|------|-------|
| `scripts/skill-graph-fleet-report.ts:226` | `MIRROR_BASES` const (double-quoted, same values and order) |

Existing exported constant:

| Site | Shape |
|------|-------|
| `scripts/lib/platform-mirror-freshness.ts:31-36` | `PLATFORM_MIRROR_DIRS: readonly string[]`; importers: `validate-templates.ts:204`, `tests/unit/platform-mirror-freshness.test.ts:14-16` |

Variant-shaped literals (NOT adopted in Step 1 — see §5.3):

| Site | Shape | Disposition |
|------|-------|-------------|
| `scripts/evidence-backport-scan.ts:137, :540` | 5-element, double-quoted, **order differs** (`.agents/skills` before `.gemini/skills`) | Step 3 (order swap needs a behavior ruling) |
| `scripts/verify-country-prune.ts:85, 178, 228, 276` | 4-element, missing `.codex` | Step 2 (P1 bug fix) |
| `scripts/upgrade-project.ts:2606` | 4-element, missing `.codex` | Step 2 (P1 bug fix) |
| `scripts/sync-skill-status.ts:24` | 2-element `['skills', '.claude/skills']` | Deferred (claude-only scope may be deliberate; needs a scope ruling, not a swap) |
| `scripts/lifecycle-sync-audit.ts:554` | platform-**name** list `['claude','gemini','antigravity','gemini-cli','codex']` | Non-goal (different domain: frontmatter tier keys) |
| `scripts/validate-model-registry.ts:44` | platform-**name** list `as const` tuple typing `type Platform` | Non-goal (different domain, type-level consumer) |
| `scripts/skill-graph-fleet-report.ts:228` | instruction-docs list `["AGENTS.md","CLAUDE.md","GEMINI.md","CODEX.md"]` | Deferred (no consumer in Steps 1-3 scope) |

L0+L1 verification: `scripts/audit.ts` and `scripts/validate-templates.ts` contain **no** array-literal skill-base lists (verified — their `.claude/skills` references are per-check string usages). Step 1 does not touch either file; they remain Step 3 territory.

### 2.3 Registry and mirror mechanics (verified)

- `scripts/SCRIPTS.md` is the Tier 1 SSOT for scripts; `templates/common/scripts/` (Tier 2) is a snapshot published via `bun run propagate:apply`. The `scripts`/`scripts-helpers`/`scripts-lib` domains propagate only files whose SCRIPTS.md row marks them `L0+L1` (`includeScriptInL1`, `scripts/propagate-to-templates.ts:511-517`).
- Mirror scopes that matter here: `helpers/scaffold-markers.ts` and `lib/platform-mirror-freshness.ts` are **L0+L1** (their L1 snapshots carry the same literals — confirmed at `templates/common/scripts/helpers/scaffold-markers.ts:475,765,802`). `new-project.ts`, `upgrade-project.ts`, `helpers/scan-l3-project.ts`, `helpers/prune-country-scoped-assets.ts`, `skill-graph-fleet-report.ts` are **L0-only**. `evidence-backport-scan.ts` is L0+L1 (deferred, so no cascade for it).
- Import convention uses explicit `.ts` extensions (e.g. `validate-templates.ts:204`).
- Version-bump precedent for behavior-neutral refactors: `upgrade-project.ts` v1.46.0 → v1.46.1 was "mechanical move only — NO behavior change" (patch bump).

## 3. Goals

1. One definition for the 5-element platform skill-base list and the 4-element platform mirror-dir list.
2. Behavior-neutral adoption: every adopted site keeps identical values, order, and runtime semantics.
3. Back-compat: `PLATFORM_MIRROR_DIRS` stays importable from `platform-mirror-freshness.ts` with zero changes to its two importers.
4. Order freeze: unit tests pin exact values and exact order, so a future platform insertion is a reviewed, single-file change.
5. Full lifecycle cascade: SCRIPTS.md rows, propagation to `templates/common/scripts/`, and unit tests land in the same change set.

## 4. Non-goals

1. Fixing the missing-`.codex` latent bugs (`verify-country-prune.ts` ×4, `upgrade-project.ts:2606`) — Step 2.
2. Expanding verifiers to 4-platform coverage, including the `evidence-backport-scan.ts` order question — Step 3.
3. Documenting the Claude Desktop App surface — Step 4.
4. Unifying platform-**name** lists (`lifecycle-sync-audit.ts:554`, `validate-model-registry.ts:44`) — different domain; no target step assigned.
5. Exporting `PLATFORM_INSTRUCTION_DOCS` or any helper functions — no consumer in this step's scope (freeze line: nothing speculative).
6. Runtime-freezing the arrays (`Object.freeze`) — a compile-time `readonly` annotation preserves today's exact runtime behavior.

## 5. Design decisions

### D1 — Module home: new `scripts/lib/platforms.ts`

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| New `scripts/lib/platforms.ts` | Leaf module, zero imports; name names the domain; room for Steps 2-3 growth | One more SCRIPTS.md row | **Adopted** |
| Extend `platform-mirror-freshness.ts` | No new file | Single-responsibility violation (freshness is a T-20260916-008 drift comparator); every constant consumer pulls a "freshness"-named module; constants are not a freshness concern | Rejected |
| Extend `lib/platform-context.ts` | Existing "platform" name | Different domain — OS/shell/encoding detection for the L2 pipeline, not agent-harness platform lists | Rejected |
| Extend `lib/upgrade-policy.ts` | Already imported by scaffold code | Upgrade-policy semantics, not platform metadata | Rejected |

Import graph stays clean and acyclic: `platforms.ts` (leaf, no imports) ← `platform-mirror-freshness.ts` ← `validate-templates.ts`.

### D2 — Export surface: two constants, nothing else

```ts
// scripts/lib/platforms.ts — @version 1.0.0
// Import-safety: no imports, no side effects, no I/O (mirrors the freshness module's contract).

/** The five project skill bases: the platform-neutral skills/ SSOT first, then the four platform mirrors. Order is load-bearing and pinned by tests/unit/platforms.test.ts. */
export const PLATFORM_SKILL_BASES: readonly string[] = [
  'skills',
  '.claude/skills',
  '.gemini/skills',
  '.agents/skills',
  '.codex/skills',
];

/** The four platform skill-mirror dirs under templates/common/ (no skills/ SSOT element). Definition home; re-exported by lib/platform-mirror-freshness.ts for back-compat. */
export const PLATFORM_MIRROR_DIRS: readonly string[] = [
  '.claude/skills',
  '.gemini/skills',
  '.agents/skills',
  '.codex/skills',
];
```

Freeze-line rationale, item by item:

| Candidate | In v1.0.0? | Reason |
|-----------|------------|--------|
| `PLATFORM_SKILL_BASES` (5) | Yes | 10 adoption sites consume it in this spec; Steps 2-3 will consume it for the bug fixes and verifier expansion |
| `PLATFORM_MIRROR_DIRS` (4) | Yes | Moving the existing constant here is what makes `platforms.ts` the SSOT; freshness re-exports it |
| `PLATFORM_INSTRUCTION_DOCS` | No | Its only literal (`skill-graph-fleet-report.ts:228`) is out of adoption scope and out of Steps 2-3 scope; exporting now is speculative |
| Platform-name list (`PLATFORM_NAMES`) | No | Different domain (agent frontmatter tier keys), type-level consumers, no adoption site; belongs to a future spec if ever needed |
| Helper functions (e.g. `resolveBases()`, `isMirrorDir()`) | No | No caller; YAGNI |
| `as const` tuples / `Object.freeze` | No | Changes types / runtime behavior; `readonly string[]` matches the existing freshness constant's type exactly |

Type note: both constants keep the `readonly string[]` annotation already used by `PLATFORM_MIRROR_DIRS` and by `collectMirrorFreshnessDrift`'s `mirrorDirs?: readonly string[]` option — zero type ripple.

Order is load-bearing and frozen as-is: all adopted sites iterate all elements (no first-match-wins shadowing), but iteration order shapes output and processing order (prune logs, sweep order, report order). The majority canonical order (`skills/` first, then claude → gemini → agents → codex) is the frozen order; `skills/` first is semantically meaningful (platform-neutral SSOT before platform mirrors).

### D3 — Adoption scope: exact-replacement rule

Rule: adopt where the constant replaces the literal with zero change to values, order, or types; defer every site whose literal shape differs.

**Adopted in Step 1 (10 literal sites + 1 module):**

| Site | Change |
|------|--------|
| `scripts/upgrade-project.ts:2509` | literal → `PLATFORM_SKILL_BASES` (inline for-loop) |
| `scripts/upgrade-project.ts:3032` | `sweepBases = PLATFORM_SKILL_BASES` |
| `scripts/new-project.ts:1257` | literal → `PLATFORM_SKILL_BASES` |
| `scripts/new-project.ts:1267` | `projectSkillBases = PLATFORM_SKILL_BASES` |
| `scripts/helpers/scaffold-markers.ts:475` | `skillBases = PLATFORM_SKILL_BASES` |
| `scripts/helpers/scaffold-markers.ts:765` | `bases = PLATFORM_SKILL_BASES` |
| `scripts/helpers/scaffold-markers.ts:802` | `bases = PLATFORM_SKILL_BASES` |
| `scripts/helpers/scan-l3-project.ts:89` | `skills: PLATFORM_SKILL_BASES` |
| `scripts/helpers/prune-country-scoped-assets.ts:138-143` | multi-line literal → `PLATFORM_SKILL_BASES` (same sequence) |
| `scripts/skill-graph-fleet-report.ts:226` | `MIRROR_BASES = PLATFORM_MIRROR_DIRS` |
| `scripts/lib/platform-mirror-freshness.ts:31-36` | local definition → import + re-export (see D5) |

**Deferred (with the deciding fact):**

| Site | Why deferred |
|------|--------------|
| `evidence-backport-scan.ts:137, :540` | Element order differs (`.agents` before `.gemini`); adoption reorders scan iteration and report order — not behavior-neutral. Step 3 owns the order ruling. Bonus: deferring avoids an L0+L1 cascade for a file Step 3 edits anyway |
| `verify-country-prune.ts:85,178,228,276`; `upgrade-project.ts:2606` | 4-element missing `.codex` — these are Step 2's P1 bug sites; swapping the constant there would pre-empt (or mask) the bug fix. Note: `upgrade-project.ts` carries both an adopted site (2509, 3032) and a Step 2 site (2606) — different hunks, no conflict |
| `sync-skill-status.ts:24` | 2-element list; claude-only scope may be deliberate. Requires a scope ruling; flagged to Step 2/3 triage |
| `lifecycle-sync-audit.ts:554`; `validate-model-registry.ts:44` | Platform-**name** lists — different domain (§4.4) |
| `skill-graph-fleet-report.ts:228` | Instruction-docs list — deferred constant (§5, D2) |

### D4 — L0-only vs L0+L1 boundary

Step 1 creates no new L0+L1 pairing decisions beyond the mechanical cascade:

- `platforms.ts` registers **L0+L1** in SCRIPTS.md. This is required, not optional: the L1 snapshot `templates/common/scripts/helpers/scaffold-markers.ts` must resolve `../lib/platforms.ts` after propagation, and `includeScriptInL1` only publishes files whose SCRIPTS.md row says L0+L1.
- Two in-scope files are already L0+L1 (`helpers/scaffold-markers.ts`, `lib/platform-mirror-freshness.ts`) — the standard `bun run propagate:apply` cascade covers them; no manual dual-edit.
- `audit.ts` and `validate-templates.ts` (the Step 3 files) are untouched; verified to contain no adoptable literals today.

### D5 — Re-export strategy: definition moves, symbol stays

`platform-mirror-freshness.ts` deletes its local `PLATFORM_MIRROR_DIRS` definition and both imports it (for the `collectMirrorFreshnessDrift` default at line 71) and re-exports it:

```ts
import { PLATFORM_MIRROR_DIRS } from './platforms.ts';
export { PLATFORM_MIRROR_DIRS };
```

Consequences: `validate-templates.ts:204` and `tests/unit/platform-mirror-freshness.test.ts` keep their import statements unchanged (zero churn, back-compat proven by the untouched existing test); the definition lives in exactly one file. The rejected alternative — `platforms.ts` importing from `freshness` — inverts the layering (broader module depending on the narrower one) and would give every constant consumer a transitive dependency on a drift-comparison module. Freshness bumps 1.0.1 → 1.1.0 (additive re-export; the local constant's identity becomes the shared array instance — pinned by test, see D6).

### D6 — Tests

New `tests/unit/platforms.test.ts` (bun:test, following `tests/unit/platform-mirror-freshness.test.ts` conventions):

1. `PLATFORM_SKILL_BASES` deep-equals the exact 5-element array in exact order (`'skills'` first).
2. `PLATFORM_MIRROR_DIRS` deep-equals the exact 4-element array in exact order.
3. Structural invariant: `PLATFORM_MIRROR_DIRS` deep-equals `PLATFORM_SKILL_BASES.slice(1)`.
4. Reference identity: the freshness re-export `===` the `platforms.ts` constant (one array instance workspace-wide).
5. Existing `tests/unit/platform-mirror-freshness.test.ts` stays untouched and green — proving the re-export back-compat.

## 6. Requirements (ASD-STE100, ADR-0079)

- R1. Create `scripts/lib/platforms.ts`. Export only `PLATFORM_SKILL_BASES` and `PLATFORM_MIRROR_DIRS`.
- R2. Give the module no imports. Give it no side effects. Give it no I/O.
- R3. Use the `@version 1.0.0` header. Follow the lib/ docblock conventions.
- R4. Set `PLATFORM_SKILL_BASES` to the 5-element list. Put `'skills'` first. Keep the mirror order claude, gemini, agents, codex.
- R5. Set `PLATFORM_MIRROR_DIRS` to the 4-element list in the same mirror order.
- R6. Annotate both constants as `readonly string[]`. Do not freeze them at runtime.
- R7. Replace the local definition in `platform-mirror-freshness.ts` with an import and a re-export. Bump its header to `@version 1.1.0`.
- R8. Adopt the constants at the 10 sites listed in §5-D3. Change nothing else in those files.
- R9. Add `tests/unit/platforms.test.ts` with the five assertions in §5-D6. Do not modify existing tests.
- R10. Add the SCRIPTS.md row for `lib/platforms.ts` (L0+L1). Bump the seven touched-script rows per §8 step 5.
- R11. Run `bun run propagate:apply` so the L1 snapshot carries `platforms.ts` and the updated L0+L1 files.

## 7. Acceptance criteria

- [ ] AC1. `scripts/lib/platforms.ts` exists, exports exactly the two constants of §5-D2, and has no import statements.
- [ ] AC2. A unit test pins the exact values and order of both constants, the `slice(1)` invariant, and the re-export reference identity. All tests pass.
- [ ] AC3. `grep -rn "\['skills', '\.claude/skills', '\.gemini/skills', '\.agents/skills', '\.codex/skills'\]" scripts/ tests/ templates/common/scripts/` returns zero hits (the SSOT definition is multi-line, so zero is the pass state).
- [ ] AC4. The only remaining 5-element skill-base literals in the workspace are the two documented Step 3 residues in `evidence-backport-scan.ts` (order-divergent). A reviewer enumerates all remaining `codex/skills'` literals and matches each against the §2.2 disposition table — no unlisted residue.
- [ ] AC5. `PLATFORM_MIRROR_DIRS` remains importable from `platform-mirror-freshness.ts`; `validate-templates.ts:204` and the freshness unit test are byte-unchanged.
- [ ] AC6. Full battery is green: unit tests, integration tests, typecheck, validate-templates, audit, lifecycle-sync-audit (§9).
- [ ] AC7. `templates/common/scripts/lib/platforms.ts` exists after `propagate:apply`; `bun run propagate:drift` and `propagate:dry-run` report clean.
- [ ] AC8. SCRIPTS.md carries the new `lib/platforms.ts` row and the seven version bumps; `bun scripts/verify-scripts.ts --verify` passes.
- [ ] AC9. No file outside the §5-D3 adoption list changed (checked via `git diff --stat`).

## 8. Implementation brief (automation-engineer)

Ordered steps:

1. **Create `scripts/lib/platforms.ts`** — exact content of §5-D2 (adjust only the docblock prose). Requirements R1-R6.
2. **Rewire `scripts/lib/platform-mirror-freshness.ts`** — delete lines 30-36 (the local constant + its docblock line); add `import { PLATFORM_MIRROR_DIRS } from './platforms.ts';` plus `export { PLATFORM_MIRROR_DIRS };`; bump `@version` to 1.1.0 with a one-line changelog note. Requirement R7.
3. **Adopt at the 10 sites** (§5-D3 table). Import paths: `'../lib/platforms.ts'` from `scripts/helpers/*`, `'./lib/platforms.ts'` from `scripts/*` top level. Keep each site's local variable name (`sweepBases`, `projectSkillBases`, `skillBases`, `bases`, `MIRROR_BASES`, `skills` field) so diffs stay one-line. In `prune-country-scoped-assets.ts`, replace the multi-line literal with a single-line const assignment. Requirement R8.
4. **Add `tests/unit/platforms.test.ts`** per §5-D6. Requirement R9.
5. **SCRIPTS.md cascade** — add row `lib/platforms.ts | L0 | 1.0.0 | active | Platform-list SSOT constants (PLATFORM_SKILL_BASES, PLATFORM_MIRROR_DIRS); Step 1 of the platform-parity program (spec: docs/designs/2026-09-24-platform-ssot-constant-design.md) | —| L0+L1 | —|`. Patch-bump the six adopted scripts (behavior-neutral precedent: upgrade-project v1.46.1): `helpers/scaffold-markers.ts` 1.5.0→1.5.1, `new-project.ts` 1.28.0→1.28.1, `upgrade-project.ts` 1.46.1→1.46.2, `helpers/scan-l3-project.ts` 1.4.0→1.4.1, `helpers/prune-country-scoped-assets.ts` 0.3.3→0.3.4, `skill-graph-fleet-report.ts` 1.1.0→1.1.1. Minor-bump `lib/platform-mirror-freshness.ts` 1.0.1→1.1.0. Requirement R10.
6. **Propagate** — `bun run propagate:apply`; then `bun run propagate:drift` and `bun run propagate:dry-run` must report clean; `bun scripts/propagate-to-templates.ts --marker-rewrite --dry-run` as the marker-rewrite dry check. Requirements R11, AC7.
7. **Verification battery** (§9). 
8. **Handoff note for Steps 2-3** — record in the task report: the residue disposition table (§2.2) is the entry list for Step 2 (4-element sites) and Step 3 (order-divergent sites, verifier expansion); `sync-skill-status.ts` needs a scope ruling before any adoption.

## 9. Verification plan

Run in order; all must pass:

| # | Check | Command | Pass state |
|---|-------|---------|------------|
| 1 | Unit tests | `bun run test:unit` | green, incl. new `platforms.test.ts` |
| 2 | Integration tests | `bun run test` | green |
| 3 | Typecheck | `bun scripts/typecheck.ts` | green |
| 4 | Template validation | `bun run validate-templates` | green (exercises the freshness check through the re-export) |
| 5 | Workspace audit | `bun run audit` | green (incl. spec-check with the registered design doc) |
| 6 | Lifecycle sync audit | `bun scripts/lifecycle-sync-audit.ts` | green (SCRIPTS.md row/bumps consistent) |
| 7 | Propagation drift | `bun run propagate:drift` | clean |
| 8 | Propagation dry-run | `bun run propagate:dry-run` | clean |
| 9 | Marker-rewrite dry | `bun scripts/propagate-to-templates.ts --marker-rewrite --dry-run` | no unexpected rewrites |
| 10 | Literal residue (exact) | AC3 grep | zero hits |
| 11 | Literal residue (review) | AC4 enumeration vs §2.2 table | every hit accounted for |
| 12 | Script registry verify | `bun scripts/verify-scripts.ts --verify` | green |

## 10. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no Claude-facing surface changes; scripts run identically | N/A |
| Antigravity (GEMINI.md) | None — no `.agents`-facing surface changes; the constants preserve the existing `.agents/skills` element and order unchanged | N/A |
| templates/common | **Yes — propagation required**: new `templates/common/scripts/lib/platforms.ts`; updated L1 snapshots of `scripts/helpers/scaffold-markers.ts` and `scripts/lib/platform-mirror-freshness.ts` via `bun run propagate:apply` | 3 files |

Justification for the two "None" rows: Step 1 is a behavior-neutral internal refactor of workspace scripts. No platform documentation, skill, or command surface changes. The `.gemini/skills` and `.agents/skills` mirror elements are carried verbatim.

## 11. Exemptions

- **Accessibility (ADR-0065): exempt.** This is a backend script refactor with no UI, CLI output format, or document surface change. No interaction area is affected.
- **Preview verification (ADR-0070): exempt.** No rendered UI exists or changes. Verification is the executed battery in §9.

## 12. Trade-offs summary

| Decision | Chosen | Main alternative | Why chosen |
|----------|--------|------------------|------------|
| Module home | New `lib/platforms.ts` | Extend freshness module | Single responsibility; clean leaf layering; named domain |
| Export surface | 2 constants | + instruction docs, + names, + helpers | Nothing speculative; Steps 2-3 can extend the module with a minor bump |
| Adoption rule | Exact-replacement only | Adopt all 11 five-element sites | Order-divergent sites are not behavior-neutral; Step 3 owns them |
| 4-element sites | Leave for Step 2 | Adopt 4-element shape now | Step 2 fixes those files anyway; pre-empting masks the bug |
| Freshness constant | Move + re-export | Re-export from freshness, define in platforms via reverse import | Keeps layering: leaf constants ← domain logic; back-compat preserved |
| Runtime freeze | None | `Object.freeze` | Behavior-neutrality is the contract; compile-time readonly suffices |

## 13. Open questions

None. All decisions are resolvable from verified facts at this commit. The one judgment call surfaced for PM awareness (not blocking): `sync-skill-status.ts:24`'s 2-element list needs a scope ruling in Step 2/3 triage — it is recorded in §2.2 and step 8 of §8.

## References

- `scripts/lib/platform-mirror-freshness.ts` (existing constant, T-20260916-008 docblock)
- `scripts/propagate-to-templates.ts:511-517` (L0+L1 propagation gate)
- `scripts/SCRIPTS.md` (registry row conventions; `upgrade-project.ts` v1.46.1 behavior-neutral bump precedent)
- ADR-0074, ADR-0079, ADR-0065, ADR-0070
