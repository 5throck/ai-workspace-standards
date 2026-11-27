# Design: Version-advance lane coverage (agents / docs / scripts) and the release-layer drift gate

- **Spec ID**: `2026-11-27-version-advance-lane-coverage-design`
- **Date**: 2026-11-27
- **Author**: Automation Engineer (Design Gate Row 0)
- **Status**: approved (owner standing instruction 2026-11-27: proceed on the recommended defaults; DEC-20261125-01 precedent)
- **Tickets**: T-20261127-006 (version-advance defect — lane layer + release layer)
- **Related**: `docs/designs/2026-11-26-skill-drift-structural-fixes-design.md` §4.1 (S1 — the helper this design extends), `docs/designs/2026-11-27-co-architect-platform-zombie-adjudication-design.md` + `2026-11-27-co-architect-finishing-zombie-adjudication-design.md` (the bump-to-unstick precedent), ADR-0085 D3 (same-version drift preserve), DEC-20261111-01 PR-B (equalVersionRestore), T-20261001-021 (the historical docs strand)

## 0. Conclusion

S1 fixed the skills lanes only. This design re-verifies the other three delivery lanes against the same defect class (template content edits landing without version bumps) and closes what is actually broken: nothing strands in **agents** (the equal-version drift arm restores baseline-clean copies) and nothing strands in **scripts** (equalVersionRestore already attributes baseline provenance), but both report the event with the wrong vocabulary — `DRIFT_RESTORED`, which reads as a fork heal when it is a template advance. The **docs** lane has a real, live strand: a versioned doc (inline `*<file> version:` footer) whose content edit landed without a footer bump is silently skipped — no row, no delivery — proven today on `Projects/co-develop/docs/privacy-design-checklist_ko.md` (footer 1.0 == template 1.0, bytes differ) and historically by T-20261001-021. At the RELEASE layer the defect repeats one level up: `templates/VERSION` says 0.30.0, `template-v0.30.0` exists, and 238 commits have touched `templates/` since the tag (2026-11-08 → 2026-11-27) while `audit.ts`'s tag check only ever tested tag existence — the check was green through the entire drift. This design: (1) routes every equal-version content-drift case in all four lanes through the S1 attribution vocabulary (`SYNC_TEMPLATE_ADVANCE` when the baseline proves the project never moved, `DRIFT_PRESERVE`/CONFLICT otherwise), reusing the already-generic `resolveEqualVersionDrift` via optional delivery hooks; (2) adds a landing-time bump-discipline gate (lifecycle-sync-audit Check J) that flags a versioned template file whose content changed without its version token advancing, plus a release-pending WARN when `templates/**` moves without a `templates/VERSION` advance; and (3) extends the audit tag check to detect content drift since the tag. The overdue release (0.30.0 → 0.31.0) is cut as part of the landing per the owner's instruction.

## 1. Problem

- **Docs strand (live)**: `resolveClaim`'s SYNC policy in TEMPLATE TREE SYNC gates docs delivery on an inline `*<basename> version: X.Y` footer when present (`extractInlineVersion`, upgrade-project.ts:5614, consumed at :8759-8772). When the footer version equals the project's, the reason string stays empty and the whole delivery block is skipped — the file is not delivered AND no decision row exists, so nothing ever surfaces the gap. A template-side content edit without a footer bump is unreachable forever: the T-20261001-021 class (the 2.13 section that never reached same-version copies), reproduced today on `co-develop/docs/privacy-design-checklist_ko.md` (5-line frontmatter + one terminology fix stranded template-side, both sides at footer 1.0).
- **Attribution vocabulary**: agents (:7116-7212) and scripts (equalVersionRestore, :4454-4511, via resolveEqualVersionDisposition) already DELIVER baseline-clean equal-version content — but as `DRIFT_RESTORED`. A fleet operator reading the decision log cannot distinguish "template advanced, project untouched (discipline miss, healed)" from "project fork restored". The version-advance telemetry the ticket asks for needs one queryable verdict across lanes.
- **Release layer**: `templates/VERSION` = 0.30.0; tag `template-v0.30.0` (fc32ecc1e, 2026-11-08) exists; `git log template-v0.30.0..HEAD -- templates/` carries 238 commits (the machinery batch, the pair program's 9 skill bumps, the zombie bumps, dependency-audit 1.2.0, generator v2.2.0, co-deck test ports). The audit check (audit.ts:3568-3586) tests tag existence only and passes.
- **Bump discipline**: the skills process rule ("a template-side edit without a version bump must be bump-first or provably stamp-only", S1 §4.1) has no mechanical enforcement anywhere. `d82a73649` proves the discipline fails without a gate.

## 2. Goals and Non-goals

**Goals**

1. A versioned doc whose content edit landed without a footer bump delivers at the next wave when the project copy still equals its delivered baseline (docs-lane S1 semantics); a project-moved or baseline-less copy preserves with a visible `DRIFT_PRESERVE` row — the silent void closes.
2. One verdict vocabulary fleet-wide: baseline-proven equal-version template advances report `SYNC_TEMPLATE_ADVANCE` (INFO) in the skills, agents, docs and scripts lanes; project-side moves keep their protective verdicts unchanged.
3. A landing that edits a versioned template file without advancing its version token fails the lifecycle-sync-audit gate (Check J1, ERROR) — bump-first becomes mechanical; stamp-only edits and first-time files stay exempt.
4. A landing that touches `templates/**` without advancing `templates/VERSION` warns (Check J2) that a release is pending, naming the change-class mapping (feat → minor, fix/docs → patch).
5. The audit tag check detects content drift since the tag and warns with the release procedure.
6. The overdue release is cut: `templates/VERSION` 0.30.0 → 0.31.0, tag `template-v0.31.0` published post-merge, audit check verified green against the new tag.

**Non-goals**

- Changing PROJECT_EVOLVED protection anywhere (CONFLICT for agents/scripts version-gated arms, EVOLVED_PRESERVE for template-unchanged docs, DRIFT_PRESERVE for unattributable equal-version skills) — the co-hr `docs/iso-30414-metrics-mapping.md` 2-line project-side residual and the co-design `docs/security.md` Dependency Overrides section MUST stay preserved.
- Changing unversioned-doc delivery (hash-gated, flows by design) or WORKSPACE/ADD_IF_MISSING seed-only contracts (project-owned after seed, by design).
- Changing resolveEqualVersionDisposition in `lib/upgrade-policy.ts` (the scripts verdict rename lands in upgrade-project.ts's `equalVersionRestore` wrapper — one L0-only file, no twin delta).
- Auto-bumping versions mechanically (rejected — see §6).
- Touching any `Projects/*` checkout (canaries are read-only dry-runs).

## 3. Current state — per-lane investigation verdicts

All facts verified on `main` (26cdaec40) on 2026-11-27.

| Lane | Gate today | Equal-version + content drift | Verdict |
|---|---|---|---|
| **agents** (`SYNC_IF_NEWER: agents/`, upgrade-project.ts:6837-7234) | Frontmatter `version:`; `semverGt` gates delivery (:7054); drift arm :7116 compares `lifecyclelessText(rendered)` vs project | UNTOUCHED (project == delivered baseline) → `DRIFT_RESTORED` (WARN), template copy DELIVERS, exit 0 (only ERROR exits non-zero, :11213-11289). PROJECT_EVOLVED → CONFLICT (ERROR) skip. NO_BASELINE → restore with degrade note (D4 migration window). Stubs deliver composed bytes (D9, :7004). MERGE_MANAGED files flow through the MERGE pass instead. | **FLOWS — no strand.** 12 raw equal-version diffs in `Projects/co-architect/agents/` all collapse to byte-equal after token render + lifecycle strip (engine compare is already correct; BEFORE dry-run shows zero agents-lane drift rows). Defect is vocabulary only (`DRIFT_RESTORED` mislabels a template advance) plus a missing uncommitted-edit guard. |
| **docs, versioned** (TEMPLATE TREE SYNC SYNC policy, :8742-8921) | Inline `*<file> version: X.Y` footer (`extractInlineVersion` :5614, two-component compare :5621-5630) | Footer versions equal + `fileHash` differs → `reason` stays `""` → **silent skip: no delivery, no decision row** (:8759-8775). Population: `docs/context.md` (common), variant context files (MERGE_MANAGED — different pass), `engagement-orchestration.md` (co-consult, co-hr), `privacy-design-checklist(_ko).md` (co-develop, co-learning). Live strand: `Projects/co-develop/docs/privacy-design-checklist_ko.md` (1.0 == 1.0, template-side 5-line frontmatter + terminology edit stranded). Historical: T-20261001-021. | **STRANDED (silent).** The docs-lane gap is real and live. |
| **docs, unversioned** (same pass + DOCS_OVERWRITE :9703 + WORKSPACE :8630) | `fileHash(abs) !== fileHash(dest)` → "(content changed)" delivers (:8770-8772); PROJECT_EVOLVED + template-unchanged → EVOLVED_PRESERVE (protective) | Unversioned docs FLOW by hash — nothing strands. `co-hr docs/iso-30414-metrics-mapping.md` (2-line project-side residual) and `co-design docs/security.md` (6-line Dependency Overrides section — NOTE: the pair is NOT equal today; the project copy carries the section, template lacks it) both report EVOLVED_PRESERVE and MUST stay preserved. | **FLOWS / protective preserve — no defect.** |
| **scripts** (`SYNC_IF_NEWER: scripts/` :6039-6285; VARIANT SCRIPTS :6287-6683) | `@version` header; version-gt → ADOPT (:6134); equal-version + hash drift → :6188 | CORE_LOCKED → unconditional restore (:6199). Non-core → `equalVersionRestore` (:4454): provenance baseline → `DRIFT_RESTORED` (INFO) DELIVERS; vintage → same; unproven fork → CONFLICT (ERROR). Registry lockstep v1.118.0 (REGISTRY_DRIFT :6735). Check A (lifecycle-sync-audit :343-391) enforces row == @version at the landing gate. | **FLOWS — no strand.** An @version-bumped-but-undelivered template script delivers on the next wave via the version gate; a bump cannot strand. Defect is vocabulary only. |

Release layer: audit.ts:3568-3586 — `git tag -l template-v<VERSION>` non-empty → Pass. No content comparison. `templates/VERSION` untouched since 0.30.0 while 238 commits moved `templates/`.

## 4. Proposed design

### 4.1 Lane extension — `resolveEqualVersionDrift` gains delivery hooks (upgrade-project.ts)

The helper (S1, :7315-7373) is confirmed generic for attribution: it hashes the PROJECT file with `baselineKeyFor` (upgrade-policy.ts:2035 — lifecycleless hash for `agents/`, raw bytes elsewhere), so it needs no per-lane normalization knowledge. What it lacks is per-lane delivery: it copies `tplFile` verbatim. Extension — an optional fourth parameter:

```ts
resolveEqualVersionDrift(rel, pass, tplFile, projFile, hooks?: {
  deliverable?: string;   // bytes a delivery would write (rendered/composed); default: tplFile bytes
  tplContent?: string;    // marker-loss comparison source; default: tplFile bytes
  write?: () => void;     // delivery write; default: copyFileSync(tplFile, projFile)
})
```

`hooks.deliverable` participates ONLY in the marker-loss guard input and the delivery write; attribution is always project-vs-baseline (unchanged). Skills call sites (:7532, :7827) pass no hooks — byte-identical behavior.

**Call-site routing (the extension):**

| Lane / site | Change |
|---|---|
| agents drift arm (:7116) | When `cls.state === "UNTOUCHED"` and not tier-only drift → `resolveEqualVersionDrift(rel, pass, tplFile, projFile, { deliverable: rendered, tplContent: rendered, write: deliverAgentContent })` (positive attribution → `SYNC_TEMPLATE_ADVANCE` INFO + the helper's uncommitted-edit CONFLICT guard, both new for agents; delivery keeps lifecycle preservation via the existing writer). PROJECT_EVOLVED (CONFLICT/ADOPT), NO_BASELINE (degrade restore), tier-only (ADOPT), STUB_VERSION_BUMP_ADVICE — all unchanged. |
| docs versioned equal-version arm (new branch in the reason computation, :8759-8772) | Footer versions equal + hash differs: `docs/context.md` sets `reason = "(equal-version content drift)"` and flows through the EXISTING preserve/splice/force chain (project-only-section protection and the COMMON-CONTEXT splice must not regress); the chain's deliver row upgrades to `SYNC_TEMPLATE_ADVANCE` when the file is UNTOUCHED. Every other versioned doc routes to `resolveEqualVersionDrift(rel, TEMPLATE_TREE_SYNC_PASS, abs, dest)` — attributed → deliver (`SYNC_TEMPLATE_ADVANCE`); project-moved/baseline-less → `DRIFT_PRESERVE` (WARN, visible — the silent void closes); treeChanged accounting rides the helper's return. |
| scripts equalVersionRestore (:4454-4511) | Baseline-proven outcome verdict overridden to `SYNC_TEMPLATE_ADVANCE` (INFO) with S1's attribution wording; vintage-proven and adopt/unproven outcomes unchanged. Lives in upgrade-project.ts (L0-only) — `resolveEqualVersionDisposition` in the policy lib is NOT modified. |

**What "advance" means for the docs lane**: docs carry no per-file semver gate beyond the two-component footer; advance = the baseline-hash attribution S2/S4 already use — project bytes == delivered baseline while template bytes differ → the template edit is template-side and delivers. Unversioned docs already advance this way; nothing is stranded there today (§3).

### 4.2 Bump-discipline — landing-time gate (lifecycle-sync-audit Check J)

**Chosen: option (i), the landing-time gate.** The auto-bump precedent (`helpers/agent-mechanical-date-bump.ts`) states its own boundary: "Files whose body also changed are left alone (a real content edit is the author's job to date)" — extending mechanical stamping to semantic version tokens contradicts the precedent's doctrine, inflates versions without review, and would churn `templates/VERSION` per landing against the release-cadence model. A gate is mechanical (git), visible in the landing the moment it matters, and safe to fail hard now that S1 makes violations recoverable.

**Check J1 — file-level bump discipline (ERROR)**: enumerate tracked worktree changes under `templates/**` (`git status --porcelain -- templates/`; modified/renamed only — additions, deletions and untracked files are exempt). For each changed file, parse the version token by path class — skills/agents `.md`: frontmatter `^version: X.Y.Z`; scripts `.ts`/`.py`: `@version X.Y.Z`; versioned docs: `*<basename> version: X.Y` — and compare against the HEAD blob's token (`git show HEAD:<path>`). Files without a version token are exempt from J1 (they roll up into J2). A file whose token did NOT advance while its stamp-stripped content DID change (normalize by stripping the version/stamp lines — the shared scrub vocabulary) is an ERROR finding naming the bump-first rule and the S1 recovery path.

**Guards (false-positive control)**: (1) first-time files (no HEAD blob) exempt; (2) deletions exempt; (3) stamp-only edits exempt — if the stamp-stripped normalized text is unchanged, no bump is required (the d82a73649 `last_reviewed` sweep class); (4) versionless files exempt from J1 (no token to advance); (5) docs without footers fall through to J2; (6) `templates/VERSION` itself is J2's subject, never J1's.

**Check J2 — release marker (WARN)**: when any tracked `templates/**` file changed and `templates/VERSION` is unchanged vs HEAD → WARN "release pending — templates/** moved without a templates/VERSION advance; on cut: feat → minor, fix/docs → patch, then bun scripts/tag-template.ts". The mapping is the release-cutter's rule, stated here and in the message; the gate flags, it does not prescribe the number.

**Context discipline**: the gate reads only the worktree-vs-HEAD delta, so it is silent on fresh checkouts and CI (no uncommitted delta) and active exactly in the dev-sync landing window (3.9/4.9 run before the commit). The `templates/**` enumeration is guarded by `existsSync("templates")` — the L1 twin copy running in a project (no `templates/` dir) skips both arms, matching Check I's dual-context contract.

### 4.3 Release-layer audit extension (audit.ts:3568-3586)

After the tag-existence pass, the check compares tree state: `git diff --name-only template-v<VERSION> HEAD -- templates/`. Non-empty → **Warn** (chosen vocabulary): "templates/** content drifted since template-v<VERSION> (N file(s)) — cut the release: bump templates/VERSION (feat → minor, fix/docs → patch) then bun scripts/tag-template.ts". **Why Warn, not Fail**: the tag publishes only after a merge lands on main, so a Fail would deadlock every ordinary `templates/**` landing (the fixing PR can never carry its own tag), and the 238-commit history proves an unnoticed Warn-grade signal is recoverable by the J2 gate at landing time — the audit check is the release-layer detector, not the discipline. Empty diff → Pass names the tag as current.

### 4.4 The overdue release (owner instruction)

Bump `templates/VERSION` 0.30.0 → **0.31.0** in the landing PR (19 days of accumulated feat+fix content justifies a minor). After merge, on `main`: `bun scripts/tag-template.ts` publishes `template-v0.31.0` at the merge commit; `bun scripts/audit.ts` then passes the extended check against the new tag. Fleet `template-version.txt` updates ride the next delivery wave (never hand-copied).

## 5. Order of implementation

| # | Piece | Path class | Canary / gate |
|---|---|---|---|
| 1 | §4.1 hooks + agents/docs/scripts routing | `scripts/upgrade-project.ts` (protected, human-merge) | BEFORE/AFTER dry-run diff on 4 canaries (§7) |
| 2 | §4.2 Check J | `scripts/lifecycle-sync-audit.ts` + L1 twin (mirror generator) | fixture tests: content-edit-without-bump flagged; bump → clean; stamp-only exempt |
| 3 | §4.3 audit extension | `scripts/audit.ts` (protected, human-merge) | audit run: Warn against template-v0.30.0; Pass against template-v0.31.0 post-cut |
| 4 | §4.4 VERSION bump | `templates/VERSION` | tag post-merge |

## 6. Alternatives considered

| Decision | Pro | Con | Decision |
|---|---|---|---|
| (a) Landing gate vs (b) auto-bump | (a) mechanical, reviewable, matches the mechanical-date-bump doctrine | (b) inflates semantic versions without review; churns the release marker per landing; contradicts the precedent's own boundary | **(a) chosen** |
| Audit drift check Warn vs Fail | Fail would force release discipline | Fail deadlocks ordinary templates landings (tag publishes post-merge only); the J2 landing gate already carries the hard per-file discipline | **Warn chosen** |
| Verdict rename in policy lib vs upgrade-project wrapper | policy lib = SSOT | policy lib is a protected twin pair; the rename is presentation, not disposition semantics — one L0-only file suffices | **wrapper chosen** |
| Route context.md through the helper wholesale | one code path | loses the project-only-section preserve + COMMON-CONTEXT splice for equal-version drift | **reason-string routing chosen** (guards intact) |

## 7. Risks

- **Attribution safety**: unchanged from S1 — no baseline row or project-moved → preserve; marker-loss blocks first; uncommitted edits conflict. The new agents/docs arms adopt exactly these guards (the agents arm gains the dirty-tree guard it lacked).
- **Check J false positives**: bounded by the six guards in §4.2; the stamp-only exemption reuses the strip-normalization the engine itself trusts (`normalizeForHash` vocabulary).
- **Verdict rename consumers**: `DRIFT_RESTORED` remains a real verdict (core-locked forks, vintage restores, agents PROJECT_EVOLVED heal) — consumers keying on it keep working; only the baseline-proven equal-version shape changes.
- **Release cut ordering**: the tag publishes post-merge; between merge and tag the audit check Warns once (VERSION advanced but tag absent) — the pre-existing tag-absence Warn, by design.

## 8. Acceptance criteria

- [ ] §4.1: agents equal-version + baseline-clean + differing content → `SYNC_TEMPLATE_ADVANCE` (INFO), delivered, lifecycle block preserved (engine test).
- [ ] §4.1: agents equal-version + project-moved → CONFLICT (ERROR) preserved (unchanged, pinned by test).
- [ ] §4.1: agents equal-version + uncommitted local edit → CONFLICT (WARN) preserved (new guard, test).
- [ ] §4.1: versioned doc equal-version + baseline-clean → delivered with `SYNC_TEMPLATE_ADVANCE`; project-moved → `DRIFT_PRESERVE` (both visible rows) (engine test).
- [ ] §4.1: `docs/context.md` equal-version + project-only sections → CONTEXT_PRESERVE + splice intact (test).
- [ ] §4.1: scripts baseline-proven equal-version → `SYNC_TEMPLATE_ADVANCE` (INFO); vintage → `DRIFT_RESTORED`; unproven → CONFLICT (unit/policy tests updated).
- [ ] §4.1: skills lanes byte-identical behavior (no hooks passed) — existing S1 tests stay green.
- [ ] §4.2: content edit without version bump → Check J1 ERROR; same edit with bump → clean; stamp-only edit → clean; new file → clean; versionless file → J2 only (unit tests on fixture trees).
- [ ] §4.2: `templates/**` change without VERSION advance → J2 WARN naming the mapping; VERSION advanced → clean (unit tests).
- [ ] §4.3: audit Warn when templates/** drifted since the published tag; Pass when current (verified against template-v0.30.0 pre-cut and template-v0.31.0 post-cut).
- [ ] §4.4: VERSION 0.31.0 + tag published post-merge; audit green.
- [ ] Gates: `bun test tests/unit` green; typecheck 0; audit, validate-templates, lifecycle-sync-audit pass.
- [ ] Canaries (dry-run only): co-consult skills terms-ko rows unchanged; co-design security.md stays preserved; co-hr iso-30414 2-line residual stays preserved; co-architect agents arm reports the new vocabulary for any baseline-clean equal-version pair and zero new ERROR rows.

## 9. Test plan

- **Engine** (temporary trees, the upgrade-template-advance fixture pattern): the §4.1 agents/docs matrix; a scripts baseline-proven scene asserting the new verdict; dry-run parity per scene.
- **Unit**: Check J on fixture git trees (content-edit-without-bump / bump / stamp-only / new file / versionless / VERSION advance); the audit drift-since-tag helper on fixture repos.
- **Canary replay**: BEFORE/AFTER dry-run diff on the four projects — zero new ERROR rows, preserved rows preserved, vocabulary changes only where designed.

## 10. Accessibility

Not applicable: non-UI change.

## 11. Preview verification

Not applicable.

## 12. Document impact

- **Design docs**: this document; registry row via spec-register (status approved).
- **SCRIPTS.md**: version rows ride their implementation commits (upgrade-project.ts, lifecycle-sync-audit.ts, audit.ts); L1 twin regenerated through generate-scripts-mirror.
- **docs/lifecycle/scripts/lifecycle-sync-audit.md**: phase-history row rides the Check J bump.

## 13. Implementation note — windows CI budget row (2026-11-27)

The §9 engine suite (`tests/unit/upgrade-lane-coverage.test.ts`) runs two full
wave-1 fixture spawns (co-work + co-consult bases) plus six scene spawns; its
first windows leg was killed at the 120000ms default wall (PR #2202 attempt
45916952645) — the exact engine-spawn-family shape T-20261127-002 documented
(spec docs/designs/2026-11-27-ticket-store-drift-and-nextid-design.md §5).
Remedy rides this spec: `scripts/test-runner.ts` v1.21.0 adds the first-time
FILE_TIME_BUDGETS row `upgrade-lane-coverage.test.ts` at the family budget
(300s suite / 60s test, macOS healthy ~21-25s). No test deleted or loosened;
budget only.

## 14. Implementation note — win32 placeholder derivation in the §9 suite (2026-11-27)

After the §13 budget row, the second windows leg failed on a REAL assertion:
`test A3` derived the expected rendered H1's project name with
`sA3.tmp.split('/').pop()` — on win32 the mkdtemp path carries BACKSLASHES, so
the manual forward-slash split produced the whole `C:\...` path as the
"project name" while the ENGINE correctly renders `basename(projectDir)` (the
same derivation new-project §5 uses; the #2189/#2201 windows path-separator
precedent). The engine was right; the fixture was wrong. Fix: the fixture now
derives the name with `basename(sA3.tmp)` (node:path, platform separators
handled), pinned by the same test — the A3 byte-equality assertion now holds on
all three OS lanes. No engine change.
