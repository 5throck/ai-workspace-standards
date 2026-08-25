# Template Dependency Auto-Sync Design

**Date**: 2026-08-25
**Status**: implemented (PR #693, follow-up to the manual mirror in PR #692)
**Scope**: L0 tooling — `scripts/sync-template-deps.ts`, `scripts/dev-sync.ts` step 4.52, `scripts/audit.ts` mirror check
**Spec registry**: `2026-08-25-template-dep-auto-sync-design`

---

## 1. Context

Dependabot's `bun`-ecosystem configuration (root `/` only, activated in PR #685) bumps versions in the **root** `package.json` only. `templates/common/package.json` — the SSOT copied verbatim into every scaffolded project's `package.json` by `create-l3-scaffold.ts` / `new-project.ts` — had no version-sync mechanism at all (verified: no dependency-block comparison anywhere in `scripts/` or `tests/` before this design). The first two dependabot PRs (#686 `@types/node` 26.2.0, #687 `js-yaml` 5.3.0) therefore left the template layer stale, and the mirror had to be landed by hand in PR #692.

Since repo-level GitHub Actions is disabled, post-merge automation on GitHub is not available. The sync point is the local `/sync` pipeline — the single mandatory pathway for every workspace commit.

## 2. Requirements

1. After a root dependency bump merges, the **next `/sync`** brings `templates/common/package.json` (and `bun.lock`) back in sync automatically — no manual step.
2. A standalone gate catches manual bypasses (template edited without running the pipeline).
3. Scaffolded-project contract preserved: root-only dependencies must NOT be added to the template.
4. L1/L3 contexts (scaffolded projects) must not break — the mechanism is L0-only.

## 3. Decision — shared-dep-keys-only alignment

The chosen contract aligns versions **only for dependency keys that exist in both files**:

- **Shared keys** (root ∩ template, `dependencies` + `devDependencies`): template version := root version, exact string comparison. Range-format differences (`^5.3.0` vs `5.3.0`) count as drift; `--apply` normalizes to the root's formatting (stable, since dependabot maintains root formatting).
- **Root-only keys** (e.g. `semver`, `@types/js-yaml`): **never added**. The contract test requires `@types/js-yaml` absent (js-yaml 5.x ships built-in types); root-only deps serve workspace tooling, not scaffolded projects.
- **Template-only keys**: **never removed**. Removal changes what scaffolded projects receive — a manual decision, reported as informational output only.
- **`engines`**: shared fields aligned (future-proofing; currently identical).

## 4. Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Extend dependabot `directories:` to templates | Owner decision 2026-08-25: no change. Duplicate bump PRs (root + template) would race and still need a lock regen step; single-SSOT alignment from root is simpler. |
| Add root-only deps to the template for symmetry | Breaks the scaffolded-project contract (`@types/js-yaml` must stay absent per `tests/package-json-contract.test.ts`). |
| Audit checks `bun.lock` freshness | Parsing bun's internal lock format is brittle and install-dependent (offline runs would fail spuriously). `--apply` owns lock regeneration; the audit checks the declarative `package.json` only. |
| Auto-remove template-only deps | Too aggressive for an unattended pipeline — changes scaffold output without a human decision. |
| GitHub Actions post-merge workflow | Repo Actions disabled since ~2026-08-21; also the wrong sync point — the template must heal before the *next* PR builds on it, not after main moves. |

## 5. Mechanism

### 5.1 `scripts/sync-template-deps.ts` (1.0.0, registry scope L0)

- Pure core `alignTemplateDeps(rootPkg, templatePkg)` — no fs, mutates the template object in place, preserves key order; returns `{changed[], rootOnly[], templateOnly[], enginesChanged}` (unit-testable).
- CLI `--check` (default): reports drift, exit 1, writes nothing.
- CLI `--apply`: rewrites `templates/common/package.json` (`JSON.stringify(pkg, null, 2) + '\n'`, LF) and regenerates `bun.lock` via `Bun.spawn(['bun', 'install'], {cwd: 'templates/common'})`. Install failure = exit 1 (fatal) — a stale lock can never land silently.
- L1/L3 guard: exits 0 with a skip notice when `templates/common/package.json` is absent.

### 5.2 `dev-sync.ts` step 4.52 (1.7.5)

Runs `--apply` between propagate (4.5) and marker-rewrite (4.55), gated on workspace-root context (same shape as the propagate step's gate). Healed files are swept into the same commit by the step-6 `git add -A` — which is exactly how the post-dependabot self-heal lands. Failure is FATAL (same posture as 4.5/4.7).

### 5.3 `audit.ts` mirror check (2.23.0)

`checkTemplateDependencyMirror()` (modeled on `checkVariantJsonSchema()`): compares shared dep keys root↔template, FAILs on drift with the heal command (`bun scripts/sync-template-deps.ts --apply`) in the message. In the normal flow 4.52 heals first, so this gate fires only on manual bypasses. Skipped when the template package.json is absent (L1/L3).

### 5.4 L1 mirror hygiene

`sync-template-deps.ts` is registered scope **L0** — `propagate-to-templates.ts` auto-skips it for the L1 copy (same rule that keeps `propagate-to-templates.ts` itself L0-only). The two L0-only references inside the L1 mirrors' code strings are whitelisted in `lifecycle-sync-audit.ts` `INTENTIONAL_CROSS_REFS` (`dev-sync:sync-template-deps`, `audit:sync-template-deps`).

## 6. Verification record (2026-08-25, PR #693)

- Unit: `tests/unit/sync-template-deps.test.ts` 7/7 (shared-key update + key-order preservation, root-only not added, template-only not removed, in-sync no-op, range-format drift, devDependencies drift, engines).
- Contract: `tests/package-json-contract.test.ts` 6/6, including live root↔template shared-version equality and `--check` exit 0 via spawn.
- Negative cycle: injected `js-yaml ^5.2.0` → `--check` exit 1 with drift report → `--apply` healed + lock regenerated → re-check exit 0, working tree clean.
- `propagate-to-templates.ts --dry-run`: script excluded from the L1 copy list (L0 layer skip confirmed).
- `verify-scripts.ts` 161 registered / 0 hard warnings; `lifecycle-sync-audit.ts` all-pass; `audit.ts` all-pass.

## 7. Follow-ups

- None open. Scaffolded `Projects/<name>` repos (separate repositories) do not receive this automation by design — it lives in the workspace pipeline only; project porting stays on-demand.
