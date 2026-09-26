# SCRIPTS.md — Script Lifecycle Registry

> This file is the Single Source of Truth (Tier 1 SSOT) for every TypeScript script in `scripts/` (workspace root). The registry covers all `.ts` files: top-level CLI scripts run via `bun scripts/<name>.ts` or `bun run <alias>`, as well as internal modules under `scripts/lib/`, `scripts/helpers/`, `scripts/hooks/`, `scripts/validators/`, and `scripts/experiments/` that are imported by other scripts or wired as hooks rather than invoked standalone. These modules are registered here for lifecycle and version tracking even though they have no independent CLI usage.
> Template `templates/common/scripts/` (Tier 2) is a snapshot published from here via `bun run propagate:apply`.
> Project `scripts/` (Tier 3) is a snapshot created from Tier 2 at `new-project` time.
>
> **Machine parsing**: `verify-scripts.ts --verify` reads the `## Registry` section only.
> **Human reading**: see `## Guide` section below for purpose, usage, and deprecation notes.

---

## Architecture: TypeScript-Only Policy (ADR-0036)

> **Policy change (2026-06-11)**: All scripts are TypeScript executed via Bun. The former Tier 1 sh/ps1 bootstrap tier has been abolished. See [ADR-0036](../docs/adr/0036-script-ts-migration.md) for rationale.

## Error Handling Standard (ADR-0054)

> **Policy (2026-08-16)**: Error and exit paths in all scripts MUST use `scripts/lib/error-handling.ts` (`die()`, `fatalError()` + `logError()`, `withSyncErrorHandling()`). Migration is **incremental** — a script migrates when it is otherwise modified (no pure-consistency rewrites). When migrating an L0+L1 script, sync the change to `templates/common/scripts/` in the same commit. See [ADR-0054](../docs/adr/0054-error-handling-standardization.md) and `docs/constitution/08-coding-guidelines.md` §8.11.

All scripts in this workspace are written in TypeScript and executed via `bun`. There is no longer a distinction between "bootstrap" and "ops" tiers — Bun is a hard prerequisite for the workspace and is assumed to be installed before any script runs.

**Single rule**: every new script must be a `.ts` file. No `.sh` or `.ps1` files will be accepted.

**Invocation pattern**:
```bash
bun scripts/<name>.ts [args]       # direct
bun run <alias>                     # via package.json alias (preferred for CI)
```

### Ops & Automation Scripts (Bun/TypeScript)
*   **Purpose**: All scripting tasks — project scaffolding, pipeline, code generation, linting, syncing, lifecycle audits.
*   **Implementation**: Written in TypeScript (`.ts`), executed via the Bun runtime.
*   **Execution**: `bun scripts/<name>.ts` or via `package.json` alias.
*   **Examples**: `upgrade-project.ts`, `cleanup-completed-md.ts`, `audit.ts`, `dev-sync.ts`.

---

## Registry Scope

The registry below intentionally covers top-level `scripts/*.ts` entry points only. The following are deliberately **outside** the registry (helper/internal scope, not standalone lifecycle-managed scripts):

- `scripts/helpers/plugins/*` — plugin modules consumed by registered scripts
- `scripts/helpers/registries/*` — registry data modules loaded by tooling
- `scripts/hooks/_test-*.ts` — internal test fixtures for hook scripts

Their absence from the table is policy-consistent, not an oversight.

## Registry

<!-- verify-scripts.ts parses rows between the Registry header and the next ## header. -->
<!-- Required columns: script | source | version | status | removal-date | security-advisory | layer | pair -->
<!-- status: active | deprecated | experimental -->
<!-- removal-date: YYYY-MM-DD (required when status=deprecated) or —-->
<!-- security-advisory: CVE-XXXX or —-->
<!-- Layer column values (ONLY 2 TYPES USED). L0/L1/L2/L3 here follow
     CONSTITUTION.md's Terminology Definition (L1=templates/common, L2=templates/co-*,
     L3=Projects/*); these Layer values predate that document and use L2 to mean
     "reaches a scaffolded project," which CONSTITUTION.md calls L3 — not renamed here
     since layer-filter.ts and verify-scripts.ts parse these literal strings:
  L0           = workspace root only; must NOT be copied to templates/common/ or L3 projects
  L0+L1        = exists in scripts/ AND templates/common/scripts/; scaffold-copies to L3 at new-project time
  L0+L1+L2     = reserved for future use (Fork Model architecture - not currently used)
-->
<!-- pair: reserved field (was used for sh/ps1 pair tracking — abolished per ADR-0036) -->
<!-- Check A (lifecycle-sync-audit.ts): verifies @version header == registry version (formal consistency only). Semantic content alignment —whether file content actually reflects version history —is NOT verified by tooling. Use git log to confirm content for Type-2 fixes. -->

| script | source | version | status | removal-date | security-advisory | layer | pair |
|--------|--------|---------|--------|--------------|-------------------|-------|------|
| `agent-create.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `agent-delete.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `agent-lifecycle-audit.ts` | L0 | 1.3.1 | active | —| —| L0+L1 | —|
| `agent-list.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `agent-verify.ts` | L0 | 1.0.2 | active | —| —| L0+L1 | —|
| `analyze-git-history.ts` | L0 | 1.0.2 | active | —| —| L0+L1 | —|
| `archive-memory.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `automation-lock.ts` | L0 | 1.0.0 | active | File-based exclusivity lock for the unattended local runners (T-20260926-021, design docs/designs/2026-09-26-runner-lock-retry-enforcement-design.md D1): `acquire <name>` (fails while a live same-host holder exists; dead-pid/foreign-host/corrupt records breakable with --break-stale and re-acquired atomically via `wx` create), `release <name>`, `status [name]`; records live in gitignored .pipeline-state/ as automation-\<name\>.lock (pid+hostname+acquiredAt). Non-goal: cross-host advisory locking (single-operator workspace, D4). Runner wiring: the empty-queue fast path stays lock-free; a non-zero acquire exit means "defer this run, report only" | —| L0 | —|
| `audit.ts` | L0 | 2.45.0 | active | v2.45.0 variant agent sections resolves extends-stubs (spec docs/designs/2026-09-25-registry-policy-completeness-design.md, R2.2): checkVariantAgentSections composes ADR-0033 stub bodies through helpers/resolve-pm-stub.ts composeResolvedAgentContent (pure, no writes) and validates the RESOLVED content; resolved-body failures report against the underlying common file; the section list is imported from helpers/golden-reference-loader.ts AGENT_LAYER1_SECTIONS (inline duplicate deleted); pairs with the `## Output Format` section added to the common i18n-specialist body (R2.3) — the 13 stub WARNs drop to 0. Prior: v2.44.0 marker-zone exemption (spec docs/designs/2026-09-25-variant-hygiene-batch-design.md, R2): checkStalePromotedContent + checkVariantContextCommonization strip COMMON-CONTEXT marker zones (stripMarkerZones, helpers/context-sections.ts 1.7.0) before section-splitting — sanctioned ADR-0062 zone deliveries stop reading as stale leftover duplicates (26 post-heal false WARNs → 0); non-zone duplicates still warn (fixture tests/unit/marker-zone-exemption.test.ts). Prior: v2.43.0 platform verifier expansion (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md, sites 2a-2d): skill-exists sweeps PLATFORM_SKILL_BASES; command parity gains the .codex/prompts mapping leg; zero-width/BOM scan dirs gain .agents/.codex; stale-ref scan gains CODEX.md. Prior: v2.42.0 (scaffold hygiene bundle, spec docs/designs/2026-09-24-scaffold-hygiene-bundle-design.md): live-placeholder WARN names the remediation — fill the placeholder fields in the listed file(s), or re-scaffold with --description/--type to pre-fill docs/project.md; severity unchanged (the nag is designed). Prior: v2.41.0: live-placeholder scan gains docs/project.md — the identity seed joins the per-project WARN scope, same regex family (spec: docs/designs/2026-09-24-scaffold-identity-overview-design.md). Prior: v2.40.0 template-artifact hygiene — warn-only read-only sweep of templates/ for artifact directories; v2.39.0 VERSION_MANIFEST reconciliation gate; v2.38.0 model registry gate | —| L0+L1 | —|
| `bootstrap-stages.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `check-upgrade-coverage.ts` | L0 | 1.0.0 | active | `--variant`, `--strict`, `--json` | —| L0 | —|
| `cleanup-completed-md.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `clear-pm-approval.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/local-date.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `compile-tokens.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `design-lint.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `review-baseline.ts` | L0 | 1.0.2 | active | v1.0.2 (T-20260926-013): --quiet no longer suppresses failure diagnostics — failing validators (name + note + output tail) always print so the 01:30 unattended fleet runner stays triageable; quiet silences passing chatter only | —| L0 | —|
| `helpers/skills-registry.ts` | L0 | 1.2.0 | active | v1.2.0 (registry-policy-completeness batch W5, spec docs/designs/2026-09-25-registry-policy-completeness-design.md R5.1): registry auto-sync machinery — collectRegistryDrift, listSkillDirs, splitRootRegistry, collectCatalogEntries, collectCatalogDrift, syncVariantExclusiveCatalog, syncGenericRegistry, collectWorkspaceRegistryFindings (pure compute shared by the sync CLI, validate-templates VA-08, and unit tests; the root Variant-Exclusive catalog reconciles via a dedicated path — its 7th column is the owner-variant list, not notes). Prior: v1.1.0 (T-20260924-008, spec docs/designs/2026-09-24-skills-registry-overlay-reconcile-design.md): adds collectDeliveredSkills + pruneSkillRegistryRows (fresh-scaffold reconcile half); extractFrontmatterVersionAndReviewed moved in verbatim from upgrade-project.ts. v1.0.0: parse/reconcile project skills/SKILLS.md (T-20260922-001) | —| L0+L1 | —|
| `resync-audit.ts` | L0 | 1.3.0 | active | v1.3.0 (T-20260926-012 + T-20260926-020): porcelain rename guard fixed — git emits ASCII `old -> new`, the old unicode-arrow test never matched so staged renames were mislabeled KEEP "deleted" (parsing extracted to exported `porcelainPath`); an emptied file can no longer corroborate STALE-RESIDUE on mtime alone (zero-line order match is vacuous); untracked-dir expansion skips VCS-ignored build/output dirs (node_modules, dist, coverage, …). v1.2.0 TEMPLATE_DELIVERED_PREFIXES gains .codex/ — .codex/** delivered files join the template-delivery comparison (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 6) | —| L0 | —|
| `skill-graph-fleet-report.ts` | L0 | 1.1.1 | active | v1.1.0: root-graph orphan cross-check in report + snapshot (`rootOrphans`) — graph-isolated root skills/agents crossed with registry/mirror/doc-reference axes (T-20260923-001, 4-way orphan criteria) | —| L0 | —|
| `mcp-governance-server.ts` | L0 | 1.0.0 | active | Stdio MCP server (newline-delimited JSON-RPC 2.0, zero deps) exposing four governance scripts as tools — ticket (list/board/doctor read; move write), audit (--spec-check gate), spec_register (docs/designs/-confined), qa_gate. Safety: execFileSync argv arrays, allowlists, 120s timeout, capped output tails. Harness-neutral ACCESS to the gates, not a new enforcement layer (design D5). Registration documented, never automated: `hermes mcp add governance -- bun scripts/mcp-governance-server.ts` (T-20260925-009, spec docs/designs/2026-09-25-mcp-governance-server-design.md) | —| L0 | —|
| `backport-diff.ts` | L0 | 1.0.2 | active | Backport candidate differ — read-only 5-surface diff of a project's committed LOCAL-WORK (`git diff <base>..HEAD`) against its best-matching template source (variant → common → L0) per docs/designs/2026-08-28-project-template-backport-design.md §Method; emits per-file surface / divergence direction (project-ahead / template-ahead / both-changed / in-sync / project-only) / +added/-removed; project-resync Step 2 support | —| L0 | —|
| `evidence-backport-scan.ts` | L0 | 1.1.0 | active | v1.1.0 F1/M6 skill-dir literals adopt PLATFORM_SKILL_BASES, order provably verdict-irrelevant (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 14). Evidence Backporting scanner — read-only form detection (F1/F2/F3/F0/MIXED) + M1-M6 maturity bar over Projects/co-* evidence planes (ADR-0084 Decision 6, design §4); consumes graph-delta-log.ts output for M2/M4/M6b with git-log fallback; project-resync Step 2b | —| L0+L1 | —|
| `create-l3-scaffold.ts` | L0 | 1.16.0 | active | Step 8.5 graft build: global `graft` first, bunx fallback (spec 2026-09-20-graft-scaffold-resilience) | —| L0 | —|
| `dev-sync.ts` | L0 | 1.20.0 | active | v1.20.0 (T-20260926-021): Step 3.85 VERSION_MANIFEST pre-convergence — audit.ts auto-activates the manifest reconciliation gate on every invocation incl. Step 3.9's --spec-check call, which failed blocking before 4.7 could regenerate whenever a sync bumped script versions; 4.7 stays as final convergence. Prior: v1.19.0 (registry-policy-completeness batch W5, spec docs/designs/2026-09-25-registry-policy-completeness-design.md R5.5): Step 4.63 runs `sync-skill-registries.ts` (apply mode, workspace root only, after the 4.62 cascade re-publish) — every /sync re-converges all skill registry tables with the SKILL.md frontmatter they document; idempotent, crash exits fatal in L0. Prior: v1.18.0 (propagation-engine batch, spec docs/designs/2026-09-25-propagation-engine-batch-design.md T-20260924-001): Step 2.6 runs `generate-scripts-mirror.ts` in write mode (Step 2.5 existsSync + hard-exit idiom) so L1 SCRIPTS.md registry drift cannot land in a /sync commit; Prior: v1.17.1: Step 4.55 also parses the marker-rewrite `Would append: N` counter and WARNs on would-overwrite + would-append, so a pending append cannot hide behind the overwrite-only gate (spec docs/designs/2026-09-25-propagation-engine-batch-design.md R12); Prior: v1.17.0: Step 4.55 marker-rewrite drift-check list gains `constitution-context-pr` + step 6.5 scoped-staging deletion handling — skip index-removed `D`/staged-rename-source paths, batch-add present paths, per-path add for absent ones, fail-closed ghost exit 1 (spec: docs/designs/2026-09-24-constitution-s33-context-injection-design.md Amendment 2 §13); Prior: main-drift pre-flight warning (`--require-current-main` abort) + sanctioned `--conclude-merge` conflicted-merge path (ADR-0081/T-20260918-002) | —| L0+L1 | —|
| `dispatch-parallel.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `dispatch-serial.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `dispatch.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `fix-script-versions.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `gen-pr-body.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `generate-ide-rules.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `generate-l3-readme.ts` | L0 | 1.0.3 | active | —| —| L0 | —|
| `generate-scripts-mirror.ts` | L0 | 1.0.0 | active | v1.0.0 (T-20260924-001, spec docs/designs/2026-09-25-propagation-engine-batch-design.md §6-D6 as amended by §14): generates the templates/common/scripts/SCRIPTS.md registry span from the root registry + the template scripts tree (pure `buildMirrorRegistrySpan` builder; R2-rule proves itself — this L0-only script never appears in its own output; one-time normalization deletes the 81 legacy L0 mirror rows, second-run byte-stable). dev-sync Step 2.6 write mode; lifecycle-sync-audit Check B projection arm. Flags: `--check` | —| L0 | —|
| `generate-scripts-readme.ts` | L0 | 1.0.4 | active | —| —| L0 | —|
| `generate-raci.ts` | L0 | 1.1.0 | active | RACI matrix generator per ADR-0083 P4, ADR-0084 §3.4; derives A/R from procedures, accepts explicit C/I; loads governance/_human-roles.yaml when present; emits actor_types map when registry exists; sets schema_version: "1.1" for registries | —| L0+L1 | —|
| `generate-skill-graph.ts` | L0 | 1.14.0 | active | DEG v1 per ADR-0083; ADR-0084 §3.4: human_role nodes from governance/_human-roles.yaml; actor_type edge attribute on RACI edges (accountable_for, consulted_on, informed_of, step_by_agent); v1.13.0: variant agent discovery skips README*/_ files (co-abap README nodes, T-20260923-001) + Source 4.8 workflow-doc citations — bounded corpus mints `doc:` nodes and `cites_skill` edges so workflow-dispatched skills are no longer graph-isolated; v1.14.0: variant corpus widened (docs/*.md, README.md, agents/**, workflows/**) + path-fragment/README-plain matching — variant isolation 17 → 0 (T-20260923-002) | —| L0+L1 | —|
| `generate-version-manifest.ts` | L0 | 1.8.0 | active | v1.8.0 platform vocabulary: skills gain all/+-combos/single-platform names (both stays claude+gemini exactly); commands gain the all value via the codex prompts mapping; parity-status section names all four surfaces (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 10, D10). Prior: scripts-table sort uses a full-path tiebreaker so basename ties (scripts/x.ts vs scripts/<variant>/x.ts) stop depending on readdir order (macOS vs Linux drift); date-masked `--check` — Last Modified columns excluded from comparison unconditionally (ADR-0081/T-20260918-001); emits `validate-md-language:allowlist` markers around the generated Skills table (T-20260912-015) | —| L0+L1 | —|
| `ensure-github-repo.ts` | L0 | 1.0.0 | active | Pre-adoption GitHub baseline — checks/creates/pushes/verifies: readiness (git+commits+clean+gh auth), github remote detection, `gh repo create` (private default, `--org`/`--public`/`--dry-run`) + push, then mandatory verification (`gh repo view` + `git ls-remote` HEAD-sha match); exit 0 = verified baseline. Spec: docs/designs/2026-09-23-pre-adoption-github-repo-design.md | —| L0 | —|
| `graph-delta-log.ts` | L0 | 1.0.0 | active | Graph Delta Log — compute and persist per-scope structural diffs between committed and derived skill graphs (ADR-0084 §5); two-layer delivery (workspace root + projects); consumed by evidence-backport-scan.ts maturity bar (M2, M4, M6b tests) | —| L0+L1 | —|
| `helpers/beta-lifecycle.ts` | L0 | 1.2.1 | active | —| —| L0 | —|
| `helpers/generate-variant.ts` | L0 | 1.19.0 | active | v1.19.0 (variant hygiene batch, spec docs/designs/2026-09-25-variant-hygiene-batch-design.md R6): copyL0CommonSkills applies the WS-05a adaptation at the delivery seam — adaptL0ToolingReferences swaps the raw L0-only validator line for the workspace-only comment when present, byte-preserving otherwise (stops the per-promotion hand-remediation treadmill). Prior: v1.18.0 (platform-parity P1 bugfixes, spec docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md D6): copyL0CommonSkills → all four platform mirrors (was .claude/.gemini only; promoted variants' .agents/.codex lacked the L0-common trio) | —| L0 | —|
| `helpers/agent-promote.ts` | L0 | 1.1.0 | active | v1.1.0 (T-20260926-020c): hasExtendsDeclaration recognizes the live L2 stub frontmatter (`extends: ../../common/agents/…`) alongside the legacy `# @extends: l1/` line-0 comment — stubs were previously analyzed as standalone bodies, inflating counts; jaccard empty-branch dedup. `--json`, `--help` — ADR-0043 promotion-candidate ANALYSIS (read-only): ≥3-variant agent names, pairwise Role+Responsibilities Jaccard, ≥80% groups reported | —| L0 | —|
| `experiments/infer-graph-from-phases.ts` | L0 | 0.1.0 | experimental | —| —| L0 | —|
| `helpers/agent-similarity-analyzer.ts` | L0 | 1.2.0 | active | v1.2.0 (T-20260926-020c): frontmatter `extends:` stub form recognized (hasExtendsDeclaration + parseExtendsRef with UNPINNED_EXTENDS semantics — unpinned stubs get an existence check, not a version-drift comparison); main() now guarded by import.meta.main (previously ran on ANY import, e.g. from agent-promote — silent double-run). Modes: Wave 2a six-section similarity report + Mode 2 extends version-drift detection | —| L0 | —|
| `helpers/golden-reference-loader.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/inject-skills.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/integration-helpers.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `helpers/layer-filter.ts` | L0 | 1.5.0 | active | —| —| L0+L1 | —|
| `helpers/lifecycle-governance.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `helpers/extends-validator.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `helpers/upgrade-versions.ts` | L0+L1 | 1.0.1 | active | —| —| L0+L1 | —|
| `helpers/merge-frontmatter.ts` | L0 | 1.8.6 | active | —| —| L0+L1 | —|
| `helpers/security-validator.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `helpers/l0-ref-policy.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/context-sections.ts` | L0 | 1.8.0 | active | v1.8.0 (T-20260926-021): `harvestVariantOnlyLines` — W2 HARVEST line computation extracted from upgrade-project v1.42.0's inline block as a pure, unit-tested helper (set difference vs the single best-match common section; matched-null yields all content lines). Prior: v1.7.0 (variant hygiene batch, spec docs/designs/2026-09-25-variant-hygiene-batch-design.md R2): stripMarkerZones() — pure COMMON-CONTEXT zone stripper for audit.ts v2.44.0 overlap checks; unterminated zones are not stripped. Prior: CRLF-tolerant footer parsing (T-20260918-005); spliceCommonContextBlock delivers policy under PRESERVE (T-20260919-003); nesting-aware findHeadingSpan/removeHeadingSpan — promoted `##` sections carry their `###` children (2026-09-22). | —| L0+L1 | —|
| `helpers/markers.ts` | L0 | 1.3.0 | active | v1.3.0 (T-20260924-006, spec docs/designs/2026-09-25-propagation-engine-batch-design.md): pure appendMissingZones() — placement-controlled append of missing marker zones (after the LAST zone of an anchor marker or at end-of-file; anchor missing = no placement, fail-safe skip); existing zones keep k-th↔k-th pairing | —| L0+L1 | —|
| `helpers/merge-state.ts` | L0 | 1.0.0 | active | §3.3 shared-file taxonomy + unresolved-conflict parsing for dev-sync main-drift/--conclude-merge (ADR-0081/T-20260918-002) | —| L0+L1 | —|
| `helpers/scaffold-markers.ts` | L0 | 1.6.1 | active | docs/project.template.md joins NEW_PROJECT_CLEANUP_FILES (rendered into docs/project.md at scaffold time, raw copy removed); docs/project.md joins POST_DELIVERY_ARTIFACTS (spec: docs/designs/2026-09-24-scaffold-identity-overview-design.md). Prior: shared scaffold marker constants + (marker→source) mapping + delivery-tree derivations + transient test-fixture predicate (T-20260916-001) | —| L0+L1 | —|
| `helpers/template-version.ts` | L0 | 1.1.0 | active | templates/VERSION SSOT reader for scaffold provenance — fails loud on missing/unparseable; resolveProvenanceVersion() pins the shared --version-wins resolution order (T-20260915-011, T-20260916-002) | —| L0 | —|
| `helpers/pm-md-parser.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/resolve-pm-stub.ts` | L0 | 1.2.0 | active | v1.2.0 (registry & platform-policy completeness batch, spec docs/designs/2026-09-25-registry-policy-completeness-design.md R2.1): pure, read-only `composeResolvedAgentContent(agentPath, commonAgentPath, variant, opts)` returns exactly the content `resolveAgentExtendsStub` would write, without touching the filesystem (validators must not mutate the tree they audit); the resolver consumes the compose path so one merge implementation exists (in-place writer stays for the new-project/adopt-project delivery paths). Prior: v1.1.0 (T-20260924-003, spec docs/designs/2026-09-25-inventory-decisions-batch-design.md R2.2): generic `resolveAgentExtendsStub(agentPath, commonAgentPath, variant, opts)` wrapper — the pm canonical-prose check (H12) moves behind an injected `opts.isCanonicalStubBody` (pm passes isCanonicalPmStubBody; the empty-body i18n-specialist stubs skip it); `resolvePmExtendsStub` stays as a thin back-compat wrapper. Prior: Shared agents/pm.md normalization — ADR-0033 extends-stub resolution against the L1 body (H12 non-canonical prose flag) + L1-B metadata strip with project-local lifecycle regeneration; extracted verbatim from new-project §2.3b/§2.5, shared with the adopt-project settling pass | —| L0+L1 | —|
| `helpers/adopt-plan.ts` | L0 | 1.0.0 | active | Pure scan/plan logic for adopt-project: full delivered-path derivation (upgrade-policy SSOT), collision scan, retained foreign scripts, foreign skills, secret-shaped tracked files, hook-manager conflicts, workflow traces, versioned adoption plan | —| L0 | —|
| `helpers/variant-governance-rules.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/registries/variant-type-registry.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/registries/capability-registry.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/registries/promotion-policy.ts` | L0 | 1.2.1 | active | —| —| L0 | —|
| `helpers/registries/validation-policy.ts` | L0 | 1.2.1 | active | —| —| L0+L1 | —|
| `helpers/registries/index.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/variant-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/game-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/security-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/development-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/design-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/consulting-plugin.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/plugins/collaboration-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/lecture-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/index.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/workspace-integration.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/reconcile-with-l0-l1.ts` | L0 | 1.3.1 | active | —| —| L0 | —|
| `helpers/normalize-agent-skills.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/prune-country-scoped-assets.ts` | L0 | 0.3.4 | active | —| —| L0 | —|
| `helpers/scan-l3-project.ts` | L0 | 1.5.0 | active | v1.5.0 commands roots gain .codex/prompts (.agents/commands excluded per Finding D); detectPlatformScope classifies agents/codex (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 13) | —| L0 | —|
| `helpers/substitute-placeholders.ts` | L0 | 1.3.0 | active | v1.3.0: exported pure `applySubstitutions`/`substituteFiles` (strict-UTF-8 guard, explicit file list) for adopt's scoped substitution; CLI flow guarded by import.meta.main, behavior unchanged | —| L0 | —|
| `helpers/template-utils.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `helpers/rollback-partial-project.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/template-validation.ts` | L0 | 1.0.2 | active | —| —| L0 | —|
| `helpers/update-variant-lifecycle.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `helpers/validate-output.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `helpers/validate-platform-parity.ts` | L0 | 1.2.0 | active | v1.2.0 4-platform manifest rework: per-mirror comparison vs .claude reference; codex prompts mapping; skip markers generalized; .agents/.codex findings soak at warning (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 12, D12) | —| L0 | —|
| `helpers/mirror-hygiene.ts` | L0 | 1.0.0 | active | v1.0.0 mirror-hygiene scanner (R6, spec docs/designs/2026-09-25-verifier-platform-expansion-design.md): a platform skill mirror contains only skill directories; stray files (SKILLS.md/README*.md) and non-skill dirs are findings; wired into validate-templates checkMirrorHygiene (WARN soak) | —| L0+L1 | —|
| `helpers/ticket-schema.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/ticket-store.ts` | L0 | 1.3.0 | active | v1.3.0 (T-20260926-021, design docs/designs/2026-09-26-runner-lock-retry-enforcement-design.md D2): DEFAULT_ATTEMPTS_CAP — `failed -> waiting` beyond the cap (2) is refused with an escalation demand; `--force` remains the documented escape; the "one retry, then escalate" rule is now mechanical instead of prompt prose. Prior: MoveOptions.result written to the ticket on done transitions (T-20260912-023); id allocation scans both tickets/ and tickets/governance/ so a create can never mint a same-day id that shadows or is shadowed across directories (T-20260912-025) | —| L0 | —|
| `validators/types.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/variant-json-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/extends-validator-wrapper.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/capability-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/schema-validator.ts` | L0 | 1.4.0 | active | —| —| L0 | —|
| `validators/orphan-reference-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/duplicate-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/platform-parity-validator.ts` | L0 | 1.1.0 | active | v1.1.0 4-platform rework: per-mirror skill/command comparison vs .claude; codex prompts name-mapping; skip-marker honor; settings stays claude-gemini (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 12, D12) | —| L0 | —|
| `validators/index.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/write-scripts-snapshot.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `hooks/_test-consumer.ts` | L0 | 1.0.0 | active | —| —| L0-only | —|
| `hooks/_test-module.ts` | L0 | 1.0.0 | active | —| —| L0-only | —|
| `hooks/agent-model-gate.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `hooks/gateguard-fact-force.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `hooks/post-write-lifecycle-check.ts` | L0 | 1.2.0 | active | v1.2.0 checks 1-4 generalize to four platforms mapping-aware (.codex/prompts leg; .agents/commands excluded per Finding D) (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 9) | —| L0+L1 | —|
| `hooks/pre-commit.ts` | L0 | 1.8.0 | active | v1.8.0 check 6b generalizes to four platforms (skills regexes + .codex/prompts mapping leg), WARN severity preserved (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 8) | —| L0+L1 | —|
| `hooks/pre-push.ts` | L0 | 1.4.1 | active | —| —| L0+L1 | —|
| `ingest-external-skills.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `ingest-security-frameworks.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `l3-to-variant-pipeline.ts` | L0 | 1.21.1 | active | `--overlay-variant` | —| L0 | —|
| `regenerate-agents-md.ts` | L0 | 1.2.0 | active | v1.2.0: tier extraction strips inline YAML comments (`medium # model-id` leaked into roster rows). | —| —| L0 | —|
| `lib/agent-override-merge.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `lib/context-md-schema.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `lib/auth.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/constitution-scrub.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/encoding-utils.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `lib/error-handling.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `lib/language-guard.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/git-status.ts` | L0 | 1.1.0 | active | v1.1.0: adds `parseCachedNameStatus()` — cached name-status removal parser (`D` paths + staged-rename sources) for dev-sync step 6.5 scoped-staging deletion handling (spec: docs/designs/2026-09-24-constitution-s33-context-injection-design.md §13); Prior: `parseStatusPorcelain()` S0/S1 snapshot parser (2026-09-12 scoped staging) | —| L0+L1 | —|
| `lib/pipeline-state.ts` | L0 | 1.2.0 | active | v1.2.0: injectable state file (`setStateFile`), string phase names, snapshot-backed undo (`addRollbackActionWithBackup`; modify/delete/move restore from captured content) for in-project adopt state | —| L0+L1 | —|
| `lib/platform-context.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/propagation-map-schema.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `lib/managed-block-merge.ts` | L0 | 1.2.0 | active | v1.2.0 (T-20260924-010, spec docs/designs/2026-09-25-codex-merge-claim-routing-design.md D1): COMMON-CODEX joins MANAGED_PATTERNS (after its COMMON-GEMINI twin) — the CODEX.md MERGE pass union-merge activates; engine untouched (pattern-generic positional path) | —| L0 | —|
| `lib/managed-block-parity.ts` | L0 | 1.2.0 | active | COMMON-AGENTS zone extraction/parity (ADR-0081/T-20260919-001); keyed WORKSPACE-MANAGED blocks (T-20260916-009) | —| L0+L1 | —|
| `lib/platform-delivery.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/ssrf.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `lib/upgrade-policy.ts` | L0 | 1.17.0 | active | v1.17.0 (ADR-0088 W2): `.hermes/skills` claims SYNC via the sync-skills mirror pass above every blanket rule; `.hermes` joins the blanket SYNC claim and KNOWN_TOP_DIRS. Prior: v1.16.0 (registry & platform-policy completeness batch, spec docs/designs/2026-09-25-registry-policy-completeness-design.md R4): `.agents/mcp.json` joins JSON_MERGE_FILES (D6 — same genus as root `.mcp.json`, ADR-0076 v1.2.0 precedent: project-only MCP servers survive upgrades; fleet copies byte-identical today = no-op rollout); `.codex/config.toml` stays ADD_IF_MISSING with the rationale documented at the claim site (D7: co-abap codex_hooks + co-consult divergence are real customizations, no TOML parser, semantic TOML merge out of scope — template-side config.toml changes intentionally reach only new projects). Prior: v1.15.0 (T-20260924-003, spec docs/designs/2026-09-25-inventory-decisions-batch-design.md R2.4): exports `isExtendsStub(content)` — the ADR-0033 extends-stub shape test the upgrade agents/ SYNC pass uses to skip template stub files (resolved at scaffold/adopt time; the stub-over-resolved-body clobber was the v1.35.0 drift reconciliation). Prior: v1.14.0 (T-20260924-011, spec docs/designs/2026-09-25-codex-merge-claim-routing-design.md D2/D3): exports VARIANT_ASSET_DIRS_PASS and resolveClaim uses it at the generic-asset fallback — upgrade-project's VARIANT ASSET DIRS pass now filters every walked file by claim-pass identity, so procedures/** leaves the pass (the dedicated PROCEDURES pass is the sole delivery channel). Prior: v1.13.0 (platform-parity P1 bugfixes, spec docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md D4): CODEX.md joins MERGE_MANAGED_FILES — resolveClaim returns MERGE_MANAGED/MERGE, so TEMPLATE TREE SYNC can no longer wholesale-overwrite a project CODEX.md (merge machinery itself: T-20260924-010). Prior: docs/project.md claims ADD_IF_MISSING on the TEMPLATE TREE SYNC pass (project-owned identity seed — seeded only when absent, never overwritten); docs/project.template.md joins TEMPLATE_ONLY (spec: docs/designs/2026-09-24-scaffold-identity-overview-design.md). Prior: exports `lifecyclelessText()` + `isDeliveredDiff()` (dev-sync 3.9 auto-E5); `.codex/skills + .codex/prompts` claims ride the sync-skills mirror pass (T-20260921-009/C-1, ADR-0085 D2) | —| L0+L1 | —|
| `lib/dependency-guard.ts` | L0 | 1.0.2 | active | DEPENDENCY GUARD — scans delivered scripts' bare-package imports vs project package.json, reports missing packages in the upgrade plan (T-20260920-001) | —| L0+L1 | —|
| `lib/variant-overlay-guard.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/platform-mirror-freshness.ts` | L0 | 1.1.0 | active | Pure platform-skill-mirror vs skills/ SSOT version comparison for the platform-mirror-freshness check (T-20260916-008) | —| L0+L1 | —|
| `lib/platforms.ts` | L0 | 1.1.0 | active | v1.1.0 (ADR-0088 W1): `.hermes/skills` joins both lists (5-element mirror list, 6-element skill bases). Platform-list SSOT constants (PLATFORM_SKILL_BASES, PLATFORM_MIRROR_DIRS); Step 1 of the platform-parity program (spec: docs/designs/2026-09-24-platform-ssot-constant-design.md) | —| L0+L1 | —|
| `lib/env-sample.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `lifecycle-sync-audit.ts` | L0 | 1.17.0 | active | v1.17.0 (registry-policy-completeness batch W5, spec docs/designs/2026-09-25-registry-policy-completeness-design.md R5.6): INTENTIONAL_CROSS_REFS gains dev-sync:sync-skill-registries (L1 Step 4.63 behind isWorkspaceRoot + existsSync guards) and validate-templates:sync-skill-registries (L1 VA-08 fix-hint string). Prior: v1.16.0 (T-20260924-001, spec docs/designs/2026-09-25-propagation-engine-batch-design.md R21): Check B projection arm — imports the generator's pure builder, regenerates the expected mirror registry span, and byte-compares it with templates/common/scripts/SCRIPTS.md (fix hint names `bun scripts/generate-scripts-mirror.ts`); existsSync-guarded dynamic import keeps the L1 copy functional where the L0-only generator is absent; existing version/file-existence checks retained | —| L0+L1 | —|
| `lint-instructions.ts` | L0 | 1.0.0 | active | `--dir`, `--strict` | —| L0+L1 | —|
| `list-template-versions.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `md-to-ooxml.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `migrate-project.ts` | L0 | 1.0.0 | active | `<project-path> --variant <v> [--platform] [--org] [--public] [--skip-github] [--dry-run] [--yes]` — end-to-end external-project migration: phase 1 GitHub baseline (ensure-github-repo subprocess, verified), phase 2 adoption plan preview (adopt-project --dry-run, always), phase 3 real adoption (stdio inherited), phase 4 machine verification (artifacts, platform twins per profile, provenance marker, merge=ours, hooksPath, remote, audit smoke — hard checks fail the run). Spec: docs/designs/2026-09-23-migrate-project-design.md | —| L0 | —|
| `migrate-quality-gates.ts` | L0 | 1.1.0 | active | Convert quality_gates prose entries to decision gates; automate classification (GATE vs INVARIANT vs MANUAL), YAML output, procedure schema updates, and _output-types.yaml enrichment (ADR-0083 P5); decider_agent derived from stage owner_agent, not procedure owner_agent | —| L0+L1 | —|
| `new-project.ts` | L0 | 1.30.0 | active | v1.30.0 (ADR-0088 W2): `--platform hermes` joins the profiles — hermes-primary keeps `.hermes/` and drops CLAUDE.md/GEMINI.md (AGENTS.md is the Hermes instruction file); all other profiles are hermes-opt-out. Prior: v1.29.0 (T-20260924-003, spec docs/designs/2026-09-25-inventory-decisions-batch-design.md R2.3): §2.3b generalizes from pm.md-only to EVERY agents/*.md carrying `extends:` frontmatter — the 13 variant i18n-specialist.md extends-stubs resolve against templates/common bodies at scaffold time (one log line per resolved stub); pm.md keeps the H12 canonical-prose check. Prior: v1.28.0 (scaffold hygiene bundle, spec docs/designs/2026-09-24-scaffold-hygiene-bundle-design.md): parse-loop catch-all — any unknown or valueless `--` flag is a hard error (exit 1) before any write, naming the offending token and listing the six valid flags; `--yes` exempt (consumed by the auto-confirm argv scan). Prior: v1.27.0 (T-20260924-008, spec docs/designs/2026-09-24-skills-registry-overlay-reconcile-design.md): overlay walk skips `skills/SKILLS.md` (common 63-row registry stays as seed) + new §6.4 post-settle reconcile — prunes rows for undelivered skills, updates version/last_reviewed from delivered SKILL.md frontmatter, appends variant-exclusive rows; idempotent, non-fatal. Prior: §5.2 renders docs/project.md from the identity seed template (templates/common/docs/project.template.md) and removes the raw copy; new additive --description/--type flags fill the identity fields, absent flags keep the audit-visible TODO(project-overview) fallback (spec: docs/designs/2026-09-24-scaffold-identity-overview-design.md). Prior: §2.3b extends-stub resolution + §2.5 L1-B strip extracted verbatim to `helpers/resolve-pm-stub.ts`; §7.7 graft build: global `graft` first, bunx fallback; bare names scaffold to `Projects/<name>`, path-like names stay workspace-relative | —| L0 | —|
| `adopt-project.ts` | L0 | 1.2.0 | active | v1.2.0 (T-20260924-003, spec docs/designs/2026-09-25-inventory-decisions-batch-design.md R2.3): the settling pass generalizes extends-stub resolution from pm.md-only to EVERY agents/*.md carrying `extends:` frontmatter (the 13 variant i18n-specialist.md stubs resolve here too); pm.md keeps the H12 canonical-prose check and the L1-B metadata strip. Prior: `<project-path> --variant <v> [--platform] [--dry-run] [--yes]` — in-place conversion of an external project to the workspace standard; subprocess delivery via upgrade-project (files-only contract), full delivered-path collision scan with outside-repo backup + `scripts/_legacy/` archival, foreign-skill manifest seed, refusal-grade pre-flight (secrets/hook managers/gitleaks), settling pass (pm stub resolution, seeds, scoped substitution, package.json merge, bun install + hooksPath, graft, audit smoke); no auto-commit. Spec: docs/designs/2026-09-23-adopt-project-conversion-design.md | —| L0 | —|
| `remove-project.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `resolve-variants.ts` | L0 | 1.0.3 | active | —| —| L0+L1 | —|
| `project-to-variant.ts` | L0 | 1.5.0 | active | v1.5.0 (platform-parity P1 bugfixes, spec docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md D1): shouldSkip adopts PLATFORM_SKILL_BASES — .codex/skills joins the scoped-skill exclusion (country-scoped skills no longer leak from a source project's codex mirror). Flags: `--source`, `--target`, `--dry-run`, `--force`, `--overlay-variant`, `--design-doc`, `--threshold-files`, `--threshold-dirs` | —| L0 | —|
| `promote-context-section.ts` | L0 | 1.1.0 | active | `--heading`, `--variants`, `--source`, `--after-heading`, `--dry-run`; nesting-aware removal — promoted `##` sections remove their nested `###` subsections too (2026-09-22) | —| L0 | —|
| `propagate-to-templates.ts` | L0 | 2.18.0 | active | v2.18.0 (propagation-engine batch, spec docs/designs/2026-09-25-propagation-engine-batch-design.md T-20260924-006): runMarkerRewrite append-on-missing — per-domain opt-in appends the unmatched source tail when existing zones < source sections (insert_after_marker anchor placement, fail-safe skip when the anchor is absent; existing zones keep their k-th↔k-th pairing); truthful skip messages replace the false apply-time injection promise; dry-run summary gains a `Would append: N` counter parsed by dev-sync Step 4.55; pilot: constitution-context-pr only (zero live diff). Prior: v2.17.0 (platform-parity P1 bugfixes, spec docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md D5): B-7 GEMINI boundary regex repaired to the marker-pair form (captures heading number), NEW CODEX.md branch replaces the section in place, B-8 fatal guard when the workspace heading survives any output. Flags: `--apply`, `--prune`, `--dry-run`, `--check-drift`, `--json`, `--governance-l1`, `--docs`, `--include-disabled`, `--marker-rewrite` | —| L0 | —|
| `qa-gate.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `readme-lifecycle-audit.ts` | L0 | 1.0.4 | active | —| —| L0+L1 | —|
| `release-template.ts` | L0 | 1.0.0 | active | `--version`, `--bump`, `--dry-run`, `--no-tag`, `--push` | —| L0 | —|
| `render-pdf-deck.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `retry-handler.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `setup-github-branch-protection.ts` | L0 | 1.0.1 | active | `--repo`, `--branch`, `--check` (repeatable), `--dry-run` | —| L0+L1 | —|
| `skill-dependency-analysis.ts` | L0 | 1.0.2 | active | —| —| L0 | —|
| `spec-backfill.ts` | L0 | 1.0.0 | active | `--dry-run`, `--check` | —| L0 | —|
| `spec-register.ts` | L0 | 1.3.0 | active | `--file`, `--source`, `--update`, `--status`, `--list`, `--ref`, `--id` | —| L0+L1 | —|
| `skill-lifecycle-audit.ts` | L0 | 1.5.1 | active | —| —| L0+L1 | —|
| `skill-session-review.ts` | L0 | 1.1.0 | active | `--date`, `--json`, `--dry-run` | —| L0+L1 | —|
| `sync-md.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `sync-skill-status.ts` | L0 | 1.1.0 | active | v1.1.0 scan scope adopts PLATFORM_SKILL_BASES + SSOT-precedence guard (skills/ status wins; mirrors speak only for platform-only skills) (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 5, D5) | — | L0+L1 | — |
| `sync-skills-to-l2.ts` | L0 | 1.0.1 | active | — | — | L0 | — |
| `sync-template-deps.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `sync-skill-registries.ts` | L0 | 1.0.0 | active | `--check`, `--dry-run`, `--root <dir>` | — | L0 | — |
| `sync-skills.ts` | L0 | 1.9.0 | active | `--dir <path>`, `--all-variants` | — | L0+L1 | — |
| `tag-template.ts` | L0 | 1.1.0 | active | `--dry-run`, `--no-push`, `--fail-on-push-error` | —| L0 | —|
| `team-builder.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `test-platform-parity.ts` | L0 | 0.3.0 | active | v0.3.0 FILE_MAPPINGS gains CODEX.md L0→L1 (informational existence check; section parity deferred per D3.5) (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 11) | —| L0 | —|
| `test-new-project.ts` | L0 | 1.7.0 | active | v1.7.0 (ADR-0088 W2): Test 8 covers the `--platform hermes` profile and asserts `.hermes/` under `all`. Prior: v1.6.0 (scaffold hygiene bundle, spec docs/designs/2026-09-24-scaffold-hygiene-bundle-design.md): Test 0c pins the unknown-flag hard error (AC4) — `--varaint` exits non-zero, token named, valid flags listed, no directory created. Prior: v1.5.0 (T-20260924-008, spec docs/designs/2026-09-24-skills-registry-overlay-reconcile-design.md): Test 29 pins the delivered-registry ↔ delivered-tree bijection (frontmatter values win the shadow case; service-design row present); Test 30 runs the project's skill-lifecycle-audit and asserts 0 errors. Prior: Tests 27-28 pin the identity seed contract: TODO(project-overview) fallback + docs/context.md pointer on the default scaffold (AC2/AC3), --description/--type rendering on a flagged scaffold (AC1) (spec: docs/designs/2026-09-24-scaffold-identity-overview-design.md). Prior: Test 8 covers `--platform codex` and asserts CODEX.md/.codex/ under `all` | —| L0 | —|
| `test-adopt-project.ts` | L0 | 1.0.0 | active | Fast mode: dry-run plan + refusal-grade pre-flight (secrets, hook managers), zero writes; `ADOPT_E2E_FULL=1` runs the real conversion on a disposable fixture (delivery, preservation, _legacy archival, package.json merge, already-adopted guard) | —| L0 | —|
| `test-extends-validator.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `test-l3-to-variant-promotion.ts` | L0 | 1.6.0 | active | —| —| L0 | —|
| `test-scaffold-delivery-parity.ts` | L0 | 1.0.0 | active | Fast static parity harness: new-project vs create-l3-scaffold delivery trees vs REVIEWED_DELIVERY_EXCLUSIONS (T-20260915-003) | —| L0 | —|
| `test-variant-readiness.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `test-runner.ts` | L0 | 1.4.0 | active | `--parallel`, `--sequential`, `--concurrency <n>`, `--timeout <ms>` | —| L0+L1 | —|
| `translate-readme.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `ticket.ts` | L0 | 1.3.0 | active | v1.3.0 (T-20260926-021): doctor gains the retry-budget summary — tickets at/over DEFAULT_ATTEMPTS_CAP are listed as escalation candidates. Prior: v1.2.1 (T-20260926-020e): doctor staleness scan covers BOTH ticket populations — the service dir and the manual governance dir (a stuck manual `running` ticket was previously invisible). `create --not-before`, `list --kind`, `list --ready`, `move done --result` (required, not bypassable by --force) | —| L0 | —|
| `typecheck.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `upgrade-project.ts` | L0 | 1.52.0 | active | v1.52.0 (T-20260926-021): W2 HARVEST line computation extracted to the pure helper `harvestVariantOnlyLines` (helpers/context-sections v1.8.0) and unit-tested; harvest report discloses the comparison is best-match-section-only. Prior: v1.51.0 (ADR-0088 W2): `.hermes` joins the platform set — VARIANT_ASSET_DIR_SKIP, upstream skill-name sources, and both mirrorRoot sweeps cover the fifth platform mirror. Prior: v1.50.0 (Design Gate delivery repair, spec docs/designs/2026-09-25-registry-policy-completeness-design.md W5 follow-up): SYNC_IF_NEWER scripts/ walk fully recursive — the flat one-level walk could not reach helpers/registries/*, so golden-reference-loader's transitive imports shipped broken in every project upgrade and the project-side Design Gate spec-check crashed on import. Prior: v1.49.0 (T-20260924-003, spec docs/designs/2026-09-25-inventory-decisions-batch-design.md R2.4): the agents/ SYNC pass skips template files whose frontmatter carries `extends:` (pure isExtendsStub from lib/upgrade-policy.ts) with a `STUB (resolved at scaffold)` line — fixes the v1.35.0 drift-reconciliation clobber where an apply-mode upgrade overwrote a project's resolved 349-line pm.md body with the 8-line template stub (proven by Projects/co-work dry-run); also protects the 13 new variant i18n-specialist.md stubs. Prior: v1.48.0 (T-20260924-011, spec docs/designs/2026-09-25-codex-merge-claim-routing-design.md D2/R4-R6): the VARIANT ASSET DIRS pass consults resolveClaim per walked file and delivers only VARIANT_ASSET_DIRS_PASS claims (procedures/** drops out; skipped files log one summary line per directory; generic asset dirs keep NEW/UPDATE/CONFLICT/COPIED; `.codex` stays in the skip set). Prior: v1.47.0 (platform-parity P1 bugfixes, spec docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md D2+D3): foreign-variant skill prune iterates PLATFORM_SKILL_BASES (a foreign skill's .codex copy no longer survives the prune); `.codex` joins VARIANT_ASSET_DIR_SKIP (the variant's top-level .codex/ is no longer hash-synced over project-owned Codex config — general resolveClaim bypass: T-20260924-011). Prior: v1.46.1 (T-20260924-008): mechanical move only — extractFrontmatterVersionAndReviewed relocated verbatim to `helpers/skills-registry.ts` and imported back; NO behavior change. Prior: v1.46.0 (scaffold identity overview §13, spec docs/designs/2026-09-24-scaffold-identity-overview-design.md): IDENTITY SEED step after TEMPLATE TREE SYNC — renders docs/project.template.md into docs/project.md ONLY when absent (existing file → no write, no verdict; AC4); sync pass walk untouched (its ADD_IF_MISSING claim for that path is a defensive no-op). Prior: v1.44.0 (T-20260923-003/-004): PRUNE REMOVED scripts/ category registry-aware — variant-sourced rows KEEP, pruned rows dropped; L1 engine mirror retired (ADR-0073 Amd. 1+3). Prior: v1.43.0 (adopt-project prerequisites): variant-scope skill prune honors variant.json skill_manifest; `.gitattributes` merge-aware LOCKED delivery. Prior: `--variant`/`--platform`/`--dry-run`/`--prune-removed`/`--rollback`/`--yes`/`--skip-context-commonization`/`--force-context-sync`; COMMON-CONTEXT splice under PRESERVE (T-20260919-003); skill sub-file sync (2026-09-21); W2 HARVEST (2026-09-22) | —| L0 | —|
| `variant-feature.ts` | L0 | 1.0.0 | active | `--variant`, `--feature`, `--type` | —| L0 | —|
| `validate-agents.ts` | L0 | 1.3.2 | active | —| —| L0+L1 | —|
| `validate-doc-folder.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `validate-docs-links.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `validate-md-language.ts` | L0 | 1.12.0 | active | official patterns gain CODEX.md + .agents/{skills,commands} + .codex/{skills,prompts} trees (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 4). Prior: scan scope widened to docs/adr/, docs/decisions/, docs/VERSION_MANIFEST.md + generated-region allowlist markers (T-20260912-015) | —| L0+L1 | —|
| `validate-model-registry.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `validate-process.ts` | L0 | 1.0.0 | active | Process/stages validation (ADR-0083 DEG-P-*), distinctness check (`--determinism` flag) | —| L0+L1 | —|
| `validate-raci.ts` | L0 | 1.2.0 | active | RACI validation per ADR-0083 DEG-R-01..05 + ADR-0084 DEG-R-06/07; DEG-R-06: human-accountable must match gate; DEG-R-07: actor_types key set must equal R/A/C/I union | —| L0+L1 | —|
| `validate-skills.ts` | L0 | 1.5.1 | active | —| —| L0+L1 | —|
| `procedure-coverage.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validate-procedures.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `validate-decisions.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `validate-templates.ts` | L0 | 1.46.1 | active | v1.46.1 (program closure, design Addendum 3): size-budget stays WARN permanently (user decision — no FAIL promotion, no further reduction). Prior: v1.46.0 v1.46.0 (ADR-0090 W0): `agents-md-size-budget` (every AGENTS.md ≤15,000 chars at L0/L1/L2; WARN until W4 FAIL promotion) and `agents-md-pointer-integrity` (docs/governance and docs/constitution references in AGENTS.md resolve — multi-base: root, templates/common, layer dir; docs/constitution post-scaffold refs WARN). Prior: v1.45.0 (registry-policy-completeness batch W5, spec docs/designs/2026-09-25-registry-policy-completeness-design.md R5.6): new VA-08 skill-registry-sync check — one cross-surface pass (collectWorkspaceRegistryFindings, skills-registry helper v1.2.0) asserting every skill registry table (root workspace rows, root Variant-Exclusive catalog, common scaffold seed, 13 curated variant registries) matches the SKILL.md frontmatter it documents; wired once in the main flow beside the mirror-parity checks; WARN soak per ADR-0055 with promotion ticket T-20260925-007 (not_before 2026-10-09); remediation path `bun scripts/sync-skill-registries.ts`. Prior: v1.44.0 (registry & platform-policy completeness batch, spec docs/designs/2026-09-25-registry-policy-completeness-design.md R3): new VA-07 variant-mirror version-sync check (verifier-expansion §17.1 advisory A1 follow-up) — collectMirrorVersionMismatches (pure, exported) compares SKILL.md frontmatter versions across a variant's .claude/.gemini/.agents/.codex mirror skills (present in >= 2 mirrors; missing version is a finding), cross-checks curated skills/SKILLS.md registry rows where they exist (mirror-only adapted copies skipped), honors the VA-03 mirror-parity: skip vocabulary, wired beside VA-03 in the stable-variant loop; WARN soak per ADR-0055 with dedicated promotion ticket T-20260925-006 (not_before 2026-10-09); day-one green (0 mismatches across the 13-variant fleet). Prior: v1.43.0 (T-20260924-002, spec docs/designs/2026-09-25-inventory-decisions-batch-design.md R1.3-R1.5): C-CM-04 platform-skills sweep consumes the contract's common_platform_skill_exclusions (5 documented exclusions: create-variant/promote-variant/simulate-pipeline L0-only, graft claude-only, sound-synth variant-scoped); a stale exclusion (dir gone from every mirror tree) FAILs; PLATFORM_SOURCE_KEYS gains codex_source (C-CM-03b verifies .codex mirror-copy version parity for all 22 entries); exemptSkills uses variant_scoped_skills VALUES (skill names) instead of keys (variant names) — C-CM-05 semantics. Full-inventory ruling: the 4 aggregated platform-sweep WARNs (15/14/14/14 dirs) drop to 0 (4/4 tree(s) pass). Pure helpers exported: collectSchemaExemptSkills, unlistedPlatformSkillDirs, stalePlatformSkillExclusions. Prior: v1.42.0 variant-agent-references (T-20260924-007c, spec docs/designs/2026-09-25-variant-hygiene-batch-design.md, R4): agent references in variant AGENTS.md + variant scripts must resolve at variant/common/root agents/ trees; pure cores classifyAgentReference + extractAgentReferenceCandidates exported for tests/unit/variant-agent-reference.test.ts; WARN soak (ADR-0055), dated promotion ticket T-20260925-004. Prior: v1.40.0 platform verifier expansion (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md, sites 3a-3e/3g + R6): command checks gain the .codex/prompts leg (C-CM-04 codex derived from source per Ruling K); platform-skills sweep iterates four mirror trees; VA-03 becomes 4-mirror parity with generalized skip marker (mirror-parity: skip, gemini-parity: skip as legacy alias); P-01b CODEX.md leg; new mirror-hygiene check. Net-new coverage soaks in WARN (ADR-0055). Prior: project-identity-placeholder — fleet WARN over Projects/*/docs/ reusing the audit placeholder regex; identity residue stays visible until filled (spec: docs/designs/2026-09-24-scaffold-identity-overview-design.md). Prior: roster-tier-consistency (T-20260921-020); common-agents-parity PM-04b (ADR-0081/T-20260919-001); managed-block-parity PM-04 (T-20260916-009); cross-twin common section parity VA-06 (ADR-0077) | —| L0+L1 | —|
| `validate-variant-readiness.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `verify-country-prune.ts` | L0 | 1.1.0 | active | v1.1.0 fixture harness adopts PLATFORM_SKILL_BASES — .codex/skills fixtures created and pruning asserted; pruner already 5-element (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 7, D7) | —| L0 | —|
| `verify-adr-governance.ts` | L0 | 1.7.0 | active | Added bold-line fallback for `**Date**: YYYY-MM-DD` metadata to mirror `extractADRStatus()` pattern (ADR-0084 safety net); WARN on unparseable dates for Accepted/Proposed ADRs | —| L0 | —|
| `verify-agent-deliverables.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `verify-skill-graph.ts` | L0 | 1.6.0 | active | —| —| L0+L1 | —|
| `verify-memory.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `verify-new-project-tests.ts` | L0 | 1.0.3 | active | —| —| L0 | —|
| `verify-platform-lifecycle.ts` | L0 | 1.4.0 | active | v1.4.0 (T-20260925-010 + T-20260925-008): Check G generalizes the hardcoded ['.claude','.gemini'] pair loop into the COMMANDS_SURFACES registry — every platform's commands surface is a governed leg or a RECORDED exclusion (.agents L0-resident, .hermes native /skill-name); import.meta.main guard + exports enable subprocess-tested coverage. .hermes/skills promotes out of SOAK_MIRRORS to fail severity (live hermes-agent v0.21.4 E2E green: project skill discovery, frontmatter tolerance, AGENTS.md entry; AGENTS.md 56,850 chars exceeds Hermes' 20,000-char context cap → truncation, pin context_file_max_chars on onboarding). Prior: v1.3.0 (ADR-0088 W2): `.hermes/skills` joins PLATFORM_MIRROR_DIRS consumers and SOAK_MIRRORS (net-new leg soaks WARN per ADR-0055). Prior: v1.2.0 Check E/H iterate the four mirrors; Check F becomes n-way version sync (.claude-gemini disagreement keeps fail, other shapes soak WARN); Check G gains the .codex/prompts mapping leg; .agents/commands excluded per Finding D (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md sites 1a-1d, D1) | —| L0+L1 | —|
| `verify-readme-sync.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `verify-scripts.ts` | L0 | 1.9.0 | active | v1.9.0 (T-20260926-014 + T-20260926-017): Check 8 header-@version vs const-VERSION consistency (fails the drift class that bit resync-audit/backport-diff — the const is what --help prints); Check 9 L0 typecheck-baseline.json integrity (count must parse and equal the recorded policy 0 — the baseline can no longer be silently loosened). Prior: v1.8.0: walkScripts skips `scripts/_legacy/` (adopt-project archive of preserved foreign scripts — not registry-governed). Prior: `--fix` auto-registers unregistered scripts (ADR-0081/T-20260919-002) | —| L0+L1 | —|
| `verify-skills.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `verify-template-integrity.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validate-pm-extends.ts` | L0 | 0.3.1 | active | —| —| L0+L1 | —|

---

## Layer Classification Framework

> **Two layer types are in use**: `L0` (workspace root only) and `L0+L1` (workspace + template snapshot). `L0+L1+L2` is reserved but unused.

| Layer | Description | Publish | Example |
|-------|-------------|---------|---------|
| L0 | Workspace infrastructure only | No | new-project.ts, remove-project.ts, propagate-to-templates.ts |
| L0+L1 | Workspace + Template snapshot | Yes, to templates/common/ | audit.ts, hooks/pre-commit.ts |
| L0+L1+L2 | Reserved for future use | Not used (Fork Model) | N/A |

**Note**: All scripts must have L0 as their source of truth (SSOT principle). L0+L1+L2 is reserved for future architectural needs but not currently implemented due to the Fork Model (L2 variants evolve independently after scaffolding).

---

## Ownership Layers

| Layer | Location | Owner | Update Policy |
|-------|----------|-------|---------------|
| **L0 —Workspace SSOT** | `scripts/` (workspace root) | workspace maintainer | Versioned via this file |
| **L1 —Template snapshot** | `templates/common/scripts/` | publish: `bun run propagate:apply` | Explicit publish from L0 via consolidated tool |
| **L2 —Variant template** | `templates/co-*/scripts/<variant>/` | variant maintainer | Variant-specific scripts, propagated from L0 |
| **L3 —Project** | `<project>/scripts/` | project team | Independent snapshot after creation, plus L1->L3 propagation via `propagate-to-templates.ts` |

**Propagation rule**: L0 is the development SSOT. Publish L0→L1 explicitly with `bun run propagate:apply`, which is a consolidated tool that also handles L1->L3 propagation. L3 projects snapshot L1 at creation time and receive subsequent updates via propagation. No automatic back-propagation from L3.

---

## Lifecycle States

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `active` | In production use | Changes require version bump in Registry |
| `deprecated` | Scheduled for removal | `removal-date` field required; L1/L2 warned on `dev-sync` |
| `experimental` | Not guaranteed stable | Not synced to L1/L2 automatically |

**Deprecation flow:**
1. Set `status: deprecated` and `removal-date: YYYY-MM-DD` (minimum 90 days notice)
2. `bun run dev-sync` warns L1/L2 consumers on every run
3. On `removal-date`, `verify-scripts.ts --verify` **hard blocks** pre-commit

**Security advisory flow:**
1. Set `security-advisory: CVE-XXXX` (status can remain `active` or become `deprecated`)
2. `bun run dev-sync` **hard blocks** in L1/L2 until the script is updated or removed
3. Unlike deprecation, security advisories take immediate effect with no grace period

---

## Guide

### Everyday Development Scripts (Tier 2 —`bun run <script>`)

#### `resync-audit.ts`
**Purpose**: Provenance audit of uncommitted content in Projects/co-* (project-resync skill Step 0).
Classifies dirty/untracked files as STALE-RESIDUE (equals a current L0/L1/L2 source, or an older
revision corroborated by project mtime older + line-order agreement — discard, upgrade re-delivers),
PRESUME-STALE (subset match without corroboration — possible deliberate reordering or legitimate
deletion; human confirm before discard, routes to commit-side review), LOCAL-WORK (commit candidate;
feeds backport review), or KEEP (default-safe). Emits markdown/JSON verdict tables; optional local
snapshot tarball of discard candidates. Read-only — never modifies the tree, never pushes.
**Usage**: `bun scripts/resync-audit.ts [--project <path>]... [--json] [--snapshot-dir <dir>]`
**Runs automatically**: never automatic — operator-invoked via the `project-resync` skill

#### `skill-graph-fleet-report.ts`
**Purpose**: Read-only fleet analytics over the per-project skill-graph projections
(skill-graph-analytics skill Step 1). Loads the root `docs/skill-graph.json` plus every
`Projects/co-*/docs/skill-graph.json` (missing graphs skipped with a note) and computes:
per-project node/edge/skill-node counts; the skill x project presence matrix with fleet
presence counts; root-graph skills missing from each project's graph (capped display, full
list in the snapshot); project-vs-root node-set Jaccard distance; a NEW/VANISHED skill diff
against the newest previous snapshot; top-10 skills by fleet presence. Emits a human-readable
report on stdout and a machine snapshot at
`memory/skill-graph-metrics/snapshot-<YYYY-MM-DD>.json` (one per local calendar date;
same-date reruns overwrite). `--json` prints the snapshot JSON instead. Read-only over all
inputs — the snapshot is the only write; exits 1 when zero graphs are found.
**Usage**: `bun scripts/skill-graph-fleet-report.ts [--json] [--snapshot-dir <dir>]`
**Runs automatically**: never automatic — weekly cadence via the `skill-graph-analytics`
skill (the 02:30 ticket runner may invoke it); operator-invoked on demand

#### `backport-diff.ts`
**Purpose**: Read-only 5-surface backport candidate differ for a project's committed LOCAL-WORK
(project-resync skill Step 2 support). Diffs `--base..HEAD` over the project's files and maps each
changed file to its best-matching template source (variant → common → L0) per the 5-surface method
of docs/designs/2026-08-28-project-template-backport-design.md. Emits a candidate table: path |
surface | divergence direction (project-ahead / template-ahead / both-changed / in-sync /
project-only) | +added/-removed. L0-only — reads Projects/; no L1 mirror. Never writes anywhere.
**Usage**: `bun scripts/backport-diff.ts --project <co-name> [--surfaces all|skills|scripts|helpers|context|agents] [--base <commit>] [--json]`
**Runs automatically**: never automatic — operator-invoked via the `project-resync` skill

#### `audit.ts`
**Purpose**: Documentation audit gate. Checks CHANGELOG.md, workspace standards, AGENTS.md,
agent frontmatter, skill health, template lifecycle validation, and variant context guidelines
section presence (VARIANT-INJECT: guidelines [REQUIRED] marker enforcement).
**Usage**: `bun run audit`
**Runs automatically**: pre-commit hook, pre-push hook, `bun run dev-sync`

#### `dev-sync.ts`
**Purpose**: Full sync pipeline — pre-flight markdown link validation gate (`bun scripts/validate-docs-links.ts`) — session log — MEMORY.md index — CHANGELOG auto-add — audit gate — sensitive file check — branch creation — commit — push — PR.
**Usage**: `bun run dev-sync "feat: description"`
**Claude Code / Gemini**: `/sync "feat: description"`
**v1.5.0**: Added pre-flight markdown link validation gate (`bun scripts/validate-docs-links.ts`) executed before git operations to ensure all documentation links resolve.

#### `test-runner.ts`
**Purpose**: Test suite execution framework supporting `unit`, `integration`, `scenarios`, and `scripts` suites. Features parallel test execution with worker pool concurrency, worker temp directory isolation (`TEST_TEMP_DIR`), automatic fallback to sequential execution on failure, and per-suite timeouts. The `scripts` suite runs sequentially by default (v1.3.0): its E2E members stage transient fixture dirs under the real `templates/` tree and race concurrent validators when parallel; a post-suite hygiene assertion fails the suite if `docs/templates/` gained modifications or transient fixture dirs (`test-l3promo-*`, `co-e2eguard-*`, `co-e2p2*`) were left behind.
**Usage**:
- `bun scripts/test-runner.ts [suite] [flags]` (default suite: `integration`)
- Via `package.json` aliases: `bun run test`, `bun run test:unit`, `bun run test:e2e`, `bun run test:full`
**CLI Flags**:
- `--parallel`: Enable parallel execution across test files (default when > 1 test file; overrides the scripts suite's sequential default — you own the race)
- `--sequential`: Force sequential test file execution
- `--concurrency <n>`: Set worker pool concurrency level (default: CPU core count up to 4)
- `--timeout <ms>`: Set per-test execution timeout in milliseconds
**v1.3.0**: T-20260916-001 — per-suite `sequential` flag (scripts suite sequential by default) + post-suite hygiene assertion (no new `docs/templates/` modifications, no leftover transient fixture dirs).
**v1.1.0**: Documented parallel execution capabilities, worker pool temp directory isolation (`tests/.temp/worker-<id>`), automatic sequential fallback, and CLI flags (`--parallel`, `--sequential`, `--concurrency <n>`, `--timeout <ms>`).

#### `sync-md.ts`
**Purpose**: Updates `memory/MEMORY.md` index with today's session entry.
**Usage**: Called automatically by `bun run dev-sync`. Rarely invoked directly.

#### `gen-pr-body.ts`
**Purpose**: Generates a structured template PR body from commit message + file list — template fallback for `dev-sync.ts`. (AI-mode generation via `claude -p` was removed in 1.2.0; the agent writes the PR body itself per `skills/sync/SKILL.md`.)
**Usage**: Invoked automatically. Can be called standalone: `bun run gen-pr-body "msg"`

#### `generate-scripts-readme.ts`
**Purpose**: Auto-generates scripts/README.md from SCRIPTS.md registry.
**Usage**: `bun scripts/generate-scripts-readme.ts`
**Runs automatically**: `bun run dev-sync`

#### `generate-scripts-mirror.ts`
**Purpose**: Generates the `templates/common/scripts/SCRIPTS.md` registry-table span from the root registry plus the template scripts tree (L1 mirror = derived projection; spec `2026-09-25-propagation-engine-batch-design` §6-D6/§14). L0-only — never appears in its own output.
**Usage**: `bun scripts/generate-scripts-mirror.ts` (write) | `--check` (compare, exit 1 on drift)
**Runs automatically**: `bun run dev-sync` (Step 2.6); enforced by `lifecycle-sync-audit` Check B projection arm

#### `compile-tokens.ts`
**Purpose**: Design token compiler for `co-design`. Reads `templates/co-design/tokens.json` and generates CSS custom properties (`:root { --color-primary: ... }`) and TypeScript constant types (`tokens.ts`) for design system consistency. v1.1.0: a reserved top-level `themes` object (e.g. `dark`, `high-contrast`) compiles to `[data-theme="<name>"]` CSS blocks after `:root` plus a `themes` export in the TS output; a tokens file without `themes` compiles unchanged.
**Usage**: `bun scripts/compile-tokens.ts [--input <path>] [--out-css <path>] [--out-ts <path>] [--watch] [--check]`

#### `generate-ide-rules.ts`
**Purpose**: IDE context rules generator for `.cursorrules` and `.clauderules`. Generates IDE-specific context rules dynamically based on workspace context and agent rosters.
**Usage**: `bun scripts/generate-ide-rules.ts [--check] [--force] [--dir <path>]`

#### `render-pdf-deck.ts`
**Purpose**: Playwright paged-media presentation PDF renderer. Converts HTML presentation decks into paginated PDF files respecting `@page` print rules using Playwright headless Chromium.
**Usage**: `bun scripts/render-pdf-deck.ts [--input <file>] [--output <file>] [--check]`

#### `md-to-ooxml.ts`
**Purpose**: Markdown to Microsoft Office OOXML (`.docx` / `.xlsx` / `.pptx`) compiler script for `co-work`. Compiles Markdown source files into native Microsoft Office Open XML structures. The `.pptx` writer maps each `# ` H1 heading to a slide (heading text → title placeholder) and the content up to the next H1 to the body placeholder: list items → bullet paragraphs (indentation depth → bullet level), `##`/`###` → bold lead-in bullets, paragraphs/tables/code blocks → plain-text lines (simplified).
**Usage**: `bun scripts/md-to-ooxml.ts --input <file.md> [--output <file>] [--type docx|xlsx|pptx] [--check]`

---

### Installation

> **Bun is a workspace prerequisite.** Install it once via the [official installer](https://bun.sh/docs/installation) before using any script. `install-bun.sh/ps1` have been deleted (ADR-0036).

---

### Agent Lifecycle Scripts (Bun / TypeScript)

#### `agent-create.ts`
**Purpose**: Creates a new agent file with proper frontmatter and required sections.
**Usage**: `bun scripts/agent-create.ts <name> --role "Display Name" --group <group>`

#### `agent-delete.ts`
**Purpose**: Removes an agent file and updates AGENTS.md.
**Usage**: `bun scripts/agent-delete.ts <name> [--force]`

#### `agent-list.ts`
**Purpose**: Lists all agents with their status, group, and tier.
**Usage**: `bun scripts/agent-list.ts [--group <group>] [--verbose]`

#### `agent-verify.ts`
**Purpose**: Verifies agent/AGENTS.md synchronization (files vs. registry).
**Usage**: `bun scripts/agent-verify.ts`

#### `agent-lifecycle-audit.ts`
**Purpose**: Full agent lifecycle audit —frontmatter validation, AGENTS.md consistency,
deprecated agent references, missing fields.
**Usage**: `bun scripts/agent-lifecycle-audit.ts`
**Runs automatically**: pre-commit hook when `agents/*.md` files are staged.


### Skill Lifecycle Scripts (Bun / TypeScript)

#### `skill-lifecycle-audit.ts`
**Purpose**: Full skill lifecycle audit —owner validation, orphaned skills, deprecated
skills still being modified, dependency graph, circular dependencies, `scope` field validity.
**Usage**: `bun scripts/skill-lifecycle-audit.ts`
**Runs automatically**: pre-commit hook when `skills/**` files are staged.
**v1.2.0**: `scope` validation now accepts `workspace | common | variant | <current project's own directory name>` (was previously only the literal string `variant`, which incorrectly flagged legitimate variant-name scope values like `scope: co-consult`); `docs/_examples/skills/**` excluded from scanning (illustrative documentation, not real skills). Run once per location (workspace root + each `templates/co-*/` variant + `templates/common/`) since agent/scope resolution is relative to `cwd`.

#### `readme-lifecycle-audit.ts`
**Purpose**: Validates README.md / README_ko.md pairing in `templates/` directories.
**Usage**: `bun scripts/readme-lifecycle-audit.ts`

#### `release-template.ts`
**Purpose**: Atomic template release helper. Bumps `templates/VERSION`, cuts `templates/CHANGELOG.md` `[Unreleased]` into a versioned section, then delegates tag creation to `tag-template.ts`.
**Usage**: `bun scripts/release-template.ts --version X.Y.Z --no-tag` or `bun scripts/release-template.ts --bump patch --push`

#### `tag-template.ts`
**Purpose**: Creates the `template-v{templates/VERSION}` git tag and optionally pushes it.
**Usage**: `bun scripts/tag-template.ts [--dry-run] [--no-push] [--fail-on-push-error]`
#### `verify-skills.ts`
**Purpose**: Cross-validates skills referenced in `docs/context.md` against actual
skill files on disk. Detects missing or orphaned skill references.
**Usage**: `bun scripts/verify-skills.ts`

#### `sync-skill-status.ts`
**Purpose**: Synchronizes skill status between SKILL.md and registry tables.
**Usage**: `bun scripts/sync-skill-status.ts`

#### `new-project.ts`
**Purpose**: Scaffolds a new project under `Projects/<name>` (bare names; path-like names
are explicit workspace-relative destinations, used by `test-new-project.ts`). Copies
`templates/common/` and an optional variant, substitutes `[Project Name]` placeholders,
strips L1-B metadata from `agents/pm.md`, flattens `docs/_common/`, and runs the
post-scaffold audit.
**Usage**: `bun scripts/new-project.ts <name> <variant>`
**Breaking change from**: `bash scripts/new-project.sh` / `.\scripts\new-project.ps1` (removed 2026-06-11, ADR-0036)
**Note**: L0 script (workspace infrastructure only). Changes must be versioned in SCRIPTS.md.

#### `remove-project.ts`
**Purpose**: Safely deletes a project directory without requiring administrator privileges.
Detects running Claude Code / Antigravity processes with user confirmation before removal.
**Usage**: `bun scripts/remove-project.ts <project-name>`
**Breaking change from**: `.\scripts\remove-project.ps1` / `bash scripts/remove-project.sh` (removed 2026-06-11, ADR-0036)
**Note**: L0 script.

#### `sync-skills.ts`
**Purpose**: Distributes skills from a project's SSOT (`skills/`) to its runtime locations
(`.claude/skills/`, `.gemini/skills/`, `.agents/skills/`, `.codex/skills/`, `.hermes/skills/`). Run after any change to `skills/`
to ensure Claude Code, Gemini CLI, Antigravity, Antigravity CLI, Codex, and Hermes Agent pick up the update.
**Usage**:
- `bun run sync-skills` — workspace root only (default, unchanged from prior versions)
- `bun scripts/sync-skills.ts --dir templates/co-consult` — a single project root (variant or `templates/common`)
- `bun scripts/sync-skills.ts --all-variants` — every `templates/co-*/` variant plus `templates/common/`
**v1.9.0**: fifth platform target `.hermes/skills/` (NousResearch Hermes Agent, ADR-0088 W1 — Hermes invokes skills natively as `/<skill-name>`, so no Phase 1b analog exists).
**v1.7.0**: fourth platform target `.codex/skills/` (Codex CLI + Desktop App, ADR-0077 W1) and Phase 1b — `.claude/commands/*.md` mirrored to `.codex/prompts/` as Codex custom prompts (live-support gate in W5).
**v1.4.0**: added `--dir`/`--all-variants` — the workspace-root-only default was silently leaving `.agents/skills/` (Antigravity CLI) far behind `.claude/skills/`/`.gemini/skills/` in every variant (discovered during a full skill-lifecycle audit, 2026-07-19). Run `--all-variants` after any variant-level skill change.

#### `sync-template-deps.ts`
**Purpose**: Automatic dependency version sync from root package.json to templates/common/package.json + bun.lock regeneration. Root package.json is the SSOT for shared dependency versions.
**Usage**: `bun scripts/sync-template-deps.ts [--check|--apply]`
**Runs automatically**: dev-sync step 4.52 (after propagate step 4.5, before audit step 4.9)
**Sync policy**:
- Shared deps (present in both root and template): aligned to root version
- Root-only deps: NOT auto-added to template (e.g., semver, @types/js-yaml)
- Template-only deps: NOT auto-removed (manual decision required)
- engines: aligned if shared fields differ

#### `sync-skills-to-l2.ts`
**Purpose**: Synchronizes explicitly requested skills or scripts from L1 (templates/common) to L2 variants.
**Usage**: `bun scripts/sync-skills-to-l2.ts`

#### `resolve-variants.ts`
**Purpose**: L1-B Phase script that pre-resolves `extends:` skeleton references in each `templates/co-*/` variant. Writes fully-merged files in-place so that audit can validate complete content before `new-project` runs. After resolution, `new-project.ts` only needs a simple file copy — no `merge-frontmatter` step required.
**Usage**: `bun scripts/resolve-variants.ts [--force] [--variant co-develop]`
**Idempotency**: files already marked `# @resolved-from:` are skipped unless `--force` is passed.
**Note**: L0 script (workspace infrastructure only). Not copied to `templates/common/scripts/`.

#### `verify-readme-sync.ts`
**Purpose**: Validates README.md / README_ko.md hash synchronization for workspace root and templates.
Audits user-guide.md / user-guide_ko.md translated_from_hash synchronization (FAIL stage per ADR-0055 playbook after WARN soak).
**Usage**: `bun scripts/verify-readme-sync.ts [--pre-commit] [--update-hashes]`
**v1.4.0**: Promoted user-guide translated_from_hash gate from WARN to FAIL (promoted 2026-08-24 after WARN soak through PR #647 with zero warnings observed); now returns failure count and affects exit code.
**v1.3.0**: Added user-guide translated_from_hash WARN-stage audit — detects missing/stale hashes in KO guides; --update-hashes now also seeds translated_from_hash in user-guide_ko.md frontmatter.

#### `verify-memory.ts`
**Purpose**: Validates `memory/*.md` session logs for mandatory 4-section format compliance
(`## Session Summary`, `## Changes`, `## Decisions`, `## Open Issues`) and detects
orphaned files not registered in `MEMORY.md` index.
**Usage**: `bun scripts/verify-memory.ts [--verify | --report]`
**Runs automatically**: pre-commit hook when `memory/*.md` files are staged.

#### `archive-memory.ts`
**Purpose**: Archives memory markdown files older than 7 days to keep the root memory directory clean and within context limits.
**Usage**: `bun scripts/archive-memory.ts`

---

### Multi-Agent Orchestration Scripts (Bun / TypeScript)

#### `dispatch.ts`
**Purpose**: Single-agent dispatch wrapper. Spawns one agent with a given prompt and
waits for completion.
**Usage**: `bun scripts/dispatch.ts parallel --dry-run [--task "desc:role:task[:priority]"]` or `bun scripts/dispatch.ts serial --dry-run [--pipeline file.ts]`

#### `dispatch-parallel.ts`
**Purpose**: Parallel multi-agent dispatch. Spawns multiple agents simultaneously and
collects results when all complete.
**Usage**: `bun scripts/dispatch-parallel.ts --dry-run [--task "desc:role:task[:priority]"]`

#### `dispatch-serial.ts`
**Purpose**: Serial multi-agent dispatch. Chains agents sequentially, passing each
agent's output as input to the next.
**Usage**: `bun scripts/dispatch-serial.ts --dry-run [--pipeline file.ts]`

#### `retry-handler.ts`
**Purpose**: Wraps any dispatch call with retry logic (configurable attempts, backoff).
**Usage**: `import { withRetry } from './retry-handler.ts'` (library module)

---

### Platform Parity Scripts (Bun / TypeScript)

#### `test-platform-parity.ts`
**Purpose**: Validates platform parity between L0 workspace files and their L1/L2 counterparts per ADR-0033.
Compares CLAUDE.md, GEMINI.md, and agents/pm.md across workspace root, templates/common/, and all L2 variants.
**Usage**: `bun scripts/test-platform-parity.ts [--verbose]`
**Runs automatically**: As part of audit.ts (non-lifecycle-only mode)
**Exit codes**: 0 (pass), 1 (errors), 2 (warnings)
**See also**: `docs/platform-parity-rules.md` for detailed parity rules

#### `validate-pm-extends.ts`
**Purpose**: Validates pm.md extends chains for correctness and compliance per ADR-0033.
Checks 6 validation rules: syntax, circular references, depth limits, file existence, override validity, and platform parity.
**Usage**: `bun scripts/validate-pm-extends.ts [options] [files...]`
**Options**:
  - `--fix` - Auto-fix simple issues (optional)
  - `--verbose` - Detailed output
  - `--json` - JSON output format
  - `--max-depth N` - Set custom max depth (default: 3)
**Exit codes**: 0 (all valid), 1 (errors found)
**Examples**:
  - `bun scripts/validate-pm-extends.ts` (validate all pm.md files)
  - `bun scripts/validate-pm-extends.ts agents/pm.md` (validate specific file)
  - `bun scripts/validate-pm-extends.ts --json` (CI/CD friendly output)

---

### Propagation Scripts (Bun / TypeScript)

#### `propagate-to-templates.ts`
**Purpose**: Publishes L0 workspace scripts and governance docs to L1 (`templates/common/`) and propagates L1 changes to L2 variant templates. This is the consolidated propagation tool invoked via `bun run propagate:apply`.
**Usage**: `bun scripts/propagate-to-templates.ts [flags]`
**Layer**: L0 (workspace infrastructure only — not copied to templates/common/, templates/co-*/, or L3 projects)
**Aliases**: `bun run propagate:apply` (--apply), `bun run propagate:dry-run` (--dry-run)

**Flag → Layer/Phase Mapping**:

| Flag | Layer Operation | Phase Context |
|------|----------------|---------------|
| `--apply` | L0 → L1(common) sync | Phase A: install scripts into common template |
| `--dry-run` | L0 → L1(common) diff | Any phase: preview changes before applying |
| `--governance-l1` | L0 governance → L1(common) | Phase A: deploy CLAUDE.md/GEMINI.md/AGENTS.md to L1 |
| `--docs` | L1(common) → L1(variants) COMMON marker injection | Phase B: prepare variant-specific governance docs |
| `--prune` | L1(common) cleanup | Maintenance: remove L0-only orphan files from L1 |
| `--check-drift` | L1 vs L2 drift report | Any phase: verify L2 variants not diverged from L1 |
| `--include-disabled` | Opt-in override | Include domains marked `disabled: true` (e.g. `docs`) in the dry-run report only — combining with `--apply` is a hard error (exit 1), not a silent write |

**Typical workflow**:
```bash
bun scripts/propagate-to-templates.ts --dry-run          # preview L0→L1 changes
bun scripts/propagate-to-templates.ts --apply            # publish scripts L0→L1
bun scripts/propagate-to-templates.ts --governance-l1    # publish governance docs L0→L1
bun scripts/propagate-to-templates.ts --docs             # inject COMMON markers into variants (Phase B)
bun scripts/propagate-to-templates.ts --prune            # remove orphan files from L1
bun scripts/propagate-to-templates.ts --check-drift      # report L1 vs L2 drift
bun scripts/propagate-to-templates.ts --domain docs --include-disabled --dry-run  # inspect a disabled domain
```

**Disabled domains**: a domain entry may carry `"disabled": true` in `propagation-map.json` to declare it *intentionally* inactive (as opposed to silently never having worked — see the `docs` domain's `note` field for the concrete incident this guards against). Default runs skip it and print why; `--include-disabled` is a read/inspect escape hatch, not a way to reactivate it — flip the flag in `propagation-map.json` itself once the underlying policy question is resolved.

### L3 Variant Tooling (Bun / TypeScript)

#### `generate-l3-readme.ts`
**Purpose**: Regenerates `README.md`/`README_ko.md` for a Phase A L3 project (`Projects/<name>/`) from the workspace README Standard template (`templates/common/docs/README.template.md`), reading the live agent roster and skills via `scanL3Project()`. This is the Phase A self-service complement to `l3-to-variant-pipeline.ts`'s Phase B README generation — both call the same rendering engine (`helpers/generate-variant.ts`'s `generateReadme`/`generateReadmeKo`), so Phase A and Phase B READMEs can never drift structurally. Phase A is self-service only (no CI gate, consistent with the L3 Design Gate exemption); Phase B's `templates/co-*/` README standard stays hard-enforced by `WS-08` in `validate-templates.ts`. `create-l3-scaffold.ts` also calls this renderer directly at scaffold time, so even a same-day scaffold ships the real 7-section structure instead of a stub.
**Usage**: `bun scripts/generate-l3-readme.ts [--l3-path <path>] [--dry-run] [--locale en|ko|both]`
**Layer**: L0 (workspace infrastructure — not copied to templates/common/ or L3 projects)

**Flags**:

| Flag | Behavior |
|------|----------|
| `--l3-path <path>` | Target L3 project (defaults to `process.cwd()` — works bare from inside the project) |
| `--dry-run` | Print planned output (agent/skill counts, files would-write) without writing |
| `--locale en\|ko\|both` | Which README(s) to regenerate (default: `both`) |

**Typical workflow**:
```bash
bun scripts/generate-l3-readme.ts --l3-path Projects/co-journalist --dry-run  # preview
bun scripts/generate-l3-readme.ts --l3-path Projects/co-journalist            # write both
cd Projects/co-journalist && bun scripts/generate-l3-readme.ts                # bare form (cwd)
```

---

## Version Bump Policy

When modifying a script:
1. Increment `version` in the Registry row (semver: patch for bugfix, minor for feature)
2. Update the Guide section if the interface or behavior changes
3. If the change is breaking, set `status: deprecated` on the old version entry and
   add a new row for the replacement

---

*SCRIPTS.md maintained by: workspace maintainer (L0 SSOT)*
*Last updated: 2026-09-20 — Q3 2026 skill review reporting fixes (docs/designs/2026-09-20-skill-session-review-reporting-fixes-design.md): skill-session-review v1.0.0 → v1.1.0 (renderMarkdown now distinguishes "no evidence" from "evidence parsed, zero symptoms classified" instead of always claiming the `## Skills Used` section is absent/empty — 11 misleading zero-blocks accumulated on 2026-09-20 alone; parseSkillsUsed dedupes the tail section by prefix because the tail match extends past the `---` boundary, so the old identity comparison never fired and the final section was counted twice — 3 real entries reported as 6; evidence schema, classifier, and CLI surface unchanged); previous: 2026-09-18 — Manifest date-masked check (ADR-0081 / T-20260918-001, docs/designs/2026-09-18-delivery-pipeline-hardening-design.md): generate-version-manifest v1.6.2 → v1.7.0 (--check masks the git-log-derived "Last Modified" columns on both comparison sides unconditionally — the shallow-only gating of v1.6.0 is gone; the cells always lag the generating PR's own commit by one commit because generation (dev-sync step 4.7) precedes the commit (step 6), so day-boundary crossings failed full-history CI on merge previews — PR #954 first CI run + forced eb6901ab convergence commit; structural rows (name/file/tier/model/version/location/triggers) still compare literally; isShallowRepository retained exported for date-source work; comparator fixtures pin date-only-passes / tier+path-still-fail); previous: Pre-push ref-deletion skip (T-20260916-014, docs/designs/2026-09-16-pre-push-deletion-skip-design.md): hooks/pre-push.ts v1.3.0 → v1.4.0 (pure ref-deletion pushes — every pre-push stdin line carries an all-zero local OID, 40 or 64 zeros — now early-exit with a skip note before the gate battery: a deletion push transfers no commits, so gitleaks/audit/changed-path tests had nothing content-bearing to gate, and the unconditionally-run `audit.ts --lifecycle-only` blocked all 15 branch deletions during the 2026-09-16 fleet cleanup (co-* projects, failing project-side audits) forcing a GitHub-API fallback; isZeroOid (SHA-1 + SHA-256 null OIDs) replaces the hard-coded 40-zero constant across the gitleaks scope filter, changed-path collector, and branch-protection exemption — one deletion definition, no check weakened for commit pushes; mixed pushes keep the full gate; empty stdin and malformed lines are fail-closed (gate runs); main() now runs under import.meta.main so unit tests import the exported helpers (git still invokes the file as main — hook behavior unchanged); L1 scripts/hooks mirror refreshed via propagate-to-templates (scripts-hooks domain); .githooks/pre-push shell wrappers untouched and byte-identical (Check G); tests/unit/pre-push-deletion-detection.test.ts v1.0.0); previous: Manifest gate shallow tolerance (T-20260916-013, docs/designs/2026-09-16-manifest-gate-shallow-tolerance-design.md): generate-version-manifest v1.5.0 → v1.6.0 (--check is shallow-tolerant: `git rev-parse --is-shallow-repository` detects a shallow CI checkout (actions/checkout default depth=1), where git-log-derived per-file Last Modified dates fall back to checkout-time values and the committed manifest permanently drifts against CI regeneration no matter what is committed — real case: co-safety Documentation Audit job, fixed with fetch-depth: 0 in the fleet resync, PR #149); in shallow mode diffManifests runs with { ignoreDateColumns: true } — the volatile Last Modified cells are masked on BOTH sides, the column index derived from each table's header row (never a hard-coded position), so structural drift (rows added/removed, name/version/path changes) is still caught, and a concise info line names the degraded mode; full-history behavior stays byte-identical to v1.5.0 (dates compared); diffManifests's third parameter is now an options object ({ ignoreDateColumns?, limit? }); the audit.ts gate spawns --check and inherits the fix with no changes; tests/unit/registry-version-parity.test.ts v1.0.0 → v1.1.0 (maskDateColumns pins + shallow-mode cases: date-only drift ignored, structural drift caught, full-history unchanged); Projects/co-safety/.github/workflows/safety-audit.yml checkout steps set fetch-depth: 0 (project-side, mirrors the ci.yml fleet-resync fix); previous: Managed-block merge fix (T-20260916-012, docs/designs/2026-09-16-managed-block-merge-fix-design.md): upgrade-project v1.30.0 → v1.31.0 (mergeWorkspaceManaged's unlabeled-blocks reconciliation counted ALL project pattern occurrences — keyed WORKSPACE-MANAGED/VARIANT-INJECT blocks included — against a template count of UNLABELED blocks only, so a project file whose only managed blocks were keyed hit the count-mismatch branch and the reconcile replaced the first-to-last span with an EMPTY join: the real 2026-09-16 co-develop upgrade deleted the project .gitignore WORKSPACE-MANAGED secrets block (.env/*.pem — caught only because the upgrade's own security bootstrap gate failed) and AGENTS.md's 43-line graft repo context graph block; the reconcile/positional offsets were also captured BEFORE the keyed replacements mutated the content, so even legitimate reconciles sliced stale positions; fix: merge core extracted to the new L0-only lib/managed-block-merge.ts v1.0.0 (pure mergeManagedBlocks(projectContent, templateContent, commonContent, rel, dryRun) → {content, merged, log}; findManagedBlocks/buildBlockKeyMap/findInsertionPosition moved with it, new buildMergedTemplateBlocks exposes the variant∪common union) — keyed and unlabeled project occurrences tracked separately, unlabeled reconcile/positional branches compare and slice ONLY unlabeled spans, and unlabeled occurrences are re-scanned AFTER the keyed phase for fresh offsets (zero-unlabeled-template reconciles still remove stale unlabeled project blocks by design but can never touch keyed blocks); all MERGED/INSERTED/APPENDED/RECONCILED/WARNING/INFO log lines preserved verbatim; COMMON-* zones byte-identical; upgrade-project.ts becomes a thin fs wrapper (read → merge → write when !dryRun → print log)), tests/unit/managed-block-merge.test.ts v1.0.0 (18 tests: keyed merge/insert, THE BUG keyed-only-blocks regression, fresh-offset reconcile + equal-count positional after a length-changing keyed merge, unlabeled append, unlabeled-only reconcile removal, COMMON-AGENTS START/END parity, per-key union variant∪common, dryRun purity); previous: New-project provenance fallback alignment (T-20260916-002, docs/designs/2026-09-16-new-project-provenance-alignment-design.md): new-project v1.19.0 → v1.20.0 (scaffold provenance resolution loses its silent "unknown" tail — without --version, templates/VERSION is read pre-flight via helpers/template-version.ts resolveProvenanceVersion() and a missing/unparseable SSOT aborts before any scaffolding work; explicit --version values still win as-is; downstream provenance output formats unchanged), helpers/template-version v1.0.0 → v1.1.0 (new resolveProvenanceVersion(explicit, rootDir) pins the shared resolution order — flag wins as-is, otherwise the fail-loud SSOT read), new tests/unit/provenance-version-resolution.test.ts v1.0.0 (flag-wins order, SSOT read, missing/unparseable fail-loud), tests/unit/lifecycle-sync-checks.test.ts v1.1.0 → v1.2.0 (new-project record pin 1.19.0 → 1.20.0), docs/lifecycle/scripts/new-project.md record synced to 1.20.0, docs/VERSION_MANIFEST.md regenerated; previous: 2026-09-16 — Template-tree infrastructure consistency batch (T-20260916-001/-008, docs/designs/2026-09-16-template-tree-infra-consistency-design.md): test-runner v1.2.0 → v1.3.0 (per-suite `sequential` flag — scripts suite runs one E2E at a time because test-l3-to-variant-promotion stages transient fixture dirs under the real templates/ tree and parallel members raced concurrent validators; plus a post-suite hygiene assertion — any NEW docs/templates/ modification or leftover test-l3promo-*/co-e2eguard-*/co-e2p2* dir under templates/ fails the suite, delta-based so pre-existing dirt is never blamed on the run), helpers/scaffold-markers v1.2.0 → v1.3.0 (TRANSIENT_TEST_FIXTURE_PREFIXES + isTransientTestFixture — one shared name predicate between the E2E producer and the validator skippers; test-l3-to-variant-promotion v1.5.0 → v1.6.0 derives its fixture names from the same constants), validate-templates v1.32.0 → v1.33.0 (all seven templates/ enumeration sites skip transient fixture dirs — closes the B-07 VERSION_REGISTRY.json pollution class and the managed-block-parity FAIL-on-fixture arm; new `platform-mirror-freshness` check: every skill present in BOTH a templates/common/.{claude,gemini,agents,codex}/skills mirror and the skills/ SSOT must carry the same version), propagate-to-templates v2.15.1 → v2.16.0 (removed the claude-skills/gemini-skills/agents-skills scope-skip — it left upgrade-project stale at 1.4.1 in three L1 mirrors, delivered stale to every fresh project, while the codex mirror without the skip tracked 1.5.0; all four platform domains now propagate uniformly), lib/platform-mirror-freshness v1.0.0 (new pure comparison lib, unit-tested), tests/unit/transient-test-fixtures.test.ts v1.0.0 + tests/unit/platform-mirror-freshness.test.ts v1.0.0 (new; scratch-dir fixtures only), templates/common/scripts/SCRIPTS.md mirror rows bumped in lockstep), 2026-09-16 — Upgrade-target realpath guard batch (T-20260916-006/-007, docs/designs/2026-09-16-upgrade-target-realpath-guard-design.md): upgrade-project v1.29.0 → v1.30.0 (H14: fs.realpathSync canonicalization of the upgrade target after the existsSync pre-check, workspaceRoot and Projects/ canonicalized once, root guard + containment compare canonical forms — a symlink resolving to the root now hard-fails; outside-Projects WARN promoted to a fail-closed confirm-prompt naming the canonical target, fires for dry-run, EOF/non-y answers abort with exit 1, --yes stays the single scripted consent token), tests/unit/project-target-guards.test.ts v1.0.0 → v1.1.0 (H14 negative coverage: symlink-to-root guard, outside-Projects EOF/n abort + y/--yes consent, inside-Projects never prompts, missing-target pre-canonicalization); previous: Variant-ization overlay guard batch (T-20260916-003/-004/-005, docs/designs/2026-09-16-variant-ization-overlay-guard-design.md): project-to-variant v1.3.0 → v1.4.0 (fail-closed exists-guard on templates/<target>/ immediately after targetDir resolution — absent → proceed; missing/unparseable variant.json or stable/deprecated status → hard refuse, no bypass; beta/pre-release → refuse unless the new --overlay-variant flag; authorized overlays snapshot the previous tree before the copy loop and an M13/H11-style process.on('exit') hook rolls back fresh (rollbackPartialProject) or restores the snapshot on ANY nonzero exit, discards it on success), l3-to-variant-pipeline v1.18.0 → v1.19.0 (new PHASE 0.6 overlay guard BEFORE Phase 1 — precedes the Phase 3.5 auto-fix that can write into a live templates/<variant>; rollback wired through the module failure paths (failWithRollback) instead of process hooks because the E2E harness imports the execute function; green overlay runs discard the snapshot; --overlay-variant flag + PipelineConfig.overlayVariant), new lib/variant-overlay-guard v1.0.0 (shared fail-closed classification — the ONE guard implementation imported by all three enforcement points; stable message prefix 'OVERLAY GUARD'), helpers/generate-variant v1.14.0 → v1.15.0 (guard at the output-path resolution — last line of defense for any future generateVariant caller; explicit output outside templates/ exempt; new optional options.overlayAuthorized parameter), helpers/rollback-partial-project v1.0.0 → v1.1.0 (overlay snapshot-rename trio: snapshotDirForOverlay/restoreOverlaySnapshot/discardOverlaySnapshot — dot-prefixed sibling .overlay-backup-<name>-<UTC stamp>, invisible to deriveCoVariantDirs; best-effort, never masks the original error), test-l3-to-variant-promotion v1.3.0 → v1.4.0 (Test 6: second-run refusal against a staged already-promoted beta slot names --overlay-variant, stable slot refuses even with overlayVariant, no .overlay-backup-* strays in templates/; Tests 3–5 stay green on the exempt --output path); L0+L1 mirrors updated in lockstep (generate-variant, rollback-partial-project, variant-overlay-guard newly delivered to templates/common/scripts via layer L0+L1); new tests: tests/unit/variant-overlay-guard.test.ts (classification matrix + project-target-guards-style subprocess negatives), tests/unit/overlay-snapshot-rollback.test.ts (trio round-trip byte-identical + mtime order + containment); previous: 2026-09-16 — Scaffold fresh-audit remediation batch (T-20260916-009/-010/-011, docs/designs/2026-09-16-scaffold-fresh-audit-remediation-design.md): validate-templates v1.31.0 → v1.32.0 (new PM-04 `managed-block-parity` — every WORKSPACE-MANAGED block in templates/common/AGENTS.md must exist, marker-wrapped with content parity, in every templates/co-* variant AGENTS.md (set-of-normalized-contents per key; duplicates legitimate); new `variant-version-manifest` — variant templates must NOT ship docs/VERSION_MANIFEST.md, retiring the 11-of-13 stub class), new lib/managed-block-parity v1.0.0 (keyed-block extraction + set-parity comparison, shared by the validator and the data fix), new lib/platform-delivery v1.0.0 (platform-delivery-aware prose-target partitioning), validate-model-registry v1.3.0 → v1.4.0 (the CODEX.md 3-Tier prose target self-skips with a visible note when the codex platform was not delivered — neither CODEX.md nor .codex/ exists — so codex-opt-out projects stop failing their own audit with "could not read CODEX.md"), new-project v1.18.0 → v1.19.0 (§7.8 generates the project's full docs/VERSION_MANIFEST.md post-delivery via the project's own scripts/generate-version-manifest.ts, cwd = projectDir, loud non-fatal — before the post-scaffold audit), upgrade-project v1.28.0 → v1.29.0 (post-upgrade manifest regeneration replaces any retired stub and refreshes the manifest after agents/skills/scripts changed), lib/upgrade-policy v1.5.0 → v1.6.0 (docs/VERSION_MANIFEST.md joins REGENERATED_FILES — never template-delivered, so the deny-list default can no longer deliver a template copy over a project's generated manifest), helpers/scaffold-markers v1.1.0 → v1.2.0 (VERSION_MANIFEST relpath constants + decideManifestGeneration invoke semantics), template data: all 13 templates/co-*/AGENTS.md now carry the current marker-wrapped tier-model-mapping blocks (§3.6 3-tier list + §5.3 Model-column note) replacing the stale 2-model prose (11 variants) or a fresh §3.6 section (co-abap/co-price), and the 11 stub docs/VERSION_MANIFEST.md files are deleted from templates/co-*/docs/; previous: 2026-09-16 — Wave 5 (T-20260915-008/-009/-012): lifecycle-sync-audit v1.13.0 → v1.14.0 (new Check H — script lifecycle record version gate: docs/lifecycle/scripts/<name>.md Version must equal the script's SCRIPTS.md version; missing field WARNs, mismatch ERRORs; records are opt-in), helpers/template-utils v1.1.1 → v1.2.0 (DEFAULT_PM_ROLE_DESCRIPTIONS completed from 5 to all 13 variants), helpers/scaffold-markers v1.0.0 → v1.1.0 (NEW_PROJECT_L1_ONLY_AGENTS stale entries dropped — only the resolving agents/_COMMON.md remains); previous: 2026-09-12 — T-20260912-001: upgrade-project v1.24.0 → v1.25.0 (TEMPLATE TREE SYNC's SYNC branch now preserves project-only content in docs/context.md on template footer bumps: a findProjectOnlySections gate skips the copy with a loud CONTEXT PRESERVE log when the project copy carries top-level sections absent from the template (COMMON-*/VARIANT-INJECT managed-zone-aware) or no version footer at all (wholeFileOwned — fully restructured file); new --force-context-sync flag takes the template version anyway and logs the discarded section count; no project-only content keeps the exact UPDATE/CONFLICT behavior; dry-run verdict parity), helpers/context-sections v1.2.0 → v1.3.0 (new findProjectOnlySections() ownership-detection helper powering the gate; both SCRIPTS.md registry rows updated in lockstep — L1 upgrade-project row also reconciled 1.22.1 → 1.25.0); previous: 2026-09-12 — T-20260912-025: helpers/ticket-store v1.2.0 → v1.2.1 (nextSeqGuess now scans both tickets/ and tickets/governance/ — ids are one namespace across the two directories because move/list resolve governance/ first, so a service create could mint a same-day id that shadow-matched a governance ticket and move it instead; regression test added); previous: 2026-09-12 — T-20260912-015/023/024 final remediation batch: validate-md-language v1.10.0 → v1.11.0 (scan scope widened to docs/adr/, docs/decisions/, and docs/VERSION_MANIFEST.md — ADR-0072 declares lang: ko/proper-noun for its Korean term-node identifiers, DEC-20260825-02's quoted Korean user command was translated instead of excepted, and the generated manifest is covered by a new named generated-region allowlist (`validate-md-language:allowlist-begin/end` markers) rather than a whole-file lang: ko declaration so the rest of the manifest stays validated; memory/ exclusion documented in-code as a deliberate policy gray zone, not an oversight), generate-version-manifest v1.3.1 → v1.4.0 (emits the allowlist markers around the Skills table whose Triggers embed verbatim Korean k-* keywords), ticket.ts v1.1.0 → v1.2.0 (`move <id> done` now requires a non-empty `--result "<text>"` outcome summary; --force does NOT bypass it; audited nightly-tickets.yml/ticket-run — no automation closes tickets, so no callers needed changes), helpers/ticket-store.ts v1.1.0 → v1.2.0 (MoveOptions.result persisted on done transitions); non-script fixes in the same batch: MEMORY.md archive-linked rows converted to link-free tombstones (memory/archive/ is deliberately gitignored local-preservation per CONSTITUTION §2.3, so its links were dead on fresh clones; the mangled 2026-08-11 multi-line row was restored to a single well-formed row), explain-me references/BUILD_GUIDE.md BSD-only `sed -i ''` replaced with portable `sed -i.bak … && rm` across the SSOT and all platform mirrors, and edu-sync.yml claude_args gained the same `|| 'glm-5.3'` --model default nightly-tickets.yml already had; previous: 2026-09-12 — T-20260912-007/009/017/021 remediation batch: dev-sync v1.13.0 → v1.14.0 (two fail-open gates became fail-closed — step 3.7 now checks verify-scripts --check-drift's exit code and aborts on drift with the drift table visible (was .quiet().nothrow() discarding the result), and step 5 branch creation exit-code-checks the show-ref probe and both checkout forms, aborting BEFORE staging/commit instead of silently falling through to commit + push on main when a checkout is refused), sync-skills v1.7.0 → v1.8.0 (advisory .sync-skills.lock concurrency guard with PID-validated stale-lock recovery mirroring .githooks/post-checkout; atomic copy-to-temp-sibling + rename replaces the rm-then-cp window so an interrupted run cannot leave a half-written platform skill tree; Phase 2 SHORTCUT_SKILLS premise fixed — 'sync' and 'source-command-commit-push-pr' DO exist in the SSOT so Phase 1 clobbered then back-synced hand-edits: back-sync now applies only to genuinely .agents-only dirs discovered dynamically, and an .agents copy diverging from its SSOT counterpart emits a pre-flight WARN (compared before Phase 1 overwrites, or it could never fire); --dir with a missing value is a hard argument error and nonexistent target roots are rejected before any writes; syncSkills now returns { errors, warnings }), qa-gate v1.2.0 → v1.3.0 (Step 4 L0↔L1 parity deepened: recursive content comparison of scripts/ vs templates/common/scripts/ (was top-level .ts only), one-sided file detection scoped to the propagation-map mirror contract (top-level + helpers/ + hooks/ + lib/ .ts + propagation-map.json; L0-side flagged via a compact SCRIPTS.md layer registry — layer-filter.ts is the SSOT engine but layer-L0 so not importable from this L1-mirrored file; L1-side .ts flagged as orphans), and full-directory skill comparison (recursive, CRLF/constitution-normalized) for frontmatter-common skills — found and fixed the only real drift: explain-me's 7 SSOT subfiles (references/, scripts/validate_report.py, templates/) were missing from L1 because the skills propagation domain matches */SKILL.md only), lib/upgrade-policy v1.4.0 → v1.5.0 (PLACEHOLDER_ALLOWLIST admits explain-me templates/report.html + references/BUILD_GUIDE.md — the {{tokens}} are substituted by the skill at project runtime, not scaffold time), plus: new .github/gitleaks-full.toml (default rules WITHOUT the root config's path allowlists; commit-scoped allowlist for one verified historical test fixture) with a full-history deep-audit step + conditional Projects/ local hygiene report in weekly-health-check.yml (local full-history scan: 1120 commits clean), and .githooks/pre-rebase + its templates/common hand-maintained mirror gained the pre-push-style blocking regex secret-scan fallback for when gitleaks is not installed (pattern SSOT: scripts/hooks/pre-push.ts); previous: 2026-09-12 — T-20260912-005/010/014/016/019 batch: propagate-to-templates v2.12.0 → v2.13.0 (scrubConstitutionRefs moved to the new shared lib/constitution-scrub v1.0.0 so propagator and checkers can never disagree; scrub no longer corrupts functional .json field values — propagation-map.json's constitution-context source_file — and no longer rewrites policy self-description HTML comments into self-referentially false statements; new `--check-drift --json` machine-readable mode with stable exit codes 0/1/2), lifecycle-sync-audit v1.7.1 → v1.8.0 (Check C normalizes L0 skills through the shared scrub — sync/gateguard/translate's intentional CONSTITUTION.md→context.md substitution no longer warns and the fix hint can no longer recommend clobbering it; real content drift upgraded warning → FAILURE; new Check E: lifecycle-record Version/Owner vs SKILL.md frontmatter mismatch is a FAILURE; CLI dispatch wrapped in import.meta.main), validate-templates v1.24.0 → v1.25.0 (new B-03r/B-03a exists→declared manifest reconciliation WARNs — undeclared top-level scripts under scripts/<variant>/ and undeclared top-level agents/*.md, grace window before a FAIL decision; L0/L1 script parity now covers .json so propagation-map.json's byte-parity is actually enforced; scrub import switched to the shared lib, fixing the L1 mirror's dangling import of L0-only propagate-to-templates; main() returns the exit code, import-safe), spec-register v1.1.0 → v1.2.0 (import-safe: CLI dispatch under import.meta.main, helpers exported, REGISTRY_PATH resolved from import.meta.dir instead of cwd — CLI behavior byte-identical), and l3-to-variant-pipeline v1.17.0 → v1.17.1 (unhandled main() rejection now exits 1 instead of 0); manifest reconciliation fixes: co-game validate-asset-manifest.ts and co-deck watch-deck.ts declared in script_manifest.local, pm agent declared in co-safety/co-export/co-hr/co-news/co-price agents[]; lifecycle records refreshed to match SKILL.md frontmatter (sync v1.5.0, security-scan/validate-docs-links owner → pm, upgrade-project stub rewritten, project-resync v1.3.0, promote-variant v1.4.0, agent/skill/script-lifecycle-manager owner → pm); previous: 2026-09-12 — T-20260912-004/T-20260912-006 fix batch: new-project v1.14.0 → v1.15.0 (pm.md extends-stub resolution now keys on the `extends:` frontmatter key instead of an empty body, so the five prose-stub variants — co-export, co-hr, co-news, co-price, co-safety — scaffold a full PM agent instead of a body-less one; `variant_overrides`/`remove_sections` are rendered into body sections and stripped from the merged frontmatter per the ADR-0039/0034 scaffold-time contract; §2.5b sanitizer blanks the L0-reference text instead of dropping the line, so a docs/context.md version footer survives for upgrade version-sync; shared pattern moved to the new helpers/l0-ref-policy v1.0.0), audit v2.36.0 → v2.37.0 (L0 Leakage check exemption is occurrence-scoped — an intentional-duplicate marker exempts only its own line, not the whole file, so a real CONSTITUTION reference can no longer hide in a marker-bearing file; Fail lines now carry :<lineNo>; scan uses helpers/l0-ref-policy.ts findL0LeakLines), propagate-to-templates v2.11.0 → v2.12.0 (scrubConstitutionRefs rule A-8: bare `docs/constitution/` directory mentions are dropped from path lists or projected to `docs/` — A-7 only caught part-file mentions; found leaking through the constitution-context marker zone, masked by the old whole-file exemption), and test-new-project v1.0.4 → v1.1.0 (new Test 25 pins pm.md resolution — no `extends:`, no raw `variant_overrides:`, substantive PM body, template governance_workflow rendered into the body; Test 22 no longer passes on a dangling `extends:`; `--all-variants` loops the harness across all 13 templates/co-* variants); previous: 2026-09-12 — Version bumps for the graft multi-platform fleet rollout (ADR-0076): upgrade-project v1.23.0 → v1.24.0 (TEMPLATE TREE SYNC gains an ADD_IF_MISSING branch — seed-only, PROCEDURES semantics — so .codex/config.toml seeds into projects without one while co-abap/co-safety project-owned Codex configs are never touched), lib/upgrade-policy v1.1.0 → v1.2.0 (.mcp.json + opencode.json join JSON_MERGE_FILES so project-owned MCP servers survive; .claude/skills/graft claimed by TEMPLATE TREE SYNC before the platform-mirror rule — the skill is hand-maintained outside the SSOT skills/, the verified fleet-gap root cause; .codex/** → ADD_IF_MISSING), validate-templates v1.22.0 → v1.23.0 (C-CM-05 anti-drift: root .claude/skills/graft/SKILL.md and templates/common copy must stay byte-identical), create-l3-scaffold v1.12.5 → v1.13.0 (Step 8.5 non-fatal `bunx @nanonets/graft build` + AGENTS.md graft-block append from L1 markers), new-project v1.12.0 → v1.13.0 (§7.7 same non-fatal graft build step); previous: 2026-09-12 — Version bumps for upgrade-project v1.22.1 → v1.23.0 (new ENV_SAMPLE SYNC pass — .env.sample reclassified PRESERVE → country-aware delivery: template content passes through the shared prune lib with the project's detected country applied, so template env-key additions reach existing projects without re-injecting scaffold-pruned country blocks; region-neutral projects get the all-blocks-stripped form; conflict warning on locally-modified copies; --dry-run parity), new lib/env-sample v1.0.0 (shared .env.sample engine — `# >>> country-scoped:<CODE>` block parser behind scaffold pruning and upgrade delivery, single grammar/keep-drop decision, plus mergeEnvSample(): project-only keys, section dividers, inline notes, and commented-out documentation keys preserved under a marker section while template keys are superseded by name; idempotent — closes the co-price-class data-loss exposure found in the 2026-09-12 fleet inspection before any project ran the pass), lib/upgrade-policy v1.0.0 → v1.1.0 (.env.sample claim moved out of PRESERVE_FILES into the dedicated ENV_SAMPLE SYNC pass; @version header added so Check A validates it), and helpers/prune-country-scoped-assets v0.3.0 → v0.3.1 (behavior-preserving refactor: pruneEnvBlocks() delegated to lib/env-sample-blocks.ts; identical console output, verify-country-prune.ts 4/4); previous: 2026-09-10 — Governance scripted-fix batch (validator hardening): hooks/pre-commit v1.6.0 → v1.7.0 (T-20260910-015 — new tracked-.env commit gate: `git ls-files` scan blocks any commit while a bare `.env` stays tracked, closing the gitleaks `.gitleaks.toml` path-allowlist blind spot), hooks/pre-push v1.2.10 → v1.3.0 (T-20260910-025 — pre-push scope-down: full audit replaced with `audit.ts --lifecycle-only` and the unconditional integration suite replaced by changed-path tests (`bun test` over the test files touched by the pushed commits; no test files changed → skip; full suite remains in CI test.yml), new typecheck v1.0.0 (T-20260910-012 infrastructure only — `tsc --noEmit` regression gate against scripts/helpers/typecheck-baseline.json, wired into CI test.yml but NOT yet into the dev-sync battery pending error triage), and validate-md-language v1.9.0 → v1.10.0 (T-20260910-027 implementation half — `language: ko` accepted as a legacy alias for `lang: ko` with a WARN recommending migration so the declaration vocabulary converges); previous: 2026-09-10 — Version bumps for context purification W1/W2 (docs/designs/2026-09-10-context-purification-design.md): helpers/context-sections v1.0.0 → v1.1.0 (fence-aware section splitting, token-overlap similarity, managed-zone awareness, W1 extractProjectOnlySections() + W2 classifier; W1 threshold 0.55 / W2 REMOVE 0.65 / REVIEW floor 0.30 tuned on the real fleet — all 6 Procedures stubs classify superseded at 0.600, co-develop Computational Integrity REMOVEs at 0.667), generate-variant v1.13.2 → v1.14.0 (W1 purification seam: project-only sections from the promoted project's docs/context.md merge into docs/<variant>.context.md before its version footer; ledger in summary.contextPurification), l3-to-variant-pipeline v1.15.0 → v1.16.0 (new Phase 4.7 fail-closed context purification gate + _pipeline_report.json outcome), upgrade-project v1.19.2 → v1.20.0 (new CONTEXT_COMMONIZATION pass after VARIANT_DOCS_SYNC: overlap ≥0.65 REMOVE / ≥0.30 REVIEW / below silent; --skip-context-commonization opt-out); previous: 2026-09-10 — Version bump for propagate-to-templates v2.8.0 → v2.9.0 (--marker-rewrite stale-index fix: a file's intentional-duplicate rewrites now apply in one bottom-up splice pass through the new pure applyIntentionalDuplicateRewrites() helper in scripts/helpers/markers.ts, so an earlier rewrite that changes line counts can no longer splice later markers in the same file at stale scan-time indices; stale templates/common registry row drift-corrected 2.5.1 → 2.9.0); previous: 2026-09-06 — Version bump for audit.ts v2.29.2 → v2.30.0 (auto-activating skill-graph drift gate per ADR-0060 — when scripts/verify-skill-graph.ts exists in the audited context, audit.ts spawns it and FAILs on drift between the committed docs/skill-graph.json projection and the agents/skills/procedures SSOTs, so every project with the graph feature gets the gate enforced without per-project wiring); previous: 2026-09-06 — Version bump for upgrade-project v1.19.0 (reconcileScriptRegistry fixes found during the 2026-09-06 fleet resync: templates/common registry fallback so common-shipped scripts like the handbook/ suite get registered instead of failing verify-scripts "Unregistered script" ×26; appended rows with layer L0/L0-only rewritten to L3 so they are visible at project context; stale duplicate rows dropped on version update instead of first-match-only replace); previous: 2026-08-29 — Version bumps for generate-skill-graph v1.4.0 (ADR-0060 Amendment 3: typed relation vocabulary — `composes_with`/`follows`/`enables` on `relates_to`, legacy-vs-typed no-mixing schema validation, `inputs`/`outputs` opaque labels, edge `provenance: {file, field, index?}`, frontmatter parser swapped to `js-yaml` scoped strictly to the `---`/`---` block with a legacy-line fallback for pre-existing non-strict-YAML frontmatter outside this pass's scope), verify-skill-graph v1.2.0 (relates_to country-mark/unknown-target checks now go through the real parser + `parseRelatesTo()` instead of a line-regex scan), and new-project v1.9.0 (scaffold-time skill graph generation — new project directories get an initial `docs/skill-graph.json` tagged L3 immediately at scaffold time, non-fatal warn-and-continue); previous: 2026-08-28 — Version bumps for generate-skill-graph v1.3.0 (--scope <common|co-*> scope-local graph mode with cross-layer target materialization + run-context auto-detection tagging project-local assets L3 instead of mislabeling them L0), verify-skill-graph v1.1.0 (--scope drift/invariant verification of templates/<scope>/docs/skill-graph.json), and dev-sync v1.7.8 (step 4.65 template-scope loop — every templates/<scope> ships and keeps its own docs/skill-graph.json per ADR-0060 Amendment 2, docs/designs/2026-08-28-skill-graph-template-rollout-design.md) — during PR2: validate-templates v1.16.0 SKILL_README_ENFORCE flipped true (template-layer per-skill README gate live after 206 README pairs authored); previous: 2026-08-28 — Version bumps for upgrade-project v1.12.0 (new GOVERNANCE FILES SYNC pass — add-if-missing delivery of top-level governance files (LICENSE) that fell through every other pass; variant template sourced, then templates/common; existing project files always preserved since licenses are intentionally forkable) and reconcile-with-l0-l1 v1.3.1 (LICENSE preserve rule — identical-to-L1 LICENSE files are now kept during L3→variant promotion instead of silently discarded, so regenerated variants always ship their own license per docs/designs/2026-08-28-agpl-license-template-rollout-design.md); previous: 2026-08-28 — Version bumps for generate-variant v1.13.2 (codegraph hygiene: removed the codegraph `mcpServers` injection from generated variant `.claude/.gemini` settings.json per docs/designs/2026-08-28-codegraph-removal-design.md) and propagate-to-templates v2.5.2 (dropped `.codegraph` from ENCODING_SKIP_DIRS — dir no longer exists anywhere after the codegraph removal); previous: 2026-08-24 — Version bump for md-to-ooxml v1.2.0 (PR15: .pptx presentation writer per backlog §8 co-work row 4 — new `compileToPresentationML()` completes the Office trio by emitting the full OOXML presentation package in the same single-file form as the docx/xlsx writers (Flat OPC `pkg:package` embedding `[Content_Types].xml`, `_rels/.rels`, `ppt/presentation.xml` + rels, slideMaster1 + rels, slideLayout1 + rels, theme1, and per-slide `slideN.xml` + rels); markdown mapping: each `# ` H1 starts a slide (heading text → title placeholder), list items → bullets (indent depth → `lvl`), `##`/`###` → bold lead-ins, paragraphs/tables/code blocks → plain-text body lines; `--type pptx`, `.pptx` extension inference, `--check` parity, plus unsupported-type guard; new `tests/md-to-ooxml-pptx.test.ts`); previous: 2026-08-24 — Version bump for verify-readme-sync v1.4.0 (PR10: user-guide translated_from_hash gate promoted WARN → FAIL per ADR-0055 playbook after soak — runUserGuideHashAudit() returns the failure count and increments totalErrors; missing/stale hashes now exit 1; soak evidence: zero warnings from PR #646 seeding through #647; tests assert FAIL behavior); previous: 2026-08-24 — Version bump for verify-readme-sync v1.3.0 (PR8: user-guide translated_from_hash WARN-stage audit per ADR-0055 playbook — detects missing/stale hashes in KO guides; --update-hashes now also seeds translated_from_hash in user-guide_ko.md frontmatter; preserves CRLF/LF line endings and UTF-8-no-BOM; WARN does not affect exit code); previous: 2026-08-24 — Version bumps for validate-templates v1.13.0 (country-profile lifecycle enforcement per docs/country-profiles.md "Profile Freshness & Ownership": profile frontmatter `status` must be one of active/draft/stale — hard FAIL on anything else; auto-stale WARN when an `active` profile's `last_verified` passes the 12-month line, recommending `status: stale`; new cross-variant Check B-05 WARN when the same `<CC>.md` carries divergent `last_verified` dates across variants; renumbered the duplicate per-variant skill-lifecycle check ID B-05 → B-09), validate-md-language v1.6.1 (L0+L1: removed the hardcoded 15-locale fallback — the locale list now comes solely from docs/workspace-schema.json `i18n.locale_codes`, degrading to ko-only with a warning when the schema is absent), and create-l3-scaffold v1.12.2 (writes `.claude/template-version.txt` at scaffold time — variant/version/platform/country/created, mirroring new-project.ts §5.6 — so L3 drafts carry country provenance from day one); previous: 2026-08-24 — Version bumps for upgrade-project v1.10.1 (country-profile awareness on the upgrade path: registry-driven prune of country-scoped skills after all skill-copy passes with an isLocallyModified conflict guard for legacy forks + dry-run parity; preserves `country=` in .claude/template-version.txt instead of erasing it) and l3-to-variant-pipeline v1.12.1 (new Phase 2.5: country-scoped skill exclusion — drops country_scoped_assets.skills entries from keepInVariant and the variant.json skill manifest so a --country KR draft cannot fork k-* skills into templates/<variant>/skills/); previous: 2026-08-23 — Version bump for validate-templates v1.10.0 (new Checks WS-11: bilingual user-guide pair per variant — hard FAIL, not common-satisfiable; WS-12: variant index coverage across the 6 README index files — EN/KO FAIL, es/ja WARN); previous: 2026-08-15 — Renamed the 4 scripts whose `l2`-prefixed names/flags predated the L3 layer terminology: `create-l2-scaffold.ts`→`create-l3-scaffold.ts` (v1.9.2), `generate-l2-readme.ts`→`generate-l3-readme.ts` (v1.0.3, `--l2-path`→`--l3-path`), `l2-to-variant-pipeline.ts`→`l3-to-variant-pipeline.ts` (v1.10.5, `executeL2ToVariantPipeline()`→`executeL3ToVariantPipeline()`, `PipelineConfig.l2ProjectPath`→`l3ProjectPath`), `test-l2-promotion.ts`→`test-l3-to-variant-promotion.ts` (v1.0.2); also renamed the `simulate-l2-promotion` skill to `simulate-l3-to-variant-promotion`. Historical ADRs, dated design docs, and memory archives were left unchanged (they document what was true at the time); previous: Version bumps for generate-l2-readme (new v1.0.0: self-service Phase A README regeneration sharing the generate-variant.ts renderer), create-l2-scaffold v1.9.0 (render README.md/README_ko.md from the standard template instead of hardcoded heredocs; _ORIGIN.md checklist + printSummary now point at generate-l2-readme.ts), generate-variant v1.10.0 (export generateReadme/generateReadmeKo/buildReadmeSubstitutions; relocate extractAgentRoster/extractSkills/normalizeRelPath here from l2-to-variant-pipeline.ts), l2-to-variant-pipeline v1.10.2 (import the three relocated functions from generate-variant.ts instead of defining them locally); previous: Version bumps for validate-templates v1.5.17 (new Check WS-08: README standard conformance, policy-driven WARN via variantValidationPolicy.warningOnly), generate-variant v1.9.0 (render README.md/README_ko.md from templates/common/docs/README.template.md via applyTemplate; readmeNarrative? override; deleted Generated/MVP footer), template-utils v1.1.0 (extracted generic applyTemplate(); applyContextTemplate delegates to it), readme-lifecycle-audit v1.0.3 (ownership comment: WS-08 is sole templates/ README standard enforcer); previous: Version bumps for validate-templates v1.5.16 (new Check WS-07: variants must not carry local docs/context.md), generate-variant v1.8.1 (fix Windows path-separator so SKIP_IN_COPY actually excludes docs/context.md during promotion), new-project v1.5.3 (defense-in-depth: variant overlay skips docs/context.md); previous: Version bump for l2-to-variant-pipeline v1.10.1 (Issue Set A fixes: consolidated SKIP_AGENT_FILES, fixed missingOptionalSections JSON field, removed process.exit(1) from executeL2ToVariantPipeline, registry-driven canonicalExtensionSource for lecture type, deleted dead VariantPlugin.goldenReference()); previous: Version bumps for l2-to-variant-pipeline v1.10.0, generate-variant v1.8.0, pm-md-parser v1.1.0, create-l2-scaffold v1.8.0, reconcile-with-l0-l1 v1.2.2, golden-reference-loader v1.1.0, capability-registry v1.0.2, consulting-plugin v1.1.0, agent-verify v1.0.2 (feature + bugfix changes: scan L1-match classification, lean variant templates, ADR-0048 pm.md).*