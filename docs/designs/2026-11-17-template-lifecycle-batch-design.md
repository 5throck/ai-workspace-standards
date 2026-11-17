---
last_updated: 2026-11-17
---

# Template Lifecycle Batch — Design (T-20261116-001/002/003/004)

- **Spec id**: `2026-11-17-template-lifecycle-batch-design`
- **Status**: Implemented (2026-11-17 — ruled by architect at the Design Gate, PM Row 0, TEMPLATE LIFECYCLE batch; decision record [DEC-20261117-05](../decisions/DEC-20261117-05.md))
- **Input tickets**: T-20261116-001 (COMMON-CLAUDE Last Updated merge), T-20261116-002 (commit-msg first paragraph), T-20261116-004 (co-learning workflows.md zone override), T-20261116-003 (variant shadow healing PRs)
- **Design reference**: [`2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md`](2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md) §8 (follow-ups), PRs #2045–#2047
- **Parallel batches**: DEC-20261117-03 / DEC-20261117-04 (co-deck PDF batch, external-deps batch) own their own DEC numbers and O-1..O-6; this batch uses DEC-20261117-05 and O-7..O-10.

## 0. Summary

Four governance backlog tickets from the 2026-11-16 dev-sync/upgrade/shadow batch. Every ticket's evidence was re-verified against current code before designing; two claims were confirmed exactly, two were refined (T-002's failure mode is a sed range semantics detail, T-001's loss happens in the equal-count positional branch of the managed-block merge). The batch is design-only: it produces one mechanism design (docs zone override), one merge-lib change design (Last Updated monotonic guard), one hook-pipeline fix design, and a phased shadow-healing plan whose phase 1 is fully mechanical. Owner decisions O-7..O-10 carry the four direction calls; each states a default that applies if the owner does not object.

## 1. Ticket verification matrix

| Ticket | Claim | Verdict | Evidence (file:line) |
|--------|-------|---------|----------------------|
| T-001 | COMMON-CLAUDE merge drops the newer Last Updated date | **Confirmed** (empirical) | The `*Last Updated:` line sits INSIDE the last COMMON-CLAUDE zone: `templates/common/CLAUDE.md:359-367` (line 366). The merge replaces unlabeled zones template-wins positionally: `scripts/lib/managed-block-merge.ts:478-497` (equal-count branch). Reproduced with the real `mergeManagedBlocks()` on a divergent block: project `Last Updated: 2026-11-17` was replaced by template `2026-11-12`. |
| T-002 | `tail -n +2 \| sed '1,/^$/d'` on "subj, blank, para one, blank, para two" returns only "para two" | **Confirmed** (empirical) | `.githooks/commit-msg:9`. `sed 1,/^$/d` does not end the range on the start line even when the end regex matches there — the end match search begins on the line AFTER the range start, so the range runs to the second blank line and deletes "para one" with it. Live pipeline test on the exact hook expression returns only `para two`. |
| T-004 | co-learning `docs/governance/agents/workflows.md` is a frozen 150+-line shadow; only a 29-line Stream Boundaries insertion differs | **Confirmed** | `templates/co-learning/docs/governance/agents/workflows.md` is 255 lines vs common 226; `diff templates/common/… templates/co-learning/…` yields exactly one hunk (`123a124,152`, 29 lines) lying wholly inside the existing `VARIANT-ROLE-BOUNDARY-START/END` zone (co-learning :120–:153; common :120–:124, empty). |
| T-003 | 249 undeclared copies, 133 paths, 12 variants; 95 frontmatter-only | **Confirmed** (live run) | `bun run validate-templates` on 2026-11-17: 12 `variant-common-shadow` WARNs summing to 249 instances / 95 frontmatter-only across 12 variants; per-path aggregation of the same check's data gives exactly 133 unique paths. Refinement: the "95 frontmatter-only" is an instance count — 108 unique paths are frontmatter-only in ALL their instances; the remaining 25 paths carry real content drift (154 instances). |

All three follow-up titles in the reference design §8 match these tickets; no ticket references a defect that has since been fixed by #2045–#2047.

## 2. Work item A — T-20261116-001: COMMON-CLAUDE merge keeps the newer Last Updated date

### 2.1 Root cause (verified)

The managed-block merge (scripts/lib/managed-block-merge.ts, v1.6.0) replaces managed-block content template-wins. `templates/common/CLAUDE.md` carries its `*Last Updated: …*` provenance line inside the last COMMON-CLAUDE zone (:359–:367), so the line rides inside the replaced span. When a project's copy has diverged (project-side edit stamped with a newer date), the equal-count positional replace (managed-block-merge.ts:478–497) overwrites the whole block — including the newer date — with the template's older block. Verified empirically through the real merge function.

Scope note (platform mirror): only CLAUDE.md is affected. GEMINI.md's `*Last Updated:` line is OUTSIDE the COMMON-GEMINI zones (templates/common/GEMINI.md:377; zones end :322) and is protected by the instruction-region census gate; CODEX.md and HERMES.md carry no Last Updated line. No variant template carries CLAUDE.md (delivery source is always templates/common), so the fix is delivery-side only — no template content change.

### 2.2 Proposed change (O-7 default: Option A)

**Option A (default) — monotonic date guard in the merge lib.** Bump `scripts/lib/managed-block-merge.ts` 1.6.0 → 1.7.0. In the two template-wins replace paths (keyed by-key replace :404–:414 and equal-count positional :478–:497), after computing the replacement span: extract `\*Last Updated: (\d{4}-\d{2}-\d{2})` from both the project span and the template block; if the project's date is strictly NEWER, splice the project's Last Updated line into the replacement — template prose still wins for all other lines, the newer date line wins verbatim. Log a `RESTAMPED Last Updated (project newer) …` line. The count-mismatch destructive reconcile is out of scope (it already carries WARNING + snapshot + recovery file). Pure-lib change; the caller (upgrade-project.ts `mergeWorkspaceManaged`) needs no change beyond a minor version bump for the decision-log surface if a TEMPLATE_DELTA-style row is wanted (optional — keep v1.6.0's restamps[] semantics untouched; the date guard is a span-local correction, not a restamp).

- Rationale: the date's meaning is "when did this file's content last change" — a project-side newer stamp means the project's provenance record is younger than the template's; dropping it falsifies provenance even though the template content is authoritative for prose. Keeping the newer date is monotonic, idempotent (second run: template date >= project date → no-op), and zero-risk to prose.
- Idempotency proof obligation: after the merge, the block's date is max(both sides); a re-run sees equal dates and does nothing.

**Option B (rejected as default, recorded)** — move the Last Updated line OUTSIDE the COMMON-CLAUDE:END marker in templates/common/CLAUDE.md. Rejected: the line would never propagate to project copies again (out-of-zone content is census-gated), and existing projects would keep stale dates forever; it also churns every project copy on the next upgrade.

### 2.3 Test plan

- Unit (tests/): divergent block, project date newer → merged block keeps template prose + project date + `RESTAMPED` log line. Project date older → template date, no extra log line. Missing dates on either side → template line, no log. Idempotency: second merge call on the merged content is a no-op (`merged: false` for that block).
- Existing managed-block-merge tests stay green (the lib's log-line contract is additive).

### 2.4 Risks

A project stamps a newer date while the template carries a NEWER content change: the merged block gets template prose with the project's older date (template date < project date fails the guard, template date wins) — correct: the content is now template's, so the template's provenance applies. No reversal risk.

## 3. Work item B — T-20261116-002: commit-msg keeps the first body paragraph

### 3.1 Root cause (verified)

`.githooks/commit-msg:9`:

```
COMMIT_BODY=$(tail -n +2 "$COMMIT_MSG_FILE" | sed -e '1,/^$/d' -e '/^#/d' | sed 's/^[[:space:]]*//' | head -5)
```

In a `START,END` sed range, the END regex match search begins on the line AFTER the line where START matched. The tail stream begins with the blank line after the subject; that blank line is line 1 (START), and since the end match cannot land on the start line, the range extends to the SECOND blank line — deleting blank + "para one" + blank. Empirically confirmed on the exact expression: the pipeline returns only "para two".

Effect surface: the memory auto-log only — PURPOSE (`COMMIT_BODY | head -1`, .githooks/commit-msg:60–68) becomes "para two" instead of the real first paragraph, and the DECISIONS/ISSUES greps (:46–:56) never see "Why:/Issue:" markers that live in the first paragraph. The commit itself, CHANGELOG, and language gate are unaffected.

### 3.2 Proposed change (O-8 default: Option A)

Replace the leading-blank stripping with an awk filter that is explicit about "skip blanks only BEFORE the first content line" (verified portable behavior on macOS BSD sed where the `0,/re/` extension alternative proved unreliable in testing):

```
COMMIT_BODY=$(tail -n +2 "$COMMIT_MSG_FILE" | sed -e '/^#/d' \
  | awk 'found {print; next} /^[[:space:]]*$/{next} {found=1; print}' \
  | sed 's/^[[:space:]]*//' | head -5)
```

Semantics: drop comment lines, drop blank lines only until the first non-blank line, keep every paragraph afterwards (including internal blanks). Everything else in the hook stays byte-identical (extra-review note honored: this is the only edited expression).

Fan-out (platform mirror):
- **L0 root** `.githooks/commit-msg` — the fix.
- **L1 mirror** `templates/common/.githooks/commit-msg` — currently byte-identical to root (verified); parity is enforced by lifecycle-sync-audit Check G (CRLF-normalized byte parity), so both move in the same commit.
- **Projects** — 16 `Projects/*/.githooks/commit-msg` copies exist and are all byte-identical to root today (verified). `.githooks/**` is a LOCKED upgrade claim (scripts/lib/upgrade-policy.ts:741 area: `LOCKED_FILES.has(rel) || underDir(rel, ".githooks")` → LOCKED), so upgrades never overwrite them; healing needs an explicit per-project re-delivery. Out of phase 1 — recorded as a follow-up ticket; project copies keep working (they have the same memory-log defect but that is a local provenance-quality issue, not a governance violation).

### 3.3 Test plan

- Reproduce: message "subj\n\npara one\n\npara two" → COMMIT_BODY is "para one\n\npara two"; PURPOSE = "para one".
- Regression: message with git trailing comments (`#\n# On branch…`) still strips them; message with no body → PURPOSE falls to the conventional-commit case block; message with leading-whitespace body lines still trimmed.

### 3.4 Risks

DECISIONS/ISSUES extraction now sees first-paragraph markers — strictly more capture, no false-negative introduced. Head -5 truncation unchanged.

## 4. Work item C — T-20261116-004: docs zone override (co-learning workflows.md)

### 4.1 Current state (verified)

- The injection zone already exists de facto: `<!-- VARIANT-ROLE-BOUNDARY-START/END -->` inside §4.3 Role Boundary Matrix. Common keeps it EMPTY (templates/common/docs/governance/agents/workflows.md:120–:124); co-learning fills it with the 29-line Stream Boundaries section (:120–:153); the L0 root copy has its own empty zone (:154–:155). The zone is generated by propagate-to-templates B-A10 (scripts/propagate-to-templates.ts:1583–:1599) and its presence is enforced for AGENTS.md by audit.ts (:2930–:2939) and l3-to-variant-pipeline.ts (:1064–:1072, :1717–:1727).
- Delivery model: upgrade walks the effective template tree variant-wins-over-common (scripts/lib/upgrade-policy.ts:877–:890, `iterEffectiveTemplateFiles`). Deleting the variant copy would make projects fall through to common — the Stream Boundaries content would vanish from delivery. So "variant carries only delta" cannot mean "delete the full copy" without a delivery change.
- Today the shadow is admitted by a `tracked` allowlist entry with a common SHA (docs/templates/variant-shadow-allowlist.json, entry for `docs/governance/agents/workflows.md` variants `["co-learning"]`): guard strength is "common changed since recording" only, and every common edit requires a manual SHA bump.

### 4.2 Proposed mechanism (O-9 default: Option A — zone-aware shadow class)

**Option A (default): new allowlist class `zone-override` + zone-aware normalization in the shadow check.**

1. **Zone contract** (formalizing what already exists): for `docs/governance/agents/workflows.md`, the variant's ONLY permitted divergence is content between `<!-- VARIANT-ROLE-BOUNDARY-START -->` and `<!-- VARIANT-ROLE-BOUNDARY-END -->`. Common keeps the zone empty. Variants with no zone content carry no copy at all (delivery falls through to common — iterEffectiveTemplateFiles per-path fallback).
2. **Checker change** (scripts/validate-templates.ts 1.83.0 → 1.84.0): `computeShadowSet` gains an optional normalization keyed by allowlist class — for an entry of `class: "zone-override"`, both sides of the byte comparison have their VARIANT-ROLE-BOUNDARY zone content replaced with a canonical empty-zone form BEFORE comparing. A zone-only shadow therefore normalizes to byte-equal and goes silent; any out-of-zone divergence on the same path is still reported (new row type `shadow-out-of-zone-drift`, same WARN channel). This converts the weak `tracked` SHA guard into a structural guard: the delta must live inside the zone, or it fails the check.
3. **Allowlist conversion**: the co-learning entry becomes `{ "path": "docs/governance/agents/workflows.md", "variants": ["co-learning"], "class": "zone-override", "zones": ["VARIANT-ROLE-BOUNDARY"], "reason": "Stream Boundaries insertion inside the §4.3 zone (DEC-20261007-01 via PR #2032)" }` — `commonSha256` dropped (the normalization subsumes it).
4. **Assertions added** to the same check: common's zone must be empty (a common-side zone edit is itself a drift signal — zone content belongs to variants); variant zone content must not contain managed-block markers (no nested merge semantics for docs zones).
5. **Propagation**: a `--check`/regen step is NOT added in phase 1. The current co-learning copy already satisfies the contract (single hunk, in-zone — verified), so conversion is a checker + allowlist change only. When common's workflows.md changes, the variant copy goes out-of-zone-stale and `shadow-out-of-zone-drift` fires; the healer re-syncs the out-of-zone span from common (mechanical, same class of fix as PR-B below). Automating the re-sync (extend propagate-to-templates publish to recompose variant copies = common + zone) is a recorded follow-up, not phase-1 scope.

**Option B (rejected as default, recorded)**: delivery-time injection — upgrade-project gains a docs-zone injection step (common file + variant delta file → merged at delivery). Rejected: new delivery machinery in the hot upgrade path for exactly one file in the fleet; the zone-aware checker achieves the same drift guarantee with a ~30-line pure-function change.

### 4.3 Conversion plan for co-learning (design deliverable)

| Step | Artifact | Effect |
|------|----------|--------|
| 1 | validate-templates 1.84.0: `zone-override` class + normalization + 2 assertions + tests | checker lands; co-learning workflows.md still reported under the old `tracked` semantics |
| 2 | allowlist entry `tracked` → `zone-override` (same PR as step 1 — one atomic switch) | co-learning workflows.md goes silent (normalizes byte-equal); `tracked`+`commonSha256` maintenance obligation removed |
| 3 | follow-up ticket: extend the pattern to other zone-capable docs if a second variant ever needs a docs delta; automate out-of-zone re-sync | recorded, not scheduled |

No template file edit is required in phase 1 (verified: the co-learning copy already conforms).

## 5. Work item D — T-20261116-003: shadow healing (phased)

### 5.1 Current classification (live, 2026-11-17)

249 undeclared instances / 133 unique paths / 12 variants (co-abap 7, co-architect 7, co-consult 17, co-deck 18, co-design 46, co-develop 15, co-game 15, co-hr 15, co-price 19, co-safety 51, co-security 15, co-work 24). Class breakdown:

| Class | Instances | Paths | Shape |
|-------|-----------|-------|-------|
| Frontmatter-only | 95 | 108 (all-fm-only) | 5 skill names × 6 platform surfaces (finishing-a-development-branch 40, platform-skill-lifecycle-manager 40, service-design 6, ui-ux-design-intelligence 6, accessibility-audit 1) + 2 command copies (`.claude|codex` /commands/commit-push-pr.md, co-safety) |
| Skill content drift | 111 | 13 skill names × 6 surfaces | platform-command-lifecycle-manager 40 (8 variants), sync/meeting-facilitation/project-review/script-lifecycle-manager/skill-lifecycle-manager/team-builder/translate 6 each (co-safety), accessibility-audit/design-foundation 5+6 (co-design), token-usage-lint 6 (co-design), i18n-audit 6 (co-price), i18n-layout 6 (co-work) |
| Non-skill content drift | 43 | 20 paths | platform overlays (.agents/mcp.json, .agents/skills.json, .codex/config.toml, .codex/hooks.json, .mcp.json, .gemini/skills.json — co-abap, co-architect, co-safety), build/identity (package.json ×4, bun.lock, external-deps.json ×2, .gitignore ×2, .env.sample, .gitattributes, LICENSE, SECURITY.md ×2, skills/README.md + _ko), docs (CODEX.md co-architect, docs/lifecycle/agents/automation-engineer.md, docs/lifecycle/skills/×2, docs/specs/registry.json, docs/workspace-schema.json, docs/skill-graph.overrides.json), commands (.claude|codex /commands/{changelog,memlog,project-review,sync}.md — co-price, co-safety) |

Drift direction sampled on five content-drift paths: COMMON is the newer side in every case (co-deck's platform-command-lifecycle-manager predates the 2026-09-25 `.agents/commands` lockstep note; co-safety's meeting-facilitation predates the /meeting-command retirement; co-architect's CODEX.md predates the session-bootstrap block and the IDE-extension wording). The drift is stale variant copies, not variant-side innovation — heal by aligning variant → common, with per-skill adjudication as the safety valve.

### 5.2 Healing strategy

Three dispositions, matching the validator's own fix line ("Re-sync from common …, or declare the intended divergence"):

- **Declare** — for paths that are per-project by nature and whose upgrade claims already treat them as project-evolved: platform overlays, build manifests, identity seeds. Declaration class `variant-owned` with per-variant scoping (not `"*"`) and a reason citing the governing design/ADR.
- **Re-sync (align)** — for stale frontmatter and stale skill/docs content: overwrite the variant copy with common's bytes.
- **Adjudicate** — for paths where variant-side content might be intentional (the 43 non-skill drift instances get one line of adjudication each before re-sync or declare).

### 5.3 Phase 1 scope (this batch — fully mechanical, no content decisions)

**PR-4 — declare (docs/templates/variant-shadow-allowlist.json only, no template edits):** the 17 per-project overlay/build/identity paths, scoped to their observed variants: `.agents/mcp.json` [co-abap], `.agents/skills.json` [co-abap], `.codex/config.toml` [co-abap], `.codex/hooks.json` [co-abap, co-architect], `.mcp.json` [co-abap], `.gemini/skills.json` [co-safety], `.github/workflows/ci.yml` [co-abap], `.gitignore` [co-abap, co-price], `.env.sample` [co-price], `.gitattributes` [co-deck], `package.json` [co-architect, co-consult, co-deck, co-work], `bun.lock` [co-work], `external-deps.json` [co-deck, co-work], `LICENSE` [co-price], `SECURITY.md` [co-architect, co-price], `skills/README.md` + `skills/README_ko.md` [co-price], `docs/skill-graph.overrides.json` [co-consult]. Rationale is the governing upgrade-policy record for each path (.codex/config.toml ADR-0076 D4; external-deps.json design 2026-11-07 D1/D3 PROJECT_STATE claim; package.json/bun.lock variant build identity; .gitignore MERGE_MANAGED; LICENSE/SECURITY.md GOVERNANCE_FILES add-if-missing seeds). Expected residual after PR-4: 249 − 25 (the instances these declarations cover) = 224. *(Verified correction 2026-11-17, live recount by QA: the declared paths cover 25 live instances, not the originally stated 34; residual 224, not 215.)*

**PR-5 — mechanical frontmatter re-sync (templates-only):** overwrite the 95 frontmatter-only instance files with common's bytes (content is byte-identical out-of-frontmatter by definition; mirror TRACE shows mv=cv — no version conflicts). Touches 108 paths × their variants' 6 platform surfaces, plus co-safety's two command copies. Expected residual after PR-5: 224 − 95 = 129.

Phase 1 deliverable statement: after PR-4 + PR-5 the validator reports 129 undeclared instances (all content drift), zero frontmatter-only instances, and no stale/moved rows. Phase 1 covers ONLY the mechanical classes; no skill or docs content is adjudicated in this batch.

### 5.4 Phase 2 (follow-up tickets, not scheduled in this batch)

- **Per-skill adjudication** (13 tickets or one batch ticket with a 13-row checklist; one PR per skill name covering all its platform surfaces): default align (re-sync from common — all samples show common newer), with the PR reviewer verifying the skill-graph "same-version-different-content" WARNs clear (meeting-facilitation co-safety is already a standalone WARN).
- **Non-skill docs/commands adjudication** (20 paths, 43 instances, ~1–2 PRs): each path gets a one-line disposition (re-sync or declare). Notables: co-architect CODEX.md and docs/{specs/registry,workspace-schema}.json look stale (re-sync candidates); co-price/co-safety command files adjudicate against the command lifecycle records.
- **Projects .githooks healing** (from work item B): scripted per-project commit-msg refresh (LOCKED claim needs an explicit grant path), one ticket.

### 5.5 Risks

- PR-5's byte-copies reset variant frontmatter (last_updated/version) to common's — intended (the mirrors are distribution copies, not independent records); the skill-graph version-drift check must stay green (mv=cv verified today).
- Declarations must be variant-scoped, not `"*"`, so a future NEW variant copy of a declared path still gets flagged.

## 6. Owner decisions

- **O-7 (T-001)**: Last Updated merge direction. **Default: Option A** — monotonic date guard inside managed-block-merge (template prose wins, newer date line wins). Alternative: Option B (move the line out of the zone; rejected — date stops propagating).
- **O-8 (T-002)**: commit-msg fix shape. **Default: Option A** — awk leading-blank skip (verified portable). Alternative: sed `0,/^$/d` extension (proved unreliable on macOS BSD sed in testing; rejected).
- **O-9 (T-004)**: zone-override mechanism. **Default: Option A** — allowlist class `zone-override` + zone-aware shadow normalization (checker-side, no delivery change). Alternative: delivery-time injection in upgrade-project (rejected — new hot-path machinery for one file).
- **O-10 (T-003)**: healing phase-1 scope. **Default: PR-4 (declare 17 paths) + PR-5 (95 mechanical frontmatter re-syncs)**, residual 120 recorded as phase-2 follow-ups. Alternative: attempt all 249 in one batch (rejected — 111 skill + 43 non-skill content decisions are not mechanical; the batch would stall on adjudication).

## 7. PR split and sequence

Templates-side PRs stay isolated from root code per CLAUDE.md §9; root-side PRs touch no template content. One open root PR at a time (CLAUDE.md sequential-branch rule; CONSTITUTION §3.3).

| # | PR | Ticket | Files |
|---|----|--------|-------|
| 1 | Managed-block merge Last Updated guard | T-001 | scripts/lib/managed-block-merge.ts 1.6.0→1.7.0 + tests |
| 2 | commit-msg first-paragraph fix | T-002 | .githooks/commit-msg + templates/common/.githooks/commit-msg (Check G parity) + tests |
| 3 | Shadow healing declare | T-003 (phase 1a) | docs/templates/variant-shadow-allowlist.json (17 entries) |
| 4 | Shadow healing frontmatter re-sync | T-003 (phase 1b) | templates/co-*/ platform mirror copies (95 instances, mechanical) |
| 5 | Zone-override class | T-004 | scripts/validate-templates.ts 1.83.0→1.84.0 + allowlist entry conversion + tests |

Order: PR-3 may go first (pure declaration, shrinks the noise for every later review); PR-4 after PR-3; PR-1, PR-2, PR-5 are independent of each other. Each PR updates lifecycle/SCRIPTS records through the normal /sync step. Tickets move to review on their PR opening and resolve fixed on merge, per batch precedent.

## 8. Acceptance criteria

PR-1 (T-001):
- [ ] A divergent COMMON-CLAUDE block merge keeps the newer of the two Last Updated dates; template prose wins for all other lines.
- [ ] Byte-equal blocks produce no RESTAMPED line (idempotent second run is a no-op).
- [ ] Existing managed-block-merge tests stay green.

PR-2 (T-002):
- [ ] "subj / blank / para one / blank / para two" yields COMMIT_BODY "para one\n\npara two" and memory PURPOSE "para one".
- [ ] Comment stripping and head -5 truncation unchanged; no-body messages unchanged.
- [ ] lifecycle-sync-audit Check G stays green (root ↔ common mirror parity).

PR-3 (T-003 phase 1a):
- [ ] The 17 declared paths stop being reported for their scoped variants; validator residual drops to 224 (249 − 25; corrected 2026-11-17 live recount by QA, was 215).
- [ ] No declaration uses `"*"`; every entry carries a reason.

PR-4 (T-003 phase 1b):
- [ ] All 95 frontmatter-only instances re-synced to common bytes; residual 129 content-drift instances, 0 frontmatter-only.
- [ ] skill-graph version-drift check stays green; mirror TRACE mv=cv for every re-synced skill.

PR-5 (T-004):
- [ ] co-learning workflows.md converts to `zone-override` and goes silent; out-of-zone drift on that path still reports.
- [ ] Common zone-empty and no-managed-markers-in-zone assertions fire on seeded violations.
- [ ] No other path's shadow classification changes.

## 9. Out of scope (with rationale)

- **Automated variant-copy re-sync on common edits** (zone recomposition in propagate-to-templates): one-file fleet value; the out-of-zone drift WARN is the interim guard. Follow-up ticket.
- **Projects .githooks re-delivery**: LOCKED-claim grant design needed; follow-up ticket (§5.4).
- **Delivery-time docs zone injection** in upgrade-project: rejected alternative under O-9; revisit only if a second zone-capable doc appears.
- **TOML/config semantic merge machinery** (.codex/config.toml): explicitly declined by a prior accepted trade-off (upgrade-policy v1.16.0 note); declaration is the settled disposition.
- **CODEX.md/HERMES.md Last Updated handling**: no such line exists in either file; nothing to guard.

## References

- Ticket evidence: tickets/governance/T-20261116-001.yaml .. T-20261116-004.yaml
- Reference design: docs/designs/2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md (§4 drift guard, §8 PR sequence + follow-ups)
- Decision record: docs/decisions/DEC-20261117-05.md
- Code: scripts/lib/managed-block-merge.ts; scripts/lib/upgrade-policy.ts; scripts/validate-templates.ts; scripts/propagate-to-templates.ts; .githooks/commit-msg; docs/templates/variant-shadow-allowlist.json
