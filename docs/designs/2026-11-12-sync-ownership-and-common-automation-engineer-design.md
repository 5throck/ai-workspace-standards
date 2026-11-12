# `/sync` Ownership and a Common `automation-engineer` — Design (Row 0)

- **Spec ID**: `2026-11-12-sync-ownership-and-common-automation-engineer-design`
- **Date**: 2026-11-12
- **Status**: approved, with user decisions D1-D12 recorded (2026-11-12, Decisions section). O1 and O2 were accepted at their proposed defaults (D13, D14, 2026-11-12). Design Gate ruling recorded; registry entry is `approved`.
- **Author**: architect (Design Gate Row 0, design only)
- **User request (2026-11-12, translated)**: "Make the execution-plan boilerplate's `/sync` step handled by automation-engineer, and create automation-engineer in templates/common so it can be delivered to the Projects/co-* projects."
- **Related**: [`2026-11-12-common-agents-for-common-skills-design.md`](2026-11-12-common-agents-for-common-skills-design.md) (CA series; CA-1 PR #1978 merged as `f4149a89c`), [`2026-11-12-skill-lifecycle-record-delivery-design.md`](2026-11-12-skill-lifecycle-record-delivery-design.md) (U-005), ADR-0043, ADR-0096, ADR-0102, CONSTITUTION §7.5 "L0 Agent Non-Propagation".
- **Scope**: design only. This document creates or changes no agent, skill, script, contract entry, template, or instruction file. All facts were measured on `origin/main` @ `032724a82` (2026-11-12, after the CA-1 merge).
- **Boundary note (CLAUDE.md §9)**: root (L0) files and `templates/` files never share a PR. The sequence in §6 follows that rule. `/sync` publish steps that write `templates/common` copies of root files (governance-l1, L0→L1 publish) are the sanctioned exception, as in CA-1. Two root test/helper edits inside a templates PR need an explicit sanction (§6, R8).

## Decisions (2026-11-12)

The user decided these items on 2026-11-12. They are binding for this design. "Accepted default" means the user accepted the architect's proposed default by delegation.

| # | Question | Decision | Effect |
|---|---|---|---|
| D1 | Q9 sequencing | **Merge into the CA series**: AE-0 design doc → AE-1 root → CA-2+AE-2 templates → CA-3+AE-3 root → CA-4 → fleet wave → U-005 PR-2/PR-3. | §6 |
| D2 | Q1 policy carve-out | CA-1 is merged and wrote "the L0 specialist roster stays non-propagated" into CONSTITUTION §7.5 (`CONSTITUTION.md:519`) and ADR-0043 §6 (`docs/adr/0043-l1-agent-layer-hybrid-override.md:86-88`). **AE-1 amends that CA-1 text** to carve out `automation-engineer`. No revert. | §4, §6 |
| D3 | Q2 landing verification | **Add** a PM landing-verification row after `/sync`. Reword "`/sync` is always the final step" to "`/sync` is the last implementation row" at L0 and L1. | §2.1 |
| D4 | Q3 PM read-only Bash | **Add** `gh pr view`, `gh pr checks`, `git show` to the PM read-only Bash list everywhere it is enumerated. `gh pr merge` is **not** added; merge happens only on the user's request through the designated path (O2). | §2.2, §4 |
| D5 | Q6 co-architect | **Fold** co-architect's `automation-engineer` capabilities into the common `automation-engineer`, make the common agent tier **Medium**, and make it common. co-architect's separate file is reconciled into the common agent, not kept as an override. | §3, §5 |
| D6 | Single rule vs split tier | **One rule**: the L0 root `agents/automation-engineer.md` changes to tier **Medium** to match the common agent. The `/sync` row is `automation-engineer \| Medium \| sonnet` at L0, L1, and in every project. | §2, §4 |
| D7 | Q4 haiku/model failure | Accepted default: **escalate only**. No tier raise after a failure. At Medium the Low-model risk is largely gone (§2.5), but the pipeline complexity is unchanged, so S1-S5 stay. | §2.5 |
| D8 | Q5 variant presence | Accepted default: **common agent only**. No `extends:` stubs in each variant. | §3.1 |
| D9 | Q7 `sync` skill owner | Accepted default: **retarget** `owner:` from `pm` to `automation-engineer`, before U-005 PR-2. | §4, §6 |
| D10 | Q8 gate-active projects | Accepted default: **per-project registration**. Each project upgrade PR adds one `agents[]` entry to the project `variant.json` before the apply. | §5 |
| D11 | Q10 L1 lifecycle record | Accepted default: **follow the CA design** (CA Q6; still pending in the CA document). | §4 |
| D12 | Q11 final scope | Accepted default: sync pipeline **plus** repository automation **plus** the generalized co-architect platform-implementation capabilities (§3.2). | §3.2 |

## 0. Summary

The boilerplate assigns the `/sync` row to `pm`, but the PM may only run read-only Bash. `/sync` runs `scripts/dev-sync.ts`, which writes files, commits, pushes, and opens a PR. The row asks the PM to break its own execution scope. This design moves the `/sync` row to `automation-engineer`, tier **Medium** (`sonnet`), at every layer (D6). The PM keeps the design-gate decision and verification rows, and gains a landing-verification row after `/sync` (D3) with three more read-only commands (D4).

The common `automation-engineer` is an L1-authored body. It merges the generic part of co-architect's platform-implementation agent with the repository-automation and sync duties of the L0 agent (D5, D12). co-architect's own file is removed; its CAD-specific bindings move to the co-architect context document (O1). The L0 agent changes from Low to Medium, so every document, roster, and validator that says "automation-engineer is Low/haiku" changes with it (§4). Delivery to the fleet uses the CA mechanism plus a per-project `variant.json` registration for the five gate-active projects (D10).

## 1. Fact check (origin/main @ `032724a82`)

### 1.1 Every place the `/sync` row is defined with `pm`

Live governance definitions (normative):

| File:line | Row text (abridged) | Layer | Maintenance |
|---|---|---|---|
| `docs/governance/agents/execution-plan-templates.md:25` | `\| N \| /sync ... \| pm \| Medium \| inherit (<session model alias>) \| \|` (§5.1 template) | L0 | hand-maintained |
| `docs/governance/agents/execution-plan-templates.md:74` | same, §5.2 Platform form, `Both` | L0 | hand-maintained |
| `docs/governance/agents/execution-plan-templates.md:99` | Example 1 row 6, `inherit (sonnet)` | L0 | hand-maintained |
| `docs/governance/agents/execution-plan-templates.md:113` | Example 2 row 3, `inherit (sonnet)` | L0 | hand-maintained |
| `templates/common/docs/governance/agents/execution-plan-templates.md:30,79,104,118` | same four rows | L1 | L1-authored fork (DEC-20261028-05); excluded from propagation (`scripts/propagation-map.json:298-309`) |
| `GEMINI.md:109` | Antigravity `implementation_plan.md` artifact template: `\| N \| /sync ... \| pm \| Medium \| [Model String] \|` | L0 | governance-l1 published |
| `templates/common/GEMINI.md:109` | same | L1 | written by `/sync` step 4.51 (`scripts/dev-sync.ts:1468`, `--apply --governance-l1 --docs`) |

Rule text that names `/sync` as a PM row:

| File:line | Text |
|---|---|
| `docs/governance/agents/execution-plan-templates.md:35`, L1 fork `:40` | "A row whose Agent is the PM — the design-gate decision, a verification step, `/sync`, or any other PM-owned step ... must appear" |
| `...:41`, L1 `:46` | "the `/sync` row stays blank there" (Spec column) |
| `...:42`, L1 `:47` | "`/sync` is always the final step" |
| `...:45`, L1 `:50` | "\"pm (direct)\" is FORBIDDEN - PM never executes directly" |

Variant user-facing copies (illustrative, not normative):

| File:line | Agent / Tier / Model |
|---|---|
| `templates/co-consult/docs/user-guide.md:21`, `user-guide_ko.md:26` | pm / Medium / sonnet |
| `templates/co-deck/docs/user-guide.md:17`, `_ko.md:22` | pm / Medium / [model] |
| `templates/co-design/docs/user-guide.md:18`, `_ko.md:23` | pm / Medium / sonnet |
| `templates/co-develop/docs/user-guide.md:19`, `_ko.md:24` | pm / Medium / [model] |
| `templates/co-game/docs/user-guide.md:25`, `_ko.md:30` | pm / Medium / sonnet |
| `templates/co-learning/docs/user-guide.md:19`, `_ko.md:25` | pm / Medium / [model] |
| `templates/co-safety/docs/user-guide.md:19`, `_ko.md:24` | pm / **High** / `sync` (already inconsistent with the Medium PM tier) |
| `templates/co-security/docs/user-guide.md:21`, `_ko.md:26` | pm / Medium / [model] |
| `templates/co-deck/docs/designs/2026-07-20-solid-drawer-toc-style.md:80,82` | historical design record (also an `automation-engineer \| Low \| haiku` row); leave unchanged |

`CLAUDE.md:254-262`, `CODEX.md:142`, and `HERMES.md` carry no `/sync` row. They point to execution-plan-templates §5.1.

### 1.2 Prose that says the PM runs `/sync`

| File:line | Text (abridged) |
|---|---|
| `agents/pm.md:86` | Phase 5: "... then start the sync pipeline" |
| `agents/pm.md:90` | "the sync pipeline commits and creates the PR ... This is a PM closing action, not a phase" |
| `templates/common/agents/pm.md:112` | "**Finalization** — run memlog → sync pipeline, create the PR" |
| `docs/adr/0096-variant-phase-ownership-and-qa-gate.md:19` | Decision 2: "After the Phase 6 gate passes, PM runs `/sync`, opens the PR, and hands off." |
| `docs/constitution/05-multi-agent-architecture.md:113` | "PM closes out (not a phase): runs /sync" |
| `docs/governance/agents/workflows.md:135`, `templates/common/docs/governance/agents/workflows.md:104` | same sentence |
| `templates/common/docs/phase-definitions.md:76` | "PM runs `/sync` pipeline" |
| Variant `docs/phase-definitions.md` | co-consult:98, co-design:71, co-develop:70, co-export:70, co-game:73, co-learning:70, co-security:73, co-work:68 |
| Variant context and READMEs | `co-architect.context.md:207`, `co-consult.context.md:151`, `co-develop.context.md:107`, `co-learning.context.md:101`, `co-develop/README.md:73`, `co-learning/README.md:66`, `co-develop/docs/user-guide.md:92`, `co-learning/docs/user-guide.md:89`, `co-architect/docs/guides/first-time-user-guide.md:91` |
| `skills/sync/SKILL.md:9` (and common copy) | `owner: pm` |

### 1.3 The contradiction, verified

- `AGENTS.md:17` (§0 item 3, binding): the PM "never performs Write/Edit on any file except `memory/*.md` and `CHANGELOG.md`."
- `AGENTS.md:77-85` (§3.1.1): Conditional Bash = "Read-only: `git status/diff/log`, `bun scripts/audit.ts`, `ls`, `cat`". "Bash (write/execute patterns)" is Forbidden. `agents/pm.md:113-117` and `templates/common/agents/pm.md:139-141` repeat it.
- `scripts/dev-sync.ts` (2,731 lines, identical L1 copy) regenerates files, stages, branches, commits, pushes, and runs `gh pr create`.
- Result: §5.1 assigns a Forbidden action to the PM. The premise of the request is correct.
- **Recorded practice (reported by the coordinating PM, 2026-11-12)**: before this amendment, the PM session already ran `gh pr checks` and `gh pr merge` outside the documented read-only scope. D4 legalizes the two read-only commands (`gh pr view`, `gh pr checks`) and `git show`. It does not legalize `gh pr merge`.

### 1.4 Machine checks on the PM row, the `/sync` row, and the tier

No validator, audit check, hook, or unit test checks who owns the `/sync` row or whether PM rows are present. The PM-row rule is prose-only. Checks that touch the change:

| Check | File:line | Relevance |
|---|---|---|
| E1-E5 exemption codes | `scripts/audit.ts:389-395`, `:3883`; `scripts/dev-sync.ts:1222,1270` | E5 `sync-only` stays valid; no owner semantics. |
| roster-tier-consistency | `scripts/validate-templates.ts:3672-3800` | Root `AGENTS.md` roster Tier must equal the frontmatter tier, so `AGENTS.md:48` changes in the same PR as the L0 tier (AE-1). Variant rows may not exceed the L0 baseline unless `tier_ceiling_exempt` is set (`:3787`). With the L0 baseline at Medium, co-architect's Medium no longer needs the exemption. |
| VA-02 workspace-root agent intrusion | `scripts/validate-templates.ts:5723-5760` (`WORKSPACE_ROOT_AGENTS` at `:5732` includes `automation-engineer`) | FAILs if a variant `AGENTS.md` numbered row names `automation-engineer` in the Agent cell. Must change once the agent is common. |
| C-AG-01 / C-AG-02 | `scripts/validate-templates.ts:5093-5140` | C-AG-01 warns on byte-identical variant copies; C-AG-02 warns on declared replacement overrides. Neither fires after co-architect's file is removed. |
| `agent-model-gate.ts` v1.3.0 | `scripts/hooks/agent-model-gate.ts:58-60` (`AGENTS_DIR` = `<script>/../../agents`), `:109-150` | Reads each `agents/*.md` scalar `tier:` live and derives the alias from `docs/workspace-schema.json` `models.claude` (`medium` = `claude-sonnet-5-5` → `sonnet`). After D6 the gate requires `model: "sonnet"` for `automation-engineer` at L0 and in projects (both ship `docs/workspace-schema.json`). **No code change.** No unit test in `tests/` covers this hook today. |
| `pm-dispatch-gate.ts` | `scripts/hooks/pm-dispatch-gate.ts:81-86` | Roster = live `agents/*.md` minus `pm.md`. No change. |
| Hook copies | `templates/common/scripts/hooks/{agent-model-gate,pm-dispatch-gate}.ts` | Byte-identical to L0. |
| L1 agent count pin | `tests/unit/apply-tier-normalization.test.ts:288-290` | Hardcodes `rootCount 9`, `l1Count 2`. Every PR that adds a common agent fails it, CA-2 included. `rootCount` stays 9 (tier change only). |
| Scaffold delivery parity exclusions | `scripts/helpers/scaffold-markers.ts:364-395` (`agents/i18n-specialist.md` at `:388`) | New common agents likely need the same reviewed exclusion entry for L3 drafts. |
| governance-l1 transforms | `scripts/propagate-to-templates.ts:1496-1537` (B-A7, B-A12), `:1575-1583` (B-A9) | Rewrite `automation-engineer` to `[implementation specialist]` in L1 AGENTS.md prose. Review once the name is real at L1. |
| Dead transforms | `scripts/propagate-to-templates.ts:1253-1270` (B-1..B-5) | Remnants of an older `auditor (workspace) / pm (variant)` final row. Out of scope. |
| Dormant text | `scripts/helpers/merge-frontmatter.ts:1203` (and L1 copy) | String "is always Low"; no live caller. Updated for truthfulness in AE-1 (§4). |
| `sync-model-registry.ts` SURFACES | SURFACES list | A body with scalar `tier:` and no model literals needs no entry. |
| Tier pins in tests | `git grep automation-engineer tests/` | Only `tests/unit/upgrade-policy.test.ts:449-453` (uses the root file as a full-body fixture; tier-neutral). `team-builder-tier`, `agent-tier-frontmatter-normalization`, `validate-model-registry-tier-coverage`, `regenerate-agents-md` tests use fixtures, not the real automation-engineer tier. |

**Stale prose**: `CLAUDE.md:286` (and L1 copy) says `agent-model-gate.ts` checks "the 8 workspace-root agents (...)" and is "L0-only; not propagated". Both are false since v1.3.0.

### 1.5 The current `automation-engineer` (L0) and co-architect's

| Field | L0 `agents/automation-engineer.md` | co-architect `templates/co-architect/agents/automation-engineer.md` |
|---|---|---|
| tier | `low` (`:6`) | `medium` (`:7`) + `tier_ceiling_exempt` (`:8`) |
| version | `1.0.0` | `1.0.1` |
| phases | Can Lead [4], Support [1] (`:42-43`) | `phases: [3, 4]`, Can Lead [3, 4], Support [1] |
| handoff | Auto-Dispatch To `docs-writer`, `scaffolding-expert` (`:44-46`, L0-only agents) | `handoff_to: [pm]`, `handoff_from: [architect, pm]` |
| required_skills | none declared | `[]` |
| Scope | TypeScript ops scripts (ADR-0036), cross-platform, idempotent | MCP tool handlers, Python models, ZWCAD COM logic, unit tests for the software/platform layer |
| L0-only / variant-only text | `:23` "ai-workspace-standards repository"; `:60` ADR-0036 path; `:70-72` root script examples; `:100` "Architect's domain" | `src/cad_intelligence/...`, `TOOL_SCHEMAS`/`TOOL_HANDLER_MAP`, `ZWCADConnectionError` and siblings, `pyproject.toml` deps, `memory/drawings/*.json`, zwcad-drafter relationship |

Other facts: `AGENTS.md:48` lists the L0 agent as Low; CONSTITUTION §7.5 (`CONSTITUTION.md:497-521`) names it non-propagated; CA-1 added "the L0 specialist roster stays non-propagated" (`:519`) and ADR-0043 §6 (`:86-88`); `_COMMON.md:22-27` repeats the non-propagation list. The Tier Ceiling Rule (`docs/governance/agents/pm-gateway-workflow.md:28`) says "`automation-engineer` is always Low". co-architect also commits a mirror `templates/co-architect/.claude/agents/automation-engineer.md` (no other platform mirror dirs exist in that template) and lists the agent in `variant.json:29-30` and team `platform-engineering` (`:186-191`).

### 1.6 Equivalent agents in variants (L2) and projects (L3)

| Variant | Same name `automation-engineer` | Implementer equivalents (name, tier) |
|---|---|---|
| co-architect | **yes** (see §1.5) | prototype-engineer (medium) |
| co-abap | no | code-writer (low), devops-admin (medium) |
| co-develop | no | code-writer (low), stack-setup (low) |
| co-game | no | game-developer (low), stack-setup (low) |
| co-price | no | core-engine-dev (high), devops-admin (medium) |
| co-security | no | patch-engineer (medium) |
| co-design | no | prototype-engineer (medium) |
| co-consult, co-deck, co-export, co-hr, co-learning, co-news, co-safety, co-work | no | none with an implementation role |

Fleet projects (16; `bun scripts/fleet-list.ts --root <workspace>` also prints `co-deck-worktrees` and `co-newbiz-worktrees`, which look like non-project directories; observation only):

| Project | Frozen | Own implementer file | Upgrade asset gate |
|---|:-:|---|---|
| co-abap | yes | code-writer.md | inactive |
| co-architect | no | automation-engineer.md (medium, 1.0.1, variant-delivered) | ACTIVE (24 agents, lists automation-engineer) |
| co-consult | no | — | inactive |
| co-deck | yes | — | ACTIVE (11 agents) |
| co-design | no | — | inactive |
| co-develop | no | code-writer.md | inactive |
| co-export | no | — | inactive |
| co-game | no | — | inactive |
| co-hr | yes | — | inactive (no variant.json) |
| co-learning | no | code-writer.md (project-local, low 1.2.0) | inactive (no variant.json) |
| co-newbiz | yes | infra-automation-engineer.md, release-engineer.md, docs-writer.md (no template) | ACTIVE (41 agents) |
| co-news | no | — | inactive (no variant.json) |
| co-price | no | — | ACTIVE (15 agents) |
| co-safety | yes | — | ACTIVE (40 agents) |
| co-security | no | — | ACTIVE (7 agents; already registers i18n-specialist) |
| co-work | no | — | inactive |

### 1.7 Delivery mechanics that constrain the design

- `scripts/new-project.ts:993` copies `templates/common` first; `:1118` overlays the variant afterwards. A same-named variant file wins.
- `scripts/upgrade-project.ts:5170-5181`: variant agents are walked first, then common agents, with a filename seen-set.
- `scripts/upgrade-project.ts:5090-5113`, `:5327-5336`: a **new** agent file is withheld ("SKIP (not in variant.json agent registry)") when the project `variant.json` has a non-empty agents/skills list that does not register it. `variant.json` is project state, never delivered (`scripts/lib/upgrade-policy.ts:588`). This affects the CA agents too; CA design §5 item 8 does not mention the asset gate.
- `scripts/upgrade-project.ts:5360-5385`: a same-named project file at a lower version goes through the CONFLICT/ADOPT guard. `:5415-5421`: a higher project version is PROJECT_AHEAD. `:5422`: an **equal** version with different content is restored to canonical (overwritten).

## 2. Rule (D3, D4, D6, D7)

### 2.1 Row ownership

| Row | Agent | Tier | Model (Claude Code) | Spec |
|---|---|---|---|---|
| 0 | architect (or E1-E5 exemption marker) | High | `opus` | NEW / spec-id |
| 0a | pm — Design Gate decision | Medium | `inherit (<alias>)` | — |
| 1..k | specialists | per frontmatter | per tier | spec-id |
| k+1 | pm — verify deliverable against acceptance criteria | Medium | `inherit (<alias>)` | — |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | **automation-engineer** | **Medium** | **`sonnet`** | (blank) |
| N+1 | pm — verify landing: PR URL, branch, CI state, committed file set | Medium | `inherit (<alias>)` | — |

On other surfaces the Model cell carries the literal Medium-tier model ID from `docs/workspace-schema.json` `models.*`. The rule is the same at L0, L1, and in every project (D6).

Rule text changes (execution-plan-templates §5.1, L0 and L1 fork, kept word-identical where both carry the bullet):

1. The PM-row sentence lists "the design-gate decision, a verification step, the landing verification, or any other PM-owned step". `/sync` leaves the list.
2. New bullet: "The `/sync` row is owned by `automation-engineer` (Medium). PM never runs `/sync`."
3. The final-step bullet becomes: "`/sync` is the last implementation row. Only the PM landing-verification row follows it." (D3)
4. E5 `sync-only` plans: Row 0 is the exemption marker, row 1 the `automation-engineer` `/sync` row, row 2 the PM landing verification.
5. The Spec-column note stays: the `/sync` row is blank there; PM rows carry `—`.

### 2.2 What the PM keeps and gains

- Rows 0a, k+1, N+1 are PM rows; all are mandatory.
- Close-out accountability stays with the PM (AGENTS.md §3.1.2). ADR-0096 Decision 2 changes from "PM runs `/sync`" to "PM dispatches `/sync` to automation-engineer, verifies the landing, and hands off". PR creation stays a close-out, not a phase.
- **Read-only Bash (D4)**: `git status/diff/log`, `git show`, `gh pr view`, `gh pr checks`, `bun scripts/audit.ts`, `ls`, `cat`.
- **Merge is not a PM action**. A PR merges only on the user's explicit request through the designated path (O2). The PM never runs `gh pr merge`.

### 2.3 Consistency with existing rules

| Rule | Effect |
|---|---|
| PM rows mandatory, every column filled | Holds. The PM-owned rows are 0a, k+1, N+1. |
| "pm (direct)" forbidden | Strengthened: the old `/sync` row was the standing case of PM direct execution. |
| Tier Ceiling Rule | Holds with new text: "`automation-engineer` is Medium; assigning it High is a governance violation." The defined tier is Medium at every layer (D6). `tier_ceiling_exempt` on co-architect becomes redundant and leaves with the file (§3.4). |
| Permission Denial Protocol | If automation-engineer's Bash or git is denied: Type C. The PM outputs the escalation template and gives the user the exact `/sync` command. The PM does not run it. |
| Universal Design Gate / spec-check | Unchanged. |
| `--no-verify` / `SYNC_ACTIVE` bans | Unchanged and restated in the agent body. |
| One-PR-at-a-time, worktree landing | The PM brief names the worktree path and the staged file list (`SYNC_SCOPED_STAGING`). |

### 2.4 Surface semantics

| Surface | How the `/sync` row executes |
|---|---|
| Claude Code CLI | `Agent()` subagent, `model: "sonnet"`; `agent-model-gate.ts` asks when the model is missing |
| Claude Code Desktop App | same; hooks intermittent, prompt self-enforcement |
| Gemini CLI | `invoke_subagent` with the literal Medium model; `pm-dispatch-gate.ts` wired |
| Antigravity / Antigravity CLI | artifact plan row (`GEMINI.md:109` template) |
| Codex CLI / Desktop / IDE | no native subagent; the session runs the row under the automation-engineer role (`CODEX.md:21,150`) |
| Hermes Agent / CLI | same in-session role pattern (`HERMES.md:38`) |

### 2.5 Pipeline risk and safeguards (D7)

At Medium the main risk of the first draft (a Low model misreading FATAL gates) shrinks to the general risk of a dispatched agent without session context. The pipeline is unchanged: FATAL gates, scoped staging, worktree landing, `--body-file` English check, sensitive-file guard. Safeguards stay:

- **S1 Brief contract**: the PM prompt carries the commit message, worktree path, explicit staged-file list, and PR body file path.
- **S2 Fixed procedure**: the body's "Sync Execution" section runs only the `sync` skill steps. On a FATAL or non-zero exit it stops and returns the output verbatim. It never retries with new flags, never uses `--no-verify`, never sets `SYNC_ACTIVE`, never force-pushes, never merges.
- **S3 Landing verification (N+1)**: `git log -1 --stat`, `git show`, `gh pr view --json url,headRefName,files`, `gh pr checks`; compare committed files with the S1 list.
- **S4 Iteration cap**: one re-dispatch after a fixable failure, then escalate to the user. No tier raise (D7).
- **S5 Model enforcement**: on Claude Code CLI the gate enforces `sonnet`; elsewhere prompt-enforced.

## 3. The common `automation-engineer` (D5, D8, D12)

### 3.1 Form

L1-authored standalone body `templates/common/agents/automation-engineer.md`, hand-maintained (precedent: `i18n-specialist.md`, the execution-plan-templates fork). No `extends:` to root (would leak L0 text, the U-20261112-006 class), no propagation-map entry, no per-variant stubs (D8).

### 3.2 Final scope (D12)

1. **Sync pipeline**: owns the `/sync` row (§2, S1-S5).
2. **Repository automation**: project `scripts/` (TypeScript via Bun), hook configuration, `package.json` scripts, and CI workflow files, per an approved plan; idempotent, cross-platform, UTF-8 explicit.
3. **Platform-layer implementation (from co-architect, generalized)**: implement approved plans for the project's software/tooling layer — tool or server handlers, backend data models, integration bridges — and their unit tests.

Routing rule: when a variant has a dedicated domain implementer (`code-writer`, `game-developer`, `core-engine-dev`, `patch-engineer`, `prototype-engineer`), that agent owns domain code; `automation-engineer` owns items 1-2 and platform/tooling work the plan assigns to it.

### 3.3 What is merged from co-architect (D5)

| co-architect element | Disposition in the common body |
|---|---|
| Tier `medium` | **Merged** (common and L0 both Medium, D6) |
| Can Lead [3, 4], Support [1]; `phases: [3, 4]` | **Generalized**: "leads implementation per the project's workflow table; supports analysis". No `phases:` frontmatter (ADR-0096 Decision 3: common files do not hardcode phase numbers) |
| `handoff_to: [pm]`, `handoff_from: [architect, pm]` | **Merged as** `handoff_to: [pm]`, `handoff_from: [pm]` (architect is absent in 11 of 15 variants; plans reach the agent through PM) |
| Responsibilities: implement exactly the approved plan; follow existing codebase patterns (registration tables, handler conventions); platform-dependent code degrades to documented stubs off-platform; pure modules stay import-safe on any OS; unit-test everything testable without a live external session and report what needs live verification; confirm audit after each change; report blockers | **Merged** (generic wording) |
| Code rules: no new dependency without PM/design approval; idempotent config loaders; UTF-8 explicit for non-ASCII metadata; reuse existing exception classes, no parallel error conventions; no `--no-verify` | **Merged** (generic wording) |
| Constraints: additive by default; never remove shipped functionality unless the plan says so | **Merged** |
| Meeting stance: ground proposals in implementation reality, flag unimplementable items | **Merged** (generic, no COM/ZWCAD) |
| Output format (file-by-file ✅/⚠️ report) | **Merged** (both bodies share it) |
| ZWCAD COM, `src/cad_intelligence/...`, `TOOL_SCHEMAS`/`TOOL_HANDLER_MAP`, `ZWCADConnectionError` etc., `pyproject.toml` dep list, `memory/drawings/*.json`, zwcad-drafter sequencing, CAD Agent web UI | **Not merged** (variant-specific). Moves to `templates/co-architect/docs/co-architect.context.md`, new subsection "Agent bindings — automation-engineer" under "CAD Intelligence Platform Architecture" (O1) |
| `tier_ceiling_exempt` | **Dropped** (redundant once the L0 baseline is Medium) |
| `team: platform-engineering` | Stays in co-architect `variant.json` `teams` |

From the L0 body the common body keeps: cross-platform scripting rules, idempotency, error handling and exit codes, UTF-8, no external binaries, no scope creep. It drops: `:23` workspace-root identity, `:44-46` Auto-Dispatch To L0-only agents (becomes "returns to PM only"), `:60` ADR-0036 link (rule kept, link removed), `:70-72` root script examples, `:100` "Architect's domain" (becomes "the design specialist").

### 3.4 Frontmatter and body

Frontmatter (per `templates/common/docs/context.md:87-95` and CA §3): `name: automation-engineer`, `formal_name: Automation Engineer`, `role: specialist`, `status: active`, `tier: medium` (scalar, ADR-0102), `domain: _shared`, `description` with "Use when:", ≥ 1 `examples` pair, `version: "1.1.0"` (above co-architect's 1.0.1 and the L0 1.0.0, so upgrade never takes the equal-version restore path), `last_updated`, `lifecycle.{phase, created, last_updated, governance: docs/lifecycle/agents/automation-engineer.md}`, `required_skills: [sync, gateguard, ci-triage, script-lifecycle-manager]` (all exist in `templates/common/skills/`), `handoff_from: [pm]`, `handoff_to: [pm]`. No model literals.

Body sections: Role, PM-ONLY INVOCATION, Responsibilities, Sync Execution (S1, S2, S4), Scripting & Code Rules, Output Format, Constraints, Meeting Participation, Dispatch Protocol, Required Tools.

L0 `agents/automation-engineer.md`: `tier: low` → `medium`, version `1.0.0` → `1.1.0`, adds the Sync Execution section; root body otherwise keeps its L0 identity.

## 4. Blast radius

### 4.1 Tier change Low → Medium (D6), all in AE-1 unless noted

| File:line | Current | Change |
|---|---|---|
| `agents/automation-engineer.md:6,7,47` | `tier: low`, `version: 1.0.0`, `**Tier**: low` | `medium`, `1.1.0`, `medium`; Sync Execution section |
| `docs/lifecycle/agents/automation-engineer.md` | — | history row |
| `AGENTS.md:48` §1 roster | `\| Low \|` | `\| Medium \|` (hand-maintained; roster-tier-consistency checks it) |
| `AGENTS.md` §3.6 (`:118-125`) | tier→model lines, no agent names | no edit; Low still covers "fast, repetitive coding" for the remaining Low agents |
| `docs/governance/agents/pm-gateway-workflow.md:20` | `Script implementation ... \| automation-engineer \| Low` | `Medium` |
| `docs/governance/agents/pm-gateway-workflow.md:28` | "`automation-engineer` is always Low — assigning it High is a governance violation." | "`automation-engineer` is Medium — assigning it High is a governance violation." |
| `docs/governance/agents/workflows.md:65` | Subagent roster `Low` | `Medium` |
| `docs/constitution/05-multi-agent-architecture.md:60` | Execution `Low`: `automation-engineer.md`, `scaffolding-expert.md` | split: automation-engineer Medium; scaffolding-expert Low |
| `docs/governance/pm-orchestrator-parameters.md:128` | example `automation-engineer \| Low \| haiku` | `Medium \| sonnet` |
| `CLAUDE.md:276-278` (+ L1 copy via governance-l1) | `model = "haiku" // automation-engineer is Low-tier (registry: claude-haiku-5-5)` | `model = "sonnet" // automation-engineer is Medium-tier (registry: claude-sonnet-5-5)` |
| `CLAUDE.md:284` registry→alias note | generic High/Medium/Low mapping | no edit |
| `CLAUDE.md:286` | stale "8 workspace-root agents ... L0-only" | describe the live-roster gate and the L1 copy |
| `GEMINI.md`, `CODEX.md`, `HERMES.md` | no automation-engineer tier or `haiku` example (verified by grep) | no tier edit |
| `docs/VERSION_MANIFEST.md:24` | `low \| claude-haiku-5-5` | regenerated by `/sync` |
| `docs/workspace-schema.json` | no agent tier data (`agent_tiers` removed by ADR-0102) | no edit |
| `scripts/helpers/merge-frontmatter.ts:1203` (+ L1 copy by publish) | dormant string "is always Low" | "is Medium"; script patch bump, `SCRIPTS.md`, lifecycle row |
| `scripts/hooks/agent-model-gate.ts` | live roster | no code change; add a pure fixture unit test (tier `medium` → alias `sonnet`; missing model → ask) |
| `docs/governance/agents/execution-plan-templates.md:95` (Example 1 row 2) | `[implementation specialist] \| Low \| haiku` | no edit (generic illustration of a Low dispatch) |
| `skills/project-review/SKILL.md:119` | already `automation-engineer (else PM) \| Medium` | no edit (now consistent) |
| co-architect `tier_ceiling_exempt` | present | removed with the file (AE-2) |

**3-tier narrative after D6**: Low loses its main L0 implementer. Remaining Low agents: at L0 `scaffolding-expert` and `skill-graph-analyst`; at L1 none (pm, i18n-specialist, automation-engineer are Medium; CA agent tiers are pending CA Q3); variants keep their Low implementers (`code-writer` ×2, `game-developer`, `stack-setup` ×2, `test-runner`, and others). Cost effect: every `/sync` dispatch and every L0 script-implementation dispatch moves from `haiku` to `sonnet`.

### 4.2 `/sync` ownership, PM scope, and policy

| Group | Files | Boundary | PR |
|---|---|---|---|
| Execution-plan rule (L0) | `docs/governance/agents/execution-plan-templates.md:25,35,41,42,74,99,113` | root | AE-1 |
| Execution-plan rule (L1 fork) | `templates/common/docs/governance/agents/execution-plan-templates.md:30,40,46,47,79,104,118` | templates | AE-2 |
| PM agent | `agents/pm.md:86,90`; `templates/common/agents/pm.md:112`; `docs/lifecycle/agents/pm.md` | root / templates | AE-1 / AE-2 |
| PM read-only Bash (D4) | `AGENTS.md:83`; `agents/pm.md:115,289`; `templates/common/agents/pm.md:139,319`; `templates/common/AGENTS.md:67` (governance-l1 publish); `templates/co-architect/AGENTS.md:291`, `templates/co-architect/.claude/agents/pm.md:132,312` (regenerated/mirror); `templates/co-safety/docs/lifecycle/agents/pm.md:23` (record text) | root / templates | AE-1 / AE-2 |
| Policy (D2) | `CONSTITUTION.md:497-521` §7.5: amend CA-1's "the L0 specialist roster stays non-propagated" to "stays non-propagated, except `automation-engineer`, which is common (design 2026-11-12-sync-ownership-...)"; remove it from the `:499-501` list; ADR-0043 §6 (`:86-88`) same amendment; ADR-0096 Decision 2 amendment; `docs/constitution/05-multi-agent-architecture.md:113`; `docs/governance/agents/workflows.md:135` | root | AE-1 |
| `_COMMON.md` | `templates/common/agents/_COMMON.md:22-27` | templates | CA-2+AE-2 (single edit) |
| Instruction-file row | `GEMINI.md:109` (+ L1 copy by governance-l1) | root | AE-3 |
| L0-agent annotations | `CLAUDE.md:282,289` "workspace-root (L0) agent" (true until the L1 agent exists) | root | AE-3 |
| Common agent | `templates/common/agents/automation-engineer.md` (new) | templates | AE-2 |
| L1 lifecycle record | per CA Q6 (D11) | templates and/or root | AE-2 / AE-3 |
| Common contract | `docs/templates/common-contract.json` `common_agents.automation-engineer` (version `1.1.0`, C-CM-03a) | root | CA-3+AE-3 |
| `sync` skill owner (D9) | `skills/sync/SKILL.md:9` + patch bump; `skills/SKILLS.md`; `common_skills.sync` version; common copy by publish | root | CA-3+AE-3 (publish in CA-4) |
| Validators | VA-02 list (`validate-templates.ts:5732`): drop `automation-engineer` | root | AE-1 |
| Count pin | `tests/unit/apply-tier-normalization.test.ts:288-290` `l1Count` | root (sanctioned in templates PR) | CA-2+AE-2 |
| Scaffold parity | `scripts/helpers/scaffold-markers.ts:388`-style entry for `agents/automation-engineer.md` (and CA agents) | root (sanctioned in templates PR if parity fails there) | CA-2+AE-2, else CA-3+AE-3 |
| Transform review | `scripts/propagate-to-templates.ts:1496-1537` | root | CA-3+AE-3 |
| Variant docs | common `phase-definitions.md:76`, L1 `workflows.md:104`, 8 variant `phase-definitions.md`, 4 context files, 2 READMEs, 18 user-guide lines, co-architect first-time guide | templates | AE-2 |
| co-architect | delete `agents/automation-engineer.md` and `.claude/agents/automation-engineer.md`; keep `variant.json` `agents[]` entry and team membership; add CAD bindings to `docs/co-architect.context.md` (O1); regenerate co-architect `AGENTS.md` | templates | AE-2 |
| Platform mirrors | generated per project by `sync-agent-mirrors.ts` (5 platforms) at scaffold/upgrade | — | fleet wave |
| Release | `CHANGELOG.md`, `templates/CHANGELOG.md`, `templates/VERSION`, `docs/VERSION_MANIFEST.md` | both | per PR |

## 5. Delivery to the 16 fleet projects (defined here, not applied)

- **New scaffolds**: `new-project` copies the common file; no variant ships a same-named file after AE-2.
- **Existing projects**: `upgrade-project` delivers `NEW agents/automation-engineer.md` (add-if-missing), version-gated; mirrors and roster rows regenerate.
- **Gate-active projects (D10)**: co-deck, co-newbiz, co-price, co-safety, co-security. Each upgrade PR first adds `{ "name": "automation-engineer", "file": "agents/automation-engineer.md" }` to the project `variant.json` `agents[]`, then runs the apply. A dry run must show `NEW`.
- **co-architect project**: its `agents/automation-engineer.md` (1.0.1) is variant-delivered. After AE-2 the template side is the common file (1.1.0 > 1.0.1), so upgrade takes the version-gated guard: ADOPT if the project copy equals its delivered baseline, CONFLICT if project-evolved (then `--disposition adopt-template` after review). The same upgrade must deliver the CAD bindings in `docs/co-architect.context.md`; the dry run must show both.
- **Projects with another implementer**: co-abap, co-develop, co-learning keep `code-writer`; co-newbiz keeps `infra-automation-engineer` and `release-engineer`. Distinct names, no collision; routing per §3.2.
- **Any later project-local `automation-engineer.md`**: lower version → CONFLICT (preserved); higher → PROJECT_AHEAD; equal 1.1.0 is the only overwrite case and is unlikely.
- **Frozen projects**: co-deck, co-abap, co-hr, co-safety, co-newbiz take it in the freeze-lift batch with the CA agents and U-005 records. co-newbiz has no template; delivery is a project-side PR.

## 6. PR sequence (D1; one open PR at a time)

Sizes: S = 1-3 h, M = 3-6 h, L = 6-12 h (implementation and verification, excluding review wait).

| PR | Boundary | Content | Size | CI evidence |
|---|---|---|---|---|
| AE-0 | root (docs) | This design doc + registry entry. | S | `validate-docs-links --all`, `audit.ts`, `validate-templates.ts` green |
| CA-1 | root | **Merged** (#1978). | — | — |
| AE-1 | root | §4.1 tier change (L0 agent, `AGENTS.md:48`, pm-gateway-workflow `:20,:28`, workflows `:65`, constitution 05 `:60,:113`, orchestrator-parameters `:128`, `CLAUDE.md:276-278,286`, merge-frontmatter string); L0 execution-plan rule (D3); PM docs and read-only Bash (D4); CA-1 text amendment in CONSTITUTION §7.5 and ADR-0043 §6 (D2); ADR-0096 amendment; L0 Sync Execution section; lifecycle records; VA-02; agent-model-gate fixture test. | M-L (6-8 h) | `bun run test:unit` green on Windows within `scripts/test-runner.ts` budgets; `audit.ts`, `validate-templates.ts` 0 errors (roster-tier-consistency passes with `AGENTS.md:48` = Medium) |
| CA-2+AE-2 | templates (+ sanctioned root test/helper) | CA-2 content plus: common `automation-engineer.md`; single `_COMMON.md` edit; common `pm.md:112,139,319`; L1 execution-plan fork; L1 workflows; phase-definitions (common + 8 variants); variant context/README/user guides; co-architect fold (§3.3, §4.2); **`apply-tier-normalization` `l1Count` update (2 → 2 + new common agents)**; scaffold-markers exclusion if parity fails here. | L (+5-7 h over CA-2) | `validate-templates.ts` 0 errors (WS-02 may WARN until CA-3); `template-extends-no-l0-leak`, `agent-body-completeness`, `validate-agents` green; scaffold parity green; `sync-agent-mirrors --check` on a scaffold |
| CA-3+AE-3 | root | One `common_agents` edit for all common agents; `GEMINI.md:109` row; `CLAUDE.md:282,289` annotations; `sync` owner retarget (D9); remaining scaffold-markers entry; transform review. | M (+2-3 h over CA-3) | `audit.ts`; `validate-templates.ts` WS-02 C-CM-02/03a green; `propagate-to-templates.ts --governance-l1 --docs` clean |
| CA-4 | templates (publish) | Unchanged, plus the published `sync` skill. | S-M | as in CA design |
| Fleet wave | operational | CA agents + automation-engineer; D10 registration in gate-active projects; co-architect bindings; frozen projects at freeze-lift. | M (5-9 h, shared) | per-project dry-run diff (§5) |
| U-005 PR-2 / PR-3 | templates / root | Unchanged; records carry final owners (`sync` → automation-engineer). | unchanged | unchanged |

Added effort: about 13-18 h over the CA series.

**Window between AE-1 and CA-3+AE-3**: L0 plans use `automation-engineer | Medium | sonnet`; L1 and projects still show `pm`. Safe: L0 has the agent, projects do not yet. The L1 rule flips in CA-2+AE-2, together with the L1 agent; `GEMINI.md:109` flips in CA-3+AE-3 because governance-l1 publishes it to L1 immediately.

### Windows CI budget notes

- New tests are pure and in-process: frontmatter parsing, VA-02 list behaviour on fixture strings, the agent-model-gate tier→alias fixture (call the exported helpers; do not spawn the hook), contract version equality. Do not spawn `validate-templates.ts`, `new-project.ts`, or `upgrade-project.ts`; do not walk `templates/*/skills`.
- The win32 per-test default ceiling is 15 s (`scripts/test-runner.ts` `FILE_TIME_BUDGETS`; PR #1957 raised budgets for co-workspace suites). Re-measure `regenerate-agents-md`, `sync-agent-mirrors`, `platform-mirror-freshness`, `agent-body-completeness` after CA-2+AE-2.
- Run `bun run test:unit` before every `/sync` that bumps an agent, skill, or script version.

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | A dispatched agent mishandles a FATAL dev-sync gate | S1-S5; escalate only (D7) |
| R2 | Policy text drift: §7.5, ADR-0043 §6, `_COMMON.md`, CA design non-goal | D2 amendment in AE-1; `_COMMON.md` in CA-2+AE-2 |
| R3 | Cost: `haiku` → `sonnet` for every `/sync` and L0 script dispatch | Accepted by D6 |
| R4 | Gate-active projects skip the new agent | D10; dry run must show `NEW` |
| R5 | co-architect loses CAD bindings on upgrade | Bindings ship in the context doc in the same upgrade (O1); dry run |
| R6 | Mixed-state window | L1 rule flips with the L1 agent (§6) |
| R7 | Role overlap with domain implementers | Routing rule (§3.2) |
| R8 | Root test/helper edits (`apply-tier-normalization`, `scaffold-markers`) inside a templates PR | Explicit sanction in the CA-2+AE-2 plan, or make the test derive its count |
| R9 | `fleet-list.ts` lists `-worktrees` directories | Out of scope; verify the fleet set before the wave |

## 8. Open questions (resolved)

| # | Question | Options | Resolution |
|---|---|---|---|
| O1 | Where co-architect's CAD-specific bindings live after the fold | (a) new subsection in `templates/co-architect/docs/co-architect.context.md`; (b) a single co-architect `extends:` stub carrying an additive override (ADR-0043 hybrid), the only stub in the fleet | **Accepted default (a), D13, 2026-11-12** - keeps D8 (no stubs) without exception |
| O2 | The designated merge path | (a) the user merges on GitHub only; (b) on the user's explicit chat request, PM dispatches an `automation-engineer` row "merge PR #N" (`gh pr merge`, no `--admin`, no bypass) | **Accepted default (a), D14, 2026-11-12** - (b) allowed only on explicit user request |

Questions closed by the Decisions table: Q1-Q11 and the single-rule-vs-split-tier question (D6).

## Platform Impact

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code (CLI + Desktop) | `/sync` row dispatched as a `sonnet` subagent; gate requires `sonnet` with no code change; dispatch example changes | `CLAUDE.md:276-278,282,286,289`; execution-plan-templates (L0 + L1) |
| Antigravity / Gemini (GEMINI.md) | Artifact plan row owner changes; Medium literal model | `GEMINI.md:109` + L1 copy |
| Codex | Row runs in-session under the role; no row or tier text in CODEX.md | none beyond the SSOT docs |
| Hermes | Same in-session pattern; no row or tier text | none beyond the SSOT docs |
| templates/common | New agent, L1 rule fork, PM finalization and Bash list, phase docs, `_COMMON.md` | §4.2 rows marked templates |

## Accessibility

Not applicable. This change is governance text, agent definitions, and pipeline ownership. It has no user interface, so ADR-0065 requires no accessibility section beyond this statement.

## Preview Verification

Not applicable. No web or app UI is rendered or changed, so ADR-0070 requires no rendered check beyond this statement.

## Acceptance criteria

- [ ] No execution-plan template, example, or instruction-file row assigns `/sync` to `pm`.
- [ ] Every `/sync` row reads `automation-engineer | Medium | sonnet` (or the literal Medium model ID).
- [ ] A PM landing-verification row follows `/sync` in every template and example.
- [ ] L0 and L1 say "`/sync` is the last implementation row".
- [ ] Every PM read-only Bash list includes `git show`, `gh pr view`, `gh pr checks`, and excludes `gh pr merge`.
- [ ] `agents/automation-engineer.md` and the common file both declare `tier: medium`.
- [ ] No document states that `automation-engineer` is Low or uses `haiku`, except historical records.
- [ ] The common file has no L0-only or CAD-specific text from §1.5.
- [ ] `common-contract.json` lists the agent at version `1.1.0`.
- [ ] CONSTITUTION §7.5, ADR-0043 §6, ADR-0096, and `_COMMON.md` agree with the roster.
- [ ] `bun run test:unit`, `audit.ts`, and `validate-templates.ts` pass on Linux and Windows CI.
- [ ] Every non-frozen project's dry run shows `NEW agents/automation-engineer.md`. Gate-active projects show it after D10. co-architect shows ADOPT or CONFLICT plus the context-doc bindings.
