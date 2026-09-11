# Design: Universal Design Gate — Spec Enforcement at Every Tier (L0–L3)

- **Spec ID**: 2026-09-12-universal-design-gate-design
- **Date**: 2026-09-12
- **Status**: accepted — implementation phased (this document is the Row 0 artifact for the initiative)
- **Related**: ADR-0074 (decision record), ADR-0055 (WARN-first playbook), ADR-0073 + Amendment 2 (upgrade zone model), AGENTS.md §5.1/§5.1.1, `scripts/dev-sync.ts` step 3.9, `scripts/audit.ts` spec-check

## 1. Problem

Every change must remain traceable to a reviewed design/spec record. The operator decided on 2026-09-12 that the Design Gate applies to **L3 (scaffolded projects) as a hard gate with no grace period** — rationale: only then does every change stay visible and verifiable after the fact.

The verified state (2026-09-12, workspace root + `Projects/*`):

| Tier | Design Gate (Row 0, pre-implementation) | Spec-check (sync-time, FATAL) | Notes |
|------|:---:|:---:|---|
| L0 workspace root | ✅ AGENTS.md §5.1 | ✅ active | full infra: `docs/specs/registry.json`, `spec-register.ts`, `spec-backfill.ts` |
| L1 `templates/common` | ✅ same rule | ✅ (absorbed into L0 runs) | inherits everything |
| L2 variant templates | ❌ explicitly exempt (§5.1.1) | ❌ | template ships **no spec infra at all** |
| L3 scaffolded projects | ❌ exempt | ⚠️ conditional | gate script present but **silently skips** without `docs/specs/registry.json` |

Coverage holes, all verified:

1. `templates/common/docs/specs/` and `templates/common/scripts/spec-register.ts` do not exist — new scaffolds start with **no gate** (step 3.9 logs `skipped — no docs/specs/registry.json` and continues).
2. Of 11 existing projects, **6 have a registry** (co-abap, co-architect, co-consult, co-deck, co-price, co-safety — created ad-hoc during real work) and **5 do not** (co-develop, co-export, co-game, co-newbiz, co-security).
3. **ADR-0073's zone model actively prevents delivery**: `docs/specs` (and `docs/adr`) are in `TEMPLATE_ONLY_DIRS` — the scaffold deletes the zone post-overlay (`new-project.ts:470,477,718`, mirrored into `upgrade-policy.ts`) and the upgrade engine never delivers it. Adding a template seed alone would therefore change nothing.

## 2. What already exists (this is alignment, not new machinery)

The machine gate is **one implementation already present at every tier**: the standardized `scripts/audit.ts` spec-check (diff touches `scripts/`/`templates/`/`agents/` → requires spec activity: diff touches `docs/specs/`|`docs/designs/`, or an approved/implemented registry entry updated ≤7 days) wired FATAL into `scripts/dev-sync.ts` step 3.9, with machine-consumed exemptions `E1–E5` (`--spec-exempt` / `SYNC_SPEC_EXEMPT`). The L0 Design Gate (Row 0) is its process-level presentation. "Unifying the two" therefore means closing coverage holes, amending the zone model, and aligning governance text — not merging two systems.

## 3. Goals

- **G1**: The spec gate is active in every L3 project and every new scaffold — hard Fail on undocumented code changes from the first change (operator decision; no grace period).
- **G2**: Infra reaches projects through the two existing delivery paths (scaffold overlay + `upgrade-project`), per ADR-0073's policy-driven model — no new delivery mechanism.
- **G3**: Governance text matches enforcement: AGENTS.md §5.1/§5.1.1 stops exempting L2/L3; the `/sync` pipeline table and project-facing AGENTS zone describe the gate.
- **G4**: Relevance eventually maps specs to files (`covers:` globs), replacing the 7-day recency heuristic — WARN-first per ADR-0055.

## 4. Non-goals

- No change to the exemption vocabulary (E1–E5 stay the relief valve at all tiers).
- No per-file relevance enforcement in the first phases (Phase D, WARN-first).
- No forcing of L0-style execution-plan boilerplate (agent/tier/model tables) into projects — L3 gets the machine gate plus the one-design-doc convention; full Row 0 ceremony remains L0/L1 presentation.
- `docs/adr` stays template-only: project decision records live in `docs/designs/` (already a `WORKSPACE_DOC_DIRS` add-if-missing seed).

## 5. Target behavior after rollout

| Tier | Pre-implementation (process) | Sync-time enforcement |
|------|------|------|
| L0/L1 | Row 0 full ceremony (unchanged) | spec-check FATAL (unchanged) |
| L2 template repos | work happens at L0 → gated there | n/a (templates have no runtime git gates) |
| L3 projects | one design doc + `spec-register.ts` entry before/with code changes | spec-check FATAL — registry always present, no silent skip |

## 6. Implementation phases

### Phase A — decision record (this PR, docs-only)
- This design doc + **ADR-0074** (`docs/adr/0074-universal-design-gate.md`, Accepted) + governance linkage in `CONSTITUTION.md` and `docs/constitution/03-pr-workflow.md` (ADR-0059 linkage gate).

### Phase B — infra ship (PR after #890 merges; shares `scripts/SCRIPTS.md` + `scripts/dev-sync.ts`)
1. `scripts/SCRIPTS.md`: `spec-register.ts` row `L0` → `L0+L1` — the mirror is scope-driven (`propagate-to-templates.ts` `parseScriptLayers`), so the L1 copy appears on the next propagate; `verify-scripts` parity then guards drift.
2. **ADR-0073 Amendment 2 — zone model**: remove `docs/specs` from `TEMPLATE_ONLY_DIRS` in **both** mirrors (`scripts/lib/upgrade-policy.ts` and `scripts/new-project.ts` — the pair is drift-guarded by tests) and claim `docs/specs/registry.json` as an add-if-missing seed with WORKSPACE semantics (project entries never overwritten or pruned). `docs/adr` stays template-only.
3. Add `templates/common/docs/specs/registry.json` seed (empty `specs: []` + a comment pointing at `spec-register.ts` and the gate). With (2), scaffolds keep the zone and upgrades deliver the seed to existing projects (add-if-missing → existing ad-hoc registries are never clobbered).
4. `scripts/dev-sync.ts` step 3.9: registry-absent **silent skip → prominent WARN** (visible until Phase C completes).
5. Governance text: AGENTS.md §5.1 Design Gate note + §5.1.1 amendment (L2/L3 exemption replaced by tiered universal gate), `skills/sync/SKILL.md` pipeline table row 3.9, Design Gate paragraph injected into the project-facing `COMMON-AGENTS` marker zone (re-publish across variants), scaffold quickstart one-liner ("first code change needs a design doc + registry entry, or an E-code exemption").

### Phase C — fleet backfill (ops PR)
- Run `bun scripts/upgrade-project.ts Projects/<name>` across the 11 projects (delivers seed + `spec-register.ts`), then `spec-backfill.ts` to seed initial registry entries for pre-existing code areas.
- Verification: `bun scripts/audit.ts --spec-check --lifecycle-only` active (non-skip) in all 11 projects.

### Phase D — `covers:` relevance mapping (follow-up PR, WARN-first)
- Registry entries and design-doc frontmatter gain `covers:` path globs; the spec-check correlates the changed-path set against them. No cover → WARN during soak → Fail after. Retires the documented recency-heuristic limitation (`audit.ts` comment; `docs/designs/2026-08-16-spec-registry-enforcement-design.md`).

## 7. Edge cases

- **Fresh scaffold, first code change**: empty registry + code diff + no docs activity = Fail — intended (G1). The quickstart note and the Fail message's own remedy (`brainstorming skill or spec-register.ts`) are the guidance path; E-codes cover trivial changes.
- **Existing ad-hoc registries** (6 projects): add-if-missing delivery never touches them; they already gate.
- **The 5 uncovered projects**: WARN from Phase B delivery, Fail after Phase C backfill — a bounded, visible window rather than a silent one.
- **Variants without `scripts/`** (fork model): infra arrives via the same scaffold/promotion injection that ships the standard core scripts; nothing new to invent.
- **Parity gates churn**: the SCRIPTS.md row flip, the zone-list pair, and the template seed each move parity/drift/coverage gates — they must land in one PR so every gate sees a consistent tree.

## 8. Risks / trade-offs

- Friction for quick fixes in projects — mitigated by E1–E5 (unchanged) and the 7-day recency window until Phase D tightens it.
- The gate enforces *spec activity*, not correctness of the spec (unchanged limitation; Phase D narrows it to file-level relevance, never semantic review).
- ADR-0073 amendment touches a just-settled zone model — the amendment is narrow (one dir, one seed file) and keeps the deny-by-default scaffold hygiene for `docs/adr` and staging areas.

## 9. Accessibility

Non-UI change (pipeline script, template seed, governance markdown). No interaction surfaces affected; WCAG baseline not applicable. **Exempt with explicit statement** per AGENTS.md §5.1.

## 10. Preview Verification

Non-UI change (no rendered web/app UI). **Exempt with explicit statement** per ADR-0070.

## 11. Gates

- Phase A: `/sync` full gate chain (spec-check satisfied by this document; ADR governance linkage via the CONSTITUTION/03-pr-workflow references).
- Phase B: `verify-scripts --verify` + `--check-drift` (L0↔L1 parity), `check-upgrade-coverage --strict` (policy rows), upgrade-policy unit tests (zone-pair drift guard), `validate-templates`, `bun run test`, typecheck.
- Phase C: per-project `audit.ts --spec-check --lifecycle-only` exit 0 × 11.
- Phase D: WARN output fixture tests → post-soak strict flip.
