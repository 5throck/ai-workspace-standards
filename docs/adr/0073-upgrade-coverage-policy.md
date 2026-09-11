---
status: Accepted
date: 2026-09-11
author: PM
---

# ADR-0073: Policy-Driven Upgrade Coverage — Deliver-By-Default Template Sync

## Context

Project upgrades (`scripts/upgrade-project.ts`) and project scaffolding (`scripts/new-project.ts`) had structurally different coverage models. Scaffolding delivers the template surface **by construction** — it copies the whole `templates/common` tree, overlays the variant, and prunes known staging areas — so any file added to the template automatically reaches new projects. Upgrades delivered by **enumeration**: a dozen fixed passes, each with hardcoded file/dir lists. Three consequences followed:

- Template files with no claiming pass were **silently never delivered** to existing projects. The 2026-09-11 fleet investigation verified gaps across most of the variant `docs/` tree (`user-guide(+_ko)`, `handoff-spec(+_ko)`, `VERSION_MANIFEST.md`, `skill-graph.overrides.json`, variant domain docs, `countries/KR.md`), plus `.github/**`, `.claude`/`.gemini/settings.json`, `.editorconfig`, platform `skills.json`, and `SECURITY.md`.
- Coverage was maintained **reactively**: every gap-filler pass (GOVERNANCE FILES, VARIANT ASSET DIRS, PROCEDURES, …) documents in its own header the incident that forced it. The failure mode "a hardcoded list goes stale" could not be fixed by adding entries to lists.
- Coverage gaps were **undetectable** — nothing compared the template surface against what the upgrade passes actually deliver.

## Decision

Invert the default. Classification for every project-relative path lives in one SSOT, `scripts/lib/upgrade-policy.ts`: `resolveClaim(relPath, variant)` returns a `{policy, pass}` claim whose **fallback is `SYNC` — deliver by default** (deny-list, not an allowlist manifest; a manifest would re-create the stale-enumeration bug it replaces).

1. **TEMPLATE TREE SYNC pass** (`upgrade-project.ts` v1.21.0+) delivers exactly the files whose claim names it:
   - `SYNC` — add-if-missing, then inline `*<file> version: X.Y` / MD5 hash update with the standard conflict warning on locally-modified files (the contract of every pre-existing sync pass).
   - `WORKSPACE` — `docs/{designs,drafts,reports,research,findings,threat-models,lifecycle}` seeds are add-if-missing; project artifacts there are never overwritten or pruned.
   - `JSON_MERGE` — `.claude`/`.gemini/settings.json` deep-merge with template winning conflicts and **arrays unioned so project-only entries (e.g. permission grants) survive**.
2. **Scaffold parity is normative**: the effective tree is variant-over-common, and the zones the scaffold deletes post-overlay (`docs/{adr,specs,variants,_templates,_examples,_common}`, `agents/{lifecycle-manager,_COMMON,pm.md.backup}`, `*.cmd`) are `TEMPLATE_ONLY` — never upgrade-delivered. `PRESERVE` (root README, `CHANGELOG.md`, `docs/README(+_ko)`, `.env.sample`) and `PROJECT_STATE` (`package.json`, `bun.lock`, `variant.json`, `memory/`, `countries/ACTIVE.md`) are never touched.
3. **The coverage gate is audit-enforced** (v2.34.0): `audit.ts` auto-activatingly spawns `check-upgrade-coverage.ts --strict` (same convention as the ADR-0060 skill-graph drift gate), failing on `{{UPPER_SNAKE}}` placeholders in delivered files, WS-07 contamination (`docs/context.md` inside a variant template), and broken `JSON_MERGE` targets. The checker self-skips outside the workspace root.
4. **Legacy lists fold into the engine** (v1.22.0): VARIANT_DOCS_SYNC's five files are claimed by the default `SYNC` policy — identical semantics, one less duplicated list — with a regression test pinning the fold. GOVERNANCE FILES and the `docs/_common` overwrite stay dedicated on purpose: their forkable add-if-missing / flattened-overwrite semantics differ from the default branch (design doc §10).

## Consequences

- **Positive**: adding a template file without any governance decision still reaches existing projects; the "limited upgrade" incident class is closed structurally, and misclassification attempts (staging-zone content, placeholder leakage) fail audit instead of shipping silently.
- **Cost**: `SYNC` overwrites locally-modified reference docs **with a warning** — the standing contract of every prior pass; the pre-upgrade stash and git history remain the recovery path. High-volume reference assets (e.g. co-deck `docs/html-themes/`, ~190 files) now hash-sync on upgrade (MD5 cost is negligible).
- **Maintenance**: the drift risk moves from "template file with no pass" to "policy lib vs legacy pass literals"; unit tests parse the script's remaining array literals (`GOVERNANCE_FILES`) and assert lockstep with the lib. A regression test pins the VARIANT_DOCS_SYNC fold.
- **Neutral**: files already owned by dedicated passes (agents/skills/scripts version gates, procedures, commands) keep their existing behavior — the new pass delivers only previously-unclaimed paths.

## References

- Design: `docs/designs/2026-09-11-upgrade-policy-coverage-design.md` (D1–D8, §10 Phase C addendum)
- CONSTITUTION §6.5 Script Lifecycle (layer model — the upgrade trio is `L0`-only; see Amendment 1)
- ADR-0060 (auto-activating audit gate precedent), ADR-0031 (L1/L2 fork model — upgrade philosophy), WS-07 (variant `docs/context.md` prohibition)
- SSOT: `scripts/lib/upgrade-policy.ts`; gate: `scripts/check-upgrade-coverage.ts`; delivery: `scripts/upgrade-project.ts` v1.22.0
- PRs #876 (Phases A+B), #877 (Phase C), #878 (ADR + docs)

## Amendment 1 (2026-09-11): the upgrade trio is `L0`-only

Adoption shipped `upgrade-project.ts`, `scripts/lib/upgrade-policy.ts`, and `scripts/check-upgrade-coverage.ts` as `L0+L1` so projects could "re-run upgrades from their own copy." That rationale was void: the script resolves the template tree **relative to its own location** (`workspaceRoot = resolve(import.meta.dir, '..')`), so an in-project run looks for `<project>/templates/common`, which never exists — every per-project copy was an inert fossil (already two minor versions stale across the fleet within a day of adoption).

- `upgrade-project.ts`, `lib/upgrade-policy.ts`, `check-upgrade-coverage.ts` are **`L0`-only**; rows stay in the L1 `SCRIPTS.md` registry under the `L0` convention (cf. `new-project.ts`), physical mirrors are removed.
- Upgrades run **from the workspace root** (`bun scripts/upgrade-project.ts Projects/<name>`); from inside a project, invoke the workspace script — `bun ../../scripts/upgrade-project.ts .` — so the upgrader is always the current version (a stale upgrader mutating the project is the worst version-skew possible for the convergence tool).
- `helpers/upgrade-versions.ts` / `helpers/context-sections.ts` remain `L0+L1` (other project-shipped scripts, e.g. `audit.ts`, import them).
- Inert per-project copies retire via `upgrade-project --prune-removed` (scripts absent from the template are pruned; `reconcileScriptRegistry` drops the stale registry row).
