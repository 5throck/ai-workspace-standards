// @version 1.36.0
// v1.36.0 (2026-11-01, spec docs/designs/2026-11-01-hub-consolidation-design.md
//          Phase 1 batch D): PLACEHOLDER_ALLOWLIST gains the 2 co-develop
//          generic-dev-spine agent canonicals that carry derivation tokens
//          (agents/architect.md, agents/test-runner.md). Their
//          {{PROJECT_IMPLEMENTATION_AGENT}} / {{PROJECT_AUDIT_COMMAND}} tokens
//          are hub-doctrine derivation parameters (Spoke Derivation Note in
//          each file defines unfilled defaults + spoke bindings), never
//          scaffold substitutions — same contract as the batch C skill keys
//          below. Agent files get no platform mirrors at L2 (agent mirrors are
//          a workspace-root generator surface), so plain agent-level keys
//          suffice.
// v1.35.0 (2026-11-01, spec docs/designs/2026-11-01-hub-consolidation-design.md
//          Phase 1 batch C): PLACEHOLDER_ALLOWLIST gains the 5 co-security
//          assurance-suite canonical SKILL.md paths. Their {{PROJECT_*}} tokens
//          are hub-doctrine derivation parameters (Co-develop Integration Note
//          in each file defines unfilled defaults + spoke bindings), never
//          scaffold substitutions — the strict placeholder check must not flag
//          them. Skill-level keys cover the platform mirrors via the
//          mirror-prefix strip.
// v1.34.0 (2026-11-01, design addendum
//          docs/designs/2026-10-31-workspace-schema-merge-delivery-design.md
//          §Addendum, U-20261101-001): template-authoritative vocabulary blocks.
//          The 0.26.0 wave proved the shared-block project-wins rule wrong for
//          `models` and `platform_surfaces`: the MERGE pass stamps the
//          template-authoritative GPT-6.x prose into AGENTS.md §3.6 / CODEX.md
//          WORKSPACE-MANAGED blocks while SCHEMA_MERGE withheld the matching
//          `models.codex` rows from every project — the exact-equality gate
//          (validate-model-registry.ts) failed fleet-wide and each project
//          needed a manual 3-value convergence. Fix: SCHEMA_TEMPLATE_
//          AUTHORITATIVE_KEYS — those two blocks land the template value
//          VERBATIM even when present (and diverged) in the project copy; the
//          divergence is recorded as TEMPLATE_DELTA INFO rows (visibility, not
//          withholding; project-only keys inside the block are dropped and
//          logged the same way). designLint STAYS project-wins (the protected
//          token-debt class); project-only blocks stay preserved; template
//          additions still land.
// v1.33.0 (2026-10-31, design
//          docs/designs/2026-10-31-graft-trail-migration-design.md R2.4 arm (b),
//          U-20261031-009): TRAIL_RETIRED_SEEDS + isTrailRetiredSeed(rel) — the
//          graft-era seeds (.mcp.json, .claude/helpers/graft-hooks.cjs,
//          .claude/helpers/graft-statusline.cjs) that a `.trail/`-marked project
//          treats as retired. The upgrade TEMPLATE TREE SYNC pass consults the
//          predicate before every absent-copy delivery: a retired seed is
//          withheld and decision-logged SEED_SKIP (retired-surface) instead of
//          re-seeded over a trail-init-rewritten tree.
// v1.32.0 (2026-10-31, spec
//          docs/designs/2026-10-31-workspace-schema-merge-delivery-design.md):
//          merge-aware delivery for docs/workspace-schema.json (the co-price
//          0.22.1→0.25.0 / co-architect 0.23.0→0.25.0 upgrade halts). (a) The
//          `SCHEMA_MERGE` policy joins UpgradePolicy + isDeliveryPolicy,
//          claimed by exactly docs/workspace-schema.json via
//          SCHEMA_MERGE_FILE (resolveClaim, above the docs/ SYNC fall-through).
//          (b) mergeWorkspaceSchemaData(template, project) — the block-aware
//          three-way top-level merge (design §4): template-owned class
//          (absent-from-project blocks + the metadata scalars $schema/version/
//          description) lands verbatim; project-owned blocks are preserved
//          untouched; shared blocks recurse leaf-wise with project-wins on
//          existing leaves, template-only keys landing, and ARRAYS ATOMIC
//          (never unioned — the deliberate divergence from
//          mergeSettingsData's settings semantics). Pure in (template,
//          project) → idempotent (double merge is a fixed point). Returns the
//          merged object plus landed / preserved top-level key lists and
//          templateDeltas — every shared-block leaf whose final value differs
//          from the template's (a withheld template change), each with a
//          dotted path, both summarized values, and severity (WARN for
//          scalar/array divergences, INFO for structural mismatches) the
//          engine turns into TEMPLATE_DELTA decision rows. (c)
//          mergeWorkspaceSchemaJson — the file-level wrapper with the
//          mergeSettingsJson output convention (2-space indent + trailing
//          newline; key order follows the project copy, template-added keys
//          append in template order). (d) TEMPLATE_DELTA (INFO default; WARN
//          via the per-row severity override) joins DecisionVerdict +
//          DECISION_SEVERITY_CONTRACT — the decision log owns visibility of
//          template changes the merge withheld; the upgrade stays green.
// v1.31.0 (2026-10-29, spec
//          docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md,
//          DEC-20261029-01): TOMBSTONE_CLEARED (INFO) and
//          STUB_VERSION_DIVERGENCE (INFO) join DecisionVerdict +
//          DECISION_SEVERITY_CONTRACT. TOMBSTONE_CLEARED records an applied
//          --clear-tombstone grant that deleted ≥ 1 manifest entry (the
//          retraction becomes auditable in the unified decision log instead of
//          a silent manifest rewrite; schemaVersion stays 2 — additive
//          verdicts only). STUB_VERSION_DIVERGENCE surfaces the stub-frontmatter
//          backfill contract's sanctioned divergence: an existing stub
//          `version` that differs from its template counterpart (a deliberate
//          pin — INFO, never WARN; the backfill never overwrites it).
// v1.30.0 (2026-10-28, design
//          docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md
//          D1/D2): instruction-file region taxonomy + merge-time region census.
//          REGION_IN_SYNC (INFO) / EVOLVED_REGION (WARN) / TEMPLATE_AHEAD_REGION
//          (WARN) join DecisionVerdict + DECISION_SEVERITY_CONTRACT; pure
//          helpers: INSTRUCTION_FILE_RELS (the five instruction files),
//          scanInstructionRegions (I1 managed zones + skeleton-registry
//          sections / I2 VARIANT-* project-state marker sections / I3 free-form
//          template-echo spans), censusInstructionRegions (out-of-zone LCS diff
//          → per-block rows; identical files produce ZERO rows — the §6
//          dry-run-parity guarantee), spanCarriesProjectAuthoredLines (the
//          write-channel escalation predicate), instructionCensusGate (the
//          shape handed to the managed-block/skeleton merge libs). Data +
//          pure helpers only — the merge libs stay the write channels.
// v1.29.0 (2026-10-28, T-20261028-013 — spec
//          docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md
//          D9/Q5): STUB_VERSION_BUMP_ADVICE (INFO) joins DecisionVerdict +
//          DECISION_SEVERITY_CONTRACT. The upgrade-project agents/ pass emits it
//          when a stub-composed file reaches the equal-version drift arm with
//          templateChanged — stub-owned fields moved template-side without the
//          stub `version` bump that would have made the change arrive as a
//          normal version-gated ADOPT (design D9 rule). Advisory-only this wave
//          (design §10 Q5 default); the validate-templates enforcement check is
//          a follow-up if drift appears.
// v1.28.0 (2026-10-28, T-20261028-010 — spec
//          docs/designs/2026-10-28-stub-frontmatter-backfill-design.md): stub
//          frontmatter scalar backfill. Exports backfillStubFrontmatter() —
//          fills MISSING top-level scalar tier/version/last_updated keys in a
//          project extends-stub from its template counterpart (tier from the
//          counterpart's scalar, version verbatim, last_updated = the delivery
//          date), and STUB_FM_BACKFILL (INFO) joins DecisionVerdict +
//          DECISION_SEVERITY_CONTRACT. The validate-model-registry v2.1.0
//          missing-tier FAIL flip (template-v0.22.0) turned stubs whose
//          frontmatter predates the field red, and no delivery pass adds a
//          missing key: the v1.24.0 normalizer rewrites an EXISTING tier block
//          only, and the agents/ version-gated passes replace frontmatter
//          wholesale. Guards: the project content must itself be stub-shaped
//          (a column-0 `extends:` in the frontmatter — resolved agent bodies
//          are never touched, the v1.24.0 ownership contract stays intact);
//          MISSING = the column-0 key is absent (existing values are never
//          overwritten — deliberate project divergence stays; empty-value keys
//          stay out of scope; nested lifecycle-block keys are never touched);
//          filled keys append at the end of the frontmatter body; CRLF
//          preserved; idempotent; body bytes untouched (frontmatter scalars
//          only — frontmatter ownership for stubs is template-side, body stays
//          project-owned, cf. U-20261028-001).
// v1.27.0 (2026-10-28, U-20261028-001 — spec
//          docs/designs/2026-10-28-delivery-tombstone-ownership-design.md,
//          D1–D3 + D6): delivery tombstones. Additive data + one pure guard
//          predicate — NO resolver/classifier change (D6 keeps the
//          overwrite-policy boundary). (a) `TombstoneEntry` +
//          `DeliveryManifestV2.tombstones` (optional additive key,
//          schemaVersion stays 2 — the same grace pattern as the v1→v2
//          migration): `{ [rel]: { hash, templateVersion, recordedAt,
//          reason } }`, `hash` the last delivered baseline (baselineKeyFor
//          form) at recording time. (b) `TOMBSTONED` (ERROR — first
//          observation of a project-side deletion of a previously delivered
//          file; delivery refused until an explicit `--tombstone <glob>`
//          confirms the deletion intent) and `TOMBSTONED_SKIP` (INFO — the
//          recorded deletion is honored; the path stays absent) join
//          DecisionVerdict + DECISION_SEVERITY_CONTRACT. (c)
//          `tombstoneGuard(rel, prior, absent)` — the D2 fire condition
//          `absent(project, rel) && (prior.tombstones[rel] ||
//          prior.baselines[rel])` as a pure predicate; consulted by every
//          absent-copy delivery branch BEFORE the copy. The guard never
//          reads the disposition flag — per D3b `--disposition
//          adopt-template` cannot override a tombstone (taking template
//          content back onto a tombstoned path requires
//          `--clear-tombstone`). Firing only for paths a pass actually
//          walks (template-shipped candidates) makes template-side renames
//          false-positive-free — a renamed-away path is no longer a
//          candidate, so nothing fires.
// v1.26.0 (2026-10-28, T-20261028-002 — spec
//          docs/designs/2026-10-28-ticket-runner-mechanical-batch-design.md §3):
//          globToRegExp zero-segment semantics — `/**/` also matches zero
//          intermediate segments (a/**/b matches a/b) and a leading `**/`
//          matches top level (**/b matches b). The old `.*`-substitution
//          demanded literal slashes around the wildcard, so narrowed
//          --disposition adopt-template globs silently skipped exactly those
//          paths. Trailing `/**` and bare `**` semantics unchanged.
// v1.25.0 (2026-10-27, T-20261027-004 — spec
//          docs/designs/2026-10-27-sync-overwrite-policy-design.md): delivery-
//          decision observability data + pure helpers (design D1/D2/D3). New
//          exports, NO classification change (the deny-list resolver above is
//          untouched): DeliveryDecision/DeliveryManifestV2 types (manifest v2
//          schema §7 — `files` array preserved verbatim for isDeliveredDiff and
//          the PR-body compose), DECISION_SEVERITY_CONTRACT (§7 severity
//          contract: INFO mechanics / WARN divergence / ERROR needs explicit
//          disposition), sha256Hex + baselineKeyFor (D1 delivered-baseline
//          provenance keys — raw bytes for plain files, lifecycleless bytes for
//          agents/ so the re-stamp and lifecycle-block preservation never read
//          as project evolution), classifyProjectState (UNTOUCHED == baseline /
//          IN_SYNC == today's deliverable / PROJECT_EVOLVED == both differ /
//          NO_BASELINE = pre-baseline degrade), resolveDisposition (D2 matrix:
//          project-evolved + template-changed under a version-gated overwrite
//          pass escalates to CONFLICT severity ERROR, default SKIP, explicit
//          adopt-template disposition delivers; template-unchanged evolution
//          delivers as EVOLVED WARN), globToRegExp for
//          --disposition adopt-template[=glob], and
//          manifestHasUnresolvedErrors for the dev-sync step 3.9 D3.1 gate.
// v1.24.0 (2026-10-27, T-20261027-005): exports normalizeAgentTierFrontmatter()
//          — the ADR-0102 scalar-tier frontmatter normalizer for the upgrade
//          MERGE (agents/pm.md) and agents/ delivery passes. The post-soak
//          validate-model-registry flip (T-20261027-003) hard-FAILs any project
//          agent whose frontmatter still carries a legacy per-platform tier map,
//          and neither pass touched frontmatter before (MERGE unions managed
//          blocks only; the agents/ pass dead-ended on variant extends-stubs).
//          Pure function: replaces ONLY the legacy tier block with the
//          template's scalar value when the template side is already scalar
//          (template authoritative for the managed key); a project scalar that
//          differs from the template scalar is deliberate divergence — returned
//          as conflict:true, untouched. Idempotent; CRLF-preserving.
// v1.23.0 (2026-10-27, U-20261027-002 + U-20261026-009): two fixes.
//          (U-20261027-002) `scripts-snapshot.json` and
//          `.claude/last-upgrade-pr-body.md` join PIPELINE_ARTIFACT_PATHS —
//          both are regenerated by upgrade-project AFTER the delivery manifest
//          is written (post-upgrade snapshot regen / PR-body compose), so they
//          can never appear in manifest.files; when their content changed, the
//          changed-file list failed isDeliveredDiff() and dev-sync step 3.9
//          hard-blocked a purely template-delivered diff (observed on the
//          2026-10-27 fleet upgrade wave). (U-20261026-009) lifecyclelessText()
//          also strips top-level `last_updated:` lines: the upgrade engine now
//          re-stamps delivered agents' frontmatter date (upgrade-versions.ts
//          bumpFrontmatterLastUpdated), so the agents/ SYNC_IF_NEWER drift
//          compare must ignore bump-only date differences or every re-stamped
//          file would re-report DRIFT (restored to canonical) on the next
//          upgrade — the same tolerance agent-lifecycle-audit's
//          isMetadataOnlyChange already implements.
// v1.22.0 (2026-10-07, U-20261006-001): `scripts-snapshot.json` moves from
//          PROJECT_STATE_FILES to REGENERATED_FILES. The snapshot is generated
//          state — written at scaffold/adopt (new-project §5.5c, adopt-project
//          §15, helpers/write-scripts-snapshot.ts) and now regenerated
//          post-upgrade (upgrade-project) — never template-delivered, and
//          never a frozen-at-scaffold artifact: PROJECT_STATE preserved it
//          forever, so the Script version comparison re-reported the same
//          scaffold-era drift on every upgrade.
// v1.21.0 (2026-10-01, ADR-0076 amendment): the `.claude/skills/graft/**` → TEMPLATE TREE
//          SYNC special case is removed. graft moved into the skills/ SSOT, so it is delivered
//          by the platform-mirror rule (sync-skills.ts) to all five platform dirs like any skill.
// v1.20.0 (2026-10-01, T-20260930-026 PR-A, ADR-0094): `.github/workflows/ci.yml` joins
//          MERGE_MANAGED_FILES (was the final SYNC whole-file overwrite, which erased any
//          project job — co-newbiz lost its unit-test job twice). The MERGE pass routes it
//          to lib/ci-workflow-merge.ts: template-owned jobs stay authoritative, only the
//          validated PROJECT-JOBS region is project-owned; fail-closed, atomic write.
// v1.19.0 (2026-09-30, T-20260927-010): `region-profiles/**` claims ADD_IF_MISSING on
//          the new dedicated REGION PROFILES pass — the ADR-0091 structured regulatory
//          layer is delivered once and never overwritten (project deltas are
//          intentional; prevents the procedures/** clobber class on co-price KR.yaml).
// v1.18.0 (2026-09-27, ADR-0093 — spec
//          docs/designs/2026-09-27-hermes-md-instruction-file-design.md):
//          HERMES.md joins MERGE_MANAGED_FILES — the Hermes member of the
//          CLAUDE/GEMINI/CODEX instruction-file family (a Hermes-specific
//          behavioral file, not an AGENTS.md copy). Same rationale as
//          CODEX.md's v1.13.0 join: resolveClaim('HERMES.md') must hit the
//          MERGE pass so TEMPLATE TREE SYNC never wholesale-overwrites a
//          project's copy; the MERGE push delivers it for hermes/all.
// v1.17.0 (2026-09-25, ADR-0088 W2): `.hermes` joins the platform set —
//          `.hermes/skills` claims SYNC via sync-skills.ts (platform mirror)
//          above every blanket rule (the graft fleet-gap ordering invariant),
//          `.hermes` joins the blanket SYNC claim (no project-owned config
//          exists today; reclassify if one appears) and KNOWN_TOP_DIRS.
// v1.16.0 (2026-09-25, registry & platform-policy completeness batch — spec
//          docs/designs/2026-09-25-registry-policy-completeness-design.md
//          R4): `.agents/mcp.json` joins JSON_MERGE_FILES (design D6) — same
//          genus as root `.mcp.json` (ADR-0076 v1.2.0 precedent): pure JSON
//          carrying MCP server registrations a project may customize; the
//          blanket `.agents` SYNC claim would destroy project-only servers on
//          every upgrade. Fleet copies are byte-identical to the template seed
//          today, so the rollout is a no-op for existing projects and
//          protective for future ones. `.codex/config.toml` deliberately stays
//          ADD_IF_MISSING with the rationale documented at the claim site
//          (design D7).
// v1.15.0 (2026-09-25, T-20260924-003 — spec
//         docs/designs/2026-09-25-inventory-decisions-batch-design.md R2.4):
//         exports isExtendsStub(content) — the ADR-0033 extends-stub shape
//         test the upgrade agents/ SYNC pass now uses to skip template stub
//         files (they resolve at scaffold/adopt time; delivering the 8-line
//         stub over a project's resolved body was the v1.35.0 drift-
//         reconciliation clobber proven on Projects/co-work agents/pm.md).
// v1.14.0 (2026-09-25, T-20260924-011 — spec
//         docs/designs/2026-09-25-codex-merge-claim-routing-design.md D2/D3/R3):
//         exports VARIANT_ASSET_DIRS_PASS (the pass id already returned for every
//         top-level dir outside KNOWN_TOP_DIRS) alongside TEMPLATE_TREE_SYNC_PASS,
//         and resolveClaim uses it at the fallback branch — upgrade-project's
//         VARIANT ASSET DIRS pass now filters every walked file by claim-pass
//         identity, ending the procedures/** inversion (the asset pass's
//         hash-sync overwrite contradicted the PROCEDURES pass's per-entry
//         add-if-missing ownership; the dedicated pass is the sole delivery
//         channel for procedure entries). No classification changed — only the
//         pass-id constant is new.
// v1.13.0 (2026-09-24, platform-parity P1 bug 4 — spec
//         docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md D4):
//         CODEX.md joins MERGE_MANAGED_FILES — resolveClaim returns
//         { policy: 'MERGE_MANAGED', pass: 'MERGE' }, so the TEMPLATE TREE SYNC
//         pass can no longer wholesale-overwrite a divergent project CODEX.md
//         (the destructive overwrite path is dead; the MERGE pass owns delivery).
// v1.12.0 (2026-09-24, scaffold identity overview — spec
//         2026-09-24-scaffold-identity-overview-design): docs/project.md claims
//         ADD_IF_MISSING on the TEMPLATE TREE SYNC pass (project-owned identity
//         seed — upgrade copies it only when absent, never overwrites); without
//         the explicit claim the deny-list fallback (SYNC) would wholesale-copy
//         the template seed over user content on every upgrade (the co-abap
//         docs/context.md regression class). docs/project.template.md joins
//         TEMPLATE_ONLY (scaffold-removed): new-project renders it into
//         docs/project.md and deletes the raw copy, so an upgrade must never
//         resurrect it. This claim MUST land in the same change set as the
//         docs/context.md 2.13 footer bump — the bump is what makes every
//         project's next upgrade walk the TEMPLATE TREE SYNC pass.
// v1.10.0 (2026-09-21, rollout hardening): isDeliveredDiff() — a changed-file list
//         is fully explained by a recorded upgrade delivery (delivered files ∪
//         pipeline artifacts) so dev-sync step 3.9 can auto-apply E5 (sync-only)
//         instead of blocking routine fleet resyncs.
// v1.8.0 (2026-09-17, T-20260917-009): SCAFFOLD_COMMON_OWNED_FILES exported —
//         new-project's variant-overlay skip and validate-templates WS-07 both
//         derive from this one classification instead of parallel hand lists.
// v1.7.0 (2026-09-17, T-20260917-001): MERGE_MANAGED_FILES exported so the
//         validate-templates managed-block-parity arm (PM-04) enforces
//         common→variant parity over the same file set upgrade MERGE unions.
// v1.6.0 (2026-09-16, T-20260916-010): docs/VERSION_MANIFEST.md joins
//         REGENERATED_FILES. Variant templates stopped shipping the stub
//         manifest (validate-templates `variant-version-manifest` arm retires
//         the stub class); the project manifest is generated state — produced
//         post-delivery by new-project.ts §7.8 and regenerated post-upgrade by
//         upgrade-project.ts. Without this reclassification the deny-list
//         default (TEMPLATE TREE SYNC / SYNC) would deliver any future
//         template copy over a project's generated manifest.
// v1.5.0 (2026-09-12, T-20260912-021): PLACEHOLDER_ALLOWLIST gains
//         skills/explain-me/templates/report.html and skills/explain-me/references/BUILD_GUIDE.md
//         — the skill's own report template + authoring guide substitute their {{tokens}} at
//         project RUNTIME (not scaffold time), so they ship verbatim by design. Context: the
//         files reached templates/common when the explain-me L0↔L1 mirror drift was fixed
//         (only SKILL.md propagated before, leaving a broken half-skill in projects).
// v1.2.0: graft fleet surface (ADR-0076): .mcp.json + opencode.json join JSON_MERGE_FILES
//         (project-owned MCP servers survive the union); .claude/skills/graft/** claims
//         TEMPLATE TREE SYNC before the platform-mirror rule (the skill is hand-maintained
//         outside the SSOT skills/, so sync-skills.ts can never deliver it — the verified
//         fleet-gap root cause); .codex/** is ADD_IF_MISSING (co-abap/co-safety own their
//         config.toml; the graft section is seeded only into projects lacking the file).
// v1.1.0: .env.sample reclassified PRESERVE → SYNC/ENV_SAMPLE SYNC (upgrade-project v1.23.0):
//         the upgrade path now re-delivers template env-key changes with scaffold-parity
//         country pruning applied (shared scripts/lib/env-sample-blocks.ts), so template
//         .env.sample additions reach existing projects without re-injecting pruned
//         country blocks.
// upgrade-policy.ts — Upgrade classification SSOT (2026-09-11-upgrade-policy-coverage-design.md)
// Classifies EVERY project-relative path a template can deliver. The fallback claim is
// TEMPLATE TREE SYNC (deliver by default): coverage is deny-list, not an enumeration, so a
// template file added without any governance decision still reaches existing projects.
//
// Consumers:
//   - scripts/upgrade-project.ts — the TEMPLATE TREE SYNC pass delivers every file whose
//     claim.pass === TEMPLATE_TREE_SYNC_PASS (legacy passes keep owning their classified paths).
//   - scripts/check-upgrade-coverage.ts — reports the classification matrix over the whole
//     effective template tree and gates on the strict checks (placeholders, WS-07, JSON health).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/** Delivery policies. `SYNC` is the default fallback (deliver with conflict warning). */
export type UpgradePolicy =
  | 'LOCKED'
  | 'MERGE_MANAGED'
  | 'OVERWRITE'
  | 'VERSIONED_SYNC'
  | 'HASH_SYNC'
  | 'ADD_IF_MISSING'
  | 'REGENERATED'
  | 'PRESERVE'
  | 'PROJECT_STATE'
  | 'TEMPLATE_ONLY'
  | 'JSON_MERGE'
  | 'SCHEMA_MERGE'
  | 'WORKSPACE'
  | 'SYNC';

export interface UpgradeClaim {
  policy: UpgradePolicy;
  /** Which upgrade-project.ts pass owns (or, for TEMPLATE_TREE_SYNC_PASS, should deliver) this path. */
  pass: string;
}

/** Pass id of the default-policy delivery pass in scripts/upgrade-project.ts. */
export const TEMPLATE_TREE_SYNC_PASS = 'TEMPLATE TREE SYNC';

/** Pass id of the generic VARIANT ASSET DIRS delivery pass in scripts/upgrade-project.ts
 *  (every top-level template dir outside KNOWN_TOP_DIRS — co-safety's workflows/,
 *  co-design's decisions/, …). Exported so the pass's per-file claim filter compares
 *  identities, not a second hard-coded literal — the same drift class
 *  TEMPLATE_TREE_SYNC_PASS exists to prevent (T-20260924-011, design D2/D3). */
export const VARIANT_ASSET_DIRS_PASS = 'VARIANT ASSET DIRS';

/** Pass id of the dedicated REGION PROFILES delivery pass (T-20260927-010): add-if-missing
 *  per file for `region-profiles/**` — the ADR-0091 structured regulatory layer. Project
 *  deltas (Tooling & Skill Mapping, maintainer fields — ADR-0091 R2) are intentional, so a
 *  template update must never overwrite a delivered file (the procedures/** clobber class,
 *  T-20260924-011). Without the claim the resolveClaim fallthrough assigned these paths
 *  plain SYNC on the VARIANT ASSET DIRS pass. */
export const REGION_PROFILES_PASS = 'REGION PROFILES';

// ── Legacy pass inventories (mirrored from scripts/upgrade-project.ts; drift-guarded by tests) ──

/** GOVERNANCE FILES SYNC list (upgrade-project.ts). SECURITY.md added per design D5. */
export const GOVERNANCE_FILES = ['LICENSE', 'SECURITY.md'] as const;

/** docs/ subdirectories that are PROJECT WORKSPACES: template seeds are add-if-missing only;
 *  project artifacts there are never overwritten and never pruned. `specs` (ADR-0074): the
 *  registry seed is what activates the Universal Design Gate in a project — it MUST ride the
 *  TEMPLATE TREE SYNC pass (a named pass with no delivery code is silently never delivered:
 *  the 2026-09-12 DESIGN GATE SEED incident). */
export const WORKSPACE_DOC_DIRS = [
  'designs', 'drafts', 'reports', 'research', 'findings', 'threat-models', 'lifecycle', 'specs',
] as const;

/** Platform settings files merged (not overwritten) by the TEMPLATE TREE SYNC pass.
 *  graft (ADR-0076): .mcp.json and opencode.json carry MCP server registrations — projects
 *  may hold project-only servers (co-newbiz, co-safety, co-abap), so they deep-merge like
 *  the platform settings instead of syncing. `.agents/mcp.json` joined in v1.16.0 (registry
 *  completeness R4.1, design D6): same genus as root `.mcp.json` — pure JSON of the same
 *  shape carrying MCP server registrations. The blanket `.agents` SYNC claim below would
 *  have destroyed project-only servers on every upgrade; fleet copies are byte-identical
 *  to the templates/common seed today, so the merge is a no-op rollout (ADR-0076 v1.2.0
 *  precedent). */
export const JSON_MERGE_FILES = [
  '.claude/settings.json', '.gemini/settings.json', '.mcp.json', 'opencode.json',
  '.agents/mcp.json',
] as const;

/** Graft-era seeds retired by the trail migration (design
 *  docs/designs/2026-10-31-graft-trail-migration-design.md R2.4 arm (b),
 *  U-20261031-009). When the project carries `.trail/` — the trail-migration
 *  marker that `trail init` creates — these template seeds are treated as
 *  RETIRED: `trail init` rewrote the same surfaces (MCP entries swapped,
 *  helpers replaced by `.trail/hook.cjs`) and deliberately deleted the project
 *  copies, so an absent-copy re-seed would resurrect pre-migration state. The
 *  upgrade TEMPLATE TREE SYNC pass withholds them and decision-logs
 *  `SEED_SKIP` (retired-surface) instead. Kept as a data export so the guard is
 *  unit-pinnable; the list never shrinks silently (design R2.6: graft-era
 *  tolerance stays while any project is pre-migration). */
export const TRAIL_RETIRED_SEEDS = [
  '.mcp.json',
  '.claude/helpers/graft-hooks.cjs',
  '.claude/helpers/graft-statusline.cjs',
] as const;

/** True when `rel` is a graft-era seed retired by the trail migration. */
export function isTrailRetiredSeed(rel: string): boolean {
  return (TRAIL_RETIRED_SEEDS as readonly string[]).includes(rel.replace(/\\/g, '/'));
}

/** The one file the SCHEMA_MERGE delivery policy claims (spec
 *  2026-10-31-workspace-schema-merge-delivery-design §3): docs/workspace-schema.json —
 *  the fleet SSOT for platform/model registries, route-audit tripwires, and design-lint
 *  gate config, read directly by six consumer scripts (an override-only route cannot
 *  serve them). Generic SYNC whole-content delivery clobbered project-evolved gate
 *  config (co-price's 131-entry designLint allowlist + tokenSources) and the
 *  conflict-skip path blocked the 0.25.0 upgrades entirely; SCHEMA_MERGE delivers
 *  template-added blocks (platform_surfaces, routeAudit) while the merge preserves
 *  project-owned content (design §4). */
export const SCHEMA_MERGE_FILE = 'docs/workspace-schema.json';

/** Files whose scaffold-delivered copy was intentionally left unsubstituted — `{{tokens}}` are
 *  expected content, so the coverage validator's placeholder check must not flag them. */
export const PLACEHOLDER_ALLOWLIST = new Set([
  'docs/README.template.md',
  'docs/README_ko.template.md',
  // explain-me ships its own report TEMPLATE + authoring guide; the {{tokens}} are
  // substituted by the skill itself at project runtime (report generation), never by
  // scaffolding — exactly the "ships verbatim unrendered by design" contract above.
  // (T-20260912-021: the files reached templates/common when the skill's L0↔L1
  // mirror drift was fixed; before that only SKILL.md propagated and projects got a
  // broken half-skill.)
  'skills/explain-me/templates/report.html',
  'skills/explain-me/references/BUILD_GUIDE.md',
  // co-security assurance-suite canonicals (hub doctrine, spec
  // 2026-11-01-hub-consolidation-design Phase 1 batch C): the {{PROJECT_*}}
  // tokens are hub-doctrine derivation parameters substituted when a spoke
  // variant adopts the doctrine (each SKILL.md's "Co-develop Integration Note"
  // defines the unfilled defaults and bindings) — never by scaffolding. Same
  // "ships verbatim unrendered by design" contract as explain-me above; the
  // mirror-prefix strip in check-upgrade-coverage.ts covers the platform
  // mirrors via these skill-level keys.
  'skills/samm-maturity/SKILL.md',
  'skills/sarif-exporter/SKILL.md',
  'skills/spdx-sbom/SKILL.md',
  'skills/stride-threat-matrix/SKILL.md',
  'skills/finding-reconciliation/SKILL.md',
  // co-develop generic-dev-spine agent canonicals (hub doctrine, spec
  // 2026-11-01-hub-consolidation-design Phase 1 batch D): derivation tokens
  // per the batch C contract above; agent files carry no L2 platform mirrors.
  'agents/architect.md',
  'agents/test-runner.md',
]);

// ── Scaffold-parity facts (mirrored from scripts/new-project.ts) ─────────────────────────────

/** Staging zones the scaffold DELETES after copying (mirrored from scripts/new-project.ts
 *  L1_ONLY_DIRS + the template-only docs removal loop) — template-side only; upgrading them
 *  into a project would resurrect files the scaffold deliberately removed. docs/specs left
 *  this list in ADR-0074 Amendment 2: its registry seed activates the Universal Design Gate
 *  in projects and rides the WORKSPACE seed semantics above. */
const TEMPLATE_ONLY_DIRS = [
  'docs/_common', 'docs/_templates', 'docs/_examples', 'docs/variants', 'docs/adr',
];

const TEMPLATE_ONLY_FILES = new Set([
  'docs/variant.context.template.md',
  'docs/project.template.md', // rendered into docs/project.md at scaffold time, then removed (spec 2026-09-24-scaffold-identity-overview-design)
  'agents/lifecycle-manager.md',
  'agents/_COMMON.md',
  'agents/pm.md.backup',
  'scripts/propagation-map.json',
]);

/** Project-owned identity seed (spec 2026-09-24-scaffold-identity-overview-design,
 *  §13.2 guard retention): DEFENSIVE NO-OP as a claim — the TEMPLATE TREE SYNC
 *  walk enumerates template-side files only, so this claim never fires (the seed
 *  is delivered by upgrade-project's dedicated IDENTITY SEED step). It stays as
 *  the guard: if a future change ever put docs/project.md template-side, the
 *  deny-list fallback (SYNC) would wholesale-copy over user content, and this
 *  claim still blocks that (the co-abap docs/context.md regression class). */
const ADD_IF_MISSING_FILES = new Set(['docs/project.md']);

/** Project runtime / generated state — exists in projects but is never template-delivered. */
const PROJECT_STATE_FILES = new Set([
  'package.json', 'bun.lock', 'bun.lockb', 'package-lock.json',
  'variant.json',
]);

/** Project files the scaffold/upgrade flows REGENERATE in place
 *  (T-20260916-010: docs/VERSION_MANIFEST.md joined — templates stopped
 *  shipping the stub manifest; the full manifest is generated post-delivery
 *  (new-project §7.8) and regenerated post-upgrade (upgrade-project),
 *  never template-delivered).
 *  (U-20261006-001: scripts-snapshot.json joined — same genus: generated
 *  post-delivery (new-project §5.5c, adopt-project §15 via
 *  helpers/write-scripts-snapshot.ts) and now regenerated post-upgrade
 *  (upgrade-project), never template-delivered; PROJECT_STATE preservation
 *  froze it at scaffold/adopt, so the Script version comparison re-reported
 *  the same stale snapshot drift on every upgrade.) */
const REGENERATED_FILES = new Set([
  'docs/skill-graph.json', '.claude/template-version.txt',
  'docs/VERSION_MANIFEST.md',
  'scripts-snapshot.json',
]);

const PRESERVE_FILES = new Set([
  'README.md', 'README_ko.md', 'CHANGELOG.md', 'docs/README.md', 'docs/README_ko.md',
]);

const LOCKED_FILES = new Set(['.gitattributes', '.gitleaks.toml']);

/**
 * Files whose WORKSPACE-MANAGED blocks upgrade MERGE unions into projects. Exported
 * so the validate-templates managed-block-parity arm (PM-04) enforces common→variant
 * parity over exactly this set — one SSOT for "which files carry managed blocks"
 * (T-20260917-001).
 *
 * CODEX.md joined in v1.13.0 (platform-parity P1 bug 4 — spec
 * docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md D4): without it
 * resolveClaim('CODEX.md') fell through to the blanket root-file SYNC claim and
 * the TEMPLATE TREE SYNC pass wholesale-overwrote every project CODEX.md edit on
 * upgrade (CODEX.md carries no inline version footer, so the hash branch always
 * fired). MERGE membership makes the MERGE pass — which already lists CODEX.md —
 * the sole delivery channel. (History note, corrected 2026-10-25 per spec
 * 2026-10-25-managed-platform-skeleton-design.md: an earlier revision of this
 * comment said "the merge is a no-op today" — stale since
 * lib/managed-block-merge v1.2.0/v1.3.0 added COMMON-CODEX and COMMON-HERMES
 * to MANAGED_PATTERNS, so the CODEX/HERMES zone merges are ACTIVE. No claim
 * change was needed, as predicted.)
 */
export const MERGE_MANAGED_FILES = new Set(['CLAUDE.md', 'GEMINI.md', 'CODEX.md', 'HERMES.md', '.gitignore', 'AGENTS.md', 'agents/pm.md', '.github/workflows/ci.yml']);

/** Common-owned scaffold files: delivered by templates/common/ and sacred to the
 *  project — a variant template must never carry them (WS-07) and new-project's
 *  variant overlay must skip them (defense-in-depth against a variant copy
 *  clobbering the canonical common file just laid down). One SSOT for both
 *  consumers; extend here, never with a local hand list. (T-20260917-009,
 *  design docs/designs/2026-09-17-governance-backlog-batch-design.md) */
export const SCAFFOLD_COMMON_OWNED_FILES = new Set(['docs/context.md']);

const OVERWRITE_FILES = new Set(['docs/phase-definitions.md', 'docs/security.md']);

const TRAVERSAL_SKIP_DIRS = new Set(['node_modules', '.git', '.gateguard-state']);

/** Top-level dirs claimed by dedicated upgrade passes / platform machinery (everything else at
 *  top level belongs to the generic VARIANT ASSET DIRS pass). */
const KNOWN_TOP_DIRS = new Set([
  'agents', 'skills', 'scripts', 'docs', 'procedures',
  '.claude', '.gemini', '.agents', '.codex', '.hermes', '.githooks', '.github', '.git', 'memory', 'node_modules',
]);

function underDir(rel: string, dir: string): boolean {
  return rel === dir || rel.startsWith(`${dir}/`);
}

/**
 * Resolve the upgrade claim for a project-relative path (forward slashes, no leading './').
 * `variant` enables the `docs/<variant>.context.md` DOCS_MERGE classification.
 * Never returns null — the fallback is the default-policy delivery claim by design.
 */
export function resolveClaim(relPath: string, variant = ''): UpgradeClaim {
  const rel = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!rel || rel === '.') return { policy: 'PROJECT_STATE', pass: '(none)' };

  // Platform-machinery artifacts the scaffold strips or generates
  if (rel.endsWith('.cmd')) return { policy: 'TEMPLATE_ONLY', pass: '(platform profile)' };

  if (PROJECT_STATE_FILES.has(rel)) return { policy: 'PROJECT_STATE', pass: '(project state)' };
  if (underDir(rel, 'memory')) return { policy: 'PROJECT_STATE', pass: '(project memory)' };
  if (rel === 'docs/countries/ACTIVE.md') return { policy: 'PROJECT_STATE', pass: '(country runtime state)' };

  // Universal Design Gate seed (ADR-0074): docs/specs/* claims fall through to the
  // WORKSPACE branch below (add-if-missing seed, never overwrite/prune project entries).

  if (TEMPLATE_ONLY_FILES.has(rel)) return { policy: 'TEMPLATE_ONLY', pass: '(scaffold-removed)' };
  for (const dir of TEMPLATE_ONLY_DIRS) {
    if (underDir(rel, dir)) return { policy: 'TEMPLATE_ONLY', pass: '(scaffold-removed)' };
  }

  if (REGENERATED_FILES.has(rel)) return { policy: 'REGENERATED', pass: '(regenerated in place)' };
  // .env.sample delivery is country-aware (ENV_SAMPLE SYNC pass): scaffold-time pruning
  // (prune-country-scoped-assets.ts, shared lib/env-sample.ts) strips country-scoped env
  // blocks from the project copy, so upgrades must re-deliver with the same pruning
  // applied — never a wholesale copy (that would re-inject pruned country profiles). The
  // pass MERGES (lib/env-sample.ts): template keys updated, project-only keys preserved.
  if (rel === '.env.sample') return { policy: 'SYNC', pass: 'ENV_SAMPLE SYNC' };
  if (PRESERVE_FILES.has(rel)) return { policy: 'PRESERVE', pass: '(project-owned)' };
  if ((GOVERNANCE_FILES as readonly string[]).includes(rel)) {
    return { policy: 'ADD_IF_MISSING', pass: 'GOVERNANCE FILES' };
  }
  // Project-owned identity seed — claim must sit ABOVE the docs/ fallback SYNC
  // branch below (spec 2026-09-24-scaffold-identity-overview-design, R6/D2).
  if (ADD_IF_MISSING_FILES.has(rel)) {
    return { policy: 'ADD_IF_MISSING', pass: TEMPLATE_TREE_SYNC_PASS };
  }

  if (LOCKED_FILES.has(rel) || underDir(rel, '.githooks')) return { policy: 'LOCKED', pass: 'LOCKED' };
  if (MERGE_MANAGED_FILES.has(rel)) return { policy: 'MERGE_MANAGED', pass: 'MERGE' };
  if (variant && rel === `docs/${variant}.context.md`) {
    return { policy: 'MERGE_MANAGED', pass: 'DOCS_MERGE' };
  }
  if (OVERWRITE_FILES.has(rel)) return { policy: 'OVERWRITE', pass: 'DOCS_OVERWRITE' };
  // The former VARIANT_DOCS_SYNC pass (docs/context.md and friends) was folded into the
  // TEMPLATE TREE SYNC pass in v1.22.0 — these files carry inline `*<file> version: X.Y`
  // footers (or hash fallback) and the default SYNC policy reproduces the old semantics
  // exactly, so no explicit claim is needed (deny-list inversion).

  if (underDir(rel, '.claude/commands') || underDir(rel, '.gemini/commands')) {
    return { policy: 'HASH_SYNC', pass: 'COMMANDS_SYNC' };
  }
  if ((JSON_MERGE_FILES as readonly string[]).includes(rel)) {
    return { policy: 'JSON_MERGE', pass: TEMPLATE_TREE_SYNC_PASS };
  }
  // docs/workspace-schema.json (spec 2026-10-31-workspace-schema-merge-delivery-design):
  // the fleet SSOT for platform/model registries, route-audit tripwires, and design-lint
  // gate config. Whole-content SYNC clobbered project-evolved blocks (co-price's 131-entry
  // designLint allowlist + tokenSources, co-architect's 122-entry allowlist) and the
  // conflict-skip blocked the 0.25.0 upgrades entirely; SCHEMA_MERGE delivers template
  // additions (platform_surfaces, routeAudit) while the merge preserves project-owned
  // content. Claim must sit ABOVE the docs/ SYNC fall-through below.
  if (rel === SCHEMA_MERGE_FILE) {
    return { policy: 'SCHEMA_MERGE', pass: TEMPLATE_TREE_SYNC_PASS };
  }

  if (underDir(rel, 'procedures')) return { policy: 'ADD_IF_MISSING', pass: 'PROCEDURES' };

  // region-profiles/** (T-20260927-010): the ADR-0091 structured regulatory layer is
  // delivered once (scaffold or first upgrade carrying it) and is never overwritten —
  // project deltas are intentional (ADR-0091 R2). Dedicated REGION PROFILES pass.
  if (underDir(rel, 'region-profiles')) return { policy: 'ADD_IF_MISSING', pass: REGION_PROFILES_PASS };

  // Platform skill mirrors are distributed by the post-upgrade sync-skills.ts run, not file
  // passes. Codex mirrors (ADR-0077 W1/W4) joined them in the 2026-09-21 review (C-1); the
  // Hermes mirror (ADR-0088 W2) joins the same group. This group MUST stay ABOVE the blanket
  // `.codex/**` rule below, or the blanket ADD_IF_MISSING swallows the mirrors and fleet projects
  // never receive skill/prompt updates (graft fleet-gap class).
  if (underDir(rel, '.claude/skills') || underDir(rel, '.gemini/skills') || underDir(rel, '.agents/skills')
    || underDir(rel, '.codex/skills') || underDir(rel, '.codex/prompts') || underDir(rel, '.hermes/skills')) {
    return { policy: 'SYNC', pass: 'sync-skills.ts (platform mirror)' };
  }
  // Codex project config is per-project by nature (project MCP servers + codex hooks, e.g.
  // co-abap/co-safety): seed add-if-missing only, never overwrite an existing file (ADR-0076 D4).
  //
  // Rationale for keeping ADD_IF_MISSING (registry completeness R4.2, design D7, v1.16.0):
  // `.codex/config.toml` project copies are genuinely customized (co-abap carries
  // `[features] codex_hooks = true` plus additions; co-consult has diverged ADR references
  // and content), no TOML parser exists in package.json, and a comment-preserving semantic
  // TOML merge is new delivery machinery that is deliberately out of scope. Accepted
  // trade-off: template-side config.toml changes intentionally reach only NEW projects —
  // existing projects drift by design; a drift DETECTOR is a candidate follow-up.
  if (underDir(rel, '.codex')) return { policy: 'ADD_IF_MISSING', pass: TEMPLATE_TREE_SYNC_PASS };

  // Registration pointers + platform settings extras: default sync (static today, format may evolve).
  // `.hermes` (ADR-0088) is skills-mirror-only today — the mirror claim above owns `.hermes/skills`;
  // anything else under `.hermes` (none exists yet) defaults to SYNC like the other registration dirs.
  if (underDir(rel, '.claude') || underDir(rel, '.gemini') || underDir(rel, '.agents') || underDir(rel, '.hermes')) {
    return { policy: 'SYNC', pass: TEMPLATE_TREE_SYNC_PASS };
  }

  if (underDir(rel, 'agents')) return { policy: 'SYNC', pass: 'SYNC_IF_NEWER: agents/' };
  if (underDir(rel, 'skills')) return { policy: 'SYNC', pass: 'SYNC_IF_NEWER: skills/' };
  if (underDir(rel, 'scripts')) return { policy: 'SYNC', pass: 'SYNC_IF_NEWER: scripts/' };

  if (underDir(rel, 'docs')) {
    const second = rel.split('/')[1] ?? '';
    if ((WORKSPACE_DOC_DIRS as readonly string[]).includes(second)) {
      return { policy: 'WORKSPACE', pass: TEMPLATE_TREE_SYNC_PASS };
    }
    return { policy: 'SYNC', pass: TEMPLATE_TREE_SYNC_PASS };
  }

  // Any other top-level directory (e.g. co-safety's workflows/, regulations/) is the
  // generic VARIANT ASSET DIRS pass's territory. A path deeper than one segment can only
  // get here from such a directory (all known tops are claimed above).
  const top = rel.split('/')[0];
  if (!KNOWN_TOP_DIRS.has(top) && rel.includes('/')) {
    return { policy: 'SYNC', pass: VARIANT_ASSET_DIRS_PASS };
  }

  // Root-level files with no dedicated pass (.editorconfig, …): the inversion —
  // deliver by default instead of silently dropping.
  return { policy: 'SYNC', pass: TEMPLATE_TREE_SYNC_PASS };
}

/** True when a claim's policy delivers file content into the project (validator placeholder check scope). */
export function isDeliveryPolicy(policy: UpgradePolicy): boolean {
  return ['LOCKED', 'MERGE_MANAGED', 'OVERWRITE', 'VERSIONED_SYNC', 'HASH_SYNC',
    'ADD_IF_MISSING', 'JSON_MERGE', 'SCHEMA_MERGE', 'WORKSPACE', 'SYNC'].includes(policy);
}

// ── Effective template tree (scaffold parity: variant overlay over common) ────────────────────

export interface EffectiveFile {
  rel: string;
  source: 'variant' | 'common';
  abs: string;
}

function* walkFiles(root: string, prefix = ''): Generator<string> {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (TRAVERSAL_SKIP_DIRS.has(entry.name) || entry.name === '.DS_Store') continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = join(root, entry.name);
    if (statSync(abs).isDirectory()) yield* walkFiles(abs, rel);
    else yield rel;
  }
}

/**
 * Walk the effective template tree for a project: the variant template overlaid on
 * templates/common (variant wins), replicating scaffold overlay facts — the variant never
 * provides docs/context.md (VARIANT_OVERLAY_SKIP / WS-07).
 */
export function* iterEffectiveTemplateFiles(
  commonDir: string,
  variantDir: string | null,
): Generator<EffectiveFile> {
  const seen = new Set<string>();
  if (variantDir && existsSync(variantDir)) {
    for (const rel of walkFiles(variantDir)) {
      if (rel === 'docs/context.md') continue; // WS-07: common is the SSOT
      seen.add(rel);
      yield { rel, source: 'variant', abs: join(variantDir, rel) };
    }
  }
  for (const rel of walkFiles(commonDir)) {
    if (seen.has(rel)) continue;
    yield { rel, source: 'common', abs: join(commonDir, rel) };
  }
}

// ── JSON_MERGE (platform settings) ────────────────────────────────────────────────────────────

export interface JsonMergeResult {
  changed: boolean;
  merged: string;
  /** Project-only keys/entries the merge preserved (logged by the caller). */
  preserved: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge template settings over project settings (design D4):
 *  - objects recurse (template wins conflicts),
 *  - arrays are unioned — project-only entries survive (protects project permission grants),
 *  - scalars: template wins.
 *  Project-only keys anywhere in the tree are preserved and reported (dot paths from the root). */
export function mergeSettingsData(template: unknown, project: unknown, path = ''): { merged: unknown; preserved: string[] } {
  const preserved: string[] = [];
  const childPath = (key: string) => (path ? `${path}.${key}` : key);

  if (isPlainObject(template) && isPlainObject(project)) {
    const out: Record<string, unknown> = { ...project };
    for (const [key, tVal] of Object.entries(template)) {
      if (!(key in project)) {
        out[key] = tVal;
        continue;
      }
      const sub = mergeSettingsData(tVal, project[key], childPath(key));
      out[key] = sub.merged;
      preserved.push(...sub.preserved);
    }
    for (const key of Object.keys(project)) {
      if (!(key in template)) preserved.push(childPath(key));
    }
    return { merged: out, preserved };
  }

  if (Array.isArray(template) && Array.isArray(project)) {
    // Union with template first: template entries present, project-only entries kept.
    const merged = [...template];
    for (const item of project) {
      if (!merged.some(m => JSON.stringify(m) === JSON.stringify(item))) {
        merged.push(item);
        preserved.push(`${path}[]`);
      }
    }
    return { merged, preserved };
  }

  return { merged: template, preserved };
}

/** Merge the template settings file over the project's copy on disk. Read-only on the template. */
export function mergeSettingsJson(projectFile: string, templateFile: string): JsonMergeResult {
  const template = JSON.parse(readFileSync(templateFile, 'utf8'));
  const projectRaw = readFileSync(projectFile, 'utf8');
  const project = JSON.parse(projectRaw);
  const { merged, preserved } = mergeSettingsData(template, project);
  const out = `${JSON.stringify(merged, null, 2)}\n`;
  return { changed: out !== projectRaw, merged: out, preserved };
}

// ── SCHEMA_MERGE: merge-aware delivery for docs/workspace-schema.json ─────────────────────────
// Spec 2026-10-31-workspace-schema-merge-delivery-design (§3/§4, v1.34.0 addendum
// U-20261101-001). mergeSettingsData above has the WRONG semantics for this file:
// array-union would append the template's playground scanRoot to co-price's ["src"]
// (the token lint would scan both trees) and template-wins scalars would clobber
// project-evolved leaf values. The schema merge is block-aware, three-way over
// top-level keys, project-wins on existing leaves EXCEPT the template-authoritative
// vocabulary blocks (models, platform_surfaces — they pair with template-managed
// prose and land verbatim), arrays ATOMIC — a pure function of (template, project)
// and therefore idempotent (design §4).

/** Metadata scalars the template owns verbatim on the SCHEMA_MERGE path (design §4 rule 1):
 *  even when present in the project copy, the template value lands (schema-version
 *  evolution must reach every project). Everything else absent from the project copy is
 *  also template-owned (template-ADDED blocks land through that rule). */
export const SCHEMA_TEMPLATE_OWNED_KEYS = ['$schema', 'version', 'description'] as const;

/** Template-authoritative vocabulary blocks (v1.34.0, U-20261101-001 addendum):
 *  top-level blocks the template owns VERBATIM even when present in the project
 *  copy. They are the schema-side half of template-managed prose pairs —
 *  `models.*` rows feed validate-model-registry.ts's exact-equality gate
 *  against the AGENTS.md §3.6 / CODEX.md WORKSPACE-MANAGED model vocabulary the
 *  MERGE pass stamps verbatim — so a project-wins divergence here desyncs the
 *  pair and fails the gate. The template value lands; divergence is logged
 *  (TEMPLATE_DELTA INFO), never withheld. Everything else (notably
 *  `designLint`, the protected token-debt class) stays project-wins. */
export const SCHEMA_TEMPLATE_AUTHORITATIVE_KEYS = ['models', 'platform_surfaces'] as const;

/** One withheld template change: a shared-block leaf whose final (project-won) value
 *  differs from the template's value. The engine turns these into TEMPLATE_DELTA
 *  decision-log rows (design §4 — the decision log owns visibility of what did not land;
 *  the upgrade stays green). */
export interface SchemaMergeLeafDelta {
  /** Dotted path from the schema root (e.g. `designLint.scanRoots`). */
  path: string;
  /** JSON-serialized template value (truncated for log readability). */
  template: string;
  /** JSON-serialized project value that won (truncated for log readability). */
  project: string;
  /** WARN for scalar/array divergences (a reshaped value the template wanted to deliver);
   *  INFO for structural mismatches (an object replaced by a non-object or vice versa). */
  severity: 'WARN' | 'INFO';
}

export interface SchemaMergeResult {
  merged: Record<string, unknown>;
  /** Template-owned top-level keys that landed verbatim (absent from the project copy). */
  landed: string[];
  /** Project-only top-level keys preserved untouched (never pruned by delivery). */
  preserved: string[];
  /** Shared-block leaves where the project value won — the withheld template changes. */
  templateDeltas: SchemaMergeLeafDelta[];
}

function isSchemaPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Structural deep-equality (order-insensitive for object keys; arrays compare element-wise
 *  as ordered values). JSON.stringify comparison would report key-order-only differences
 *  between template and project copies of the same content as real deltas. */
function schemaDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => schemaDeepEqual(item, b[i]));
  }
  if (isSchemaPlainObject(a) && isSchemaPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length && aKeys.every((k) => k in b && schemaDeepEqual(a[k], b[k]));
  }
  return false;
}

/** Truncate a serialized value for decision-log readability (a 131-entry allowlist must not
 *  flood the manifest). Deterministic: same value → same summary. */
function summarizeSchemaValue(v: unknown, max = 120): string {
  const raw = JSON.stringify(v) ?? String(v);
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1)}… (${raw.length} chars)`;
}

/** Shared-block leaf merge (design §4 rule 3). Both sides are present: objects recurse
 *  (project order first, template-only keys append in template order); every non-object
 *  leaf — scalars AND arrays — is project-wins when present (arrays are ATOMIC: template
 *  and project arrays are alternative choices, never unioned). Deltas record every leaf
 *  present on both sides whose final value differs from the template's. */
function mergeSchemaNode(t: unknown, p: unknown, path: string, deltas: SchemaMergeLeafDelta[]): unknown {
  if (isSchemaPlainObject(t) && isSchemaPlainObject(p)) {
    const out: Record<string, unknown> = { ...p };
    for (const [key, tVal] of Object.entries(t)) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in p)) {
        out[key] = tVal; // template-only key inside a shared block still reaches evolved projects
        continue;
      }
      out[key] = mergeSchemaNode(tVal, p[key], childPath, deltas);
    }
    return out;
  }
  if (!schemaDeepEqual(t, p)) {
    const structural = isSchemaPlainObject(t) || isSchemaPlainObject(p);
    deltas.push({
      path,
      template: summarizeSchemaValue(t),
      project: summarizeSchemaValue(p),
      severity: structural ? 'INFO' : 'WARN',
    });
  }
  return p;
}

/** Divergence recorder for template-authoritative blocks (v1.34.0, U-20261101-001
 *  addendum): walks the (template, project) subtree pair and records every leaf
 *  where the project copy differs from the template's — all at INFO severity,
 *  because these rows document a landing (the template value won), not a
 *  withholding. Template-only keys inside the block land silently (they are the
 *  template's vocabulary); project-only keys inside the block are DROPPED by the
 *  verbatim landing and logged (template '(absent)') so the removal is loud. */
function recordTemplateAuthoritativeDeltas(t: unknown, p: unknown, path: string, deltas: SchemaMergeLeafDelta[]): void {
  if (isSchemaPlainObject(t) && isSchemaPlainObject(p)) {
    for (const [key, tVal] of Object.entries(t)) {
      if (key in p) recordTemplateAuthoritativeDeltas(tVal, p[key], `${path}.${key}`, deltas);
    }
    for (const key of Object.keys(p)) {
      if (!(key in t)) {
        deltas.push({
          path: `${path}.${key}`,
          template: '(absent — project-only key dropped by the template-authoritative landing)',
          project: summarizeSchemaValue(p[key]),
          severity: 'INFO',
        });
      }
    }
    return;
  }
  if (!schemaDeepEqual(t, p)) {
    deltas.push({ path, template: summarizeSchemaValue(t), project: summarizeSchemaValue(p), severity: 'INFO' });
  }
}

/**
 * Merge-aware delivery merge for docs/workspace-schema.json (design §4, v1.34.0
 * addendum): block-aware, three-way over top-level keys, project-wins on existing
 * leaves EXCEPT the template-authoritative vocabulary blocks, arrays atomic.
 *
 * For each top-level key K in union(template, project):
 *  1. Template-owned — K absent from the project copy, plus the metadata scalars
 *     `$schema`/`version`/`description`: the template value lands verbatim.
 *  2. Template-authoritative (U-20261101-001) — K in SCHEMA_TEMPLATE_AUTHORITATIVE_KEYS
 *     (`models`, `platform_surfaces`) and present on both sides: the template value
 *     lands verbatim (it pairs with template-managed prose downstream); every
 *     divergence is recorded as a TEMPLATE_DELTA INFO row.
 *  3. Project-owned — K present only in the project copy: preserved untouched.
 *  4. Shared (everything else, notably designLint) — recursive leaf merge,
 *     project-wins on existing leaves, template-only keys land, arrays atomic
 *     (never unioned).
 *
 * Pure in (template, project): `merge(merge(T, P), T)` deep-equals `merge(T, P)` (rules
 * 3–4 are pure functions of the two trees; rules 1–2 are set-stable). Throws on
 * non-object input — the engine hard-SKIPs on malformed JSON with an explicit error
 * (no silent fallback).
 */
export function mergeWorkspaceSchemaData(template: unknown, project: unknown): SchemaMergeResult {
  if (!isSchemaPlainObject(template)) {
    throw new Error('SCHEMA_MERGE: template docs/workspace-schema.json is not a JSON object');
  }
  if (!isSchemaPlainObject(project)) {
    throw new Error('SCHEMA_MERGE: project docs/workspace-schema.json is not a JSON object');
  }
  const deltas: SchemaMergeLeafDelta[] = [];
  const merged: Record<string, unknown> = { ...project };
  const landed: string[] = [];
  const preserved: string[] = [];
  for (const [key, tVal] of Object.entries(template)) {
    if (!(key in project)) {
      merged[key] = tVal;
      landed.push(key);
      continue;
    }
    if ((SCHEMA_TEMPLATE_OWNED_KEYS as readonly string[]).includes(key)) {
      merged[key] = tVal; // metadata scalars land verbatim (schema-version evolution)
      continue;
    }
    if ((SCHEMA_TEMPLATE_AUTHORITATIVE_KEYS as readonly string[]).includes(key)) {
      // Template-authoritative vocabulary block (U-20261101-001): the template value
      // lands verbatim — project-wins here desynced the schema rows from the
      // template-managed prose the MERGE pass stamps (fleet-wide exact-equality gate
      // failures). Divergence is logged, not withheld.
      recordTemplateAuthoritativeDeltas(tVal, project[key], key, deltas);
      merged[key] = tVal;
      continue;
    }
    merged[key] = mergeSchemaNode(tVal, project[key], key, deltas);
  }
  for (const key of Object.keys(project)) {
    if (!(key in template)) preserved.push(key);
  }
  return { merged, landed, preserved, templateDeltas: deltas };
}

/** File-level SCHEMA_MERGE result (the mergeSettingsJson convention): the serialized
 *  output replaces the merged object in `merged` (2-space indent + trailing newline). */
export interface SchemaMergeJsonResult {
  changed: boolean;
  /** Serialized merged output (2-space indent + trailing newline). */
  merged: string;
  /** Template-owned top-level keys that landed verbatim (absent from the project copy). */
  landed: string[];
  /** Project-only top-level keys preserved untouched (never pruned by delivery). */
  preserved: string[];
  /** Shared-block leaves where the project value won — the withheld template changes. */
  templateDeltas: SchemaMergeLeafDelta[];
}

export function mergeWorkspaceSchemaJson(projectFile: string, templateFile: string): SchemaMergeJsonResult {
  const template = JSON.parse(readFileSync(templateFile, 'utf8'));
  const projectRaw = readFileSync(projectFile, 'utf8');
  const project = JSON.parse(projectRaw);
  const result = mergeWorkspaceSchemaData(template, project);
  const out = `${JSON.stringify(result.merged, null, 2)}\n`;
  return { ...result, changed: out !== projectRaw, merged: out };
}

/** Remove an agent/markdown file's top-level `lifecycle:` frontmatter block
 *  (a YAML mapping at column 0 inside the frontmatter, terminated by the next
 *  key at column 0 or the closing `---`) AND its top-level `last_updated:` line
 *  from the comparison text. Used for drift comparisons where the project's
 *  lifecycle block is preserved by design and must not count, and — since
 *  U-20261026-009 — the top-level `last_updated` date is re-stamped on every
 *  content delivery (upgrade-versions.ts bumpFrontmatterLastUpdated), so a
 *  bump-only date difference must not read as content drift either (the same
 *  tolerance agent-lifecycle-audit's isMetadataOnlyChange implements). */
export function lifecyclelessText(text: string): string {
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return text;
  const lines = fm[1].split("\n");
  const kept: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (/^lifecycle:\s*$/.test(line)) { skipping = true; continue; }
    if (skipping) {
      if (/^[^\s#]/.test(line)) {
        skipping = false;
        // The block terminator itself may be the top-level `last_updated:` line.
        if (/^last_updated:\s*/.test(line)) continue;
        kept.push(line);
      }
      continue;
    }
    // Top-level `last_updated:` (column 0) is re-stamped per delivery — not content.
    if (/^last_updated:\s*/.test(line)) continue;
    kept.push(line);
  }
  return text.replace(fm[0], `---\n${kept.join("\n")}\n---`);
}

/**
 * True iff the content is an ADR-0033 extends-stub: a frontmatter block whose
 * body declares `extends:` (the pointer, not a resolved file — a project's
 * resolved agent never carries the field). T-20260924-003 R2.4: the upgrade
 * agents/ SYNC pass must skip these template files — the v1.35.0 equal-version
 * drift reconciliation compared the 8-line template stub against the project's
 * resolved full body and "restored" the stub over it (the proven pm.md
 * 349→8-line clobber). Stubs are resolved at scaffold/adopt time by
 * helpers/resolve-pm-stub.ts.
 */
export function isExtendsStub(content: string): boolean {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return !!fm && /^extends:\s*\S/m.test(fm[1]);
}

// ── ADR-0102 agent tier frontmatter normalization (T-20261027-005) ────────────

export interface AgentTierNormalization {
  /** Project content after normalization (identical to the input when nothing changed). */
  content: string;
  /** True when the legacy per-platform tier map was replaced by the template scalar. */
  changed: boolean;
  /** True when the project tier is already scalar and differs from the template scalar —
   *  deliberate project divergence, left untouched (the caller logs a conflict line). */
  conflict: boolean;
  /** True when the project frontmatter carried a legacy per-platform tier map. */
  legacy: boolean;
  /** The template's scalar tier value ('' when the template side is not scalar). */
  templateTier: string;
  /** The project's scalar tier value when conflict:true ('' otherwise). */
  projectTier: string;
}

/** Extract the YAML frontmatter body of a markdown file (must start at byte 0). */
function frontmatterBody(content: string): { body: string; start: number; end: number; eol: string } | null {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m || m.index === undefined) return null;
  return {
    body: m[1],
    start: m.index,
    end: m.index + m[0].length,
    eol: m[0].includes('\r\n') ? '\r\n' : '\n',
  };
}

/** Strip a trailing YAML comment from a scalar tier value (`medium # claude:sonnet` → `medium`). */
function stripTierComment(value: string): string {
  return value.replace(/\s+#.*$/, '').trim();
}

/**
 * Normalize a project agent's legacy per-platform tier frontmatter block to the
 * template's scalar tier (T-20261027-005, ADR-0102). The template is authoritative
 * for the managed `tier` key — but ONLY the tier block is ever rewritten:
 *
 *  - template side not scalar (map-form or absent)  → no-op (never invent a value);
 *  - project tier is a legacy map (`tier:` line with indented per-platform keys)
 *    → the whole block is replaced by `tier: <template scalar>`;
 *  - project tier is scalar and EQUAL               → no-op (idempotent);
 *  - project tier is scalar and DIFFERENT           → conflict:true, untouched
 *    (deliberate divergence is never silently overwritten);
 *  - project has no `tier` key                      → no-op (normalization never
 *    adds frontmatter that was never there).
 *
 * Body text and all other frontmatter keys are byte-preserved; CRLF line endings
 * are detected and preserved. Stale model-ID trailing comments on a scalar tier
 * value are ignored for the comparison (the v1.57.0 tier-comment migration
 * precedent) and dropped when a map block is rewritten.
 */
export function normalizeAgentTierFrontmatter(projectContent: string, templateContent: string): AgentTierNormalization {
  const untouched: AgentTierNormalization = {
    content: projectContent, changed: false, conflict: false, legacy: false, templateTier: '', projectTier: '',
  };
  const tplFm = frontmatterBody(templateContent);
  if (!tplFm) return untouched;
  const tplScalar = tplFm.body.match(/^tier:[ \t]*(\S[^\r\n]*)$/m);
  if (!tplScalar) return untouched; // template side is map-form or absent — nothing to normalize TO
  const templateTier = stripTierComment(tplScalar[1]);
  const projFm = frontmatterBody(projectContent);
  if (!projFm) return untouched;
  const lines = projFm.body.split(/\r?\n/);
  const tierIdx = lines.findIndex((l) => /^tier:[ \t]*(\S.*)?$/.test(l));
  if (tierIdx === -1) return { ...untouched, templateTier };
  const scalarMatch = lines[tierIdx].match(/^tier:[ \t]*(\S.*)$/);
  if (scalarMatch) {
    const projectTier = stripTierComment(scalarMatch[1]);
    if (projectTier === templateTier) return { ...untouched, templateTier };
    return { ...untouched, templateTier, conflict: true, projectTier };
  }
  // `tier:` with no inline value — legacy per-platform map iff at least one
  // indented continuation line follows (until the next column-0 key or the
  // closing delimiter, both of which fail the indented test).
  let blockEnd = tierIdx + 1;
  while (blockEnd < lines.length && /^[ \t]+\S/.test(lines[blockEnd])) blockEnd++;
  if (blockEnd === tierIdx + 1) return { ...untouched, templateTier }; // empty tier key — never invent structure
  const rebuilt = [...lines.slice(0, tierIdx), `tier: ${templateTier}`, ...lines.slice(blockEnd)];
  const fmText = `---${projFm.eol}${rebuilt.join(projFm.eol)}${projFm.eol}---`;
  return {
    content: projectContent.slice(0, projFm.start) + fmText + projectContent.slice(projFm.end),
    changed: true,
    conflict: false,
    legacy: true,
    templateTier,
    projectTier: '',
  };
}

// ── Stub frontmatter scalar backfill (T-20261028-010) ─────────────────────────

export interface StubFrontmatterBackfill {
  /** Project content after the backfill (identical to the input when nothing changed). */
  content: string;
  /** True when at least one missing scalar was filled. */
  changed: boolean;
  /** The filled top-level keys, in fill order (subset of tier/version/last_updated). */
  filled: string[];
}

/**
 * Backfill MISSING top-level scalar frontmatter keys (tier / version /
 * last_updated) in a project extends-stub from its template counterpart
 * (T-20261028-010 — spec docs/designs/2026-10-28-stub-frontmatter-backfill-
 * design.md). The validate-model-registry v2.1.0 missing-tier FAIL flip
 * (T-20261027-003, template-v0.22.0) turned stubs whose frontmatter predates
 * the field red, and no delivery pass adds a missing key: the MERGE normalizer
 * above rewrites an EXISTING tier block only, and the agents/ version-gated
 * passes replace frontmatter wholesale — the agents/ STUB skip branch is the
 * only place a stub-shaped file survives a run untouched.
 *
 * Contract:
 *  - the PROJECT content must itself be stub-shaped (a column-0 `extends:`
 *    inside the frontmatter) — resolved agent bodies are never touched even
 *    when a caller mis-wires the branch (the helper-level ownership guard);
 *  - MISSING = the top-level (column-0) key is absent from the project
 *    frontmatter. Existing values are NEVER overwritten (deliberate project
 *    divergence — a pinned older version — stays); an empty-value key is
 *    treated as present (the v1.24.0 contract: never invent structure); nested
 *    keys (the `lifecycle:` block's `last_updated:`) are never touched;
 *  - field sources: `tier` from the template counterpart's scalar
 *    (comment-stripped; a map-form template side fills nothing), `version`
 *    from the counterpart's scalar verbatim (quotes preserved), `last_updated`
 *    from the DELIVERY DATE (not the counterpart's authoring date — the same
 *    convention as the post-delivery re-stamp); all three require the
 *    counterpart to declare the key, and an invalid deliveryDate leaves
 *    last_updated unfilled;
 *  - filled keys append at the end of the frontmatter body (YAML mapping key
 *    order is insignificant; append keeps the diff minimal and never reorders
 *    existing keys); CRLF line endings are detected and preserved; idempotent;
 *  - body bytes are untouched — frontmatter scalars only.
 */
export function backfillStubFrontmatter(
  projectContent: string,
  templateContent: string,
  deliveryDate: string,
): StubFrontmatterBackfill {
  const unchanged: StubFrontmatterBackfill = { content: projectContent, changed: false, filled: [] };
  const projFm = frontmatterBody(projectContent);
  if (!projFm || !/^extends:[ \t]*\S/m.test(projFm.body)) return unchanged; // not a stub — never touch
  const tplFm = frontmatterBody(templateContent);
  if (!tplFm) return unchanged;
  const present = (key: string): boolean =>
    projFm.body.split(/\r?\n/).some((l) => new RegExp(`^${key}:(?:[ \\t].*)?$`).test(l));
  const tplScalar = (key: string): string => {
    const m = tplFm.body.match(new RegExp(`^${key}:[ \\t]*(\\S[^\\r\\n]*)$`, 'm'));
    return m ? m[1].trim() : '';
  };
  const fills: string[] = [];
  if (!present('tier')) {
    const tier = stripTierComment(tplScalar('tier'));
    if (tier) fills.push(`tier: ${tier}`);
  }
  if (!present('version')) {
    const version = tplScalar('version');
    if (version) fills.push(`version: ${version}`);
  }
  if (!present('last_updated') && /^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    fills.push(`last_updated: ${deliveryDate}`);
  }
  if (fills.length === 0) return unchanged;
  const rebuilt = [...projFm.body.split(/\r?\n/), ...fills];
  const fmText = `---${projFm.eol}${rebuilt.join(projFm.eol)}${projFm.eol}---`;
  return {
    content: projectContent.slice(0, projFm.start) + fmText + projectContent.slice(projFm.end),
    changed: true,
    filled: fills.map((f) => f.split(':')[0]!),
  };
}

/** Pipeline-generated paths that never count as hand-authored code in a diff.
 *  (U-20261027-002): `scripts-snapshot.json` and `.claude/last-upgrade-pr-body.md`
 *  join the set — both are regenerated by upgrade-project AFTER
 *  `.claude/last-upgrade-delivery.json` is written (the post-upgrade snapshot
 *  regen and the T-20261007-018 PR-body compose), so they can never appear in
 *  manifest.files; when their content changed, isDeliveredDiff() rejected the
 *  diff and dev-sync step 3.9 hard-blocked a purely delivered diff. */
export const PIPELINE_ARTIFACT_PATHS: readonly string[] = [
  'CHANGELOG.md',
  'docs/VERSION_MANIFEST.md',
  'docs/skill-graph.json',
  'docs/skill-graph.md',
  '.claude/last-upgrade-delivery.json',
  '.claude/last-upgrade-pr-body.md',
  'scripts-snapshot.json',
];

export function isPipelineArtifact(rel: string): boolean {
  return PIPELINE_ARTIFACT_PATHS.includes(rel) || rel.startsWith('memory/');
}

/**
 * True iff the changed-file list is non-empty and fully covered by the recorded
 * upgrade delivery ∪ pipeline artifacts (dev-sync step 3.9 auto-E5).
 */
export function isDeliveredDiff(changedFiles: string[], deliveredFiles: string[]): boolean {
  if (changedFiles.length === 0 || deliveredFiles.length === 0) return false;
  const delivered = new Set(deliveredFiles);
  // Requires at least one delivered file in the diff — a changelog/memory-only
  // diff is not an upgrade delivery.
  return changedFiles.some(f => delivered.has(f))
    && changedFiles.every(f => delivered.has(f) || isPipelineArtifact(f));
}

// ── Delivery-decision log (sync-overwrite-policy design, spec 2026-10-27-sync-overwrite-policy) ─
// Design D1/D2/D3: provenance baselines in the delivery manifest, a disposition
// matrix for project-evolved files under version-gated overwrite passes, and a
// unified per-run decision log. DATA + pure helpers only — the deny-list
// resolver above is untouched (design §8: "No classification change").

/** Severity contract (design §7): INFO = expected mechanics; WARN = divergence
 *  worth reading; ERROR = requires explicit disposition before the delivery can
 *  be considered clean. MERGE defaults INFO (uncontested union); the engine
 *  overrides to WARN when a destructive in-zone replace wrote a snapshot. */
export type DecisionSeverity = 'INFO' | 'WARN' | 'ERROR';

/** Verdicts of the unified decision log (design D3/D2 matrix). TOMBSTONED /
 *  TOMBSTONED_SKIP joined in v1.27.0 (tombstone-ownership design D3);
 *  STUB_FM_BACKFILL joined in v1.28.0 (T-20261028-010 — missing stub-frontmatter
 *  scalar backfill from the template counterpart);
 *  STUB_VERSION_BUMP_ADVICE joined in v1.29.0 (T-20261028-013 — D9 stub-composed
 *  compare: advisory-only INFO suggesting a stub `version` bump when stub-owned
 *  fields changed template-side without the bump that would have version-gated
 *  the re-delivery; the validate-templates enforcement check is a follow-up per
 *  the approved design's Q5 default, advisory-first);
 *  REGION_IN_SYNC / EVOLVED_REGION / TEMPLATE_AHEAD_REGION joined in v1.30.0
 *  (instruction-ownership design D1/D2 — the instruction-file region census;
 *  CONFLICT (ERROR) for a census-gated adapted-span replace is recorded by the
 *  engine under the existing CONFLICT verdict); TOMBSTONE_CLEARED /
 *  STUB_VERSION_DIVERGENCE joined in v1.31.0 (delivery-bookkeeping-engine
 *  design B1/D1 — the auditable --clear-tombstone retraction row and the
 *  sanctioned-pin stub version divergence row); TEMPLATE_DELTA joined in
 *  v1.32.0 (workspace-schema merge-delivery design — one row per template
 *  change the SCHEMA_MERGE merge withheld under project-wins; INFO default,
 *  WARN via the per-row override for scalar/array divergences). DELETE joined
 *  in v1.34.0 (T-20261101-001 adjudication — a registry-curated prune deletion
 *  must never be silent; DELETE is contractually WARN, the floor the
 *  adjudication set for destructive rows). */
export type DecisionVerdict =
  | 'NEW'
  | 'UPDATE'
  | 'ADOPT'
  | 'SKIP'
  | 'MERGE'
  | 'TEMPLATE_DELTA'
  | 'CONTEXT_PRESERVE'
  | 'DRIFT_PRESERVE'
  | 'DRIFT_RESTORED'
  | 'STUB_SKIP'
  | 'STUB_FM_BACKFILL'
  | 'STUB_VERSION_BUMP_ADVICE'
  | 'STUB_VERSION_DIVERGENCE'
  | 'REGION_IN_SYNC'
  | 'EVOLVED_REGION'
  | 'TEMPLATE_AHEAD_REGION'
  | 'SEED_SKIP'
  | 'SKELETON_COLLISION'
  | 'EVOLVED'
  | 'TOMBSTONED'
  | 'TOMBSTONED_SKIP'
  | 'TOMBSTONE_CLEARED'
  | 'CONFLICT'
  | 'DELETE';

export const DECISION_SEVERITY_CONTRACT: Record<DecisionVerdict, DecisionSeverity> = {
  NEW: 'INFO',
  UPDATE: 'INFO',
  ADOPT: 'INFO',
  SKIP: 'INFO',
  MERGE: 'INFO',
  TEMPLATE_DELTA: 'INFO',
  SEED_SKIP: 'INFO',
  STUB_SKIP: 'INFO',
  STUB_FM_BACKFILL: 'INFO',
  STUB_VERSION_BUMP_ADVICE: 'INFO',
  STUB_VERSION_DIVERGENCE: 'INFO',
  REGION_IN_SYNC: 'INFO',
  EVOLVED_REGION: 'WARN',
  TEMPLATE_AHEAD_REGION: 'WARN',
  CONTEXT_PRESERVE: 'WARN',
  DRIFT_PRESERVE: 'WARN',
  DRIFT_RESTORED: 'WARN',
  SKELETON_COLLISION: 'WARN',
  EVOLVED: 'WARN',
  TOMBSTONED: 'ERROR',
  TOMBSTONED_SKIP: 'INFO',
  TOMBSTONE_CLEARED: 'INFO',
  CONFLICT: 'ERROR',
  DELETE: 'WARN',
};

/** One decision entry of the unified decision log (design §7 schema). */
export interface DeliveryDecision {
  path: string;
  policy: string;
  pass: string;
  verdict: DecisionVerdict;
  severity: DecisionSeverity;
  /** The delivered-baseline provenance this decision was judged against (when one exists). */
  baseline?: DecisionBaseline;
  detail: string;
}

/** Per-file delivered-baseline provenance (design D1): SHA-256 of the delivered
 *  content key (see baselineKeyFor) + the template revision it came from. */
export interface DecisionBaseline {
  hash: string;
  templateVersion: string;
}

/** One recorded delivery tombstone (tombstone-ownership design D1): the
 *  project deliberately deleted a previously delivered file and the deletion
 *  intent was confirmed with `--tombstone <glob>` (apply mode only — there is
 *  no auto-record path). `hash` is the last delivered baseline (baselineKeyFor
 *  form) at detection time; `recordedAt` is the ISO date of the confirming
 *  run; `reason` is the operator-supplied or decision-referenced rationale. */
export interface TombstoneEntry {
  hash: string;
  templateVersion: string;
  recordedAt: string;
  reason: string;
}

/** Delivery manifest v2 (design §7). The top-level `files` array is preserved
 *  verbatim so every v1 consumer (dev-sync step 3.9 isDeliveredDiff, PR-body
 *  compose) keeps working unchanged. `tombstones` (tombstone-ownership design
 *  D1) is an ADDITIVE OPTIONAL key — schemaVersion stays 2; manifests without
 *  the key stay valid (the same tolerance as the v1→v2 migration), and the
 *  writer rule is `tombstones = (prior ∪ newly recorded) − paths delivered
 *  this run` (delivering a path is the natural clear event). */
export interface DeliveryManifestV2 {
  schemaVersion: 2;
  timestamp: string;
  project: string;
  templateVersion: string;
  /** git SHA of the workspace templates at delivery time (workspace HEAD). */
  templateSha: string;
  /** project git HEAD at delivery ('' for fresh scaffolds with no commits). */
  baseSha: string;
  files: string[];
  baselines: Record<string, DecisionBaseline>;
  decisions: DeliveryDecision[];
  tombstones?: Record<string, TombstoneEntry>;
}

/** How a project file relates to its delivered baseline and today's deliverable (design D1). */
export type ProjectStateClassification = 'UNTOUCHED' | 'IN_SYNC' | 'PROJECT_EVOLVED' | 'NO_BASELINE';

export interface ProjectStateVerdict {
  state: ProjectStateClassification;
  /** True when the project content already equals what the pass would deliver today. */
  matchesDeliverable: boolean;
  /** True when today's deliverable differs from the recorded baseline — i.e. the
   *  template content changed since this file was last delivered. False without
   *  a baseline (unknown). */
  templateChanged: boolean;
}

/** SHA-256 of UTF-8 content (baseline keys, decision-log fingerprints). */
export function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * The delivered-baseline content key for a project-relative path (design D1).
 * Plain files: the raw written bytes. agents/ (frontmatter-carrying files the
 * pass delivers through lifecycle-block preservation + the post-delivery
 * `last_updated` re-stamp): the lifecycleless bytes — otherwise the project's
 * own lifecycle block and the mechanical date bump would read as project
 * evolution on the very next run (the same tolerance the agents/ drift compare
 * implements via lifecyclelessText). The key form is deterministic from the
 * path, so writer and classifier always agree.
 */
export function baselineKeyFor(rel: string, content: string): string {
  return rel.startsWith('agents/')
    ? sha256Hex(lifecyclelessText(content))
    : sha256Hex(content);
}

/**
 * Classify a delivery candidate against its delivered baseline (design D1/D2).
 * `projectContent` is the project's current bytes; `deliverableContent` is the
 * exact bytes the pass would deliver today (rendered/merged/pruned form — the
 * same content a delivery would write); `baseline` is the recorded provenance
 * or undefined (first run after the policy lands — degrade, design §8).
 */
export function classifyProjectState(
  rel: string,
  projectContent: string,
  deliverableContent: string,
  baseline: DecisionBaseline | undefined,
): ProjectStateVerdict {
  const projectKey = baselineKeyFor(rel, projectContent);
  const deliverableKey = baselineKeyFor(rel, deliverableContent);
  const matchesDeliverable = projectKey === deliverableKey;
  if (!baseline) {
    return { state: 'NO_BASELINE', matchesDeliverable, templateChanged: false };
  }
  if (projectKey === baseline.hash) {
    return { state: 'UNTOUCHED', matchesDeliverable, templateChanged: deliverableKey !== baseline.hash };
  }
  if (matchesDeliverable) {
    return { state: 'IN_SYNC', matchesDeliverable, templateChanged: deliverableKey !== baseline.hash };
  }
  return { state: 'PROJECT_EVOLVED', matchesDeliverable, templateChanged: deliverableKey !== baseline.hash };
}

/** The CLI disposition flag state (design D2): default (CONFLICT → SKIP) or an
 *  explicit adopt-template grant, optionally narrowed by a glob. */
export type DispositionFlag =
  | { mode: 'default' }
  | { mode: 'adopt-template'; matches: (rel: string) => boolean };

export interface DispositionOutcome {
  /** True when the pass may deliver (per the disposition matrix). */
  deliver: boolean;
  /** Verdict for the decision entry when the matrix fired (PROJECT_EVOLVED). */
  verdict: DecisionVerdict;
  severity: DecisionSeverity;
  /** Detail suffix describing the fired matrix row. */
  detail: string;
}

/**
 * D2 disposition resolution for a PROJECT_EVOLVED candidate under a
 * version-gated content-delivering pass:
 *  - template content unchanged since delivery → deliver as today, log
 *    EVOLVED (WARN) — "deliver only on explicit version gate as today";
 *  - template content ALSO changed → CONFLICT (ERROR): default SKIP (project
 *    copy preserved, delivery skipped, decision recorded), or deliver as ADOPT
 *    (INFO) under an explicit --disposition adopt-template[=glob] grant.
 * Callers use this ONLY when state === 'PROJECT_EVOLVED' (other states keep the
 * pass's normal verdict; the agents/ equal-version drift arm forces the
 * CONFLICT row unconditionally per the design's dedicated matrix row).
 */
export function resolveDisposition(
  classification: ProjectStateVerdict,
  rel: string,
  disposition: DispositionFlag,
): DispositionOutcome {
  if (classification.state !== 'PROJECT_EVOLVED') {
    return { deliver: true, verdict: 'UPDATE', severity: 'INFO', detail: '' };
  }
  if (!classification.templateChanged) {
    return {
      deliver: true,
      verdict: 'EVOLVED',
      severity: 'WARN',
      detail: 'project-evolved since delivery; template content unchanged — version-gated delivery proceeds (EVOLVED, WARN)',
    };
  }
  const granted = disposition.mode === 'adopt-template' && disposition.matches(rel);
  if (granted) {
    return {
      deliver: true,
      verdict: 'ADOPT',
      severity: 'INFO',
      detail: 'project-evolved + template changed — delivered via explicit --disposition adopt-template (decision recorded)',
    };
  }
  return {
    deliver: false,
    verdict: 'CONFLICT',
    severity: 'ERROR',
    detail: 'project-evolved since the last delivery AND template changed — CONFLICT disposition: delivery SKIPPED, project copy preserved',
  };
}

// Translate a glob (`**`, `*`, `?`) into an anchored RegExp for
// --disposition adopt-template=<glob> path narrowing. An interior doublestar
// between slashes also matches zero intermediate segments (a/**/b matches
// a/b) and a leading doublestar slash matches top level (**/b matches b).
export function globToRegExp(glob: string): RegExp {
  const src = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\/\u0000\//g, '(?:/.*)?/')
    .replace(/^\u0000\//, '(?:.*/)?')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${src}$`);
}

/** ERROR-severity decisions of a run (design D3.1 — these block silent landing). */
export function unresolvedErrorDecisions(decisions: DeliveryDecision[]): DeliveryDecision[] {
  return decisions.filter((d) => d.severity === 'ERROR');
}

/**
 * D3.1 gate predicate for dev-sync step 3.9: true when a parsed delivery
 * manifest carries unresolved ERROR-severity decisions (its auto-E5 attribution
 * must be refused). Tolerates v1-shaped manifests (no decisions key → false).
 */
export function manifestHasUnresolvedErrors(manifest: unknown): boolean {
  if (!manifest || typeof manifest !== 'object') return false;
  const decisions = (manifest as { decisions?: unknown }).decisions;
  if (!Array.isArray(decisions)) return false;
  return decisions.some(
    (d) => !!d && typeof d === 'object' && (d as { severity?: unknown }).severity === 'ERROR',
  );
}

// ── Delivery tombstones (tombstone-ownership design, spec 2026-10-28-delivery-tombstone-ownership) ─
// Design D2/D3: a project-side deletion of a previously delivered file must
// never be re-delivered silently. The guard is a PURE predicate — the deny-list
// resolver, the baseline classifier, and the severity contract's existing rows
// keep their shapes (design D6).

/** The prior-manifest state the guard reads (a parsed
 *  `.claude/last-upgrade-delivery.json`). Both keys optional: v1-shaped
 *  manifests carry no baselines, manifests without tombstones carry no
 *  tombstones — both parse and degrade to not-firing. */
export interface PriorDeliveryState {
  baselines?: Record<string, DecisionBaseline>;
  tombstones?: Record<string, TombstoneEntry>;
}

export interface TombstoneGuardOutcome {
  /** True when the guard fires and the absent-copy delivery must be skipped. */
  fires: boolean;
  /** The verdict for the decision entry when the guard fires; null otherwise. */
  verdict: DecisionVerdict | null;
  /** Severity from the §7 contract when the guard fires; null otherwise. */
  severity: DecisionSeverity | null;
  /** Detail for the decision entry (names the resolution path on TOMBSTONED). */
  detail: string;
}

const TOMBSTONE_NOT_FIRING: TombstoneGuardOutcome = {
  fires: false, verdict: null, severity: null, detail: '',
};

/**
 * D2/D3 tombstone guard for an absent-copy delivery candidate (tombstone
 * -ownership design §4). Fire condition: `absent(project, rel) &&
 * (prior.tombstones[rel] || prior.baselines[rel])` —
 *  - recorded tombstone → `TOMBSTONED_SKIP` (INFO): the deletion intent was
 *    confirmed in an earlier run; delivery skipped, the path stays absent;
 *  - delivered baseline without a tombstone → `TOMBSTONED` (ERROR): first
 *    observation of the deletion; delivery REFUSED until the operator either
 *    confirms with `--tombstone <glob>` (apply mode) or restores the project
 *    copy and re-runs.
 * Not firing when the project copy exists (the version-gated passes' own
 * evolvedDeliveryGuard owns those rows), when the path was never delivered
 * (scaffold-time absent files, REGENERATED/PROJECT_STATE classes — no
 * baseline, no fire), or when no prior manifest exists (first run after
 * landing). The guard never reads the disposition flag: per D3b
 * `--disposition adopt-template` cannot override a tombstone — taking
 * template content back onto a tombstoned path requires `--clear-tombstone`.
 * The caller structure provides the template-ships-this-path bound: the guard
 * is consulted only from absent-copy branches of passes walking template-side
 * files, so a template-side rename (old path no longer a candidate) never
 * fires (design §4.5).
 */
export function tombstoneGuard(
  rel: string,
  prior: PriorDeliveryState | null | undefined,
  absent: boolean,
): TombstoneGuardOutcome {
  if (!absent || !prior) return TOMBSTONE_NOT_FIRING;
  const entry = prior.tombstones?.[rel];
  if (entry) {
    return {
      fires: true,
      verdict: 'TOMBSTONED_SKIP',
      severity: 'INFO',
      detail: `tombstoned deletion honored (recorded ${entry.recordedAt}${entry.reason ? ` — ${entry.reason}` : ''}) — delivery skipped, project copy stays absent`,
    };
  }
  if (prior.baselines?.[rel]) {
    return {
      fires: true,
      verdict: 'TOMBSTONED',
      severity: 'ERROR',
      detail: 'project deleted a previously delivered file — delivery REFUSED (severity ERROR): confirm with --tombstone <path>, or restore the project copy and re-run',
    };
  }
  return TOMBSTONE_NOT_FIRING;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Instruction-file region taxonomy + census (design D1/D2, spec
// docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md).
// The delivery engine owns regions INSIDE agents/*.md (the tombstone design's
// R1–R3) — this section extends the same ownership model to the five
// instruction files (AGENTS.md, CLAUDE.md, GEMINI.md, CODEX.md, HERMES.md):
//
//   I1 — engine zones: every MANAGED_PATTERNS marker zone plus every
//        ADR-0101 skeleton-registry section. Template-authoritative; the
//        MERGE/DOCS_MERGE passes deliver them exactly as today.
//   I2 — project-state marker sections: scaffold-rendered VARIANT-* marker
//        spans NOT in MANAGED_PATTERNS. Project state; preserved; census-only
//        (never diffed for content beyond existence — Q2 default).
//   I3 — free-form template-echo regions: all remaining out-of-zone content.
//        Template-canonical by default, project adaptation is a first-class,
//        classified disposition (EVOLVED_REGION, WARN) and promotion runs
//        through the adjudicated-port procedure (overwrite-policy §6, D4).
//
// Pure layer only: scanning, diffing, and classification. The write channels
// (unlabeled reconcile, skeleton replace) stay in the merge libs, which consult
// instructionCensusGate; the engine records the decision rows.
// ═══════════════════════════════════════════════════════════════════════════════

import { MANAGED_PATTERNS } from './managed-block-merge.ts';
import { MANAGED_SKELETON_SECTIONS } from './platform-skeleton-merge.ts';
import { VARIANT_SCAFFOLD_MARKER_NAMES } from '../helpers/scaffold-markers.ts';

/** The five instruction files the D1 taxonomy covers (tombstone-design D4
 *  extended from agents/*.md). */
export const INSTRUCTION_FILE_RELS: readonly string[] = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'CODEX.md',
  'HERMES.md',
];

/** D1 region kinds. */
export type InstructionRegionKind = 'I1' | 'I2' | 'I3';

/** One classified region: a half-open line-index span [start, end) over
 *  `content.split('\n')`. */
export interface InstructionRegion {
  kind: InstructionRegionKind;
  /** Human name: managed-zone label, VARIANT marker name, skeleton-registry
   *  section id, or `free-form #N`. */
  name: string;
  start: number;
  end: number;
}

interface LineSpan {
  start: number;
  end: number; // exclusive
}

const trimmedLines = (content: string): string[] => content.split('\n').map((l) => l.trim());

function zoneLineSpans(lines: string[]): LineSpan[] {
  const spans: LineSpan[] = [];
  const trimmed = lines.map((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const open = MANAGED_PATTERNS.find((p) => p.open.test(trimmed[i]!));
    if (!open) continue;
    for (let j = i + 1; j < lines.length; j++) {
      if (trimmed[j] === open.close) {
        spans.push({ start: i, end: j + 1 });
        i = j;
        break;
      }
    }
  }
  return spans;
}

function variantMarkerLineSpans(lines: string[]): LineSpan[] {
  const spans: LineSpan[] = [];
  const trimmed = lines.map((l) => l.trim());
  for (const name of VARIANT_SCAFFOLD_MARKER_NAMES) {
    const open = `<!-- ${name}-START -->`;
    const close = `<!-- ${name}-END -->`;
    const start = trimmed.indexOf(open);
    if (start < 0) continue;
    const end = trimmed.indexOf(close, start + 1);
    if (end < 0) continue; // unterminated — treated as free-form, not project state
    spans.push({ start, end: end + 1 });
  }
  return spans;
}

function overlaps(spans: LineSpan[], idx: number): boolean {
  return spans.some((s) => idx >= s.start && idx < s.end);
}

/**
 * D1 region resolution (design §4.1): parse `content` into I1 / I2 / I3 line
 * spans. Pure. Zone membership is structural — read off the content's own
 * markers and the existing registries; no per-project claim manifest, no new
 * marker syntax.
 */
export function scanInstructionRegions(content: string, rel: string): InstructionRegion[] {
  const lines = content.split('\n');
  const regions: InstructionRegion[] = [];
  const claimed = new Array<boolean>(lines.length).fill(false);

  // I1 — managed marker zones.
  for (const span of zoneLineSpans(lines)) {
    const label = MANAGED_PATTERNS.find((p) => openLineMatches(p, lines[span.start]!))?.label ?? 'managed-zone';
    regions.push({ kind: 'I1', name: label, ...span });
    for (let i = span.start; i < span.end; i++) claimed[i] = true;
  }

  // I1 — ADR-0101 skeleton-registry sections for this rel (out-of-zone heading
  // spans; the same span shape the guarded skeleton replace uses).
  const entries = MANAGED_SKELETON_SECTIONS.filter((e) => e.rel === rel);
  if (entries.length > 0) {
    const registeredHeadings = new Set(entries.map((e) => e.heading));
    const trimmed = trimmedLines(content);
    for (const entry of entries) {
      const start = lines.findIndex((l, i) => !claimed[i] && l.trim() === entry.heading);
      if (start < 0) continue;
      let end = lines.length;
      for (let i = start + 1; i < lines.length; i++) {
        const t = trimmed[i]!;
        if (registeredHeadings.has(t) || MANAGED_PATTERNS.some((p) => p.open.test(t))) {
          end = i;
          break;
        }
      }
      regions.push({ kind: 'I1', name: entry.id, start, end });
      for (let i = start; i < end; i++) claimed[i] = true;
    }
  }

  // I2 — VARIANT-* project-state marker sections (scaffold-rendered, NOT in
  // MANAGED_PATTERNS; Q2 default: project state, no ownership change).
  for (const span of variantMarkerLineSpans(lines)) {
    const name = (lines[span.start]!.trim().match(/^<!-- ([A-Z-]+)-START -->$/)?.[1]) ?? 'VARIANT-marker';
    regions.push({ kind: 'I2', name, ...span });
    for (let i = span.start; i < span.end; i++) claimed[i] = true;
  }

  // I3 — everything else, as contiguous runs.
  let runStart = -1;
  for (let i = 0; i <= lines.length; i++) {
    if (i < lines.length && !claimed[i]) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      regions.push({ kind: 'I3', name: `free-form #${regions.filter((r) => r.kind === 'I3').length + 1}`, start: runStart, end: i });
      runStart = -1;
    }
  }

  return regions;
}

function openLineMatches(p: { open: RegExp }, line: string): boolean {
  return p.open.test(line.trim());
}

/** Census verdicts (D2). CONFLICT (ERROR) is NOT a census row verdict — it is
 *  recorded by the engine when a write channel (unlabeled reconcile, skeleton
 *  replace) targets a span carrying EVOLVED_REGION content and no
 *  --disposition adopt-template grant covers the path. */
export type RegionCensusVerdict = 'REGION_IN_SYNC' | 'EVOLVED_REGION' | 'TEMPLATE_AHEAD_REGION';

export interface RegionCensusRow {
  verdict: RegionCensusVerdict;
  severity: 'INFO' | 'WARN';
  detail: string;
}

export interface InstructionCensus {
  rows: RegionCensusRow[];
  /** True when at least one WARN-grade region row exists (the file carries
   *  out-of-zone divergence). */
  divergent: boolean;
}

/** Nearest preceding out-of-zone ATX heading (or `start of file`) — the human
 *  anchor a census row names. */
function contextAnchor(lines: string[], claimed: boolean[], idx: number): string {
  for (let i = Math.min(idx, lines.length - 1); i >= 0; i--) {
    if (claimed[i]) continue;
    if (/^#{1,6}\s+/.test(lines[i]!.trim())) return lines[i]!.trim();
  }
  return 'start of file';
}

/**
 * D2 merge-time region census (design §4.1): out-of-zone line diff between the
 * project copy and the template side of one instruction file.
 *
 *   project-authored line-block (absent from the template) → EVOLVED_REGION
 *     (WARN — project adaptation preserved; port candidate, D4).
 *   template line-block absent from the project → TEMPLATE_AHEAD_REGION (WARN
 *     — template content the project never received, or a deliberate project
 *     deletion; Q1 default: WARN, never silently reverted, ERROR only when a
 *     write channel targets the span).
 *   identical out-of-zone content → ZERO rows (the §6 dry-run-parity
 *     guarantee: a fleet with no I3 divergence reports zero census rows).
 *
 * I1 zones and I2 marker sections are never diffed (I1 is engine-owned and
 * delivered as today; I2 is project state per Q2).
 */
export function censusInstructionRegions(
  rel: string,
  projectContent: string,
  templateContent: string,
): InstructionCensus {
  const projRegions = scanInstructionRegions(projectContent, rel);
  const tplRegions = scanInstructionRegions(templateContent, rel);

  const outOfZoneLines = (content: string, regions: InstructionRegion[]): Array<{ line: string; at: number }> => {
    const all = content.split('\n');
    const claimed = new Array<boolean>(all.length).fill(false);
    for (const r of regions) {
      if (r.kind === 'I3') continue;
      for (let i = r.start; i < r.end && i < all.length; i++) claimed[i] = true;
    }
    // Non-blank trimmed lines only: the census classifies CONTENT, and blank
    // placement differences would shrapnel the diff into noise hunks. `at`
    // keeps the ORIGINAL line index so census rows can name the nearest
    // preceding heading.
    const out: Array<{ line: string; at: number }> = [];
    for (let i = 0; i < all.length; i++) {
      if (claimed[i]) continue;
      const t = all[i]!.trim();
      if (t === '') continue;
      out.push({ line: t, at: i });
    }
    return out;
  };

  const proj = outOfZoneLines(projectContent, projRegions);
  const tpl = outOfZoneLines(templateContent, tplRegions);
  const projAll = projectContent.split('\n');
  const claimedFlags = new Array<boolean>(projAll.length).fill(false);
  for (const r of projRegions) {
    if (r.kind === 'I3') continue;
    for (let i = r.start; i < r.end && i < projAll.length; i++) claimedFlags[i] = true;
  }

  // LCS line diff (exact-match) over the out-of-zone sequences.
  const a = proj.map((p) => p.line);
  const b = tpl.map((p) => p.line);
  const n = a.length;
  const m = b.length;
  // DP table of LCS lengths (n+1) x (m+1) — instruction files are ≤ ~600
  // out-of-zone lines, so the flat Int32Array is bounded and cheap.
  const dp = new Int32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * (m + 1) + j] = a[i] === b[j]
        ? dp[(i + 1) * (m + 1) + j + 1]! + 1
        : Math.max(dp[(i + 1) * (m + 1) + j]!, dp[i * (m + 1) + j + 1]!);
    }
  }
  interface Hunk { kind: 'added' | 'removed'; lines: string[]; at: number; }
  const raw: Hunk[] = [];
  let syncLines = 0;
  {
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        syncLines++;
        i++;
        j++;
      } else if (dp[(i + 1) * (m + 1) + j]! >= dp[i * (m + 1) + j + 1]!) {
        raw.push({ kind: 'added', lines: [a[i]!], at: proj[i]!.at });
        i++;
      } else {
        raw.push({ kind: 'removed', lines: [b[j]!], at: proj[Math.min(i, n - 1)]?.at ?? 0 });
        j++;
      }
    }
    while (i < n) {
      raw.push({ kind: 'added', lines: [a[i]!], at: proj[i]!.at });
      i++;
    }
    while (j < m) {
      raw.push({ kind: 'removed', lines: [b[j]!], at: proj[Math.min(i, n - 1)]?.at ?? 0 });
      j++;
    }
  }
  // Merge hunks separated by fewer than 3 common lines (same kind merges;
  // opposite kinds stay adjacent rows) so a one-word edit does not shrapnel
  // into per-line rows.
  const hunks: Hunk[] = [];
  for (const h of raw) {
    const last = hunks[hunks.length - 1];
    if (last && last.kind === h.kind && h.at - last.at < 6) {
      last.lines.push(...h.lines);
    } else {
      hunks.push({ ...h, lines: [...h.lines] });
    }
  }

  if (hunks.length === 0) {
    return { rows: [], divergent: false };
  }

  const PORT_HINT = 'land it template-side inside a managed zone or skeleton-registry section per the adjudicated-port procedure (sync-overwrite-policy §6)';
  const rows: RegionCensusRow[] = [
    {
      verdict: 'REGION_IN_SYNC',
      severity: 'INFO',
      detail: `${syncLines} of ${n} out-of-zone lines byte-equal — in-sync regions carry no write channel; ${hunks.length} divergent block(s) below`,
    },
  ];
  for (const h of hunks) {
    const anchor = contextAnchor(projAll, claimedFlags, h.at);
    if (h.kind === 'added') {
      rows.push({
        verdict: 'EVOLVED_REGION',
        severity: 'WARN',
        detail: `project-authored line-block (${h.lines.length} line(s)) after '${anchor}' — preserved (WARN — port candidate: ${PORT_HINT})`,
      });
    } else {
      rows.push({
        verdict: 'TEMPLATE_AHEAD_REGION',
        severity: 'WARN',
        detail: `template line-block (${h.lines.length} line(s)) absent from the project copy after '${anchor}' — template content the project never received, or a deliberate project deletion (WARN — never silently reverted; ERROR only when a write channel targets the span)`,
      });
    }
  }
  return { rows, divergent: true };
}

/**
 * D2 write-channel predicate: true when `spanContent` carries at least one
 * non-blank OUT-OF-ZONE line the template side does not contain anywhere
 * (project-authored content — EVOLVED_REGION material). Lines inside managed
 * marker zones are engine-zone (I1) delivery — the merge replaces their
 * interiors anyway, so they are stripped before the check and never count as
 * adaptation evidence. A span whose remaining lines are all
 * template-vocabulary (an older template version of the same prose, zone
 * markers, whitespace) is NOT adapted and the write channel proceeds as
 * today.
 */
export function spanCarriesProjectAuthoredLines(spanContent: string, templateContent: string): boolean {
  const tplLines = new Set(templateContent.split('\n').map((l) => l.trim()).filter((l) => l !== ''));
  const lines = spanContent.split('\n');
  const claimed = new Array<boolean>(lines.length).fill(false);
  for (const span of zoneLineSpans(lines)) {
    for (let i = span.start; i < span.end && i < lines.length; i++) claimed[i] = true;
  }
  return lines.some((l, i) => !claimed[i] && l.trim() !== '' && !tplLines.has(l.trim()));
}

/** The gate shape handed to mergeManagedBlocks / mergeSkeletonSections (the
 *  two write channels that can reach an adapted out-of-zone span). */
export interface InstructionCensusGate {
  /** True when this file's census found out-of-zone divergence (the gate is
   *  closed entirely for in-sync files — their reconcile/replace behavior is
   *  unchanged). */
  divergent: boolean;
  /** True when the span carries project-authored content. */
  isSpanAdapted: (spanContent: string) => boolean;
  /** True when --disposition adopt-template[=glob] covers the path (the
   *  replace proceeds and re-baselines, ADOPT row recorded by the engine). */
  dispositionGranted: boolean;
}
