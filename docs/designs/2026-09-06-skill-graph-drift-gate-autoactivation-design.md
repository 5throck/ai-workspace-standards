# Skill-Graph Drift Gate: Fleet Wiring + Auto-Activation; Registry Reconciliation Fixes

| Field | Value |
|-------|-------|
| Date | 2026-09-06 |
| Status | accepted (user-directed, executed same day) |
| Spec ID | `graph-drift-gate` |
| Governing anchor | ADR-0060 (skill relationship graph as generated projection); ADR-0055 (audit enforcement playbook) |
| Related | `docs/designs/2026-08-29-skill-graph-generator-upstream-design.md` (Amendment 8); PRs #813, #814, #815 (root); co-abap#120, co-abap-plugin#90, co-architect#287, co-deck#72, co-develop#38, co-export#3, co-price#82, co-safety#130 |

## Problem

ADR-0060 makes `docs/skill-graph.json` a **generated projection** of the
agents/skills/procedures SSOTs, but nothing in the audit pipeline enforced that
projections stayed regenerated:

1. **Silent drift**: only co-newbiz wired a drift check (`checkGraphDrift()`)
   into its `audit-variant.ts`. The other nine Projects/co-* committed graphs
   that could age arbitrarily far from the SSOTs — exactly what a "generated
   projection" must never do. The 2026-09-06 template 0.6.0 upgrade wave
   shipped SSOT changes to every project without regenerating projections.
2. **No per-project wiring scales**: adding a bespoke gate to each project's
   `audit-variant.ts` helps existing projects but does nothing for future
   scaffolds, and re-implements the same check ten times.
3. **Registry reconciliation gaps** (found while syncing the 0.6.0 wave):
   `upgrade-project.ts`'s `reconcileScriptRegistry()` silently failed for
   whole classes of delivered scripts, FATALing `verify-scripts.ts` on every
   upgraded project.

## Decisions

### D1 — Auto-activating drift gate in the shared audit (primary fix)

`audit.ts` v2.30.0 adds an end-of-audit check: when `scripts/verify-skill-graph.ts`
exists in the audited context (L0 root or any L3 project), the audit spawns it
and **FAILs on drift** between the committed projection and the re-derived
graph. Consequences:

- Any project that has the graph feature is enforced on every audit/dev-sync
  with **zero per-project wiring** — the presence of the generator pair is the
  activation condition, so "has graph" and "gate active" cannot diverge.
- Future scaffolds inherit the gate from day one: `new-project` generates the
  initial graph at scaffold time and the L1 `templates/common/scripts/audit.ts`
  mirror ships the check.
- Contexts that *also* wire the gate into their variant audit run the check
  twice — harmless (both compare the same committed file to the same SSOTs).

### D2 — Fleet wiring (defense in depth, existing projects only)

The nine Projects/co-* without a variant-level gate got one anyway
(`verify-skill-graph.ts` spawned from `audit-variant.ts`; minimal project-owned
`audit-variant.ts` created for the six that had none). Rationale: variant
audits run *earlier* in dev-sync than the shared audit and attribute the
failure to a named project check. `audit-variant.ts` is project-owned (no
template source), so upgrades never clobber it. Projections were regenerated
post-0.6.0 before wiring, and the gate was negative-tested: a tampered graph
node correctly FATALs `audit-variant.ts`.

### D3 — Registry reconciliation correctness (`upgrade-project.ts` v1.19.0)

`reconcileScriptRegistry()` failed five ways during the 0.6.0 wave; all fixed:

| # | Gap | Field symptom |
|---|-----|---------------|
| 1 | Row lookup consulted only the L0 registry; scripts shipped from common under variant-prefixed upstream names (`co-deck/handbook/*` at L0 vs `handbook/*` in projects) never matched | `verify-scripts` "Unregistered script" ×26 (handbook/ + tests/) on co-abap-plugin, co-architect, co-price |
| 2 | Appended rows copied the upstream layer cell verbatim; `L0`/`L0-only` rows are skipped by `isLayerRelevant()` at project context while the file ships on disk | `upgrade-project.ts` itself permanently "Unregistered" |
| 3 | Version updates replaced only the first matching row | stale duplicate rows survived; `lifecycle-sync-audit` Check A failures (co-export `dispatch*` 1.0.1 vs 1.1.0) |
| 4 | Row version came from the L0 registry row, not the delivered file | registry 1.19.0 vs on-disk file 1.18.0 mismatch after L1 lag |
| 5 | `$1`-template replacement strings + LF-only row patterns | Bun/JSC resolves `$1`+`1.19.0` as out-of-range group ref `$11` (corrupted 21 rows in testing); CRLF project files don't match `.*$` |

Root cause for #1's upstream half: the root `SCRIPTS.md` row for
`upgrade-project.ts` carried a stale `L0` layer tag, so
`includeScriptInL1()` silently excluded the script from L0→L1 publish while
`validate-templates.ts`'s l0-l1-script-parity check still compared it — the L1
copy sat frozen (v1.18.0 file / v1.15.0 row). Layer corrected to `L0+L1`.

## Lessons (operational)

- **Upgrades must run on a clean tree**: the pre-upgrade `git stash push`
  snapshot (G12) reverts uncommitted tracked changes in the target repo; an
  earlier same-session upgrade's uncommitted registry rows therefore vanish on
  the next run. Project commits go through dev-sync first — keep it that way.
- **After any fleet upgrade, run `verify-scripts.ts --verify` per project.**
  Since v1.19.0 the reconcile is automatic, but the check is the proof.
- **Bun/JSC `$nn` substitution semantics** differ from V8 assumptions; any
  regex splice into generated rows must use capture-group callbacks.

## Evidence

- Root: `audit.ts` `[PASS] Skill-graph drift gate` + all checks pass;
  `validate-templates.ts` 0 errors / 0 warnings (8 variants);
  `verify-scripts.ts` 171 scripts clean; `lifecycle-sync-audit` pass.
- Scratch co-price fixture (registry reconciliation): handbook 23 + tests 3
  rows registered, stale duplicate removed, layer rewritten `L0`→`L3`,
  delivered-file version written, idempotent second run on a clean tree —
  105/105 scripts verified, lifecycle Check A pass.
- Fleet: all 10 Projects/co-* variant audits pass; co-develop (excluded from
  the morning wave) caught up to 0.6.0 evening state and is enforced via the
  auto-activating gate (PR co-develop#39).
