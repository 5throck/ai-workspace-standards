# Memory merge integrity + intake-lock win32 resilience — design (two tickets, one design cycle)

- **Status**: implemented (2026-11-05 — T-20261104-001 + T-20261105-001, PR #1856; two-tier step-3.88 rollout user-approved same day)
- **Date**: 2026-11-05
- **Tickets**: T-20261104-001 (memory auto-merge silent corruption), T-20261105-001 (win32 intake-lock EPERM flake)
- **Shared design cycle precedent**: docs/designs/2026-11-04-project-loss-hardening-design.md (format reference; that design also carried a multi-item scope under one ticket)
- **Related**: T-20261104-004 (project-loss hardening — the memory-drift dev-sync step 3.87 this design sits next to), T-20261005-001 / T-20261022-022 (the win32 transient-FS retry precedent inside mcp-upstream-server.ts)

## 1. Problem

Two independent reliability defects, filed one day apart during the same PR merge cycle, share one theme: a silent failure mode that existing gates do not see.

**Ticket 1 — git ort auto-merge silently corrupts `memory/YYYY-MM-DD.md` session-block unions (T-20261104-001).** Memory session logs are append-only files: blocks separated by `---`, each block headed `## Session Summary` (the four-section contract enforced by scripts/verify-memory.ts:29-34, block splitting at :108-117). On 2026-11-04, two independent PR conflict resolutions (#1842, #1845) produced silently corrupted unions: dropped blocks and a fused heading/separator — with no conflict markers left behind, detectable only by a manual post-merge block audit, both repaired by hand. No machine gate compares a merge result against its parents for these files. The existing memory format gate (verify-memory.ts, invoked from audit.ts:1068-1084) is **WARN-only** and validates sections *within* blocks — it does not compare merge results against parents and does not block.

**Ticket 2 — win32 intake-lock mkdir EPERM flake (T-20261105-001).** `tests/unit/mcp-upstream-server.test.ts` intermittently fails on `windows-latest` with `EPERM: operation not permitted, mkdir ...\.intake-lock`. The server's own history documents this exact failure class twice (v1.9.2 note for `linkSync` EPERM under windows-latest PR #1419; v1.10.1 note extending retry to the tmp write / O_EXCL fallback / audit append) — but the lock-dir mkdir acquisition itself was never hardened: it rethrows every non-`EEXIST` error immediately. The flake is pre-existing (PR #1855's diff contains zero mcp/upstream paths; file last changed d73f31b4c 2026-11-02); windows filter/AV/indexer pressure surfaces as transient `EPERM` on the `mkdirSync` syscall itself.

## 2. Evidence (file:line)

| Claim | Evidence |
|---|---|
| Block contract: `---` separators, `## Session Summary` + 3 required sections | scripts/verify-memory.ts:29-34 (`REQUIRED_SECTIONS`), :108-117 (split on `/\n---\n/`, heading via `/^## (.+)/m`) |
| Memory merge corruption incidents (dropped blocks + fused heading/separator, hand-repaired) | tickets/governance/T-20261104-001.yaml:4-14 (cites #1842/#1845 resolution reports, 2026-11-04) — the PR reports themselves are ⚠️ Unverified from this session; the ticket record is the trusted summary |
| Existing memory gate is WARN-only | scripts/audit.ts:1077-1081 (`Warn("Memory log format issues detected…")` on non-zero exit) |
| verify-memory does not compare merge parents | scripts/verify-memory.ts:104-134, :138-262 (whole-file format + index checks only; no git involvement) |
| dev-sync appends session blocks itself (no merge involved in the append path) | scripts/dev-sync.ts:583-641 (separator decision :583-585, idempotency check :590-599, `appendFileSync` :640); post-commit header rewrite at :1796-1814 |
| Fresh precedent: small drift-check helper wired as a BLOCKING dev-sync step | scripts/helpers/ticket-drift.ts:1-23 (structure/conventions), scripts/dev-sync.ts:844-874 (step 3.87, FATAL on findings) |
| Step band around the proposed insertion point is free | scripts/dev-sync.ts:844 (3.87), :876 (3.9) — **3.88/3.89 unused** (grep: zero matches) |
| The repo uses merge commits (not squash) — parent comparison is meaningful | `git log --merges --oneline -5` → `268e21c64 Merge pull request #1855 …` etc. (2026-11-05) |
| Lock acquisition rethrows non-EEXIST | scripts/mcp-upstream-server.ts:602-607 (`if (code !== 'EEXIST') throw err`) |
| Lock deadline machinery already exists (wait + fail-closed) | scripts/mcp-upstream-server.ts:586-594 (`UPSTREAM_LOCK_TIMEOUT_MS`, default 5000), :625-628 (`IntakeLockTimeoutError`, `Bun.sleepSync(25)`) |
| In-file precedent for transient-FS retry on Windows | scripts/mcp-upstream-server.ts:516-536 (`withFsRetry`, `TRANSIENT_FS = {EBUSY, EPERM, EAGAIN}`, 3 attempts, 25ms·n backoff); header notes v1.9.2 (:47-52) and v1.10.1 (:40-43) document the same win32 class |
| Tests already isolate workspaces per test (flake is syscall pressure, not cross-test collision) | tests/unit/mcp-upstream-server.test.ts:54-75 (`makeWorkspace` → unique `mkdtempSync` root :55, logsDir :60, :74) |
| Existing lock tests cover stale takeover and deadline-0 fail-open | tests/unit/mcp-upstream-server.test.ts:1718-1738 |
| Test seam precedent for env-based injection | scripts/mcp-upstream-server.ts header v1.5.0 (`UPSTREAM_LOCK_TIMEOUT_MS` seam), v1.9.0 (`UPSTREAM_ROOTS_TIMEOUT_MS` seam) |
| Merge-driver portability nuance | `merge=union` is a git **built-in** driver (no per-clone config needed) — see §4 for why it is still rejected |

## 3. Goals / Non-goals

**Goals**

- G1 (T1): a machine gate that fails loudly when a memory session-log merge has dropped or fused session blocks — regardless of which tool produced the merge — with repair guidance naming the affected blocks.
- G2 (T1): the gate is wired where the workspace's strongest recurring gate already runs (dev-sync), following the ticket-drift.ts step precedent.
- G3 (T2): the intake-lock acquisition tolerates transient win32 `EPERM`/`EACCES`/`EBUSY` on the lock mkdir, without weakening the FAIL-CLOSED semantics (v1.8.0 M5).
- G4 (T2): the fix hardens production intake (parallel server instances on Windows), not just CI.

**Non-goals**

- N1 (T1): preventing the bad merge from being *created*. Git merge behavior for these files is not changed (no merge driver, no custom strategy); the design detects corruption at the next gate crossing. Post-hoc detection is the honest surface available — merges happen on GitHub (§5.1), outside any hook this repo controls.
- N2 (T1): auto-repair of corrupted memory files. The step is read-only; repair guidance is output, the fix is a human/agent action.
- N3 (T1): detecting content *rewrites inside* blocks that keep all block fingerprints intact (fingerprint-exact matching makes subtle edits detectable, but cosmetic-diff triage is out of scope; see §5.3 limits).
- N4 (T2): serializing intake-lock creation in tests only. Rejected (§4) — leaves the production race.
- N5 (both): no changes to verify-memory.ts's existing format contract, no changes to the audit WARN posture (a separate, explicit decision — not silently changed here).

## 4. Alternatives considered

### Ticket 1 — memory merge integrity

| Option | Pro | Con | Decision |
|---|---|---|---|
| A. `.gitattributes` `memory/*.md merge=union` | built-in driver — actually **repo-portable** (no per-clone config, correcting the ticket's premise); zero scripts | line-based union cannot express *block*-level union; duplicates blocks on rebase/cherry-pick shapes; **suppresses conflict markers entirely**, so a bad union commits with zero human visibility — the exact failure mode being guarded; does nothing for fuses produced by hand resolution edits; no repair guidance | Rejected |
| B. Custom merge driver (`merge.memoryUnion.driver`) | block-aware possible in principle | driver definition is per-clone config (`merge.<driver>.driver` lives in `.git/config`, never committed) — not enforced repo-wide; a missing config silently falls back to ort, recreating the defect; can only run at merge time on GitHub's infrastructure, which we do not control | Rejected |
| C. Post-merge union-verify gate (chosen) | detects drops AND fuses regardless of how they were produced (ort, manual resolution, script edits — for fuses); pure + unit-pinnable; emits repair guidance; mirrors the just-shipped step-3.87 precedent (ticket-drift.ts) | post-hoc only — corruption is caught at the next sync, not at merge time; drops via non-merge commits are invisible (§5.3) | **Chosen** |
| D. Merge-strategy customization repo-wide (e.g. `merge=ours` tricks, rerere policies) | — | wrong semantics for append-only union files; broader blast radius than the defect | Rejected |

### Ticket 2 — intake-lock EPERM

| Option | Pro | Con | Decision |
|---|---|---|---|
| A. Test-side serialization (global lock around intake tests) | smallest blast radius | fixes only CI; the same race exists in production on every Windows host running parallel intakes; serialization slows the suite; the flake is syscall-level pressure, not cross-test collision (each test already gets a unique mkdtemp root, test file :55) | Rejected |
| B. Server-side retry-with-backoff in the lock acquisition (chosen) | hardens production too; reuses the existing deadline loop and the `withFsRetry`/`TRANSIENT_FS` in-file precedent (mcp-upstream-server.ts:516-536); FAIL-CLOSED semantics preserved | slightly longer worst-case latency before a genuinely permission-denied path errors (bounded by the lock deadline; message carries the code — see §5.4) | **Chosen** |
| C. Bounded 3-attempt standalone retry (50/200ms) as the ticket sketched | matches ticket text literally | duplicates machinery the deadline loop already provides; two retry layers to reason about | Rejected in favor of B's deadline-loop integration |

## 5. Chosen design

### 5.1 Ticket 1 — memory union-verify (T-20261104-001)

**New file**: `scripts/helpers/memory-union-verify.ts` (v1.0.0), structured like scripts/helpers/ticket-drift.ts: a pure, exported core plus a thin git-plumbing wrapper; unit-pinned by a new test; byte-identical L1 mirror via the existing dev-sync delivery (dev-sync.ts is L0+L1, so the helper ships to `templates/common/scripts/helpers` — same mechanics as ticket-drift.ts, header note :15-23).

**Pure core** (no git, fully unit-testable):

```ts
export interface MemoryBlock { heading: string; firstLine: string; text: string; }
export function parseBlocks(content: string): MemoryBlock[];        // split /\n---\n/ (verify-memory.ts:109 convention), trim, heading = first /^## (.+)/m
export interface UnionFinding {
  kind: 'dropped-block' | 'fused-heading' | 'malformed-result';
  file: string;                                                      // repo-relative, e.g. memory/2026-11-04.md
  detail: string;                                                    // block heading + first content line, owning parent
}
export function verifyUnion(opts: {
  file: string; ours: string; theirs: string; merged: string;
}): UnionFinding[];
export function verifyWellFormed(opts: { file: string; content: string; }): UnionFinding[];  // Arm B
```

**Detection rules**:

1. **Drop**: every block in `ours` and every block in `theirs` (fingerprint = exact trimmed block text) must appear in `merged`. Order is not checked (union semantics are order-tolerant). Identical blocks present in both parents and deduplicated to one in the merged result **pass** — that is correct union behavior, not a drop.
2. **Fuse**: any parsed block in `merged` containing ≥ 2 top-level `^## ` headings → the signature the 11-04 incident produced when a heading and its separator fused. Also caught by rule 3's count invariant.
3. **Well-formed result**: for the merged content, `headingCount === separatorCount + 1` (verified against the live repo: memory/2026-11-04.md has 16 `## Session Summary` headings and 15 `^---` separators), and every block begins with a `## ` heading after trim.
4. **Match strategy**: exact trimmed-text fingerprint first; if not found, a fallback match on `heading + firstLine` prevents false alarms when a resolution legitimately reflowed whitespace inside an otherwise-intact block — the finding fires only when neither fingerprint nor heading+firstLine matches. (Exact-vs-loose matching trade-off recorded in §9.)

**dev-sync wiring — new Step 3.88 (BLOCKING), inserted between step 3.87 (dev-sync.ts:844-874) and step 3.9 (:876)**, same band as the other cheap read-only gates. Two arms:

- **Arm A — merge-commit union-verify.** Enumerate merge commits touching flat memory logs within a bounded window: `git log --merges --since=<7 days> -n 20 -- 'memory/*.md'` (bounded sweep: 7 days AND 20 commits, whichever hits first — documented constant). For each merge commit M and each touched file (excluding `memory/archive/`, `meeting-*`, `adr-*` per the verify-memory.ts:37-42 exemption patterns): fetch blobs `git show <P1>:<path>`, `git show <P2>:<path>`, `git show <M>:<path>` and run `verifyUnion`. Any finding → FATAL, listing each finding with `kind`, file, block heading + first line, and owning parent, followed by repair guidance: `git show <M>:<file>` vs `git show <P1|P2>:<file>`, restore the named block(s), re-commit. The repo's merge-commit convention (§2, `git log --merges`) makes parent comparison meaningful; dev-sync itself never creates merge commits (its memory write is the plain append at dev-sync.ts:640), so the step's scan target is exclusively externally-created history — no self-triggering.
- **Arm B — worktree structural integrity.** For every flat `memory/*.md` in the working tree (post-append, post-step-6.9 rewrite): run `verifyWellFormed`. This arm catches fuses that arrived via *non-merge* commits (hand resolution committed as ordinary branch commits) and any residual corruption already at HEAD. Drops via non-merge commits are **not** detectable here (no parents to compare) — recorded honestly in §5.3.

Absent `memory/` (fresh scaffold) = documented no-op, matching step 3.87's posture (dev-sync.ts:859). In variant/L1 trees the helper is present and self-contained (node:fs + git subprocess only — no guarded dynamic import needed, unlike ticket-drift.ts's L0-only store dependency); a variant repo with no memory merge commits simply passes.

**dev-sync version bump**: v1.40.0 (current 1.39.0), header note citing this design and T-20261104-001.

### 5.2 Where the corruption actually happens (grounding note, as instructed)

dev-sync appends session blocks itself in the common case (dev-sync.ts:583-641) — plain `appendFileSync`, no git merge involved. The 11-04 corruption occurred during **PR conflict-resolution merges done by hand/agents** (#1842/#1845), i.e. the damage enters history through merge commits on main (or resolution commits on the PR branch). Therefore: Arm A covers the merge-commit surface at the first sync after the merge lands in the local clone (post-pull); Arm B covers whatever is already at HEAD. There is no pre-merge hook surface available to this repo — GitHub performs the merges — so pre/post images are taken from git object storage (the two parents vs the result), not from any dev-sync-managed staging area. This is the honest, and only, workable image source.

### 5.3 What the check can and cannot catch (explicit)

**Catches**:
- Dropped blocks in merge commits touching memory logs (Arm A) — the #1842/#1845 drop shape.
- Fused heading/separator in merge commits (Arm A rule 2) and in any commit already at HEAD (Arm B) — the #1842/#1845 fuse shape.
- Malformed block structure at HEAD regardless of origin (Arm B rule 3).

**Cannot catch (documented limits)**:
- Blocks dropped via **non-merge** commits (hand resolution committed as regular commits on a branch, then merged without memory conflicts). No parents to compare; only PR review covers this. The fuse half of that shape is still caught by Arm B.
- Corruption **repaired** before the next sync crosses step 3.88 — by design (a repaired file passes; re-flagging repaired history would need a state ledger, rejected as v1 scope, N1-adjacent).
- Merge commits outside the 7-day/20-commit bounded window — never scanned. Bounded sweep is a deliberate cost cap; the incident class is same-cycle (corruption is discovered within days, per the 11-04 timeline).
- Subtle content rewrites that keep heading+firstLine intact (fallback-match blind spot, rule 4).

### 5.4 Ticket 2 — intake-lock transient-FS tolerance (T-20261105-001)

**Change site**: scripts/mcp-upstream-server.ts `withIntakeLock`, lines 598-630, version bump to **v1.14.0** (current 1.13.0).

1. **Lock-dir mkdir retry inside the existing deadline loop** (:602-630). The catch at :607 currently rethrows everything except `EEXIST`. Change: a `LOCK_TRANSIENT` set `{ EBUSY, EPERM, EACCES }` is treated like any other failed acquisition — log once per code (rate-limited to the first occurrence, mirroring withFsRetry's console.error style :531), `Bun.sleepSync(25)`, continue the loop until the existing deadline (:601, default 5000 ms via `UPSTREAM_LOCK_TIMEOUT_MS`). On deadline expiry, throw `IntakeLockTimeoutError` with the last transient code embedded in the message (e.g. `intake lock busy after 5000ms — last fs error EPERM on .intake-lock mkdir`), so diagnostics are preserved rather than lost to an immediate raw EPERM throw.
   - Deviation from the ticket's "3 attempts, 50/200ms" sketch: the deadline loop already provides bounded, configurable retry with fail-closed semantics (v1.8.0 M5, :622-626); a second standalone retry layer would duplicate it. Justification recorded in §4 option C.
2. **`mkdirSync(LOGS_DIR, { recursive: true })` at :599** is itself a win32 EPERM site under the same pressure — wrap it with the existing `withFsRetry(..., 3, 'lock logs dir')` (:521-536), extended by a lock-scoped transient set. `TRANSIENT_FS` (:520) stays `{EBUSY, EPERM, EAGAIN}` for its existing call sites (audit append etc.) to avoid silently changing v1.10.1 semantics; the lock path uses `LOCK_TRANSIENT = { EBUSY, EPERM, EACCES, EAGAIN }`. (EACCES added per the ticket; the other three keep parity with the in-file precedent.)
3. **FAIL-CLOSED unchanged**: a still-failing lock after the deadline answers retryable `-32000` exactly as today (:622-626); no silent unlocked fallthrough is introduced.
4. **Test seam**: env `UPSTREAM_FAULT_LOCK_MKDIR=<n>` — the first `n` lock-dir mkdir attempts throw a synthetic `EPERM` before the real call is attempted (precedent: `UPSTREAM_ROOTS_TIMEOUT_MS` v1.9.0, `UPSTREAM_LOCK_TIMEOUT_MS` v1.5.0). Default unset = zero behavior change.

**Why server-side over test-side** (per the ticket's own framing): the fix is ~10 lines inside an existing loop, hardens every production Windows host running parallel intakes (the v1.9.2/v1.10.1 class is documented production history in this exact file), and test-side serialization would leave the syscall-level race untouched while slowing the suite.

## 6. Scope table (L0–L3)

| Level | Changes | Notes |
|---|---|---|
| L0 (workspace root) | scripts/helpers/memory-union-verify.ts (new, v1.0.0); dev-sync.ts v1.40.0 (step 3.88, both arms); scripts/mcp-upstream-server.ts v1.14.0 (lock transient tolerance + fault seam); tests/unit/memory-union-verify.test.ts (new); tests/unit/mcp-upstream-server.test.ts (new lock-fault cases) | both defects live at L0; enforcement lives at L0 |
| L1 (templates/common) | templates/common/scripts/helpers/memory-union-verify.ts (byte-identical mirror via the standard dev-sync delivery — same mechanism as ticket-drift.ts, helper header note :15-23); templates/common/scripts/mcp-upstream-server.ts mirror | dev-sync is L0+L1 byte-identical, so its importer ships; the helper is self-contained (no L0-only dynamic import needed) |
| L2 (variant templates) | none directly | variants receive the helper + updated dev-sync through the standard L1 delivery contract; step 3.88 is a no-op where no memory merge commits exist |
| L3 (Projects/* fleet) | none | variant syncs gain the integrity arm automatically; no project-side wiring |

**Platform Impact (mandatory)**

| Platform | Impact | Files |
|---|---|---|
| Claude Code | changes required (CI + local gates are platform-neutral) | dev-sync.ts, helpers, mcp-upstream-server.ts |
| Antigravity (GEMINI.md) | None — **justification**: no hook/platform wiring is involved; the changes are repo-level scripts executed by the shared dev-sync/test pipeline on every platform | N/A |
| templates/common | propagation required | helper + server mirror (L1 row above) |

## 7. Test / gate plan

**Ticket 1**:
- `tests/unit/memory-union-verify.test.ts` (new, pinning the pure core): parent blocks all present → pass; dropped block from either parent → `dropped-block` finding naming heading + parent; fused heading/separator (reconstruct the incident shape: two `## Session Summary` headings inside one block) → `fused-heading`; separator-count violation → `malformed-result`; identical block in both parents deduped in result → pass; whitespace-reflowed block matched via heading+firstLine fallback → pass; meeting/adr filename exemptions honored at the scan layer.
- Step 3.88 integration: on a fixture repo with a constructed merge commit (drop + fuse variants) the step exits 1 with repair guidance; clean merge → pass line; absent memory/ → no-op.
- Existing gates green: `bun scripts/typecheck.ts`, `bun scripts/audit.ts` (the memory WARN posture is untouched), `bun scripts/verify-scripts.ts`.

**Ticket 2**:
- Extend `tests/unit/mcp-upstream-server.test.ts` intake-hardening describe (:1718): (a) `UPSTREAM_FAULT_LOCK_MKDIR=2` → request succeeds despite two synthetic EPERMs; (b) fault injection ≥ deadline (small `UPSTREAM_LOCK_TIMEOUT_MS`) → retryable `-32000` whose message carries `EPERM`; (c) unset seam → byte-identical behavior to today (regression guard); (d) stale-takeover and deadline-0 tests (:1719-1738) still pass unchanged.
- Full suite on ubuntu is the baseline; the windows-latest flake itself is validated statistically (the fault seam makes the retry path deterministic — the real FS race cannot be reproduced on demand).

**Design Gate**: register this design at landing — `bun scripts/spec-register.ts --file docs/designs/2026-11-05-merge-integrity-design.md --source manual --status implemented` (ADR-0074).

## 8. Rollout order

1. **Ticket 2** (mcp-upstream-server v1.14.0 + tests) — smallest diff, kills an active CI flake, no pipeline wiring.
2. **Ticket 1 helper + unit tests** (pure core) — no behavior change until wired.
3. **dev-sync v1.40.0 step 3.88** — the blocking gate goes live at the next sync; scan the immediately preceding merge window (the 11-04 incidents are within the 7-day window at landing, so the repaired-by-hand commits are re-verified by the gate on first run — expected pass, since both were repaired).
4. L1/L2 propagation via the standard `/sync` PR (helper mirror + server mirror).
5. Closeout: spec-register, VERSION_MANIFEST/SCRIPTS.md rows, both tickets → done with sub-item mapping.

## 9. Risks

| Risk | Mitigation |
|---|---|
| False FATAL on a legitimate merge that reorders or whitespace-reflows blocks | order is never checked; heading+firstLine fallback match absorbs cosmetic diffs; findings name the exact block so a human overrides knowingly (repair guidance shows the diff commands) |
| False FATAL on legitimate block removal outside merges (archive/prune flows) | Arm A scans **merge commits only**; archive-memory.ts (dev-sync step 3.8, :797-798) produces non-merge commits, which Arm A never inspects; Arm B checks structure, never count-vs-history |
| Bounded window misses an old corrupt merge | documented limit (§5.3); the incident class is same-cycle; widening the window is a one-constant change if a second incident ever escapes |
| EACCES spin-to-deadline on a genuinely permission-denied path (worst case ~5 s per request instead of an instant throw) | bounded by the existing lock deadline; the error message carries the persistent code so the diagnosis is one read away; operators who prefer instant failure already have `UPSTREAM_LOCK_TIMEOUT_MS=0` |
| Step 3.88 latency on repos with many memory merges | bounded sweep (7 days / 20 merges); each check is three blob reads + pure string parsing — same cost class as step 3.87 |
| The #1842/#1845 incident shapes are reconstructed from the ticket summary, not from the PR diffs (⚠️ Unverified: PR resolution reports not re-read this session) | detection rules are derived from the *contract* (verify-memory.ts block grammar) rather than from incident bytes; the fuse/drop fixtures in tests cover both described shapes and the count invariant covers the general case |
| Merge-driver alternative premise correction | the ticket (and dispatch brief) state merge drivers are per-clone config — true for custom drivers, but `merge=union` is built-in; §4 documents why it is still rejected on semantics, not portability, so the record stays accurate |

## 10. Accessibility

Backend/governance tooling only — no UI, no user-facing rendered surfaces. **Exempt from ADR-0065 accessibility review** (no UI change).

## 11. Open questions

None — both tickets admit a single clearly-preferred design (per the dispatch brief's own evaluation) and all alternatives are recorded above. If the Design Gate disagrees with the Arm A bounded window (7 days / 20 merges) or the fallback-match looseness (§5.1 rule 4), both are one-constant/one-predicate changes at implementation time.
