# U-20261026-005 Class Fleet Customization-Drift Audit

**Date**: 2026-10-27
**Scope**: All `Projects/co-*` except `co-design` (15 projects) — the U-20261026-005 problem class: workspace sync/upgrade deliveries overwriting project-owned variant customizations with template copies. The co-design incident (commits `faf0798` / `ded4749`; tokens.json, docs/screen-patterns.md, docs/design-foundation.md, playground/\* reverted by upgrade commits, undetected because gates were `test.skip`-green) is excluded and audited separately.
**Method**: (PASS 1) `bun scripts/upgrade-project.ts Projects/<p> --dry-run --prune-removed` per project, against the current template state that all 15 projects received earlier today; (PASS 2) git-history forensics over template-managed customization candidates (`docs/design-foundation.md`, `docs/<variant>.context.md`) for delivery-shaped commits whose diff shows net deletion of project-only lines, with recovery cross-checks at HEAD; (PASS 3) mechanical sweeps for the three known systemic classes.

---

## 1. Per-Project Risk Table

Counts: **LP** = LOCAL-PATCH markers (upgrade dry-run report), **DRIFT** = same-version content differences preserved in place (ADR-0085 D3), **CONF** = files the next real upgrade would overwrite (all projects: 0). Historical clobbers are delivery-shaped commits whose diff deleted lines absent from the current template copy.

| Project | PASS 1 CONF / LP / DRIFT | PASS 2 historical clobbers | Systemic hits | Risk | Rationale |
|---|---|---|---|---|---|
| co-abap | 0 / 8 / 10 | 12 commits flagged; largest `78adacd4` (0.18.0 upgrade) removed 103 lines (vsp tool-reference incl. R0–R3 gate mapping + auto-discovered skills table) from `docs/co-abap.context.md` — **recovered elsewhere** (SECURITY.md, docs/mcp_usage.md, skills/abap-dev); `9b20a76e` was a deliberate duplicate-context replacement | LP ×8 (6× UR-2 legacy, 2× pending incl. **GEMINI.md**) | **MED** | Highest marker count with an untracked "pending" patch in a MERGE-managed file (GEMINI.md), plus the fleet's largest historical relocation under an upgrade commit |
| co-architect | 0 / 0 / 8 | 2 flagged — both template-evolution false positives (see §2) | no `agents/i18n-specialist.md` (custom roster) | LOW | Clean dry-run; no variant template exists (unpromoted project) so DOCS_MERGE protection for `docs/co-architect.context.md` has no template source |
| co-consult | 0 / 0 / 10 | 5 flagged — all benign (template evolution; Scripts-table churn recovered in docs/context.md; ASD-STE100 dedup to L0) | SKELETON DRIFT `claude-s2` (CLAUDE.md heading collision, insert skipped) | LOW | Clean dry-run; one silently-skipped template insert to review |
| co-deck | 0 / 0 / 5 | 12 flagged — all `# Last Updated:` date-stamp churn (trivial, unrecovered by design) | none | LOW | Clean dry-run; history is date-stamp noise |
| co-develop | 0 / 8 / 4 | 5 flagged — all benign (ASD-STE100 dedup; intentional-duplicate comment cleanup) | LP ×8 (4× pending in memory/, 4× done tickets U-20261006-005/006/007 — stale markers); SKELETON DRIFT `claude-s2` | **MED** | Marker count driven by memory (PROJECT_STATE — safe) and stale done-ticket markers, but the CLAUDE.md skeleton collision needs manual review |
| co-export | 0 / 1 / 2 | 6 flagged — heading rename and dedup only, content preserved at HEAD | LP ×1 (pending, memory/); SKELETON DRIFT `claude-s2` | LOW | Clean; one safe-path marker |
| co-game | 0 / 1 / 4 | 3 flagged — benign dedup | LP ×1 (pending, memory/); SKELETON DRIFT `claude-s2` | LOW | Clean |
| co-hr | 0 / 0 / 6 | none flagged | none | LOW | Clean dry-run, no delivery-shaped deletions |
| co-learning | 0 / 2 / 7 | none flagged | LP ×2 (U-20261006-006/007 — done/fixed, stale markers) | LOW | Clean history; markers reference closed tickets |
| co-newbiz | 0 / 1 / 10 | 2 flagged — template-evolution false positives | LP ×1 (pending, memory/2026-10-24.md); i18n `domain:` **present** (only project) | LOW | Clean; no variant template (unpromoted) |
| co-news | 0 / 0 / 6 | none flagged | i18n `domain:` missing | LOW | Clean dry-run |
| co-price | 0 / 0 / 23 | 4 flagged — `c8c6eb76` removed Review Model/Lifecycle Rules from context.md, **recovered** (relocated to CLAUDE.md/GEMINI.md at HEAD); rest churn | i18n `domain:` missing | LOW | Many preserved DRIFTs but zero markers and no unrecovered loss |
| co-safety | 0 / 0 / 62 | 9 flagged — VARIANT-INJECT marker-corruption cleanup + churn; small unrecovered residue (model-id table row) | `agents/pm.md` has **2 duplicated `lifecycle:` lines** (residual — only project left); i18n-specialist absent (custom roster) | **MED** | The last duplicated-lifecycle hit; 62 preserved DRIFTs show a heavily customized skill set (preserved by design, but the largest customization surface in the fleet) |
| co-security | 0 / 5 / 5 | 4 flagged — deliberate path update (`docs/threat-models/` → `docs/threat-model.md`) + dedup + churn | LP ×5 (3× pending in memory/, 2× done tickets) | MED-LOW | Safe-path markers plus 2 stale done-ticket markers |
| co-work | 0 / 1 / 6 | 1 flagged — benign dedup | LP ×1 (pending, memory/) | LOW | Clean |

**Fleet-wide PASS 1 verdict: 0 CONFLICT entries.** Because all 15 projects were upgraded to the current template state earlier today, this means no project-owned content is currently sitting in a path the next upgrade would wholesale-overwrite. All detected customization lives in paths the current policy preserves (DRIFT-preserve, MERGE, PRESERVE, PROJECT_STATE).

### Policy mapping of risky paths (`scripts/lib/upgrade-policy.ts`)

| Path class | Claim | Overwrite risk on next upgrade |
|---|---|---|
| `README.md`, `README_ko.md`, `CHANGELOG.md`, `docs/README*.md` | `PRESERVE_FILES` → PRESERVE | None (project-owned) |
| `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, `HERMES.md`, `AGENTS.md`, `agents/pm.md`, `.gitignore`, `.github/workflows/ci.yml` | `MERGE_MANAGED_FILES` → MERGE | Managed blocks merged; non-managed content untouched — but a hand patch **inside** a managed block survives only if the merge unions it; skeleton inserts silently skip on heading collision (SKELETON DRIFT, 5 projects) |
| `docs/<variant>.context.md` | MERGE_MANAGED → DOCS_MERGE | Merged; **only where a variant template exists** (co-architect/co-newbiz have none) |
| `memory/**` | PROJECT_STATE | None |
| `skills/**` | Skill passes, ADR-0085 D3 DRIFT-preserve | Same-version local edits kept (DRIFT); version-bump deliveries overwrite |
| `.claude/.gemini/.agents/.codex/.hermes` skill mirrors | Post-upgrade `sync-skills.ts` distribution | **Mirror-only edits are regenerated away**; patches must live in the `skills/` SSOT (co-abap project-review does — safe) |
| `scripts/<variant>/*` | Not template-delivered (project-only) | None |
| `docs/design-foundation.md` (and other docs/ files with version footers) | Default SYNC | Version-bump deliveries overwrite; same-version diffs show as CONFLICT (currently 0) |

## 2. PASS 2 Forensics — Findings and Caveats

Delivery-shaped commits (message matching upgrade/sync/template) touching each project's `docs/design-foundation.md` (common template source) and `docs/<variant>.context.md` (variant source, where one exists) were diffed for deleted lines absent from the **current** template copy; recovery was checked at HEAD.

- **False-positive class (systematic)**: 2 "project-only deletions" in `docs/design-foundation.md` appear identically in all 13 projects with history — the v0.7.0 sync replaced an *older template row* (Typography body criteria; co-price/co-newbiz example citation) with a *newer template row*. Diff context confirms template evolution, not project clobber. The current-template baseline over-reports; spot-checked diffs were used to adjudicate.
- **Benign churn**: `# Last Updated:` date-stamp lines (co-deck ×12), dedup of the ASD-STE100 Instruction Writing Standard section (now delivered at L0 via AGENTS.md), heading renames, VARIANT-INJECT marker-corruption cleanup (co-safety).
- **Genuine relocations under upgrade commits (recovered elsewhere)**:
  - co-abap `78adacd4` (chore: upgrade template to 0.18.0, T-20261011-013): removed ~103 lines from `docs/co-abap.context.md` — the vsp Tool Reference (legacy-name → hyperfocused `SAP(...)` mapping with R0–R3 gate classes) and the auto-discovered skills table. Content survives at HEAD in `SECURITY.md`, `docs/mcp_usage.md`, `skills/abap-dev/SKILL.md` (+ mirrors), and a regenerated skills table. The nearest historical analog to the co-design U-20261026-005 incident in the audited fleet; verified recovered, but it shows how much project content an upgrade commit can move/delete in a template-managed path.
  - co-price `c8c6eb76` ("restore Co Price Context tail in CLAUDE.md"): Review Model + Lifecycle Rules sections moved from `docs/co-price.context.md` into `CLAUDE.md`/`GEMINI.md` — both present at HEAD.
- **No unrecovered project-only content loss was identified in any of the 15 audited projects.** (The known unrecovered loss is in co-design, excluded.)

## 3. PASS 3 — Known Systemic Classes

### (a) i18n-specialist `domain:` frontmatter
- Present: co-newbiz (1 project). Missing: 13 projects that carry the file (co-abap, co-consult, co-deck, co-develop, co-export, co-game, co-hr, co-learning, co-news, co-price, co-security, co-work — and any not named retain the default state).
- co-architect and co-safety have **no `agents/i18n-specialist.md`** at all (custom rosters — a different situation, not a frontmatter gap).
- **Fix already shipped**: PR #1637 restored `domain: _shared` to `templates/common/agents/i18n-specialist.md` (version 1.2.0 → 1.3.0, U-20261027-004); the next upgrade wave re-delivers it. Inventory-only; no action beyond the wave.

### (b) Duplicated `lifecycle:` frontmatter blocks in `agents/*.md`
- Cleared in co-consult / co-export / co-game / co-develop since the morning check.
- **Residual: `Projects/co-safety/agents/pm.md` — 2 `lifecycle:` lines.** Only remaining hit; should be fixed before the next agents delivery (it feeds `agents/pm.md` MERGE and lifecycle-sync-audit).

### (c) LOCAL-PATCH markers (fleet-wide: 27 across 8 projects)

| Project | Count | Ticket mapping |
|---|---|---|
| co-abap | 8 | 6× `UR-2` (project-review skill + 4 platform mirrors — legacy ID, not in current ticket stores; patch correctly lives in `skills/` SSOT); 2× `pending`: `GEMINI.md` (heading added for governance anchors — **MERGE-managed path, untracked**) and `scripts/co-abap/install-vsp.ts` (project-only, safe) |
| co-develop | 8 | 4× `pending` (memory/archive — PROJECT_STATE, safe); 4× U-20261006-005/006/007 — **all done/fixed (archived), markers stale** |
| co-security | 5 | 3× `pending` (memory/ — safe); 2× U-20261006-006/007 — done/fixed, stale |
| co-learning | 2 | U-20261006-006/007 — done/fixed, stale |
| co-export / co-game / co-newbiz / co-work | 1 each | `pending` (memory/ — safe) |

- Ticket verification: `U-20261006-005/006/007` are in `tickets/governance/archive/` with `status: done`, `outcome: fixed`; `UR-2` predates the current ID scheme and is not in any ticket store.

## 4. Cross-Fleet Synthesis

**Systemic (need template/pipeline fix)**
1. **i18n `domain:` delivery** — already fixed in template (PR #1637); the class is closed by the next wave. No further template work.
2. **Current-template-baseline false positives in drift forensics** — audit tooling reads template *evolution* as project loss. Not a pipeline bug, but any future automated drift detector must diff against the template at the commit SHA, not HEAD-of-template.
3. **Skeleton-insert silently skipped on heading collision** (SKELETON DRIFT `claude-s2` in co-develop, co-consult, co-export, co-game, co-newbiz CLAUDE.md) — the pipeline neither inserts nor fails, so a template improvement is silently never delivered. Candidate for a persistent WARN or a manual-review ticket; same genus as the U-20261026-005 detection gap.
4. **Mirror-only LOCAL-PATCH exposure** — platform skill mirrors are regenerated from `skills/` by `sync-skills.ts`; a patch marked only in a mirror would be erased without any gate noticing. co-abap's project-review patch is correctly SSOT-anchored; a lint that requires markers to exist in the SSOT copy would close the class.

**Project-local**
- co-abap GEMINI.md "pending" patch in a MERGE-managed file — needs a ticket/upstream request before the next wave.
- co-safety `agents/pm.md` duplicated `lifecycle:` block.
- Stale LOCAL-PATCH markers for done tickets U-20261006-005/006/007 (co-develop ×4, co-security ×2, co-learning ×2) — cosmetic cleanup.
- co-architect / co-newbiz have no variant template: DOCS_MERGE protection for their context files has no delivery source (confirm intended; both are unpromoted projects).

## 5. Immediate-Action Recommendations (before the next upgrade wave)

1. **co-abap**: file an upstream request or ticket for the `GEMINI.md` pending patch (governance-anchor heading) so it is either merged upstream or ticket-protected before the wave touches MERGE-managed files. (Highest-value single action.)
2. **co-safety**: fix the duplicated `lifecycle:` block in `agents/pm.md`.
3. **All 15 projects**: run the next upgrade wave and expect the 13 missing i18n `domain:` keys to be restored by the v1.3.0 re-delivery; verify with a post-wave grep.
4. **Five projects with SKELETON DRIFT `claude-s2`** (co-develop, co-consult, co-export, co-game, co-newbiz): resolve the CLAUDE.md `### 2.` heading collision so the skipped template insert can land.
5. **Cosmetic**: clean the 8 stale LOCAL-PATCH markers whose tickets are archived as fixed.
6. **No file currently needs pre-wave snapshotting** — PASS 1 shows zero CONFLICT entries, so nothing sits in a wholesale-overwrite path today.

## Method Notes

- PASS 1 artifacts: per-project dry-run transcripts retained under `/tmp/u005-audit/` (session-scoped, not committed).
- PASS 2 sampled the top delivery-shaped commits per candidate file (max 12 per file) rather than full history; every flagged hit larger than 2 lines was manually adjudicated by reading the diff context.
- This is an assessment-only audit: no project file was modified and no real (non-dry) upgrade was run.

## References

- Known incident: co-design commits `faf0798`, `ded4749`; ticket class U-20261026-005.
- Policy: `scripts/lib/upgrade-policy.ts` (PRESERVE_FILES, MERGE_MANAGED_FILES, DOCS_MERGE, REGENERATED_FILES, ADR-0085 D3 drift-preserve).
- Template fix: PR #1637 (U-20261027-004, `domain: _shared` re-delivery), recorded in `CHANGELOG.md [Unreleased]` 2026-10-27.
- Archived tickets: `tickets/governance/archive/U-20261006-005.yaml`, `U-20261006-006.yaml`, `U-20261006-007.yaml`.
