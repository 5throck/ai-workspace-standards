# dev-sync Skill-Graph Pre-Convergence (Step 3.89) + Step 3.9 Failing-Sub-Check Hint

- **Date**: 2026-11-22
- **Status**: designed (implementation follow-up dispatch)
- **Source**: T-20261122-004 (delegation) / U-20261122-010 (upstream request)
- **Tier**: L0 (`scripts/dev-sync.ts` + its tests; `audit.ts` is NOT modified)

## Problem

dev-sync step 3.9 runs `bun scripts/audit.ts --spec-check --lifecycle-only`
(dev-sync.ts:1550). audit.ts auto-activates the skill-graph drift gate on every
invocation (audit.ts:4197-4219): when `scripts/verify-skill-graph.ts` exists, it
re-derives the graph from the agents/skills/procedures SSOTs and fails the audit
when the committed `docs/skill-graph.json` is stale. But `docs/skill-graph.json`
is a derived projection that the pipeline regenerates only at **step 4.65** —
AFTER the blocking 3.9 gate. So any sync that edits skills/agents (whose whole
point is usually spec-registered design activity) hits a false-positive blocking
failure at 3.9 and needs a manual `bun scripts/generate-skill-graph.ts` +
re-run dance.

This is an ordering gap of exactly the class already solved twice:

- **Step 3.85** (VERSION_MANIFEST pre-convergence, T-20260926-021,
  dev-sync.ts:1379-1397): pre-regenerates the manifest before 3.9 because
  audit.ts auto-activates the VERSION_MANIFEST gate on every invocation.
  Contract: pre-generation failure = **WARN that names the step** and lets 3.9
  catch residual drift; step 4.7 remains the final convergence pass.
- **Step 3.86** (declared-generator pre-convergence, U-20261029-004,
  dev-sync.ts:1399-1423): same regeneration-before-audit family; outputs staged
  via array-form `git add`.

VERSION_MANIFEST (3.85) and scripts/README.md (2.5) are pre-converged; the
skill-graph projection is not. Additionally, when 3.9 DOES legitimately fail, the
dev-sync error block (dev-sync.ts:1639-1646) prints static boilerplate — "The
diff touches code (scripts/templates/agents) with no relevant spec activity" —
even when the actual failing sub-check is something else entirely (in practice,
skill-graph drift), sending the operator down the wrong remediation path
(--spec-exempt or a spec edit) when the right one is "run generate-skill-graph.ts".

## Evidence

- **Step numbering — 3.87 is TAKEN.** The task brief suggested "step 3.87", but
  the 3.x band already has: 3.85 VERSION_MANIFEST pre-convergence (:1379), 3.86
  declared-generator pre-convergence (:1399), **3.87 ticket-store memory-drift
  check, BLOCKING, v1.39.0** (:1425-1461), **3.88 memory session-block
  union-verify, BLOCKING, v1.40.0/1.41.0** (:1463ff). This design uses **3.89**
  — the free slot directly before 3.9, preserving the "cheap gates in the 3.x
  band, pre-convergence immediately precedes the audit" ordering logic.
- **Step 3.9** (dev-sync.ts:1541-1660): single first invocation (:1550)
  `.nothrow()` WITHOUT `.quiet()` — output streams through (visible), per the
  intentional-visibility idiom shared with step 3.7 (:1350-1353). The static
  boilerplate block at :1639-1646. Two retry invocations (auto-E5 :1598, early
  publish heal :1622) reuse the same command.
- **audit.ts output surface (the parsing contract for the hint):**
  - `Fail(msg)` (:481-484) prints to **stderr** as `${RED}[FAIL] ${msg}${RESET}`
    with UNCONDITIONAL ANSI constants (:463-467 — no TTY detection), and
    increments the global error counter; `errors > 0` ⇒ exit 1 (:4383-4391).
  - `Pass()` → stdout `[PASS] …`; `Warn()` → stdout `[WARN] …`.
  - The skill-graph drift gate (:4206-4219) spawns `bun scripts/verify-skill-graph.ts`
    and on failure echoes the child's output, then
    `Fail("Skill-graph drift detected: docs/skill-graph.json is stale — run bun scripts/generate-skill-graph.ts, review, and commit")`.
  - The spec-relevance sub-check fails as
    `Fail("Spec check: N code file(s) changed but no recent/relevant spec activity (diff doesn't touch docs/specs|docs/designs, and no approved/implemented spec updated within Nd) — consider running the brainstorming skill or spec-register.ts")` (:~4027).
  - Stable parse surface: **stderr lines, ANSI-stripped, prefix `[FAIL] `**.
- **generate-skill-graph.ts invocation contract** (v2.0.1): bare
  `bun scripts/generate-skill-graph.ts` regenerates the **context-local**
  `docs/skill-graph.json` (run-context auto-detection: root graph at L0, the
  project's own graph in an L2/L3 project); `--scope <common|co-*>` regenerates
  `templates/<scope>/docs/skill-graph.json` (workspace root only). Exit 0 on
  success.
- **Step 4.65** (dev-sync.ts:2100-2160): guarded by
  `fs.existsSync("scripts/generate-skill-graph.ts")`; bare generate + verify,
  then the scope loop (`common` + every `templates/co-*`) with per-scope
  generate+verify — **all AFTER 3.9** (and after step 4.x publish steps). This is
  the ordering gap; 4.65 stays as the final convergence pass (same role as 4.7
  for the manifest).
- **verify-skill-graph.ts** (v2.0.0) compares the **on-disk working-tree**
  `docs/skill-graph.json` against a fresh derivation (readFileSync, not
  `git show`), so a regenerated-but-unstaged file already satisfies the audit
  gate; staging (below) is for commit hygiene, not for the gate.

## Decision

Two changes in `scripts/dev-sync.ts` only. No audit.ts change; no generator or
verifier change; no gate weakened.

### D1 — New step 3.89: skill-graph pre-convergence (3.85 contract, verbatim)

Inserted between the step 3.88 block and step 3.9, following the 3.85 idiom:

```ts
// 3.89 Skill-graph pre-convergence (T-20261122-004 / U-20261122-010, this design)
// audit.ts auto-activates the skill-graph drift gate on EVERY invocation —
// including Step 3.9's `--spec-check --lifecycle-only` call — and that gate
// failed BLOCKING before Step 4.65 could regenerate docs/skill-graph.json
// whenever this sync edited skills/agents. Pre-regenerate here so 3.9's audit
// compares against a fresh projection. Step 4.65 stays as the final convergence
// pass — same inputs, so the second run is a no-op.
const preGenGraphTs = path.join("scripts", "generate-skill-graph.ts");
if (fs.existsSync(preGenGraphTs)) {
  const preGraphRes = await $`bun ${preGenGraphTs}`.quiet().nothrow();
  if (preGraphRes.exitCode !== 0) {
    console.warn(
      `⚠️  Step 3.89: skill-graph pre-regeneration failed (exit ${preGraphRes.exitCode}) — Step 3.9 will re-check`,
    );
  } else {
    // Stage the refreshed projection (3.86 idiom: array-form git add, cwd pinned).
    const addRes = await $`git add docs/skill-graph.json`.quiet().nothrow();
    if (addRes.exitCode !== 0) {
      console.warn(`⚠️  Step 3.89: staging docs/skill-graph.json failed (exit ${addRes.exitCode}) — Step 3.9 will re-check`);
    } else {
      console.log("📋 Step 3.89: skill-graph pre-converged for the 3.9 audit");
    }
  }
}
```

Behavioral contract, deliberately identical in shape to 3.85:

- **Guarded presence**: absent generator (fresh scaffold, non-graph contexts) =
  documented no-op — the same guard expression as step 4.65, so the two steps can
  never disagree about applicability.
- **Failure = WARN naming the step**, non-blocking; residual drift is caught by
  3.9's audit exactly as today (3.85's exact failure philosophy: the audit is the
  gate, pre-convergence is a courtesy). A staging (`git add`) failure is the same
  WARN arm — the on-disk file is already fresh, so the audit gate still passes;
  only commit hygiene is degraded, and dev-sync's own commit steps would surface
  an unstaged projection.
- **Bare invocation only** — the scope loop (`--scope common|co-*`) is NOT
  duplicated here. The audit's drift gate calls `verify-skill-graph.ts` without
  `--scope`, i.e. it checks only the context-local graph; scope artifacts remain
  4.65's job. Running the loop in 3.89 would double the pipeline's heaviest
  generation work and change more behavior than the ticket allows.
- Contexts covered: at the workspace root this refreshes the L0
  `docs/skill-graph.json`; in a delivered project the same bare call refreshes
  the project's own graph (closing the project-side gap with the same step).

### D2 — Step 3.9 failing-sub-check hint (parse the audit output, quote reality)

Replace the static boilerplate at :1639-1646 with the audit's actual FAIL lines:

1. **Capture without losing visibility.** The first audit invocation
   (:1550-1552) switches to `.quiet().nothrow()`; immediately after the await,
   echo the captured streams verbatim (`process.stdout.write(specRes.stdout)`,
   `process.stderr.write(specRes.stderr)`) so the visible output is unchanged —
   audit's PASS/WARN/FAIL lines still scroll by exactly as before. The two retry
   invocations (auto-E5, early-publish heal) keep their current form: only the
   first call's output needs parsing, and their outcomes are already logged.
2. **Parsing surface (stable, from audit.ts internals — not a new contract):**
   split `specRes.stderr` on newlines, strip ANSI
   (`/\x1b\[[0-9;]*m/g` — audit's colors are unconditional constants), match
   `/^\[FAIL\] (.+)$/, and take capture group 1 as the failing sub-check message.
   (stdout's `[PASS]`/`[WARN]` lines are not failures; stderr is the FAIL channel
   by audit's construction.)
3. **Sub-check name extraction**: from each FAIL message, the display name is the
   text before the first `" — "` or `": "` separator
   (`Skill-graph drift detected` ← "Skill-graph drift detected: docs/… is stale — run …";
   `Spec check` ← "Spec check: 3 code file(s) changed but no recent/relevant spec
   activity (…) — consider …"). This is presentation only — the full message is
   printed alongside, so a separator drift in audit.ts can only cosmeticize the
   name, never lose information.
4. **New error block** (replacing :1640-1645):

   ```
   ✗ Step 3.9: spec-check FAILED (exit N) — failing sub-check(s):
       - Skill-graph drift detected
           docs/skill-graph.json is stale — run bun scripts/generate-skill-graph.ts, review, and commit
       - Spec check
           3 code file(s) changed but no recent/relevant spec activity (…) — consider …
   Fix lines (unchanged from today): update docs/specs/ … or legitimize with
   --spec-exempt=E1..E5 …
   ```

   i.e. name + indented full message per FAIL line (cap at 10, `… +N more`
   beyond), followed by the existing two Fix lines **kept as-is** (they remain
   correct guidance for the relevance sub-check; the skill-graph FAIL's own
   message now carries the targeted `generate-skill-graph.ts` remedy).
5. **No behavior change beyond text + pre-convergence**: exit codes, blocking
   semantics, auto-E5, early-publish heal, and the no-registry INACTIVE branch
   (:1651-1660) are untouched.

## Alternatives considered

| Option | Verdict | Why |
|---|---|---|
| (chosen) Pre-convergence step 3.89 with 3.85's WARN contract | adopted | Proven in-tree pattern for exactly this failure mode (audit auto-gates on derived projections); zero gate weakening; failure posture already battle-tested |
| Run step 4.65 (or the scope loop) before 3.9 | rejected | Moves the heaviest generation ahead of the cheap gates and reorders the publish/audit sequence; the scope loop runs 2×(1+N) child processes that 3.9 does not need; 4.65's post-publish position also lets it converge what the publish steps changed |
| Weaken the audit's skill-graph gate in `--spec-check --lifecycle-only` mode | rejected | Touches audit.ts, weakens a real gate, and contradicts "pre-converge, never pre-excuse" |
| Parse audit's JSON (add a `--json` mode to audit) | rejected | New audit.ts surface (L1-protected core script) for a presentation fix; stderr `[FAIL] ` prefix is already stable |
| Keep static boilerplate, only add "or skill-graph drift" | rejected | Guessing at causes is what produced the wrong-remedy bug; quoting the actual FAIL lines fixes every current and future sub-check at once |

## Acceptance criteria

Unit tests extend the existing dev-sync test family
(`tests/unit/dev-sync-pipeline-order.test.ts` and a focused new block for the
parser helper — the helper is exported for testability, house style):

- [ ] **Order**: step 3.89 executes after 3.88 and before the first 3.9 audit
      invocation (pipeline-order assertion updated).
- [ ] **No-op**: a tree without `scripts/generate-skill-graph.ts` prints nothing
      for 3.89 and changes no exit codes (fresh-scaffold safety, mirrors 3.85).
- [ ] **Fresh projection**: with the generator present, a stale
      `docs/skill-graph.json` is regenerated and staged before 3.9's audit runs;
      3.9 passes without the manual regenerate dance (the original incident).
- [ ] **Generator failure = WARN**: a failing generator (injected failure)
      produces the exact `⚠️  Step 3.89: skill-graph pre-regeneration failed (exit N) — Step 3.9 will re-check` line, dev-sync does NOT abort at 3.89, and a
      residual drift still blocks at 3.9 (3.85 contract parity).
- [ ] **Hint**: an audit run failing ONLY on skill-graph drift yields the 3.9
      error block listing `Skill-graph drift detected` with the
      `generate-skill-graph.ts` remedy message — and NOT the misleading
      "no relevant spec activity" framing as the sole diagnosis.
- [ ] **Hint parsing**: ANSI-wrapped stderr lines (`\x1b[31m[FAIL] …\x1b[0m`)
      parse correctly; multiple FAIL lines each appear; >10 FAILs cap with a
      `+N more` line; no FAIL lines (nonzero exit from another cause) fall back
      to the current generic block without crashing.
- [ ] **Visibility preserved**: captured audit output is echoed verbatim, so the
      on-terminal text of a passing 3.9 is byte-identical to today's.
- [ ] The two retry audit invocations and the no-registry branch are unchanged
      (assertions pin them).

## Landing requirements

1. `scripts/dev-sync.ts` → `// @version 1.53.0` with the v1.53.0 note (step 3.89
   + 3.9 hint; cite this design, T-20261122-004 / U-20261122-010).
2. **Core-script standardization**: dev-sync.ts is an L1-protected core script —
   the change lands at L0 ONLY and must remain byte-identical across
   `templates/common/scripts/dev-sync.ts` (the pipeline's own parity checks —
   step 3.7 drift check, `CORE_LOCKED_SCRIPTS` fork detection in
   upgrade-project — enforce this). In-PR: run
   `bun scripts/propagate-to-templates.ts --apply` and confirm
   `bun scripts/verify-scripts.ts --check-drift` green. **audit.ts is NOT
   modified** — the parse surface (`[FAIL] ` prefix on stderr, unconditional
   ANSI) is consumed as-is; if audit.ts ever changes its FAIL shape, only the
   dev-sync parser needs a follow-up.
3. Registry + manifest (part of the landing, NOT done by this design):
   update the `dev-sync.ts` row in `scripts/SCRIPTS.md` (currently
   `| dev-sync.ts | L0 | 1.52.1 | …` at :110) to 1.53.0 with the version note;
   regenerate `docs/VERSION_MANIFEST.md` (the landing sync's step 3.85/4.7 does
   this automatically once the row is bumped — verify it in the PR).
4. Tests: the blocks above (extend
   `tests/unit/dev-sync-pipeline-order.test.ts`; new parser-helper blocks in the
   same file or a sibling `dev-sync-spec-check-hint.test.ts`).
5. Spec activity: register this design before /sync:
   `bun scripts/spec-register.ts --file docs/designs/2026-11-22-dev-sync-skill-graph-preconvergence-design.md --source manual --status implemented`
6. CHANGELOG `[Unreleased]` entry (workspace root).
7. Upstream courtesy on U-20261122-010: note the step-number correction (3.87
   was taken; landed as 3.89) and that `audit.ts` required no change.

## Out-of-scope

- Any edit to `scripts/audit.ts`, `scripts/generate-skill-graph.ts`,
  `scripts/verify-skill-graph.ts` (the drift gate, generator, and verifier
  contracts are consumed as-is).
- Pre-converging the per-scope graphs (`templates/<scope>/docs/skill-graph.json`)
  before 3.9 — the audit's drift gate does not check scopes; 4.65 remains their
  convergence point.
- Changing step 3.9's blocking semantics, auto-E5, early-publish heal, or the
  E1–E5 exemption flow.
- Making the hint a structured machine-readable report (JSON) — presentation fix
  only, per the ticket constraint "no behavioral change beyond pre-convergence +
  hint text".
