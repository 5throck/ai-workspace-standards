# Platform-Parity P1 Bugfixes Design (Step 2 of the Platform-Parity Program)

- **Date**: 2026-09-24
- **Status**: Implemented (2026-09-24 — D1-D7 + Decision A heal delivered in the same change set; one documented deviation: the two healed co-design copies of platform-command-lifecycle-manager carry the WS-05a-mandated content adaptation instead of byte-pure L0 content, whose Verification section names L0-only tooling — follow-up T-20260925-001 tracks the L0 source cleanup)
- **Owner**: Template Architect (design) → Automation Engineer (implementation)
- **Program context**: Step 2 of the approved 4-step platform-parity program. Step 1 (merged PR #1056, commit fa34c967) created `scripts/lib/platforms.ts` 1.0.0. Step 2 fixes the six verified P1 platform bugs (the leak/overwrite class) and heals the live drift the bugs produced. Step 3 expands 12+ verifiers to 4-platform coverage. Step 4 documents the Claude Desktop App surface.
- **Spec id**: `2026-09-24-platform-parity-p1-bugfixes-design` (registry: `docs/specs/registry.json`, source: `architect`)
- **Related ADRs**: ADR-0074 (Universal Design Gate), ADR-0079 (ASD-STE100), ADR-0065 (accessibility), ADR-0070 (preview verification), ADR-0036 (TypeScript-only scripts), ADR-0085 (codex platform policy), T-20260916-008 (mirror uniformity precedent)

---

## 1. Summary

Fix the six verified P1 platform bugs. Each bug omits Codex (or its markers) from a list, a regex, or a copy loop that the other platforms have. The omission class leaks scoped skills into promoted variants (bug 1), skips foreign-variant pruning of `.codex` copies (bug 2), hash-syncs variant `.codex/**` over project-owned files (bug 3), lets the template-tree sync overwrite project `CODEX.md` edits (bug 4), ships workspace-only boundary policy to every scaffold's GEMINI.md and CODEX.md (bug 5), and leaves promoted variants' `.agents`/`.codex` mirrors without four L0-common lifecycle skills (bug 6). Fixes 1, 2, and 6 adopt `PLATFORM_SKILL_BASES` from Step 1's SSOT. Fix 4 adds `CODEX.md` to `MERGE_MANAGED_FILES`. Fix 5 repairs a structure-drifted regex and adds a CODEX branch. The design also heals existing drift (co-design mirrors, the stale `.agents` propagation exclude) and adds one regression test per bug.

## 2. Background

### 2.1 Provenance and verification basis

The six bugs come from the platform-coverage audit. All line numbers were re-verified against commit `506d2e5d` (post Step-1). The audit's pre-Step-1 line numbers shifted; the corrected locations are in §2.2. Two audit claims needed correction during verification:

1. **Bug 5 (GEMINI)**: the audit described L0 GEMINI.md as having "an orphan COMMON-GEMINI:END". The current L0 `GEMINI.md` has proper START/END marker pairs (START `:228`, heading `:229`, END `:235`). The branch regex predates that restructure and silently stopped matching.
2. **Bug 4 (CODEX.md)**: the audit described the overwrite as "merge result destroyed". The live mechanics are worse and simpler: the MERGE pass is currently a **no-op** for CODEX.md (see §2.3), and the blanket tree-sync SYNC overwrite destroys **any** project edit to `CODEX.md`, merged or hand-made.

### 2.2 The six bugs (corrected file:line at `506d2e5d`)

| # | Site (current) | Defect | Consequence |
|---|----------------|--------|-------------|
| 1 | `scripts/project-to-variant.ts:193-207` (`shouldSkip`; root list at `:200-204`) | Scoped-skill exclusion covers `skills/`, `.claude/skills/`, `.gemini/skills/`, `.agents/skills/` — no `.codex/skills/`. The full-pipeline twin `scripts/l3-to-variant-pipeline.ts:274-288` (`matchCountryScopedSkill`) covers all five. | A country-scoped skill (k-dart, k-law, …) in a source project's `.codex/skills/` is counted variant-unique and leaks into the promoted variant. |
| 2 | `scripts/upgrade-project.ts:2611` | Foreign-variant-skill prune iterates `['skills', '.claude/skills', '.gemini/skills', '.agents/skills']` — no `.codex/skills`. | A foreign-variant skill's `.codex` copy survives every prune run. |
| 3 | `scripts/upgrade-project.ts:2078-2081` (`VARIANT_ASSET_DIR_SKIP`) | Skip set lists `.claude`, `.gemini`, `.agents`, `.git`, `.github`, `.githooks` — no `.codex`. So the variant template's top-level `.codex/` directory is treated as a generic variant asset dir. | The VARIANT ASSET DIRS pass hash-syncs variant `.codex/**` over the project (`COPIED`/`UPDATE` verdicts at `:2090-2120`), overwriting project-owned files. This contradicts the `.codex/**` ADD_IF_MISSING policy (`scripts/lib/upgrade-policy.ts:284`) and bypasses `resolveClaim` entirely. |
| 4 | `scripts/lib/upgrade-policy.ts:179-180` (`MERGE_MANAGED_FILES`) | The set is `['CLAUDE.md', 'GEMINI.md', '.gitignore', 'AGENTS.md', 'agents/pm.md']` — `CODEX.md` absent, although the MERGE pass explicitly lists CODEX.md (`scripts/upgrade-project.ts:1249`). | `resolveClaim('CODEX.md')` matches no claim set and falls through to the blanket root-file SYNC claim (`scripts/lib/upgrade-policy.ts:315-317`). The TEMPLATE TREE SYNC pass then hash-compares the raw template CODEX.md against the project copy and wholesale-overwrites on difference (`scripts/upgrade-project.ts:2319-2338`; CODEX.md carries no inline version footer, so the hash branch fires). Every project edit to CODEX.md is silently destroyed on the next upgrade. Full mechanics in §2.3. |
| 5 | `scripts/propagate-to-templates.ts:1140-1151` (Phase B-7 GEMINI branch) | The regex `/---\n\n### \d+\. Workspace & Template Boundary Policy[\s\S]*?<!-- COMMON-GEMINI:END -->/` expects the pre-restructure orphan-END shape. L0 GEMINI.md now has a marker pair (`:228-235`), so the regex never matches — a silent no-op. No CODEX.md branch exists at all (branch list ends at `:1151`; `GOVERNANCE_L1_FILES` at `:1083-1088` already includes CODEX.md). | `templates/common/GEMINI.md:229` and `templates/common/CODEX.md:142` ship the workspace-only "Workspace & Template Boundary Policy" in every scaffold. The CLAUDE branch works (`:1122-1139`); `templates/common/CLAUDE.md:306-313` carries the correct L1 "Project Boundary Policy". Verified non-issue: "Custom Command Error Recovery" and "Windows Platform Requirement" also exist in the L1 CLAUDE.md (`:316`, `:326`) and GEMINI.md copies — they are project-applicable, not L0-only. Only the boundary section is L0-only. |
| 6 | `scripts/helpers/generate-variant.ts:1241-1266` (`copyL0CommonSkills`; platforms const at `:1249`) | `const platforms = ['.claude', '.gemini'] as const`. The four L0-common skills (agent-lifecycle-manager, finishing-a-development-branch, platform-command-lifecycle-manager, platform-skill-lifecycle-manager) are copied to two mirrors only. Sources exist in all four `templates/common/.{claude,gemini,agents,codex}/skills/` (verified). | Promoted variants' `.agents`/`.codex` mirrors lack the four L0-common skills. Live on `templates/co-design`: `.claude`/`.gemini` 7 skills each; `.agents` 4 skills + a stale hand-made `SKILLS.md`; `.codex` 4 skills. The missing trio is finishing-a-development-branch, platform-command-lifecycle-manager, platform-skill-lifecycle-manager. |

### 2.3 Bug 4 overwrite mechanics (verified end-to-end)

1. MERGE pass: `upgrade-project.ts:1244-1259` pushes `CODEX.md` for platform `codex|all` and calls `mergeWorkspaceManaged` (`:1255`).
2. `mergeWorkspaceManaged` (`:1037`) calls `buildMergedTemplateBlocks` (`scripts/lib/managed-block-merge.ts:145`). The managed-pattern table (`managed-block-merge.ts:64-72`) knows COMMON-CLAUDE and COMMON-GEMINI zones but **no COMMON-CODEX pattern**, and CODEX.md carries zero `WORKSPACE-MANAGED` blocks. Result: "Template has no managed markers — skipping" (`:1052`). The merge is a no-op today.
3. TEMPLATE TREE SYNC (`:2250+`): `resolveClaim('CODEX.md')` → blanket SYNC (`upgrade-policy.ts:315-317`). CODEX.md has no inline version footer (`extractInlineVersion` finds nothing), so the hash branch fires: template vs project differ → `UPDATE (content changed)` → raw template overwrites the project file.
4. Fix shape: add `CODEX.md` to `MERGE_MANAGED_FILES`. Then `resolveClaim` returns `{ policy: 'MERGE_MANAGED', pass: 'MERGE' }` (`upgrade-policy.ts:247`), the tree-sync skips it (its pass filter at `upgrade-project.ts:2259` requires `TEMPLATE_TREE_SYNC_PASS`), and the MERGE pass — which already lists CODEX.md — owns delivery. When COMMON-CODEX later joins `MANAGED_PATTERNS` (follow-up, §4), the merge becomes functional with no further claim change.
5. Validator cascade checked: PM-04 managed-block parity (`validate-templates.ts:3836-3921`) extracts `WORKSPACE-MANAGED` blocks only (`managed-block-parity.ts:68-95`) and skips files whose common copy has none. CODEX.md has none, so PM-04 skips it — no new validator failures. Variant absence is compliant (only AGENTS.md mandates presence, `:3877-3882`).

### 2.4 Live drift inventory (decision A inputs)

- `templates/common/.agents/skills/` lacks `simulate-pipeline`; the claude, gemini, and codex mirrors carry it (52 vs 53 entries).
- Cause: the `agents-skills` propagation domain (`scripts/propagation-map.json:167-176`) carries `exclude: ["simulate-pipeline"]` with the note "No L2 variant has .agents/skills/ — workspace-root-only platform skills". Both premises are stale: variants do have `.agents/skills/` now, and the other three mirrors carry the skill.
- History: T-20260916-008 (note preserved at `scripts/propagate-to-templates.ts:517-526`) removed the scope-skip from the claude/gemini/agents mirror domains because three-of-four filtering made the codex mirror diverge (the stale upgrade-project 1.4.1 incident). "Each domain's `exclude` list remains the only carve-out." The agents exclude is a leftover of exactly that eliminated class.
- `simulate-pipeline` frontmatter: `scope: workspace`, `l2_propagate: false` (`skills/simulate-pipeline/SKILL.md`). The "never ship to projects" intent is enforced at **project delivery**, not at the L1 mirror: `new-project.ts:1276-1287` sweeps all five bases post-delivery; `upgrade-project.ts:3036-3073` (WORKSPACE-ONLY SKILL SWEEP, 2026-09-21 review C-1) self-heals existing projects over all five bases; `layer-filter.ts:180-182` filters the `skills/` SSOT domain.
- Live leak already exists: `simulate-pipeline` sits in the `.codex/skills/` mirror of co-newbiz, co-abap, co-architect, and co-deck (verified), delivered from the L1 codex mirror by pre-C-1 sync-skills runs. The upgrade sweep removes stock copies on each project's next upgrade. Variant templates (`templates/co-design`, `templates/co-abap`) do not carry it.

## 3. Goals

1. Close every verified `.codex` omission in the six P1 sites.
2. Adopt `PLATFORM_SKILL_BASES` at the sites where the fix replaces a skill-root list (bugs 1, 2, 6).
3. Make the L1 GEMINI.md and CODEX.md carry the same Project Boundary Policy semantics the L1 CLAUDE.md already has.
4. Restore 4-mirror parity: `templates/common/.agents/skills` gains `simulate-pipeline`; co-design's `.agents`/`.codex` mirrors gain the three missing L0-common skills and lose the stale `SKILLS.md` artifact.
5. One regression test per bug, in the house reproduce-then-fix pattern (AC5a precedent, scaffold-identity spec).
6. Full lifecycle cascade: SCRIPTS.md bumps, L1 snapshots via `propagate:apply`, and all verifications green in one change set.

## 4. Non-goals

1. `verify-platform-lifecycle` and the 12+ verifier expansions — Step 3 (including the `evidence-backport-scan.ts` order question and `verify-country-prune.ts`'s four 4-element literals).
2. Variant SKILLS.md registry authoring (T-009).
3. The codex-settings policy split (`JSON_MERGE` vs SYNC vs ADD_IF_MISSING) and adding COMMON-CODEX to `MANAGED_PATTERNS` (`managed-block-merge.ts:64-72`) — flagged as a follow-up ticket in §8.
4. The VARIANT ASSET DIRS pass's general `resolveClaim` bypass (bug 3's broader class) — follow-up ticket in §8.
5. Variant content decisions beyond the mechanical heal — e.g. `agent-lifecycle-manager` is absent from all four co-design mirrors (pre-existing, unexplained); this spec neither adds nor removes it.
6. Project-side cleanup of the leaked `simulate-pipeline` copies in fleet `.codex` mirrors — the existing C-1 sweep self-heals them; no new mechanism.

## 5. Design decisions

### D1 — Bug 1: adopt `PLATFORM_SKILL_BASES` in `shouldSkip`

Replace the four hardcoded `startsWith` roots with a loop over the five SSOT roots:

```ts
function shouldSkip(rel: string): boolean {
  if (SKIP_PATTERNS.some(p => p.test(rel))) return true;
  for (const scopedSkill of scopedSkills) {
    for (const base of PLATFORM_SKILL_BASES) {
      if (rel.startsWith(`${base}/${scopedSkill}/`)) return true;
    }
  }
  return false;
}
```

Behavior notes: the original `rel === \`skills/${s}/\`` equality check is redundant with `startsWith` (a rel ending in `/` still prefix-matches); dropping it changes nothing. Iterating all five roots adds the missing `.codex/skills` branch. Import `'./lib/platforms.ts'`. Alternative rejected: appending a fifth hardcoded `startsWith` line — it re-plants the duplication Step 1 exists to remove, and the twin in `l3-to-variant-pipeline.ts` already shows the divergence cost.

### D2 — Bug 2: adopt `PLATFORM_SKILL_BASES` in the foreign-variant prune

`scripts/upgrade-project.ts:2611`: replace the 4-element literal with `PLATFORM_SKILL_BASES` (import already present in the file — Step 1 adopted two other sites). The loop body already handles a missing dir (`existsSync` guard) and runs `git rm -rf` per pruned path, so the added `.codex/skills` element behaves like the existing four. Safety guards above the loop (variant.json `skill_manifest` adoption keep, `:2606-2610`) apply unchanged.

### D3 — Bug 3: add `.codex` to `VARIANT_ASSET_DIR_SKIP`; general bypass is a follow-up

Add `'.codex'` to the skip set at `upgrade-project.ts:2078-2081`. Effect: the variant's top-level `.codex/` stops being treated as a generic asset dir; `.codex/**` delivery returns to the policy's ADD_IF_MISSING claim (`upgrade-policy.ts:284`) via TEMPLATE TREE SYNC, and project-owned codex config (co-abap, co-safety per ADR-0076 D4) is never touched.

Scope ruling on the noted resolveClaim bypass: the asset-dir pass never consults `resolveClaim` for any directory it walks (workflows/, regulations/, …), relying on `isLocallyModified` CONFLICT warnings instead. Fixing that inversion is a behavior redesign across every variant asset dir — out of Step-2 scope. With `.codex` added, no *known* asset dir contradicts an explicit policy claim, so the bypass degrades to a latent robustness gap. File a follow-up ticket; do not fix here.

### D4 — Bug 4: add `CODEX.md` to `MERGE_MANAGED_FILES`

One-line change at `upgrade-policy.ts:180`: the set becomes `['CLAUDE.md', 'GEMINI.md', 'CODEX.md', '.gitignore', 'AGENTS.md', 'agents/pm.md']`.

- Claim behavior: `resolveClaim('CODEX.md')` → MERGE_MANAGED (`upgrade-policy.ts:247`) → tree-sync skips → the MERGE pass (which already lists CODEX.md at `upgrade-project.ts:1249`) is the sole delivery channel. The destructive overwrite path (§2.3 step 3) is dead.
- Today the MERGE pass is a no-op for CODEX.md (no recognized managed patterns), so the immediate user-visible effect is: project CODEX.md edits stop being destroyed. When COMMON-CODEX joins `MANAGED_PATTERNS` (§4 follow-up), union-merge starts working with zero further claim work — that is the point of fixing the claim SSOT first.
- Validator cascade: none (§2.3 step 5). PM-04 skips CODEX.md because its common copy carries no WORKSPACE-MANAGED blocks; variant absence stays compliant.
- Alternatives rejected: (a) a dedicated `CODEX_SYNC` claim — adds a policy state for a file whose semantics already match MERGE_MANAGED, and diverges from the CLAUDE/GEMINI model; (b) a `TEMPLATE_ONLY`/`PRESERVE` claim — wrong direction: CODEX.md must receive template updates via the MERGE pass, never become project-frozen.

### D5 — Bug 5: repair the GEMINI regex to the marker-pair structure; add a CODEX branch mirroring the CLAUDE semantics

All three branches live in `applyGovernanceTransforms` Phase B-7 (`propagate-to-templates.ts:1119-1151`), invoked per file of `GOVERNANCE_L1_FILES` (`:1083-1088`, already includes CODEX.md).

1. **GEMINI branch repair.** Match the current marker-pair structure and capture the heading number so a future renumber cannot silently un-match the *replacement's* number:

```ts
const geminiBoundaryPattern =
  /<!-- COMMON-GEMINI:START -->\s*### (\d+)\. Workspace & Template Boundary Policy[\s\S]*?<!-- COMMON-GEMINI:END -->/;
const geminiBoundaryReplacement = (n: string) =>
  `<!-- COMMON-GEMINI:START -->\n` +
  `### ${n}. Project Boundary Policy\n\n` +
  `- **Strict Scope**: Work only within the current project directory.\n` +
  `- **No Cross-Project Modification**: Modifying files outside the project root during a session is forbidden.\n\n` +
  `> For lifecycle management rules, see [docs/context.md — Lifecycle Management](docs/context.md#lifecycle-management).\n` +
  `<!-- COMMON-GEMINI:END -->`;
content = content.replace(geminiBoundaryPattern, (_, n) => geminiBoundaryReplacement(n));
```

2. **CODEX branch.** The CODEX boundary section sits inside the single COMMON-CODEX zone (`CODEX.md:86-173`), not in its own marker pair, so the branch matches heading-to-next-heading and reuses the captured number (current `7`, next heading `### 8. Custom Command Error Recovery` at `:159`):

```ts
} else if (filename === 'CODEX.md') {
  const codexBoundaryPattern =
    /### (\d+)\. Workspace & Template Boundary Policy[\s\S]*?(?=\n### \d+\. )/;
  content = content.replace(codexBoundaryPattern, (_, n) => codexReplacement(n));
}
```

   with `codexReplacement(n)` emitting `### ${n}. Project Boundary Policy` plus the same two bullets and the same `docs/context.md#lifecycle-management` pointer as CLAUDE/GEMINI. The replacement text is written literally; it contains no `CONSTITUTION.md` refs, so Phase A path rewriting cannot mangle it (the current L1 copy shows the rewrite produced a doubled `[docs/context.md](docs/context.md)` pointer — the literal replacement removes that artifact).

3. **Fail loudly, not silently.** This bug's failure mode was a silent no-op. After the B-7 replacements, assert the workspace-policy heading is gone from each of the three outputs; if it survives, `die()` via `scripts/lib/error-handling.ts` (ADR-0054 standard) with the filename. Rationale: the boundary removal is a governance invariant, and Step 3's verifier expansion should not be the first line of defense. Scope note: the guard covers the three platform docs only; AGENTS.md has no boundary section in B-7.

Semantics verified against the CLAUDE branch (`:1122-1139`): replace workspace boundary policy with the two-bullet Project Boundary Policy + lifecycle pointer. The Windows/Git-Bash and Codex-hook content flagged by the audit stays: it exists identically in the L1 CLAUDE.md (`:316`, `:326`) and GEMINI.md copies and describes project-applicable behavior (projects ship `.githooks/` and run scripts via bun). Removing it from CODEX.md only would create a new three-vs-one inconsistency.

### D6 — Bug 6: extend `copyL0CommonSkills` to all four platforms

`generate-variant.ts:1249`: `const platforms = ['.claude', '.gemini', '.agents', '.codex'] as const;`. Everything else stays: the `SKILL.md`-only copy semantics, the workspace `skills/` fallback for agent-lifecycle-manager, and the `existsSync` source guard. Sources verified in all four `templates/common/.*/skills/`. This fixes future promotions; the existing co-design drift is healed out-of-band (§D7), not by re-running generate-variant.

### D7 — Decision A end-state: uniform 4-mirror L1; project-side filtering stays the enforcement layer

**Decision: remove the `simulate-pipeline` exclude from the `agents-skills` domain, fix the stale note, and re-propagate.**

| Option | Pro | Con | Verdict |
|--------|-----|-----|---------|
| Remove exclude + re-propagate | Restores the T-20260916-008 uniformity principle; `platform-mirror-freshness` then enforces 4-way consistency; one-line config change | `simulate-pipeline` bytes sit in all four L1 mirrors | **Adopted** |
| Add excludes to claude/gemini/codex domains (strip it everywhere) | Ideological purity: L0-only skills absent from L1 | Reverses T-20260916-008 and re-creates the stale-mirror asymmetry class; three config edits; breaks mirror-freshness assumptions today | Rejected |
| Document only | Zero risk | Leaves a factually false note and 3-vs-1 drift in place | Rejected |

Rationale: the L1 platform mirrors are uniform snapshots of the L0 platform dirs by design (T-20260916-008 note, `propagate-to-templates.ts:517-526`); "not shipped in scaffolds" is enforced at project delivery by three independent layers (§2.4), none of which reads the L1 mirror's directory listing as permission. The stale fleet `.codex` copies pre-date the C-1 sweep and self-heal at next upgrade.

**Mechanical heal (all byte-copies from `templates/common/`, no content edits):**

1. `templates/common/.agents/skills/` gains `simulate-pipeline` — via `bun run propagate:apply` after the map change (the propagation config lives in `scripts/propagation-map.json`, which is L0-only workspace config; the copy at `templates/common/scripts/propagation-map.json` rides the same apply).
2. `templates/co-design/.agents/skills/` and `templates/co-design/.codex/skills/` each gain `finishing-a-development-branch`, `platform-command-lifecycle-manager`, `platform-skill-lifecycle-manager` — copied from the corresponding `templates/common/.{agents,codex}/skills/` directories. `sync-skills --all-variants` cannot deliver these (it distributes the variant's own `skills/` SSOT, which carries only the 4 variant skills; the L0-common trio comes from `copyL0CommonSkills` at generation time), so a direct copy matching D6's semantics is the correct heal.
3. Delete `templates/co-design/.agents/skills/SKILLS.md` — a stale hand-made registry artifact (Sep 9) that no other mirror carries; per-platform mirrors hold only skill directories.
4. Post-heal inspection: co-design's four mirrors each carry exactly the same 7 skill directories; `templates/common`'s four mirrors each carry the same set including `simulate-pipeline`.

### D8 — Test plan (house pattern: reproduce-then-fix)

Follow `tests/unit/upgrade-tree-sync.test.ts` conventions: temp fixture via `mkdtempSync` + `git init` + `.claude/template-version.txt` seed, spawn the real script with `--dry-run --yes`, assert stdout verdicts. Write each regression BEFORE its fix and show it fail (AC5a precedent, scaffold-identity spec §13).

| Bug | Test home | Reproduce → assert |
|-----|-----------|--------------------|
| 1 | new `tests/unit/project-to-variant-codex-skip.test.ts` | Fixture source project with `docs/workspace-schema.json` declaring one `variant_scoped_skills` entry and `.codex/skills/<entry>/SKILL.md`; run `project-to-variant.ts --source <tmp> --target <fresh-name> --dry-run`. Before fix: the file counts into Variant-unique; after fix: Skipped count includes it. |
| 2 | extend `tests/unit/upgrade-prune-removed.test.ts` (or new `upgrade-foreign-prune-codex.test.ts` if the harness does not fit) | Fixture project with a foreign-variant skill present in all four mirrors (registered in `docs/workspace-schema.json` `variant_scoped_skills` for another variant, absent from own variant.json manifest); dry run `upgrade-project.ts`. Before fix: PRUNE verdicts for 3 mirrors; after fix: 4 including `.codex/skills`. |
| 3 | extend `tests/unit/upgrade-tree-sync.test.ts` | Fixture project with pre-existing `CODEX.md`-adjacent project-owned file under `.codex/` that also exists in the variant template with different content; dry run. Before fix: `UPDATE`/`COPIED` verdict under VARIANT ASSET DIRS; after fix: no asset-dir verdict, ADD_IF_MISSING seed semantics via tree-sync (existing file → untouched). |
| 4 | extend `tests/unit/upgrade-policy.test.ts` (pure `resolveClaim` unit) | `resolveClaim('CODEX.md', 'co-design')` deep-equals `{ policy: 'MERGE_MANAGED', pass: 'MERGE' }`. Plus an integration assert in the bug-3 fixture run: dry-run output contains no `UPDATE`/`COPIED` verdict for `CODEX.md` from TEMPLATE TREE SYNC while a divergent project CODEX.md exists. |
| 5 | new `tests/unit/governance-boundary-l1.test.ts` | Load L0 `GEMINI.md` and `CODEX.md`, run `applyGovernanceTransforms` (export it or test via `--governance-l1 --dry-run` output), assert output contains `Project Boundary Policy`, no `Workspace & Template Boundary Policy`, marker pairs intact for GEMINI, section numbering preserved for CODEX. |
| 6 | new `tests/unit/generate-variant-l0-common-mirrors.test.ts` | Run `copyL0CommonSkills` (export for test or fixture-variant run) into a temp variant dir with the four common sources present; assert all four `.<platform>/skills/<skill>/SKILL.md` exist for the four L0-common skills. |
| A | extend the D7 heal verification | Static inspection asserts (test or documented checklist): co-design 4-mirror set equality; no `SKILLS.md` inside any `templates/co-*/.*/skills/`; `simulate-pipeline` present in all four `templates/common/.*/skills/`. |

Integration addition: one dry-run of `upgrade-project.ts` on the bug-3 fixture asserting the full run exits 0 with the new verdicts — guards against the skip-set change disturbing neighboring passes.

## 6. Requirements (ASD-STE100, ADR-0079)

- R1. Add `.codex/skills` coverage to `shouldSkip` in `project-to-variant.ts`. Adopt `PLATFORM_SKILL_BASES` per D1.
- R2. Replace the 4-element prune literal in `upgrade-project.ts` (foreign-variant skill prune) with `PLATFORM_SKILL_BASES`.
- R3. Add `'.codex'` to `VARIANT_ASSET_DIR_SKIP` in `upgrade-project.ts`.
- R4. Add `'CODEX.md'` to `MERGE_MANAGED_FILES` in `lib/upgrade-policy.ts`. Change no other entry.
- R5. Repair the Phase B-7 GEMINI regex to the marker-pair form of D5. Capture the heading number. Preserve the CLAUDE branch as-is.
- R6. Add a Phase B-7 CODEX.md branch per D5. Emit the Project Boundary Policy block with the same bullets and pointer as the CLAUDE branch.
- R7. Add the post-replacement guard of D5. Fail with a fatal error when the workspace boundary heading survives any of the three outputs.
- R8. Extend `copyL0CommonSkills` platforms to `['.claude', '.gemini', '.agents', '.codex']`.
- R9. Remove the `simulate-pipeline` exclude from the `agents-skills` domain in `scripts/propagation-map.json`. Rewrite the note to state the uniform-mirror rule.
- R10. Heal `templates/co-design/.agents/skills` and `templates/co-design/.codex/skills` per D7. Delete `templates/co-design/.agents/skills/SKILLS.md`.
- R11. Add the regression tests of D8 before the corresponding fix. Show each new test fail pre-fix and pass post-fix in the task report.
- R12. Bump the SCRIPTS.md rows per §7 and run `bun run propagate:apply`. Update the `@version` header comment of each touched script.
- R13. Keep every fix minimal. Do not reorder functions, reformat, or touch neighboring passes.

## 7. Acceptance criteria

- [ ] AC1. `project-to-variant.ts` dry-run on a fixture with a scoped skill in `.codex/skills/` reports it skipped; the regression test (D8 bug 1) passes.
- [ ] AC2. `upgrade-project.ts` dry-run prunes a foreign-variant skill from all four mirrors; the regression test passes.
- [ ] AC3. `VARIANT_ASSET_DIR_SKIP` contains `.codex`; a variant `.codex/**` file that exists in the project no longer receives a VARIANT ASSET DIRS verdict; the regression test passes.
- [ ] AC4. `resolveClaim('CODEX.md', '<variant>')` returns `{ policy: 'MERGE_MANAGED', pass: 'MERGE' }`; a divergent project CODEX.md gets no TEMPLATE TREE SYNC overwrite verdict; the regression tests pass.
- [ ] AC5. After `--governance-l1`, `templates/common/GEMINI.md` and `templates/common/CODEX.md` contain `### N. Project Boundary Policy` with numbering preserved, no `Workspace & Template Boundary Policy`, and intact marker zones; `templates/common/CLAUDE.md:306-313` is byte-identical to its pre-change state; the regression test passes.
- [ ] AC6. All four `templates/common/.{claude,gemini,agents,codex}/skills/` carry `simulate-pipeline`; `bun run propagate:drift` and `propagate:dry-run` report clean.
- [ ] AC7. `templates/co-design` four-mirror inspection: each of `.claude`, `.gemini`, `.agents`, `.codex` carries the same 7 skill directories; no `.agents/skills/SKILLS.md` artifact remains.
- [ ] AC8. The bug-6 regression test proves a generated variant receives the four L0-common skills on all four platforms.
- [ ] AC9. Full battery green (§9): unit tests, integration tests, typecheck, validate-templates, audit, lifecycle-sync-audit, propagate drift/dry-run, marker-rewrite dry, `verify-scripts --verify`.
- [ ] AC10. SCRIPTS.md carries the five version bumps of §7 with one-line change notes; `git diff --stat` shows no files outside §8's list (plus L1 snapshots and the design doc).

## 8. Implementation brief (automation-engineer)

Ordered steps. Write each D8 regression before its fix; record the pre-fix failure in the task report.

1. **Regression tests, batch 1** (bugs 1-4): `tests/unit/project-to-variant-codex-skip.test.ts` (new), `upgrade-prune-removed` extension, `upgrade-tree-sync` extension, `upgrade-policy` extension. Confirm all four fail on current code.
2. **Fix bug 1** — `project-to-variant.ts` D1 (import `./lib/platforms.ts`). Bump `@version` 1.4.1 → 1.5.0.
3. **Fix bug 2** — `upgrade-project.ts:2611` → `PLATFORM_SKILL_BASES`.
4. **Fix bug 3** — `upgrade-project.ts:2078-2081` add `'.codex'`.
5. **Fix bug 4** — `upgrade-policy.ts:180` add `'CODEX.md'`.
6. **Regression test, batch 2** (bugs 5-6): `tests/unit/governance-boundary-l1.test.ts` (new), `tests/unit/generate-variant-l0-common-mirrors.test.ts` (new). Confirm both fail.
7. **Fix bug 5** — `propagate-to-templates.ts` D5 (GEMINI regex, CODEX branch, guard via `die()`). Bump `@version` 2.16.0 → 2.17.0. Run `bun scripts/propagate-to-templates.ts --governance-l1` to regenerate the L1 copies; verify AC5 (CLAUDE.md byte-unchanged).
8. **Fix bug 6** — `generate-variant.ts:1249` four platforms. Bump `@version` 1.17.0 → 1.18.0.
9. **Decision A** — remove the exclude in `scripts/propagation-map.json` (`:167-176`), rewrite the note: "Uniform 4-mirror rule (T-20260916-008): platform mirrors are uniform L0 snapshots; project delivery filters `l2_propagate: false` skills (new-project sweep, upgrade WORKSPACE-ONLY SKILL SWEEP)."
10. **Heal** — D7 steps 2-3: copy the three skills into co-design `.agents`/`.codex` from `templates/common`; delete the stale `SKILLS.md`. Then `bun run propagate:apply` (delivers `simulate-pipeline` into `templates/common/.agents/skills` and refreshes L1 snapshots of the two L0+L1 scripts).
11. **SCRIPTS.md cascade** (verify current values first):

| Script | Current | New | Note |
|--------|---------|-----|------|
| `project-to-variant.ts` (L0) | 1.4.1 | 1.5.0 | codex scoped-skill exclusion (PLATFORM_SKILL_BASES) |
| `upgrade-project.ts` (L0) | 1.46.2 | 1.47.0 | foreign-prune codex + VARIANT_ASSET_DIR_SKIP codex |
| `lib/upgrade-policy.ts` (L0+L1) | 1.12.0 | 1.13.0 | CODEX.md joins MERGE_MANAGED_FILES |
| `propagate-to-templates.ts` (L0) | 2.16.0 | 2.17.0 | B-7 GEMINI regex repair + CODEX branch + guard |
| `helpers/generate-variant.ts` (L0+L1) | 1.17.0 | 1.18.0 | copyL0CommonSkills → four platforms |

12. **Verification battery** (§9) and the healed-state inspection (AC6, AC7).
13. **File two follow-up tickets** (do not implement): (a) codex-settings policy split — COMMON-CODEX in `MANAGED_PATTERNS` + `.codex/config.toml`/`.codex/hooks.json` policy adjudication; (b) VARIANT ASSET DIRS `resolveClaim` bypass.

## 9. Verification plan

Run in order; all must pass.

| # | Check | Command | Pass state |
|---|-------|---------|------------|
| 1 | Unit tests | `bun run test:unit` | green, incl. 3 new files + 3 extensions |
| 2 | Integration tests | `bun run test` | green |
| 3 | Typecheck | `bun scripts/typecheck.ts` | green |
| 4 | Template validation | `bun run validate-templates` | green (PM-04 CODEX.md skip confirmed harmless) |
| 5 | Workspace audit | `bun run audit` | green (spec-check with this registered doc) |
| 6 | Lifecycle sync audit | `bun scripts/lifecycle-sync-audit.ts` | green |
| 7 | Propagation drift | `bun run propagate:drift` | clean |
| 8 | Propagation dry-run | `bun run propagate:dry-run` | clean |
| 9 | Marker-rewrite dry | `bun scripts/propagate-to-templates.ts --marker-rewrite --dry-run` | no unexpected rewrites |
| 10 | Governance L1 dry-run | `bun scripts/propagate-to-templates.ts --governance-l1 --dry-run` | reports GEMINI.md and CODEX.md transforms; no fatal guard trip |
| 11 | Healed-state inspection | AC6 + AC7 checks (4-way mirror set equality, co-design trio present, no SKILLS.md artifact) | all equal |
| 12 | Script registry verify | `bun scripts/verify-scripts.ts --verify` | green |

## 10. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — the CLAUDE.md propagation path is already correct and is byte-preserved (AC5); no Claude-facing surface changes | N/A |
| Antigravity (GEMINI.md) | **Yes** — `templates/common/GEMINI.md` loses the workspace boundary policy and gains the Project Boundary Policy (D5); propagates to every fresh scaffold | `templates/common/GEMINI.md`, `scripts/propagate-to-templates.ts` |
| Codex | **Yes** — CODEX.md gains MERGE_MANAGED claim (project edits survive upgrades), the L1 boundary-policy replacement, prune/asset-dir/scaffold coverage, and mirror parity | `scripts/lib/upgrade-policy.ts`, `templates/common/CODEX.md`, `scripts/upgrade-project.ts`, `scripts/project-to-variant.ts`, `scripts/helpers/generate-variant.ts`, `scripts/propagation-map.json` |
| templates/common | **Yes — propagation required**: updated L1 copies of `CODEX.md`, `GEMINI.md`, `scripts/lib/upgrade-policy.ts`, `scripts/helpers/generate-variant.ts` via `bun run propagate:apply`; `templates/common/.agents/skills/simulate-pipeline/` restored | 5 files + 1 new skill dir |

Justification for the one "None" row: the CLAUDE surface is the reference implementation this spec mirrors onto GEMINI/CODEX; touching it would break the byte-preservation assertion.

## 11. Exemptions

- **Accessibility (ADR-0065): exempt.** This is a backend script and propagation fix with no UI, CLI output format, or document surface change for end users. No interaction area is affected.
- **Preview verification (ADR-0070): exempt.** No rendered UI exists or changes. Verification is the executed battery in §9 plus the healed-state file inspection (AC7).

## 12. Trade-offs summary

| Decision | Chosen | Main alternative | Why chosen |
|----------|--------|------------------|------------|
| D1 shouldSkip shape | Loop over `PLATFORM_SKILL_BASES` | Append a 5th hardcoded root | SSOT adoption prevents the next drift; twin site already diverged once |
| D3 bypass scope | `.codex` only; general bypass → ticket | Fix resolveClaim consultation for all asset dirs | Behavior redesign across every variant; no known active contradiction after `.codex` |
| D4 claim | `MERGE_MANAGED_FILES` membership | New CODEX_SYNC policy state | Matches the CLAUDE/GEMINI model; claim SSOT fixed before merge machinery lands |
| D5 CODEX branch | Mirror CLAUDE semantics; keep Windows/Git-Bash sections | Strip all L0-flavored sections | Windows sections exist in L1 CLAUDE/GEMINI too; stripping only CODEX re-creates asymmetry |
| D5 failure mode | Fatal guard on surviving workspace heading | Wait for Step 3 verifiers | Silent no-op was the bug; a one-line guard is cheaper than a repeat |
| D7 simulate-pipeline | Remove exclude (uniform mirrors) | Exclude from all four | T-20260916-008 settled the uniformity principle; project-side filtering is the enforcement layer |
| Heal mechanism | Direct copy for co-design trio | `sync-skills --all-variants` | The trio is L0-common, not in the variant SSOT; --all-variants cannot deliver it |

## 13. Open questions

None blocking. Two judgment calls are recorded with their rulings: the D3 scope split (fix `.codex` now, ticket the bypass) and the D5 guard severity (fatal, not warn — the guard runs only in the explicit `--governance-l1` deployment path).

## References

- `scripts/lib/platforms.ts` (Step 1 SSOT; `PLATFORM_SKILL_BASES`, `PLATFORM_MIRROR_DIRS`)
- `scripts/l3-to-variant-pipeline.ts:274-288` (five-root reference implementation)
- `scripts/lib/upgrade-policy.ts:179-180, :247, :284, :315-317` (claim SSOT)
- `scripts/lib/managed-block-merge.ts:64-72, :145` (managed-pattern table; CODEX absence)
- `scripts/propagate-to-templates.ts:517-526, :1083-1088, :1119-1151` (T-20260916-008 note; governance-l1 file list; Phase B-7)
- `scripts/propagation-map.json:167-176` (agents-skills exclude)
- `tests/unit/upgrade-tree-sync.test.ts` (fixture/spawn test conventions); scaffold-identity spec §13 AC5a (reproduce-then-fix precedent)
- ADR-0074, ADR-0079, ADR-0065, ADR-0070
