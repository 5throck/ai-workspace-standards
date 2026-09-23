#!/usr/bin/env bun
// @version 1.43.0
// v1.43.0 (2026-09-23, adopt-project engine prerequisites — spec
//          2026-09-23-adopt-project-conversion): two safety patches that external-project
//          adoption depends on. (1) VARIANT-SCOPE SKILL PRUNE now honors the
//          v1.17.1 safety: a skill declared in the project's variant.json
//          skill_manifest.variant_specific is kept (an adoption run seeds the manifest
//          precisely so foreign-domain skills survive the registry prune; previously
//          this pass had NO manifest check and silently `git rm`-ed adopted skills).
//          (2) .gitattributes moves out of the blind LOCKED overwrite into
//          mergeGitattributes() — merge-aware delivery on the mergeGitleaksToml
//          (v1.10.0) pattern: project-only attribute lines (GitLFS trackers, custom
//          merge drivers, the scaffold-time `docs/context.md merge=ours` rule) survive
//          the template overwrite instead of being silently stripped on every upgrade.
// @version 1.42.0
// v1.42.0 (2026-09-22, T-20260922-001 follow-up): W2 HARVEST in CONTEXT_COMMONIZATION —
//           lines UNIQUE to the variant copy inside a removed near-duplicate section are
//           now computed (trimmed non-empty line set difference vs the matched common
//           section) and reported as backport candidates ("W2 HARVEST — backport
//           candidates" block + summary count) instead of being silently deleted with
//           the section. Informational only — the removal itself is unchanged
//           (behavior-additive; design NG1/NG2 revised, see
//           docs/designs/2026-09-10-context-purification-design.md addendum).
// v1.41.0 (2026-09-21, T-20260922-001): SKILLS_REGISTRY_RECONCILE now ADDS rows for
//           newly delivered skills (previously skipped — T-007 contract-skill delivery
//           needed a manual backfill across 11 projects) via helpers/skills-registry.ts
//           (shape-based parser handling ## Registry, duplicated headings, and
//           category-sectioned formats; emitted cells always unquoted).
// v1.40.0 (2026-09-21, ticket batch T-20260921-007/010/016/019): (1) CONTRACT
//           common_skills bypass the frozen variant.json allowlist gate + loud
//           CONTRACT PARITY report (T-007); (2) CORE-SCRIPT FORK arm — a
//           version-bumped fork of dev-sync.ts/audit.ts is restored to canonical
//           instead of printing OK forever (T-010); (3) post-upgrade sync-skills
//           timeout 30s → 120s with explicit partial-sync warning (T-016).
// v1.39.0 (2026-09-21, ticket batch T-20260921-001/006): (1) pre-upgrade stash
//           skips gracefully on repos with no initial commit (fresh scaffolds
//           could not receive any upgrade); (2) country prune scrubs AGENTS.md
//           skill-path lines and variant context mentions of pruned k-* skills
//           — region-neutral scaffolds no longer fail their own audit.
// v1.38.0 (2026-09-21, rollout hardening — 2026-09-21-upgrade-project-rollout-
//           hardening-design): (1) SKILLS_REGISTRY_RECONCILE moved after ALL
//           skill-mutating passes — it previously ran before the skills delivery,
//           reconciling pre-delivery state and guaranteeing registry drift on
//           every version-changing delivery (co-game/co-architect rollout
//           failures). (2) Variant-skills pass gains equal-version CATCH-UP/DRIFT
//           via the shared catchUpDir helper (company-intelligence terms-ko.json
//           incident). (3) Apply-mode writes .claude/last-upgrade-delivery.json
//           recording the delivered diff so project /sync can auto-apply E5.
// v1.37.1 (2026-09-21): CATCH-UP DRIFT paths are normalized to POSIX separators
//           before printing, so Windows runs report `references/x.md` not
//           `references\x.md` (cross-platform log parity + test assertions).
// v1.37.0 (2026-09-21, skill sub-file sync): the common-skills SYNC_IF_NEWER
//           pass delivered only skills/<name>/SKILL.md, so skill sub-files
//           (references/, assets/, examples/) never reached existing projects —
//           the 2026-09-20 handbook v0.6.0 fleet upgrade shipped SKILL.md while
//           KOREAN_LANGUAGE.md and the localized copy-code.js stayed absent
//           fleet-wide (8 emergency re-delivery PRs on 2026-09-21). NEW/UPDATE
//           now copy the whole skill directory via cpSync (template files
//           overwrite same-named files, project-only files are preserved), and
//           equal-version skills get additive catch-up: missing files are
//           delivered, same-version content differences are warned as DRIFT and
//           left untouched. Variant-skills copySkillDir is now recursive so
//           depth ≥ 3 files (references/validation/*) are delivered too.
// v1.36.0 (2026-09-20, E2E refinements to T-20260920-003): retired-mirror sweep
//           hardened — a project-authored skills/<name>/ SSOT (co-newbiz: 100+
//           standalone-track skills) now preserves its mirrors, and only names
//           with an explicit retirement marker (root lifecycle record retired/
//           deprecated, or mirror SKILL.md status) are pruned; project-authored
//           orphans without a retirement decision are kept for human review.
// v1.35.0 (2026-09-20, T-20260920-001/-002/-003): three hardening changes —
//           (1) DEPENDENCY GUARD pass: scan delivered scripts' bare-package
//           imports against project package.json and report missing packages
//           (report-only, lib/dependency-guard.ts; pm-md-parser/js-yaml fleet
//           incident). (2) agents/ SYNC_IF_NEWER gains equal-version content-
//           drift reconciliation mirroring the scripts pass v1.17.2 rule
//           (lifecycle-stripped comparison — T-20260920-002 i18n-specialist).
//           (3) --prune-removed: skills/ category consults L0 root skills/ as
//           upstream, and platform mirror dirs (.claude/.gemini/.agents/.codex
//           skills) whose name has no upstream source are pruned as retired-
//           skill residue (T-20260920-003 validate-docs-links class).
// v1.34.0: --platform 'both' renamed to 'all' and expanded to cover all three
//          platforms (claude+antigravity+codex, not just the first two) —
//          added the missing `codex` value and a CODEX.md MERGE branch that
//          new-project.ts already had but this script never picked up.
// v1.33.0: ADR-0081 fleet sweep / T-20260919-003 — COMMON-CONTEXT block splice
//          under CONTEXT PRESERVE. When the wholesale docs/context.md copy is
//          skipped (project-only top-level sections) the template's
//          COMMON-CONTEXT managed block is now spliced into the preserved copy
//          (spliceCommonContextBlock, helpers/context-sections.ts v1.5.0), so
//          managed-zone policy content (e.g. the ADR-0080 authority section)
//          delivers without --force-context-sync. Project-only sections and
//          everything outside the managed block stay untouched. Dry-run logs
//          the splice without writing.
// v1.32.0: T-20260917-010 — pre-reconcile recovery snapshots. When the merge
//          lib reports replaced unlabeled span(s) (result.snapshots), the
//          wrapper writes them to `<target>.pre-reconcile.bak` BEFORE the
//          merged content lands and logs the SNAPSHOT line; a snapshot write
//          failure aborts fail-closed before that file's destructive
//          reconcile. Dry-run never writes. Design:
//          docs/designs/2026-09-17-governance-backlog-batch-design.md.
// v1.31.0: T-20260916-012 — managed-block merge extraction + keyed-block
//          destruction fix (design docs/designs/2026-09-16-managed-block-merge-fix-design.md):
//          the merge core moved to the new pure lib/managed-block-merge.ts
//          (mergeManagedBlocks; this file keeps only fs concerns) because
//          mergeWorkspaceManaged's unlabeled-blocks reconciliation phase had
//          two compounding defects: (1) projOccurrences counted ALL pattern
//          matches — keyed WORKSPACE-MANAGED/VARIANT-INJECT blocks included —
//          against a template count of UNLABELED blocks only, so a project
//          file whose only managed blocks were keyed (real case: co-develop
//          .gitignore / AGENTS.md, 2026-09-16) hit the count-mismatch branch
//          and the reconcile replaced the first-to-last span with an EMPTY
//          join — deleting the .gitignore secrets block (.env/*.pem; caught
//          only because the upgrade's own security gate failed) and AGENTS.md's
//          43-line graft block; (2) reconcile/positional offsets were captured
//          BEFORE the keyed replacements mutated the content, so legitimate
//          reconciles sliced stale positions. The lib tracks keyed and
//          unlabeled project occurrences separately, slices unlabeled spans
//          only, and re-scans unlabeled occurrences AFTER the keyed phase
//          (fresh offsets); zero-unlabeled-template reconciles still remove
//          stale unlabeled project blocks by design but can never touch keyed
//          blocks. All log lines unchanged (verbatim from the lib); COMMON-*
//          zones are key-less and byte-identical in behavior.
// v1.30.0: T-20260916-006 — upgrade-target realpath guard (H14, design
//          docs/designs/2026-09-16-upgrade-target-realpath-guard-design.md):
//          the target is canonicalized with fs.realpathSync AFTER the existsSync
//          pre-check (so the not-found error keeps firing first, unchanged, on
//          the lexical form), workspaceRoot and Projects/ are canonicalized once
//          at resolution time, and the root guard + containment check compare
//          canonical forms only — a symlink resolving to the workspace root now
//          hits the unchanged hard-fail root guard instead of slipping past
//          lexical comparison into the symlink-following existsSync/git checks.
//          The outside-Projects WARN gains a fail-closed confirm-prompt
//          (default N, precedent-style 'Proceed? [y/N]' from the
//          template-version.txt flow): it names the canonical target, fires for
//          dry-run too, and EOF/non-y answers abort with exit 1 (policy refusal,
//          not the optional-prompt exit 0); --yes stays the single scripted
//          consent token. No new flags.
// v1.29.0: T-20260916-010 — post-upgrade docs/VERSION_MANIFEST.md regeneration
//          (mirrors the skill-graph regeneration): the upgrade refreshed
//          agents/skills/scripts, so the project manifest is stale until the
//          next /sync — regenerate now via the project's own
//          scripts/generate-version-manifest.ts (cwd = projectDir, non-fatal
//          warn-and-continue). Also retires the stub-manifest class: variant
//          templates no longer ship docs/VERSION_MANIFEST.md and the file
//          joined lib/upgrade-policy.ts REGENERATED_FILES (never
//          template-delivered), so a project still carrying an old stub gets
//          a full generated manifest on its next upgrade instead.
// v1.28.0: Conflict-semantics + snapshot-honesty set (2026-09-15 project review,
//          docs/reports/2026-09-15-project-review-template-fleet.md). C2/H1: the
//          pre-upgrade stash now includes untracked files (git stash push -u) and
//          the locally-modified set is snapshotted BEFORE the stash runs, so
//          --dry-run's CONFLICT verdicts match apply instead of being silently
//          downgraded to UPDATE once the tree is stashed clean. M4: a failed
//          stash is a hard error (exit 1) — it previously masqueraded as "working
//          tree clean", leaving the upgrade without rollback coverage. H3:
//          --rollback exits 1 when the restore fails and is a no-op plan under
//          --dry-run. H2: --prune-removed falls back to a direct delete when
//          `git rm` fails on untracked files (sibling VARIANT-SCOPE SKILL PRUNE
//          pattern) and no longer counts failed prunes. M1: the script exits 1
//          when the security summary is FAILED instead of always exiting 0.
// v1.27.0: Root-target guard — a <project-path> that resolves to the workspace ROOT is
//           rejected with an error, and targets outside Projects/ print a warning. The
//           root passes both pre-flight guards (existsSync, git-repo check), and the
//           2026-09-12 root-upgrade incident (memory/2026-09-12.md) delivered the whole
//           template/L1 tree into the repo root through exactly this hole.
// v1.26.0: MANAGED_PATTERNS gains COMMON-CONTEXT (START/END) so the DOCS_MERGE
//           pass merges the common coding-guidelines zone in docs/<variant>.context.md
//           into project copies — previously projects had no delivery channel for
//           that zone (only scaffold-time copies carried it, and inconsistently).
// v1.25.0: docs/context.md project-only preservation in the TEMPLATE TREE SYNC SYNC branch —
//           a footer-bump overwrite used to clobber PROJECT-ONLY content with at most a
//           warning-only CONFLICT (and no warning at all when the copy was git-clean, which
//           every fleet project is). The SYNC branch now runs findProjectOnlySections()
//           (helpers/context-sections.ts v1.3.0) on the destination vs the incoming template:
//           project-only top-level sections (headings absent from the template, outside
//           COMMON-*/VARIANT-INJECT managed zones) or a missing version footer
//           (wholeFileOwned — fully restructured file) trigger CONTEXT PRESERVE — the copy
//           is SKIPPED with a loud per-section log — unless --force-context-sync is given,
//           in which case the overwrite proceeds and logs the discarded section count.
//           Files without project-only content keep the exact UPDATE/CONFLICT behavior;
//           dry-run produces the identical PRESERVE verdict.
// v1.24.0: graft fleet surface (ADR-0076, upgrade-policy v1.2.0) — the TEMPLATE TREE SYNC
//           pass gains an ADD_IF_MISSING branch (seed-only, PROCEDURES semantics) so
//           .codex/config.toml seeds into projects without one while co-abap/co-safety's
//           project-owned Codex config is never touched. .mcp.json/opencode.json now
//           JSON_MERGE via the existing branch; .claude/skills/graft delivers via the
//           pass's SYNC policy (hand-maintained skill, outside sync-skills' SSOT).
// v1.23.1: mainline fixes (#894 design-gate seed delivery, #895 country provenance
//           fallback) integrated in this merge.
// v1.23.0: New ENV_SAMPLE SYNC pass — .env.sample is no longer PRESERVE. Scaffold-time
//           country pruning (prune-country-scoped-assets.ts) strips country-scoped env
//           blocks from the project copy, so a wholesale template re-copy would re-inject
//           them; the pass instead delivers the template content through the shared
//           lib/env-sample.ts with the project's detected country applied (region-neutral
//           = all blocks stripped), so template env-key additions reach existing projects
//           without resurrecting pruned country profiles. Delivery is a MERGE, not an
//           overwrite (the mergeGitleaksToml lesson, v1.10.0 — Projects/co-price carries 16
//           project-only keys): template re-delivered lines drop the project's byte-equal
//           boilerplate and supersede same-NAME keys (placeholder normalization), while
//           project-only keys, their section dividers, inline notes, and commented-out
//           documentation keys are preserved verbatim under a marker section. Idempotent;
//           standard conflict warning on locally-modified copies; --dry-run parity.
// v1.22.1: Data-loss fix in --prune-removed — the skills prune category consulted only
//           templates/common/skills, so variant-owned skills delivered by the VARIANT SKILLS
//           pass (e.g. co-abap's sap-*) were marked prunable for projects without a
//           variant.json manifest. The category now also accepts the variant template's
//           skills/ directory as a template source (identity-separated projects unaffected —
//           the missing dir is filtered out).
// v1.22.0: Folded VARIANT_DOCS_SYNC into the TEMPLATE TREE SYNC pass (Phase C of
//           2026-09-11-upgrade-policy-coverage-design.md) — the 5 hardcoded files are claimed
//           by the default SYNC policy with identical inline-version/hash/conflict semantics,
//           removing the last duplicated hardcoded docs list. No behavior change; the files
//           now report under "TEMPLATE TREE SYNC" and treeChanged instead of syncChanged.
// v1.21.0: New TEMPLATE TREE SYNC pass (2026-09-11-upgrade-policy-coverage-design.md) — upgrade
//           coverage used to be enumeration, so template files with no claiming pass were
//           silently never delivered to existing projects (most of the variant docs tree —
//           user-guide, handoff-spec, VERSION_MANIFEST, skill-graph.overrides.json, variant
//           domain docs, countries/KR.md — plus .github/, .claude|gemini/settings.json,
//           .editorconfig, skills.json). Classification moved to scripts/lib/upgrade-policy.ts
//           with the fallback policy SYNC (deliver by default): this pass delivers every file
//           whose claim names it — add-if-missing, then inline-version/hash update with the
//           standard conflict warning; WORKSPACE seeds (docs/designs, docs/lifecycle, …) are
//           add-if-missing only; platform settings.json are deep-merged with project-only
//           array entries preserved. GOVERNANCE_FILES gains SECURITY.md. New companion
//           scripts/check-upgrade-coverage.ts reports (and can gate) the classification matrix.
// v1.20.0: New CONTEXT_COMMONIZATION pass (after VARIANT_DOCS_SYNC) — near-duplicate
//           sections of docs/<variant>.context.md are pruned once the refreshed
//           docs/context.md supersedes them: token-overlap >= 0.65 → REMOVE (logged),
//           >= 0.30 → REVIEW (manual Context Commonization Review, ADR-0050 Part 3 —
//           never auto-removed), below → silent. COMMON-*/VARIANT-INJECT zones and the
//           version footer are excluded; sections containing managed-zone content are
//           never auto-removed. Honors --dry-run; opt-out via
//           --skip-context-commonization. Comparison reads the template source so
//           dry-run verdicts match apply. Thresholds tuned on the real fleet
//           (docs/designs/2026-09-10-context-purification-design.md D2).
// v1.19.2: --prune-removed preserves project-declared variant-owned agents/skills
//           from variant.json in common-only sync mode (identity-separated forks
//           such as co-architect have no templates/<variant>/ source directory).
// v1.19.0: Registry-row reconciliation fixes in reconcileScriptRegistry() — (1) fall back to the
//           templates/common/scripts/SCRIPTS.md registry when the L0 row misses (scripts shipped
//           from common under variant-prefixed upstream names, e.g. the handbook/ suite, were
//           silently never registered — verify-scripts "Unregistered script" ×26 on
//           co-abap-plugin/co-architect/co-price during the 2026-09-06 fleet resync); (2) rewrite
//           an appended row's layer cell from L0/L0-only → L3, since layer-L0 rows are skipped by
//           verify-scripts at project context while the file ships on disk (upgrade-project.ts
//           itself hit this); (3) drop stale duplicate rows for the same script during version
//           update instead of first-match-only replace (lifecycle-sync-audit Check A failures on
//           co-export dispatch* rows); (4) the row version written is the delivered template
//           file's own @version (L0's row can be newer than the L1 snapshot — writing L0's
//           number tripped lifecycle-sync-audit Check A).
// v1.19.1: VARIANT_DOCS_SYNC gains the co-develop privacy-design-checklist pair (EN+KO) —
//           generalized template-grade residue of the harness-assessment privacy ADRs.
// v1.17.0: Identity-separated fork support — a project whose variant.json self-declares a variant
//           with no templates/<variant>/ dir (e.g. co-architect from co-work) is accepted in
//           "common-only" sync mode: templates/common + project-owned files only, no readiness
//           gate against a nonexistent variant template, variant-template passes no-op.
// v1.17.2: Equal-version content-drift reconciliation — SYNC_IF_NEWER scripts pass now hashes
//           same-version files and restores the canonical L1 copy when content differs (drifted
//           local forks were invisible to version-gated sync forever).
// v1.17.1: Country-prune safety — a skill the project variant.json registers in
//           skill_manifest.variant_specific is kept (with a KEEP notice) even when the detected
//           country doesn't match its scope; manifest adoption beats country inference.
// v1.16.0: New project asset allowlist gate — SYNC_IF_NEWER add-if-missing of common skills/agents now
//           consults the project variant.json (skill_manifest.allowlist / agents[].file) and SKIPS
//           unregistered NEW assets instead of injecting them (0.6.0 i18n wave tripped audit-variant
//           allowlist/parity checks in 3 projects). Existing-file updates stay ungated; variant-skills
//           pass is exempt (variant template is the authority); projects without variant.json ungated.
// v1.15.0: New PROCEDURES SYNC pass — add-if-missing delivery of the variant workflow corpus (ADR-0063); legacy projects scaffolded before the procedures wave receive procedures/ entries with project-owned preservation.
// v1.13.0: New VARIANT-SCOPE SKILL PRUNE pass — a skill present in
//           templates/common/skills/ AND in exactly one templates/co-*/skills/ is a
//           variant-exclusive skill mistakenly duplicated into common; removed from
//           projects whose variant is not the owner (skills/ SSOT + platform mirrors).
//           Closes the sound-synth leak class (docs/designs/2026-08-28-skill-hygiene-
//           and-conventions-design.md).
// v1.12.0: New GOVERNANCE FILES SYNC pass — add-if-missing delivery of top-level
//           governance files (LICENSE) that fell through every other pass (the
//           LOCKED/MERGE/DOCS/SYNC passes are path-specific and VARIANT ASSET DIRS
//           SYNC only discovers directories). Source: variant template, then
//           templates/common. Strictly add-if-missing: an existing project file is
//           always preserved (licenses are intentionally forkable — co-price's
//           commercial appendix, co-safety's filled-in copyright line).
// v1.11.0: New VARIANT ASSET DIRS SYNC pass — generically discovers and hash-syncs any
//           top-level variant template directory not already covered by the existing
//           agents/skills/scripts/docs passes (e.g. co-safety's workflows/, regulations/,
//           evidence-models/, industry-profiles/). Previously such directories had no
//           upgrade path at all: a project scaffolded before the directory existed in the
//           template (or missing it from a promotion gap) never received it, and template
//           updates to that content never reached existing projects. New/changed files are
//           copied; project-only files are left alone (no deletion — that stays a manual or
//           future --prune-removed extension).
// v1.10.1: Country-profile awareness (ADR-0057/0058) on the UPGRADE path — previously
//           only the scaffold path (new-project.ts / create-l3-scaffold.ts) knew about
//           country-scoped assets, so:
//           (1) the skills/ SYNC_IF_NEWER pass re-injected k-dart/k-law/k-kosis into
//               region-neutral projects on every upgrade, undoing scaffold-time pruning
//               (prune-country-scoped-assets.ts). A registry-driven prune pass now runs
//               after ALL skill-copy passes, with an isLocallyModified() conflict guard
//               so a project that intentionally forked a scoped skill keeps its fork.
//           (2) the post-upgrade template-version.txt rewrite dropped the country= line,
//               erasing the project's country provenance; it is now preserved (or
//               country=none written, matching the region-neutral default posture).
// v1.10.0: Two gaps found while upgrading 7 real projects in one session:
//   (1) .gitleaks.toml moved out of blind LOCKED overwrite into mergeGitleaksToml() —
//         co-abap's project-specific allowlist entries (vendored-ABAP false-positive
//         exclusion, SAP trial default-credential regex) were silently dropped by the
//         old LOCKED behavior, breaking the pre-push secret scan on the next push.
//   (2) SYNC_IF_NEWER: scripts/ now calls reconcileScriptRegistry() after every copy —
//         previously file CONTENT was synced by version but the project's own
//         scripts/SCRIPTS.md registry was never updated, so verify-scripts.ts/
//         lifecycle-sync-audit.ts failed after every single upgrade (stale version
//         numbers on existing rows, "Unregistered script" for newly-added files) and
//         required manual reconciliation every time.
// upgrade-project.ts — Upgrade an existing project to the current template version
// Usage: bun scripts/upgrade-project.ts <project-path> [--variant <variant>] [--platform claude|antigravity|codex|all] [--dry-run] [--prune-removed] [--rollback] [--yes] [--skip-context-commonization] [--force-context-sync]
// v1.9.0: Moved docs/context.md from DOCS_MERGE (managed-block merge) to VARIANT_DOCS_SYNC
//           (version-footer sync) — the common template carries no managed-block markers,
//           so the merge path was a silent no-op despite the file's *context.md version: X.Y*
//           footer existing specifically for this comparison. VARIANT_DOCS_SYNC's src resolution
//           generalized from a variant-dir-only join() to resolveTemplate() (variant, then common)
//           to support docs/context.md's common-only SSOT.
// v1.3.0: Added multi-pattern managed block support (WORKSPACE-MANAGED, COMMON-CLAUDE, COMMON-GEMINI);
//           removed stale agent MERGE references and CONSTITUTION.md
// v1.6.0: Added --prune-removed, --rollback, conflict detection for SYNC files, auto-discovery for script subdirs
// v1.7.0: Added DOCS_MERGE (variant/common docs), VARIANT_DOCS_SYNC, COMMANDS_SYNC;
//           extended managed block markers (VARIANT-INJECT, COMMON-AGENTS, DYNAMIC_SKILLS);
//           added sync-skills.ts post-invoke for platform skill distribution
// v1.8.0: extractScriptVersion now falls back to JSDoc `* @version` headers (files like
//           security-validator.ts were silently never synced); added variant scripts/skills
//           sync (templates/<variant>/scripts/<variant>/ and skills/<variant>/ → project);
//           agent overwrites preserve the project's local `lifecycle:` frontmatter block.
// v1.8.1: fix(mergeWorkspaceManaged): match managed blocks positionally (template's Nth
//           occurrence of a marker <-> project's Nth occurrence) instead of blindly
//           replacing every occurrence with each template block in turn — the latter
//           clobbered all N blocks with the last-processed block's content whenever a
//           single marker type (e.g. COMMON-CLAUDE) wraps multiple distinct sections.
//
// Migrated from upgrade-project.sh/ps1 per ADR-0036. No file permission manipulation.

import {
  existsSync, mkdirSync, copyFileSync, cpSync, readFileSync, writeFileSync,
  readdirSync, statSync, rmSync, realpathSync,
} from 'node:fs';
import { resolve, join, dirname, basename, isAbsolute, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { extractScriptVersion, preserveLifecycleFrontmatter } from './helpers/upgrade-versions.ts';
import { reconcileSkillRegistry } from './helpers/skills-registry.ts';
import {
  splitIntoSections,
  splitContextFileSections,
  splitOffVersionFooter,
  stripVersionFooter,
  findProjectOnlySections,
  spliceCommonContextBlock,
  classifyCommonizationSection,
  getContentLines,
  W2_REMOVE_THRESHOLD,
  W2_REVIEW_FLOOR,
} from './helpers/context-sections.ts';
import {
  TEMPLATE_TREE_SYNC_PASS,
  iterEffectiveTemplateFiles,
  lifecyclelessText,
  mergeSettingsJson,
  resolveClaim,
} from './lib/upgrade-policy.ts';
import { missingDependencies, scanDeliveredScripts } from './lib/dependency-guard.ts';
import { mergeEnvSample, pruneCountryScopedEnvBlocks } from './lib/env-sample.ts';
import {
  buildMergedTemplateBlocks,
  mergeManagedBlocks,
} from './lib/managed-block-merge.ts';

// ── Argument parsing ───────────────────────────────────────────────────────────
let projectPath = '';
let variant = '';
let platform = 'all';
let dryRun = false;
let pruneRemoved = false;
let rollback = false;
let yesFlag = false;
let skipContextCommonization = false;
let forceContextSync = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variant' && args[i + 1]) { variant = args[++i]; continue; }
  if (args[i] === '--platform' && args[i + 1]) { platform = args[++i]; continue; }
  if (args[i] === '--dry-run') { dryRun = true; continue; }
  if (args[i] === '--prune-removed') { pruneRemoved = true; continue; }
  if (args[i] === '--rollback') { rollback = true; continue; }
  if (args[i] === '--yes' || args[i] === '-y') { yesFlag = true; continue; }
  if (args[i] === '--skip-context-commonization') { skipContextCommonization = true; continue; }
  if (args[i] === '--force-context-sync') { forceContextSync = true; continue; }
  if (!projectPath && !args[i].startsWith('--')) { projectPath = args[i]; continue; }
}

if (!projectPath) {
  console.error('Usage: bun scripts/upgrade-project.ts <project-path> [--variant <variant>] [--platform claude|antigravity|codex|all] [--dry-run] [--prune-removed] [--rollback] [--yes] [--skip-context-commonization] [--force-context-sync]');
  if (import.meta.main) {
    process.exit(1);
  }
}
if (!['claude', 'antigravity', 'codex', 'all'].includes(platform)) {
  console.error('ERROR: --platform must be one of: claude, antigravity, codex, all');
  if (import.meta.main) {
    process.exit(1);
  }
}

// ── Resolve paths ──────────────────────────────────────────────────────────────
// Canonical root (H14, design 2026-09-16-upgrade-target-realpath-guard):
// canonicalized ONCE here so every guard and every downstream join compares or
// operates on the real path, not a lexical form that a symlinked checkout could
// diverge from.
const workspaceRoot = realpathSync(resolve(import.meta.dir, '..'));
const projectDirLexical = isAbsolute(projectPath) ? projectPath : resolve(projectPath);

// Existence pre-check BEFORE canonicalization: fs.realpathSync throws ENOENT on
// missing paths, and the not-found error must keep firing first, unchanged,
// naming the path the user typed (lexical form — kept only for this message).
if (!existsSync(projectDirLexical)) {
  console.error(`ERROR: Project directory not found: ${projectDirLexical}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

// Canonicalize the target: path.resolve is purely lexical — it does not follow
// symlinks, so a symlink named Projects/link pointing at the workspace root used
// to compare unequal under the root guard and slip through to the
// symlink-following existsSync/git checks. All guards below compare canonical
// forms only.
let projectDir = projectDirLexical;
try {
  projectDir = realpathSync(projectDirLexical);
} catch (err) {
  // existsSync just passed, so this is extraordinary (race, permissions) —
  // fail closed rather than guard on a half-resolved path.
  console.error(`ERROR: Could not resolve the real path of the target: ${projectDirLexical} (${(err as Error).message})`);
  if (import.meta.main) {
    process.exit(1);
  }
}

// Root-target guard (incident 2026-09-12): the workspace root is L0, not a project.
// It passes the existsSync and git-repo checks below, so reject it before any
// delivery step runs; a run against the root copies the whole template/L1 tree
// into the repo root. Canonical equality: a symlink resolving to the root hits
// this guard too. Hard-fail, no bypass flag.
if (projectDir === workspaceRoot) {
  console.error('ERROR: Refusing to target the workspace ROOT — root is L0, not a project (incident 2026-09-12). Pass a project directory under Projects/ instead.');
  if (import.meta.main) {
    process.exit(1);
  }
}
const projectsRoot = (() => {
  const lexical = join(workspaceRoot, 'Projects');
  try {
    return realpathSync(lexical);
  } catch {
    // Projects/ is gitignored and absent on a fresh checkout — nothing to
    // canonicalize; any existing target then correctly classifies as outside.
    return lexical;
  }
})();
if (relative(projectsRoot, projectDir).startsWith('..')) {
  console.warn(`WARN: Target is outside ${projectsRoot} — the canonical project layout is Projects/<name>.`);
  // H14: a warning the run continues past is invisible in scripts — that was the
  // 2026-09-12 incident class. Fail-closed confirm (design §4.2), reusing the
  // template-version.txt prompt precedent: EOF/closed stdin yields null → abort;
  // any non-y answer aborts; --yes is the single scripted consent token; the
  // prompt names the CANONICAL target and fires for dry-run too. Exit 1 on
  // refusal (policy refusal, deliberately not the precedent's exit 0).
  if (import.meta.main && !yesFlag) {
    const answer = prompt(`    Proceed with upgrade into ${projectDir}? [y/N] `);
    if (answer === null || !['y', 'Y'].includes(answer)) {
      console.error('ERROR: Outside-Projects target refused — explicit confirmation required (re-run with --yes for scripted consent).');
      process.exit(1);
    }
  }
}

// Validate git repo
const gitCheck = spawnSync('git', ['-C', projectDir, 'rev-parse', '--git-dir'], { encoding: 'utf8' });
if (gitCheck.status !== 0) {
  console.error(`ERROR: Not a git repository: ${projectDir}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

// ── Version resolution ─────────────────────────────────────────────────────────
const versionFile = join(workspaceRoot, 'templates', 'VERSION');
const currentVersion = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : 'unknown';

const templateVersionFile = join(projectDir, '.claude', 'template-version.txt');
let detectedVersion = 'unknown';
let detectedVariant = '';
// Country provenance (ADR-0057/0058): scaffold-time country= line is the primary
// signal; docs/countries/ACTIVE.md (written by new-project.ts when a country was
// selected) is the fallback for projects whose template-version.txt predates
// country tracking — including projects upgraded by upgrade-project.ts < v1.10.1,
// which rewrote the file WITHOUT the country= line.
let countryFromVersionFile = '';

if (existsSync(templateVersionFile)) {
  const tvContent = readFileSync(templateVersionFile, 'utf8');
  detectedVariant = (tvContent.match(/^variant=(.*)$/m)?.[1] ?? '').trim();
  detectedVersion = (tvContent.match(/^version=(.*)$/m)?.[1] ?? 'unknown').trim();
  countryFromVersionFile = (tvContent.match(/^country=(.*)$/m)?.[1] ?? '').trim();
} else {
  console.log('\nWARNING: template-version.txt not found in this project.');
  console.log('    This project may have been created before version tracking was introduced.');
  console.log(`    Treating as: unknown -> current (${currentVersion})\n`);
  if (import.meta.main && !yesFlag) {
    const answer = prompt('    Proceed? [y/N] ') ?? '';
    if (!['y', 'Y'].includes(answer)) { console.log('Aborted.'); process.exit(0); }
  }
}

if (!variant) {
  if (detectedVariant) {
    variant = detectedVariant;
    console.log(`Auto-detected variant: ${variant}`);
  } else {
    console.error('ERROR: Could not detect variant from template-version.txt. Specify --variant explicitly.');
    if (import.meta.main) {
      process.exit(1);
    }
  }
}

// ── Country detection (ADR-0057/0058) ─────────────────────────────────────────
// Resolve the project's target country before any skill-copy pass runs, so the
// post-copy prune (below) can undo country-scoped skill re-injection. Precedence:
//   1. template-version.txt `country=` line (written by new-project.ts; may be
//      'none' for region-neutral projects — an explicit value is authoritative)
//   2. docs/countries/ACTIVE.md "Active jurisdiction: <CODE>" pointer (legacy
//      projects scaffolded with a country before the country= line existed)
//   2.5 variant.json country_config (single supported country or explicit default) —
//      v1.23.1: a scaffold-era country=none must not mute a project that declares
//      its jurisdiction in variant.json (co-safety class, found 2026-09-12)
//   3. 'none' (region-neutral default posture)
let detectedCountry = 'none';
if (countryFromVersionFile && (countryFromVersionFile === 'none' || /^[A-Z]{2,4}$/.test(countryFromVersionFile))) {
  detectedCountry = countryFromVersionFile;
} else {
  const activeMdPath = join(projectDir, 'docs', 'countries', 'ACTIVE.md');
  if (existsSync(activeMdPath)) {
    const activeContent = readFileSync(activeMdPath, 'utf8');
    // new-project.ts format: "Active jurisdiction: KR — Republic of Korea. See docs/countries/KR.md. ..."
    const activeMatch = activeContent.match(/^Active jurisdiction:\s*([A-Z]{2,4})\b/m);
    if (activeMatch) detectedCountry = activeMatch[1];
  }
}
if (detectedCountry === 'none') {
  // v1.23.1 fallback: infer from the project's own country_config declaration.
  try {
    const vJson = JSON.parse(readFileSync(join(projectDir, 'variant.json'), 'utf8')) as Record<string, any>;
    const cc = (vJson?.country_config ?? {}) as { supported?: unknown[]; default?: unknown };
    const supported = Array.isArray(cc.supported)
      ? (cc.supported as unknown[]).filter((x): x is string => typeof x === 'string' && /^[A-Z]{2,4}$/.test(x))
      : [];
    if (supported.length === 1) detectedCountry = supported[0];
    else if (typeof cc.default === 'string' && /^[A-Z]{2,4}$/.test(cc.default)) detectedCountry = cc.default;
  } catch { /* variant.json absent or invalid — stay region-neutral */ }
}
console.log(`Country profile: ${detectedCountry === 'none' ? 'region-neutral' : detectedCountry}`);

// Validate variant. A project whose variant.json declares itself as a variant
// with no template directory (identity-separated fork, e.g. co-architect from
// co-work) is accepted in "common-only" mode: it syncs from templates/common
// and its own files, and never from a variant template it did not come from.
const validVariants = existsSync(join(workspaceRoot, 'templates'))
  ? readdirSync(join(workspaceRoot, 'templates')).filter(d => d.startsWith('co-')).sort()
  : [];
let commonOnlySync = false;
if (!validVariants.includes(variant)) {
  const selfDeclared = (() => {
    try {
      const vj = JSON.parse(readFileSync(join(projectDir, 'variant.json'), 'utf8'));
      return vj?.name === variant;
    } catch { return false; }
  })();
  if (selfDeclared) {
    commonOnlySync = true;
    console.log(`NOTE: variant '${variant}' has no templates/<variant>/ directory — ` +
      `project self-declares this identity (variant.json name), so this upgrade syncs from ` +
      `templates/common + project-owned files only (variant-template passes will no-op).`);
  } else {
    console.error(`ERROR: Invalid variant: ${variant}`);
    console.error(`   Valid variants: ${validVariants.join(' ')}`);
    if (import.meta.main) {
      process.exit(1);
    }
  }
}

// Variant Readiness Gate (pre-flight): refuse to upgrade against a template
// variant that is not READY (broken agent/skill manifest paths, missing
// PROMOTION_CHECKLIST.md, missing README/AGENTS.md, inconsistent country_config).
const gateScript = join(workspaceRoot, 'scripts', 'validate-variant-readiness.ts');
if (existsSync(gateScript) && import.meta.main && !commonOnlySync) {
  console.log(`\nRunning Variant Readiness Gate for template variant '${variant}'...`);
  const gateResult = spawnSync(process.execPath, [gateScript, '--variant', variant], { encoding: 'utf8' });
  if (gateResult.status !== 0) {
    console.error(`\nERROR: Template variant '${variant}' failed the Variant Readiness Gate.`);
    console.error('   A project may only be upgraded against a READY variant.');
    console.error(`   Run: bun scripts/validate-variant-readiness.ts --variant ${variant}`);
    process.exit(1);
  } else {
    console.log(`✅ Template variant '${variant}' passed the Variant Readiness Gate.`);
  }
}

const templatesDir = join(workspaceRoot, 'templates', variant);
const commonDir = join(workspaceRoot, 'templates', 'common');

if (import.meta.main) {
  if (!commonOnlySync && !existsSync(templatesDir)) { console.error(`ERROR: Template variant not found: ${templatesDir}`); process.exit(1); }
}
if (import.meta.main) {
  if (!existsSync(commonDir)) { console.error(`ERROR: Common templates directory not found: ${commonDir}`); process.exit(1); }
}

// ── Script version comparison ──────────────────────────────────────────────────
const scriptsSnapshot = join(projectDir, 'scripts-snapshot.json');
const scriptsMd = join(workspaceRoot, 'scripts', 'SCRIPTS.md');
if (existsSync(scriptsSnapshot) && existsSync(scriptsMd)) {
  console.log('\n--- Script version comparison (L2 snapshot vs L1 current) ---');
  try {
    const snapshot = JSON.parse(readFileSync(scriptsSnapshot, 'utf8'));
    const l2Scripts: Record<string, { version: string }> = snapshot.scripts || {};
    console.log(`  Snapshot created: ${snapshot.created ?? 'unknown'}  (${Object.keys(l2Scripts).length} scripts)`);

    const mdContent = readFileSync(scriptsMd, 'utf8');
    const registryMatch = mdContent.match(/## Registry\n.*?\n\|[-| ]+\|\n([\s\S]*?)(?=\n##|\Z)/);
    const l1Scripts: Record<string, { version: string; status: string }> = {};
    if (registryMatch) {
      for (const line of registryMatch[1].trim().split('\n')) {
        const parts = line.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 4 && /^\d+\.\d+\.\d+$/.test(parts[2])) {
          l1Scripts[parts[0].replace(/`/g, '')] = { version: parts[2], status: parts[3] };
        }
      }
    }

    const outdated: [string, string, string][] = [];
    const deprecated: [string, string][] = [];
    for (const [name, l2Info] of Object.entries(l2Scripts)) {
      const l1Info = l1Scripts[name];
      if (!l1Info) continue;
      if (l2Info.version !== l1Info.version) outdated.push([name, l2Info.version, l1Info.version]);
      if (l1Info.status === 'deprecated') deprecated.push([name, l1Info.version]);
    }

    if (!outdated.length && !deprecated.length) {
      console.log('  ✅ All scripts up-to-date with L1 SCRIPTS.md');
    } else {
      if (outdated.length) { console.log(`  ⚠️  ${outdated.length} script(s) have newer versions:`); outdated.forEach(([n, o, nv]) => console.log(`     ${n.padEnd(40)} ${o} → ${nv}`)); }
      if (deprecated.length) { console.log(`  ⚠️  ${deprecated.length} script(s) deprecated in L1:`); deprecated.forEach(([n, v]) => console.log(`     ${n.padEnd(40)} ${v}  (deprecated)`)); }
    }
    console.log('');
  } catch (e) { console.log(`  WARN: Could not parse scripts-snapshot.json: ${(e as Error).message}`); }
}

// ── Header ─────────────────────────────────────────────────────────────────────
const dryTag = dryRun ? '[DRY RUN] ' : '';
console.log('\n========================================================');
console.log(`  ${dryRun ? '[DRY RUN] ' : ''}upgrade-project.ts`);
console.log(`  Project : ${projectDir}`);
console.log(`  Variant : ${variant}`);
console.log(`  Platform: ${platform}`);
console.log(`  From    : ${detectedVersion}`);
console.log(`  To      : ${currentVersion}`);
console.log('========================================================\n');

// ── Pre-upgrade snapshot ───────────────────────────────────────────────────────

// G12: --rollback convenience flag
if (rollback) {
  if (dryRun) {
    console.log('--- [DRY RUN] --rollback would restore the latest pre-upgrade stash. No changes made.');
    if (import.meta.main) process.exit(0);
  }
  console.log('--- Rolling back last upgrade ---');
  const stashList = spawnSync('git', ['-C', projectDir, 'stash', 'list'], { encoding: 'utf8' });
  const preUpgradeStash = stashList.stdout.split('\n').find(l => l.includes('pre-upgrade-snapshot'));
  if (preUpgradeStash) {
    const stashIdx = preUpgradeStash.match(/^stash@\{(\d+)\}/)?.[1] ?? '0';
    const pop = spawnSync('git', ['-C', projectDir, 'stash', 'pop', `stash@{${stashIdx}}`], { encoding: 'utf8' });
    if (pop.status === 0) {
      console.log('✅ Pre-upgrade stash restored successfully.');
    } else {
      console.error(`ERROR: Failed to restore stash: ${pop.stderr}`);
      // A failed rollback must not read as success (2026-09-15 project review H3).
      if (import.meta.main) process.exit(1);
    }
  } else {
    console.log('INFO: No pre-upgrade stash found. Nothing to rollback.');
  }
  if (import.meta.main) process.exit(0);
}

// H1 (2026-09-15 project review): capture the locally-modified set BEFORE any
// stash runs. Apply mode stashes the tree, so consulting live git status from
// the CONFLICT branches afterwards made every dry-run CONFLICT verdict
// silently become UPDATE on the run that matters. Both modes now judge
// against the same pre-upgrade snapshot of the tree.
const preUpgradeDirty = new Set<string>();
{
  const st = spawnSync('git', ['-C', projectDir, 'status', '--porcelain'], { encoding: 'utf8' });
  for (const line of (st.stdout || '').split('\n')) {
    const entry = line.trim();
    if (!entry) continue;
    const dirtyPath = entry.slice(3).trim().replace(/^"|"$/g, '');
    if (dirtyPath) preUpgradeDirty.add(dirtyPath);
  }
}

if (!dryRun) {
  console.log('--- Creating pre-upgrade git stash snapshot (tracked + untracked) ---');
  // v1.39.0 (T-20260921-001): fresh scaffolds have no initial commit — stash
  // would fail and abort the whole upgrade. Skip the snapshot gracefully; the
  // project tree is the scaffold state, rollback equals re-scaffolding.
  const hasHead = spawnSync('git', ['-C', projectDir, 'rev-parse', '--verify', '-q', 'HEAD'], { encoding: 'utf8' }).status === 0;
  if (!hasHead) {
    console.log('  INFO: no commits yet (fresh scaffold) — pre-upgrade stash skipped.');
  }
  const snapDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  // C2 (2026-09-15 project review): without -u, untracked files were absent
  // from the snapshot while CONFLICT branches still told the operator "the
  // pre-upgrade stash covers rollback" — an untracked CONFLICT file was
  // overwritten with no copy anywhere.
  const stash = hasHead ? spawnSync('git', ['-C', projectDir, 'stash', 'push', '-u', '-m', `pre-upgrade-snapshot-${snapDate}`], { encoding: 'utf8' }) : { status: 0, stdout: 'No local changes', stderr: '' };
  if (stash.status !== 0) {
    // M4: a failed stash is NOT a clean tree — rollback coverage would be
    // silently absent. Fail loudly instead of proceeding unprotected.
    console.error(`ERROR: pre-upgrade stash failed (exit ${stash.status}): ${stash.stderr || stash.stdout}`);
    if (import.meta.main) process.exit(1);
  } else if (stash.stdout.includes('No local changes')) {
    console.log('INFO: Nothing to stash (working tree clean) — snapshot skipped.');
  } else {
    console.log('Snapshot saved. To revert: git stash pop or --rollback');
  }
  console.log('');
}

// ── Version utilities ─────────────────────────────────────────────────────────
function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

// extractScriptVersion / preserveLifecycleFrontmatter are imported from
// ./helpers/upgrade-versions.ts (testable pure helpers).

function extractFrontmatterVersion(filePath: string): string {
  if (!existsSync(filePath)) return '';
  const content = readFileSync(filePath, 'utf8');
  return content.match(/^version:\s*["']?(\d+\.\d+\.\d+)/m)?.[1] ?? '';
}

/**
 * Parse SKILL.md frontmatter to extract version and last_reviewed.
 */
function extractFrontmatterVersionAndReviewed(filePath: string): {
  version: string;
  last_reviewed: string;
  status?: string;
  owner?: string;
} {
  if (!existsSync(filePath)) return { version: '', last_reviewed: '' };
  const content = readFileSync(filePath, 'utf8');
  const versionMatch = content.match(/^version:\s*["']?(\d+\.\d+\.\d+)/m);
  const reviewedMatch = content.match(/^last_reviewed:\s*["']?(\d{4}-\d{2}-\d{2})/m);
  const statusMatch = content.match(/^status:\s*["']?([A-Za-z_-]+)/m);
  const ownerMatch = content.match(/^owner:\s*["']?([^"'\n]+)/m);
  return {
    version: versionMatch?.[1] ?? '',
    last_reviewed: reviewedMatch?.[1] ?? '',
    status: statusMatch?.[1],
    owner: ownerMatch?.[1]?.trim(),
  };
}


function fileHash(filePath: string): string {
  if (!existsSync(filePath)) return '';
  return createHash('md5').update(readFileSync(filePath)).digest('hex');
}

/**
 * Reconcile the project's local scripts/SCRIPTS.md registry after SYNC_IF_NEWER
 * copies an updated (or brand-new) script file into the project.
 *
 * Previously this script synced FILE CONTENT by version comparison but never touched
 * the project's own SCRIPTS.md — every upgrade left `verify-scripts.ts`/`lifecycle-sync-
 * audit.ts` failing on stale version numbers (existing rows) or "Unregistered script"
 * (new files like a newly-added helper), requiring manual reconciliation every time.
 * The L0 (workspace root) registry is the version source of truth: if a row for this
 * script already exists in the project registry, only its version column is replaced,
 * preserving every project-specific column (layer label conventions differ project to
 * project — e.g. "L0+L1" vs "common" — this must never silently normalize those). If no
 * row exists yet, the L0 registry's row is copied in verbatim (same shape, since the
 * project's registry format is itself derived from L0) and appended after the last
 * script row in the table.
 */
function reconcileScriptRegistry(scriptRelPath: string): void {
  const registryPath = join(projectDir, 'scripts', 'SCRIPTS.md');
  if (!existsSync(registryPath)) return;
  // Registry rows key scripts by path relative to scripts/ (no "scripts/" prefix).
  const name = scriptRelPath.replace(/^scripts\//, '');
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rowLookupRe = new RegExp(`^\\| \`${escaped}\` \\| [^|]*\\| ([^|]+) \\|.*\\r?$`, 'm');

  // Row source: L0 (workspace root) registry first, then the L1 common-template
  // registry. Scripts delivered from templates/common but registered upstream
  // under a variant-prefixed name (e.g. `co-deck/handbook/check-links.ts` at L0
  // vs plain `handbook/check-links.ts` in the project) only match the common
  // registry, so the fallback is what makes the handbook/ suite reconcile.
  let sourceRow: string | null = null;
  let sourceVersion = '';
  for (const registryFile of [scriptsMd, join(commonDir, 'scripts', 'SCRIPTS.md')]) {
    if (!existsSync(registryFile)) continue;
    const match = readFileSync(registryFile, 'utf8').match(rowLookupRe);
    if (match) {
      sourceRow = match[0];
      sourceVersion = match[1].trim();
      break;
    }
  }
  if (!sourceRow) return; // not in any upstream registry (e.g. a variant-local script) — nothing to reconcile

  // Prefer the version of the file actually being delivered (the resolved
  // template copy) over the registry-lookup version: L0's row can be newer
  // than the L1 snapshot the project receives, and writing L0's number would
  // trip lifecycle-sync-audit Check A (@version vs registry row).
  const tplFile = resolveTemplate(scriptRelPath);
  const fileVersion = (tplFile && existsSync(tplFile)) ? extractScriptVersion(tplFile) : '';
  const targetVersion = fileVersion || sourceVersion;

  const content = readFileSync(registryPath, 'utf8');
  // Consume the trailing newline on removal matches so dropped duplicate rows
  // don't leave blank lines inside the markdown table.
  const rowRe = new RegExp(`^\\| \`${escaped}\` \\| [^|]*\\| ([^|]+) \\|.*\\r?(?:\\n|$)`, 'gm');
  let seen = 0;
  let removed = 0;
  const deduped = content.replace(rowRe, (matched, ver) => {
    seen++;
    if (seen > 1) { removed++; return ''; }
    // Replace the version cell textually. Deliberately NOT a `$1`-template
    // replacement string: under Bun/JSC a `$<digit>` sequence in the
    // replacement is resolved against capture groups (or emitted literally
    // when out of range), so `$1` + `1.19.0` corrupted rows into `$11.19.0…`.
    return matched.replace(`| ${ver.trim()} |`, `| ${targetVersion} |`);
  });
  if (seen > 0) {
    if (deduped !== content) {
      writeFileSync(registryPath, deduped, 'utf8');
      console.log(`    📝 scripts/SCRIPTS.md: ${name} → v${targetVersion}${removed > 0 ? ` (removed ${removed} stale duplicate row(s))` : ''}`);
    }
    return;
  }

  // No row at all — append the upstream row after the last `| \`*.ts\` |` row
  // INSIDE the registry table (stop at the first `#### \`` detail-section header,
  // whose flag tables also contain `| \`*.ts\` |`-shaped rows).
  // Rows marked layer `L0`/`L0-only` are invisible to verify-scripts at project
  // context (L0_ONLY_LAYERS skip) while the file itself ships on disk, which
  // reads as "Unregistered script" — rewrite the layer cell to `L3` on append.
  const appendedRow = sourceRow.replace(
    /^(\| `[^`]+` \| [^|]*\| [^|]*\| [^|]*\| [^|]*\| [^|]*\| )([^|]+)(\|)/,
    (_m, head, layer, tail) => /^L0(-only)?$/.test(layer.trim()) ? `${head}L3${tail}` : _m,
  );
  const lines = content.split('\n');
  let lastRowIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^####\s+`/.test(lines[i])) break;
    if (/^\|\s*`[^`]+\.ts`\s*\|/.test(lines[i])) lastRowIdx = i;
  }
  if (lastRowIdx >= 0) {
    lines.splice(lastRowIdx + 1, 0, appendedRow);
    writeFileSync(registryPath, lines.join('\n'), 'utf8');
    console.log(`    📝 scripts/SCRIPTS.md: registered ${name} (v${targetVersion})`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveTemplate(rel: string): string {
  const vf = join(templatesDir, rel);
  const cf = join(commonDir, rel);
  if (existsSync(vf)) return vf;
  if (existsSync(cf)) return cf;
  return '';
}

function diffSummary(old: string, src: string): void {
  if (!existsSync(old)) { console.log('    (project file does not exist — will create)'); return; }
  const oldArr = readFileSync(old, 'utf8').split('\n');
  const newArr = readFileSync(src, 'utf8').split('\n');
  const { added, removed } = lineDiffCounts(oldArr, newArr);
  console.log(`    Lines: ${oldArr.length} -> ${newArr.length}  (+${added}/-${removed})`);
}

// LCS-based line diff counts — cross-platform (no external `diff` dependency,
// which is absent on Windows PATH and previously crashed with null stdout).
function lineDiffCounts(a: string[], b: string[]): { added: number; removed: number } {
  const n = a.length, m = b.length;
  // dp[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const lcs = dp[0][0];
  return { removed: n - lcs, added: m - lcs };
}

/** Managed-block merge (WORKSPACE-MANAGED / COMMON-* / VARIANT-INJECT /
 *  DYNAMIC_SKILLS zones): marker patterns, keyed+positional merge semantics,
 *  and the merge core live in scripts/lib/managed-block-merge.ts (T-20260916-012
 *  extraction). This wrapper keeps only the filesystem concerns: template and
 *  common file loading, the not-yet-created project copy path, and writing the
 *  merged content back in apply mode. All log lines come verbatim from the lib. */
function mergeWorkspaceManaged(projectFile: string, templateFile: string, rel: string): void {
  const tplContent = readFileSync(templateFile, 'utf8');
  let commonContent: string | null = null;

  // For per-key union: load common blocks if variant is being used, so we can merge them.
  // (variant may be an extends-only file that shadows the marker-rich common version).
  if (templateFile.startsWith(templatesDir)) {
    const commonFile = join(commonDir, rel);
    if (existsSync(commonFile)) {
      commonContent = readFileSync(commonFile, 'utf8');
    }
  }

  const mergedTplBlocks = buildMergedTemplateBlocks(tplContent, commonContent);
  if (mergedTplBlocks.length === 0) {
    console.log(`    INFO: Template has no managed markers — skipping ${rel}`);
    return;
  }

  if (!existsSync(projectFile)) {
    console.log('    INFO: Project file does not exist, will create with template content');
    if (!dryRun) {
      mkdirSync(dirname(projectFile), { recursive: true });
      copyFileSync(templateFile, projectFile);
    }
    console.log(`    ${dryTag}CREATED: ${rel}`);
    return;
  }

  const projContent = readFileSync(projectFile, 'utf8');
  const result = mergeManagedBlocks(projContent, tplContent, commonContent, rel, dryRun);
  for (const line of result.log) console.log(line);
  if (!dryRun && result.merged) {
    // T-20260917-010: persist the replaced span(s) BEFORE the merged content
    // lands — a recovery copy that cannot be written means the destructive
    // unlabeled reconcile must not proceed (fail-closed abort; files merged
    // earlier in this run stay merged, matching error-time behavior elsewhere
    // in the run — the rollback pass remains the recovery path).
    for (const snap of result.snapshots) {
      const bakPath = `${projectFile}.pre-reconcile.bak`;
      try {
        writeFileSync(bakPath, snap.content, 'utf8');
      } catch (err) {
        throw new Error(`[upgrade-project] cannot write the recovery snapshot ${bakPath} — aborting before the destructive unlabeled reconcile of ${rel} (${(err as Error).message})`);
      }
      console.log(`    SNAPSHOT: replaced unlabeled span(s) of ${rel} saved to ${rel}.pre-reconcile.bak (overwritten per run; gitignored via *.bak)`);
    }
    writeFileSync(projectFile, result.content, 'utf8');
  }
}

/** Check if a project file had local modifications at upgrade start (H1: judged
 *  against the pre-upgrade dirty snapshot, NOT live git status — apply mode
 *  stashes the tree, which would otherwise erase the CONFLICT verdicts the
 *  operator reviewed in --dry-run). */
function isLocallyModified(filePath: string): boolean {
  const rel = relative(projectDir, filePath).replace(/\\/g, '/');
  return preUpgradeDirty.has(rel);
}

let lockedChanged = 0, mergeChanged = 0, preserveListed = 0, syncChanged = 0;
let treeChanged = 0;
let w2HarvestLines = 0; // v1.42.0 — variant-only lines found inside W2-removed sections

/**
 * Extract every `'''...'''` (or `'...'`) string literal from a named TOML array
 * (e.g. `regexes = [ ... ]` or `paths = [ ... ]`), by array name. Comment-only lines
 * are stripped first — explanatory comments routinely contain apostrophes (e.g. "AI
 * session notes" or "they're"), which a naive single-quote match mistakes for the
 * start of a string literal and misparses everything after it.
 */
function extractGitleaksArray(content: string, arrayName: string): string[] {
  const blockMatch = content.match(new RegExp(`${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\n\\]`));
  if (!blockMatch) return [];
  const codeOnly = blockMatch[1]
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))
    .join('\n');
  const entries: string[] = [];
  for (const m of codeOnly.matchAll(/'''([^']*)'''|'([^']*)'/g)) {
    entries.push(m[1] ?? m[2]);
  }
  return entries;
}

/**
 * .gitleaks.toml is shared boilerplate but routinely carries project-specific allowlist
 * entries (e.g. co-abap's exclusion for vendored ABAP source that trips generic-api-key
 * false positives) — a plain LOCKED overwrite silently deletes those, and the next
 * `git push` fails the pre-push secret scan on findings that were already known-safe.
 * Preserve any project-only `regexes`/`paths` entries by appending them into the new
 * template content before writing, rather than dropping them.
 */
function mergeGitleaksToml(dest: string, src: string): void {
  if (!existsSync(dest)) {
    if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
    console.log(`  ${dryTag}WROTE: .gitleaks.toml (new)`);
    return;
  }
  const destContent = readFileSync(dest, 'utf8');
  const srcContent = readFileSync(src, 'utf8');
  const srcRegexes = new Set(extractGitleaksArray(srcContent, 'regexes'));
  const srcPaths = new Set(extractGitleaksArray(srcContent, 'paths'));
  const projectOnlyRegexes = extractGitleaksArray(destContent, 'regexes').filter(e => !srcRegexes.has(e));
  const projectOnlyPaths = extractGitleaksArray(destContent, 'paths').filter(e => !srcPaths.has(e));

  let merged = srcContent;
  if (projectOnlyRegexes.length > 0) {
    merged = merged.replace(
      /(regexes\s*=\s*\[[\s\S]*?)(\n\])/,
      `$1\n  # Preserved from this project's prior .gitleaks.toml (not in the current common template):\n` +
        projectOnlyRegexes.map(e => `  '''${e}''',`).join('\n') + `$2`
    );
    console.log(`  ⚠️  Preserved ${projectOnlyRegexes.length} project-specific regex allowlist entr${projectOnlyRegexes.length === 1 ? 'y' : 'ies'} that the template overwrite would have dropped`);
  }
  if (projectOnlyPaths.length > 0) {
    merged = merged.replace(
      /(paths\s*=\s*\[[\s\S]*?)(\n\])/,
      `$1\n  # Preserved from this project's prior .gitleaks.toml (not in the current common template):\n` +
        projectOnlyPaths.map(e => `  '''${e}''',`).join('\n') + `$2`
    );
    console.log(`  ⚠️  Preserved ${projectOnlyPaths.length} project-specific path exclusion${projectOnlyPaths.length === 1 ? '' : 's'} that the template overwrite would have dropped`);
  }
  diffSummary(dest, src);
  if (!dryRun) writeFileSync(dest, merged, 'utf8');
  console.log(`  ${dryTag}WROTE: .gitleaks.toml`);
}

/**
 * .gitattributes is shared boilerplate but routinely carries project-specific attribute
 * lines (GitLFS trackers, custom merge drivers, project-added eol pins — and the
 * scaffold-time `docs/context.md merge=ours` rule, which the template itself does not
 * ship) — a plain LOCKED overwrite silently deletes those, and LFS-tracked files then
 * round-trip as pointer blobs. Same lesson as mergeGitleaksToml (v1.10.0): preserve any
 * project-only non-comment attribute lines by appending them into the template content
 * before writing, rather than dropping them.
 */
function mergeGitattributes(dest: string, src: string): void {
  if (!existsSync(dest)) {
    if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
    console.log(`  ${dryTag}WROTE: .gitattributes (new)`);
    return;
  }
  const destContent = readFileSync(dest, 'utf8');
  const srcContent = readFileSync(src, 'utf8');
  const srcLines = new Set(srcContent.split('\n').map(l => l.trim()).filter(Boolean));
  const projectOnly = destContent.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !srcLines.has(l));
  if (projectOnly.length === 0) {
    diffSummary(dest, src);
    if (!dryRun) copyFileSync(src, dest);
    console.log(`  ${dryTag}WROTE: .gitattributes`);
    return;
  }
  const merged = srcContent.trimEnd() + '\n\n' +
    '# Preserved from this project\'s prior .gitattributes (not in the current template):\n' +
    projectOnly.join('\n') + '\n';
  diffSummary(dest, src);
  if (!dryRun) writeFileSync(dest, merged, 'utf8');
  console.log(`  ⚠️  Preserved ${projectOnly.length} project-specific attribute line${projectOnly.length === 1 ? '' : 's'} that the template overwrite would have dropped`);
  console.log(`  ${dryTag}WROTE: .gitattributes`);
}

// ── LOCKED files ───────────────────────────────────────────────────────────────
console.log('--- LOCKED files (always overwrite) ---');
const LOCKED_FILES = [
  '.githooks/pre-commit', '.githooks/pre-push', '.githooks/commit-msg',
  '.githooks/post-checkout', '.githooks/pre-rebase',
];
for (const rel of LOCKED_FILES) {
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) { console.log(`  SKIP (no template): ${rel}`); continue; }
  console.log(`  LOCKED: ${rel}`);
  diffSummary(dest, src);
  if (!dryRun) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
  console.log(`  ${dryTag}WROTE: ${rel}`);
  lockedChanged++;
}
// .gitleaks.toml: same "always take the template" intent as LOCKED, but merge-aware —
// see mergeGitleaksToml() for why a blind overwrite is unsafe for this specific file.
{
  const rel = '.gitleaks.toml';
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) {
    console.log(`  SKIP (no template): ${rel}`);
  } else {
    console.log(`  LOCKED (merge-aware): ${rel}`);
    mergeGitleaksToml(dest, src);
    lockedChanged++;
  }
}
// .gitattributes: moved out of blind LOCKED overwrite (v1.43.0) — same merge-aware
// treatment, for the same reason (see mergeGitattributes()).
{
  const rel = '.gitattributes';
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) {
    console.log(`  SKIP (no template): ${rel}`);
  } else {
    console.log(`  LOCKED (merge-aware): ${rel}`);
    mergeGitattributes(dest, src);
    lockedChanged++;
  }
}
console.log('');

// ── MERGE files ────────────────────────────────────────────────────────────────
console.log('--- MERGE files (WORKSPACE-MANAGED sections) ---');
const MERGE_FILES: string[] = [];
if (platform === 'claude' || platform === 'all') MERGE_FILES.push('CLAUDE.md');
if (platform === 'antigravity' || platform === 'all') MERGE_FILES.push('GEMINI.md');
if (platform === 'codex' || platform === 'all') MERGE_FILES.push('CODEX.md');
MERGE_FILES.push(
  '.gitignore', 'agents/pm.md',
);
for (const rel of MERGE_FILES) {
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) { console.log(`  SKIP (no template): ${rel}`); continue; }
  console.log(`  MERGE: ${rel}`);
  mergeWorkspaceManaged(dest, src, rel);
  mergeChanged++;
}
console.log('');

// ── Inline version parsing utility ──────────────────────────────────────────────
function extractInlineVersion(filePath: string): string {
  if (!existsSync(filePath)) return '';
  const content = readFileSync(filePath, 'utf8');
  const fname = basename(filePath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content.match(new RegExp(`\\*${fname}\\s+version:\\s*(\\d+\\.\\d+)`, 'm'))?.[1] ?? '';
}

function parseInlineVersion(ver: string): [number, number] {
  const parts = ver.split('.').map(Number);
  return [(parts[0] ?? 0), (parts[1] ?? 0)];
}

function inlineVersionGt(a: string, b: string): boolean {
  const [amajor, aminor] = parseInlineVersion(a);
  const [bmajor, bminor] = parseInlineVersion(b);
  return amajor > bmajor || (amajor === bmajor && aminor > bminor);
}

// ── DOCS_MERGE: common/variant docs with managed blocks ───────────────────────
console.log('--- DOCS_MERGE: common and variant docs (managed blocks) ---');
const DOCS_MERGE_FILES: string[] = [
  'AGENTS.md',
];
// Auto-discover variant-specific context file
const variantContextRel = `docs/${variant}.context.md`;
if (existsSync(join(templatesDir, variantContextRel)) || existsSync(join(commonDir, 'docs', `${variant}.context.md`))) {
  DOCS_MERGE_FILES.push(variantContextRel);
}
// Common docs without managed blocks → plain overwrite
const DOCS_OVERWRITE_FILES: string[] = [
  'docs/phase-definitions.md',
];

for (const rel of DOCS_MERGE_FILES) {
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) { console.log(`  SKIP (no template): ${rel}`); continue; }
  console.log(`  MERGE: ${rel}`);
  mergeWorkspaceManaged(dest, src, rel);
  mergeChanged++;
}
for (const rel of DOCS_OVERWRITE_FILES) {
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) { console.log(`  SKIP (no template): ${rel}`); continue; }
  if (!existsSync(dest)) {
    console.log(`  NEW    ${rel}`);
  } else {
    diffSummary(dest, src);
  }
  if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
  console.log(`  ${dryTag}WROTE: ${rel}`);
  mergeChanged++;
}
console.log('');

// ── (v1.22.0) VARIANT_DOCS_SYNC folded into TEMPLATE TREE SYNC ────────────────
// The former dedicated pass (docs/context.md, engagement-orchestration.md,
// team-configuration-guide.md, privacy-design-checklist(+_ko)) is fully reproduced by the
// TEMPLATE TREE SYNC pass's default SYNC policy — same inline-version/hash semantics, same
// conflict warning, same variant-over-common resolution (docs/context.md's SSOT stays
// templates/common per WS-07; the walk already takes it from common since variants never
// carry it). Classification lives in scripts/lib/upgrade-policy.ts; re-adding a dedicated
// pass for these paths would reopen the drift-duplication class the policy engine removed.
console.log('');

// ── CONTEXT_COMMONIZATION: variant-context boilerplate prune (v1.20.0) ─────────
// docs/designs/2026-09-10-context-purification-design.md D2. After the TEMPLATE TREE SYNC pass
// refreshes docs/context.md, near-duplicate sections in docs/<variant>.context.md
// become redundant. For each top-level section (COMMON-* zones, VARIANT-INJECT
// blocks, and the version footer excluded), token-overlap similarity vs the common
// template decides: >= W2_REMOVE_THRESHOLD → REMOVE; >= W2_REVIEW_FLOOR → REVIEW
// (manual Context Commonization Review per ADR-0050 Part 3 — NEVER auto-removed);
// below → untouched, silent. Comparison reads the TEMPLATE source so --dry-run
// sees the same verdicts the apply run would produce.
console.log('--- CONTEXT_COMMONIZATION: variant context commonization (boilerplate prune) ---');
if (skipContextCommonization) {
  console.log('  SKIP   (--skip-context-commonization)');
} else {
  const variantContextPath = join(projectDir, 'docs', `${variant}.context.md`);
  const commonContextSrc = resolveTemplate('docs/context.md');
  if (!existsSync(variantContextPath)) {
    console.log(`  SKIP   (no variant context file): docs/${variant}.context.md`);
  } else if (!commonContextSrc) {
    console.log('  SKIP   (no common docs/context.md template)');
  } else {
    const commonSections = splitIntoSections(stripVersionFooter(readFileSync(commonContextSrc, 'utf8')));
    const originalContent = readFileSync(variantContextPath, 'utf8');
    const { body: originalBody, footer: originalFooter } = splitOffVersionFooter(originalContent);
    const originalLines = originalBody.split('\n');
    const sections = splitContextFileSections(originalBody, { includeVariantInject: true });

    // Collect removal ranges (original line coordinates). Sections whose body
    // contains managed-zone content are never auto-removed — deleting them would
    // eat engine-managed blocks; they downgrade to REVIEW.
    const removalRanges: Array<{ start: number; end: number; heading: string; similarity: number; matched: string | null }> = [];
    // v1.42.0 (T-20260922-001 follow-up): W2 HARVEST — variant-only lines inside
    // sections the pass removes. Set difference on trimmed non-empty lines vs the
    // matched common section; reported as backport candidates instead of being
    // silently deleted. Informational only — the removal still happens.
    const harvest: Array<{ heading: string; matched: string | null; lines: string[] }> = [];
    for (const { section, headingInManagedZone, bodyContainedManagedZone, startLine, endLineExclusive } of sections) {
      if (headingInManagedZone) continue;
      const verdict = classifyCommonizationSection(section, commonSections, {
        removeThreshold: W2_REMOVE_THRESHOLD,
        reviewFloor: W2_REVIEW_FLOOR,
      });
      if (verdict.verdict === 'remove') {
        if (bodyContainedManagedZone) {
          console.log(`  REVIEW (manual commonization): ${section.heading} (overlap ${verdict.maxSimilarity.toFixed(2)} — kept: section contains managed COMMON-*/VARIANT-INJECT content)`);
        } else {
          removalRanges.push({ start: startLine, end: endLineExclusive, heading: section.heading, similarity: verdict.maxSimilarity, matched: verdict.matchedCommonHeading });
          const matchedCommon = commonSections.find(s => s.heading === verdict.matchedCommonHeading);
          const commonLineSet = matchedCommon ? getContentLines(matchedCommon.body) : new Set<string>();
          const variantOnly = [...getContentLines(section.body)].filter(l => !commonLineSet.has(l));
          if (variantOnly.length > 0) harvest.push({ heading: section.heading, matched: verdict.matchedCommonHeading, lines: variantOnly });
        }
      } else if (verdict.verdict === 'review') {
        console.log(`  REVIEW (manual commonization): ${section.heading} (overlap ${verdict.maxSimilarity.toFixed(2)})`);
      }
      // verdict 'keep': below report floor — untouched, silent
    }

    if (removalRanges.length === 0) {
      console.log('  OK     no near-duplicate sections to remove');
    } else {
      // Splice removal ranges out, then restore blank-line hygiene (collapse any
      // 2+ consecutive blank lines left behind down to one).
      const removed = new Set<number>();
      for (const range of removalRanges) {
        for (let i = range.start; i < range.end; i++) removed.add(i);
        console.log(`  ${dryTag}REMOVE docs/${variant}.context.md ## ${range.heading} (overlap ${range.similarity.toFixed(2)} vs common ## ${range.matched})`);
      }
      const keptLines = originalLines.filter((_, i) => !removed.has(i))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n');
      const cleaned = keptLines.join('\n').replace(/^\n+|\n+$/g, '');
      let mergedContent = cleaned + originalFooter;
      // preserve EOF newline hygiene so the write doesn't churn the final line
      if (originalContent.endsWith('\n') && !mergedContent.endsWith('\n')) mergedContent += '\n';
      if (!dryRun) writeFileSync(variantContextPath, mergedContent);
      console.log(`  ${dryTag}WROTE: docs/${variant}.context.md (commonization)`);
      syncChanged++;
    }

    // v1.42.0 W2 HARVEST report — informational, never blocks the removal.
    if (harvest.length > 0) {
      console.log('');
      console.log('  W2 HARVEST — backport candidates (variant-only lines inside removed sections):');
      for (const h of harvest) {
        console.log(`    HARVEST docs/${variant}.context.md ## ${h.heading} — ${h.lines.length} line(s) not in common ## ${h.matched}`);
        for (const sample of h.lines.slice(0, 3)) console.log(`      - ${sample}`);
        if (h.lines.length > 3) console.log(`      … and ${h.lines.length - 3} more`);
        w2HarvestLines += h.lines.length;
      }
      console.log('    Genuinely unique lines belong back in the common template or a variant context file — review manually (no auto-migration, design NG1/NG2).');
    }
  }
}
console.log('');

// ── COMMANDS_SYNC: platform command files (.claude/commands, .gemini/commands) ──
console.log('--- COMMANDS_SYNC: platform commands (hash-based) ---');
const COMMANDS_DIRS: string[] = [];
if (platform === 'claude' || platform === 'all') COMMANDS_DIRS.push('.claude/commands');
if (platform === 'antigravity' || platform === 'all') COMMANDS_DIRS.push('.gemini/commands');

for (const cmdDir of COMMANDS_DIRS) {
  // Check variant template first, then common
  const tplCmdDir = existsSync(join(templatesDir, cmdDir)) ? join(templatesDir, cmdDir) : join(commonDir, cmdDir);
  if (!existsSync(tplCmdDir)) { console.log(`  SKIP (no template): ${cmdDir}/`); continue; }
  for (const fname of readdirSync(tplCmdDir)) {
    if (!fname.endsWith('.md')) continue;
    const rel = `${cmdDir}/${fname}`;
    const src = join(tplCmdDir, fname);
    const dest = join(projectDir, rel);
    if (!existsSync(dest)) {
      console.log(`  NEW    ${rel}`);
      if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else {
      const tplHash = fileHash(src);
      const projHash = fileHash(dest);
      if (tplHash !== projHash) {
        diffSummary(dest, src);
        if (!dryRun) copyFileSync(src, dest);
        console.log(`  ${dryTag}COPIED: ${rel}`);
        syncChanged++;
      } else {
        console.log(`  OK     ${rel}`);
      }
    }
  }
}
console.log('');

// ── PRESERVE files ─────────────────────────────────────────────────────────────
console.log('--- PRESERVE files (listed only, not modified) ---');
const PRESERVE_FILES = ['README.md', 'README_ko.md'];
for (const rel of PRESERVE_FILES) {
  if (existsSync(join(projectDir, rel))) { console.log(`  PRESERVE: ${rel}`); preserveListed++; }
}
if (existsSync(join(projectDir, 'src'))) { console.log('  PRESERVE: src/ (directory — not touched)'); preserveListed++; }
console.log('');

// ── SKILLS.md schema migration (layer column removal) ─────────────────────────
console.log('--- SKILLS.md schema migration (layer column removal) ---');
const skillsMdPath = join(projectDir, 'skills', 'SKILLS.md');
if (existsSync(skillsMdPath)) {
  const skillsMdContent = readFileSync(skillsMdPath, 'utf8');
  const lines = skillsMdContent.split('\n');

  // Find ## Registry section and locate its header row
  const registryLineIdx = lines.findIndex(l => l.trim() === '## Registry');
  if (registryLineIdx !== -1) {
    // Find first | row after ## Registry (the header)
    let headerIdx = -1;
    for (let i = registryLineIdx + 1; i < lines.length; i++) {
      if (lines[i].trimStart().startsWith('|')) { headerIdx = i; break; }
    }

    if (headerIdx !== -1) {
      const headerCells = lines[headerIdx].split('|').map(c => c.trim());
      // headerCells[0] === '', headerCells[1..n-1] are column names, headerCells[n] === ''
      const layerColIndex = headerCells.findIndex((c, i) => i > 0 && c.toLowerCase() === 'layer');

      if (layerColIndex !== -1) {
        // Remove layer column from every | row in the Registry section (until next ## or EOF)
        const newLines = [...lines];
        for (let i = headerIdx; i < newLines.length; i++) {
          if (i > headerIdx && newLines[i].trim().startsWith('##')) break;
          if (!newLines[i].trimStart().startsWith('|')) continue;
          const cells = newLines[i].split('|');
          // cells[0] = '' (before first |), cells[layerColIndex] = the layer cell, cells[last] = ''
          cells.splice(layerColIndex, 1);
          newLines[i] = cells.join('|');
        }

        // Inject comment before ## Registry heading
        const comment = '<!-- propagation controlled via SKILL.md l2_propagate/scope -->';
        newLines.splice(registryLineIdx, 0, comment);

        const newContent = newLines.join('\n');
        if (!dryRun) {
          writeFileSync(skillsMdPath, newContent, 'utf8');
        }
        console.log(`  ${dryTag}MIGRATED: skills/SKILLS.md — removed stale 'layer' column`);
      } else {
        console.log("  INFO: skills/SKILLS.md — no 'layer' column found (already migrated)");
      }
    } else {
      console.log("  INFO: skills/SKILLS.md — ## Registry section has no table header");
    }
  } else {
    console.log("  INFO: skills/SKILLS.md — no ## Registry section found");
  }
} else {
  console.log("  INFO: skills/SKILLS.md not found — skipping migration");
}
console.log('');



// ── SYNC_IF_NEWER: scripts/ ───────────────────────────────────────────────────
console.log('--- SYNC_IF_NEWER: scripts/ ---');

// T-20260921-010: the two AGENTS.md-locked core scripts. A project-side fork with
// a bumped @version used to fall through every restore branch into a silent OK.
const CORE_LOCKED_SCRIPTS = ['scripts/dev-sync.ts', 'scripts/audit.ts'];

// G11: Auto-discover script subdirectories from template instead of hardcoding.
const tplScriptsRoot = join(commonDir, 'scripts');
const scriptSubDirs = [''];  // root scripts/ always included
if (existsSync(tplScriptsRoot)) {
  for (const entry of readdirSync(tplScriptsRoot)) {
    const fullPath = join(tplScriptsRoot, entry);
    if (statSync(fullPath).isDirectory() && !entry.startsWith('.') && entry !== 'node_modules' && entry !== 'temp') {
      scriptSubDirs.push(entry);
    }
  }
}

for (const subDir of scriptSubDirs) {
  const tplScriptsDir = join(commonDir, 'scripts', subDir);
  if (!existsSync(tplScriptsDir)) continue;
  const relPrefix = subDir ? `scripts/${subDir}` : 'scripts';
  for (const fname of readdirSync(tplScriptsDir)) {
    if (!fname.endsWith('.ts')) continue;
    const tplFile = join(tplScriptsDir, fname);
    if (!statSync(tplFile).isFile()) continue;
    const rel = `${relPrefix}/${fname}`;
    const projFile = join(projectDir, rel);
    const tplVer = extractScriptVersion(tplFile);
    if (!tplVer) { console.log(`  SKIP (no version): ${rel}`); continue; }
    const projVer = extractScriptVersion(projFile);
    if (!existsSync(projFile)) {
      console.log(`  NEW   ${rel}  (none) → ${tplVer}`);
      if (!dryRun) { mkdirSync(dirname(projFile), { recursive: true }); copyFileSync(tplFile, projFile); reconcileScriptRegistry(rel); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (semverGt(tplVer, projVer)) {
      // G05: Warn if project file has local modifications.
      if (existsSync(projFile) && isLocallyModified(projFile)) {
        console.log(`  ⚠️  CONFLICT ${rel}  ${projVer} → ${tplVer}  (local modifications exist — template will overwrite)`);
      } else {
        console.log(`  UPDATE ${rel}  ${projVer} → ${tplVer}`);
      }
      if (!dryRun) { copyFileSync(tplFile, projFile); reconcileScriptRegistry(rel); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (tplVer === projVer && fileHash(tplFile) !== fileHash(projFile)) {
      // v1.17.2 drift reconciliation: equal version but content differs means a
      // locally forked core script that upgrades could never see (version-gated
      // sync skipped it forever — found across Projects/co-* on 2026-08-29 with
      // 11 drifted forks in a single project). Core scripts are canonical: the
      // template copy wins, unconditionally (the integrity rule "core scripts
      // must not be modified" already forbids the local fork).
      console.log(`  ⚠️  DRIFT (restored to canonical) ${rel}  ${projVer} (content differs from L1 at same version — ADR-0085 D3)`);
      if (!dryRun) { copyFileSync(tplFile, projFile); reconcileScriptRegistry(rel); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (CORE_LOCKED_SCRIPTS.includes(rel) && projVer !== tplVer) {
      // T-20260921-010 (review H-4): a version-bumped fork of a locked core script
      // (project @version != template @version in either direction) matched no
      // restore branch above and printed OK forever — the fork survived every
      // future upgrade. AGENTS.md "Pluggable Variant Audit Hooks" forbids
      // modifying dev-sync.ts / audit.ts in L2 projects: the canonical template
      // copy wins, loudly.
      console.log(`  ⚠️  CORE-SCRIPT FORK ${rel}  project ${projVer} vs template ${tplVer} — locked core script must not be modified; restored to canonical`);
      if (!dryRun) { copyFileSync(tplFile, projFile); reconcileScriptRegistry(rel); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else {
      console.log(`  OK     ${rel}  ${projVer}`);
    }
  }
}
console.log('');

// ── VARIANT SCRIPTS SYNC: scripts/<variant>/ ─────────────────────────────────
// Variant-specific scripts (scripts/<variant>/) are not part of the L1 common
// registry; sync them from templates/<variant>/scripts/<variant>/ so template
// improvements (e.g. handbook validation scripts) reach the project. Version-
// based where an @version header exists (line or JSDoc style); hash-based for
// unversioned files (template is canonical). Project-only files are preserved.
const variantScriptsSrc = join(templatesDir, 'scripts', variant);
if (existsSync(variantScriptsSrc)) {
  console.log(`--- VARIANT SCRIPTS: scripts/${variant}/ ---`);
  const variantScriptsDst = join(projectDir, 'scripts', variant);
  const seenVariantScripts = new Set<string>();
  const syncVariantScripts = (dir: string, rel: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'temp') continue;
      const abs = join(dir, entry.name);
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        syncVariantScripts(abs, entryRel);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.mjs'))) {
        seenVariantScripts.add(entryRel);
        const rel2 = `scripts/${variant}/${entryRel}`;
        const projFile = join(projectDir, rel2);
        const tplVer = extractScriptVersion(abs);
        if (tplVer) {
          const projVer = existsSync(projFile) ? extractScriptVersion(projFile) : '';
          if (!existsSync(projFile)) {
            console.log(`  NEW   ${rel2}  (none) → ${tplVer}`);
            if (!dryRun) { mkdirSync(dirname(projFile), { recursive: true }); copyFileSync(abs, projFile); reconcileScriptRegistry(rel2); }
            console.log(`  ${dryTag}COPIED: ${rel2}`);
            syncChanged++;
          } else if (semverGt(tplVer, projVer)) {
            if (isLocallyModified(projFile)) {
              console.log(`  ⚠️  CONFLICT ${rel2}  ${projVer} → ${tplVer}  (local modifications exist — template will overwrite)`);
            } else {
              console.log(`  UPDATE ${rel2}  ${projVer} → ${tplVer}`);
            }
            if (!dryRun) { copyFileSync(abs, projFile); reconcileScriptRegistry(rel2); }
            console.log(`  ${dryTag}COPIED: ${rel2}`);
            syncChanged++;
          } else {
            console.log(`  OK     ${rel2}  ${projVer}`);
          }
        } else {
          // Unversioned file — template is canonical; compare by content hash.
          if (!existsSync(projFile)) {
            console.log(`  NEW   ${rel2}  (hash)`);
            if (!dryRun) { mkdirSync(dirname(projFile), { recursive: true }); copyFileSync(abs, projFile); }
            console.log(`  ${dryTag}COPIED: ${rel2}`);
            syncChanged++;
          } else if (fileHash(abs) !== fileHash(projFile)) {
            if (isLocallyModified(projFile)) {
              console.log(`  ⚠️  CONFLICT ${rel2}  (unversioned, local modifications exist — template will overwrite)`);
            } else {
              console.log(`  UPDATE ${rel2}  (hash changed)`);
            }
            if (!dryRun) copyFileSync(abs, projFile);
            console.log(`  ${dryTag}COPIED: ${rel2}`);
            syncChanged++;
          } else {
            console.log(`  OK     ${rel2}  (hash match)`);
          }
        }
      }
    }
  };
  syncVariantScripts(variantScriptsSrc, '');
  // Preserve project-only variant scripts (files in the project not in the template).
  const preserveVariantScripts = (dir: string, rel: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'temp') continue;
      const abs = join(dir, entry.name);
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        preserveVariantScripts(abs, entryRel);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.mjs')) && !seenVariantScripts.has(entryRel)) {
        console.log(`  PRESERVE (project-only): scripts/${variant}/${entryRel}`);
      }
    }
  };
  preserveVariantScripts(variantScriptsDst, '');
  // Sync the variant SCRIPTS.md registry from the template.
  const variantRegSrc = join(variantScriptsSrc, 'SCRIPTS.md');
  const variantRegDst = join(variantScriptsDst, 'SCRIPTS.md');
  if (existsSync(variantRegSrc) && (!existsSync(variantRegDst) || fileHash(variantRegSrc) !== fileHash(variantRegDst))) {
    console.log(`  UPDATE scripts/${variant}/SCRIPTS.md  (registry)`);
    if (!dryRun) copyFileSync(variantRegSrc, variantRegDst);
    console.log(`  ${dryTag}COPIED: scripts/${variant}/SCRIPTS.md`);
    syncChanged++;
  }
  console.log('');
}

// ── Project asset allowlist (v1.16.0) ────────────────────────────────────────
// The project's own variant.json is the SSOT for which assets the project wants
// (skill_manifest.allowlist for skills/, agents[].file for agents/). Without
// this gate, add-if-missing delivery of NEW common assets (e.g. the 0.6.0
// i18n-specialist agent and i18n-* skills) landed in projects whose variant
// rosters never registered them — tripping audit-variant allowlist/parity
// failures on the project's very next audit. Existing project files are always
// updated (registration is only consulted for brand-new additions), and
// projects without a variant.json keep the ungated behavior.
function loadProjectAssetGate(): { skills: Set<string>; agents: Set<string> } | null {
  const gatePath = join(projectDir, 'variant.json');
  if (!existsSync(gatePath)) return null;
  try {
    const v = JSON.parse(readFileSync(gatePath, 'utf8'));
    const allow = Array.isArray(v?.skill_manifest?.allowlist) ? v.skill_manifest.allowlist as string[] : [];
    const skills = Array.isArray(v?.skills) ? (v.skills as Array<{ name?: string; file?: string }>) : [];
    const agents = Array.isArray(v?.agents) ? (v.agents as Array<{ file?: string }>) : [];
    if (allow.length === 0 && skills.length === 0 && agents.length === 0) return null;
    const skillNames = new Set(allow);
    for (const skill of skills) {
      if (skill.name) skillNames.add(skill.name);
      const fileName = (skill.file ?? '').replace(/^skills\//, '').replace(/\/SKILL\.md$/, '');
      if (fileName) skillNames.add(fileName);
    }
    return {
      skills: skillNames,
      agents: new Set(agents.map((a) => (a.file ?? '').replace(/^agents\//, '')).filter(Boolean)),
    };
  } catch {
    return null; // invalid JSON — don't let the gate break the upgrade
  }
}
const assetGate = loadProjectAssetGate();

// T-20260921-007 (review H-1): common_skills declared in docs/templates/common-contract.json
// are the fleet-standard set — the frozen variant.json allowlist of projects scaffolded
// before a common skill landed must not withhold it forever (handbook, handbook-sync-audit,
// i18n-audit never reached projects whose allowlist predated them). Contract skills bypass
// the gate below (add-if-missing only); the CONTRACT PARITY report tells the operator which
// project skill_manifest entries to refresh.
const contractCommonSkills: Set<string> = (() => {
  try {
    const contract = JSON.parse(readFileSync(join(workspaceRoot, 'docs', 'templates', 'common-contract.json'), 'utf8'));
    const skills = contract?.common_skills;
    return new Set(skills && typeof skills === 'object' ? Object.keys(skills) : []);
  } catch {
    return new Set(); // unreadable contract — keep the strict gate rather than guess
  }
})();

// Skills the project's own variant.json deliberately registers in
// skill_manifest.variant_specific (v1.17.1) — the country-prune pass must not
// delete these even when the detected country doesn't match the skill's scope.
const projectManifestSkills: Set<string> = (() => {
  try {
    const v = JSON.parse(readFileSync(join(projectDir, 'variant.json'), 'utf8'));
    const list = Array.isArray(v?.skill_manifest?.variant_specific)
      ? v.skill_manifest.variant_specific as Array<{ name?: string }>
      : [];
    return new Set(list.map((e) => e.name ?? '').filter(Boolean));
  } catch { return new Set(); }
})();

// ── SYNC_IF_NEWER: agents/ ────────────────────────────────────────────────────
// Writes the template agent content over the project file, preserving the
// project's local `lifecycle:` frontmatter block (L3 governance records).
function writeAgentWithLifecycle(tplFile: string, projFile: string): void {
  if (existsSync(projFile)) {
    const merged = preserveLifecycleFrontmatter(readFileSync(tplFile, 'utf8'), readFileSync(projFile, 'utf8'));
    writeFileSync(projFile, merged);
  } else {
    copyFileSync(tplFile, projFile);
  }
}

console.log('--- SYNC_IF_NEWER: agents/ ---');
const tplAgentsDirs = [join(templatesDir, 'agents'), join(commonDir, 'agents')];
const seenAgents = new Set<string>();
for (const agentsDir of tplAgentsDirs) {
  if (!existsSync(agentsDir)) continue;
  for (const fname of readdirSync(agentsDir)) {
    if (!fname.endsWith('.md') || seenAgents.has(fname)) continue;
    if (fname === 'README.md' || fname === 'README_ko.md' || fname === '_COMMON.md') {
      console.log(`  PRESERVE (README): agents/${fname}`);
      seenAgents.add(fname);
      continue;
    }
    seenAgents.add(fname);
    const tplFile = join(agentsDir, fname);
    if (!statSync(tplFile).isFile()) continue;
    const rel = `agents/${fname}`;
    const projFile = join(projectDir, rel);
    const tplVer = extractFrontmatterVersion(tplFile);
    if (!tplVer) { console.log(`  SKIP (no version): ${rel}`); continue; }
    const projVer = extractFrontmatterVersion(projFile);
    if (!existsSync(projFile)) {
      if (assetGate && !assetGate.agents.has(fname)) {
        console.log(`  SKIP (not in variant.json agent registry): ${rel}`);
        continue;
      }
      console.log(`  NEW   ${rel}  (none) → ${tplVer}`);
      if (!dryRun) { mkdirSync(dirname(projFile), { recursive: true }); copyFileSync(tplFile, projFile); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (!projVer) {
      console.log(`  UPDATE ${rel}  (no version) → ${tplVer}`);
      if (!dryRun) writeAgentWithLifecycle(tplFile, projFile);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (semverGt(tplVer, projVer)) {
      // G05: Warn if project file has local modifications.
      if (isLocallyModified(projFile)) {
        console.log(`  ⚠️  CONFLICT ${rel}  ${projVer} → ${tplVer}  (local modifications exist — template will overwrite)`);
      } else {
        console.log(`  UPDATE ${rel}  ${projVer} → ${tplVer}`);
      }
      if (!dryRun) writeAgentWithLifecycle(tplFile, projFile);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (lifecyclelessText(readFileSync(tplFile, 'utf8')) !== lifecyclelessText(readFileSync(projFile, 'utf8'))) {
      // v1.35.0 drift reconciliation (T-20260920-002): equal frontmatter version
      // but lifecycle-stripped content differs — the same version-gated skip that
      // v1.17.2 fixed for scripts/ (i18n-specialist's 2026-09-15 codex-tier update
      // shipped without a version bump and never reached six projects). Agents are
      // canonical like core scripts; the project lifecycle block stays preserved
      // by writeAgentWithLifecycle, so the comparison strips it on both sides.
      console.log(`  ⚠️  DRIFT (restored to canonical) ${rel}  ${projVer} (content differs from template at same version — ADR-0085 D3)`);
      if (!dryRun) writeAgentWithLifecycle(tplFile, projFile);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else {
      console.log(`  OK     ${rel}  ${projVer}`);
    }
  }
}
// List project-only agents as PRESERVE
const projAgentsDir = join(projectDir, 'agents');
if (existsSync(projAgentsDir)) {
  for (const fname of readdirSync(projAgentsDir)) {
    if (fname.endsWith('.md') && !seenAgents.has(fname)) {
      console.log(`  PRESERVE (project-only): agents/${fname}`);
    }
  }
}
console.log('');

// ── SYNC_IF_NEWER: skills/ ────────────────────────────────────────────────────
// v1.37.0: NEW/UPDATE copy the skill's WHOLE directory (template files overwrite
// same-named project files; project-only files are preserved). Equal-version
// skills get additive catch-up — missing files are delivered, same-version
// content differences are warned as DRIFT and left untouched. Before v1.37.0
// only skills/<name>/SKILL.md was delivered, so skill sub-files (references/,
// assets/, examples/) never reached existing projects after scaffolding.
console.log('--- SYNC_IF_NEWER: skills/ ---');
const tplSkillsDir = join(commonDir, 'skills');
const seenSkills = new Set<string>();
// Recursively deliver template files missing from the project skill directory
// without overwriting anything that already exists (dry-run counts only).
// v1.38.0: generic recursive catch-up, shared by the common and variant skill passes
const catchUpDir = (srcRoot: string, dstRoot: string): { copied: number; drifted: string[] } => {
  let copied = 0;
  const drifted: string[] = [];
  const walk = (srcDir: string, dstDir: string): void => {
    const projSkillDir = dstRoot;
    void projSkillDir;
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const src = join(srcDir, entry.name);
      const dst = join(dstDir, entry.name);
      if (entry.isDirectory()) {
        if (!dryRun) mkdirSync(dst, { recursive: true });
        walk(src, dst);
      } else if (entry.isFile()) {
        if (!existsSync(dst)) {
          if (!dryRun) copyFileSync(src, dst);
          copied++;
        } else if (fileHash(src) !== fileHash(dst)) {
          drifted.push(dst.slice(dstRoot.length + 1).replace(/\\/g, '/'));
        }
      }
    }
  };
  walk(srcRoot, dstRoot);
  return { copied, drifted };
};
const catchUpSkillDir = (skillName: string): { copied: number; drifted: string[] } =>
  catchUpDir(join(tplSkillsDir, skillName), join(projectDir, 'skills', skillName));
if (existsSync(tplSkillsDir)) {
  for (const skillName of readdirSync(tplSkillsDir)) {
    const tplSkillFile = join(tplSkillsDir, skillName, 'SKILL.md');
    if (!existsSync(tplSkillFile)) continue;
    seenSkills.add(skillName);
    const projSkillFile = join(projectDir, 'skills', skillName, 'SKILL.md');
    const tplVer = extractFrontmatterVersion(tplSkillFile);
    const copyWholeSkillDir = (): void => {
      if (dryRun) return;
      mkdirSync(dirname(projSkillFile), { recursive: true });
      cpSync(join(tplSkillsDir, skillName), join(projectDir, 'skills', skillName), { recursive: true });
    };
    if (tplVer) {
      const projVer = extractFrontmatterVersion(projSkillFile);
      if (!existsSync(projSkillFile)) {
        const contractCommonDelivery = assetGate && !assetGate.skills.has(skillName) && contractCommonSkills.has(skillName);
        if (assetGate && !assetGate.skills.has(skillName) && !contractCommonDelivery) {
          console.log(`  SKIP (not in variant.json skill allowlist): skills/${skillName}/SKILL.md`);
          continue;
        }
        if (contractCommonDelivery) {
          console.log(`  ℹ️  contract common_skill delivered despite variant.json allowlist — refresh skill_manifest.allowlist to record it`);
        }
        console.log(`  NEW   skills/${skillName}/SKILL.md  (none) → ${tplVer}`);
        copyWholeSkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/ (whole directory)`);
        syncChanged++;
      } else if (semverGt(tplVer, projVer)) {
        // G05: Warn if project file has local modifications.
        if (isLocallyModified(projSkillFile)) {
          console.log(`  ⚠️  CONFLICT skills/${skillName}/SKILL.md  ${projVer || '(none)'} → ${tplVer}  (local modifications exist)`);
        } else {
          console.log(`  UPDATE skills/${skillName}/SKILL.md  ${projVer || '(none)'} → ${tplVer}`);
        }
        copyWholeSkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/ (whole directory)`);
        syncChanged++;
      } else {
        const { copied, drifted } = catchUpSkillDir(skillName);
        if (copied > 0) {
          console.log(`  CATCH-UP skills/${skillName}/  ${copied} missing file(s) delivered (same version ${projVer})`);
          syncChanged++;
        } else if (drifted.length === 0) {
          console.log(`  OK     skills/${skillName}/SKILL.md  ${projVer}`);
        }
        for (const d of drifted) {
          console.log(`  ⚠️  DRIFT (preserved) skills/${skillName}/${d}  (same-version content differs — left untouched; ADR-0085 D3)`);
        }
      }
    } else {
      // No explicit version — compare by content hash
      const tplHash = fileHash(tplSkillFile);
      const projHash = fileHash(projSkillFile);
      if (!existsSync(projSkillFile)) {
        const contractCommonDelivery = assetGate && !assetGate.skills.has(skillName) && contractCommonSkills.has(skillName);
        if (assetGate && !assetGate.skills.has(skillName) && !contractCommonDelivery) {
          console.log(`  SKIP (not in variant.json skill allowlist): skills/${skillName}/SKILL.md`);
          continue;
        }
        if (contractCommonDelivery) {
          console.log(`  ℹ️  contract common_skill delivered despite variant.json allowlist — refresh skill_manifest.allowlist to record it`);
        }
        console.log(`  NEW   skills/${skillName}/SKILL.md  (hash-based)`);
        copyWholeSkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/ (whole directory)`);
        syncChanged++;
      } else if (tplHash !== projHash) {
        console.log(`  UPDATE skills/${skillName}/SKILL.md  (content changed)`);
        copyWholeSkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/ (whole directory)`);
        syncChanged++;
      } else {
        const { copied, drifted } = catchUpSkillDir(skillName);
        if (copied > 0) {
          console.log(`  CATCH-UP skills/${skillName}/  ${copied} missing file(s) delivered (hash match)`);
          syncChanged++;
        } else if (drifted.length === 0) {
          console.log(`  OK     skills/${skillName}/SKILL.md  (hash match)`);
        }
        for (const d of drifted) {
          console.log(`  ⚠️  DRIFT (preserved) skills/${skillName}/${d}  (same-version content differs — left untouched; ADR-0085 D3)`);
        }
      }
    }
  }
}
// List project-only skills as PRESERVE
const projSkillsDir = join(projectDir, 'skills');
if (existsSync(projSkillsDir)) {
  for (const skillName of readdirSync(projSkillsDir)) {
    if (!seenSkills.has(skillName) && existsSync(join(projSkillsDir, skillName, 'SKILL.md'))) {
      console.log(`  PRESERVE (project-only): skills/${skillName}/`);
    }
  }
}
console.log('');

// ── VARIANT SKILLS SYNC: skills/<variant>/ ───────────────────────────────────
// Variant-specific skills (skills/<variant>/) are not in the L1 common pool;
// mirror them from templates/<variant>/skills/<name>/ so skill improvements
// (e.g. handbook skill content) reach the project. Version/hash-based on the
// SKILL.md frontmatter; the whole skill directory is mirrored on update.
const variantSkillsSrc = join(templatesDir, 'skills');
if (existsSync(variantSkillsSrc)) {
  console.log(`--- VARIANT SKILLS: skills/${variant}/ ---`);
  for (const skillName of readdirSync(variantSkillsSrc)) {
    const tplSkillFile = join(variantSkillsSrc, skillName, 'SKILL.md');
    if (!existsSync(tplSkillFile)) continue;
    const tplSkillDir = join(variantSkillsSrc, skillName);
    const projSkillDir = join(projectDir, 'skills', skillName);
    const projSkillFile = join(projSkillDir, 'SKILL.md');
    const tplVer = extractFrontmatterVersion(tplSkillFile);
    const projVer = existsSync(projSkillFile) ? extractFrontmatterVersion(projSkillFile) : '';
    const copySkillDir = (): void => {
      mkdirSync(projSkillDir, { recursive: true });
      // v1.37.0: recursive merge — the old two-level walk skipped files at
      // depth ≥ 3 (e.g. references/validation/*).
      cpSync(tplSkillDir, projSkillDir, { recursive: true });
    };
    if (tplVer) {
      if (!existsSync(projSkillFile)) {
        console.log(`  NEW   skills/${skillName}/SKILL.md  (none) → ${tplVer}`);
        if (!dryRun) copySkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/`);
        syncChanged++;
      } else if (semverGt(tplVer, projVer)) {
        if (isLocallyModified(projSkillFile)) {
          console.log(`  ⚠️  CONFLICT skills/${skillName}/SKILL.md  ${projVer} → ${tplVer}  (local modifications exist — template will overwrite)`);
        } else {
          console.log(`  UPDATE skills/${skillName}/SKILL.md  ${projVer} → ${tplVer}`);
        }
        if (!dryRun) copySkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/`);
        syncChanged++;
      } else {
        // v1.38.0: equal-version catch-up, same policy as the common skills pass
        const { copied, drifted } = catchUpDir(tplSkillDir, projSkillDir);
        if (copied > 0) {
          console.log(`  CATCH-UP skills/${skillName}/  ${copied} missing file(s) delivered (same version ${projVer})`);
          syncChanged++;
        } else if (drifted.length === 0) {
          console.log(`  OK     skills/${skillName}/SKILL.md  ${projVer}`);
        }
        for (const d of drifted) {
          console.log(`  ⚠️  DRIFT (preserved) skills/${skillName}/${d}  (same-version content differs — left untouched; ADR-0085 D3)`);
        }
      }
    } else {
      const tplHash = fileHash(tplSkillFile);
      const projHash = existsSync(projSkillFile) ? fileHash(projSkillFile) : '';
      if (!existsSync(projSkillFile)) {
        console.log(`  NEW   skills/${skillName}/SKILL.md  (hash)`);
        if (!dryRun) copySkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/`);
        syncChanged++;
      } else if (tplHash !== projHash) {
        console.log(`  UPDATE skills/${skillName}/SKILL.md  (content changed)`);
        if (!dryRun) copySkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/`);
        syncChanged++;
      } else {
        const { copied, drifted } = catchUpDir(tplSkillDir, projSkillDir);
        if (copied > 0) {
          console.log(`  CATCH-UP skills/${skillName}/  ${copied} missing file(s) delivered (hash match)`);
          syncChanged++;
        } else if (drifted.length === 0) {
          console.log(`  OK     skills/${skillName}/SKILL.md  (hash match)`);
        }
        for (const d of drifted) {
          console.log(`  ⚠️  DRIFT (preserved) skills/${skillName}/${d}  (same-version content differs — left untouched; ADR-0085 D3)`);
        }
      }
    }
  }
  console.log('');
}

// ── VARIANT ASSET DIRS SYNC: any other top-level variant-owned directory ──────
// Some variants ship top-level asset directories beyond agents/skills/scripts/docs
// (e.g. co-safety's workflows/, regulations/, evidence-models/, industry-profiles/ —
// EHS workflow schemas, regulation YAMLs, evidence-record JSON schemas, industry
// profile configs). Those directories are project-owned in Projects/<name>/ and were
// historically synced to templates/<variant>/ only by a one-off manual `cp -r`
// during Phase B promotion (see templates/co-safety's own history) — with no upgrade
// path, a project scaffolded before such a directory existed in the template, or one
// missing it due to a promotion gap, never received it via `upgrade-project`. This
// section discovers any such directory generically (not hardcoded to co-safety) so
// the fix covers every current and future variant that grows one.
const VARIANT_ASSET_DIR_SKIP = new Set([
  'agents', 'skills', 'scripts', 'docs',
  '.claude', '.gemini', '.agents', '.git', '.github', '.githooks',
  'memory', 'node_modules',
]);
const variantAssetDirs = existsSync(templatesDir)
  ? readdirSync(templatesDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !VARIANT_ASSET_DIR_SKIP.has(e.name))
      .map(e => e.name)
  : [];
if (variantAssetDirs.length > 0) {
  console.log(`--- VARIANT ASSET DIRS: ${variantAssetDirs.join(', ')} ---`);
  const syncAssetDir = (srcDir: string, dstDir: string, label: string): void => {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const srcPath = join(srcDir, entry.name);
      const dstPath = join(dstDir, entry.name);
      const relPath = `${label}/${entry.name}`;
      if (entry.isDirectory()) {
        syncAssetDir(srcPath, dstPath, relPath);
        continue;
      }
      if (!existsSync(dstPath)) {
        console.log(`  NEW    ${relPath}`);
        if (!dryRun) { mkdirSync(dirname(dstPath), { recursive: true }); copyFileSync(srcPath, dstPath); }
        console.log(`  ${dryTag}COPIED: ${relPath}`);
        syncChanged++;
      } else if (fileHash(srcPath) !== fileHash(dstPath)) {
        if (isLocallyModified(dstPath)) {
          console.log(`  ⚠️  CONFLICT ${relPath}  (content changed, local modifications exist — template will overwrite)`);
        } else {
          console.log(`  UPDATE ${relPath}  (content changed)`);
        }
        if (!dryRun) copyFileSync(srcPath, dstPath);
        console.log(`  ${dryTag}COPIED: ${relPath}`);
        syncChanged++;
      }
    }
  };
  for (const dirName of variantAssetDirs) {
    syncAssetDir(join(templatesDir, dirName), join(projectDir, dirName), dirName);
  }
  console.log('  (project-only files under these directories are preserved — not deleted; run with --prune-removed awareness manually if needed)');
  console.log('');
}

// ── CONTRACT PARITY (T-20260921-007, review H-1) ─────────────────────────────
// Loud post-pass report: docs/templates/common-contract.json common_skills are the
// fleet-standard skill set. Report any still missing from the project (the
// add-if-missing passes deliver them, so a miss means the gate withheld it or the
// contract drifted) and count delivered ones the project's variant.json does not
// declare (the project-side allowlist is operator-owned and should be refreshed).
console.log('--- CONTRACT PARITY (common-contract.json common_skills) ---');
{
  let missing = 0;
  let undeclared = 0;
  for (const skillName of [...contractCommonSkills].sort()) {
    const projSkillFile = join(projectDir, 'skills', skillName, 'SKILL.md');
    if (!existsSync(projSkillFile)) {
      console.log(`  ⚠️  MISSING skills/${skillName}/  (declared in common-contract.json, absent from the project)`);
      missing++;
      continue;
    }
    if (assetGate && !assetGate.skills.has(skillName)) undeclared++;
  }
  if (missing === 0 && undeclared === 0) {
    console.log('  OK  project satisfies the contract common_skills set');
  } else {
    if (missing > 0) console.log(`  ${missing} contract skill(s) missing from the project`);
    if (undeclared > 0) console.log(`  ℹ️  ${undeclared} contract skill(s) present but not declared in variant.json skill_manifest`);
  }
  if (dryRun) console.log('  (dry run — reflects pre-upgrade state; planned deliveries are not applied yet)');
  console.log('');
}

// ── GOVERNANCE FILES SYNC: top-level add-if-missing files (LICENSE, …) ────────
// Templates ship top-level governance files (LICENSE) that no other pass covers:
// LOCKED/MERGE/DOCS_*/TEMPLATE TREE SYNC/SYNC_IF_NEWER all operate on hardcoded or
// directory paths, and VARIANT ASSET DIRS SYNC only discovers directories — a
// top-level file fell through every pass and never reached legacy projects. The
// source is the variant template first, then templates/common (scaffold parity).
// Semantics are strictly ADD-IF-MISSING: a project that already has the file keeps
// its own — licenses are intentionally forkable (co-price carries a commercial
// appendix, co-safety a filled-in copyright line), so an existing file is never
// overwritten, never conflict-checked, and never updated to the template version.
console.log('--- GOVERNANCE FILES SYNC (add-if-missing) ---');
// SECURITY.md added per 2026-09-11-upgrade-policy-coverage-design.md D5 — template-shipped
// policy text, forkable like LICENSE. Mirrored in scripts/lib/upgrade-policy.ts (drift-guarded
// by tests/unit/upgrade-policy.test.ts).
const GOVERNANCE_FILES = ['LICENSE', 'SECURITY.md'];
let govFilesCopied = 0;
for (const fileName of GOVERNANCE_FILES) {
  const src = existsSync(join(templatesDir, fileName))
    ? join(templatesDir, fileName)
    : join(commonDir, fileName);
  const dst = join(projectDir, fileName);
  if (!existsSync(src)) continue;
  if (existsSync(dst)) {
    console.log(`  OK     ${fileName}  (project-owned — preserved)`);
    continue;
  }
  console.log(`  NEW    ${fileName}  (from ${existsSync(join(templatesDir, fileName)) ? 'variant template' : 'templates/common'})`);
  if (!dryRun) copyFileSync(src, dst);
  console.log(`  ${dryTag}COPIED: ${fileName}`);
  govFilesCopied++;
  syncChanged++;
}
console.log('');

// ── PROCEDURES SYNC: variant workflow corpus (add-if-missing) ─────────────────
// Procedures (ADR-0063) are the canonical workflow source and MUST be present in
// every project (reledgev pipeline-coverage review 2026-08-29). Legacy projects
// scaffolded before the procedures wave lack them entirely, and no other pass
// covers the procedures/ directory. Semantics: ADD-IF-MISSING per procedure entry —
// a project that already has `procedures/<name>/` keeps its own (project-local
// workflow edits are intentional); missing entries are copied whole from the
// variant template first, then templates/common. `_output-types.yaml` is seeded
// if absent (it is the closed output-type vocabulary validators rely on).
console.log('--- PROCEDURES SYNC (add-if-missing) ---');
let proceduresCopied = 0;
{
  const projProcDir = join(projectDir, 'procedures');
  const variantProcDir = join(templatesDir, 'procedures');
  const commonProcDir = join(commonDir, 'procedures');
  const sources = [variantProcDir, commonProcDir];

  // Seed _output-types.yaml if the project has no procedures vocabulary at all
  if (!dryRun && !existsSync(projProcDir)) mkdirSync(projProcDir, { recursive: true });
  const otypesDst = join(projProcDir, '_output-types.yaml');
  if (!existsSync(otypesDst)) {
    for (const srcDir of sources) {
      const otypesSrc = join(srcDir, '_output-types.yaml');
      if (existsSync(otypesSrc)) {
        console.log(`  NEW    procedures/_output-types.yaml`);
        if (!dryRun) copyFileSync(otypesSrc, otypesDst);
        proceduresCopied++;
        syncChanged++;
        break;
      }
    }
  }

  for (const srcDir of sources) {
    if (!existsSync(srcDir)) continue;
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue; // _template stays template-only
      const dst = join(projProcDir, entry.name);
      if (existsSync(dst)) {
        console.log(`  OK     procedures/${entry.name}/  (project-owned — preserved)`);
        continue;
      }
      console.log(`  NEW    procedures/${entry.name}/  (from ${srcDir === variantProcDir ? 'variant template' : 'templates/common'})`);
      if (!dryRun) cpSync(join(srcDir, entry.name), dst, { recursive: true });
      proceduresCopied++;
      syncChanged++;
    }
  }
  if (proceduresCopied === 0) console.log('  OK     procedures/ already in sync');
}
console.log('');

// ── TEMPLATE TREE SYNC: template files no dedicated pass claims (default policy) ──────────────
// 2026-09-11-upgrade-policy-coverage-design.md: upgrade coverage used to be enumeration, so
// files with no claiming pass were silently never delivered (most of the variant docs tree,
// .github/, platform settings.json, .editorconfig, skills.json, …). Classification lives in
// scripts/lib/upgrade-policy.ts with the fallback policy SYNC (deliver by default); this pass
// delivers exactly the files whose claim names THIS pass:
//   SYNC       — add-if-missing, then inline-version/hash update with the standard conflict
//                warning on locally-modified files (the contract of the former VARIANT_DOCS_SYNC pass).
//   WORKSPACE  — docs/ project workspaces (designs/, drafts/, lifecycle/, …): seed
//                add-if-missing only, never overwrite, never prune.
//   JSON_MERGE — platform settings: deep merge, template wins conflicts, arrays unioned so
//                project-only entries (e.g. permissions.allow grants) survive.
console.log('--- TEMPLATE TREE SYNC: uncovered template files (default policy) ---');
{
  const variantTplDir = existsSync(templatesDir) ? templatesDir : null;
  for (const { rel, abs } of iterEffectiveTemplateFiles(commonDir, variantTplDir)) {
    const claim = resolveClaim(rel, variant);
    if (!claim || claim.pass !== TEMPLATE_TREE_SYNC_PASS) continue;

    // Country-profile parity with scaffold-time pruning (ADR-0057/0058): don't re-inject a
    // country profile that doesn't match the project's detected country. Region-neutral
    // projects receive all profiles (they were never pruned).
    const countryMatch = rel.match(/^docs\/countries\/([A-Z]{2})\.md$/);
    if (countryMatch && detectedCountry !== 'none' && detectedCountry !== countryMatch[1]) continue;

    const dest = join(projectDir, rel);

    if (claim.policy === 'JSON_MERGE') {
      if (!existsSync(dest)) {
        console.log(`  NEW    ${rel}`);
        if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(abs, dest); }
        console.log(`  ${dryTag}COPIED: ${rel}`);
      } else {
        try {
          const result = mergeSettingsJson(dest, abs);
          if (!result.changed) { console.log(`  OK     ${rel}  (json merge — in sync)`); continue; }
          console.log(`  MERGE  ${rel}${result.preserved.length > 0 ? `  (preserved project-only: ${result.preserved.join(', ')})` : ''}`);
          if (!dryRun) writeFileSync(dest, result.merged, 'utf8');
          console.log(`  ${dryTag}WROTE: ${rel}`);
        } catch (err) {
          console.log(`  ⚠️  SKIP   ${rel}  (json merge failed: ${(err as Error).message})`);
          continue;
        }
      }
      treeChanged++;
      continue;
    }

    if (claim.policy === 'WORKSPACE') {
      if (existsSync(dest)) continue; // project-owned — seed only, silent like PROCEDURES
      console.log(`  NEW    ${rel}  (workspace seed)`);
      if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(abs, dest); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      treeChanged++;
      continue;
    }

    if (claim.policy === 'ADD_IF_MISSING') {
      // ADR-0076 (upgrade-policy v1.2.0): .codex/** seeds — projects owning their Codex
      // config (co-abap, co-safety) are never touched; the graft section there is a
      // one-time manual TOML edit, not a file overwrite.
      if (existsSync(dest)) continue; // project-owned — seed only, silent like PROCEDURES
      console.log(`  NEW    ${rel}  (add-if-missing seed)`);
      if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(abs, dest); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      treeChanged++;
      continue;
    }

    // claim.policy === 'SYNC'
    if (!existsSync(dest)) {
      console.log(`  NEW    ${rel}`);
      if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(abs, dest); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      treeChanged++;
      continue;
    }
    const tplInlineVer = extractInlineVersion(abs);
    let reason = '';
    if (tplInlineVer) {
      const projVer = extractInlineVersion(dest);
      if (!projVer) reason = `(no version) → v${tplInlineVer}`;
      else if (inlineVersionGt(tplInlineVer, projVer)) reason = `v${projVer} → v${tplInlineVer}`;
    } else if (fileHash(abs) !== fileHash(dest)) {
      reason = '(content changed)';
    }
    if (reason !== '') {
      // v1.25.0 docs/context.md project-only preservation (T-20260912-001): before
      // overwriting, detect content the overwrite would destroy. Project-only top-level
      // sections (headings absent from the template, outside managed zones) or a missing
      // version footer (wholeFileOwned — fully restructured file) → SKIP the copy with a
      // loud CONTEXT PRESERVE log, unless --force-context-sync takes the template version
      // anyway (the forced overwrite logs the discarded section count so the action stays
      // visible). Scoped to exactly docs/context.md — docs/<variant>.context.md
      // (MERGE_MANAGED) and every other file keep their existing semantics. Dry-run parity
      // is inherent: both sides are read from disk and nothing is written on the preserve
      // path, so dry-run and apply produce the identical verdict.
      if (rel === 'docs/context.md') {
        const ownership = findProjectOnlySections(readFileSync(dest, 'utf8'), readFileSync(abs, 'utf8'));
        if ((ownership.wholeFileOwned || ownership.sections.length > 0) && !forceContextSync) {
          console.log(`  ⚠️  CONTEXT PRESERVE ${rel}  ${reason}`);
          if (ownership.wholeFileOwned) {
            console.log('      project-only: (entire file — no version footer; treated as project-owned)');
          }
          for (const section of ownership.sections) {
            console.log(`      project-only: ${section.heading}`);
          }
          console.log('      preserved — re-run with --force-context-sync to take the template version, or merge manually');
          // ADR-0081 / T-20260919-003: managed-zone policy content still delivers
          // under PRESERVE — splice the template's COMMON-CONTEXT block into the
          // preserved copy so project-only sections are protected AND policy
          // sections (e.g. PM Team-Management Authority) are never starved.
          const spliced = spliceCommonContextBlock(readFileSync(dest, 'utf8'), readFileSync(abs, 'utf8'));
          if (spliced.changed) {
            if (!dryRun) writeFileSync(dest, spliced.content);
            console.log(`      ${dryTag}MERGED COMMON-CONTEXT block in: ${rel} (managed-zone policy content delivers under PRESERVE)`);
            treeChanged++;
          }
          continue; // skip the wholesale copy; intentionally NOT counted in treeChanged
        }
        if (ownership.wholeFileOwned || ownership.sections.length > 0) {
          console.log(`  FORCED OVERWRITE ${rel}  ${reason}  (--force-context-sync — ${ownership.sections.length} project-only section(s) discarded)`);
        }
      }
      if (isLocallyModified(dest)) {
        console.log(`  ⚠️  CONFLICT ${rel}  ${reason}  (local modifications exist)`);
      } else {
        console.log(`  UPDATE ${rel}  ${reason}`);
      }
      if (!dryRun) copyFileSync(abs, dest);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      treeChanged++;
    }
  }
  if (treeChanged === 0) console.log('  (no uncovered template files — project already at parity)');
  console.log('');
}

// ── ENV_SAMPLE SYNC: .env.sample (country-aware template delivery, merge-based) ───────────
// Formerly a PRESERVE file (removed from upgrade-policy.ts PRESERVE_FILES in v1.23.0):
// scaffold-time country pruning (prune-country-scoped-assets.ts) strips country-scoped
// env blocks from the project copy, so a wholesale template re-copy would re-inject them
// (same failure shape as the skill re-injection prune below). Deliver the template content
// through the shared lib with the project's detected country applied — new template env
// keys reach existing projects without resurrecting pruned country profiles. Region-neutral
// projects (country 'none') receive the all-blocks-stripped form, exactly as the scaffold
// left them. Delivery is a MERGE (lib/env-sample.ts mergeEnvSample): the template body is
// delivered, same-NAME keys are superseded by the template line, and project-only keys,
// their section dividers, inline notes, and commented-out documentation keys are preserved
// verbatim under a marker section — a customized .env.sample like co-price's 16 project
// keys survives an upgrade (the mergeGitleaksToml lesson).
console.log('--- ENV_SAMPLE SYNC: .env.sample (country-aware) ---');
{
  const envTplPath = resolveTemplate('.env.sample');
  const envDestPath = join(projectDir, '.env.sample');
  if (!envTplPath) {
    console.log('  (no template .env.sample — nothing to sync)');
  } else {
    const envPrune = pruneCountryScopedEnvBlocks(readFileSync(envTplPath, 'utf8'), detectedCountry);
    for (const warn of envPrune.warnings) console.log(`  ⚠️  template .env.sample: ${warn}`);
    if (envPrune.unbalanced) {
      console.log('  ⚠️  SKIP   .env.sample  (unbalanced country-scoped markers in template — not delivered)');
    } else if (!existsSync(envDestPath)) {
      console.log('  NEW    .env.sample');
      if (!dryRun) writeFileSync(envDestPath, envPrune.output, 'utf8');
      console.log(`  ${dryTag}WROTE: .env.sample  (country profile: ${detectedCountry === 'none' ? 'region-neutral' : detectedCountry})`);
      treeChanged++;
    } else {
      const currentEnv = readFileSync(envDestPath, 'utf8');
      const envMerge = mergeEnvSample(envPrune.output, currentEnv);
      if (envMerge.output === currentEnv) {
        console.log('  OK     .env.sample  (in sync)');
      } else {
        if (isLocallyModified(envDestPath)) {
          console.log('  ⚠️  CONFLICT .env.sample  (content changed — local modifications exist; the pre-upgrade stash covers rollback)');
        } else {
          console.log('  UPDATE .env.sample');
        }
        const { added, removed } = lineDiffCounts(currentEnv.split('\n'), envMerge.output.split('\n'));
        console.log(`    Lines: ${currentEnv.split('\n').length} -> ${envMerge.output.split('\n').length}  (+${added}/-${removed})`);
        if (envMerge.overriddenKeys.length > 0) {
          console.log(`    Template-superseded keys: ${envMerge.overriddenKeys.join(', ')}`);
        }
        if (envMerge.preservedKeys.length > 0) {
          const shown = envMerge.preservedKeys.slice(0, 8).join(', ');
          const rest = envMerge.preservedKeys.length - Math.min(8, envMerge.preservedKeys.length);
          console.log(`    Preserved project-only keys: ${shown}${rest > 0 ? ` +${rest} more` : ''}`);
        }
        if (!dryRun) writeFileSync(envDestPath, envMerge.output, 'utf8');
        console.log(`  ${dryTag}WROTE: .env.sample  (country profile: ${detectedCountry === 'none' ? 'region-neutral' : detectedCountry})`);
        treeChanged++;
      }
    }
  }
}
console.log('');

// ── COUNTRY-SCOPED SKILL PRUNE (ADR-0057/0058) ────────────────────────────────
// The skill-copy passes above sync from templates/common/skills/ and, for variant
// skills, templates/<variant>/skills/ with no country awareness — they re-inject
// registry-listed country-scoped skills (k-dart/k-law/k-kosis) into projects whose
// target country doesn't match, silently undoing scaffold-time pruning. Mirror the
// registry logic of scripts/helpers/prune-country-scoped-assets.ts here instead of
// spawning it: the upgrade path needs --dry-run parity and a conflict guard the
// scaffold-time helper lacks. Registry scripts/ (currently empty) are NOT pruned here —
// the upgrade path syncs scripts only from the (unscoped) registry. Country-scoped
// .env.sample blocks are handled upstream by the ENV_SAMPLE SYNC pass (shared
// lib/env-sample-blocks.ts), so they arrive already pruned.
// MUST run before the post-upgrade sync-skills.ts invoke so platform mirrors are
// regenerated from the already-pruned skills/ root.
console.log('--- COUNTRY-SCOPED SKILL PRUNE ---');
let countryPrunedSkills = 0;
{
  const schemaPath = join(workspaceRoot, 'docs', 'workspace-schema.json');
  let scopedSkills: Record<string, string> = {};
  if (existsSync(schemaPath)) {
    try {
      const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
      const countryScoped = schema.country_scoped_assets as { skills?: Record<string, string> } | undefined;
      if (countryScoped?.skills) scopedSkills = countryScoped.skills;
    } catch (e) {
      console.log(`  WARN: could not parse docs/workspace-schema.json — country prune skipped (${(e as Error).message})`);
    }
  }

  const prunedCountrySkills: string[] = [];
  for (const [skillName, scopedCountry] of Object.entries(scopedSkills)) {
    if (detectedCountry !== 'none' && detectedCountry === scopedCountry) continue; // country matches — keep
    // SAFETY (v1.17.1): a skill the project's own variant.json deliberately
    // registers in skill_manifest.variant_specific is an adopted asset, not
    // scaffold residue (observed 2026-08-29: co-newbiz's manifest declares
    // k-law, yet an upgrade with an undetected country silently pruned it).
    if (projectManifestSkills.has(skillName)) {
      console.log(`  ⚠️  KEEP ${skillName}/  (${scopedCountry}-scoped, project country ${detectedCountry})  — declared in the project variant.json skill_manifest`);
      continue;
    }
    for (const skillBase of ['skills', '.claude/skills', '.gemini/skills', '.agents/skills', '.codex/skills']) {
      const projSkillDir = join(projectDir, skillBase, skillName);
      if (!existsSync(projSkillDir)) continue;
      const skillMd = join(projSkillDir, 'SKILL.md');
      if (existsSync(skillMd)) {
        // Stock template content (any source the copy passes above would use) is
        // always safe to prune — this covers freshly re-injected copies, which are
        // UNTRACKED and therefore look "locally modified" to git status.
        const isStockCopy = [
          join(commonDir, 'skills', skillName, 'SKILL.md'),
          join(templatesDir, 'skills', skillName, 'SKILL.md'),
        ].some(src => existsSync(src) && fileHash(src) === fileHash(skillMd));
        // SAFETY: a scoped skill that diverged from the template AND carries local
        // modifications is a legacy intentional fork (e.g. a project that forked
        // k-law before the registry existed) — keep it and surface the conflict.
        if (!isStockCopy && isLocallyModified(skillMd)) {
          console.log(`  ⚠️  CONFLICT ${skillBase}/${skillName}/  ${scopedCountry}-scoped, project country ${detectedCountry}  (locally modified, kept)`);
          continue;
        }
      }
      console.log(`  ${dryTag}PRUNE  ${skillBase}/${skillName}/  (${scopedCountry}-scoped, project country: ${detectedCountry})`);
      prunedCountrySkills.push(skillName);
      if (!dryRun) rmSync(projSkillDir, { recursive: true, force: true });
      countryPrunedSkills++;
    }
  }
  if (Object.keys(scopedSkills).length === 0) {
    console.log('  (no country-scoped skills registered — nothing to check)');
  } else if (countryPrunedSkills === 0) {
    console.log('  (no country-scoped skills needed pruning)');
  }

  // v1.39.0 (T-20260921-006): pruned skills must not survive as dangling
  // references — scrub AGENTS.md skill-path lines and variant context mentions.
  if (!dryRun && prunedCountrySkills.length > 0) {
    const agentsPath = join(projectDir, 'AGENTS.md');
    if (existsSync(agentsPath)) {
      const lines = readFileSync(agentsPath, 'utf8').split('\n');
      const kept = lines.filter(line =>
        !prunedCountrySkills.some((n: string) => line.includes(`skills/${n}/SKILL.md`)));
      if (kept.length !== lines.length) {
        writeFileSync(agentsPath, kept.join('\n'), 'utf8');
        console.log(`  SCRUB  AGENTS.md — removed ${lines.length - kept.length} pruned-skill reference line(s)`);
      }
    }
    const ctxPath = join(projectDir, 'docs', `${variant}.context.md`);
    if (existsSync(ctxPath)) {
      const lines = readFileSync(ctxPath, 'utf8').split('\n');
      const kept = lines.filter(line =>
        !prunedCountrySkills.some((n: string) => line.includes(`\`${n}\``)));
      if (kept.length !== lines.length) {
        writeFileSync(ctxPath, kept.join('\n'), 'utf8');
        console.log(`  SCRUB  docs/${variant}.context.md — removed ${lines.length - kept.length} pruned-skill line(s)`);
      }
    }
  }
}
console.log('');

// ── VARIANT-SCOPE SKILL PRUNE (docs/designs/2026-08-28-skill-hygiene-and-conventions-design.md)
// Owner-curated registry: docs/workspace-schema.json `variant_scoped_skills` maps
// variant → skills exclusive to that variant. If such a skill reaches a project whose
// variant does not own it (typically via a mistaken promotion into templates/common
// followed by the SYNC_IF_NEWER skills pass), prune it from the project's skills/
// SSOT + the three platform mirrors. Registry-driven (ADR-0057/0058 pattern) —
// heuristics cannot safely distinguish variant-exclusive skills from genuinely
// common ones.
console.log('--- VARIANT-SCOPE SKILL PRUNE ---');
{
  const schemaPath = join(workspaceRoot, 'docs', 'workspace-schema.json');
  const ownedByOther: Array<{ skill: string; owner: string }> = [];
  if (existsSync(schemaPath)) {
    try {
      const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
      const map = schema?.variant_scoped_skills || {};
      for (const [ownerVariant, skills] of Object.entries(map as Record<string, string[]>)) {
        if (ownerVariant === 'description' || !Array.isArray(skills)) continue;
        if (ownerVariant === variant) continue;
        for (const skill of skills as string[]) ownedByOther.push({ skill, owner: ownerVariant });
      }
    } catch (err) {
      console.log(`  ⚠️  could not parse docs/workspace-schema.json — skipping prune (${String(err)})`);
    }
  }
  if (ownedByOther.length === 0) {
    console.log('  (no variant_scoped_skills registered for other variants — nothing to check)');
  } else {
    let foreignPruned = 0;
    for (const { skill, owner } of ownedByOther) {
      // SAFETY (v1.43.0, v1.17.1 symmetry): a skill the project's own variant.json
      // deliberately registers in skill_manifest.variant_specific is an adopted
      // asset, not scaffold residue — an adoption run seeds the manifest precisely
      // so that foreign-domain skills survive this registry-driven prune.
      if (projectManifestSkills.has(skill)) {
        console.log(`  ⚠️  KEEP ${skill}/  (owning variant: ${owner})  — declared in the project variant.json skill_manifest`);
        continue;
      }
      for (const dir of ['skills', '.claude/skills', '.gemini/skills', '.agents/skills']) {
        const target = join(projectDir, dir, skill);
        if (!existsSync(target)) continue;
        console.log(`  ${dryTag}PRUNE  ${dir}/${skill}/  (owning variant: ${owner})`);
        if (!dryRun) {
          const gitRm = spawnSync('git', ['-C', projectDir, 'rm', '-rf', '--quiet', `${dir}/${skill}`], { encoding: 'utf8' });
          if (gitRm.status !== 0) rmSync(target, { recursive: true, force: true });
        }
        foreignPruned++;
      }
    }
    if (foreignPruned === 0) console.log('  (project clean — no foreign variant skills present)');
    syncChanged += foreignPruned;
  }
}
console.log('');

// ── SKILLS_REGISTRY_RECONCILE: version, last_reviewed, and missing rows ───────
console.log('--- SKILLS_REGISTRY_RECONCILE: version, last_reviewed, missing rows ---');
const projSkillsPath = join(projectDir, 'skills');
const registryPath = join(projectDir, 'skills', 'SKILLS.md');
if (existsSync(registryPath) && existsSync(projSkillsPath)) {
  const registryContent = readFileSync(registryPath, 'utf8');
  const delivered: Array<{
    skill: string;
    version: string;
    status?: string;
    owner?: string;
    lastReviewed?: string;
  }> = [];

  // For each SKILL.md in the project, collect the delivered frontmatter
  for (const skillName of readdirSync(projSkillsPath)) {
    const skillMdPath = join(projSkillsPath, skillName, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;

    const fm = extractFrontmatterVersionAndReviewed(skillMdPath);
    if (!fm.version) continue;
    delivered.push({
      skill: skillName,
      version: fm.version,
      status: fm.status,
      owner: fm.owner,
      lastReviewed: fm.last_reviewed,
    });
  }

  // Reconcile: update existing rows in place; ADD rows for newly delivered
  // skills — the old behavior skipped missing rows ("don't synthesize"), which
  // forced a manual backfill across 11 projects when T-007 contract-skill
  // delivery landed new skills (T-20260922-001). Emitted cells are always
  // unquoted (helpers/skills-registry.ts).
  const { content: updatedRegistry, updated, added } = reconcileSkillRegistry(registryContent, delivered);
  for (const skill of updated) {
    console.log(`  ${dryTag}RECONCILED: ${skill} (version/last_reviewed updated)`);
  }
  for (const skill of added) {
    console.log(`  ${dryTag}ADDED ROW: ${skill} (newly delivered skill had no registry row)`);
  }
  const registryChanged = updated.length + added.length > 0;

  if (registryChanged && !dryRun) {
    writeFileSync(registryPath, updatedRegistry, 'utf8');
  }
} else {
  if (!existsSync(registryPath)) {
    console.log("  INFO: skills/SKILLS.md not found — skipping reconciliation");
  } else {
    console.log("  INFO: skills/ directory not found — skipping reconciliation");
  }
}
console.log('');

// ── OVERWRITE: docs/_common/ (allowlist) ──────────────────────────────────────
console.log('--- OVERWRITE: docs/_common/ (governance files) ---');
const DOCS_OVERWRITE = ['security.md'];
const DOCS_PRESERVE  = ['phase-definitions.md', 'context.md', 'README.md', 'README_ko.md'];
for (const fname of DOCS_OVERWRITE) {
  const src = join(commonDir, 'docs', '_common', fname);
  const dest = join(projectDir, 'docs', fname);
  if (!existsSync(src)) { console.log(`  SKIP (no template): docs/${fname}`); continue; }
  if (!existsSync(dest)) {
    console.log(`  NEW   docs/${fname}`);
  } else {
    diffSummary(dest, src);
  }
  if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
  console.log(`  ${dryTag}WROTE: docs/${fname}`);
  syncChanged++;
}
for (const fname of DOCS_PRESERVE) {
  if (existsSync(join(projectDir, 'docs', fname))) console.log(`  PRESERVE: docs/${fname}`);
}
console.log('');

// ── G10: --prune-removed (files in project but absent from template) ─────────────
let prunedCount = 0;
// ── DEPENDENCY GUARD (v1.35.0, T-20260920-001) ────────────────────────────────
// Delivered scripts may import bare packages (js-yaml, …) that live in the
// project-owned package.json — PROJECT_STATE_FILES the upgrader never writes.
// Report every missing package with its importers so the gap is loud in the
// plan (dry-run and apply alike) instead of surfacing as CI `Cannot find
// package` after merge. Report-only: no network, no lockfile churn.
{
  console.log('--- DEPENDENCY GUARD ---');
  const pkgFile = join(projectDir, 'package.json');
  const declared = new Set<string>();
  if (existsSync(pkgFile)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
      for (const k of Object.keys(pkg.dependencies ?? {})) declared.add(k);
      for (const k of Object.keys(pkg.devDependencies ?? {})) declared.add(k);
    } catch (e) {
      console.error(`  ERROR: failed to parse package.json: ${(e as Error).message}`);
    }
  } else {
    console.log('  (no package.json — nothing delivered scripts can depend on)');
  }
  if (existsSync(pkgFile)) {
    const deliveredRoots = [
      join(templatesDir, 'scripts'),
      join(commonDir, 'scripts'),
    ];
    const imports = scanDeliveredScripts(deliveredRoots, workspaceRoot);
    const allPkgs = new Set(imports.map((i) => i.pkg));
    const missing = missingDependencies(declared, allPkgs);
    for (const pkg of missing) {
      const info = imports.find((i) => i.pkg === pkg)!;
      const files = info.importedBy.slice(0, 3).join(', ');
      const more = info.importedBy.length > 3 ? ` +${info.importedBy.length - 3} more` : '';
      console.log(`  MISSING  ${pkg}  (imported by ${files}${more})`);
    }
    if (missing.length > 0) {
      console.log(`  → run inside the project: bun add ${missing.join(' ')}`);
      console.log(`  Dependency guard: ${missing.length} missing package(s)`);
    } else {
      console.log('  OK: all delivered-script dependencies declared');
    }
  }
  console.log('');
}

if (pruneRemoved) {
  console.log('--- PRUNE REMOVED: files present in project but absent from template ---');
  // Check scripts/
  const pruneCategories = [
    { projDir: join(projectDir, 'scripts'), tplDirs: [join(commonDir, 'scripts')], ext: '.ts', label: 'scripts/' },
    { projDir: join(projectDir, 'agents'), tplDirs: [join(templatesDir, 'agents'), join(commonDir, 'agents')], ext: '.md', label: 'agents/', skipFiles: ['README.md', 'README_ko.md', '_COMMON.md'] },
    // v1.22.1: the skills category MUST consult the variant template's skills/ too —
    // variant-owned skills (e.g. co-abap's sap-*) are delivered by the VARIANT SKILLS
    // pass and are template-owned; consulting only templates/common/skills marked them
    // prunable for projects without variant.json (fleet dry-run catch, 2026-09-12).
    // v1.35.0 (T-20260920-003): consult L0 root skills/ too — a project skill
    // delivered from the workspace-root SSOT (not present in variant/L1 trees)
    // must never count as prunable; upstream = any source that delivers.
    { projDir: join(projectDir, 'skills'), tplDirs: [join(templatesDir, 'skills'), join(commonDir, 'skills'), join(workspaceRoot, 'skills')].filter(existsSync), ext: '/SKILL.md', label: 'skills/', isSkill: true },
  ];
  for (const cat of pruneCategories) {
    if (!existsSync(cat.projDir)) continue;
    // Collect all template file basenames. For identity-separated/common-only
    // projects, templates/<variant>/ may not exist; in that case the project's
    // own variant.json is the authority for variant-owned agents/skills that
    // must survive --prune-removed.
    const tplBasenames = new Set<string>();
    for (const td of cat.tplDirs) {
      if (!existsSync(td)) continue;
      if (cat.isSkill) {
        for (const d of readdirSync(td)) {
          if (existsSync(join(td, d, 'SKILL.md'))) tplBasenames.add(d);
        }
      } else {
        for (const f of readdirSync(td)) {
          if (f.endsWith(cat.ext)) tplBasenames.add(f);
        }
      }
    }
    if (cat.label === 'agents/' && assetGate) {
      for (const agentFile of assetGate.agents) tplBasenames.add(agentFile);
    }
    if (cat.label === 'skills/') {
      if (assetGate) {
        for (const skill of assetGate.skills) tplBasenames.add(skill);
      }
      for (const skill of projectManifestSkills) tplBasenames.add(skill);
    }
    // Walk project dir recursively (for scripts/) or shallowly
    if (cat.isSkill) {
      for (const d of readdirSync(cat.projDir)) {
        if (!tplBasenames.has(d) && existsSync(join(cat.projDir, d, 'SKILL.md'))) {
          console.log(`  PRUNE  ${cat.label}${d}/`);
          if (!dryRun) {
            const rm = spawnSync('git', ['-C', projectDir, 'rm', '-rf', `${cat.label}${d}`], { encoding: 'utf8' });
            if (rm.status !== 0) {
              // H2 (2026-09-15 project review): git rm fails for untracked
              // files — fall back to a direct delete so the PRUNE verdict in
              // this log matches disk state (same pattern as the VARIANT-SCOPE
              // SKILL PRUNE pass).
              try {
                rmSync(join(projectDir, `${cat.label}${d}`), { recursive: true, force: true });
              } catch (e) {
                console.error(`  ERROR: failed to prune ${cat.label}${d}: ${(e as Error).message}`);
                continue; // not pruned — do not count it
              }
            }
          }
          prunedCount++;
        }
      }
    } else {
      for (const f of readdirSync(cat.projDir)) {
        if (f.endsWith(cat.ext) && !tplBasenames.has(f) && !(cat.skipFiles || []).includes(f)) {
          console.log(`  PRUNE  ${cat.label}${f}`);
          if (!dryRun) {
            const rm = spawnSync('git', ['-C', projectDir, 'rm', '-f', `${cat.label}${f}`], { encoding: 'utf8' });
            if (rm.status !== 0) {
              try {
                rmSync(join(projectDir, `${cat.label}${f}`), { force: true });
              } catch (e) {
                console.error(`  ERROR: failed to prune ${cat.label}${f}: ${(e as Error).message}`);
                continue; // not pruned — do not count it
              }
            }
          }
          prunedCount++;
        }
      }
    }
  }
  if (prunedCount === 0) console.log('  (no stale files found)');

  // ── Retired-skill mirror sweep (v1.35.0, T-20260920-003) ──
  // Platform skill mirrors are distributed by sync-skills.ts, not by file
  // passes, so the tree prunes above never own them — a skill retired at
  // L0/L1 (validate-docs-links, 2026-09-12) left 46 orphan mirror dirs across
  // the fleet. A mirror dir is pruned when its skill name resolves from NO
  // upstream source: root SSOT skills/, root platform mirrors, variant
  // skills/, variant platform mirrors, templates/common/skills/, and the L1
  // platform mirrors. Variant-owned names resolve through the variant trees
  // and the asset gate, so they are never touched.
  const upstreamSkillNames = new Set<string>();
  const upstreamNameSources = [
    join(workspaceRoot, 'skills'),
    join(workspaceRoot, '.claude', 'skills'),
    join(workspaceRoot, '.gemini', 'skills'),
    join(workspaceRoot, '.agents', 'skills'),
    join(commonDir, 'skills'),
    join(commonDir, '.claude', 'skills'),
    join(commonDir, '.gemini', 'skills'),
    join(commonDir, '.agents', 'skills'),
    join(templatesDir, 'skills'),
    join(templatesDir, '.claude', 'skills'),
    join(templatesDir, '.gemini', 'skills'),
    join(templatesDir, '.agents', 'skills'),
    join(templatesDir, '.codex', 'skills'),
  ];
  for (const src of upstreamNameSources) {
    if (!existsSync(src)) continue;
    for (const d of readdirSync(src)) {
      if (existsSync(join(src, d, 'SKILL.md'))) upstreamSkillNames.add(d);
    }
  }
  const mirrorPruneCount = { n: 0 };
  for (const mirrorRoot of ['.claude', '.gemini', '.agents', '.codex']) {
    const projMirror = join(projectDir, mirrorRoot, 'skills');
    if (!existsSync(projMirror)) continue;
    // A project-authored skills/<name>/ SSOT (standalone-track projects like
    // co-newbiz have 100+ skills that exist nowhere upstream) is a legitimate
    // source for its own mirrors — only upstream-orphaned names are residue.
    const projSsotSkills = join(projectDir, 'skills');
    const projSsotNames = new Set<string>(
      existsSync(projSsotSkills)
        ? readdirSync(projSsotSkills).filter((d) => existsSync(join(projSsotSkills, d, 'SKILL.md')))
        : []
    );
    // Retirement discriminator (E2E fleet catch, 2026-09-20): orphaned mirrors
    // split into upstream-RETIRED skills (meeting, audit-workspace, … — safe to
    // prune) and project-authored orphans whose SSOT vanished without a
    // retirement decision (co-newbiz domain skills — content may exist ONLY in
    // the mirror; KEEP-uncertain, needs human review). Prune only the former:
    // a root lifecycle record marked retired/deprecated, or a mirror SKILL.md
    // that self-declares retired/deprecated.
    const isRetiredSkill = (name: string): boolean => {
      const record = join(workspaceRoot, 'docs', 'lifecycle', 'skills', `${name}.md`);
      if (existsSync(record) && / retired | deprecated /i.test(readFileSync(record, 'utf8').slice(0, 4000))) return true;
      const mirrorSkill = join(projectDir, 'skills', name, 'SKILL.md');
      if (existsSync(mirrorSkill)) return false;
      let status = '';
      for (const mirrorRoot of ['.claude', '.gemini', '.agents', '.codex']) {
        const mf = join(projectDir, mirrorRoot, 'skills', name, 'SKILL.md');
        if (existsSync(mf)) {
          const m = readFileSync(mf, 'utf8').match(/^status:\s*(\S+)/m);
          if (m) { status = m[1].toLowerCase(); break; }
        }
      }
      return status === 'retired' || status === 'deprecated';
    };
    for (const d of readdirSync(projMirror)) {
      if (!existsSync(join(projMirror, d, 'SKILL.md'))) continue;
      if (upstreamSkillNames.has(d) || projSsotNames.has(d)) continue;
      if (!isRetiredSkill(d)) continue;
      console.log(`  PRUNE  ${mirrorRoot}/skills/${d}/  (no upstream source — retired skill)`);
      if (!dryRun) {
        const rm = spawnSync('git', ['-C', projectDir, 'rm', '-rf', `${mirrorRoot}/skills/${d}`], { encoding: 'utf8' });
        if (rm.status !== 0) {
          try {
            rmSync(join(projMirror, d), { recursive: true, force: true });
          } catch (e) {
            console.error(`  ERROR: failed to prune ${mirrorRoot}/skills/${d}: ${(e as Error).message}`);
            continue;
          }
        }
      }
      mirrorPruneCount.n++;
    }
  }
  prunedCount += mirrorPruneCount.n;
  if (prunedCount === 0) console.log('');
  console.log('');
}

// ── Post-upgrade: write template-version.txt ───────────────────────────────────
// country= is preserved from the pre-upgrade detection above — rewriting the file
// without it (pre-v1.10.1 behavior) erased the project's country provenance and
// downgraded KR projects to region-neutral on the next upgrade.
if (!dryRun) {
  mkdirSync(join(projectDir, '.claude'), { recursive: true });
  writeFileSync(
    templateVersionFile,
    `variant=${variant}\nversion=${currentVersion}\nplatform=${platform}\ncountry=${detectedCountry}\nupgraded=${new Date().toISOString()}\n`,
    'utf8'
  );
  console.log(`Written: .claude/template-version.txt (version=${currentVersion}, country=${detectedCountry})`);
} else {
  console.log(`[DRY RUN] Would write: .claude/template-version.txt (version=${currentVersion}, country=${detectedCountry})`);
}
console.log('');

// ── Security Bootstrap Verification ───────────────────────────────────────────
console.log('--- Security Bootstrap Verification ---');
let securityPass = true;
function secCheck(label: string, ok: boolean): void {
  console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`);
  if (!ok) securityPass = false;
}

if (dryRun) {
  // 2026-09-15 project review follow-up: bootstrap artifacts (.gitleaks.toml
  // etc.) are only materialized on apply — verifying their existence during a
  // dry run reported spurious FAILED verdicts (and, since the M1 exit-code fix
  // in this same version, a spurious exit 1). Apply mode verifies for real.
  console.log('  SKIP (dry-run): bootstrap artifacts are materialized on apply — verified there.');
} else {
  secCheck('.gitleaks.toml exists', existsSync(join(projectDir, '.gitleaks.toml')));
  secCheck('.githooks/pre-commit exists', existsSync(join(projectDir, '.githooks', 'pre-commit')));
  const ga = existsSync(join(projectDir, '.gitattributes')) ? readFileSync(join(projectDir, '.gitattributes'), 'utf8') : '';
  secCheck('.gitattributes has eol=lf', ga.includes('eol=lf'));
  const gi = existsSync(join(projectDir, '.gitignore')) ? readFileSync(join(projectDir, '.gitignore'), 'utf8') : '';
  secCheck('.gitignore has .env pattern', gi.includes('.env'));

  const hooksPath = spawnSync('git', ['-C', projectDir, 'config', 'core.hooksPath'], { encoding: 'utf8' }).stdout.trim();
  if (hooksPath === '.githooks') {
    console.log('  OK  git core.hooksPath = .githooks');
  } else {
    console.log(`  WARN git core.hooksPath = '${hooksPath}' (expected .githooks)`);
    spawnSync('git', ['-C', projectDir, 'config', 'core.hooksPath', '.githooks']);
    console.log('       -> Auto-fixed: set core.hooksPath to .githooks');
  }
}
console.log('');

// ── WORKSPACE-ONLY SKILL SWEEP (2026-09-21 review C-1) ────────────────────────
// l2_propagate:false skills (create-variant, promote-variant, release-template,
// simulate-pipeline, …) are workspace/L0 lifecycle tooling and must never ship into
// projects. Older scaffolds and the former .codex TEMPLATE TREE SYNC claim leaked
// them into the platform mirrors; sweep every base so existing projects self-heal.
// Stock copies (byte-equal to the L1 mirror or a variant overlay) are removed;
// diverged + locally-modified copies surface a CONFLICT and are kept, mirroring the
// country-prune safety model. `.claude/skills/graft` is exempt (C-CM-05 claude-only
// exception, hand-maintained outside the SSOT and delivered by TEMPLATE TREE SYNC).
// MUST run before the post-upgrade sync-skills.ts invoke so mirrors are regenerated
// from the already-swept skill set.
console.log('--- WORKSPACE-ONLY SKILL SWEEP (l2_propagate: false) ---');
{
  const sweepBases = ['skills', '.claude/skills', '.gemini/skills', '.agents/skills', '.codex/skills'];
  // Keep in sync with NEW_PROJECT_LEGACY_L0_SKILLS in helpers/scaffold-markers.ts.
  const LEGACY_L0_SKILLS = ['simulate-project-creation'];
  let sweptSkills = 0;
  for (const sweepBase of sweepBases) {
    const sweepDir = join(projectDir, sweepBase);
    if (!existsSync(sweepDir)) continue;
    for (const skillName of readdirSync(sweepDir)) {
      if (sweepBase === '.claude/skills' && skillName === 'graft') continue;
      const sweepSkillMd = join(sweepDir, skillName, 'SKILL.md');
      if (!existsSync(sweepSkillMd)) continue;
      let flagged = false;
      try {
        flagged = LEGACY_L0_SKILLS.includes(skillName)
          || /^l2_propagate:\s*false\b/m.test(readFileSync(sweepSkillMd, 'utf8'));
      } catch {
        continue; // unreadable — leave for the next run rather than guess
      }
      if (!flagged) continue;
      const isStockCopy = [
        join(commonDir, '.claude/skills', skillName, 'SKILL.md'),
        join(commonDir, 'skills', skillName, 'SKILL.md'),
        join(templatesDir, 'skills', skillName, 'SKILL.md'),
      ].some(src => existsSync(src) && fileHash(src) === fileHash(sweepSkillMd));
      if (!isStockCopy && isLocallyModified(sweepSkillMd)) {
        console.log(`  ⚠️  CONFLICT ${sweepBase}/${skillName}/  workspace-only skill, locally modified — kept`);
        continue;
      }
      console.log(`  ${dryTag}SWEEP  ${sweepBase}/${skillName}/  (l2_propagate: false — workspace-only)`);
      if (!dryRun) rmSync(join(sweepDir, skillName), { recursive: true, force: true });
      sweptSkills++;
    }
  }
  if (sweptSkills === 0) console.log('  (no workspace-only skills found — nothing to sweep)');
}
console.log('');

// ── Post-upgrade: sync-skills.ts for platform skill distribution ──────────────
const syncSkillsScript = join(projectDir, 'scripts', 'sync-skills.ts');
if (syncChanged > 0 && existsSync(syncSkillsScript)) {
  console.log('--- Post-upgrade: Running sync-skills.ts for platform skill distribution ---');
  if (!dryRun) {
    // T-20260921-016 (review M-18): 30s was too tight for large skill deliveries —
    // a timeout returns status === null, which the old check treated as any other
    // failure. Treat it explicitly as a partial-sync warning and raise the budget.
    const syncResult = spawnSync('bun', ['scripts/sync-skills.ts'], { cwd: projectDir, encoding: 'utf8', timeout: 120000 });
    if (syncResult.status === 0) {
      console.log('  ✅ sync-skills.ts completed successfully');
    } else if (syncResult.status === null && syncResult.signal === 'SIGTERM') {
      console.log('  ⚠️  sync-skills.ts TIMED OUT after 120s — platform mirrors may be PARTIALLY synced. Re-run: bun scripts/sync-skills.ts (inside the project)');
      if (syncResult.stderr) console.log(`  STDERR: ${syncResult.stderr.trim()}`);
    } else {
      console.log(`  ⚠️  sync-skills.ts exited with status ${syncResult.status}`);
      if (syncResult.stderr) console.log(`  STDERR: ${syncResult.stderr.trim()}`);
    }
  } else {
    console.log('  [DRY RUN] Would run: bun scripts/sync-skills.ts');
  }
  console.log('');
}

// ── Delivery manifest (v1.38.0) ───────────────────────────────────────────────
// Record the delivered diff so the project's /sync can recognize an
// upgrade-explained change set (dev-sync step 3.9 auto-E5, R4 of the rollout
// hardening design). Written in apply mode only, before sync-skills runs.
if (!dryRun) {
  try {
    const por = spawnSync('git', ['-C', projectDir, 'status', '--porcelain'], { encoding: 'utf8' });
    const files = (por.stdout || '').split('\n')
      .map(l => l.replace(/^\S+\s+/, '').trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
    mkdirSync(join(projectDir, '.claude'), { recursive: true });
    writeFileSync(
      join(projectDir, '.claude', 'last-upgrade-delivery.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), files }, null, 2) + '\n'
    );
    console.log(`  Delivery manifest written: .claude/last-upgrade-delivery.json (${files.length} path(s))`);
  } catch (err) {
    console.log(`  ⚠️  could not write delivery manifest (${String(err)}) — /sync auto-E5 unavailable for this wave`);
  }
}

// ── Post-upgrade: regenerate the project skill graph ──────────────────────────
// The upgrade just refreshed skills/agents/scripts, so the project-local graph
// is stale until the next /sync — regenerate now (reledgev pipeline-coverage
// review 2026-08-29). Non-fatal: missing bun/generator warns and continues.
const graphGenScript = join(projectDir, 'scripts', 'generate-skill-graph.ts');
if (existsSync(graphGenScript)) {
  console.log('--- Post-upgrade: Regenerating docs/skill-graph.json ---');
  if (!dryRun) {
    const graphGen = spawnSync('bun', ['scripts/generate-skill-graph.ts'], { cwd: projectDir, encoding: 'utf8', timeout: 60000 });
    if (graphGen.status === 0) {
      console.log('  ✅ Project skill graph regenerated');
    } else {
      console.log(`  ⚠️  generate-skill-graph.ts exited with status ${graphGen.status} — the project's next /sync (step 4.65) will regenerate it`);
      if (graphGen.stderr) console.log(`  STDERR: ${graphGen.stderr.trim()}`);
    }
  } else {
    console.log('  [DRY RUN] Would run: bun scripts/generate-skill-graph.ts');
  }
  console.log('');
}

// ── Post-upgrade: regenerate docs/VERSION_MANIFEST.md (T-20260916-010) ────────
// The upgrade just refreshed agents/skills/scripts, so the project's manifest
// (skills↔manifest parity + --check drift gates) is stale until the next
// /sync — regenerate now. This also REPLACES any stub manifest a project
// still carries from the retired template stub class: the generator writes
// the full manifest unconditionally. Non-fatal: missing bun/generator warns
// and continues (same contract as the skill-graph regeneration above).
const manifestGenScript = join(projectDir, 'scripts', 'generate-version-manifest.ts');
if (existsSync(manifestGenScript)) {
  console.log('--- Post-upgrade: Regenerating docs/VERSION_MANIFEST.md ---');
  if (!dryRun) {
    const bunCheck = spawnSync('bun', ['--version'], { encoding: 'utf8', stdio: 'pipe' });
    if (bunCheck.error || bunCheck.status !== 0) {
      console.log('  ⚠️  bun not available — skipping manifest regeneration (the project\'s next /sync step 4.7 will regenerate it)');
    } else {
      const manifestGen = spawnSync('bun', ['scripts/generate-version-manifest.ts'], { cwd: projectDir, encoding: 'utf8', timeout: 60000 });
      if (manifestGen.status === 0) {
        console.log('  ✅ Project VERSION_MANIFEST regenerated (full manifest — replaces any retired stub)');
      } else {
        console.log(`  ⚠️  generate-version-manifest.ts exited with status ${manifestGen.status} — the project's next /sync (step 4.7) will regenerate it`);
        if (manifestGen.stderr) console.log(`  STDERR: ${manifestGen.stderr.trim()}`);
      }
    }
  } else {
    console.log('  [DRY RUN] Would run: bun scripts/generate-version-manifest.ts');
  }
  console.log('');
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('========================================================');
console.log('  Upgrade Complete');
console.log(`  Locked files updated : ${lockedChanged}`);
console.log(`  Merge files processed: ${mergeChanged}`);
console.log(`  Sync files updated   : ${syncChanged}`);
console.log(`  Tree-sync delivered  : ${treeChanged}`);
console.log(`  Preserve files listed: ${preserveListed}`);
console.log(`  W2 harvest candidates: ${w2HarvestLines} variant-only line(s) (informational — see W2 HARVEST above)`);
console.log(`  Country skills pruned: ${countryPrunedSkills}${dryRun ? ' (dry-run count)' : ''}`);
if (pruneRemoved) console.log(`  Files pruned         : ${prunedCount}`);
console.log(`  Security checks      : ${securityPass ? 'PASSED' : 'FAILED (see above)'}`);
if (dryRun) console.log('\n  [DRY RUN] No files were modified.');
// M1 (2026-09-15 project review): a failed security check must not read as a
// green exit for scripted consumers (fleet runners, CI).
if (import.meta.main && !securityPass) process.exit(1);
