# Project-loss hardening (2026-11-04 `rm -rf Projects` incident) — design

- **Status**: implemented (registry SSOT; approved for implementation per DEC-20261104-02 ruling 5, 2026-11-05 — header reconciled with the registry per T-20261029-002)
- **Date**: 2026-11-04
- **Ticket**: T-20261104-004 (incident hardening; re-created after the original filing silently vanished — itself a covered failure mode, §5)
- **Related tickets**: T-20261104-003 (empty `Projects/` test parent), T-20261104-001 (memory auto-merge corruption — same silent-loss class, out of scope here), T-20261103-008, T-20261103-009 (11-03 rollback duplication; ids spelled out in full 2026-11-06 per T-20261106-006 item 3 so the design-gate-coverage join resolves the abbreviated "T-20261103-008/-009" form it previously could not see)
- **Incident record**: memory/2026-11-04.md, "INCIDENT" decision block (line 175)
- **Format reference**: docs/designs/2026-11-04-coabap-variant-identity-disposition-design.md

## 1. Problem

On 2026-11-04 a PM agent executed `rm -rf Projects` at the workspace root, believing it
was removing a test-created empty directory. The directory held 16 real L2 project
checkouts. All content was recovered (15 GitHub re-clones; co-newbiz via a Docker image
snapshot — memory/2026-11-04.md lines 159–181), but the recovery was luck-dependent
(clean working trees, a fresh image snapshot, intact remotes).

Four defects contributed or were exposed:

1. Nothing machine-enforced blocks a recursive delete of a path that can contain `.git`
   children. The existing control (`.claude/settings.json` line 15, `"Bash(rm -rf *)"`
   in `permissions.deny`) did not prevent the incident — either because the morning
   session ran on a different platform/harness, or because the deny prefix does not
   match compound/prefixed command forms. **Which of the two is unverified** (the
   incident block does not record the session platform); both gaps are real and are
   addressed.
2. The deceptive empty `Projects/` parent exists because co-workspace test suites
   create `Projects/<name>/` under a relative cwd and never remove the parent
   (T-20261104-003). The same leftover also flakes `apply-tier-normalization.test.ts`.
3. The ticket store silently lost a filed ticket (the original T-20261104-004) and an
   earlier rollback duplicated two tickets (T-20261103-008 and T-20261103-009 originals wrongly
   presumed lost). A cited-in-memory ticket id that does not resolve in the store was
   detectable within the same session and nobody could detect it.
4. The recorded lesson ("never run recursive deletes in the shared workspace; always
   dry-run list first; never delete a path that can contain .git children",
   memory/2026-11-04.md line 175) lives only in that memory block — no governance
   surface binds it to future sessions.

## 2. Evidence (file:line)

| Claim | Evidence |
|---|---|
| Incident command and lesson | memory/2026-11-04.md:175 |
| Existing Claude deny rule exists yet incident happened | .claude/settings.json:15 (`"Bash(rm -rf *)"`); memory/2026-11-04.md:159 |
| Gemini already has a terminal deny for `rm -rf` | .gemini/settings.json:58 (`terminal.denyList` entry `"rm -rf"`) |
| Test suites create `Projects/<name>` with relative paths | tests/unit/co-workspace-latency-ux.test.ts:23–26; tests/unit/co-workspace-phase2.test.ts:183–184; tests/unit/co-workspace-phase2b.test.ts:98–99 and :316 (spawned child script taking `process.argv[2]`) |
| Fake-scaffold suites use relative paths too (spawned at temp cwd — harmless) | services/co-workspace/src/scaffold.ts:48–49 (`cwd: req.workspaceDir`); fake scaffold bodies at tests/unit/co-workspace-server.test.ts:20–21, co-workspace-anthropic.test.ts:132–133 |
| Relocation removes children, never the `Projects/` parent | services/co-workspace/src/lifecycle.ts:79 (`moveDir(scaffolded.sourceDir, …)`), :129–131, :441–444 (`rmSync` of tenant dirs only) |
| Flake mechanism: `--projects` leg asserts count > 0 whenever `Projects/` exists | tests/unit/apply-tier-normalization.test.ts:298–309 (`existsSync` branch → `expect(projectCount).toBeGreaterThan(0)`); counter at tests/apply-tier-normalization.ts:358–364 (only `Projects/<entry>/agents` increments) |
| Isolated-wsDir precedent already exists in-repo | tests/unit/co-workspace-provisioning-gate.test.ts:30 (`mkdirSync(join(wsDir, "Projects"), …)`); tests/unit/co-workspace-attach.test.ts:77, :111 |
| Ticket single-file writes are already atomic (temp+rename) | scripts/helpers/ticket-store.ts:113–119 (`writeTicketAtomic`) |
| `createTicket` is NOT under the ticket lock and creates an empty file first (crash window) | scripts/helpers/ticket-store.ts:284–322 (`openSync(path, 'wx')` at :294, content rename at :318); lock wrapper at :153–200 wraps only existing-ticket mutations |
| Ticket ids cited in memory are the detection surface | memory/2026-11-04.md:175 ("ticket filed: T-20261104-004"), :181 |
| Memory-file parse contract (block/heading shape) | scripts/verify-memory.ts:108–117 |
| Rollback duplication of T-20261103-008, T-20261103-009 | tickets/governance/T-20261104-004.yaml:12–14; memory/2026-11-03.md contains the same session block twice (lines ~499 and ~836) — the 11-03 rollback artifact |
| Workspace-root detection precedent (fail-closed boundary, symlink-canonicalized) | scripts/helpers/security-validator.ts:149–161 (`detectWorkspaceRoot`), :171–177 (`canonicalize`) |
| PreToolUse hook input/decision conventions | scripts/hooks/gateguard-fact-force.ts:191–206 (fail-open stdin/JSON), :269–279 (deny/ask JSON + exit codes) |
| Session-scoped marker-file precedent (stateful hook via tmpdir) | scripts/hooks/pm-role-bootstrap.ts:14–16, :24 (`PM_GATE_STATE_DIR`, `<session_id>.json`) |
| Env-var reviewed escape hatch precedent | scripts/hooks/pre-push.ts:13 (`ALLOW_REMOTE_BRANCH_DELETE=1`) |
| Platform hook support truth | CONSTITUTION.md:791–809 (§11.1 table); CODEX.md:30–45 (trust-gated, SessionStart/UserPromptSubmit only, "everything else prompt-enforced"); GEMINI.md:275 (Antigravity does not fire hooks); HERMES.md (zero `hook` matches — unverified that any hook facility exists); .zcode/ (contains plans only — no hook config wired) |
| Prose propagation surfaces | AGENTS.md §7; templates/common/AGENTS.md §7 (line ~260); all 16 `templates/co-*/AGENTS.md` carry "Universal Baseline Behaviors" (grep count 16); HERMES.md §6 essentials (lines 73–82, inside `COMMON-HERMES` marker zone); validate-templates.ts:322–326 (PM-04b checks the COMMON-AGENTS zone only — §7 parity across variants is NOT machine-checked today) |
| `Projects/` is fully gitignored | .gitignore:10 (`/*/`), so its contents have no git safety net |

## 3. Goals / Non-goals

**Goals**

- G1: a machine gate blocks recursive deletes of workspace paths that can contain
  `.git` children, on every platform that can enforce it — with an honest per-platform
  coverage statement for those that cannot.
- G2: remove the deceptive empty `Projects/` parent at its source and kill the
  `apply-tier-normalization` flake.
- G3: make silent ticket loss detectable within the session that caused it, and
  duplicate re-filing loud.
- G4: land the recorded lesson in the governance prose surfaces that every session
  reads.

**Non-goals**

- N1: recovering/protecting `Projects/*` contents themselves (independent git repos;
  their protection is their remotes — already exercised in recovery).
- N2: fixing T-20261104-001 (memory auto-merge corruption) — separate ticket.
- N3: a general shell parser or sandbox. The gate is a documented heuristic for delete
  verbs, not a security boundary against adversarial input.
- N4: extending the guard to L2 project checkouts' own internals (Phase 2 option, §6.5).
- N5: deleting or relocating `templates/co-work/bun.lock` and other residue flagged in
  memory/2026-11-04.md:135 — separate cleanup.

## 4. Alternatives considered

### Item 1 (delete guard)

| Option | Pro | Con | Decision |
|---|---|---|---|
| A. Extend gateguard-fact-force.ts | one hook process | different input surface (`file_path` vs `command`), different policy (fact-forcing ask vs delete deny), state model, and platform matrix — entangling them couples two independently-evolving gates | Rejected |
| B. New dedicated PreToolUse hook (chosen) | single-purpose, mirrors gateguard conventions (stdin JSON, deny/ask, `--platform` flag), independently testable | one more hook script to maintain | **Chosen** |
| C. Claude permission deny only (status quo+) | zero code | prefix matching misses compound commands; single-platform; already failed once | Rejected as sole control; kept as defense-in-depth |
| D. PostToolUse undo/backup | catches unknown vectors | deletion of a gitignored tree is not undoable; backup of `Projects/` is a storage problem | Rejected |
| E. OS-level sandbox / bubblewrap | strongest | outside workspace control, breaks tooling | Rejected |

### Item 2 (Projects/ parent)

| Option | Pro | Con | Decision |
|---|---|---|---|
| A. Per-suite `process.chdir` into a temp dir | fully isolates cwd | `chdir` is process-global; bun runs test files in parallel — cross-file races; hidden coupling | Rejected |
| B. Absolute fixture roots + empty-parent sweep + test-assertion fix (chosen) | matches the in-repo precedent (provisioning-gate/attach suites), no global state, defense-in-depth at the flaky assertion | touches several suites | **Chosen** |
| C. Fix only the flaky assertion | smallest diff | leaves the deceptive directory — the incident trigger — in place | Rejected |

### Item 3 (ticket durability)

| Option | Pro | Con | Decision |
|---|---|---|---|
| Atomic-write only | cheap | already exists (ticket-store.ts:113–119); does not address the actual loss vectors | Insufficient alone |
| B. Drift check as SessionStart hook | earliest detection | needs per-platform wiring (claude/gemini/codex only); fires before memory is written in a fresh session; redundant with sync cadence | Rejected as primary |
| C. Drift check as dev-sync step (blocking) + `ticket.ts doctor` integration (chosen) | machine-enforced on the path every session already traverses; read-only, lock-free, cheap; would have caught the vanished -004 at the first post-citation sync | detection is bounded by "id is cited in memory" | **Chosen** |
| D. Append-only journal file per store | catches non-cited losses | second write path to keep consistent; over-engineered vs C | Rejected (v1) |

### Item 4 (prose)

Skill-only codification rejected: the lesson must be in the always-loaded baseline
(AGENTS.md §7), not an on-demand skill. A new `delete-guard` skill layer is recorded as
an optional follow-up to complete the 3-layer model (Hook → Prompt → Skill) but is not
required for v1.

## 5. Chosen design

### 5.1 Item 1 — PreToolUse Bash delete-guard hook

**New file**: `scripts/hooks/delete-guard.ts` (v1.0.0), wired as:

- `.claude/settings.json` → `hooks.PreToolUse`, matcher `Bash`,
  `bun scripts/hooks/delete-guard.ts --mode ask`, timeout 10.
- `.gemini/settings.json` → `hooks.BeforeTool`, matcher `run_shell_command`,
  `bun scripts/hooks/delete-guard.ts --platform gemini`, timeout 5000.

**Detection** (synchronous, pure):

1. Read stdin JSON; take `tool_input.command` (Claude) / `tool_input.command`
   (Gemini `run_shell_command`). Malformed or missing input → **exit 0, fail-open**
   (gateguard-fact-force.ts:191–206 convention).
2. Split the command on shell separators (`&&`, `||`, `;`, `|`, newline) — a documented
   heuristic, not a shell parser (limits in §7 Risks).
3. Flag a segment when it invokes a recursive delete verb:
   `rm` with any of `-r`, `-R`, `--recursive` (with or without `-f`), or a trash
   command (`trash`, `trash-put`). `git clean -x/-d/--dirty` and `find … -delete` are
   recorded as v2 candidates (Gemini's `terminal.denyList` already denies `git clean`).
4. Extract operand paths; expand `~`; resolve each against the workspace root
   (`CLAUDE_PROJECT_DIR` env, fallback: the `detectWorkspaceRoot` upward-walk from
   security-validator.ts:149–161); canonicalize with realpath-when-exists
   (security-validator.ts:171–177, macOS `/private/var` spelling).

**Gating rule** — BLOCK only when ALL hold:

- a recursive-delete verb was detected, and
- at least one resolved target is inside the workspace root, and
- the target is not fully covered by the regenerable-artifact allowlist, and
- no valid dry-run marker exists for that exact resolved target.

**Regenerable-artifact allowlist** (path-segment match, case-sensitive):
`node_modules`, `.next`, `dist`, `build`, `coverage`, `tmp`, `temp`, `.cache`,
`.turbo`, `.parcel-cache`, `.nuxt`, `.output`, `.vite`, `__pycache__`, `.pytest_cache`,
`target`, `.eslintcache` — plus anything under `os.tmpdir()`. **Allowlist bypass is
itself suppressed when `target/.git` (or a `.git` entry within a bounded depth-2 scan)
exists beneath the target** — implementing the "never delete a path that can contain
.git children" rule even for allowlisted segments. `os.tmpdir()` targets are exempt
from the `.git` re-check (temp dirs are the sanctioned place for test fixtures).

**Dry-run-list-first escape protocol.** Hooks are stateless per invocation
(gateguard state semantics, CONSTITUTION §11.2), so the protocol uses a marker file,
following the pm-role-bootstrap session-marker pattern (pm-role-bootstrap.ts:14–24):
state dir `DELETE_GUARD_STATE_DIR` or `<os.tmpdir()>/ai-workspace-delete-guard/`,
file `<session_id>.json` (session id from the hook payload when present). When the
command is a read-only listing (`ls`, `find <path> -maxdepth`, `du -s`, `stat`, `tree`)
whose operand resolves to a gated-class workspace path, the hook records
`{ resolvedPath, at }`. A subsequent recursive delete of the **same resolved path**
within 30 minutes passes the marker check. The marker never bypasses the human
confirmation on Claude (still `ask`) — it only downgrades the deny-with-protocol
message to an ask, and on Gemini it downgrades to allow (Gemini's
`terminal.executionPolicy: "Manual"` supplies the human confirmation;
.gemini/settings.json:54).

**Decisions and fail-open/closed posture**:

- Hook-infrastructure errors (unreadable stdin, JSON parse failure, bun crash) →
  **fail-open** (exit 0). Rationale: every existing workspace hook fails open
  (gateguard-fact-force.ts:191–206; pm-role-bootstrap header "Fails open"); a
  fail-closed hook bricks all Bash when bun is missing, and the instruction layer
  (§5.4) plus the existing deny lists remain as backstops.
- Successfully-parsed gated commands → **fail-closed**: Claude emits
  `{"decision":"ask"}` (exit 0) with a reason naming the protocol and the resolved
  path; Gemini emits `{"decision":"deny"}` (exit 2) with the same guidance, so the
  agent runs the dry-run listing first and retries. For the incident's exact command
  (`rm -rf Projects`: gated class, not allowlisted, no marker) the PM would have been
  forced to list the directory and would have seen 16 checkouts.
- **Reviewed escape hatch**: env `ALLOW_RECURSIVE_DELETE=1` bypasses the gate for the
  invocation (pre-push.ts `ALLOW_REMOTE_BRANCH_DELETE=1` precedent, line 13). The
  §7 prose records that the escape is for reviewed, scripted cases only.

**Honest per-platform enforcement coverage** (the CONSTITUTION §11.1 truth, extended):

| Platform | Enforcement | Basis |
|---|---|---|
| Claude Code CLI | Hook (PreToolUse/Bash) — full | .claude/settings.json hooks today |
| Claude Desktop App | Hook via bundled CLI — full with caveat (documented but intermittently observed, CONSTITUTION §11.1 note) | §11.1 |
| Gemini CLI | Hook (BeforeTool/run_shell_command, deny) — full | .gemini/settings.json hooks today |
| Antigravity | None — prompt layer only | GEMINI.md:275, CONSTITUTION §11.1 (❌) |
| Codex CLI / Desktop | None v1 — prompt layer only (hooks are trust-gated and the wired set has no pre-exec Bash event; CODEX.md:30–45 "everything else prompt-enforced") | CODEX.md §1 |
| Hermes Agent / CLI | None v1 — prompt layer only (HERMES.md contains no hook facility; `.hermes/` ships skills + commands only) | verified by grep |
| ZCode | None v1 — prompt layer only (no hook config present in `.zcode/`; capability **unverified**) | workspace survey |

Coverage gaps are covered by the §7 prose (§5.4) and the existing platform deny lists
(`.gemini/settings.json:58`). Wiring Codex/Hermes/ZCode enforcement is explicitly a
follow-up gated on those platforms shipping a pre-exec hook event — not claimed here.

### 5.2 Item 2 — fix the empty `Projects/` parent (T-20261104-003)

Root cause, grounded: suites that call `mkdirSync('Projects/<name>')` with a relative
path (latency-ux:23–26, phase2:183–184, phase2b:98–99) and the phase2b spawned child
(:316, `mkdirSync(\`Projects/${process.argv[2]}\`)` with no explicit cwd) execute under
bun test's cwd — the repo root. Cleanup paths (`moveDir` at lifecycle.ts:79,
`rmSync` at :129–131/:441–444) remove only the tenant child, never the parent. The
leftover empty `Projects/` then flips the `existsSync` branch of the
`apply-tier-normalization.test.ts:298–309` `--projects` leg to the
`toBeGreaterThan(0)` assertion while the counter (tests/apply-tier-normalization.ts:358–364,
counting only `Projects/<entry>/agents`) stays 0 → fail. Both the mid-run interleaving
and the leftover-across-runs shapes produce this.

Fix, four layers:

1. **Absolute fixture roots**: every relative `Projects/...` literal in
   `tests/unit/co-workspace-*.test.ts` becomes `join(<fixtureRoot>, 'Projects', name)`
   with `fixtureRoot = join(tmpdir(), 'co-workspace-<suite>-<random>')`. Precedent:
   co-workspace-provisioning-gate.test.ts:30 and co-workspace-attach.test.ts:77/:111.
   Spawned child fixtures receive the absolute path via argv/env (phase2b:316).
2. **Empty-parent sweep**: a tiny shared helper `tests/helpers/rmdir-if-empty.ts`
   exporting `rmdirIfEmpty(dir: string): void` (`rmdirSync`, swallow `ENOTEMPTY`/
   `ENOENT`, rethrow anything else) called in each touched suite's `afterAll` as a
   belt-and-braces sweep. No `process.chdir` anywhere.
3. **Assertion hardening**: the `--projects` leg test stops keying on `existsSync`
   dichotomy; it computes the expected count itself (number of `Projects/*/agents`
   dirs containing ≥1 agent file) and asserts equality — an empty (or absent)
   `Projects/` passes as 0, a populated one as N. The deceptive directory loses its
   power to flip the branch.
4. **No new empty-parent creation**: the fix removes the cause, so the incident's
   "empty Projects/" precondition cannot recur from tests; the runbook workaround
   (`rmdir Projects` per runbook) becomes dead and is removed from any doc that
   references it (grep at implementation time).

### 5.3 Item 3 — ticket-store durability

**Verdict on (a) atomic write**: single-file atomic writes **already exist** —
`writeTicketAtomic` (ticket-store.ts:113–119) does temp+`renameSync`, and mutations run
under `withTicketLock` (:153–200, mkdir lock with atomic stale takeover). What is
missing is narrower:

- **createTicket is not under the lock** (:284–322) and creates an **empty** file via
  `openSync(path, 'wx')` (:294) before renaming real content over it (:318). A crash
  between the two leaves an empty `.yaml` that wedges `listTickets` (empty YAML parses
  to null; `validateTicket` throws) and silently consumes the id.
  - Fix: write the fully-formed YAML to a unique temp file, then `linkSync(tmp, final)`
    — `link` is atomic and fails with `EEXIST` on an id collision, replacing both the
    `wx` probe and the rename (atomic-create-with-content, no empty-file window);
    `unlinkSync(tmp)` in both paths. `fs.linkSync` is supported on macOS/Linux/NTFS;
    if a platform rejects it, fall back to the current wx+rename dance behind a
    try/catch (documented, one code path).
  - Wrap the allocation loop in `withTicketLock(dir, 'create:' + prefix, …)` so the seq
    guess and the create serialize against archive/move — near-free consistency.
- **(b) Referenced-id drift check** — new helper
  `scripts/helpers/ticket-drift.ts` exporting `driftCheck({ memoryDir, serviceDir,
  governanceDir }): { cited, unresolved: Array<{ id, file, line }> }`. It scans
  `memory/*.md` for `\b[TU]-\d{8}-\d{3,4}\b` citations and resolves each via
  `resolveTicketLocation` (ticket-store.ts:339–393 — live stores + both archives).
  Any unresolved id is a finding. This is exactly the check that would have caught the
  vanished T-20261104-004 within the morning session (its id was cited at
  memory/2026-11-04.md:175).
  - **WHERE it runs — decision**: (i) a new **dev-sync step** (FATAL, read-only,
    lock-free — placed with the other cheap gates in the 3.x band) is the primary,
    machine-enforced trigger: every sync already runs after sessions write memory, and
    dev-sync is the workspace's strongest recurring gate; (ii) `ticket.ts doctor`
    (:461) additionally runs the check and reports unresolved ids — the diagnostic
    surface the runner closeout protocol already consults. Session-start hook rejected
    (§4); runner-closeout enforcement rides on doctor via the existing closeout
    protocol rather than new machinery.
- **(c) Duplicate-content detection on create**: inside `createTicket` (so the MCP
  create path inherits it), normalize the candidate title (lowercase, collapse
  whitespace) and compare against `listTickets` across **both** stores; on an exact
  normalized-title match (and, when inputs are present, equal inputs), throw a typed
  error naming the existing id; the CLI `create` path surfaces an explicit
  `--allow-duplicate` override for the legitimate re-file-after-archive case. Token
  similarity thresholds are rejected for v1 — exact-normalized match keeps false
  positives at zero (the 11-03 duplication shape — re-filing a ticket whose original
  survived a rollback — is an exact match).
- **Honest limits**: none of (a)–(c) defends the git-TRACKED governance store against
  `git checkout/reset/stash` reverting uncommitted files, or the sync-time
  moved-to-/tmp hygiene dance (memory/2026-11-04.md:332) — the presumed (unproven)
  vanish vector. (b) is the compensating control: loss becomes a loud, same-session
  detection instead of a silent one. Committing the store promptly after filing
  remains the operational mitigation and is already the norm (tickets/governance is
  committed by dev-sync).

### 5.4 Item 4 — governance prose codification

New §7 bullet, identical text on all surfaces:

> **Destructive File Operations**: Never run recursive deletes (`rm -r`, `rm -rf`,
> `rm --recursive`, trash commands) against any path in the shared workspace that does
> or could contain `.git` children (`Projects/**` first among them). Always dry-run
> list the exact resolved target first (`ls -la`, `find <target> -maxdepth 1`). The
> only blanket exception is regenerable build artifacts (`node_modules`, `dist`,
> `.next`, `coverage`, `tmp`) inside temp directories. The reviewed escape
> (`ALLOW_RECURSIVE_DELETE=1`) is for scripted, pre-approved cases only.

**Surfaces and propagation** (verified):

| Surface | Tier | Why |
|---|---|---|
| `AGENTS.md` §7 | L0 | the binding baseline every tool auto-loads |
| `templates/common/AGENTS.md` §7 | L1 | the common skeleton variants regenerate onto |
| all 16 `templates/co-*/AGENTS.md` §7 | L2 sources | each carries "Universal Baseline Behaviors" (grep count 16) |
| `HERMES.md` §6 essentials list | L0 platform twin | condensed §7 copy inside the `COMMON-HERMES` marker zone (lines 73–82) |
| `CLAUDE.md` / `GEMINI.md` / `CODEX.md` | — | **no change — justified**: these files carry role declarations only; none carries a baseline section today (grep: no "Universal Baseline"/"Security Boundaries" matches in CLAUDE.md/GEMINI.md/CODEX.md) |

Propagation mechanics: this follows the existing path (root §7 → common §7 → variant
§7 regeneration) — no new `@l2-propagate` machinery is introduced; `@l2-propagate`
remains the L0-only script convention it is today (e.g. ticket-store.ts:49). Because
validate-templates' PM-04b arm (validate-templates.ts:322–326) checks only the
COMMON-AGENTS zone, §7 variant parity is **not** machine-checked today; the change set
adds a WARN-stage arm asserting every `templates/*/AGENTS.md` §7 contains the
"Destructive File Operations" marker phrase, so the 16-file sync cannot silently rot.

## 6. Scope table (L0–L3)

| Level | Changes | Notes |
|---|---|---|
| L0 (workspace root) | delete-guard.ts + `.claude`/`.gemini` settings wiring; CONSTITUTION §11 new subsection (gate spec + platform table); AGENTS.md §7 bullet; HERMES.md §6 bullet; ticket-store.ts v1.15.0 (create-under-lock, link-based create, duplicate refusal); scripts/helpers/ticket-drift.ts; dev-sync step; tests | where the incident happened; where enforcement lives |
| L1 (templates/common) | `templates/common/AGENTS.md` §7 bullet; `templates/common/scripts/hooks/delete-guard.ts` mirror (byte-identical modulo the sanctioned CONSTITUTION scrub — gateguard header precedent) — **Phase 2**: delivered-hook wiring for scaffolded projects | L1 delivery of the hook itself deferred: projects are independent repos (CODEX.md:45) and their deletes are lower-blast-radius (recloneable) |
| L2 (variant templates) | 16 × `templates/co-*/AGENTS.md` §7 bullet + validate-templates WARN arm | high-touch but content-identical; flagged per architect constraints (>3 template files → explicit user confirmation required) |
| L3 (Projects/* fleet) | none machine-wired | their delivered AGENTS.md §7 (via L1/L2 regeneration) carries the prose; `apply-tier-normalization --projects` unaffected |

**Platform Impact (mandatory)**

| Platform | Impact | Files |
|---|---|---|
| Claude Code | changes required | `.claude/settings.json` (PreToolUse Bash hook), scripts/hooks/delete-guard.ts |
| Gemini CLI | changes required | `.gemini/settings.json` (BeforeTool hook) |
| Antigravity | None — **justification**: hooks do not fire (CONSTITUTION §11.1, GEMINI.md:275); protection is the §7 prose layer | N/A |
| Codex CLI/Desktop | None v1 — **justification**: no pre-exec Bash hook event in the wired, trust-gated set (CODEX.md:30–45); prose layer covers | N/A |
| Hermes | None v1 — **justification**: no hook facility documented anywhere in the workspace; prose layer covers | N/A |
| ZCode | None v1 — **justification**: no hook wiring present; capability unverified; prose layer covers | N/A |
| templates/common | propagation required (Phase 2 hook mirror + §7) | listed above |

## 7. Test / gate plan

- **Unit tests (new)**:
  - `tests/unit/delete-guard.test.ts` — parsing fixtures including the exact incident
    command (`rm -rf Projects`), compound forms (`cd x && rm -rf y`,
    `foo; rm -r bar`), flag permutations (`-fr`, `--recursive -f`, `-R`), allowlisted
    (`rm -rf node_modules` → pass), tmpdir targets (pass), marker protocol (list
    recorded → delete downgraded), `ALLOW_RECURSIVE_DELETE=1`, `.git`-beneath-allowlist
    suppression, fail-open on malformed stdin.
  - `tests/unit/ticket-drift.test.ts` — cited-id resolution across live/archive; an
    unresolved id surfaces with file+line; memory files without citations pass.
  - extend ticket-store tests — create-under-lock, `link`-based create collision retry,
    crash-window simulation (empty file no longer possible), duplicate-title refusal +
    `--allow-duplicate` override.
  - `tests/helpers/rmdir-if-empty.ts` tests + the hardened `--projects` leg assertion.
- **Suites**: all touched `tests/unit/co-workspace-*.test.ts` green; a run with a
  pre-seeded empty `Projects/` no longer fails `apply-tier-normalization.test.ts`.
- **Gates**: `bun scripts/audit.ts` (all-pass), `bun scripts/validate-templates.ts`
  (0 errors; new WARN arm green on all 16 variants), `bun scripts/audit.ts
  --spec-check` via the Design Gate — register this design with
  `bun scripts/spec-register.ts --file docs/designs/2026-11-04-project-loss-hardening-design.md --source manual --status implemented` at landing (ADR-0074).
- **Hook verification**: manual matrix on Claude CLI and Gemini CLI (gated ask/deny
  observed; allowlisted pass-through; marker protocol end-to-end).

## 8. Rollout order

1. **Item 2** (test fix) — smallest, kills the deceptive directory and the flake
   immediately; no settings changes.
2. **Item 3** (ticket durability) — helper + dev-sync step + store changes; pure
   workspace-side, machine-gated at next sync.
3. **Item 1 + Item 4** together — hook + settings wiring + CONSTITUTION §11 subsection
   + §7 prose (L0 + HERMES.md), so the machine gate and its instruction layer land in
   one gate-moment.
4. **L1/L2 propagation wave** — common + 16 variant AGENTS.md §7 + validate-templates
   WARN arm + Phase-2 hook mirror, via `/sync` PR.
5. Closeout: spec-register, VERSION_MANIFEST/SCRIPTS.md rows, ticket moves
   (T-20261104-004 → done with sub-item mapping; T-20261104-003 → done by step 1).

## 9. Risks

| Risk | Mitigation |
|---|---|
| False-positive gating of legitimate cleanups (e.g. clearing a stale `Projects/co-x` checkout by hand) | allowlist + `.git`-aware suppression is precise about *what* is gated; marker protocol and `ALLOW_RECURSIVE_DELETE=1` provide two documented escapes; `ask` (not hard deny) on Claude keeps a human in the loop |
| Hook latency on every Bash call | synchronous parse + bounded `existsSync` scans; budget < 50 ms; existing hooks run at 10–30 s timeouts, so headroom is large |
| Heuristic parsing misses obfuscated deletes (scripts calling `fs.rmSync`, `find -delete`, `git clean`) | explicit non-goal (N3); recorded v2 candidates; audit.ts shell-injection patterns and review cover the script-authoring path; prose covers everything else |
| Marker-file spoofing via session id | the marker only relaxes the *reasoning burden*, never the human `ask` on Claude; Gemini's Manual approval policy supplies the confirmation there |
| Windows `linkSync` divergence | documented fallback to the existing wx+rename path |
| 16-file §7 sync drift | new validate-templates WARN arm pins the marker phrase |
| Dev-sync step false-alarms on stale memory citations (ticket archived then id cited in old memory) | `resolveTicketLocation` already resolves archived ids; unresolved-only reporting; the step reports file+line so triage is mechanical |
| Unverified premises | morning-session platform (deny-rule bypass vector) and the exact -004 vanish vector are unproven; the design does not depend on which it was — both covered classes (prefix-matching gaps, non-Claude platforms) are addressed |

## 10. Accessibility

Backend/governance tooling only — no UI, no user-facing rendered surfaces. **Exempt
from ADR-0065 accessibility review** (no UI change).

## 11. Open questions (user ruling needed before implementation)

All four RESOLVED 2026-11-05 by user ruling — see the addendum below and
docs/decisions/DEC-20261104-02.md.

1. **Variant §7 wave scope**: updating all 16 `templates/co-*/AGENTS.md` files exceeds
   the architect's 3-template-file high-risk threshold — approve the full 16-file wave
   now, or L0+L1 first with the variant wave in a follow-up PR?
   (RESOLVED 2026-11-05: full wave now — root + common + all 16 variants + HERMES.md
   in one PR; 16-file threshold accepted, single phrase machine-pinned by the new
   validate-templates WARN arm.)
2. **Gemini decision mapping**: deny-with-protocol (chosen, agent self-serves via
   listing + retry under Manual approval) vs ask-equivalent — confirm deny is
   acceptable for Gemini sessions.
   (RESOLVED 2026-11-05: deny confirmed — Manual terminal approval already supplies
   the human confirmation; deny is the stronger default.)
3. **`git clean` / `find -delete` in v1 or v2?** Chosen: v2. Confirm.
   (RESOLVED 2026-11-05: v2 confirmed — v1 covers `rm`/trash recursive deletes only.)
4. **Duplicate-refusal override surface**: store refuses + CLI `--allow-duplicate`
   (chosen) vs store-level flag — confirm the CLI-level override.
   (RESOLVED 2026-11-05: confirmed — store-level refusal on exact normalized-title
   match across both stores, CLI `--allow-duplicate` override approved.)

## Addendum — User Rulings (2026-11-05)

Design Gate approval per ADR-0061, recorded in docs/decisions/DEC-20261104-02.md.
Status of this design: approved (all four hardening items proceed); §11 open
questions closed as marked above.

- **R1 — Design approved**: all four hardening items proceed (delete-guard hook,
  `Projects/` test isolation fix, ticket-store durability, governance prose).
- **R2 — §7 prose scope (OQ 1)**: full wave now — root `AGENTS.md` +
  `templates/common/AGENTS.md` + all 16 variant `AGENTS.md` + `HERMES.md` in one PR,
  with the new validate-templates WARN arm pinning the phrase; the 16-file
  high-risk threshold is accepted for this wave (single phrase, machine-pinned).
- **R3 — Gemini delete-guard mode (OQ 2)**: `deny` — its Manual terminal approval
  already supplies the human confirmation; deny is the stronger default.
- **R4 — v1 pattern scope (OQ 3)**: recursive deletes covered = `rm`/trash only;
  `git clean` / `find -delete` variants deferred to v2 (accepted
  false-positive-reduction rationale).
- **R5 — Duplicate tickets (OQ 4)**: store-level duplicate refusal (exact
  normalized-title match across both stores) with CLI `--allow-duplicate` override
  approved.

Open observations (unchanged, not blocking): the unexplained non-firing of the
existing `.claude/settings.json` deny rule and the vanish vector of the original
T-20261104-004 filing remain open; the design covers both failure classes without
depending on either cause.
