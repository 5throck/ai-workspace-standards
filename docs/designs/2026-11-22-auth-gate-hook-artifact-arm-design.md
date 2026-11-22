# AUTH-GATE Arm of pm-dispatch-gate.ts — Artifact-Freshness Enforcement

- **Date**: 2026-11-22
- **Status**: designed (implementation follow-up dispatch)
- **Source**: U-20261122-006 (upstream request from co-security; follow-up B of `Projects/co-security/docs/designs/2026-11-22-authorization-gate-design.md` §5.3)
- **Tier**: L0 (`scripts/hooks/pm-dispatch-gate.ts` + `tests/unit/pm-dispatch-gate.test.ts`)

## Problem

The AUTH-GATE arm added to `scripts/hooks/pm-dispatch-gate.ts` (v1.2.0, lines 164-188)
is intended to block dispatches of rostered agents whose frontmatter declares
`required_skills: [..., verify-authorization]` unless a live authorization exists.
It fails at both halves of that intent:

1. **Wrong freshness signal.** The arm checks only `existsSync(docs/authorization.md)`.
   An authorization *record* is a historical document, not a verdict: the real
   co-security instance still has its `authorization.md` on disk while its engagement
   window ended 2026-09-30 (today: 2026-11-22). The existence check therefore passes
   and no block fires — exactly the case the arm exists to catch.
2. **Dead path resolution.** The arm resolves the agent file and the record as
   `join(STATE_DIR, "..", "agents", …)` / `join(STATE_DIR, "..", "docs", …)`.
   `STATE_DIR` defaults to `<os.tmpdir()>/ai-workspace-pm-gateway` (hook header,
   line 52), and no production wiring sets `PM_GATE_STATE_DIR` (verified: L0 and
   co-security `.claude/settings.json` / `.gemini/settings.json` invoke
   `bun scripts/hooks/pm-dispatch-gate.ts` with no env). Both paths therefore
   resolve inside the OS temp directory, `existsSync` is false, and the entire arm
   is silently skipped in production. The arm never ran.

Meanwhile the correct freshness signal now exists: co-security landed
`scripts/verify-authorization-gate.ts` (L3, 2026-11-22) with a machine-readable PASS
artifact whose contract is explicitly designed for this consumer. The hook arm must
consume that artifact.

## Evidence

- `scripts/hooks/pm-dispatch-gate.ts:164-188` — current arm: `STATE_DIR`-relative
  paths (lines 167, 172), `existsSync(docs/authorization.md)` only (line 178),
  `deny` with "run bun scripts/verify-authorization-gate.ts" remedy text (line 181).
- `scripts/hooks/pm-dispatch-gate.ts:50-52` — `WORKSPACE_ROOT` = `CLAUDE_PROJECT_DIR ?? fileURLToPath(new URL("../..", import.meta.url))`;
  `STATE_DIR` = `PM_GATE_STATE_DIR ?? tmpdir()`. The roster
  loader already uses the correct root: `join(WORKSPACE_ROOT, "agents")` (line 83).
- `Projects/co-security/scripts/verify-authorization-gate.ts` (v1.0.0) — the artifact
  contract this design consumes:
  - `ARTIFACT_SCHEMA_VERSION = 1` (:67), `ARTIFACT_NAME = "auth-gate-state.json"` (:68),
    `VERDICT_TTL_MS = 24h` (:70).
  - Placement `defaultArtifactPath()` (:1275-1288): `AUTH_GATE_STATE` env →
    `<git-dir>/auth-gate-state.json` (from `git rev-parse --show-toplevel` +
    `--git-dir`) → fallback `<os.tmpdir()>/ai-workspace-auth-gate/<sha256(resolve(REPO_ROOT))>.json`.
  - Schema (`GateArtifact` :223-231 + `finalizeArtifact` :967-990): `schemaVersion`,
    `project`, `mode`, `verdict` (`"PASS"` | `"BLOCKED"`), `checked_at` (ISO 8601),
    `record_hash`, `sources`, `window: {start, end, tz} | null`, `authorizing_party`,
    `registry_row`, `script_version`. Written atomically **only on PASS**; **deleted**
    on any BLOCKED verdict (revocation property, :983-989).
  - Verification semantics (`verifyArtifact` :998-1060): verdict PASS, `schemaVersion`
    supported, `checked_at` within 24h (future timestamp = forged clock = fail),
    `record_hash` equal to a fresh recomputation, and today ≤ `window.end` (TZ-aware).
  - Doctrine (design §3.2): *"The artifact is a cache of the most recent verdict,
    never a trust root."* `--verify-artifact` (the script) recomputes the full
    verdict; hash re-validation belongs to the script, not to a fast consumer.
- Agent frontmatter that matches the trigger (grep 2026-11-22): only
  `Projects/co-security/agents/red-team-lead.md:27`
  (`required_skills: [verify-authorization]`) and `pentester.md:27`
  (`required_skills: [finding-reconciliation, sarif-exporter, verify-authorization]`).
  No workspace-root agent carries `verify-authorization`, so the arm is inert at L0
  and in every project without offensive roles.
- Current expected verdict of the full gate on co-security today: BLOCKED (G-03 TODO
  markers, G-07 expired window) — so a compliant hook arm must block
  red-team-lead/pentester dispatches today.
- Delivery chain (see Landing requirements): the hook is registered and delivered;
  project copies lag at v1.1.1 until the next upgrade wave.

## Decision

Extend the AUTH-GATE arm of `evaluate()` in `scripts/hooks/pm-dispatch-gate.ts`
(bump to v1.3.0). Four changes, everything else byte-preserved:

### D1 — Artifact check replaces the record-existence check

When the dispatched agent's frontmatter matches `/required_skills:.*verify-authorization/`,
the hook resolves the gate artifact and demands a fresh PASS:

- **Resolution (spawn-free, mirrors the script's order):**
  1. `AUTH_GATE_STATE` env var when set and non-empty (test escape hatch, same
     semantics as the script).
  2. `<gitDir>/auth-gate-state.json` where `<gitDir>` is resolved WITHOUT spawning
     git: if `<WORKSPACE_ROOT>/.git` is a directory, use it; if it is a file
     (worktree/submodule), read its first line and use the path after `gitdir: `.
     This covers every normal and worktree checkout in this fleet.
  3. Fallback replicating the script's tmpdir arm exactly:
     `<tmpdir()>/ai-workspace-auth-gate/<sha256(resolve(WORKSPACE_ROOT))>.json`
     (`node:crypto` createHash, synchronous, no spawn). Both sides hash the same
     absolute repo root, so the keys agree.
- **Validity predicate (all must hold):**
  - file exists and parses as JSON (any read/parse failure = invalid);
  - `schemaVersion === 1`;
  - `verdict === "PASS"`;
  - `checked_at` parses as a timestamp, is not in the future, and is within
    24h of now (`Date.now()`);
  - when `window.end` is a present, date-shaped string: today (computed in
    `window.tz` via `Intl.DateTimeFormat("en-CA", { timeZone })`, UTC fallback)
    is ≤ `window.end`. Window bounds ride along cheaply in the artifact, so the
    hook checks them; anything absent/malformed in the window field degrades to
    "skip this sub-check" (the TTL still applies) — the hook never guesses.
- **Fail-closed deny** on every invalid outcome (absent, unreadable, malformed,
  wrong schema, non-PASS, future-dated, stale, window-expired). Decision verb is
  `deny` on BOTH platforms (unchanged from the current arm). An authorization
  gate must not offer a one-keypress bypass (`ask`) — "cannot verify" is never
  "authorized"; on Gemini, `deny` returns the reason to the calling agent (the
  PM), which is the correct remediation channel.
- **Reason text** (actionable, states what was wrong and the fix), one line:
  `[AUTH-GATE] "<specialist>" requires verify-authorization but no fresh gate
  artifact exists (<why>: absent | expired <age>h | verdict <v> | window ended
  <end> | malformed). Run bun scripts/verify-authorization-gate.ts, then retry.`
- **Hash re-validation stays OUT of the hook** (per the ticket and the
  cache-not-trust-root doctrine): the hook checks freshness + verdict + window
  only. `record_hash` comparison requires re-parsing the authorization sources —
  that is `--verify-artifact`'s job in the L3 script. Honest residual: a
  hand-forged artifact that carries a fresh `checked_at` and a PASS verdict passes
  the hook; the artifact lives inside `<git-dir>` (machine-local, untracked) and
  the PM workflow plus `--verify-artifact` remain the trust anchors. Recorded in
  the header comment and in this design's Out-of-scope.

### D2 — Path resolution fixed to WORKSPACE_ROOT

The agent file is read from `join(WORKSPACE_ROOT, "agents", "<specialist>.md")` —
the same root the roster loader (line 83) already uses. `STATE_DIR` remains
session-marker territory only. This alone revives the currently-dead arm.

### D3 — Coverage: the arm applies to marker-passed sessions too (deliberate semantic change, flagged)

Today the marker fast-path returns `null` (allow) before the AUTH-GATE arm runs, so
the arm can only ever fire for sessions that are *already* being blocked by the
PM-gate — and never for the booted PM sessions that are the actual enforcement
target. The L3 design's follow-up B is explicit: *"after the PM-identity check
passes, consult the auth gate for offensive-role dispatches."* This design
therefore restructures `evaluate()` to:

1. resolve specialist + roster (unchanged);
2. read + slide the marker (unchanged TTL/sliding/refresh logic and verbs);
3. **always** run the auth-gate consult for frontmatter-matching agents (marker
   present or not); on invalid artifact → `deny` (D1);
4. otherwise: marker present → allow (`return null`, unchanged); marker absent →
   the existing PM-gate `ask`/`deny` decision (unchanged).

Marker semantics (TTL value, sliding refresh, atomic rewrite, fail-open on
refresh) are untouched; the only behavioral delta is that a fresh-marker session
dispatching `red-team-lead`/`pentester` without a fresh PASS artifact is now
denied — which is the point of the arm. Non-matching agents and non-security
projects are unaffected (frontmatter predicate never matches there).

### D4 — Failure postures preserved

- Unreadable/unparseable agent file → fail-open, skip the arm (unchanged;
  the session still faces the marker check and the ticket's constraint).
- Unexpected payloads / no specialist name / agent not on roster → unchanged
  (fail-open or PM-gate decision as today).
- The hook remains synchronous and fast: no child process is spawned anywhere in
  the new arm (fs reads + JSON.parse + `Date` math + `Intl` format + one
  `createHash` in the fallback arm only).

## Alternatives considered

| Option | Verdict | Why |
|---|---|---|
| (chosen) Hook reads the artifact cache, script keeps recompute/hash | adopted | Matches the artifact's designed consumer split; synchronous, fast, no spawn in PreToolUse |
| Hook spawns `git rev-parse --git-dir` for path resolution | rejected | Script spawn in the PreToolUse hot path is explicitly out; `.git` dir-or-file parse covers the fleet |
| Hook spawns `verify-authorization-gate.ts --verify-artifact` | rejected | Full recompute (hashing sources) per dispatch; latency + process churn in the hook; duplicates `--verify-artifact` |
| Hook re-validates `record_hash` itself | rejected | Violates the cache-not-trust-root doctrine; pulls record parsing into L0 |
| Keep the check on `docs/authorization.md` + parse window from the record | rejected | Re-implements G-07 in a second place (drift risk); the record is prose markdown, the artifact is the machine contract |
| `ask` instead of `deny` on Claude | rejected | An authorization gate must not be user-wavable; fail-closed posture is the L3 script's own doctrine |
| Leave the arm post-marker-return (only unbooted sessions checked) | rejected | Contradicts follow-up B; the arm would still never constrain real PM sessions |

## Acceptance criteria

Unit tests extend `tests/unit/pm-dispatch-gate.test.ts` (fixture tree: temp dir
with `agents/pentester.md` frontmatter fixture + `.git/auth-gate-state.json`,
`CLAUDE_PROJECT_DIR` pointed at the fixture root; `PM_GATE_STATE_DIR` /
`AUTH_GATE_STATE` for state isolation):

- [ ] Fresh PASS artifact (checked_at now, verdict PASS, schemaVersion 1, future
      window end) → dispatch allowed (no decision object).
- [ ] Absent artifact → `deny`, reason contains `[AUTH-GATE]`, the specialist
      name, and "Run bun scripts/verify-authorization-gate.ts".
- [ ] Stale artifact (`checked_at` 25h old) → deny with "expired" wording.
- [ ] Future `checked_at` → deny (forged clock).
- [ ] `verdict: "BLOCKED"` artifact → deny (a BLOCKED verdict deletes the artifact
      in practice; the predicate is defense-in-depth).
- [ ] Malformed JSON / wrong `schemaVersion` / missing `checked_at` → deny.
- [ ] `window.end` in the past (tz-aware: `Asia/Seoul` boundary fixture) → deny
      with "window ended"; missing/malformed window field with fresh PASS → allow
      (TTL still enforced).
- [ ] Resolution arms: `AUTH_GATE_STATE` override honored; `.git`-as-directory and
      `.git`-as-file (`gitdir:` pointer) both found; no `.git` → tmpdir-hash
      fallback path resolved (same key as the script's formula).
- [ ] Marker-passed session dispatching a `verify-authorization` agent with no
      artifact → denied (D3 coverage); same dispatch for a non-matching agent →
      allowed via marker (marker flow unchanged: TTL/sliding refresh assertions
      from existing tests still pass untouched).
- [ ] Unreadable agent file → fail-open (no auth-gate deny), marker-less session
      still gets the PM-gate decision.
- [ ] Hook stays spawn-free in the arm (no `spawnSync`/`$` in the new code path).
- [ ] L0 end-to-end sanity: with the workspace root's real `agents/`, no root
      agent matches the frontmatter regex → `evaluate()` behavior identical to
      today for all root dispatches.

## Landing requirements

1. `scripts/hooks/pm-dispatch-gate.ts` → `// @version 1.3.0` with a header note
   (U-20261122-006: artifact freshness arm; record-existence check removed; paths
   rooted at WORKSPACE_ROOT; auth consult covers marker-passed sessions).
2. `tests/unit/pm-dispatch-gate.test.ts` — new blocks above; existing marker tests
   unchanged and green.
3. SCRIPTS.md rows: update the `hooks/pm-dispatch-gate.ts` row version (L0:
   `scripts/SCRIPTS.md:221`) **and** the L1 mirror
   (`templates/common/scripts/SCRIPTS.md:142`) with a v1.3.0 note citing this
   design and U-20261122-006. Delivery is fail-closed on missing/stale registry
   rows, so both rows must move together.
4. **Delivery-contract finding (explicit answer to the ticket's question):** the
   hook IS in the delivery chain — no new registration is needed. Chain:
   `scripts/hooks/` (L0 canonical) → `templates/common/scripts/hooks/` (L1
   delivery source; today byte-identical to L0) → project `scripts/hooks/` via
   `scripts/upgrade-project.ts`'s registry-aware, fully recursive
   `SYNC_IF_NEWER: scripts/` pass (version-gated on the SCRIPTS.md rows;
   unregistered scripts are skipped fail-closed — `pm-dispatch-gate.ts` is
   registered in both L0 and common SCRIPTS.md). The `.claude`/`.gemini` settings
   wiring that invokes the hook already exists at L0 and in projects and is
   untouched. **Propagation consequence:** project copies do NOT auto-move on this
   L0 landing — co-security still runs v1.1.1 today (L0/common are v1.2.0) and
   will pick up v1.3.0 only on its next `upgrade-project` wave; the
   `hub-bootstrap` hook-integrity drill (lib/hook-integrity.ts) will keep flagging
   stale clones byte-exactly until then, which is the intended surfacing. The
   implementer should note in the PR that co-security's copy becomes effective
   after its next upgrade run (or a follow-up dispatch runs the upgrade).
5. Template mirror: the v1.3.0 source must land in
   `templates/common/scripts/hooks/pm-dispatch-gate.ts` in the same PR (the L0→L1
   publish via `propagate-to-templates.ts --apply`, then `verify-scripts.ts
   --check-drift` green).
6. Spec activity: create this design doc, then register it before /sync:
   `bun scripts/spec-register.ts --file docs/designs/2026-11-22-auth-gate-hook-artifact-arm-design.md --source manual --status implemented`
7. CHANGELOG `[Unreleased]` entry (workspace root) describing the arm, the D3
   coverage change, and the co-security pickup path.
8. Upstream courtesy: reply on U-20261122-006 noting the artifact field is
   `checked_at` (the ticket text said `generated_at` — no field of that name
   exists in the landed schema).

## Out-of-scope

- Any change to `Projects/co-security/scripts/verify-authorization-gate.ts`
  (L3-owned; its artifact contract is consumed as-is, schema v1).
- Hash re-validation, document parsing, TODO-marker checks, registry-mode checks
  in the hook — the L3 script owns recompute; the hook consumes the cache.
- PM-gate marker flow: TTL value, sliding refresh, decision verbs for non-auth
  agents, fail-open posture on marker/state errors.
- Settings (`settings.json`) changes — wiring already points at the hook.
- Closing co-security's G-03 TODO markers or renewing the engagement window —
  user-owned record actions; until then the arm correctly blocks.
- Multi-line YAML `required_skills` arrays in agent frontmatter (the single-line
  regex is the existing pattern; documented residual, KISS).
