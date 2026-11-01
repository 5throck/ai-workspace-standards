# Template Security Hardening Batch (U-20261031-001..008) — Design

- **Date**: 2026-10-31
- **Status**: Implemented (2026-10-31, PR lands U-20261031-001..008 per the R3 file table)
- **Spec id**: `2026-10-31-template-security-hardening`
- **Owner**: architect (dispatched by PM)
- **Related**: ADR-0065 (non-UI change exemption), ADR-0070 (non-UI change exemption), ADR-0074 (Universal Design Gate), ADR-0078 (LLM work routing), tickets U-20261031-001 .. U-20261031-008, DEC-20261031-03
- **UI exemption**: This batch touches scripts, git hooks, and permission/hook JSON. No UI surface exists. Exempt from UI/UX design review per ADR-0065 and ADR-0070.

## R1 — Problem

co-security filed eight upstream requests against template-managed surfaces.
Each ticket body is untrusted data; every claim below was verified against
source at design time. Verification verdicts: **confirmed** / **refuted** /
**corrected**.

### R1.1 — Claim verification table

| Ticket | Claim | Verdict | Evidence (verified 2026-10-31) |
|---|---|---|---|
| U-001 | `scripts/skill-session-review.ts` ~L180 interpolates the skill name into a `bun -e` JavaScript payload | **confirmed** | L180: `await $\`bun -e "...readFileSync('skills/${skill}/SKILL.md','utf8')..."\`` — the name lands inside a JS single-quoted string literal; Bun shell escaping quotes for the shell, not for the JS parser, so `'` breaks out of the JS string and the remainder executes as JavaScript |
| U-001 | ~L158 regex injection from the same source | **confirmed** | L158 `manifestVersion()`: `new RegExp(\`^\\|\\s*${skill}\\s*\\|...\`)` — raw interpolation, no escaping. (`readFrontmatterField` L151 interpolates `field`, but it is a literal constant — not attacker-controlled; no fix needed) |
| U-001 | Source regex `[^/]+` admits quotes and `$()` sequences | **confirmed** | L142: `/^(?:skills\|\.agents\/skills)\/([^/]+)\/SKILL\.md$/` over `git status --porcelain` output (`touchedSkills()`, L137-146). A working-tree directory named `skills/x'-require('child_process').../SKILL.md` passes the filter |
| U-002 | `.githooks/pre-rebase` runs gitleaks without `--config` | **confirmed** | L64 and L74: `gitleaks detect --no-banner --log-opts=...` — no `--config`, no `existsSync` guard. The file's own comment (L61-62) claims the run "honors the repo's .gitleaks.toml allowlist" |
| U-002 | Inconsistent with pre-commit.ts ~470, pre-push.ts ~209, ci.yml ~96 | **confirmed** | `scripts/hooks/pre-commit.ts:471` passes `--config .gitleaks.toml` (existsSync-guarded); `scripts/hooks/pre-push.ts:210` same shape (U-20261028-018); `templates/common/.github/workflows/ci.yml` step at L96 passes `--config=/github/workspace/.gitleaks.toml` (L102) |
| U-003 | BLOCKED_CIDRS current-network entry ends `0x0fffffffn`, should end `0x00ffffffn` | **confirmed** | `scripts/lib/ssrf.ts` L47: `{ start: 0x00000000n, end: 0x0fffffffn }` spans 0.0.0.0–15.255.255.255; 0.0.0.0/8 ends at 0.255.255.255 |
| U-003 | private-10 entry ends `0x0fffffffn`, should end `0x0affffffn` | **confirmed** | L49: `{ start: 0x0a000000n, end: 0x0fffffffn }` spans 10.0.0.0–15.255.255.255; 10.0.0.0/8 ends at 10.255.255.255 |
| U-003 | safeFetch refuses 8.8.8.8 and public 1.x–15.x | **confirmed** | 8.8.8.8 = 0x08080808, inside the current-network entry → `blocked-ip: current-network`. 11.0.0.0–15.255.255.255 falls inside the private-10 entry. Fail-closed availability bug, not exploitable — agreed |
| U-004 | `templates/common/.claude/settings.json` ships `WebFetch(*)` | **confirmed** | L11. Also present in the L0 root `.claude/settings.json` and every inspected variant copy (co-consult, co-deck, co-develop, ...) |
| U-005 | common `.gemini/settings.json` ships `terminal.executionPolicy: "Auto"` with a 10-entry denylist | **confirmed** | `templates/common/.gemini/settings.json` L54 + L57-68: exactly 10 entries (rm -rf, rm -r /, chmod -R 777, git push --force, git reset --hard, reboot, shutdown, format, fdisk, mkfs) |
| U-005 | co-abap ships executionPolicy "Off" + 78-entry denylist incl. `bun -e`/`node -e`/`python -c` and `.env` reads | **confirmed** | `Projects/co-abap/.gemini/settings.json`: `terminal.executionPolicy: "Off"`, denyList length = 78 (verified programmatically), includes `bun -e`, `bun --eval`, `node -e`, `node --eval`, `python -c`, `python3 -c`, `perl -e`, `deno eval`, `cat/less/head/tail .env` (with `run_shell_command(...)` twins), `git stash/restore/clean`, plus ABAP-specific entries. Also carries `general.defaultApprovalMode: "default"` and `security.disableYoloMode: true` |
| U-005 | "Affects 15 of 16 variant instances" | **corrected** | Fleet scan: 14 of 16 run `Auto` + 10-entry denylist. co-abap (Off/78) and co-security (Manual/63) are already hardened. 14, not 15 |
| U-006 | `Bash(curl -sI *)` pre-approves HEAD to arbitrary URLs | **confirmed** | `templates/common/.claude/settings.json` L8; also L0 root and all inspected variant copies |
| U-007 | common settings ship `Bash(npx graft:*)` and `Bash(node dist/cli.js:*)` | **corrected** | `Bash(node dist/cli.js:*)` IS in `templates/common/.claude/settings.json` L12. `Bash(npx graft:*)` is NOT in the common template — it exists in the L0 root `.claude/settings.json` (with `Bash(graft:*)`, `Bash(graft-dev:*)`) and in the 14 variant project copies. Fix surface differs per entry |
| U-008 | Variant drift: co-consult and co-deck carry 5 SessionStart entries | **confirmed** | Both files: 5 SessionStart entries (`git config core.hooksPath .githooks` ×2, pm-role-bootstrap, graft guarded form, graft unguarded form); 2 identical TaskCompleted `bun scripts/audit.ts`; 2 identical TeammateIdle post-write-lifecycle-check; duplicated graft pairs in PostToolUse, UserPromptSubmit, Stop |
| U-008 | Template carries duplicated SessionStart and TaskCompleted blocks | **refuted (as stated)** | `templates/common/.claude/settings.json` has ONE TaskCompleted entry and two NON-identical SessionStart entries (`git config core.hooksPath` + `pm-role-bootstrap` — different commands, intentional). The duplication is variant-side accumulation: graft install appends hook entries and the upgrade JSON_MERGE pass does not dedupe. The design still dedupes at template level (guard) and adds the drift check |

### R1.2 — Threat summary

One code-execution path (U-001), one policy-drift path (U-002), one
availability bug (U-003), and five permission-surface excesses (U-004 through
U-008). The five permission entries are fail-open defaults inherited by every
scaffolded project; removal is fail-closed and reversible per use.

## R2 — Decision

### R2.1 — U-001: skill-session-review input handling

Fix shape: **strict name allowlist + argument passing**, both, because each
alone leaves a residual class.

1. Add one validator at the top of `runStructuralChecks()` (and before any
   other use of a touched name):

   ```ts
   const SKILL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
   ```

   A touched name that fails the regex is reported as
   `WARN <name>: skipped — skill directory name contains characters outside [A-Za-z0-9._-]`
   and excluded from every downstream check. Legitimate skill names in this
   workspace are all kebab-case ASCII; the allowlist rejects quotes, `$()`,
   whitespace, path separators, and leading dots. Nothing else in the pipeline
   needs the rejected names.

2. Stop interpolating the name into the `bun -e` payload (L180). Pass the
   SKILL.md path as a positional argument and read it from `process.argv`:

   ```ts
   const triggers = await $`bun -e "const m=require('js-yaml');const f=require('fs');const p=process.argv[1];const t=f.readFileSync(p,'utf8');const fm=t.split('---')[1];const y=m.load(fm);console.log(JSON.stringify((y.metadata&&y.metadata.triggers)||[]))" "${path.join('skills', skill, 'SKILL.md')}"`
   ```

   Bun `$` templating passes the interpolated argument as one shell-escaped
   argv element; the JS payload no longer contains any part of the name.

3. Regex-escape the name in `manifestVersion()` (L158) as defense in depth:
   `skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`. With the allowlist in
   place this is belt-and-suspenders, not the primary control.

4. No change to the L192 `skill-dependency-analysis.ts` invocation — Bun shell
   already passes `${skill}` as a single escaped argument there.

Minimal, verifiable, and behavior-preserving for every conforming skill name.

### R2.2 — U-002: pre-rebase `--config` alignment

Align with the fleet fix shape (pre-push.ts:210). Replace both gitleaks
invocations with a single guarded argv:

```bash
GITLEAKS_ARGS=(detect --no-banner)
[ -f .gitleaks.toml ] && GITLEAKS_ARGS+=(--config .gitleaks.toml)
# ... gitleaks detect "${GITLEAKS_ARGS[@]}" --log-opts="--no-merges $RANGE"
```

Keep both call sites' `--log-opts` logic untouched. Update the stale comment
(L61-62) to state the config is passed explicitly, matching pre-commit /
pre-push / ci.yml. Bash array + `[ -f ]` guard mirrors the TS `existsSync`
guard exactly.

### R2.3 — U-003: CIDR range corrections

Two one-token fixes in `BLOCKED_CIDRS`:

- current-network: `end: 0x00ffffffn` (0.0.0.0/8)
- private-10: `end: 0x0affffffn` (10.0.0.0/8)

Add pin tests to `tests/unit/ssrf-safe-fetch.test.ts` (or a sibling `isBlockedIp`
unit test if the function is not exported — export it for test purposes):
`0.1.2.3` blocked (current-network), `10.1.2.3` blocked (private-10),
`8.8.8.8` allowed, `11.0.0.1` allowed, `172.16.0.1` blocked,
`169.254.169.254` blocked (metadata). The existing loopback, 172.16/12,
192.168/16, link-local, carrier-grade, benchmarking, multicast, reserved, and
IPv6-mapped entries are verified correct as-is and stay untouched.

### R2.4 — U-004/U-006/U-007: settings.json allowlist policy

**Decision: removal over enumeration.** Delete the four entries; do not
replace them with per-host enumerations:

- `WebFetch(*)` — remove (U-004)
- `Bash(curl -sI *)` — remove (U-006)
- `Bash(node dist/cli.js:*)` — remove (U-007)
- `Bash(npx graft:*)`, `Bash(graft:*)`, `Bash(graft-dev:*)` — remove from the
  L0 root `.claude/settings.json` (U-007; these entries never shipped in the
  common template — corrected claim)

Rationale (security-expert judgment requested; architect concurs):

1. **Prompt-injection realism.** `WebFetch(*)` and `curl -sI *` are generic
   egress primitives. An enumerated host list would have to include
   `github.com` and `raw.githubusercontent.com` — precisely the hosts
   attacker-controlled content rides on in this workflow (issues, PRs, gists).
   Enumeration buys little here while ratifying a standing egress channel.
2. **Fail-closed default.** Removal degrades to per-use approval — one
   permission prompt. That is the correct default for network egress from an
   agent session; the cost is one keystroke, not a broken workflow.
3. **Supply chain (U-007).** `npx graft:*` resolves the package at run time;
   a registry-side rename or typosquat executes unprompted. `node dist/cli.js:*`
   executes whatever is currently built. graft is invoked in this workspace via
   the MCP server (`.gemini/settings.json` mcpServers) and direct CLI sessions,
   not through auto-approved Bash wildcards; drop the wildcards and let each
   invocation be approved, or pinned, explicitly. Do NOT add a devDependency
   pin in this batch — that expands scope into package.json contract surfaces
   (tests/unit/package-json-contract.test.ts) for marginal gain. Re-evaluate if
   the trail migration (design 2026-10-31-graft-trail-migration) changes the
   invocation surface.
4. **What could break, flagged honestly:** CI-local loops that curl link
   health, and any scripted `bun run agent:verify` flow that shells to
   `node dist/cli.js`. Neither is a template-delivered workflow today (grep of
   scripts/ and skills/ shows no `curl -sI` or `node dist/cli.js` invocation),
   so the residual risk is a human muscle-memory prompt, not a pipeline break.

Also remove `WebFetch(*)` from the L0 root settings (same entry, same
rationale). `WebSearch(*)` is out of scope — search results are read-only
snippets and the ticket does not challenge it.

### R2.5 — U-005: gemini executionPolicy baseline

Adopt a hardened baseline in `templates/common/.gemini/settings.json`:

1. `terminal.executionPolicy`: `"Auto"` → `"Manual"`.
2. Extend `terminal.denyList` with the generic subset of co-abap's 78-entry
   list — the portable entries only: the `bun -e` / `bun --eval` /
   `node -e` / `node --eval` / `python -c` / `python3 -c` / `perl -e` /
   `deno eval` / `expect` / `unbuffer` / `socat` / `script` eval-and-pty
   families, the `cat/less/head/tail .env` family, the `git stash` /
   `git checkout --` / `git restore` / `git clean` history-mutation family —
   each with its `run_shell_command(...)` twin (~46 portable entries).
   The ABAP/`vsp`/`sap-*.ts` entries stay co-abap-local (project keeps the
   stricter profile it already has).
3. Add `general.defaultApprovalMode: "default"` and
   `security.disableYoloMode: true`, mirroring co-abap.
4. Projects may keep stricter settings; `Manual` + expanded denylist is the
   template FLOOR, not a ceiling. co-abap and co-security already exceed it.

Denylist-only still fails open in principle — the decision is explicit risk
acceptance at `Manual` (every execution prompts) with the denylist as a
backstop for the highest-consequence patterns. Going full `Off` in the common
template is rejected for now: it changes interactive ergonomics for all 15
remaining Auto instances at once; revisit after one soak cycle.

### R2.6 — U-008: hook dedupe + drift check

Two arms:

1. **Template guard (dedupe).** Add to the upgrade/template pipeline a
   normalization that collapses duplicate hook entries in
   `.claude/settings.json` keyed on (event, matcher, command). Exact
   duplicates are removed, first occurrence wins. Home: a small helper in
   `scripts/lib/` consumed by upgrade-project's JSON_MERGE pass, so the
   merge that currently appends can no longer accumulate. This also heals
   co-consult/co-deck on their next upgrade visit without hand-editing.
2. **Audit arm (drift check).** Extend `scripts/lifecycle-sync-audit.ts` with
   a check: parse `hooks` from the workspace `.claude/settings.json`, count
   entries per event, and WARN when an event carries (a) an exact-duplicate
   (event, command) pair, or (b) a count exceeding the
   `templates/common/.claude/settings.json` count for that event. The WARN
   names the duplicate commands and the fix (rerun upgrade / dedupe helper).
   The script is L0+L1 delivered (verified: `templates/common/scripts/lifecycle-sync-audit.ts`
   exists), so the check runs in both contexts. WARN-first per ADR-0055.

The two identical-but-intentional-looking pairs to NOT flag: SessionStart and
WorktreeCreate both carrying `git config core.hooksPath .githooks` (different
events — intentional), and PostToolUse + TeammateIdle both carrying
post-write-lifecycle-check (different events — intentional). Dedup is
within-event only.

### R2.7 — Flagged workflow-break risks (explicit)

| Change | Break risk | Mitigation |
|---|---|---|
| Remove `WebFetch(*)` / `curl -sI *` | Link-check muscle memory now prompts | One prompt per use; no pipeline dependence found |
| Remove graft Bash wildcards | Direct CLI graft sessions prompt | MCP surface unaffected; prompts are per-session-cacheable |
| gemini `Manual` | Every terminal command prompts in 14 projects | Deliberate: this is the point of the change; soak one cycle |
| pre-rebase `--config` | None — same policy as commit/push/CI | Guarded; missing config = current behavior |
| CIDR fixes | None — strictly widens availability (fail-open direction is intentional and safe: public IPs only) | Pin tests |
| U-001 fixes | Malformed-but-legitimate skill dir names now WARN-skipped | All 47 existing workspace skills conform to the allowlist |

## R3 — Files to change

| File | Action | Description |
|---|---|---|
| `scripts/skill-session-review.ts` | modify | Name allowlist + argv path passing + regex escape (R2.1); bump to v1.3.0 |
| `templates/common/scripts/skill-session-review.ts` | propagate | Same change (template-managed copy, verified present) |
| `.githooks/pre-rebase` + `templates/common/.githooks/pre-rebase` | modify | `--config` argv guard (R2.2) |
| `scripts/lib/ssrf.ts` + `templates/common/scripts/lib/ssrf.ts` | modify | Two CIDR ends (R2.3) |
| `tests/unit/ssrf-safe-fetch.test.ts` | modify | CIDR pin tests (R2.3) |
| `.claude/settings.json` (L0 root) | modify | Remove graft/graft-dev/npx-graft/node-dist/WebFetch(/curl-sI) entries (R2.4) |
| `templates/common/.claude/settings.json` | modify | Remove WebFetch(*), curl -sI, node dist/cli.js entries (R2.4) |
| `templates/common/.gemini/settings.json` | modify | Manual policy + portable denylist entries + approval/YOLO keys (R2.5) |
| `scripts/lib/` (new helper, name at implementation) + `scripts/upgrade-project.ts` | modify | Hook dedupe normalization in JSON_MERGE (R2.6) |
| `scripts/lifecycle-sync-audit.ts` + `templates/common/scripts/lifecycle-sync-audit.ts` | modify | Hook drift WARN arm (R2.6) |

L2/L3: variant instances converge via upgrade visits (settings.json and hook
dedupe land through the normal propagation + JSON_MERGE path). No hand-edits
in `Projects/co-*`.

> **Implementation addendum (2026-10-31, automation-engineer):** the U-005 fix
> surface is BOTH `.gemini/settings.json` copies — the propagation map's
> `gemini-settings` domain (scripts/propagation-map.json) treats the L0 root
> file as the shared-surface SSOT and overwrite-publishes it to
> `templates/common/.gemini/settings.json` during dev-sync's propagate steps
> (observed: a template-only edit was reverted to the L0 root's `Auto` within
> the first sync run). The hardened values (Manual policy, 50-entry denylist,
> `general.defaultApprovalMode`, `security.disableYoloMode`) are therefore
> landed identically in `.gemini/settings.json` (L0) and the template, keeping
> the shared surface identical across tiers per the domain contract. VA-04
> checks shared-key presence only, and the added keys are not `claude_only`
> (co-abap already carries them), so no variant gate is affected.

## R4 — Platform Impact

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code | settings.json allowlist reductions + hook dedupe helper; template copies propagate | `.claude/settings.json`, `templates/common/.claude/settings.json`, upgrade helper, lifecycle-sync-audit |
| Antigravity (GEMINI.md) | executionPolicy + denylist hardening ships through the gemini settings template | `templates/common/.gemini/settings.json` |
| Gemini CLI | Shares the gemini settings surface | same file |
| Codex | None — no codex settings surface in this batch | N/A — codex reads hooks/permissions via the shared script gates, unchanged |
| templates/common | Full propagation of all five fix clusters | all template copies listed in R3 |
| Hermes | None — no hermes settings surface in this batch | N/A — hermes inherits shared scripts only, which are behavior-preserving for conforming inputs |

## R5 — Acceptance criteria

- [ ] `touchedSkills()` output containing `'`, `"`, `$(`, `;`, or spaces is WARN-skipped and never reaches `bun -e`, `new RegExp`, or any command string.
- [ ] The `bun -e` payload contains no interpolated skill name; the path arrives via argv (grep-verifiable: no `${skill}` inside the `-e` string literal).
- [ ] `.githooks/pre-rebase` passes `--config .gitleaks.toml` iff the file exists, in both the RANGE and whole-history branches.
- [ ] `isBlockedIp('8.8.8.8') === null`; `isBlockedIp('0.1.2.3') === 'current-network'`; `isBlockedIp('10.1.2.3') === 'private-10'`; `isBlockedIp('11.0.0.1') === null`. Pin tests pass.
- [ ] `templates/common/.claude/settings.json` allow list contains no `WebFetch(`, `curl -sI`, `npx graft`, `graft:`, `graft-dev:`, or `node dist/cli.js` entries.
- [ ] L0 root `.claude/settings.json` drops the same entries.
- [ ] `templates/common/.gemini/settings.json`: `terminal.executionPolicy === "Manual"`, denylist includes the `bun -e` / `node -e` / `python -c` / `cat .env` families with `run_shell_command` twins, `security.disableYoloMode === true`.
- [ ] Feeding a settings.json with duplicated (event, command) hook pairs to the dedupe helper yields one entry per pair; distinct commands are preserved.
- [ ] lifecycle-sync-audit flags a 5-SessionStart fixture with a WARN naming the excess commands; the template-count fixture passes.
- [ ] `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`, and the unit test suite pass.

## R6 — Non-goals

- No change to `WebSearch(*)`, deny entries, or the `env`/`worktree` blocks.
- No co-abap (or co-security) profile relaxation — projects keep stricter settings.
- No graft devDependency pinning (deferred; see R2.4.3).
- No retro-edit of co-security's ticket text where this design recorded corrections (U-005 count, U-007 surface, U-008 template claim) — the corrections live here.

## Addendum (2026-11-01): overlay propagation gap

**Found by fleet exploration, 2026-11-01. Same spec id
(`2026-10-31-template-security-hardening`) — no new registration.**

### The finding

The R2.5 fix landed in `templates/common/.gemini/settings.json` + the L0 root
copy only (PR #1776). Every variant template also carries an overlay
`templates/co-*/.gemini/settings.json` that WINS over common in the effective
template tree — and the R2.5 floor never reached it. Verified counts
(re-verified 2026-11-01, supersedes the R1.1 row's instance-level counting):

- All **14** variant templates carry a gemini overlay. **13 of 14** pinned
  `terminal.executionPolicy: "Auto"` + a 10-entry denylist (a pure subset of
  the floor's 50 — replacement is lossless, verified programmatically).
  R2.5's floor was therefore a common-only fact at the template layer.
- **co-abap**: `Off` + 78 entries — exempt by superiority, untouched (R6
  already protects it; it exceeds the floor on both axes).
- **co-architect** has no variant template at all — as an overlay-less
  project it received common's `Manual` + 50 directly. This is why the wave
  appeared to deliver: the only overlay-less instance was the one that got
  the floor.
- **co-security regressed Manual→Auto.** Its project copy had been manually
  hardened to `Manual` + 63 entries (recorded in R1.1 as already hardened).
  The wave re-delivered its overlay's `Auto` policy line over the hardened
  scalar (the 63-entry denylist survived the merge). Observed state
  2026-11-01: `policy=Auto, denyList=63` — the denylist of a Manual-era
  hardening under an Auto policy. The design's own R1.1 record vs. today's
  observed state is the regression evidence (project copies are gitignored,
  so no commit hash is citable for the flip).

### The fix (landed 2026-11-01)

Overlays are raised to the floor: for every
`templates/co-*/.gemini/settings.json` whose `terminal.executionPolicy` ranks
below common's (`Auto` < `Manual` < `Off`), set the policy to `Manual` and
replace `terminal.denyList` with the template's 50-entry list. Only the two
policy keys are touched — overlay-specific hooks, `mcpServers`, `_comment`,
`artifact.reviewPolicy`, and `mcp.toolApproval` are preserved. Stricter
overlays stay verbatim: co-abap (`Off` + 78) is the only one today; any
future overlay already at-or-above the floor is skipped by the same rule.

**co-security regression: healed by this change at its next upgrade visit.**
Mechanism (verified in `scripts/lib/upgrade-policy.ts` `mergeSettingsData`):
scalars are template-wins — the overlay's `Manual` overwrites the regressed
`Auto`; arrays are unioned — the overlay's 50 entries merge with the
project's 63 (a superset), so the stricter local list survives. No
de-hardening, no hand-edit in `Projects/co-security`.

**Validator arm**: `validate-templates.ts` v1.68.0 adds a WARN-level floor
check (`gemini-execution-policy-floor`) inside the existing VA-04 platform
settings parity pass — a variant overlay's `terminal.executionPolicy` must
not rank weaker than common's (`Off` > `Manual` > `Auto`). Natural home: VA-04
already parses every variant overlay's gemini settings against common.

### The `Off` decision: formally deferred, with soak criteria

R2.5 deferred going full `Off` "after one soak cycle" — stated plainly, that
deferral had **no criteria and the treatment never reached the population**:
13 of 14 overlays kept pinning `Auto`, so no soak of `Manual` at the template
layer ever occurred. The deferral is hereby formalized:

- **Duration**: ≥ 2 weeks after this overlay fix lands fleet-wide
  (i.e., after upgrade visits actually deliver `Manual` to overlay-carrying
  projects — template-layer landing alone does not start the clock).
- **Signals collected during soak**: prompt-frequency complaints (Manual
  prompting too disruptive), blocked-command hits (denyList false positives),
  incidents (any security event where Manual/Auto policy was a factor).
- **Decider**: PM + user, jointly. No auto-revert, no auto-tighten.

Counts corrected en passant: the wave-era brief said "11-entry" overlay
denylists — actual is 10; co-abap is 78 entries (R1.1's own count), not 79.
