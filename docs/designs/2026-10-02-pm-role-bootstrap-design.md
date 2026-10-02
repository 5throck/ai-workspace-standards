# PM Role Bootstrap — Force the First-Turn Governance Read — Design

- **Date**: 2026-10-02
- **Status**: implemented
- **Spec id**: `2026-10-02-pm-role-bootstrap-design`
- **Owner**: architect (dispatched by PM)
- **Related**: ADR-0074 (Universal Design Gate), ADR-0090 (governance pointer table), ADR-0093 (HERMES.md), `AGENTS.md` §3, `agents/pm.md`, `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, `HERMES.md`, `.claude/settings.json`, `scripts/hooks/agent-model-gate.ts`, `scripts/propagate-to-templates.ts`, `scripts/lib/upgrade-policy.ts`, `scripts/lib/managed-block-merge.ts`, `tests/unit/governance-boundary-l1.test.ts`

## Amendment 2026-10-02

The user made two decisions after the L0 work was done:

1. **Scope**: the PM bootstrap must also reach newly created projects. It must reach existing projects through `upgrade-project` where the delivery machinery permits. The former follow-up F1 (`templates/common` and variants) is now in the committed scope of this spec. See R3.7.
2. **One combined PR**: the L0 change and the template change go in one PR, not in two sequential PRs.
   The reason is CI coupling. `tests/unit/governance-boundary-l1.test.ts` (test "CLAUDE.md transform output stays identical to the shipped L1 copy", line 72) asserts that `applyGovernanceTransforms(root CLAUDE.md)` is equal (date-normalized) to `templates/common/CLAUDE.md`.
   CI runs `bun run test:unit` (`.github/workflows/test.yml`). A root-only PR fails this test. A templates-only PR fails it in the other direction.
   This is a justified exception to `CLAUDE.md` §9. See R3.8.

The L0 work (R3.1–R3.4) is implemented and verified. Do not redesign it. The text below keeps the L0 sections unchanged and adds R3.7, R3.8, an implementation plan, and new acceptance criteria.

## R1 — Problem

Each platform instruction file has a Role Declaration with this text:
"You ARE the PM agent for this session. Load and follow `agents/pm.md` at all times."

| File | Location of the Role Declaration (verified) |
|------|---------------------------------------------|
| `CLAUDE.md` | line 19, after the GOVERNANCE-POINTER-TABLE blockquote |
| `GEMINI.md` | line 19, after the GOVERNANCE-POINTER-TABLE blockquote |
| `CODEX.md` | line 12 |
| `HERMES.md` | line 27, section "1. Role Declaration" in the `COMMON-HERMES` managed block |

Each file also says that `AGENTS.md` is the SSOT registry and that the agent must read it first.

On 2026-10-02, a Claude Code session in this workspace did not read `AGENTS.md` or `agents/pm.md`.
The agent gave this account:

- It decided that the first question (a code search for the `temperature` option) did not need governance documents.
- It decided that the later Q&A turns were not related to the repository.
- It did not examine that decision again.

Root causes:

1. The Role Declaration is a state declaration ("You ARE"). It does not tell the agent to do an action.
2. The verb "Load" has no trigger and no time.
3. The line is after a long blockquote, in a file of hundreds of lines (`CLAUDE.md` is 27,983 bytes).
4. No mechanism makes the agent call a file-read tool.

The graft `SessionStart` and `UserPromptSubmit` hooks injected context in that session, and the agent used that context.
Thus, hook-injected context reaches the agent. Prose deep in the instruction file did not.

## R2 — Decision

Use two layers. Do not remove or weaken any existing rule.

1. **Claude Code hook (strongest layer).** Add a new `SessionStart` hook script.
   It injects a short imperative bootstrap reminder as `additionalContext`.
2. **Top-of-file bootstrap block (all four platforms).** Add a short imperative block at the top of `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, and `HERMES.md`.
   The block names the action: read `AGENTS.md` and `agents/pm.md` before the first response of every session.

The existing Role Declaration stays. The new block adds the trigger and the timing that the Role Declaration does not have.

## R3 — Design Points

### 1. Claude Code hook

- **Script**: `scripts/hooks/pm-role-bootstrap.ts` (bun, TypeScript).
  Follow the style of `agent-model-gate.ts`: `@version` line, header comment, fail-open policy.
  - Rationale: keeps all workspace hooks in one place and in one style.
- **Event**: `SessionStart` only. Do not add it to `UserPromptSubmit`.
  - Rationale: the failure is a missed first-turn read. One injection per session fixes it.
    An injection on every prompt adds context cost to every turn and repeats text that is already in context.
- **SessionStart sources**: inject for all sources (`startup`, `resume`, `clear`, `compact`).
  - Rationale: after `clear` or `compact`, the earlier Read results are no longer in context. The read must happen again.
- **Payload**: a fixed text of 5 lines or fewer. Token budget: 150 tokens or fewer. Draft text:

  ```text
  PM bootstrap (workspace rule): You are the PM agent for this session.
  Before your first response, Read AGENTS.md and agents/pm.md with the Read tool.
  This applies to every request, including short questions and non-code questions.
  Read them once per session. Read them again after /clear or context compaction.
  Q&A-only answers need no execution plan table. Multi-step work still needs one.
  ```

  - Rationale: the observed failure is a missing tool call, not missing knowledge. A pointer plus an imperative is sufficient.
    A digest of `AGENTS.md` would duplicate the SSOT and drift from it.
- **Output shape**: one JSON object on stdout, exit code 0:

  ```json
  { "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "<text>" } }
  ```

  - Rationale: this is the shape that graft uses (verified in the installed `@nanonets/graft/dist/claude/hooks.js`, which `.claude/helpers/graft-hooks.cjs` loads). That shape is known to reach the agent in this workspace.
- **Fail-open**: on any error (bad stdin, missing files, exception), write a warning to stderr and exit 0 with no stdout.
  - Rationale: a bootstrap reminder must never block a session start.
- **File check**: the script checks that `AGENTS.md` and `agents/pm.md` exist under `CLAUDE_PROJECT_DIR`. If one is missing, it skips the injection.
  - Rationale: the reminder must not point to a file that does not exist.
- **Wiring**: add a third entry to the `SessionStart` array in `.claude/settings.json`.
  Command: `bun scripts/hooks/pm-role-bootstrap.ts`. Timeout: 10. Not `async`.
  - Rationale: an async hook cannot return `additionalContext` for the session start. The graft entry is also sync.
- **No conflict with graft**: the graft hook injects repository-graph context. The new hook injects governance text only. The two texts do not overlap.
  Claude Code runs both hooks and concatenates their `additionalContext`.

### 2. Top-of-file bootstrap block

- **Wording (Claude Code, 4 lines)**:

  ```markdown
  > **Session bootstrap (mandatory)**: Before your first response in every session, use the Read tool on [`AGENTS.md`](AGENTS.md) and [`agents/pm.md`](agents/pm.md).
  > This applies to every request. Short questions, Q&A, and non-code questions are not exempt.
  > Read them once per session, and again after the context is cleared or compacted.
  > Q&A-only turns need no execution plan table. Multi-step work still follows the PM Gateway.
  ```

- **Per-platform tool wording** (only line 1 changes):

  | File | Line 1 tool phrase |
  |------|--------------------|
  | `CLAUDE.md` | "use the Read tool on" |
  | `GEMINI.md` | "use your file-read tool on" (Gemini CLI and Antigravity tool names differ) |
  | `CODEX.md` | "read the full contents of" (Codex reads files through its shell or read tools) |
  | `HERMES.md` | "read the full contents of" |

  - Rationale: the action must map to a tool that exists on that platform. A generic phrase is safe for platforms with more than one tool name.
- **Placement**: directly after the `# <FILE>.md` H1, before the GOVERNANCE-POINTER-TABLE blockquote (Claude, Gemini) and before the CONSTITUTION blockquote (Codex, Hermes).
  - Rationale: the observed failure put the Role Declaration after a long blockquote. The first lines of the file get the most attention.
- **Not in a managed block** (CLAUDE.md, GEMINI.md, CODEX.md).
  - Rationale: verified that no script parses the GOVERNANCE-POINTER-TABLE marker. `scripts/test-platform-parity.ts` (lines 643–650) only checks that the L1 file exists for these four files. It does not compare content. A new unwrapped block therefore passes the parity audits.
- **HERMES.md placement**: put the block after the H1, outside the `COMMON-HERMES` block.
  - Rationale: the `COMMON-HERMES` zone is propagated byte-identical (`scripts/lib/managed-block-merge.ts`). An L0-only edit inside it must stay out of scope (see R5).
- **HERMES.md size budget**: current size is 10,451 bytes (`wc -c HERMES.md`, 2026-10-02). The budget is 19,000. Headroom is 8,549 bytes. The block adds about 450 bytes.
- **Coexistence with the Role Declaration**: add, do not replace.
  - Rationale: the Role Declaration sets the identity. The new block sets the action and the time. Both are necessary. The Role Declaration also lives in the `COMMON-HERMES` block and in templates, and a removal there is out of scope.

### 3. Scope guard against over-reading

- The bootstrap read happens once per session. It happens again only after `clear` or compaction.
- Q&A-only sessions still do the read. They do not need an execution plan table.
- The rule "the execution plan applies to multi-step work (2+ files or 2+ sequential steps)" does not change.
- The bootstrap does not require reads of the other governance documents. Those reads stay "when needed", as `AGENTS.md` already says.
- Rationale: two files are about 44.6 KB together (`AGENTS.md` 28,597 bytes, `agents/pm.md` 16,049 bytes). That cost occurs once per session. It does not occur on each turn.

### 4. Verification

- **Unit test**: `tests/unit/hook-pm-role-bootstrap.test.ts`. Follow the style of `tests/unit/hook-gateguard.test.ts` (`spawnSync('bun', [HOOK_PATH])` with stdin JSON). Test cases:
  1. Valid `SessionStart` stdin: exit 0, stdout is valid JSON, `hookEventName` is `SessionStart`, `additionalContext` contains `AGENTS.md` and `agents/pm.md`.
  2. Malformed stdin: exit 0 (fail-open).
  3. Missing `agents/pm.md` (temporary project dir): exit 0, no stdout.
  4. Payload length: 1,000 characters or fewer (proxy for the 150-token budget).
- **Live check (Claude Code)**: start a new session. Ask a short non-code question. The first response must contain Read calls for `AGENTS.md` and `agents/pm.md`. Repeat after `/clear`.
- **Live check (other platforms)**: start a new session on Gemini CLI, Codex, and Hermes. Ask a short question. Record whether the agent reads both files. Do not run the hermes CLI from scripts; the user runs the Hermes check manually.
- **Audits**: `bun scripts/test-platform-parity.ts`, `bun scripts/validate-templates.ts`, `bun scripts/audit.ts`. Also run `wc -c HERMES.md` and confirm a value below 19,000.
- **Hook registration**: if a script registry exists for `scripts/hooks/` (for example `SCRIPTS.md`), register the new script through the script-lifecycle workflow.

### 5. Accessibility

N/A. The change adds instruction text and a CLI hook. There is no user-facing UI.

### 6. Preview Verification

N/A. There is no web or app UI.

### 7. Delivery to `templates/common`, variants, and projects (amendment; was F1)

All facts in this section were verified by reading the named files on 2026-10-02, unless a line says "not verified".

#### 7.1 L1 platform instruction files (generated, not hand-edited)

- `scripts/propagate-to-templates.ts --governance-l1` generates all four L1 platform files. `GOVERNANCE_L1_FILES` (line 1139) maps `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `CODEX.md`, and `HERMES.md` to `templates/common/<same name>`. `publishGovernanceL1()` (line 1520) writes the output of `applyGovernanceTransforms()` (line 1151). It skips a file when the output is equal to the existing copy.
- The transforms do not touch a block placed directly after the H1:
  - Phase A (`scrubConstitutionRefs`) changes only `CONSTITUTION.md` references. The block has no `CONSTITUTION.md` reference.
  - Phase B-1..B-6 (CLAUDE, GEMINI) match only specific table and rule lines that are not in the block.
  - Phase B-7 matches only the "Workspace & Template Boundary Policy" section.
- **Proof by dry computation** (read-only, output written to `/tmp`): the output of `applyGovernanceTransforms()` for the current root files differs from the shipped L1 files **only** by the 5 added lines (the 4-line block plus one blank line), for all of `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, and `HERMES.md`. `AGENTS.md` has no difference.
- **Decision**: do not hand-edit the four L1 files. Run `bun scripts/propagate-to-templates.ts --governance-l1 --apply`. The root block text is then reused byte-for-byte at L1, with the per-platform tool phrase of each file.
- **Pointer targets exist at L1**: `templates/common/AGENTS.md` and `templates/common/agents/pm.md` exist. L1 `pm.md` is an `extends:` stub. `new-project.ts` §2.3b resolves `extends:` stubs against the L1 bodies at scaffold time, so a scaffolded project has a full `agents/pm.md`. `publishGovernanceL1()` never overwrites L1 `pm.md` (it prints a note to this effect).

#### 7.2 Variant instruction files (manual edit, `HERMES.md` only)

- No variant (`templates/co-*`, 13 directories) has `CLAUDE.md`, `GEMINI.md`, or `CODEX.md`. A new project gets these three files from `templates/common` only. The `--governance-l1` run is sufficient for them.
- All 13 variants have their own `HERMES.md`. `new-project.ts` (lines 842–863) copies variant files over the L1 copy, except `SCAFFOLD_COMMON_OWNED_FILES` (only `docs/context.md`). Thus, for a `hermes` or `all` profile project, the variant `HERMES.md` wins over L1.
- Lines 1–23 of every variant `HERMES.md` (the part before `<!-- COMMON-HERMES:START -->`) are equal to lines 1–23 of `templates/common/HERMES.md` today (verified by diff for all 13).
- No propagation domain writes variant `HERMES.md`. The `marker-inject` domains in `scripts/propagation-map.json` are `governance-agents`, `constitution-context`, `constitution-context-pr`, and `variant-context`. None targets `HERMES.md`. `--docs` injects only these markers.
- **Decision**: insert the same 5 lines (block plus one blank line) directly after the H1 in all 13 `templates/co-*/HERMES.md`, by a manual (scripted, one-time) edit. The result must make lines 1–28 of each variant file equal to lines 1–28 of the new `templates/common/HERMES.md`.
- The block stays outside `COMMON-HERMES`. `validate-templates.ts` PM-04 (managed-block parity) compares only managed zones, so it does not check this head. Not verified: whether any other validator compares variant `HERMES.md` heads. The implementer must confirm this with a full `validate-templates.ts` run.

#### 7.3 Hook script at L1

- `scripts/propagation-map.json` domain `scripts-hooks` copies `scripts/hooks/*.ts` to `templates/common/scripts/hooks/`. The copy filter is `includeScriptInL1()`, which reads the layer column of `scripts/SCRIPTS.md`.
- The `pm-role-bootstrap.ts` row has the value `L0` today. `agent-model-gate.ts` is `L0`. `gateguard-fact-force.ts` and `post-write-lifecycle-check.ts` are `L0+L1` (the legend at `scripts/SCRIPTS.md` line 61: "exists in scripts/ AND templates/common/scripts/; scaffold-copies to L3 at new-project time").
- **Decision**: change the `pm-role-bootstrap.ts` row layer from `L0` to `L0+L1`. Then run `bun scripts/propagate-to-templates.ts --apply`. This copies the script to `templates/common/scripts/hooks/pm-role-bootstrap.ts`.
- **L1 registry**: `templates/common/scripts/SCRIPTS.md` is a derived projection. `scripts/generate-scripts-mirror.ts` writes it (R1-rule: rows with a non-L0 layer are mirrored byte-for-byte). `/sync` runs it at dev-sync Step 2.6. Do not hand-edit the L1 registry. Run `bun scripts/generate-scripts-mirror.ts` (write mode) or let `/sync` run it.
- **Dependencies at L1**: the script imports only `node:fs` and `node:path`. It resolves the project root from `CLAUDE_PROJECT_DIR`, or from its own location (`../..`). It reads `AGENTS.md` and `agents/pm.md`. Both exist in a scaffolded project (R3.7.1). If one is missing, the script exits 0 with no output (fail-open). No change to the script is necessary.
- **Variants**: `scripts-hooks` has the note "No L2 variant has scripts/hooks/". Variants get the hook from L1 at scaffold time.

#### 7.4 `settings.json` wiring (manual edit, 14 files)

- `templates/common/.claude/settings.json` is hand-maintained. No propagation domain copies root `.claude/settings.json` to L1 (only `gemini-settings` exists). Evidence: root has `agent-model-gate.ts` and L1 does not.
- L1 `SessionStart` today has two entries: `git config core.hooksPath .githooks` (async) and the graft helper (`timeout: 8000`). L1 hooks use the same command convention as root: `bun scripts/hooks/<name>.ts` (gateguard, post-write lifecycle).
- All 13 variant `.claude/settings.json` files differ from L1 (for example, co-abap adds `mcpServers` and a `sync-md.ts` PostToolUse entry). `iterEffectiveTemplateFiles()` (`scripts/lib/upgrade-policy.ts` line 447) yields the variant file first, and `new-project.ts` copies the variant file over L1. Thus the variant copy is the effective template for both scaffold and upgrade.
- **Decision**: add the same `SessionStart` entry to `templates/common/.claude/settings.json` and to all 13 `templates/co-*/.claude/settings.json`. Use the root entry shape: command `bun scripts/hooks/pm-role-bootstrap.ts`, timeout as at root, not `async`. Put it after the existing entries. Do not change other entries.
- `docs/templates/common-contract.json` lists `hooks.SessionStart` as a `shared` key with `"validation": "array"`. `validate-templates.ts` VA-04 (lines 4034–4081) checks only that the key exists in `.claude` and `.gemini`. A new array entry does not change this result.

#### 7.5 Existing projects (`upgrade-project`)

| Artifact | Upgrade claim (verified) | Reaches existing projects? |
|----------|-------------------------|----------------------------|
| `scripts/hooks/pm-role-bootstrap.ts` | `resolveClaim`: `scripts/` → `SYNC` / `SYNC_IF_NEWER: scripts/` (`upgrade-policy.ts` line 394) | Yes, expected. Not verified: the branch that copies a file that is absent in the project. Confirm with a dry-run upgrade. |
| `.claude/settings.json` | `JSON_MERGE_FILES` → `mergeSettingsJson()`; arrays are unioned, template entries first, project-only entries kept | Yes. The new `SessionStart` entry is added; project entries stay. |
| `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, `HERMES.md` | `MERGE_MANAGED_FILES` → MERGE pass (`mergeWorkspaceManaged`, `upgrade-project.ts` line 1144) | **No** for the top block. The MERGE pass writes only managed-block content (`MANAGED_PATTERNS`). Text outside a marker pair is never delivered. A project file is created from the template only if it does not exist. |

- Result: an existing project gets the strong layer (hook plus settings entry) on its next upgrade. It does not get the top block text. This is acceptable for Claude Code projects. Codex, Hermes, and Gemini projects in the existing fleet get no change. See open question 6.
- An alternative is to wrap the block in a keyed `<!-- WORKSPACE-MANAGED: session-bootstrap -->` pair. `findInsertionPosition()` (`managed-block-merge.ts` line 213) inserts a new keyed block after a heading that contains the key, else after the last block of the same label, else at end of file. No heading contains the key, so in existing projects the block lands far from the top. This removes the main benefit (top-of-file position). This design does not choose it. See R4 (k).

#### 7.6 Gemini, Codex, Hermes at L1

- Same decisions as L0: block only. The Gemini hook stays deferred (F2). Do not change `templates/common/.gemini/settings.json` or the `gemini-settings` domain.
- Codex and Hermes have no hook surface at L1. `new-project.ts` §2.7 removes `CODEX.md` unless the profile is `codex` or `all`, and removes `HERMES.md` unless the profile is `hermes` or `all`. The block reaches those profiles through the generated L1 files and the edited variant `HERMES.md`.

#### 7.7 Projects without bun

- Every scaffolded project already runs `bun scripts/hooks/...` for gateguard and the post-write lifecycle check. The new entry adds no new runtime dependency.
- Not verified from the repository: the exact Claude Code behavior when a `SessionStart` command cannot start (for example, bun missing). The script itself is fail-open. The command-not-found case is outside the script. The live check in a scaffolded project (verification item 9) covers the normal case only.

### 8. `CLAUDE.md` §9 exception (one combined PR)

- **Rule**: `CLAUDE.md` §9 forbids a mix of workspace-root changes and template changes in one task or session.
- **Exception (user-approved, 2026-10-02)**: this spec's single PR changes root files and template files together.
- **Justification**: `tests/unit/governance-boundary-l1.test.ts` line 72 couples root `CLAUDE.md` and `templates/common/CLAUDE.md` through `applyGovernanceTransforms()`. CI runs `bun run test:unit` (`.github/workflows/test.yml`). A root-only PR fails CI. A templates-only PR fails CI in the other direction. Two sequential PRs therefore cannot both be green.
- **Scope limit**: the exception applies only to the files in the implementation plan below. Any other template change needs its own task and PR.
- **Order inside the PR**: do the L0 changes first (done). Then do the template changes through the scripts named in the plan. Use hand edits only where no script exists (R3.7.2, R3.7.4).

## Implementation plan (single PR)

L0 work, status **done** (do not redo):

| # | File | Status |
|---|------|--------|
| D1 | `scripts/hooks/pm-role-bootstrap.ts` | done |
| D2 | `tests/unit/hook-pm-role-bootstrap.test.ts` | done |
| D3 | `.claude/settings.json` (third `SessionStart` entry) | done |
| D4 | `scripts/SCRIPTS.md` row | done (layer `L0`; step 1 changes it) |
| D5 | Top block in `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, `HERMES.md` (lines 3–6) | done |

Template work, in order (owner: automation-engineer unless stated):

| Step | Action | Files | Mechanism |
|------|--------|-------|-----------|
| 1 | Change layer column `L0` → `L0+L1` for `hooks/pm-role-bootstrap.ts` | `scripts/SCRIPTS.md` | manual edit (one cell) |
| 2 | Generate the L1 platform files | `templates/common/CLAUDE.md`, `GEMINI.md`, `CODEX.md`, `HERMES.md` | `bun scripts/propagate-to-templates.ts --governance-l1` (dry run), then `--governance-l1 --apply`. Expect "already in sync" for `AGENTS.md` |
| 3 | Copy the hook to L1 | `templates/common/scripts/hooks/pm-role-bootstrap.ts` | `bun scripts/propagate-to-templates.ts` (dry run), then `--apply`. Review the dry-run list: only this file may be new or changed. Stop if other files appear |
| 4 | Regenerate the L1 scripts registry | `templates/common/scripts/SCRIPTS.md` | `bun scripts/generate-scripts-mirror.ts` (write mode; or dev-sync Step 2.6) |
| 5 | Add the `SessionStart` entry | `templates/common/.claude/settings.json` | manual edit |
| 6 | Add the same entry | `templates/co-{abap,consult,deck,design,develop,export,game,hr,news,price,safety,security,work}/.claude/settings.json` (13) | manual edit; a one-time script is allowed, but do not commit it |
| 7 | Insert the 5 head lines after the H1 | `templates/co-*/HERMES.md` (13) | manual edit; the result must make lines 1–28 equal to `templates/common/HERMES.md` |
| 8 | Add an `[Unreleased]` entry | `templates/CHANGELOG.md` | docs-writer; manual edit. Do **not** bump `templates/VERSION` (see note) |
| 9 | Update this spec status to `implemented` and update `docs/specs/registry.json` if its status field tracks it | this file, `docs/specs/registry.json` | docs-writer |
| 10 | Commit through `/sync` only | — | PM |

Note on template versioning: `scripts/auto-release-template.ts` (nightly) bumps `templates/VERSION` and cuts the changelog through `release-template.ts`. This design found no rule that requires a manual bump in a feature PR. Precedent `[Unreleased]` entries exist in `templates/CHANGELOG.md` (for example the 2026-10-01 `ci.yml` entry). Step 8 follows that precedent.

Registries and contracts that change: `scripts/SCRIPTS.md` (step 1), `templates/common/scripts/SCRIPTS.md` (step 4, generated), `templates/CHANGELOG.md` (step 8), `docs/specs/registry.json` (step 9, if applicable).
Registries and contracts that do **not** change (verified): `scripts/propagation-map.json` (the `scripts-hooks` domain already exists), `docs/templates/common-contract.json` (`hooks.SessionStart` is already `shared`/array), `scripts/lib/upgrade-policy.ts` (the `scripts/` and `JSON_MERGE_FILES` claims already cover the new files, so `check-upgrade-coverage.ts` needs no new claim; ADR-0073).

## R4 — Rejected Alternatives

| Alternative | Reason for rejection |
|-------------|----------------------|
| (a) Add only more prose to the four files | Prose alone already failed in the observed session. The block is kept as the cross-platform baseline, but the Claude hook is necessary as the strong layer. |
| (b) Inject the full `AGENTS.md` and `agents/pm.md` on every prompt | About 44.6 KB on every turn. Very high token cost. It also duplicates the SSOT in context on each turn. |
| (c) Inject a digest of `AGENTS.md` §3.1/§3.6 | The digest drifts from the SSOT. The failure is a missing read, not missing content. |
| (d) Remove the Role Declaration | It removes the cross-platform identity baseline. Codex and Hermes have no hook, so the declaration is one of their only enforcement mechanisms. |
| (e) Block the first tool call with `PreToolUse` until the bootstrap read is done | Too intrusive. Q&A turns with no tool call are not caught at all, and those are the observed failure. It also needs per-session state and can block legitimate work. Keep it as a possible follow-up if the hook plus block fails. |
| (f) Add the hook to `UserPromptSubmit` | Repeats the same text on every turn. The `SessionStart` sources `clear` and `compact` already cover context loss. |
| (g) Two sequential PRs (root first, then templates) — the original F1 plan | `tests/unit/governance-boundary-l1.test.ts` line 72 couples root `CLAUDE.md` to `templates/common/CLAUDE.md`, and CI runs `bun run test:unit`. The first PR fails CI whichever side goes first. |
| (h) Relax `governance-boundary-l1.test.ts` (for example, ignore the top block in the compare) | The test guards the AC5 byte-preservation guarantee of `--governance-l1`. A carve-out weakens a regression test to fit one change, and it hides real L0/L1 drift in the carved region later. |
| (i) Hand-edit the four L1 platform files | `--governance-l1 --apply` produces exactly the needed diff (R3.7.1). A hand edit can drift from the generator and fail the line-72 test. |
| (j) Put the `HERMES.md` block inside `COMMON-HERMES` so that `--docs`/upgrade MERGE delivers it | The block would not be at the top of the file. It also changes a byte-identical managed zone in L0, L1, and 13 variants, and PM-04 would require the same change in each. |
| (k) Wrap the top block in a keyed `WORKSPACE-MANAGED` marker so that upgrade delivers it to existing projects | `findInsertionPosition()` puts a new keyed block after a matching heading, else after the last same-label block, else at end of file. In existing projects the block would not be at the top. Kept as open question 6. |

## Platform Impact

| Platform | Change | Justification |
|----------|--------|---------------|
| Claude Code CLI | New `SessionStart` hook + top block in `CLAUDE.md` | Hook surface exists and is proven (graft). |
| Claude Code Desktop App | Same as CLI | Uses the bundled CLI. `CLAUDE.md` notes intermittent hook behavior; the top block is the fallback. |
| Gemini CLI | Top block in `GEMINI.md`. Hook: **deferred** | `.gemini/settings.json` has a `SessionStart` entry, but this design could not verify against Gemini CLI vendor docs that a Gemini `SessionStart` hook can return context to the model. The existing Gemini `SessionStart` entry also uses a flat shape (no nested `hooks` array), unlike `BeforeTool`. Verify before scope. |
| Antigravity | Top block in `GEMINI.md` only | Antigravity reads `GEMINI.md`. `CLAUDE.md` states that hooks do not fire in Antigravity, so a hook is not possible. |
| Codex CLI / Desktop App | Top block in `CODEX.md` only | No hook surface. `CODEX.md` line 19 says the Role Declaration and the Mandatory Execution Plan are the sole enforcement. |
| Hermes | Top block in `HERMES.md` (outside `COMMON-HERMES`) only | No hook surface. Size stays under the 19,000-byte budget (about 10,900 after the edit). |
| `templates/common` (L1) | Generated: `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, `HERMES.md` (`--governance-l1 --apply`); `scripts/hooks/pm-role-bootstrap.ts` (`--apply` after the SCRIPTS.md layer change); `scripts/SCRIPTS.md` (`generate-scripts-mirror.ts`). Manual: `.claude/settings.json` | R3.7.1, R3.7.3, R3.7.4. `.gemini/settings.json` does not change (F2). |
| Variants (`templates/co-*`, 13) | Manual: `.claude/settings.json` (13) and `HERMES.md` head (13) | R3.7.2, R3.7.4. The variant copy wins over L1 at scaffold and upgrade time. |
| New projects | Get the block (per profile), the hook, and the settings entry at scaffold time | `new-project.ts` copies L1, then the variant overlay. |
| Existing projects | Get the hook and the settings entry on the next `upgrade-project`. Do not get the top block | R3.7.5; open question 6. |

## Acceptance criteria

1. `scripts/hooks/pm-role-bootstrap.ts` exists, has a header comment and a `@version` line, and is fail-open.
2. `.claude/settings.json` has the new `SessionStart` entry. The two existing `SessionStart` entries are unchanged.
3. The hook stdout matches the `hookSpecificOutput` shape in R3.1. The payload is 1,000 characters or fewer.
4. `tests/unit/hook-pm-role-bootstrap.test.ts` passes with the 4 cases in R3.4.
5. `CLAUDE.md`, `GEMINI.md`, `CODEX.md`, and `HERMES.md` each start with the bootstrap block, directly after the H1.
6. The Role Declaration and every existing governance rule stay unchanged.
7. `wc -c HERMES.md` is less than 19,000.
8. `bun scripts/test-platform-parity.ts`, `bun scripts/validate-templates.ts`, and `bun scripts/audit.ts` pass.
9. A live Claude Code session shows Read calls for both files before the first response to a non-code question.
10. ~~No file under `templates/` changes.~~ Superseded by the 2026-10-02 amendment. Replaced by criteria 11–17.
11. `templates/common/CLAUDE.md`, `GEMINI.md`, `CODEX.md`, and `HERMES.md` are equal to the `--governance-l1` output. A second `--governance-l1 --apply` run reports "already in sync" for all five files.
12. `templates/common/scripts/hooks/pm-role-bootstrap.ts` is byte-identical to `scripts/hooks/pm-role-bootstrap.ts`. Both registries show layer `L0+L1`.
13. `templates/common/.claude/settings.json` and all 13 variant `.claude/settings.json` files have the new `SessionStart` entry. All other entries are unchanged (JSON diff shows one added array element per file).
14. Lines 1–28 of all 13 `templates/co-*/HERMES.md` are equal to lines 1–28 of `templates/common/HERMES.md`. The `COMMON-HERMES` zone is unchanged.
15. The PR changes only the files in the implementation plan (the §9 exception scope).
16. A fresh scaffold has the block in every delivered platform file, the hook file, and the settings entry. The hook run inside the scaffold prints the `hookSpecificOutput` JSON.
17. `templates/VERSION` does not change.

## Verification list (single PR)

Run from the workspace root unless stated:

1. `bun run test:unit` — includes `governance-boundary-l1.test.ts` (must pass now; it fails on the current tree because L0 has the block and L1 does not) and `hook-pm-role-bootstrap.test.ts`.
2. `bun scripts/audit.ts`
3. `bun scripts/validate-templates.ts` — PM-04 managed-block parity, VA-04 settings parity, platform-mirror freshness.
4. `bun scripts/test-platform-parity.ts`
5. `bun scripts/check-upgrade-coverage.ts --strict` — no new unclaimed file (ADR-0073).
6. `bun scripts/propagate-to-templates.ts --governance-l1 --apply` a second time — "already in sync" for all five files (idempotence).
7. Smoke scaffold (simulate-pipeline skill, `--mode project-creation`): `bun scripts/new-project.ts "e2e-test-scaffold" --variant co-deck`. Repeat with `--platform all` to get `CODEX.md` and `HERMES.md`. In `Projects/e2e-test-scaffold`, check the block, `scripts/hooks/pm-role-bootstrap.ts`, and the `.claude/settings.json` entry. Run `bun scripts/verify-scripts.ts --verify` in the scaffold (exit 0, 0 errors).
8. Hook run inside the scaffold: `echo '{"hook_event_name":"SessionStart","source":"startup"}' | CLAUDE_PROJECT_DIR=<scaffold> bun <scaffold>/scripts/hooks/pm-role-bootstrap.ts`. Expect exit 0 and the `hookSpecificOutput` JSON.
9. Delete the disposable scaffold.
10. Optional: `bun scripts/upgrade-project.ts` dry run against one existing project. Confirm that the hook file is listed for delivery and that `.claude/settings.json` shows `MERGE`. This closes the "not verified" item in R3.7.5.
11. `wc -c HERMES.md templates/common/HERMES.md` — both below 19,000.

## Follow-ups (out of scope)

| ID | Scope | Change |
|----|-------|--------|
| F1 | — | **Promoted into this spec** (R3.7, amendment 2026-10-02). |
| F2 | Gemini CLI | Verify the Gemini CLI `SessionStart` hook contract in vendor docs. If it supports model context, add a Gemini variant of the hook. |
| F3 | All | If live checks show the hook plus block still fails, reconsider alternative (e). |

## Open questions

1. Should the hook also fire on `resume`, or only on `startup`, `clear`, and `compact`? This design proposes all four sources.
2. Is a Q&A-only session cost of about 44.6 KB of reads per session acceptable? The alternative is to require only `agents/pm.md` for Q&A sessions.
3. Should the top block in `HERMES.md` also go inside `COMMON-HERMES` later, so that it propagates (F1)? This changes a byte-identical managed zone.
4. Gemini hook (F2): does the user want a vendor-doc check before or after this spec is implemented?
5. ~~Is there a script registry?~~ Resolved: `scripts/SCRIPTS.md` (row added) and the generated `templates/common/scripts/SCRIPTS.md` (R3.7.3).
6. Existing projects do not get the top block through `upgrade-project` (R3.7.5). Is the hook plus settings entry sufficient for the existing fleet? If not, choose one: (a) a later spec that adds a top-of-file anchor to the managed-block merge, or (b) a keyed `WORKSPACE-MANAGED` wrapper with a non-top position (R4 (k)).
7. `templates/CHANGELOG.md`: is an `[Unreleased]` entry wanted in this PR (step 8), or does the user prefer the nightly auto-release to describe the change?
8. Should the variant `HERMES.md` head edit (13 files) become a propagated domain later, so that the next head change does not need 13 manual edits?

## Implementation notes (2026-10-02)

- Deviation from the plan: `tests/unit/generate-scripts-mirror.test.ts` needed its row-count pin changed from 137 to 138. The hook is now delivered to L1. The design said no test file edits.
- User decisions: one combined PR, hook-only delivery for existing projects, an [Unreleased] changelog entry, and manual edits of the 13 variant HERMES.md files.
- Open follow-ups:
  - F2: Gemini hook (vendor-doc check first).
  - A propagation domain for variant HERMES.md heads and settings.json (the PM will file a ticket).
  - F3: reconsider a tool-call block if live checks still show skipped reads.

---

## Addendum (2026-10-02, T-20261002-012 — Gemini SessionStart hook delivered)

Vendor-doc verification (CONSTITUTION §11.0 rule 4): the Gemini CLI hooks system is
documented at https://geminicli.com/docs/hooks (SessionStart fires on startup, resume
and clear — the same trigger set as the Claude Code hook), the settings shape at
https://geminicli.com/docs/hooks/writing-hooks (`.gemini/settings.json` →
`hooks.SessionStart: [{ matcher, hooks: [{ type: "command", command }]}]`) and the
configuration reference at https://geminicli.com/docs/reference/configuration
(`hooks.SessionStart`, default `[]`). The shape is identical to the Claude Code
contract this design already uses.

Delivery: the `bun scripts/hooks/pm-role-bootstrap.ts` SessionStart entry was added to
`.gemini/settings.json` at L0 and propagated through the gemini-settings mirror
(L1 templates/common + all 13 L2 variants — shared keys are deep-equal per the
platform_settings contract; the drift report shows 0 unexpected rows).
