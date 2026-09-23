# Meeting: adopt-project Conversion Plan Review

- **Date**: 2026-09-23
- **Facilitator**: PM (meeting-facilitation skill, `/meeting` flow)
- **Participants**: PM, Template Architect, Scaffolding Expert (red-team seat), Automation Engineer, Security & Git Expert, Consistency Auditor (red-team seat)
- **Rounds**: 2
- **Topic**: Review and hardening of the `scripts/adopt-project.ts` conversion design (external project → workspace-standard project, in place)
- **Outcome**: All five specialist verdicts converged on **approve-with-changes** (Scaffolding Expert held **rework** in Round 1, moved to approve-with-changes in Round 2 after the P0 resolutions). This transcript records contributions round-by-round; dissents are preserved verbatim per meeting governance invariant 3.

## Agenda and Objectives

1. Validate the proposed architecture: thin orchestrator shelling out to `upgrade-project.ts`.
2. Find parity gaps against `new-project.ts` end state (the "as if freshly scaffolded" bar).
3. Stress-test content-preservation guarantees for foreign projects.
4. Establish failure/resume semantics and rollback duties.
5. Ratify governance artifacts (design doc, spec registration, skill, registries).

## Round 1 — Domain Reviews

### Template Architect (verdict: approve-with-changes)

1. **P0 — Collision relocation placed in two phases; post-delivery is already too late.** The policy engine's SYNC pass overwrites same-named files on a clean tree (the adopt pre-flight forbids dirt, so the engine's conflict warning never fires). Relocation must be strictly pre-delivery, driven by imported `classifyPath()`/policy constants, not a parallel heuristic; the settling pass keeps only a verification assert.
2. **P0 — No failure semantics across phases; the already-converted guard turns partial failure into a dead end.** Recommended: persist `.claude/adopt-project-state.json` (reuse `lib/pipeline-state.ts`), make every post-pass step idempotent and state-gated so a re-run resumes; the guard must distinguish "delivered, post-pass incomplete" from "fully adopted"; surface `upgrade-project --rollback` on engine failure.
3. **P1 — Shelling out is the right boundary; formalize the contract as files-only.** No extraction of engine internals; forbid stdout-based control flow; add a schema/version check on `last-upgrade-delivery.json`.
4. **P1 — `scripts/_legacy/` is an unratified convention that existing quality gates will sweep.** Add it to audit/verify exclusion surfaces and an explicit `scripts/_legacy/** → PRESERVE` rule in `upgrade-policy.ts`, or relocate only genuinely colliding paths; document the `retired/` naming precedent.
5. **P1 — LOCKED ".gitattributes always overwrite" silently drops foreign attributes (LFS, custom merge drivers).** Snapshot and re-append foreign lines, or add a merge hook analogous to `mergeGitleaksToml()`.
6. **P2 — Elevate the decisions file from audit record to plan artifact** (versioned schema; post-pass consumes it; enables future `--from-plan` CI mode; plan-builder/plan-executor split inside the orchestrator; pure logic in lib for TTY-free unit tests).

### Scaffolding Expert — red-team (verdict: **rework**, superseded in Round 2)

1. **P0 — Collision preservation runs AFTER delivery, and covers only scripts/.** Verified silent-overwrite paths: scripts without `@version` (`semverGt(tpl, '')` true), agents without frontmatter version (`writeAgentWithLifecycle` has no local-modification check), skills whole-dir copy, docs tree-sync on "(content changed)". Worse: COUNTRY-SCOPED and VARIANT-SCOPE SKILL PRUNE passes **delete** foreign skills whose names appear in the registries — `detectedCountry='none'` plus no `variant.json` skill_manifest plus a clean tree voids every safety. Quote: "the COUNTRY-SCOPED and VARIANT-SCOPE SKILL PRUNE passes … **delete** any foreign skill whose name appears in `docs/workspace-schema.json` registries … `rmSync` on the user's own skill." Resolution demand: full-scope pre-delivery relocation **and** a foreign-project no-prune guard.
2. **P1 — pm.md extends-stub is delivered raw; the converted project ships a dangling, invalid PM agent** (five variants ship stubs; `upgrade-project` has zero `extends:` handling; validate-agents then fails the smoke gate).
3. **P1 — Concrete artifacts new-project produces that the plan did not**: memory/MEMORY.md seeding, docs/README.md + README_ko.md (docs/_common flatten), docs/security.md (engine gap — DOCS_OVERWRITE lacks it), `docs/<variant>.context.md` for the majority of variants (DOCS_MERGE only creates it if the variant template ships it; new-project always materializes it + Provenance footer), blankL0Refs sweep, scripts-snapshot.json. Also: marker writes `upgraded=` not `created=`; no setup.ts run.
4. **P1 — package.json merge list too narrow**: template ships a 24-entry `scripts` map, `engines`, and security-relevant `overrides`; merging only three deps breaks every documented `bun run` workflow.
5. **P1 — "Already-converted guard" keyed on template-version.txt is wrong in both directions** (marker written at engine end; externally upgraded projects may lack context files; hand-copied `.claude/` false-positives). Guard = marker AND docs/context.md AND `<variant>.context.md`, with a repair path.
6. **P2 — MERGE append to foreign files verified safe** (managed-block-merge appends, foreign prose preserved) but must be reported loudly with preserved byte counts.
7. **P2 — --variant-required is right; non-stable variant status slips through silently** (new-project confirms on `status !== 'stable'`; upgrade-project has no status check).
8. **P2 — Prompt interplay verified safe** (exactly two `prompt()` sites, both `--yes`-gated; no country prompt exists in upgrade-project), with caveats: always pass `--yes`; upgrade exits 1 on security-bootstrap failure so the smoke gate must be attributed correctly; delivery manifest is captured AFTER sync-skills, so platform-profile removal must scope to root twin files + `.codex/` only.

### Automation Engineer (verdict: approve-with-changes)

1. **P1 — Subprocess prompt surface narrow but guaranteed to fire; one abort exits 0.** The missing-marker prompt fires on every adoption and its abort is `process.exit(0)` — pair exit-0 with delivery-manifest existence; `--yes` to the subprocess is unconditional; mirror new-project's consent triad (`--yes`/`-y`/`CI=true`).
2. **P0 — Decisions JSON written pre-delivery is silently swept by `git stash push -u`.** Write it after the subprocess, and re-verify a clean tree immediately before spawning.
3. **P1 — Rollback plan invalid for the normal case**: a clean tree means the engine's stash never materializes and `--rollback` finds nothing; an orchestrator stash would hide dirt from pre-flight and never match the rollback grep. Use recorded HEAD SHA (`git reset --hard` + `git clean -fd`) plus an undo journal for adopt's own writes; never auto-invoke `--rollback`.
4. **P1 — Dry-run across the boundary: no manifest ⇒ post-pass skipped wholesale** (planned listing only); in apply mode, missing manifest ⇒ skip platform-profile removal with a warning, never pattern-matched deletion.
5. **P1 — The audit smoke will fail on unregistered foreign scripts** (`verifyScriptRegistryConsistency` hard-fails on `scripts/*.ts` without `@version`/registry row): register retained foreign scripts during settling (`@version 0.0.1` rows) or demote the smoke to report-only — "silent failure of the gate is not an option."
6. **P2 — Idempotency guards**: `.gitattributes` append must use the guarded `includes` pattern; `_legacy` re-run safety requires provenance-based foreign detection and rename-suffix handling; package.json merge as union-merge is safe; read the delivery manifest fresh per run.
7. **P2 — Test harness**: scripts suite runs sequentially with a 120s ceiling; existing harnesses avoid `bun install`/audit runs; gate install+smoke assertions behind `ADOPT_E2E_FULL=1` or `skip()`; fixture needs `git init` + initial commit; `--yes` must flow end-to-end (fixture sits outside `Projects/`).

### Security & Git Expert (verdict: approve-with-changes)

1. **P1 — Untracked secret files are swept into the pre-upgrade stash** (`stash push -u` removes untracked files from the working tree; template `.gitignore` arrives only mid-run). Pre-flight must inventory untracked files and hard-warn on secret-shaped paths; report the exact stash ref and pop instruction.
2. **P1 — Competing hook managers can silently re-disable workspace enforcement** (foreign `"prepare": "husky"` re-points `core.hooksPath` during post-fix `bun install`; extra executable files in a pre-existing `.githooks/` stay active). Detect husky/simple-git-hooks/lefthook/.pre-commit-config.yaml; neutralize (strip prepare, re-assert hooksPath AFTER bun install, quarantine unknown `.githooks/*`).
3. **P1 — No scan of the adopted project's PRE-EXISTING secrets**: audit.ts has no gitleaks invocation; pre-commit scans staged only; first full-history scan happens at first push — late. Add `gitleaks detect --no-git --redact` (working tree, including `_legacy/`) plus a history scan to the report; findings block the "adopted clean" verdict.
4. **P2 — Placeholder substitution is an unscoped whole-tree rewrite; unsafe on a foreign tree** (recurses node_modules/.git; binary round-trip risk). Scope it to the delivery manifest, hard-skip `node_modules/`, `.git/`, `.venv/`, `graft/`; byte-safe strict-UTF-8 check; log every rewritten path.
5. **P2 — Delivery manifest records raw `git status --porcelain` filenames into a committable tracked file** (metadata leak of private untracked paths). Recommended engine change: record only delivered paths.
6. **P2 — `--yes` must not bypass security refusals**; `_legacy/` scripts get `chmod -x`, stay in gitleaks scope, and are excluded from lifecycle/audit gates so archived code can never run as a live gate. The graft global→bunx fallback posture is accepted (new-project parity).

### Consistency Auditor — red-team (verdict: approve-with-changes)

1. **P0 — "upgrade-project tolerates never-scaffolded projects, therefore conversion is safe" is a category error. Tolerant ≠ preserving.** The Variant Readiness Gate validates the template, never the project; with no `scripts-snapshot.json` the script-version comparison silently no-ops; the engine's only preservation mechanism keys off git-dirt, which the adopt pre-flight forbids — "Every CONFLICT branch in every pass is structurally dead in the adopt flow." Concrete vector: foreign `scripts/audit.ts` without `@version` silently classified UPDATE and overwritten; collision surface spans root files and `.github/**` via the blanket SYNC fallback. Demand: full delivered-path-set scan, pre-declared collisions, and an E2E **content-hash manifest** proving no foreign file changes or vanishes except via recorded relocation/decision.
2. **P1 — DISSENT: "Equivalent to new-project output" is unfalsifiable as drafted.** The parity harness (`test-scaffold-delivery-parity.ts`) covers scaffold-vs-scaffold only; a preservation-asserting E2E cannot support the equivalence claim. Either extend `scaffold-markers.ts` derivations with an adopt derivation and assert tree-intersection equality minus a reviewed `ADOPT_PRESERVED` allowlist, or strike the claim from the design doc. (PM ruling: both — the machine-checked derivation was adopted AND the marketing phrasing restricted to the testable sense.)
3. **P1 — Skill artifact location is correct as planned** (`skills/<name>/` SSOT + mirrors; `project-to-variant` exists in both SSOT and mirror), **but** the plan omits propagation flags: the skill needs `scope: workspace` + `l2_propagate: false` (like `create-variant`) and a `sync-skills` run in the same PR.
4. **P1 — The post-pass re-implements upgrade-project built-ins**, reopening the drift-duplication class the policy engine removed (skill-graph/VERSION_MANIFEST regen, template-version.txt, .gitattributes LOCKED, sync-skills). Conversely placeholder substitution and inject-skills exist only in new-project — adopt must **import** those helpers, not fork them. Require an explicit "which layer owns which post-step" table (adopted into §3.3 of the design doc).
5. **P2 — `--yes` bypass is precedented; the 3-in-1 bundling is coarser than repo norms** — require the final report to enumerate every `.bak`, `_legacy` move, and decisions entry; `--yes` must refuse the workflow-adjustment phase when content-class rewrites were detected unless an explicit flag passes.
6. **P1 — Conspicuously absent: memory seeding, country config, CHANGELOG, .github coexistence.** "**DISSENT:** the smoke test as designed proves less than it appears to" — `audit.ts --skip-memory` skips exactly the memory-format check that would fail an unseeded project. Country: engine writes `country=` empty for foreign projects; adopted projects are silently region-neutral forever. Demand explicit decisions for memory seed, country prompt/default, CHANGELOG add-if-missing, and a `.github` collision rule (never overwrite foreign workflows). (docs/specs seed verified already covered — no ADR-0074 reopen.)
7. **P2 — Scope is justified** (automating Scenario B is the guide's own documented direction; no E1–E5 exemption claimed — correct), **but terminology will collide**: adopt triggers phrased "convert project" collide with project-to-variant's registered triggers; the guide's §3 rewrite must fix the colon-format marker bug (`variant: co-<name>` is unparseable by `^variant=(.*)$` — "a project converted per the guide's own manual instructions is unreadable by the engine") and carry a four-way disambiguation table (adopt / upgrade / project-to-variant / promote-variant).
8. **P2 — Pin the guard and idempotency tests to `.claude/template-version.txt`** (equals-format, `country=` line included) and assert the second run reaches upgrade-project's own auto-detect path, not merely adopt's guard.

## Round 2 — Cross-Validation of P0 Resolutions

### Template Architect (verdict: approve-with-changes)

- Backup-outside-repo relocation is **sound** — verified the engine hard-errors on failed stash, so keeping the tree porcelain-clean is the only option guaranteeing `stash push -u` never fires; commit-first pollutes a repo adopt doesn't own; in-repo temp dies by `git clean -fd`. Two constraints: **EXDEV-safe copy-then-unlink** (project may be on another volume) and the backup path recorded **absolute** in state JSON.
- Ownership table correct with one redundancy (hooksPath re-assert = belt-and-suspenders, keep) and one gap (`.env.sample` rides the engine's ENV_SAMPLE merge — not adopt's placeholder scope).
- **`lib/pipeline-state.ts` is NOT reusable as-written**: hardcoded `STATE_DIR` from `process.cwd()`, `ErrorPhase`-welded types, undo executor cannot restore `modify_file`/`update_registry` ("Cannot restore file without backup"). Re-spec as "generalize" with injectable path + snapshot-backed undo. State-file presence must win over the marker heuristic and be written before the first destructive move.
- **[HIGH] `.gitattributes` re-append is one-shot** — the next upgrade re-overwrites; merge-awareness must live in the engine's LOCKED pass (same pattern as `mergeGitleaksToml()`), with adopt's re-append as bootstrap only.
- `_legacy` gate exclusions must ship via `templates/common/` and propagate to existing Projects (delivered projects run their own gates); verified `verify-scripts.ts walkScripts()` is recursive and WILL sweep `scripts/_legacy/` while audit's checks are top-level (safe).
- Adopt carries its own outside-Projects target policy rather than laundering consent through blanket `--yes`.

### Scaffolding Expert — red-team (verdict: approve-with-changes)

- **Skill-prune guard: prevention required; pre-seed alone is insufficient.** Verified surfaces differ: the country prune honors the manifest (v1.17.1) but the variant-scope prune "has **no manifest check and no modified-check at all** — it `git rm -rf`s any name in `variant_scoped_skills` owned by another variant" (and scans only 4 of 5 skill bases — accidental luck). Post-hoc restore is disqualified: the scrub deletes reference lines first, sync-skills regenerates mirrors from the pruned root, and the prune stages a `git rm`. Cleanest: pre-seed `variant.json` `skill_manifest.variant_specific` + delete post-upgrade (parity), **plus a 3-line upgrade-project patch** making the variant-scope prune honor `projectManifestSkills` — "independently correct, justified in this PR."
- **Two remaining parity gaps**: placeholder substitution (engine validates but never substitutes — delivered files ship live `{{markers}}` without adopt running the helper) and `docs/countries/ACTIVE.md` (PROJECT_STATE — never created by the engine). Seeded `docs/README` pair also needs the §5a hash refresh or the first `/sync` fails `verify-readme-sync`.
- **Country mechanics**: no `--country` flag exists and none is needed — write ACTIVE.md (fresh tree) or rewrite the marker's `country=` line (repair path; **trap**: an existing `country=none` marker defeats ACTIVE.md).
- **Variant menu**: match new-project semantics exactly — warn + confirm on ANY `status !== 'stable'` (deprecated included), `--yes` auto-accepts; if adopt deviates (harder confirm), document it, "don't drift into it."

## Synthesized Decisions (PROPOSAL — ratified by the user via plan approval)

1. Pre-delivery relocation over the full delivered-path set, EXDEV-safe, to an outside-repo backup; tree stays clean; `_legacy/` restored post-delivery with chmod -x and gate exclusions shipped via templates/common.
2. Engine patches (PR 1): variant-scope prune honors the skill manifest; `.gitattributes` merge-aware LOCKED delivery.
3. `lib/pipeline-state.ts` generalization (injectable path, string phases, snapshot undo) powering `.claude/adopt-project-state.json` resume semantics.
4. pm.md stub helper extracted to `helpers/resolve-pm-stub.ts` (verbatim from new-project).
5. Settling pass parity additions: `<variant>.context.md` generation + Provenance, memory/MEMORY.md, docs/README pair + hash refresh, CHANGELOG seed, ACTIVE.md country carrier, blankL0Refs, scripts-snapshot, scoped placeholder substitution, full package.json merge, foreign SCRIPTS.md registration.
6. Refusal-grade (--yes-proof) pre-flight refusals: tracked secrets, hook-manager conflicts, gitleaks findings.
7. Parity is machine-checked (tree-intersection vs delivery derivation minus reviewed allowlist); the equivalence phrase restricted to that testable sense.
8. Skill `l2_propagate: false`; non-colliding trigger vocabulary; guide §3 rewritten with the colon-format fix and a four-way disambiguation table.

## Action Items

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | upgrade-project: manifest-honoring variant-scope prune + mergeGitattributes | automation-engineer | PR 1 (this PR) |
| 2 | pipeline-state generalization + resolve-pm-stub extraction + _legacy gate exclusion | automation-engineer | PR 1 (this PR) |
| 3 | adopt-project.ts + helpers/adopt-plan.ts + E2E + skill + guide §3 rewrite | automation-engineer, scaffolding-expert | PR 2 |
| 4 | Meeting transcript (this file) | pm | PR 1 (this PR) |

## Dissents Preserved (verbatim excerpts)

- Scaffolding Expert (Round 1): "the COUNTRY-SCOPED and VARIANT-SCOPE SKILL PRUNE passes **delete** any foreign skill whose name appears in `docs/workspace-schema.json` registries … `rmSync` on the user's own skill." (verdict: **rework**, resolved in Round 2)
- Consistency Auditor: "**DISSENT:** the smoke test as designed proves less than it appears to" — `--skip-memory` masks exactly the unseeded-memory failure.
- Consistency Auditor: "**DISSENT** with the plan's test section: an E2E that 'asserts preservation, merge+audit smoke, bun.lock, provenance' cannot support the marketing claim 'equivalent to scripts/new-project.ts output'. Equivalence needs a machine-checkable definition." (adopted — see decision 7)
- Security Expert: "stash push -u **removes untracked files from the working tree** — after adoption the project silently has no `.env` on disk; it exists only inside the stash (unencrypted, in the git object DB)."
