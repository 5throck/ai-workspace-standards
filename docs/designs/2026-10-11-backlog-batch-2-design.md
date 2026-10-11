# Backlog Batch 2 — 2026-10-11 specialist implementation — Design

- **Spec ID**: 2026-10-11-backlog-batch-2-design
- **Date**: 2026-10-11
- **Status**: implemented
- **Tickets**: U-20261008-001, U-20261009-001, T-20261011-005, T-20261011-006, T-20261011-007, T-20261011-008, T-20261011-010, T-20261011-011, T-20261011-013 (9 tickets, one batch per the orchestrator's process-all directive)
- **Method**: specialist implementation batch (automation-engineer + docs-writer scope); small fixes first, learning guides, then the co-abap hardening backport bundle.

## Summary

Nine backlog tickets landed in one batch: two upstream fixes to the sync/gate tooling
(descriptive commit messages; third-party tool-skill gate exemption made fresh-scaffold-safe),
one tooling adoption (merged-branch cleanup workflow), three learning captures as guides
(house precedent from the 2026-10-08 sweep: learning tickets land as guides, not skills),
two hygiene fixes (co-safety fork coherence; co-deck scratch-file leak), and the co-abap
proxy-seam/deny-rules hardening backport to `templates/co-abap` — the promotion decision
for T-20261011-013's blocked 0.16.0 upgrade.

## Per-ticket decisions and actions

| Ticket | Decision | Action |
|--------|----------|--------|
| U-20261008-001 | Weak commit shapes (no message, bare `chore: update`, bare `chore: upgrade template to X`) are replaced at composition time; descriptive caller messages kept verbatim. Derivation must run at the TOP of dev-sync so the language gate, PR slug, commit, and PR title all see ONE message; the early `git diff --cached` snapshot equals the later step-6.5 task-staged snapshot (nothing stages in between). | New pure helper `scripts/helpers/commit-message.ts` (`isWeakCommitMessage`, `deriveCommitMessage`, `composeCommitMessage`; primary path-group picks `type(scope)`, `docs/designs` changes cite the spec id while a 72-char budget allows, fallback `chore: workspace sync (<n> files)`). dev-sync.ts 1.25.0 → 1.26.0 wires it before the language gate. Tests: `tests/unit/commit-message.test.ts` (12 cases). L1 mirror regenerated scrub-canonical + helper copied. Registry rows in both SCRIPTS.md files. |
| U-20261009-001 | The exemption infrastructure already existed (T-20261002-001: `docs/self-managed-surfaces.json` + `scripts/lib/self-managed-tools.ts` + verify-platform-lifecycle consumption) but was L0-only: the docs propagation domain is disabled (ADR-0069) and the propagator deliberately skips self-managed paths, so a FRESH scaffolded project loads an empty registry and a graft install re-blocks every /sync — the ticket's exact repro. Fix belongs in the shared loader, not per-check. | `scripts/lib/self-managed-tools.ts` 1.1.0: built-in `DEFAULT_SELF_MANAGED_PATHS` (the graft surfaces: 5 platform mirrors + helpers + `skills/graft/`) applies with or without the registry; registry entries and `SELF_MANAGED_SURFACES_EXCL` (comma-separated env) can only ADD — no path can be un-excluded (fail-safe). verify-platform-lifecycle.ts 1.6.1 (doc of the default). audit.ts 2.53.0 (Fail hint names the escape hatches; the audit.ts failure was its verify-platform-lifecycle subprocess — no audit-native check fails on graft). Tests: `tests/unit/self-managed-tools-default.test.ts`. Delivery note: co-newbiz's registry copy arrived project-side (commit a6de32aa), not via upgrade — the built-in default is what closes the fresh-scaffold gap without changing the delivery architecture. |
| T-20261011-005 | Port template-side only; repo-side activation of the workflow in THIS repo needs separate user approval (live CI edits are out of a specialist batch's scope). | `templates/common/.github/workflows/delete-merged-branches.yml` ported verbatim from Projects/co-abap (source had zero project literals) + provenance comment header. Top-level `permissions: {}` with per-job `contents: write`, event leg only for merged same-repo PR head refs, manual `workflow_dispatch` sweep with `dry_run` default true, untrusted refs via env, 404/422 tolerance. **Upgrade delivery verified empirically**: `resolveClaim('.github/workflows/delete-merged-branches.yml')` → `{policy: SYNC, pass: TEMPLATE TREE SYNC}` — new workflow files DO deliver to existing projects on upgrade (only `ci.yml` has the special MERGE claim); no upgrade-policy change needed. |
| T-20261011-006 | Learning capture → guide (not a new skill; strongest-candidate note recorded). Cites co-abap as the permission-integrity instance and co-learning (PR #13, output-encoding XSS) as the parallel allowlist-strictness instance without claiming either covers the other. | `docs/guides/agent-shell-hardening.md` (65 lines, checklist-shaped): tiered enforcement (server-authz > server feature flags > proxy gate; docs are guidance), outside-repo HMAC-signed single-use input-hash-bound /dev/tty-confirmed approvals, integrity seal dropping to read-only, unknown-tool-fails-closed, deny-rule SSOT + parity validator, residual-risk honesty. |
| T-20261011-007 | Learning capture → guide. Covers ADR-0007's grant model + ADR-0005 D4's command SSOT. `templates/co-abap/scripts/co-abap/dispatch-parallel.ts` predates the grant model — upgrading the dispatcher itself is deferred (see Deferred). | `docs/guides/parallel-dispatch-grants.md` (51 lines): rows typed read/write, exact-object scope on write rows, dispatcher stops for a grant, out-of-scope denied, grant revoked at run end, per-row worktrees, SIGTERM→10s→SIGKILL, missing ceiling fails closed to R0, commands single-sourced + rendered + `--check` CI gate, "ask means deny" identical across platforms. |
| T-20261011-010 | Learning capture → guide (low priority, data-lifecycle/UX pattern). Evidence read at source: co-newbiz PR #489 + migration 0133_business_case_archive.sql + `business-case-cleanup.ts`. | `docs/guides/record-lifecycle-hygiene.md` (43 lines): archive-don't-delete (nullable `archived_at/by`, drops from lists/predicates, resolves by id in decision views with a label) + enumerate-before-cleanup (the confirmation predicate and the action predicate must be the same query; aggregate counts never substitute for the enumerated set). |
| T-20261011-011a | The coherent side is the fork BODY: the port added the `upgrade-project` bullet to Related Skills (SKILL.md:254-255) and the diagnose→sync→deliver→verify loop needs it; root's `related_skills` also declares it. The frontmatter omission and the design doc's "no `upgrade-project` related_skill" keeper note were the stale side. | `templates/co-safety/skills/project-review/SKILL.md` frontmatter `related_skills` gains `upgrade-project`; version 1.3.3 → 1.3.4, last_reviewed 2026-10-11; all 5 platform mirrors re-copied (fork convention: byte-identical, parity by hash); `templates/co-safety/skills/SKILLS.md` row updated. `docs/designs/2026-10-09-co-safety-ahead-deltas-port-design.md` fork-keeper phrase corrected to declare the related_skill, with a dated correction note. |
| T-20261011-011b | The helper is a RUNTIME-GENERATED scratch artifact: `theme-visual-regression.browser.mjs` `discoverMatrix()` writes it fresh (with the CURRENT machine's absolute paths) into `presentations/_smoke_test/` on every VR run — the tracked copy was dead weight whose only consumer overwrites it. Removal + gitignore beats rewriting (a committed generated file can never stay correct). | Deleted `templates/co-deck/presentations/_smoke_test/_vr_matrix_helper.mjs`; workspace `.gitignore` gains `templates/co-deck/presentations/_smoke_test/` so the scratch dir can never be committed again. No Surfaces-row addition: the file no longer exists; the generating test is its documentation. (The "Surfaces" list the ticket referenced lives in the co-deck injector-promotion design, whose surfaces are the injector's — unrelated to this helper.) |
| T-20261011-008 + T-20261011-013 | The promotion decision (user's process-all directive): backport the co-abap hardening wave (project PRs #194-196, ADR-0005/0006/0007) to `templates/co-abap`, security posture only — phase/roster content untouched. The variant's version convention: `variant.json` `version` has stayed `1.0.0` through every content patch since the 2026-08-15 migration (verified via git history) — the 0.16.x line is the RELEASE pipeline's version, produced when the release runs, so no template-side version bump is invented here. | See the bundle section below. |

## The co-abap hardening backport bundle (T-20261011-008 + T-20261011-013)

Promoted from Projects/co-abap (layout-preserving so project-relative paths in MCP
configs, execpolicy rules, and CI keep working after delivery):

- **Deny-rules SSOT** (a): `config/platforms/protected-paths.json` (579 lines, ~40
  entries with per-platform renderings + documented manual notes for hermes/antigravity)
  and `config/sap-action-policy.json` verbatim; plus `config/platforms/hermes-mcp.example.yaml`.
- **Proxy seam** (b): `scripts/sap-mcp-proxy.ts` (611), `scripts/lib/sap-action-lib.ts`
  (1028), `scripts/hooks/sap-action-gate.ts` + `sap-action-audit.ts`, `scripts/sap-approve.ts`,
  `scripts/sap-integrity.ts` — placed at the template's `scripts/` flat level so they
  deliver to project `scripts/` exactly where the project's configs and deny rules
  reference them (`resolveClaim('scripts/...')` → SYNC/SYNC_IF_NEWER; the variant
  `scripts/co-abap/` subdir registry is untouched). `.mcp.json` (new) routes `abap`
  through `bun scripts/sap-mcp-proxy.ts -- --mode hyperfocused`; `.claude/settings.json`
  and `.gemini/settings.json` re-rendered from the SSOT: proxy launch (no direct `./vsp`,
  no per-feature env — the proxy + `.env` own configuration, safe defaults, `.env` may
  only narrow), Gemini `terminal.executionPolicy: Off`, deny lists rendered
  (claude 113 entries ⊆ project's 114; gemini denyList 78 / tools.exclude 68 — direct
  from the SSOT, a superset of the project's older render), `.geminiignore`,
  `.gemini/settings.json.sample`, `.codex/config.toml` + `.codex/rules/default.rules`
  (ADD_IF_MISSING claim, co-abap/co-safety own their codex surfaces per ADR-0076),
  `.agents/mcp.json`, `docs/platform-setup/{hermes,antigravity}.md`.
- **Parity validator** (d): `scripts/validate-platform-parity.ts` promoted (v1.0.0 →
  1.1.0) with a profile-aware adaptation contract: universal surfaces (`.mcp.json`,
  `.claude/settings.json`, `.gemini/settings.json`, `.agents/mcp.json`, `config/**`)
  stay fail-on-missing; surfaces a platform profile legitimately omits (`.codex/**`,
  unselected instruction files, skill mirrors, `docs/workspace-schema.json` in a bare
  template tree, `config/commands`) SKIP when absent and enforce when present.
  `checkCommands` imports `render-commands` lazily against the TARGET root (the command
  SSOT is optional here — importing it statically would crash where absent).
  `INSTRUCTION_FILES` widened to include `AGENTS.md` (universal carrier) — the variant
  enforces the SAP-safety sections on the surfaces it ships.
- **Instruction sections**: `AGENTS.md` gains §7.1 (SAP safety proxy & approvals,
  deny-rule SSOT pointer, parallel dispatch grants); `HERMES.md` gains sections 7/8
  inside the COMMON-HERMES managed block — matching the project's placement, which is
  the only merge-surviving location (managed-block content is template-authored).
- **CI** (c): `templates/co-abap/.github/workflows/ci.yml` variant overlay = common
  ci.yml + Typecheck (guarded on `hashFiles('scripts/tsconfig.json')` — the template
  does not mandate a tsconfig; the project ships one) + docs-links validation +
  `validate-platform-parity`. The project ci.yml's "Check project meta" step was NOT
  ported: `scripts/check-project-meta.ts` is project-side only (not in L0/L1 script
  delivery) and would fail fresh scaffolds — it lands with the release that promotes
  the script, if ever.
- **Pre-existing mirror drift fixed to make the template battery green**: the promoted
  validator surfaced `skills/abap-dev/SKILL.md` (5 mirrors) and `skills/dump-monitor/SKILL.md`
  (2 mirrors) differing from the `skills/` SSOT — stale path-shape (`scripts/vsp-audit.ts`
  vs SSOT's project-correct `scripts/co-abap/vsp-audit.ts`) and stale wording. Mirrors
  re-synced from the SSOT (the established projection direction). No content decision
  was made — SSOT wins by convention.
- **Registry**: `docs/co-abap.context.md` script table gains rows for the four promoted
  entry points. The variant `scripts/co-abap/SCRIPTS.md` registry and
  `variant.json` `script_manifest` are deliberately untouched (the promoted scripts are
  flat variant-overlay scripts, outside that registry's `scripts/co-abap/` scope).

## Conventions

- Core-script edits (dev-sync.ts, audit.ts, verify-platform-lifecycle.ts, SCRIPTS.md)
  follow the L1 mirror rule: root is edited first, `templates/common/` mirrors are
  regenerated scrub-canonical (`scrubConstitutionRefs`) or via
  `bun scripts/generate-scripts-mirror.ts` for the registry span.
- All new/changed text is English; conventional-commit shaped where messages are composed.
- Every promoted file was scanned for machine-specific absolute paths (none).
- Learning tickets land as `docs/guides/` per the 2026-10-08 house precedent.

## Skipped / deferred items (with reasons)

- **Repo-side workflow activation** (`delete-merged-branches.yml` in THIS repo's
  `.github/workflows/`): needs separate user approval — live CI edits are out of scope
  for a specialist batch. Template-side only.
- **Release + project upgrade** (T-20261011-013 resolution path): the release pipeline
  was NOT run and Projects/co-abap was NOT upgraded (template-side only, per directive).
  Follow-up: run the release for the co-abap template, then re-run the co-abap 0.16.0
  upgrade — the upgrade will now carry the hardening instead of reverting it.
- **`dispatch-parallel.ts` grant-model upgrade** (T-20261011-007's "template
  enhancement" half): the template's dispatcher predates the grant model; the guide
  captures the pattern, the dispatcher rewrite is a separate change with its own test
  surface.
- **Instruction-file sections for CLAUDE/CODEX/GEMINI** (project-side content): the
  per-platform SAP sections live in the project's instruction files; template-side they
  are carried by AGENTS.md (universal) + HERMES.md (variant overlay). Extending the
  common managed blocks or creating CLAUDE/CODEX/GEMINI variant forks is an
  instruction-content release of its own.
- **`check-project-meta.ts`** promotion: project-side script, no delivery path; its CI
  step is intentionally absent from the overlay.
- **Pre-existing project finding, not addressed here**: Projects/co-abap's own
  `validate-platform-parity.ts` reports 7 orphan `.gemini/commands/*` render targets
  (commands-rendered check) — project-side drift that predates this batch; the promoted
  validator surfaces the same signal faithfully.
- **Template version**: no `variant.json`/registry version bump — the variant's own
  convention keeps `1.0.0` across content patches; the 0.16.x number belongs to the
  release pipeline.

## Verification

- `bun test tests/unit/commit-message.test.ts` (12) + `tests/unit/self-managed-tools-default.test.ts` (5) + existing `verify-platform-lifecycle.test.ts` — green.
- `bun scripts/validate-variant-claims.ts --template co-abap` — PASS, 0 findings (33 warnings, 2 skipped checks are pre-existing skip-conditions).
- `--template co-safety`, `--template co-deck` — PASS, 0 findings.
- Promoted validator: `--root templates/co-abap` PASS (6/6); `--root Projects/co-abap` 5/6 (commands-rendered fails on the pre-existing project-side orphan findings identical to the project's own validator output).
- Full gate (audit --spec-check, bun test tests/unit/, verify-scripts --check-drift,
  verify-skill-graph, VERSION_MANIFEST regeneration) run at batch end — see the final report.
