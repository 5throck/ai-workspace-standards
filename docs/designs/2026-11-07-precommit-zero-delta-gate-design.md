# Pre-Commit Zero-Delta SCRIPTS.md Gate Design (U-20261107-001)

- **Spec ID**: `2026-11-07-precommit-zero-delta-gate-design`
- **Date**: 2026-11-07
- **Author**: automation-engineer (dispatched via PM Gateway; upstream request U-20261107-001 from co-work, suspected layer L1, confirmed L0)
- **Status**: implemented
- **Tickets**: U-20261107-001
- **Lineage**: extends the validator-hardening lineage recorded in `2026-10-27-validator-hardening-retro-design.md` (T-20261027-009 merge-aware check 6, T-20261027-010 check 6c un-deadening) — same gate, third defect class: the proxy's own observability failure
- **Tier**: L0 workspace root scripts + L1 mirrors (propagation-driven)

## 1. Problem

The pre-commit hook's Lifecycle Compliance Check (check 6) gates every commit
that stages `scripts/*.ts`: SCRIPTS.md must be updated too. It implements that
rule through a **staged-file-set proxy** — `git diff --cached --name-only` —
asking whether `scripts/SCRIPTS.md` is in the staged set.

The proxy has an observability blind spot: a file whose content delta is zero
can never appear in the cached name list. In the incident state (co-work
upstream request U-20261107-001):

1. An earlier pipeline commit had already swept the SCRIPTS.md registry row
   for `scripts/upgrade-project.ts` into main **at the target version**
   (1.91.1), while the script's own `@version` bump was still unlanded.
2. The owning session then staged the script bump — the coherent, invariant-
   satisfying batch: staged `@version 1.91.1` == HEAD row `1.91.1`.
3. SCRIPTS.md had zero legitimate content delta, so it could not be staged
   into the name list, and check 6 failed unconditionally:
   `[FAIL] scripts/*.ts files were modified but scripts/SCRIPTS.md was not updated.`
4. The gate's own prescribed remedy — "stage the updated scripts/SCRIPTS.md" —
   is **mathematically a no-op** in this state: staging an unchanged file adds
   nothing to the cached diff. Every retry failed identically. The only
   escapes observed were a cosmetic SCRIPTS.md edit (a noise commit) or
   bypassing the hook (forbidden by workspace policy).

The content invariant the proxy stands for (`@version` == registry row version)
was already satisfied; the proxy just cannot observe it. Reproduced
deterministically against the unfixed helper (see §6).

## 2. Non-goals / preserved invariants

- **Registration invariant**: a staged-but-unregistered script must still
  block. This is NOT covered by the whole-registry Check A comparison — Check
  A iterates registry rows, not files, so a new script with no row is invisible
  to it. Only per-script coverage checking can preserve this.
- The merge path (T-20261027-009) and check 6c (T-20261027-010) are unchanged.
- The SCRIPTS.md-staged path is unchanged ('pass'; content parity re-verified
  by 6c's Check A blocking).

## 3. Design: fix the invariant, not the proxy

Replace the unconditional proxy FAIL with **per-script coverage verification**
against the SCRIPTS.md content the commit actually carries:

- SCRIPTS.md **staged** → 'pass' (unchanged; 6c re-verifies content parity).
- SCRIPTS.md **unstaged** → the commit's registry content **is HEAD's** (the
  staged blob of a zero-delta file equals HEAD's blob). The hook reads
  `git show HEAD:scripts/SCRIPTS.md` and verifies each staged script's
  `@version` (extracted from the staged blob, `git show :path`) against the
  HEAD registry rows.

Outcome per staged script:

| State | Verdict | Remedy surfaced |
|-------|---------|-----------------|
| Row exists at the staged `@version` | covered → PASS with one-line notice | — |
| Row missing | FAIL (`no-registry-row`) | register the script + stage SCRIPTS.md |
| Row at a different version | FAIL (`version-mismatch`) | update the row / revert the bump |
| No `@version` header | FAIL (`no-version-header`, fail-closed) | add an `@version` header |
| Staged blob unreadable (deletion/rename) | FAIL (fail-closed, old-style remedy) | update registry for removal |

The zero-delta PASS is observable: `ZERO_DELTA_GATE_NOTICE` (mirrors the
`MERGE_GATE_NOTICE` pattern from T-20261027-009 requirement 2), so the
exemption is visible in hook output.

## 4. Code shape

- `scripts/helpers/pre-commit-script-gate.ts` v1.2.0 — the gate decision
  (`evaluateScriptsMdGate`) returns `'verify-staged-coverage'` instead of
  `'proxy-fail'`; new import-safe, content-based exports:
  `extractFileVersionFromContent`, `parseScriptsMdRegistryVersions`
  (counterparts of lifecycle-sync-audit.ts's private path-based parsers — the
  hook must read git blobs, not working-tree files), `evaluateStagedScriptCoverage`
  (pure decision: covered/uncovered + per-script reason), `ZERO_DELTA_GATE_NOTICE`.
- `scripts/hooks/pre-commit.ts` v1.13.0 — check 6's `'verify-staged-coverage'`
  branch loads HEAD SCRIPTS.md + staged script blobs via `git show` (quiet,
  nothrow; worktree-safe by construction since git resolves HEAD per worktree),
  runs the coverage decision, PASSes with the notice or blocks with
  per-script, reason-specific remedies.
- Layer column in both SCRIPTS.md rows is `L0+L1`: the L1 mirrors
  (`templates/common/scripts/hooks/pre-commit.ts`, `templates/common/scripts/helpers/pre-commit-script-gate.ts`)
  are **propagation-driven** (dev-sync step 4.5, `parseScriptLayers`), not
  hand-mirrored — no `REVIEWED_DELIVERY_EXCLUSIONS` interaction.

## 5. Rationale

The proxy was a cheap approximation of the real invariant ("the commit carries
a coherent script↔registry version state"). T-20261027-009 already conceded
the approximation fails on merges; U-20261107-001 proves it also fails on
ordinary commits whose registry delta is legitimately zero. Checking the
invariant directly (per-script coverage) is strictly more accurate: it passes
exactly when the invariant holds, and it preserves the one case the proxy
could catch that Check A cannot (unregistered new scripts).

## 6. Verification

- Deterministic reproduction against the unfixed helper: incident state →
  `proxy-fail` while HEAD content coverage is SATISFIED (exit 42 repro).
- Unit suite `tests/unit/pre-commit-script-gate.test.ts` v1.1.0: 33 tests —
  gate decision updated (non-merge one-sided → `'verify-staged-coverage'`),
  the incident regression pinned as a coverage test, content parsers, mixed
  coverage batches, fail-closed states (null registry, no header), notices.
- `bun run test:unit` + `bun scripts/audit.ts` green in the isolated worktree
  before landing.
