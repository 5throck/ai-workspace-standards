# Design Decision: Surviving pm.md extends-stubs at L3 (T-20261001-008)

- Date: 2026-10-01
- Status: DECIDED (Design Gate artifact — decision only, no implementation)
- Tickets: T-20261001-008; precedessors T-20261001-003 (PR #1263/#1268), T-20261001-004 (audit v1.6.0)
- Related ADRs: ADR-0031 (fork model), ADR-0033 (stub resolution at scaffold/adopt), ADR-0039 (extends chain L2→L1→L0)

## Verified current state (2026-10-01)

| State | Projects/co-* | Resolves? |
|---|---|---|
| `extends: ../../../agents/pm.md` (L0 pointer) | co-architect, co-newbiz | YES — L0 root agents/pm.md exists at project level |
| `extends: ../../common/agents/pm.md` (dangling) | co-abap, co-consult, co-deck, co-develop, co-export, co-game, co-price, co-safety, co-security (9) | NO — Projects/common does not exist; resolves for nobody |
| Inlined full body (no extends) | co-design, co-work | n/a — already settled |

- `scripts/new-project.ts` section 2.3b (~line 878) resolves every agents/*.md stub against `templates/common/agents/<name>` at scaffold/adopt; a stub survives only when `missingL1` or when the file is delivered by a path that bypasses 2.3b (nightly runners, legacy pre-v1.29 scaffolds). Today's L1 pm.md exists, so fresh scaffolds never produce a surviving stub.
- `scripts/upgrade-project.ts` line ~2020: the agents pass `continue`s when the TEMPLATE file is an extends stub (`isExtendsStub`, upgrade-policy v1.15.0) — commented as protection against the v1.35.0 clobber of co-work's 349-line resolved body. Consequence: a project pm.md that still IS a stub is never healed by upgrades.
- agent-lifecycle-audit v1.6.0 resolves tier through the extends chain, so both pointer forms and the dangling form all pass tier audit — audit validates tier, not file existence of the extends target.

## Decision

**Option B — ACCEPT, with a narrowly-scoped mechanical pointer-swap pass.**

1. A new ADR (**ADR-0095**, next free number after 0094) formalizes: at L3, an extends pointer is VALID if and only if it resolves on disk from the project file's location. The L0 pointer `../../../agents/pm.md` is therefore a legitimate settled form at L3; the dangling `../../common/agents/pm.md` form is the sole INVALID state.
2. The dangling form is corrected by a **pointer swap only**: replace `../../common/agents/pm.md` with `../../../agents/pm.md`. No body inline, no content change, no version bump of the file body beyond the frontmatter line swap.

## Rationale

- **Resolution correctness.** Option B makes every L3 pm.md resolve. Option A also achieves resolution but by freezing a snapshot of the L0/L1 body into each project — after which L0-level improvements stop reaching that project silently (worse under the fork model, where the pointer is precisely the mechanism for shared-but-overridable behavior).
- **Blast radius.** A pointer swap changes 1 line per file across 9 projects and is reviewable in full. Inlining (A) rewrites 349-line bodies across 9 projects — exactly the fleet-wide write class that produced the #1263 → #1268 → nightly-revert incident. The incident also showed the ecosystem actively re-converges files toward the L0 pointer (co-newbiz re-acquired it), so B aligns with observed system behavior instead of fighting it.
- **Idempotency.** The swap pass matches on the exact literal `extends: ../../common/agents/pm.md`; after the swap the file no longer matches, so re-runs are no-ops. Option A's inline is also idempotent but its output depends on WHEN it runs (L0/L1 content drifts), making re-runs after drift non-trivially different — a reconciliation hazard upgrade-policy already had to defend against.
- **Consistency.** ADR-0033's resolve-and-inline applies at scaffold/adopt for variant template stubs (L2→L1). A surviving L3 pointer is a different topology: ADR-0039 already defines chain traversal, and the L0 pointer is simply chain-terminating one level higher. ADR-0095 extends ADR-0039's rule (resolves = valid) rather than contradicting ADR-0033, whose scope stays scaffold-time. The upgrade pass's stub skip (line 2020) remains correct and unchanged: it prevents clobbering resolved bodies; a one-line pointer file has no body to clobber.
- **Cost.** B is one ADR + one mechanical pass; A requires a settle-pass implementation, drift-safety analysis per project, and rollout sequencing to avoid a repeat incident.

## Target state for every Projects/co-*/agents/pm.md

| Project | Action |
|---|---|
| co-abap, co-consult, co-deck, co-develop, co-export, co-game, co-price, co-safety, co-security | swap `../../common/agents/pm.md` → `../../../agents/pm.md` |
| co-architect, co-newbiz | none (already L0 pointer — the accepted form) |
| co-design, co-work | none (inlined bodies are settled; do NOT convert back to pointers — fork-model divergence is intentional) |

Templates are untouched: `templates/common/agents/pm.md` keeps extending L0 (correct within the template tree); variant L2 pm.md files keep their current forms.

## Migration mechanism (if approved for implementation)

- Scope: pointer swap only, literal match, only under `Projects/*/agents/pm.md`. Implemented as a one-time script run (not wired into upgrade-project, to keep the settle-pass freeze of scope per the incident lesson); a later hardening MAY add a dangling-pointer check to agent-lifecycle-audit (fail, not auto-fix).
- Idempotency proof plan: run the pass twice; second run must report 0 changes. Add a unit test: file with dangling pointer → swapped; file with L0 pointer or no extends → untouched; non-pm.md agents files with the same dangling pattern → untouched (scope guard).
- Rollout order (smallest diff-first, one PR per project): co-deck → co-abap → co-consult → co-develop → co-export → co-game → co-price → co-safety → co-security. Sequential, per CONSTITUTION.md §3.3 (no parallel branches against shared pipeline files).

## Test plan

1. Unit tests for the swap helper (dangling→L0, already-valid no-op, scope exclusions).
2. Per-project: after swap, `grep -rn "extends: \.\./\.\./common" Projects/` returns zero.
3. Audit regression: run agent-lifecycle-audit v1.6.0 across Projects/ before and after — tier results must be identical.
4. Upgrade dry-run on co-work and one swapped project: agents pass must remain a no-op for pm.md.

## Non-goals

- No body inlining of pm.md (or any agent) into L3 projects.
- No changes to templates/ (common or co-*), agents/ L0, new-project.ts, or upgrade-project.ts.
- No auto-fix in audit (report-only hardening is optional follow-up).
- No retroactive conversion of inlined bodies (co-design, co-work) back to pointers.
- No new ADR superseding ADR-0033's scaffold-time behavior; ADR-0095 governs the L3 pointer form only.
