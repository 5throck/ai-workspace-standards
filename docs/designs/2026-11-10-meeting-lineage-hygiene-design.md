# Meeting Command Lineage Hygiene — Stale Stub Sweep and co-safety Fork Reconciliation — Design (Row 0)

- **Spec id**: `2026-11-10-meeting-lineage-hygiene-design`
- **Date**: 2026-11-10
- **Status**: implemented (spec registered via spec-register at implementation; Design Gate ruling DEC-20261110-01)
- **Author**: architect (PM-dispatched)
- **Tracking ticket**: T-20261109-003
- **Related**: `docs/lifecycle/skills/meeting.md` (retirement record, 2026-09-09/26), PR #1943 (meeting-facilitation v1.5.0 root alignment), U-20261109-001 (verification that surfaced this ticket), `docs/designs/2026-10-28-delivery-tombstone-ownership-design.md` (tombstone channel this design evaluates and declines to use), `scripts/upgrade-project.ts` (COMMANDS_SYNC / PRUNE REMOVED / tombstoneGuard), `docs/skill-graph.md` divergence table, skill-lifecycle-manager SKILL.md v1.5.0 (Step R1–R3, Registry Lockstep)

## 1. Problem statement

Root retired the legacy `/meeting` slash command (lifecycle record `docs/lifecycle/skills/meeting.md`; root `.claude/commands/` has no `meeting.md` since the retirement) and PR #1943 landed `meeting-facilitation` v1.5.0 (committee form) at root, its 5 dot-dir mirrors, `templates/common/skills/`, and 16 project copies. Two lineage residues contradict that state:

1. **38 stale v1.4.3 command stubs** (all byte-identical, sha256 prefix `893c8ca0`, 59 lines): the OLD pre-committee registration-stub text — it claims "the actual implementation resides in `.claude/commands/meeting.md`" (a self-reference — the file IS `.claude/commands/meeting.md`) and carries the retired 4-bullet output format. Any project surface that loads one serves retired v1.4.3 guidance, and the stub contradicts the projects' own `AGENTS.md` §6 ("the legacy `/meeting` slash command is retired (2026-09-26)"). Exact locations (verified 2026-11-10):
   - `templates/co-architect/.claude/commands/meeting.md`, `templates/co-architect/.gemini/commands/meeting.md`, `templates/co-architect/.codex/prompts/meeting.md` — **tracked template files, actively re-delivered** by upgrade-project to co-architect projects.
   - 35 project copies across 12 project repos: `.claude/commands/meeting.md` + `.gemini/commands/meeting.md` + `.codex/prompts/meeting.md` in Projects/co-abap-plugin, co-architect, co-consult, co-deck, co-design, co-develop, co-export, co-game, co-newbiz, co-price, co-security (3 each) and Projects/co-abap (2 — no `.gemini` copy).
   - **Persistence mechanism (verified in `scripts/upgrade-project.ts` v1.95.x)**: COMMANDS_SYNC (line ~3814) walks *template-side* command dirs only and delivers/copies; it never deletes a project file absent from the template. PRUNE REMOVED (`--prune-removed`, line ~7075) has categories `scripts/`, `agents/`, `skills/` — **no commands/ category**. `.codex/**` sits in the delivery skip set (only `.codex/config.toml` and skills are handled). The stubs were seeded by scaffold-era templates that once shipped `meeting.md`; when the templates dropped it, the project copies became undeliverable-and-unprunable residue that survives every upgrade forever. In co-architect the template still carries the stub, so COMMANDS_SYNC keeps it alive on every visit.
2. **co-safety fork lineage** — a *declared* variant fork with one residual defect:
   - `templates/co-safety/{.claude/commands,.gemini/commands,.codex/prompts}/meeting.md` and the Projects/co-safety mirrors are a full 329-line v1.5.0 command implementation (sha256 prefix `04b1ac07` — turn rules, 3-round cap, metadata header + Transcript + Action Items + Acceptance Criteria structure), delivered and hash-synced by COMMANDS_SYNC.
   - `templates/co-safety/skills/meeting-facilitation/SKILL.md` and the Projects/co-safety copy are v1.5.0 **registration stubs** pointing at that command, stamped `audit_exception: safety-os-skill-structure` (co-safety's own `scripts/audit.ts` skips such files — 58 of its template skills carry the stamp).
   - The fork is **declared, not silent**: co-safety's `skills/SKILLS.md` row reads "inherited from common — customized fork (variant-maintained)"; its `AGENTS.md` §6 registers the `meeting` command row; hub-and-spoke doctrine (AGENTS.md Hub-and-Spoke section) allows variant-local extensions.
   - Residual defect: template SKILL.md says `scope: co-safety`, the project copy carries scaffold-era `scope: common` (hash prefixes `bef3cf33` vs `51f0677e`) — the same residue visible in co-safety's `script-lifecycle-manager` and `sync` project copies. `docs/skill-graph.md` labels `meeting-facilitation` as `version-drift` (co-safety@1.5.0 vs root@1.5.0, distinct content).

## 2. Goals and non-goals

**Goals**

- G1: Delete all 38 stale v1.4.3 stubs — template-side in the main checkout PR, project-side as enumerated one-off commits in the project repos — with zero references left behind.
- G2: Recurrence prevention that is mechanical and grep/test-verifiable: after the template-side deletion, no upgrade run can resurrect a stub, and a structural pin fails the root sync if a `meeting.md` command ever reappears outside the co-safety lineage.
- G3: Reconcile the co-safety fork's one residual divergence (template↔project SKILL.md `scope:` mismatch) while preserving the declared fork (SKILL.md stubs, 329-line command) intact.
- G4: Document the co-safety lineage as a declared variant-local extension in the governance record, so the surviving skill-graph divergence row is adjudicated, not silent.

**Non-goals**

- No change to root `skills/meeting-facilitation/SKILL.md`, its mirrors, `skills/SKILLS.md`, or `docs/VERSION_MANIFEST.md` — the skill rows are canonical and correct post-#1943; this design touches **commands**, not skill content.
- No new PRUNE REMOVED commands/ category in upgrade-project (evaluated in §3.3; deferred — see Open questions).
- No tombstone grants (see §3.3 — the guard cannot fire for these paths; the template deletion supersedes it).
- No promotion of the co-safety command upstream and no retirement of it (decision (b), §3.2).
- No fix for `/meeting` mentions inside variant user-guides (co-design, co-export, co-hr, co-news, co-security) — those were already dangling since the 2026-09-26 retirement; separate docs concern.
- No change to co-safety's internal gates (`docs/_meta/VERSION_MANIFEST.md` row still reads 1.4.0 — that is co-safety's own lockstep to fix in its repo).

## 3. Design

### 3.1 D1 — Delete the 38 stale stubs (decision (a): retire, not regenerate)

Three options were evaluated: regenerate the stubs as skill-pointers, leave them, delete them. **Delete** is the recommendation.

| Option | Pro | Con | Decision |
|---|---|---|---|
| Regenerate as skill-pointer stubs | Command surface keeps resolving `/meeting` | Root doctrine deliberately retired the command; a pointer stub still *serves a command* that root retired and misdescribes the discovery path (the skill is invoked directly, not via `/meeting`) | Rejected |
| Leave in place | Zero effort | Actively serves retired v1.4.3 content; contradicts each project's own AGENTS.md retirement sentence; co-architect's template re-delivers forever | Rejected |
| Delete (retire cascade completion) | Completes the 2026-09-26 retirement across the fleet; project doctrine already agrees; discovery path is the v1.5.0 skill in every affected project | Requires a one-off 12-repo sweep | **Selected** |

This is a `remove` under skill-lifecycle-manager doctrine: the retirement record exists (`docs/lifecycle/skills/meeting.md`, status retired, successor `meeting-facilitation`), the retirement decision predates this design, and the sweep executes the already-approved removal on surfaces the record covers. No new deprecation window is needed — the command has been retired at root for over a year and the stubs misdescribe themselves.

**Execution split**:

- **Main checkout PR (tracked files)**: delete the 3 `templates/co-architect` stubs. Template-side absence is the upstream truth — once no template ships `meeting.md`, COMMANDS_SYNC has nothing to deliver and PRUNE REMOVED need not run.
- **Project repos (gitignored from the main checkout)**: one enumerated sweep commit per project repo, `git rm` of the exact paths listed in §1.1 (35 files / 12 repos; co-abap has 2). Executed by automation-engineer dispatch; the path list is enumerated in this design and enforced by the pin test, not by a glob.

### 3.2 D2 — co-safety fork: keep the command, fix the copy drift (decision (b): option 2)

| Option | Pro | Con | Decision |
|---|---|---|---|
| 1. Pull root canonical v1.5.0 SKILL.md in; retire co-safety's command | Full convergence; divergence row clears | Destroys a working richer surface that co-safety's own doctrine registers (AGENTS.md §6 command row, SKILLS.md "customized fork (variant-maintained)" remark, audit_exception across 58 skills); root canonical SKILL.md's Context sentence ("legacy `/meeting` slash command was retired") would misdescribe co-safety, where the command exists | Rejected |
| 2. Keep the command as a declared variant-local extension; fix only the copy drift | Preserves the declared fork; minimal diff; matches co-safety's own registry declaration | Root↔co-safety divergence row survives in skill-graph (must be adjudicated, see below) | **Selected** |
| 3. Promote co-safety's command upstream | One richer form everywhere | Reverses the deliberate 2026-09-26 root retirement of `/meeting`; root doctrine routes meetings through the skill (explicit invocation, AGENTS.md §6), not a command; the committee-form root skill is already v1.5.0-aligned fleet-wide | Rejected |

**Concretely, option 2 means**:

- Keep `templates/co-safety/{.claude/commands,.gemini/commands,.codex/prompts}/meeting.md` and the Projects/co-safety mirrors exactly as they are (COMMANDS_SYNC continues to deliver them — the sanctioned channel).
- Keep the SKILL.md stub-style copies with `audit_exception: safety-os-skill-structure` (co-safety's declared variant skill format).
- **The one fix**: align `Projects/co-safety/skills/meeting-facilitation/SKILL.md` to the template copy — `scope: common` → `scope: co-safety` — making the two hashes identical. The template is authoritative for variant skills; the project's `scope: common` is scaffold-era residue, the same residue co-safety's `script-lifecycle-manager` and `sync` project copies carry. The fix is a direct one-line edit in the co-safety repo (the VARIANT SKILLS pass is version-gated and both copies are 1.5.0, so `catchUpDir` would not heal it automatically).
- **Document the fork**: append a changelog line to `docs/lifecycle/skills/meeting.md` (workspace record, preserved per lifecycle rules) stating that the co-safety lineage is a declared variant-maintained fork (evidence: SKILLS.md remark, audit_exception, AGENTS.md §6) and that its divergence from root v1.5.0 is adjudicated, not drift. co-safety's own repo mirrors the note in its fork row if its PM elects to.

**Honest consequence**: the `docs/skill-graph.md` divergence row (`meeting-facilitation | skill | version-drift | co-safety@1.5.0; root@1.5.0`) **remains after this design**. The generator mechanically labels any ≥2 distinct content hashes; clearing it would require either option 1 or option 3 above — both doctrinally worse. What changes is its *status*: the row stops being an unadjudicated reconciliation candidate and becomes the mechanical signature of a declared fork. The acceptance criteria below pin this adjudicated state instead of pinning row disappearance.

### 3.3 D3 — Recurrence prevention (decision (c)): template deletion + structural pin; no machinery change

**(i) Commands removed at root/templates.** The delivery engine's removal channels were evaluated against the stub facts:

- **Tombstones** (delivery-tombstone-ownership design, `tombstoneGuard` in `scripts/lib/upgrade-policy.ts`): the guard fires only for a path that is *absent from the project* AND carries either a recorded tombstone or a delivered baseline in `.claude/last-upgrade-delivery.json`. The stubs predate the decision manifest (introduced 2026-10-27); most copies carry **no baseline**, so a `--tombstone` grant is inert for them (the guard never fires, the entry is never recorded). Recording one would require an extra per-project upgrade cycle whose only trigger is a TOMBSTONED (ERROR) verdict — and that verdict can never fire here because the template-side counterpart is deleted in the same effort, so no absent-copy delivery ever attempts the path again. Tombstones buy nothing the template deletion does not already guarantee, and the carry-forward rule prunes template-departed entries as provably inert. **Not used.**
- **New PRUNE REMOVED commands/ category**: the generality is not needed for this sweep (the paths are enumerated, the template truth is deleted) and it carries a real hazard: a retirement-keyed discriminator consulting `docs/lifecycle/skills/meeting.md` would classify co-safety's *legitimate* local command as retired-upstream and auto-delete it — the exact v1.64.0 class of over-prune that lesson (2026-09-12 fleet incident) forbids. **Deferred** to Open questions as future hardening with an explicit exclusion requirement.
- **Selected mechanism — two layers**:
  1. **Upstream truth**: the 3 `templates/co-architect` copies are deleted in the main PR. With no template shipping `meeting.md`, COMMANDS_SYNC (which walks template dirs) and every absent-copy delivery branch have nothing to deliver; PRUNE REMOVED never touches commands today and is not invoked.
  2. **Structural pin — `tests/unit/meeting-command-retirement.test.ts` (new)**: following the workspace's structural-pin discipline (the same shape as the repo-integrity design's registry pins), the test asserts:
     - no file named `meeting.md` exists under any `templates/*/.claude/commands/`, `templates/*/.gemini/commands/`, `templates/*/.codex/prompts/` **except** `templates/co-safety`;
     - the same scan over `Projects/*` (leg skipped when `Projects/` is absent, e.g. a CI checkout) finds `meeting.md` **only** under `Projects/co-safety`;
     - no `meeting.md` anywhere in command/prompt dirs carries the stub text (`actual implementation resides` / `registration stub`) — this catches a re-introduced stub even if it appears somewhere unexpected;
     - when `Projects/co-safety` exists, its `skills/meeting-facilitation/SKILL.md` is byte-identical to `templates/co-safety/skills/meeting-facilitation/SKILL.md` (hash equality — pins D2's fix and the fork's copy discipline).
     The whitelist *is* the variant-local exception record: co-safety's lineage is durably named in a test that runs in every root sync, so both recurrence (a stub re-added to any template) and over-sweep (a future global matcher deleting co-safety's command) fail loudly.

**(ii) Why the sweep cannot resurrect the stubs.** The resurrection vectors are: (a) template-side re-delivery — closed by template deletion + pin; (b) a scaffold from an old cached template — new-project consumes current templates, which contain no `meeting.md`; (c) manual re-addition — caught by the pin at the next sync. The `upgrade-project --dry-run` acceptance criterion below proves (a) empirically.

### 3.4 D4 — Registry and lockstep footprint

Per the Registry Lockstep Checklist, the surfaces touched are: the lifecycle record changelog (§3.2), the new pin test, and the spec registration of this design (ADR-0074 — `spec-register` before `/sync`; trivial-change exemption is not claimed). No skill frontmatter, `skills/SKILLS.md`, `VERSION_MANIFEST.md`, or platform skill mirror changes: commands are not skill registry rows, and no root skill version moves. The co-safety project repo changes (35 stub deletions, 1 SKILL.md `scope:` line) are separate per-repo commits and are listed as the sweep's execution footprint, not as main-PR diff.

## 4. Affected surfaces

**Main checkout PR (this design's implementation)**

| File | Action | Description |
|---|---|---|
| `templates/co-architect/.claude/commands/meeting.md` | delete | stale v1.4.3 stub (hash 893c8ca0) |
| `templates/co-architect/.gemini/commands/meeting.md` | delete | same |
| `templates/co-architect/.codex/prompts/meeting.md` | delete | same |
| `tests/unit/meeting-command-retirement.test.ts` | create | structural pin (§3.3) |
| `docs/lifecycle/skills/meeting.md` | modify | changelog line: fleet stub sweep completed; co-safety fork adjudicated as declared variant-local extension |
| `docs/designs/2026-11-10-meeting-lineage-hygiene-design.md` | create | this design (spec-registered) |

**Project repos (automation-engineer dispatch, separate commits)**: 35 stub deletions across 12 repos (§1.1 list); `Projects/co-safety/skills/meeting-facilitation/SKILL.md` `scope:` fix.

**Platform impact**

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code | `templates/co-architect/.claude/commands/meeting.md` removed (stub retirement — no live command lost; root never had one post-2026-09-26) | that file; co-safety's command untouched |
| Antigravity (GEMINI.md) | `templates/co-architect/.gemini/commands/meeting.md` removed (same rationale — `.gemini/commands/meeting.md` was the stub's Gemini surface) | that file; co-safety's command untouched |
| templates/common | None — `templates/common/.claude/commands/` carries 7 commands, none named `meeting.md`, and does not change | None |

## 5. Acceptance criteria (verifiable)

- [ ] `find` over the workspace (excluding `node_modules`, `.git`) for `meeting.md` inside any `commands/` or `prompts/` directory returns **exactly** the 6 co-safety lineage files (`templates/co-safety` + `Projects/co-safety` × 3 dot-dirs) plus nothing else; zero files with sha256 prefix `893c8ca0` remain anywhere.
- [ ] `grep -rn "actual implementation resides"` and `grep -rn "registration stub"` across all `commands/`/`prompts/` trees return no hits.
- [ ] `tests/unit/meeting-command-retirement.test.ts` passes; planting a synthetic `templates/co-design/.claude/commands/meeting.md` (in a temp fixture tree or via test-local override) makes it fail — the pin's sensitivity is demonstrated, not assumed.
- [ ] `diff templates/co-safety/skills/meeting-facilitation/SKILL.md Projects/co-safety/skills/meeting-facilitation/SKILL.md` is empty (hash-identical copies).
- [ ] `bun scripts/upgrade-project.ts Projects/co-newbiz --dry-run` reports no `NEW`/`UPDATE`/`COPIED` verdict for any `meeting.md` command path — the sweep is not resurrected by an upgrade run; same dry-run over `Projects/co-architect` (whose template no longer carries the file).
- [ ] `templates/common/.claude/commands/` still contains exactly its 7 files (changelog, commit-push-pr, gateguard, memlog, new-task, project-review, sync) — no collateral change to the live command set.
- [ ] `docs/lifecycle/skills/meeting.md` carries the sweep + fork-adjudication changelog line; `docs/VERSION_MANIFEST.md` and `skills/SKILLS.md` meeting-facilitation rows are byte-unchanged (no version bump — commands are not skill rows).
- [ ] co-safety's declared-fork markers survive intact: `templates/co-safety/skills/SKILLS.md` meeting-facilitation row still reads "customized fork (variant-maintained)"; the `audit_exception` line remains in both co-safety SKILL.md copies.
- [ ] `bun run test` / `bun scripts/typecheck.ts` / `bun scripts/audit.ts` green; the design is spec-registered (`bun scripts/spec-register.ts --file docs/designs/2026-11-10-meeting-lineage-hygiene-design.md --source manual --status proposed` at review, `implemented` at landing).

## 6. Rollback

All changes are deletions plus one test and one changelog line — no schema, manifest, or version state. Rollback = revert the main PR (the 3 template files return; COMMANDS_SYNC would re-deliver them to co-architect projects on the next upgrade, which is the pre-design behavior) and revert each project-repo sweep commit (`git revert`). The co-safety `scope:` fix reverts by restoring the one line. No tombstone entries, no delivery-manifest mutations, no registry regeneration to unwind.

## 7. Open questions

1. **PRUNE REMOVED commands/ category (future hardening, deferred)**: if the fleet later wants automatic removal of template-departed commands, the category's upstream must be the *variant template + common template* trees only — it must **not** consult root retirement records, or `docs/lifecycle/skills/meeting.md` (which marks `meeting` retired) would misclassify co-safety's legitimate local command as prunable. Requires a design of its own; not in this PR.
2. **`/meeting` mentions in variant user-guides** (co-design, co-export, co-hr, co-news, co-security `docs/user-guide*.md`): dangling since the 2026-09-26 retirement, now more visibly so. Fold into the next variant doc refresh or a separate docs sweep?
3. **co-safety internal lockstep**: its `docs/_meta/VERSION_MANIFEST.md` row for meeting-facilitation still reads 1.4.0 (actual SKILL.md is 1.5.0) — co-safety's own gate will flag it; the fix belongs to co-safety's repo sync cycle, not this design.
4. **co-safety command usage evidence**: no telemetry exists for actual `/meeting` usage inside co-safety. If a future session-evidence review shows the fork's command is unused, option 1 (converge + retire) or option 3 (promote upstream) can be revisited with evidence per skill-lifecycle Step R1. Until then the declared-fork state is the correct steady state.

## 8. Accessibility exemption note

Documentation/scaffolding-only change: file deletions in template and project scaffolds, one structural test, one lifecycle-record changelog line. No user-facing interface, layout, or rendered content is produced; the accessibility audit is exempt for this design.

## 9. References

- `docs/lifecycle/skills/meeting.md` — retirement record (2026-09-09), successor `meeting-facilitation`
- `scripts/upgrade-project.ts` v1.95.x — COMMANDS_SYNC (template-walking delivery, ~line 3814), PRUNE REMOVED categories (~line 7075: scripts/agents/skills only), tombstoneGuard firing conditions + carry-forward pruning (~lines 7692–7775), `.codex/**` delivery skip set (~line 5461)
- `scripts/lib/upgrade-policy.ts` — `tombstoneGuard` (fires only on absent + recorded-tombstone/baseline)
- `templates/co-safety/skills/SKILLS.md` row 39 — "inherited from common — customized fork (variant-maintained)"
- `Projects/co-safety/AGENTS.md` §6 — `meeting` command row; `Projects/co-safety/scripts/audit.ts` ~line 1493 — `audit_exception` skip
- `docs/skill-graph.md` line 835 — the `version-drift` row this design adjudicates
- PR #1943 (v1.5.0 root alignment), U-20261109-001, T-20261109-003
- `docs/designs/2026-10-28-delivery-tombstone-ownership-design.md` (tombstone channel evaluated and declined), `docs/designs/2026-11-09-repo-integrity-mode1-detector-design.md` (house format + structural-pin discipline exemplar)
