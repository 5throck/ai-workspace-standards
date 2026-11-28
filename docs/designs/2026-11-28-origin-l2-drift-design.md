# Design: Origin-L2 skill-drift authority model, check-drift repair, and context-doc base-region propagation

- **Spec ID**: `2026-11-28-origin-l2-drift-design`
- **Date**: 2026-11-28
- **Author**: Template Architect (Design Gate Row 0)
- **Status**: approved (owner approval 2026-11-28, recorded in DEC-20261128-001)
- **Tickets**: T-20261128-004 (origin-L2 skill copies drift stale; check-drift no-op), T-20261128-003 (variant context-doc base-region additions never reach instances)
- **Related**: T-20261116-003 (shadow-healing lineage), DEC-20261117-07 (byte-twin exemption — not applicable to origin-scope copies, verified), T-20261126-005 (port/adopt pair program), `docs/designs/2026-11-26-skill-drift-structural-fixes-design.md` (S1 equal-version gate — the version-bump discipline this design relies on)

## 0. Conclusion

Both tickets describe the same structural shape from two lanes: content that lives in the **template trees** but has no propagation path into a second tree that already exists (origin-variant skill copies ← common twins; project-instance context docs ← variant templates). Every numeric claim was re-derived from the tree before ruling; two count details differ from the ticket text and are noted in §1.

Rulings this design makes:

1. **Origin-L2 authority model (T-004)**: for a common-promoted skill mirrored in `templates/<variant>/skills/`, the **body is common-authoritative** and the **frontmatter is variant-authoritative** for identity fields (`scope`, `lang`, `lang_reason`, `owner`, `audit_exception`). The 6 L2-STALE pairs get a frontmatter-preserving body re-sync (stamps advanced to the common twin's `version`/`last_reviewed`); byte-copy `--apply` is forbidden for scope-bearing copies (it flips `scope: co-*` → `scope: common` — verified destructive). The 7 L2-AHEAD pairs are ruled **legitimate variant forks: keep**, declared in the shadow allowlist as a new `fork` class; promotion stays possible through the standard port/adopt program, unscheduled.
2. **check-drift repair (T-004)**: `sync-skills-to-l2.ts` unscoped mode gets a real enumeration (all common skills+scripts × all variants), **numeric** semver classification (lexicographic compare misclassifies `1.6.0` vs `1.10.0` — reproduced), and exits nonzero on undeclared drift.
3. **Context-doc propagation (T-003)**: `docs/<variant>.context.md` is MERGE_MANAGED (`scripts/lib/upgrade-policy.ts:800-801`) and `mergeManagedBlocks` touches only managed zones — template base-region additions are dead letters for existing instances (verified in code and by count). Ruling: **additive base-section add-if-missing** inside DOCS_MERGE (exact-heading anchor; never deletes project content), which doubles as the one-shot migration on its first fleet wave. The alternative rulings (declare instance context docs project-authoritative + scrub templates; status quo) are rejected in §4.

## 1. Problem (verified evidence)

### 1.1 T-20261128-004 — origin-L2 drift, sized and classified independently

Re-derived by sha256 over `templates/common/skills/*/SKILL.md` vs `templates/<variant>/skills/*/SKILL.md` (all 8 stable variants): **13 divergent pairs / 4 variants — exact match with the ticket.** Classification by *numeric* semver compare:

- **L2-STALE (common ahead, 6)**: co-design accessibility-audit 1.1.2>1.1.0; co-safety script-lifecycle-manager 1.2.3>1.2.0, skill-lifecycle-manager 1.5.2>1.5.1, team-builder 1.2.0>1.1.1, translate 1.0.3>1.0.2, sync 1.10.0>1.6.0.
- **L2-AHEAD (variant ahead, 7)**: co-design design-foundation 1.1.1<1.3.0, token-usage-lint 1.1.0<1.1.1, ui-ux-design-intelligence 1.0.1<1.0.2; co-price i18n-audit 1.0.2<2.1.0; co-safety project-review 1.3.2<1.3.4; co-work i18n-layout 1.1.1<1.1.2, project-review 1.3.2<1.3.3.
- SAME-VER-DIFF: 0.

Method note: a plain string compare rules `1.6.0 > 1.10.0` and misfiles co-safety sync as L2-AHEAD — the ticket's own listing is numerically correct; the checker this design specifies must compare numerically.

What the divergence *is* (frontmatter/body decomposition, computed per pair):

- co-design accessibility-audit: **bodies byte-identical**; only `version`/`last_reviewed` stamps differ; variant frontmatter carries `scope: common` (not `scope: co-design` — the ticket's blanket "scope: co-<variant>" does not hold for this pair).
- The five co-safety stale pairs: **bodies differ**; variant frontmatter carries deliberate variant-own keys — `scope: co-safety` (all five), `lang: ko` + `lang_reason: legal` (translate, team-builder — the CONSTITUTION §4.1 Korean-legal exception), `owner: pm` (sync, vs common's `automation-engineer`), and `audit_exception: safety-os-skill-structure` present on four (sync is the exception — verified 0 hits in its frontmatter). A byte-copy would erase every one of these.
- All 7 L2-AHEAD pairs carry `scope: co-<variant>` vs the common twin's `scope: common` (verified per pair).

No standing detector:

- `scripts/sync-skills-to-l2.ts:50-89` builds `diffs` only inside `if (skillArg)` / `if (scriptArg)` branches; unscoped `--check-drift` prints the header over an empty array and exits 0 (verified by reading the code; the ticket's line citation 30-79 is off by a few lines but describes exactly this loop).
- `bun scripts/validate-templates.ts` (run for this design): exits **0** ("0 error(s), 43 warning(s)"). The drift is not fully invisible — the WARN-only `variant-common-shadow` check collapses it into rows like "co-design: 40 undeclared shadow(s) … skill accessibility-audit (6 copies)" — but warnings never fail a gate, the rows bury 13 real pairs inside a flood of frontmatter-only twins, and nothing schedules a heal. "Exits 0 over the set" is accurate; "silently" is accurate at exit level.
- Delivery engine mechanics (`Projects/co-design/.claude/last-upgrade-delivery.json` read for this design): the accessibility-audit decision row is `policy: SYNC, pass: SYNC_IF_NEWER: skills/, verdict: ADOPT, detail: "1.1.1 → 1.1.2 — version-gated whole-directory delivery over the delivered baseline"`. The engine delivers common → **project instances**; it never writes `templates/<variant>/skills/` (origin trees are engine inputs, not outputs — `resolveClaim` in `upgrade-policy.ts` only classifies project-relative paths). That is why the project lane healed (ADOPT picked the newer common source) while the origin lane drifted. No delivery regression today, but every future `new-project` from an origin variant inherits the stale copy.

### 1.2 T-20261128-003 — context-doc base-region additions are dead letters

Verified counts (mine): the Computational Integrity section (root `AGENTS.md:271` §7 baseline) exists in **10/16** variant context docs (co-consult, co-design, co-develop, co-export, co-game, co-hr, co-learning, co-news, co-security, co-work) and in **1/18** project instances (`Projects/co-work/docs/co-work.context.md`). The ticket title says 9/16 and 1/17; its own description brace-lists the same 10 variants I count. The count drift does not change the shape: templates carry it, instances do not.

Structural cause, verified in code:

- `docs/<variant>.context.md` claims `{ policy: "MERGE_MANAGED", pass: "DOCS_MERGE" }` (`scripts/lib/upgrade-policy.ts:800-801`).
- `mergeManagedBlocks` (`scripts/lib/managed-block-merge.ts:419-481`) operates exclusively on managed zones: early-returns the project content untouched when the template has no managed markers (435-437) and every subsequent edit is scoped to blocks matched by label/key. **The base region of the project copy is never a merge input.**
- The section sits in the base region of the variant templates (marker-position check on co-learning verified: outside any VARIANT-INJECT region).
- Ticket timeline consistent with the tree: template re-add commit `cf8bc12e9` (2026-11-12) exists in `git log` for `templates/co-learning/docs/co-learning.context.md`; the delivery manifest has included the file every wave since, each time merging only the VARIANT-INJECT zone and preserving the project base — hence "delivered every wave, never restored".

## 2. Goals and non-goals

Goals: one authority model for origin-L2 skill copies that preserves variant identity while healing content lag; a working, exit-honest drift detector; fleet-wide restoration of base-region policy sections without destroying project-side content; every future base-region addition reaches existing instances by mechanism, not by memory.

Non-goals: rewriting the delivery engine to write origin trees (the origin lane keeps its own tool — engine semantics ADOPT/PROJECT_AHEAD/EVOLVED_PRESERVE stay untouched); promoting any of the 7 forks in this design; deleting or scrubbing project-side context-doc content; touching DEC-20261117-07's byte-twin exemption (different class: delivered project copies, not origin-scope copies).

## 3. R1 — origin-L2 authority model and the 6-pair heal (T-004)

### 3.1 The ruling

**Body common-authoritative, frontmatter variant-authoritative.** For any `templates/<variant>/skills/<name>/SKILL.md` whose twin exists at `templates/common/skills/<name>/SKILL.md`:

- The markdown **body** (after the frontmatter block) tracks the common twin as its source of truth.
- The variant **frontmatter** is preserved verbatim except: `version` and `last_updated`/`last_reviewed` are advanced to the common twin's values when the common twin is strictly newer (numeric compare), and keys *absent* in the variant frontmatter but present in the common twin's are filled from it (the `prerequisites: none` case observed on script-lifecycle-manager / skill-lifecycle-manager).
- Keys that exist in the variant frontmatter are **never** overwritten from common — this protects `scope: co-*`, `lang: ko`, `lang_reason: legal`, `owner: pm`, and `audit_exception` (all verified present in the affected set).

This preserves the deliberate variant identity the ticket warns about (byte-copying the common twin would flip `scope` and is thereby forbidden), while the ticket's alternative — declaring origin-L2 copies variant-authoritative — is rejected: it would freeze the six stale pairs at 2026-09-vintage bodies (`sync` at 1.6.0 vs common 1.10.0 is four months of sync-pipeline doctrine behind), and new scaffolds would institutionalize the lag.

### 3.2 Per-pair disposition table

| Pair | Class | Ruling |
|---|---|---|
| co-design accessibility-audit | L2-STALE, body already identical | Advance frontmatter stamps to common's (1.1.2 / 2026-11-27). Its `scope: common` already matches common — full frontmatter adoption is safe here; keep it simple: stamp advance only |
| co-safety script-lifecycle-manager | L2-STALE, body differs | Body re-sync from common + stamp advance; preserve `scope/lang/audit_exception` verbatim; fill missing `prerequisites` |
| co-safety skill-lifecycle-manager | L2-STALE, body differs | Same as above |
| co-safety team-builder | L2-STALE, body differs | Same; preserve `lang/lang_reason`; fill missing `last_reviewed` |
| co-safety translate | L2-STALE, body differs | Same; preserve `lang/lang_reason`; the variant's empty-valued `lifecycle:`/`tier:` keys are left as-is (variant-owned, possibly deliberate) |
| co-safety sync | L2-STALE, body differs | Same; preserve `scope: co-safety` and `owner: pm` (a deliberate PM-owned variant lane) |
| co-design design-foundation, token-usage-lint, ui-ux-design-intelligence; co-price i18n-audit; co-safety project-review; co-work i18n-layout, project-review | L2-AHEAD (7) | **Legitimate forks — keep.** All carry `scope: co-<variant>`. Declared in the shadow allowlist as class `fork`. No promotion scheduled; if a capability generalizes, promote through the T-20261126-005 port/adopt program (which already hand-ruled i18n-audit@co-price once — this mechanizes that precedent) |

### 3.3 Proposed change (file-level)

| File | Action | Description |
|------|--------|-------------|
| `scripts/sync-skills-to-l2.ts` | modify (v2.0.0) | §3.4: real unscoped enumeration; numeric classification; frontmatter-preserving apply; fork-refusal in apply. |
| `scripts/lib/skill-frontmatter-merge.ts` | create | Pure `mergeStaleFrontmatter(variantFm, commonFm)` implementing §3.1's preserve/fill/advance rules (js-yaml round-trip; stamps advance only on strict numeric-newer). |
| `docs/templates/variant-shadow-allowlist.json` | modify | New entry class `fork` (14 entries: the 13 divergent skills' origin paths — the 6 stale pairs are declared `fork` only until healed, then their allowlist rows are removed by the same PR; the 7 ahead pairs stay). Schema: `{ path, variants: [...], class: "fork", note }`. validate-templates treats `fork`-declared shadows as declared (removed from the undeclared-noise count) and asserts only the fork contract: variant copy carries `scope: co-<variant>` and version ≥ 1. |
| `scripts/validate-templates.ts` | modify | `variant-common-shadow`: consume the `fork` class (small delta in `classifyShadows`); the collapsed WARN flood for these 13 paths disappears, keeping the check's signal for genuinely undeclared shadows. |

### 3.4 check-drift repair (the no-op fix)

Default (unscoped) mode enumerates **all common skills × all variants** and **all common scripts × all variants**, building the existing `Diff` rows — the per-skill/per-script branches keep their current meaning (scoped single-target runs).

Report adds classification per diff (numeric semver compare on the frontmatter `version` of both sides):

- `L2-STALE` (common numerically newer), `L2-AHEAD` (variant numerically newer), `SAME-VER-DIFF`, `in-sync`, `missing`.
- Exit semantics: exit 1 iff any `L2-STALE`, `SAME-VER-DIFF`, `missing`, or **undeclared** `L2-AHEAD` row exists. Declared-fork `L2-AHEAD` rows print but do not fail (they are the ruled legitimate class). Undeclared L2-AHEAD fails: a fork must be declared to exist.
- `--apply` behavior: re-syncs only L2-STALE rows via frontmatter-preserving body sync (§3.1); **refuses** L2-AHEAD rows with an error naming the fork declaration requirement; same-verb change for `--script` applies (frontmatter N/A for scripts — scripts have `@version` headers, so script applies keep byte-copy but gain the same enumeration and refusal).

Alignment with delivery behavior (the task's alignment requirement): the engine's ADOPT is version-gated whole-directory delivery into the *project* lane; PROJECT_AHEAD records pendingBackport when the project evolves past the template (`upgrade-policy.ts:1784-1786`). This design gives the *origin* lane the symmetric semantics: common-ahead → heal (the origin analog of ADOPT), variant-ahead → declare-a-fork (the origin analog of PROJECT_AHEAD's preserve-and-record). Neither lane writes the other; both sides of the boundary use version as the gate and record intent in a ledger (delivery JSON / allowlist).

### 3.5 Tests

- Unit: `mergeStaleFrontmatter` — preserves `scope/lang/lang_reason/owner/audit_exception`; advances stamps on strict numeric-newer only; fills absent keys; lexicographic trap asserted (`1.10.0` > `1.6.0`, not the reverse).
- Unit: unscoped `--check-drift` on the current tree reports exactly the 13 pairs with the §1.1 classification; exit 1 before the heal, exit 0 after (with 7 fork declarations in place).
- Unit: `--apply` on a fixture scope-bearing stale pair — body replaced, frontmatter keys preserved byte-for-byte except stamps/fills; apply against a fork-declared pair → refusal, no write.
- Regression: validate-templates full run post-HEAL shows the 13 paths out of the undeclared count (6 removed by healing, 7 declared).

### 3.6 Rollout and compatibility

The heal PR executes the 6-pair re-sync via the new tool (`--check-drift` → `--apply`), one commit, reviewable per pair. Stamp advances change extracted versions, so CV-02 (same-version-content-change) does not fire on the platform mirrors; the platform mirror copies under `.claude/.gemini/.agents/.codex/.hermes` of each variant re-sync through the existing skill-sync propagation (they are projection surfaces, not independent sources). Core-vs-variant standardization is unaffected (sync-skills-to-l2.ts is a workspace-root tool, not delivered core).

## 4. R2 — context-doc base-section propagation (T-003)

### 4.1 Options considered

| Option | Pro | Con | Decision |
|---|---|---|---|
| (a) Engine adopts template base-region additions (region-aware sync) | Fixes the class mechanically | Naive "template base wins" would repeat the 0.13.1 injury in reverse (base-replace destroying project content — the ticket's own timeline records exactly that injury); needs an additivity contract to be safe | **Chosen**, as additive add-if-missing (§4.2) |
| (b) Next-wave delivery only (declare base region delivered-on-scaffold) | Zero engine change | Leaves all 17 stale instances permanently stale; the ticket explicitly rejects the status quo as "every R2 flow reports the same ghost row" | Rejected |
| (c) Declare instance context docs project-authoritative; scrub the section from variant templates | Kills the ghost row | Diverges every *new* scaffold from the AGENTS.md §7 baseline — the section is a workspace-level computational-integrity rule, not variant flavor; also forfeits the template as the channel for future baseline additions | Rejected |

### 4.2 Ruling: additive base-section add-if-missing in DOCS_MERGE

Extend the DOCS_MERGE pass (the `mergeWorkspaceManaged` call site at `scripts/upgrade-project.ts:5680-5747`) with a bounded additive phase, run only for `MERGE_MANAGED` docs (`MERGE_MANAGED_FILES` + the `docs/<variant>.context.md` claim):

1. Parse H2/H3 sections (`^## `/`^### `) of the template's **base region** (content outside managed markers).
2. For each template base-section whose **exact heading line** (normalized whitespace) has no match anywhere in the project copy: insert the whole section (heading + body) immediately after the project's section with the same preceding heading (anchor), or appended at the base-region end when no anchor exists. Template position is respected relative to *present* headings; absent anchors fall back to append.
3. **Never delete or rewrite** any project-side content: sections absent from the template stay (project-owned evolution); sections present in both are left to the existing managed-zone machinery (content *refresh* of an existing heading is out of scope for the additive phase — that remains VARIANT-INJECT zones or a signed wave, consistent with MERGE_MANAGED semantics).
4. Record one decision row per insertion (`verdict: BASE_SECTION_SEEDED`, INFO, naming section + anchor) so the delivery JSON stays attributable, matching the house style of STUB_FM_BACKFILL/RECORD_BROW rows.
5. Dry-run prints planned insertions; the census gate (`ManagedBlockCensusGate`) is not touched — the phase is outside managed zones by construction.

This is delete-safe by construction, reuses the engine's existing ADD_IF_MISSING philosophy (PROCEDURES, GOVERNANCE FILES), and needs no new markers from template authors — a plain section added to a variant template reaches every instance on the next wave that touches the file (and the delivery manifest already includes context docs every wave, so "next wave" means the wave after this ships).

**One-shot migration**: no separate script. The first fleet wave carrying this engine change re-delivers every context doc; the Computational Integrity section seeds into the 17 instances missing it (co-work already has it — heading-present → skipped). The ticket's decision question ("adopt vs declare-authoritative-and-scrub") is answered: **adopt** (option a), per §4.1.

Known limitation (accepted, recorded): a template-side *edit* to a section an instance already has (heading exists) does not propagate — the additive phase is seeds-only. That preserves project-authority over existing text; if a baseline policy must *change* fleet-wide, that is a signed wave with an explicit content-refresh ruling, not silent base overwrite.

### 4.3 Proposed change (file-level)

| File | Action | Description |
|------|--------|-------------|
| `scripts/lib/managed-block-merge.ts` | modify | New exported pure `seedBaseSections(projectContent, templateBaseContent): { content, seeded: string[] }` (heading parse, anchor match, insertion; additive-only). |
| `scripts/upgrade-project.ts` | modify | DOCS_MERGE site (~5680-5747): call the seeder for MERGE_MANAGED docs after `mergeWorkspaceManaged`; record `BASE_SECTION_SEEDED` decision rows. Version bump citing T-20261128-003. |
| `tests/unit/base-section-seed.test.ts` | create | Cases in §4.4. |

### 4.4 Tests

- Fixture (co-learning shape): project doc missing the Computational Integrity section but carrying project-owned base content → section inserted at the anchored position; project content byte-preserved; no deletions.
- Heading-present fixture (co-work shape): no insertion, no change.
- Zone safety: VARIANT-INJECT zones byte-identical before/after; a template section that *overlaps* a zone boundary is not seeded (zone scan excludes marker-adjacent partial headings).
- Idempotency: running the merge twice yields byte-identical output the second time.
- Dry-run: planned insertions listed, no writes.

### 4.5 Rollout and compatibility

Engine change rides the standard upgrade wave; the wave after landing performs the fleet-wide seed automatically (context docs are in every delivery manifest). Project-owned context content survives by construction (test-proven). The decision rows make the one-shot migration auditable per instance.

## 5. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | Delivery engine + root tool changes are platform-neutral; fork declarations live in a root registry | scripts/upgrade-project.ts, scripts/lib/managed-block-merge.ts, scripts/sync-skills-to-l2.ts, docs/templates/variant-shadow-allowlist.json |
| Antigravity (GEMINI.md) | None — neither the origin-L2 skill lane nor DOCS_MERGE reads GEMINI surfaces; the heal's platform mirrors propagate through existing skill-sync | N/A — no GEMINI-specific file participates in either code path (justification: variant skills project to all five mirrors via sync-skills.ts, which is untouched) |
| templates/common | Propagation required: the 6 stale-pair bodies are sourced *from* common (no common-file edit); fork declarations are root-side. No common template file changes in this design | None in templates/common (justification: the heal direction is common → variant origin) |

## 6. Acceptance criteria

- [ ] `sync-skills-to-l2.ts --check-drift` (unscoped) reports the 13 pairs with correct numeric classification; exit 1 before heal; exit 0 post-heal with 7 `fork` declarations.
- [ ] The 6-pair heal lands with variant frontmatter preserved byte-for-byte except stamps/fills (test-asserted per protected key).
- [ ] `--apply` refuses fork-declared pairs and never writes a `scope: co-*` → `scope: common` flip.
- [ ] First post-landing wave seeds Computational Integrity into every instance missing it; co-work is untouched; decision rows `BASE_SECTION_SEEDED` recorded per instance.
- [ ] No project-side context-doc content is removed by the seeder (fixture-proven).
- [ ] validate-templates undeclared-shadow noise for the 13 paths drops to zero.

## 7. Open questions (for the user approval gate)

1. Fork ruling (§3.2): approve all 7 L2-AHEAD pairs as legitimate forks (keep, declared, unscheduled promotion)? Any pair the user wants force-promoted instead — most plausible candidate is co-safety project-review (1.3.4 vs common 1.3.2), whose delta is small enough to port cheaply.
   - 2026-11-28: approved on the recommended default, all 7 pairs are legitimate forks (keep, declared, unscheduled promotion).
2. `sync` @co-safety `owner: pm` (vs common's `automation-engineer`): treat as protected variant identity (this design's default) or align to common as part of the heal?
   - 2026-11-28: approved on the recommended default, protected variant identity.
3. Seeder scope (§4.2): confirm seeds-only (no content refresh of existing headings) for this landing, deferring refresh semantics to a future design.
   - 2026-11-28: approved on the recommended default, seeds-only for this landing.
4. co-design accessibility-audit carries `scope: common` (not variant scope): confirm stamp-advance-only treatment (this design's default) rather than full frontmatter adoption.
   - 2026-11-28: approved on the recommended default, stamp-advance-only.
