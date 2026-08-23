# Design: Spec Registry Enforcement + project-to-variant.ts Hardening

**Date**: 2026-08-16
**Status**: Approved — Part A Stage 1, Part B, and Stage 2 (2026-08-23) implemented (see Delivery Scope)
**Source**: brainstorming
**Spec ID**: 2026-08-16-spec-registry-enforcement-design
**Related**: [workflow-integrated-methodology-design.md](workflow-integrated-methodology-design.md), [execution-plan-design-gate-design.md](execution-plan-design-gate-design.md), [ADR-0054](../adr/0054-error-handling-standardization.md)

---

## Problem Statement

`ai_workspace` already tried to solve "design docs drift from implementation" once, in `workflow-integrated-methodology-design.md` (2026-06-24): a spec registry (`docs/specs/registry.json`), a `spec-register.ts` CLI, and a `--spec-check` mode in `audit.ts` wired into `/sync`. In practice it never worked, for three concrete, verified reasons:

1. **`--spec-check` never actually runs.** `dev-sync.ts` invokes it as `bun scripts/audit.ts --spec-check --lifecycle-only`, but `audit.ts`'s guard is `if (SPEC_CHECK && !LIFECYCLE_ONLY)` — with both flags set, this is always `false`. Every other heavy check in the file is gated the opposite way (`if (!LIFECYCLE_ONLY) {...}`, ~15 occurrences), so this is a copy-paste inversion bug, not intentional design.
2. **Even if it ran, the relevance check is a no-op.** `hasActiveSpec = registry.specs.some(s => status is approved/implemented)` only checks whether *any* spec anywhere is active — once any spec is ever approved, the check passes forever regardless of what actually changed.
3. **The output is silenced regardless.** The call site uses `.quiet().nothrow()` — the only place in `dev-sync.ts` that both suppresses output and ignores the exit code.

Registration is also entirely manual/opt-in — only `variant-feature.ts` calls `spec-register.ts` automatically. Result: `docs/designs/` has 48 design docs; the registry has 4 entries.

Separately, this workspace's variant automation is uneven by direction. "Template → new project" (`create-l3-scaffold.ts`, `l3-to-variant-pipeline.ts`, 1143 lines) is mature: ADR-referenced review, anti-swelling checks (`validate-templates.ts`), and platform-parity checks (`validate-platform-parity.ts`) are all real and working. "Existing project → variant template" (`project-to-variant.ts`, 161 lines) is not: no complexity gate, and it ends by *printing* a manual review checklist instead of executing any of it. Its own `SKILL.md` tells users to abandon it for anything non-trivial in favor of manually invoking the full pipeline — the clearest available signal of where the real bottleneck sits.

**Goal**: make the spec-registry mechanism actually function (visible → relevant → eventually blocking) without a big-bang break, retroactively close the registry's 44-document gap, and close the concrete automation gaps in `project-to-variant.ts` — each finding backed by a code reference, not speculation.

---

## Delivery Scope

Per this workspace's own Sequential Branch Dependency Rule (`dev-sync.ts` touches shared files — `CHANGELOG.md`, `SCRIPTS.md`, `VERSION_MANIFEST.md` — on every commit, so unmerged parallel branches conflict), this design shipped as sequential PRs rather than one big change:

- **Part A Stage 1** (PR #538, merged) — spec-check gating/relevance fix, `spec-backfill.ts`, ADR-0055 (Proposed).
- **Part B** (`project-to-variant.ts` hardening) — implemented in the next PR after Part A merged, per the Sequential Branch Dependency Rule.
- **Stage 2** (Warn → Fail, actually blocking commits) remains deferred — it needs a soak period to observe Stage 1's output on real commits first (≥1 week / one Weekly Health Check cycle with no false-positive reports).
- **Stage 2** (2026-08-23, shipped) — relevance Fail + blocking dev-sync step 3.9; ADR-0055 Accepted.

---

## Part A — Spec Registry Relevance + Enforcement

### Stage 1 (this PR)

**`scripts/audit.ts`** (spec-check block, search `Spec Registry Checks`):
- Fix the gating bug: `if (SPEC_CHECK && !LIFECYCLE_ONLY) {` → `if (SPEC_CHECK) {`.
- Replace the relevance check (remove the currently-dead `registeredFiles` variable and put it to use):
  ```ts
  const changedSpecArea = changedFiles.some(f =>
    f.startsWith('docs/specs/') || f.startsWith('docs/designs/'));
  if (changedCode.length > 0) {
    const RECENT_DAYS = 7;
    const now = Date.now();
    const recentActiveSpec = registry.specs.some(s => {
      if (s.status !== 'approved' && s.status !== 'implemented') return false;
      const updated = Date.parse(s.last_updated);
      return !isNaN(updated) && (now - updated) <= RECENT_DAYS * 86400 * 1000;
    });
    const relevant = changedSpecArea || recentActiveSpec;
    if (!relevant) {
      Warn(`Spec check: ${changedCode.length} code file(s) changed but no recent/relevant spec activity — consider running the brainstorming skill or spec-register.ts`);
    } else {
      Pass('Spec check: code changes covered by spec registry activity');
    }
  }
  ```
  Known limitation (accepted, not a code TODO): this is diff-recency-based, not true per-file spec-to-code mapping — true mapping is out of scope (YAGNI) for this pass.
- Every call in this block stays `Warn()` — no `Fail()` yet.

**`scripts/dev-sync.ts`** (step 3.9): remove `.quiet()`, keep `.nothrow()`:
```ts
await $`bun scripts/audit.ts --spec-check --lifecycle-only`.nothrow();
```

### Stage 2 (follow-up PR, gated on ≥1 week soak with no false-positive reports)

- `scripts/audit.ts`: promote the "no relevant spec" `Warn(...)` to `Fail(...)` (stale-spec and missing-file checks stay `Warn`). Add an exemption escape hatch: `--spec-exempt=<E1-E5>` / `SYNC_SPEC_EXEMPT` env var, validated against the E1-E5 vocabulary already defined in `AGENTS.md` §5.1.1 (`memory-log`, `changelog`, `hotfix-typo`, `pure-readme`, `sync-only`) — `Pass()` with a logged exemption note instead of failing.
- `scripts/dev-sync.ts`: switch step 3.9 to the same blocking idiom already used for the main audit gate (visible output, check `exitCode`, `process.exit(1)` on failure), threading `--spec-exempt` through.
- `docs/adr/0055-spec-registry-enforcement.md`: Status → Accepted.

---

## Part A — Retroactive Registration

**Prerequisite fixes in `scripts/spec-register.ts`** (`@version` 1.0.1 → 1.1.0):
- Extend `SpecStatus` from `'draft' | 'approved' | 'implemented' | 'drifted'` to add `'proposed'` — the live registry already has an entry with `"status": "proposed"`, currently outside the declared type.
- Add an optional `--id <value>` flag: when passed, use it verbatim instead of `slugFromPath(filePath)`. `slugFromPath` stays the default for every other caller (`variant-feature.ts` unaffected). Needed because the 4 current registry entries have hand-authored `YYYY-MM-DD-`-prefixed ids that bare `slugFromPath()` can't reproduce for undated filenames.

**New: `scripts/spec-backfill.ts`** — follows `scripts/validate-docs-links.ts`'s shape (shebang, `@version`/`@description`/`@usage` header, `WORKSPACE_ROOT` via `import.meta.dir`, flag parsing, counter accumulation + summary).

1. Glob `docs/designs/*.md`; skip files already present in `registry.specs[].file`.
2. Compute `date` by priority: (a) `YYYY-MM-DD-` filename prefix, (b) header field matching `**Date**:`/`**Created**:` (case-insensitive), (c) fallback `git log --follow --format=%ad --date=short -- <file> | tail -1`.
3. Compute `status` by parsing a `**Status**:` header field, mapping free text to the registry enum; **default `implemented`** when absent (historical docs describing shipped work) — print a distinct summary line listing every file that hit this default, so a human can spot-check rather than trust it silently for all ~44.
4. Compute `id` as `YYYY-MM-DD-<slug-from-filename>`.
5. Register via subprocess, reusing the existing CRUD (same pattern `variant-feature.ts` already uses): `execFileSync('bun', ['scripts/spec-register.ts', '--file', filePath, '--source', 'manual', '--status', mappedStatus, '--id', computedId])`.
6. `--dry-run`: print planned `(file, date, status, id)` tuples, no writes.
7. `--check`: read-only drift-report mode (no writes, non-zero exit if any file unregistered) — idempotent and re-runnable, so wire `bun scripts/spec-backfill.ts --check` into the existing Weekly Health Check checklist (`docs/constitution/09-operations-workflow.md`) alongside `agent-lifecycle-audit.ts`/`skill-lifecycle-audit.ts`, closing the loop so the gap can't silently reaccumulate.

**Registration**: add `scripts/SCRIPTS.md` rows for `spec-backfill.ts` (new, v1.0.0) and update `spec-register.ts`'s row (version → 1.1.0, flags → add `--id`). Regenerate `scripts/README.md` via `bun scripts/generate-scripts-readme.ts` (never hand-edit — it's generated).

**ADR**: `docs/adr/0055-spec-registry-enforcement.md`, mirroring ADR-0054's structure (Status/Date/Deciders header; Context citing the gating bug + empty-registry problem; Decision covering the Stage-1 fix and the Stage-2 blocking flip with its exemption mechanism; Consequences/Migration section documenting the soak-then-block rollout). Status starts **Proposed**, flips to Accepted only when Stage 2 ships.

---

## Part B — project-to-variant.ts Hardening (implemented)

**`scripts/project-to-variant.ts`** (161 lines, v1.0.3 → 1.1.0). Diagnosis conclusion: this is the actual bottleneck in the "existing project → variant" path — no complexity gate, and its "Manual Review Checklist" (current lines 148-157) is printed text, never executed. Not rewritten into a clone of the 1143-line `l3-to-variant-pipeline.ts` (dual-maintenance, against this workspace's own simplicity-first principle) — instead, close the specific gaps:

1. **Complexity/divergence routing check**, run right after arg parsing, before any copying: if `variantUnique.length` exceeds a threshold (default 40, override via `--threshold-files`) or the source has >3 large (>15-file) directories absent from `templates/common/`, print a routing message pointing at `l3-to-variant-pipeline.ts` (mentioning ADR-referenced review via `docs/adr/templates/variant-creation-template.md`, anti-swelling via `validate-templates.ts`, platform-parity via `validate-platform-parity.ts` — not claiming an automated ADR gate exists, since it doesn't; only the convention/template does) and abort unless `--force` is passed.
2. **Auto-run `spec-register.ts`** when `--design-doc <path>` is passed (can't be auto-discovered; otherwise the checklist line stays manual).
3. **Auto-run `regenerate-agents-md.ts --variant <target>`** (and `--dry-run --variant <target>` under dry-run) to replace the "update AGENTS.md roster" checklist line — reuses the existing script rather than reimplementing frontmatter/table generation.
4. Keep only genuinely judgment-based items printed: `pm.md` override review, `CLAUDE.md`/`GEMINI.md` narrative context update.
5. Fix `skills/project-to-variant/SKILL.md`'s stale CLI usage section (currently documents `<project-path> [--name ...] [--type ...]`, which doesn't match the actual `--source`/`--target`/`--dry-run` flags) and document the new routing behavior.
6. `scripts/SCRIPTS.md`: bump the `project-to-variant.ts` row. Regenerate `README.md`.

**Found during implementation**: the auto-generated `variant.json`'s `agents`/`skills` fields were plain string arrays (`["lead"]`), but `regenerate-agents-md.ts` expects `{name, file}` objects (`variant.agents.map(a => a.name)`) — matching the canonical schema already used by every real variant (e.g. `templates/co-abap/variant.json`). This was silent/unnoticed before because nothing previously consumed `project-to-variant.ts`'s generated `variant.json` with `regenerate-agents-md.ts`; wiring them together in step 3 surfaced it. Fixed as part of this PR (not a separate follow-up) since step 3 doesn't work correctly without it.

---

## Verification

**Part A (this PR):**
- `bun scripts/audit.ts --spec-check` on a scratch diff under `scripts/` with no recent spec activity → the relevance `Warn()` must fire (confirms the gating-bug fix reaches the block).
- Run `dev-sync.ts` (or `/sync`) and confirm spec-check output now prints (not swallowed).
- `bun scripts/spec-backfill.ts --dry-run` → inspect the full `(file, date, status, id)` table; spot-check a handful against actual file headers/git history.
- `bun scripts/spec-backfill.ts` (real run) → `bun scripts/spec-register.ts --list` shows ~48 entries. Re-run → 0 newly-registered (idempotency).
- `bun scripts/spec-backfill.ts --check` → exit 0 once fully backfilled; add one new undated design doc and re-run → non-zero exit, file listed.
- Full `bun scripts/audit.ts` run stays clean; `bun run test:unit` / `bun run test` still pass.

**Stage 2, when executed:**
- `bun scripts/audit.ts --spec-check --lifecycle-only; echo $?` on an unregistered code diff → non-zero exit.
- Same diff with `--spec-exempt=E3` → passes, exemption logged.
- `bun scripts/dev-sync.ts` hard-stops on a real unregistered change; ADR-0055 flips to Accepted; full `audit.ts` still clean.

**Part B, when executed:**
- `bun scripts/project-to-variant.ts --source <small fixture> --target co-test --dry-run` → complexity gate does not trigger; dry-run output lists planned `regenerate-agents-md.ts`/`spec-register.ts` calls without executing them.
- `bun scripts/project-to-variant.ts --source <fixture with many custom dirs> --target co-test2` (no `--force`) → aborts with the routing message.
- Real run against a disposable fixture → `bun scripts/validate-templates.ts` and `bun scripts/agent-lifecycle-audit.ts` confirm the regenerated `AGENTS.md` is well-formed.
- Full `bun scripts/audit.ts` clean.

---

## Files Changed (this PR — Part A only)

| File | Type | Change |
|------|------|--------|
| `scripts/audit.ts` | Modified | Fix `--spec-check` gating bug; fix relevance logic |
| `scripts/dev-sync.ts` | Modified | Remove `.quiet()` from spec-check call site |
| `scripts/spec-register.ts` | Modified | Add `proposed` to `SpecStatus`; add `--id` flag (v1.0.1 → 1.1.0) |
| `scripts/spec-backfill.ts` | New | Retroactive registration + `--check` drift mode (v1.0.0) |
| `scripts/SCRIPTS.md` | Modified | Register `spec-backfill.ts`; update `spec-register.ts` row |
| `scripts/README.md` | Generated | Regenerated via `generate-scripts-readme.ts` |
| `docs/constitution/09-operations-workflow.md` | Modified | Add `spec-backfill.ts --check` to Weekly Health Check |
| `docs/adr/0055-spec-registry-enforcement.md` | New | Status: Proposed |
| `docs/specs/registry.json` | Modified | ~44 backfilled entries + self-registration of this doc |
| `CHANGELOG.md` | Modified | `[Unreleased]` entry |

## Out of Scope

- True per-file spec-to-code mapping (relevance stays diff-recency-based).
- Rewriting `project-to-variant.ts` into a clone of `l3-to-variant-pipeline.ts`.
- Automated ADR-gate enforcement in the L2 pipeline (documented gap, not addressed here).
- LLM-based spec-vs-code consistency validation (already out of scope in the 2026-06-24 predecessor design; still out of scope).
