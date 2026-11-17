---
lang: ko
lang_reason: source-material
---

# Design: Sync-Embedded Detection — Opt-In Backport Candidates and Ticket Filing in Project /sync

- **Spec id**: `2026-11-17-sync-auto-detection`
- **Date**: 2026-11-17
- **Author**: Template Architect (Design Gate, ADR-0074; PM Row 0)
- **Decision record**: DEC-20261117-06
- **Source**: user-approved feature decisions 2026-11-17 (verbatim constraints in §3; the opt-in refinement "해당 기능은 항상 작동하는게 아니라 설정 시에만 작동할 수 있도록" is binding — the gate is OFF by default and absent-config means off)
- **Related**: ADR-0031 (fork model — promotion stays human-judged), ADR-0073 (delivery model — delivered scripts + `lib/` leaf modules), ADR-0105 (billing-wall merge predicate SSOT), ADR-0097 (upstream MCP surfaces), ADR-0103 (delegation tickets stay narrow), 2026-10-01-upstream-request-mcp-design (§4, §8, §9, §12), 2026-10-07-daily-fleet-learning-extraction-design (Steps 2d/2e semantics), 2026-10-31-graft-trail-migration-design (retired-token precedent), pm-gateway-workflow §3.12 (triage)

---

## 1. Problem

Per-project detection of backport-worthy work and template-layer defects exists only in
the **manual fleet cycle** (`.agents/skills/project-resync/SKILL.md` v1.8.0, Steps
2/2b/2c/2d/2e), which requires a workspace-side PM session. A project's own `/sync`
does none of it: when a project session fixes a delivered file, migrates an
identifier, or authors a genuinely reusable asset, the signal reaches the template
layer only if the nightly/weekly cycle happens to visit. The upstream-request MCP
gives projects a filing channel, but nothing in the project flow *prompts* the
filing — discovery depends on agent memory.

**Known (worked example, 2026-11-17)**: co-game/co-hr migrated `.agents/mcp.json` to
trail; `templates/common/.agents/mcp.json` still carries graft-era config. The
workspace caught it only because the project-resync Step-1 provenance audit noticed
uncommitted project copies equaling the (stale) template source; PM filed
`tickets/governance/T-20261117-007.yaml`. A project-side detector watching the
project's own migration markers would have produced the same ticket at /sync time,
hours earlier, without a PM session.

## 2. Goals / Non-Goals

**Goals**

1. G-1. When (and only when) a project enables the feature, its `/sync` flow
   detects (a) backport-worthy deltas and (b) ticket-filing targets, and files
   tickets automatically through the existing upstream-request MCP.
2. G-2. Default `/sync` behavior is byte-identical to today when the gate is off
   (`scripts/dev-sync.ts` is not modified at all).
3. G-3. PRs created by the flow auto-merge when checks are green or the ADR-0105
   billing-block failure pattern holds; close-out merges the project's own open
   PRs meeting the same predicate. Real failures never auto-merge.
4. G-4. Promotion into `templates/` stays human-judged (ADR-0031; user directive
   2026-10-07). The flow only files — it never writes outside its own repo.

**Non-Goals**

- No change to `scripts/dev-sync.ts` / `audit.ts` (core-standardized pair).
- No new MCP tool and no upstream server schema change.
- No automated promotion, no sibling sync, no workspace-store writes from projects
  (delegation tickets stay the narrow ADR-0103 exception).
- No replacement of project-resync Steps 2/2b/2d/2e — the manual cycle remains the
  deep, judgment-heavy path; this feature moves only per-project *first-pass
  detection* into the project's own sync.

## 3. Binding user decisions (verbatim intent)

1. **OPT-IN ONLY**: detection runs only when the project enables it (explicit flag
   or config setting; exact mechanism is this design's to fix). Gate off → zero
   new behavior.
2. **티켓만 자동**: filing is automatic when enabled; promotion into `templates/`
   remains human-judged (ADR-0031; user directive 2026-10-07).
3. **자동 머지 포함**: PRs the flow creates auto-merge when checks are green OR the
   documented billing-block failure pattern matches (instant 3–5s, zero steps,
   "payments have failed or spending limit" annotation — standing disposition on
   private repos). Real failures never auto-merge.
4. **Close-out**: when enabled, the flow merges the project's open PRs after
   landing ("열린 PR들을 모두 반영").

## 4. Worked example the design must reproduce

`T-20261117-007` (graft→trail echo): a project declares `retired_tokens: ["graft"]`
in its detection config after migrating to trail. At the next /sync, the detector
greps SYNC-policy-class files in the landed diff for the retired token, finds
`.agents/mcp.json` still teaching graft, and produces a `template-defect` candidate
(`suspected_layer: L1`, `affected_paths: [".agents/mcp.json"]`, evidence
`file:line`). The session files it via `upstream_request_create` → PM triages →
template sweep lands → projects adopt via their own resync (ADR-0031 Principle 5
unchanged). AC-3 pins this as a fixture test.

## 5. Design rulings

### 5.1 Q1 — Gate mechanism: **variant.json `syncDetection` block** (config setting; absent = OFF)

| Option | Verdict | Reason |
|---|---|---|
| CLI flag on dev-sync (`--detect-backport`) | Rejected as the *persistent* gate | Requires the agent to remember the flag every sync; invisible in repo state; cannot carry per-project tuning (retired tokens, cap). Kept only as the one-off override. |
| Env var | Rejected | Ephemeral, invisible, cross-platform shell differences; no audit trail. |
| `.claude/settings.json` key | Rejected | Platform-specific (Claude Code); /sync runs on all six surfaces. |
| **variant.json `syncDetection` block** | **Ruled** | `variant.json` is `PROJECT_STATE` (ADR-0073) — upgrades never touch it, so the opt-in flip can never be clobbered by a template wave. Platform-neutral. Already project-editable (projects maintain `script_manifest.local` today). Optional top-level keys have a governed registration path: `variant_extensions` in `docs/workspace-schema.json` (validated by validate-templates.ts). |

**Gate spec** (exact):

```jsonc
// Projects/<name>/variant.json — optional top-level key. Absent key == feature OFF.
"syncDetection": {
  "enabled": true,                 // required, boolean
  "max_tickets_per_sync": 3,       // optional, integer 1..5, default 3
  "retired_tokens": ["graft"]      // optional, string[] — identifiers this project
                                   //   has migrated away from; a SYNC-class file still
                                   //   carrying one is a template-defect candidate
}
```

Registered in `docs/workspace-schema.json` → `variant_extensions._shared.syncDetection`
(all variants; required/optional fields + notes as above). `validate-templates.ts`
gains a shape check: present key with `enabled` non-boolean, cap outside 1..5, or
non-string array tokens → **FAIL** (a silently ignored misconfigured gate would
defeat the opt-in). No variant template's `variant.json` changes — every project
starts OFF by omission.

**One-off override**: the sync skill accepts a `--detect-backport` argument
(§7, Step 3) that runs detection for this invocation only, without flipping config.
Both gate paths converge on the same script invocation; precedence: explicit
argument > config. Env var: none (deliberately — the workspace rejected env-var
gates for behavior changes since scoped-staging's soak exit; config files are
auditable in-repo).

### 5.2 Q2 — Where detection runs: **delivered leaf script + conditional SKILL.md step** (dev-sync untouched)

| Option | Delivery cost | Blast radius | Determinism | Verdict |
|---|---|---|---|---|
| (a) dev-sync post-commit phase | Root + L1 mirror edit, version bump, drift check, unit tests, ×every future tweak | **Core-standardized script** (AGENTS.md pluggable-variant rule: dev-sync must stay identical root↔templates; high blast radius) | Highest (enforced every run) | Rejected |
| (b) new delivered leaf script, invoked by a conditional skill step | One new L0+L1 script pair + SCRIPTS.md rows | Isolated; versioned and tested independently; validate-templates.ts model | High (script is deterministic; the *step-check* is one config read) | **Ruled** |
| (c) SKILL.md agent-executed detection (no script) | Doc-only | None | Low — evidence gathering by agent judgment re-creates exactly the drift this feature should mechanize | Rejected |

Rationale for (b) over (a): the auto-activating-gate precedent (ADR-0060/0073
spawning checkers from `audit.ts`) exists for **invariants** that must never be
skipped. This feature produces *reports and tickets* — a skipped run is a lost
detection, not a broken guarantee, and it is opt-in by the user's own refinement.
Embedding it in dev-sync would put every detector tweak (new evidence class, token
list change) through the core-script pipeline for marginal enforcement gain.
Meanwhile the **filing half is unavoidably agent-mediated**: the upstream MCP is a
client-spawned stdio server held by the session; a spawned subprocess cannot
honor the client contract, and re-implementing the client handshake in a script
would bypass the server's identity/cap/dedupe defenses. So: deterministic script
for evidence, agent for filing — each half where it is strongest.

**Project-side evidence constraint honored**: the script reads only project-local
facts; it never diffs against `templates/` (projects lack that tree). It reuses two
**already-delivered** modules rather than new machinery:

- `scripts/helpers/local-patch-scan.ts` v1.1.0 (delivered L1) — E1 evidence
  (LOCAL-PATCH markers, including the `pending` id).
- `scripts/lib/upgrade-policy.ts` `resolveClaim(relPath, variant)` (delivered L1
  leaf, ADR-0073 Amendment 3) — classifies every changed path SYNC / WORKSPACE /
  PRESERVE / PROJECT_STATE / TEMPLATE_ONLY, powering E2 and E4.

**Evidence classes** (the minimum-evidence bar, §6):

| Class | Signal (all project-local, deterministic) | Candidate type |
|---|---|---|
| E1 `LOCAL_PATCH` | `LOCAL-PATCH(upstream-request: pending)` marker found by local-patch-scan | `template-defect` (file now); markers with real U-ids are **report-only** (already filed) |
| E2 `DELIVERED_EDIT` | A file whose `resolveClaim` policy is `SYNC` (or a delivered leaf/helper path) carries a non-empty diff in the sync's landed surface (`origin/main...HEAD`), excluding mechanical files (`template-version.txt`, `.claude/last-upgrade-*`, `docs/VERSION_MANIFEST.md`, `memory/`, generated registries — the project-resync Step-2(b) mechanical list) | `template-defect` (project had to patch a delivered file) |
| E3 `RETIRED_TOKEN` | A `SYNC`-class file in the landed surface still matches a `retired_tokens` entry (whole-token regex, `\b`-bounded) | `template-defect` (template still ships what the project retired) |
| E4 `MANAGED_NEW_FILE` | New file in the landed surface under a managed surface (`skills/<name>/SKILL.md`, `scripts/helpers/`, `scripts/lib/`, `evidence-models/`, agent `agents/<name>.md`) whose claim is not PROJECT_STATE | `reusable-asset` (inbox-class report; human judges promotion) |

Priority order for cap allocation: E1 > E2 > E3 > E4.

### 5.3 Q3 — Report schema

Script writes `detect-backport-report.json` to `$(git rev-parse --git-dir)/`
(next to `sync-pr-body.md` — outside the working tree, never committed) and prints
a console summary. Schema `detect-backport-report/1`:

```jsonc
{
  "schema": "detect-backport-report/1",
  "generated_at": "2026-11-17T12:00:00+09:00",
  "project": "co-deck",
  "variant": "co-deck",
  "gate":   { "source": "variant.json | argument", "enabled": true },
  "diff_surface": { "base": "origin/main", "head": "HEAD", "changed_files": 12 },
  "candidates": [
    {
      "id": "cand-001",
      "candidate_type": "template-defect | reusable-asset",
      "evidence_class": "E1_LOCAL_PATCH | E2_DELIVERED_EDIT | E3_RETIRED_TOKEN | E4_MANAGED_NEW_FILE",
      "suspected_layer": "L1 | L2 | unsure",       // template-defect: L1/L2 from claim class; asset: always "unsure"
      "evidence": [ { "file": ".agents/mcp.json", "line": 3, "note": "retired token 'graft'" } ],
      "affected_paths": [".agents/mcp.json"],       // project-relative, MCP schema-compatible
      "dedupe_token": "sha256:<type|paths|anchor>", // local stable token (state file)
      "drafted_symptom": "factual observed-vs-expected text, ≤600 chars, no imperative phrases",
      "suggested_action": "file-upstream | file-asset-report | mark-local-patch | report-only",
      "disposition": "within-cap | over-cap | duplicate-local | already-filed"
    }
  ],
  "counts": { "candidates": 4, "cap": 3, "over_cap": 1 },
  "unresolved_template_defects": { "count": 2, "affected_files": [".agents/mcp.json"] },
  "notes": ["2 E1 markers already carry U-ids (report-only)"]
}
```

**`unresolved_template_defects` summary (§5.8 owner decision, Option 2)**: the
template-defect state that remains un-settled upstream. The script computes the
pending set as this run's `template-defect` candidates **plus** state-file
dedupe records whose filed U-id has not yet resolved `fixed` upstream (the
state file carries the token → U-id map, so a repeat candidate is traced to
its filed ticket even when today's diff no longer matches). Filing alone does
NOT clear a defect — only the landed upstream fix does; the resolution
refinement (drop U-ids whose `upstream.resolution = fixed`, looked up via
`upstream_request_status`) happens at the conditional skill step, keeping MCP
access on the agent side per the §5.2 split (deterministic evidence in the
script, MCP-mediated status in the session). The persisted report carries the
script-side pending set; the warning line (§6 Step 3) prints the refined
count.

`drafted_symptom` is drafted by the script in **declarative, factual form** — no
imperative tool-call phrasing (`run …`, `merge …`) — so it passes the MCP §9 L1
injection heuristics cleanly and flagged tickets stay rare. The session reviews and
may refine wording before calling `upstream_request_create`; the script's text is
input, not the verbatim contract.

`--dry-run` flag: produce the report and console output, skip the state-file write
(no dedupe memory); used by tests and first-enablement rehearsal.

### 5.4 Q4 — Filing routing: **single channel** (upstream MCP for both kinds)

The upstream MCP design (§4.1) files `suspected_layer ∈ {L1, L2, unsure}` requests;
asset reports fit mechanically: `suspected_layer: "unsure"` with the project-local
`affected_paths` fails C6 (template-managed) → lands `inbox` — exactly the desired
promotion-is-human-judged semantics. Extending the server (new tool or `report_kind`
field) would ripple through the schema, caps, tests, installer redeployment across
all surfaces — rejected for v1 (revisit only if inbox conversion proves noisy).

- **Template-layer defects** → `upstream_request_create`,
  `suspected_layer` from the claim class (delivered-common file → L1;
  variant-delivered file → L2; ambiguous → unsure). Template-managed paths → C6
  passes → `ready` (existing pipeline; PM reproduces independently per §12 — the
  requester diff is never applied).
- **Reusable assets** → `upstream_request_create`, `suspected_layer: "unsure"`,
  symptom prefixed `[sync-detect:reusable-asset]`. Lands inbox.
  **Workspace-side bridge**: pm-gateway-workflow §3.12 gains one duty line — at
  triage, PM converts a qualifying `[sync-detect:reusable-asset]` request into a
  workspace-store `learning:` ticket (the store only the workspace can write;
  2026-10-07 learning design §4.2 semantics unchanged) and resolves the U-ticket
  `outcome: fixed` with the learning id as `summary`. Assets therefore complete the
  same lifecycle as today's Step-2e requests, carried through the one channel
  projects already have.
- **Delegation tickets (ADR-0103)**: untouched — they stay the narrow, expiring
  hub-escalation exception; routine detection reports do not use them.
- After a defect filing, the session marks the patch site with the returned
  `LOCAL-PATCH(upstream-request: <id>)` marker (existing protocol) and updates any
  `pending` E1 markers with the real id — closing the upgrade-report loop that
  `local-patch-scan` already serves.

### 5.5 Q5 — Noise control

| Control | Value |
|---|---|
| Minimum evidence bar | Only classes E1–E4 count; E4 requires the artifact to be **in the landed diff** (not scratch); E2 excludes the mechanical-file list; E3 requires whole-token match; E1 only real markers |
| Per-sync filing cap | `max_tickets_per_sync`, default 3, range 1–5; allocation E1→E4; overflow stays in the report as `over-cap` rows (visible, not lost) |
| Local dedupe | `<git-dir>/detect-backport-state.json` records filed dedupe_tokens; a repeat candidate is reported as `duplicate-local`, never re-filed |
| Server-side backstops | MCP C5 cross-project dedupe merge, C4 soft/hard caps (10/30/day/project), C8 first-seen inbox, §9 sanitization — all unchanged and binding |
| Drafted-text hygiene | Declarative phrasing only (no heuristic-triggering imperatives); facts + file:line; ≤600 chars |
| PM inbox expectation | Steady state: fleet-wide ≈ 0–9/day worst case (6 active projects × cap 3 on heavy days), realistically ≈1–3/day; all carry the `[sync-detect:` prefix so the existing triage-batch pattern (2026-11-12-upstream-fleet-triage-batch) can sweep them as one class |

### 5.6 Auto-merge and close-out predicates (user decisions 3–4)

Merge predicate for any PR the flow merges in this mode (skill-executed, after
dev-sync returns; also applied at close-out). SSOT for the billing-wall terms is
ADR-0105; the project-scope mapping:

1. **Author guard**: PR author is the project's own automation identity or the
   user (ADR-0105 condition 4); a PR carrying foreign/ridden commits is never
   merged (condition 5).
2. **Protected-path guard**: the PR's changed files intersect no governance-control
   path — `.githooks/**`, `scripts/hooks/**`, `.claude/settings.json`,
   `.gemini/settings.json`, `docs/context.md`, `scripts/SCRIPTS.md` (ADR-0105 §2
   protected-path class scoped to the project layout). Hit → human merge only.
3. **Checks-green arm**: `gh pr checks` reports all checks succeeded (a repo with
   no CI workflows qualifies vacuously — nothing ever ran to fail).
4. **Billing-block arm** (ADR-0105 conditions 1–2, standing disposition): the head
   SHA has a **startup_failure**-class failure — annotation "recent account
   payments have failed or your spending limit needs to be increased", `runner_id 0`,
   zero steps. "No checks appeared" is not evidence; the wall is the known
   account-level state (T-20261110-008 / DEC-20261110-03), not re-diagnosed per PR.
   Conditions 3/7/8 (compensation battery, wave cap, manifest) are satisfied at
   project scope: dev-sync's own audit/typecheck/test gates already ran locally
   before this PR exists, the session merges only its own 1–N PRs (no wave), and
   the merge evidence lands in the task log.
5. **Never-merge floor**: any other failure class (test failure, timeout, missing
   required check that is not startup_failure) → PR stays open, reason reported.
   Real failures never auto-merge.

**Close-out** (decision 4): after the landing PR resolves, enumerate
`gh pr list --state open`, apply the predicate to each self/user-authored PR, merge
qualifying ones (squash/merge per repo convention), and report any that stay open
with the failing condition. Foreign-authored PRs are reported, never merged.

Where it lives: a new **sync SKILL.md step** (§7 Step 4), not dev-sync — the merge
is `gh` CLI work the session performs; dev-sync remains PR-creation-only.

### 5.7 Q6 — Rollout

Fleet-wide **delivery** in one wave is safe precisely because the gate defaults
off (G-2); the **enablement** is the pilot:

| Phase | Content |
|---|---|
| P0 | Design doc + DEC + spec registration (this task; PR-A) |
| P1 | Root `scripts/detect-backport.ts` @1.0.0 + unit tests + SCRIPTS.md row (PR-B) |
| P2 | Validator (`syncDetection` shape check) + `variant_extensions._shared` entry + L1 mirrors (`templates/common/scripts/detect-backport.ts`, `validate-templates.ts` mirror) + SCRIPTS.md L1 rows + `docs/templates/common-contract.json` pin (PR-C) |
| P3 | `skills/sync/SKILL.md` 1.9.2 → 1.10.0 (Steps 3–4: detection, filing, auto-merge close-out) + platform mirror publish (sync-skills.ts; ×6 surfaces) + VERSION_MANIFEST (PR-D) |
| P4 | Triage docs: pm-gateway-workflow §3.12 `[sync-detect:` prefix + asset→`learning:` conversion duty (PR-E) |
| P5 | Enablement pilot: co-deck flips `syncDetection.enabled`, one week soak (inbox volume, false-positive rate reviewed at triage), then fleet enablement project-by-project at each PM's discretion |

Version bumps: `sync` skill 1.9.2 → 1.10.0 (new conditional sections, minor);
`detect-backport.ts` new at 1.0.0; `validate-templates.ts` minor bump for the shape
check; **dev-sync.ts unchanged** (this is the design's core cost claim).

### 5.8 Q7 — Upgrade-warning visibility (owner decision 2026-11-17, Option 2)

Owner decision (2026-11-17; T-20261118-001): when detection leaves unresolved
template-defect candidates, the flow must **show** them — not act on them.

1. The report gains the `unresolved_template_defects` summary block (count +
   affected files; semantics in §5.3).
2. The conditional skill step (§6 Step 3) prints a **warning-only line** when
   the refined count > 0, e.g.
   `sync-detection: N unresolved template defects (upgrade NOT blocked; report: <git-dir>/detect-backport-report.json)`
   — appended to the PR Notes line alongside the existing candidate/filed/
   over-cap counts.

**Non-blocking invariant (explicit)**: an unresolved template defect NEVER
blocks the sync, the landing PR, the auto-merge, or an upgrade. The warning is
informational only; there is no gate, exit code, or enforcement hook attached
to it. The actual safety net is the pre-existing preserve semantics:
`lib/upgrade-policy.ts` resolves a delivered-file edit that diverges from the
template wave as CONFLICT (upgrade preserves the local state and reports) and
variant-local state as PROJECT_EVOLVED — so a still-shipped template defect
cannot clobber project-local work during the next upgrade wave. Motivating
evidence: **T-20261117-007** — the graft→trail defect re-delivered through a
template wave BEFORE the upstream fix landed; the fleet needs to see that
state at sync time (today it surfaces only through the manual resync audit),
but visibility must not harden into a gate.

**Placement ruling — standalone upgrade without sync (the gap case)**: an
upgrade wave applied outside the sync flow never runs detection, so no
warning is printed at upgrade time. Ruled MINIMAL: **upgrade-guidance
coverage via the last persisted report**. The skill's upgrade-delivery
guidance reads `<git-dir>/detect-backport-report.json` when it exists and
prints the same warning-only line when its `unresolved_template_defects.count`
> 0; when the report is absent (feature off, or never run — the state of every
project today) no warning is possible and none is printed, and that absence is
documented as designed behavior (consistent with G-2: gate off = zero new
behavior). `detect-backport --warn-only` standalone mode REJECTED: it would
run the full detector outside a sync context, where the diff surface
(`origin/main...HEAD`) is not the upgrade's change set — a fresh, possibly
misleading report — and it adds a second script surface plus a flag for one
line of output the persisted report already carries.

| File | Action | Description |
|---|---|---|
| `scripts/detect-backport.ts` | create (L0) | Detector: gate read → diff surface → E1–E4 evidence → report JSON → state file. Imports `helpers/local-patch-scan.ts`, `lib/upgrade-policy.ts`. Read-only on the tree; writes only `<git-dir>/detect-backport-report.json` + state. Flags: `--project <path>`, `--dry-run`, `--json`. Also computes the `unresolved_template_defects` pending set from the state file's token → U-id map (§5.3/§5.8) — warning-only, never a gate condition. |
| `tests/unit/detect-backport.test.ts` | create | §8 fixtures, incl. AC-3 graft replica. |
| `scripts/validate-templates.ts` | modify | `syncDetection` shape check (loud FAIL on misconfig). |
| `docs/workspace-schema.json` | modify | `variant_extensions._shared.syncDetection` contract entry. |
| `templates/common/scripts/detect-backport.ts` | create (L1 mirror) | Delivered copy (propagation domain `scripts`). |
| `templates/common/scripts/validate-templates.ts` | modify | Mirror of validator change. |
| `scripts/SCRIPTS.md`, `templates/common/scripts/SCRIPTS.md` | modify | Registry rows, layer `L0+L1` (validate-templates.ts convention). |
| `docs/templates/common-contract.json` | modify | Version pin for the delivered additions. |
| `skills/sync/SKILL.md` + 5 platform mirrors | modify | Steps 3–4 (below); version 1.10.0. |
| `docs/governance/agents/pm-gateway-workflow.md` | modify | §3.12: `[sync-detect:` prefix note + asset→`learning:` conversion duty. |
| `scripts/dev-sync.ts`, `templates/common/scripts/dev-sync.ts` | **no change** | Gate-off identity guarantee (G-2). |

**SKILL.md step additions** (both only execute when `--detect-backport` was passed
or `variant.json` has `syncDetection.enabled: true`; otherwise the skill text says
"skip — feature off"):

- **Step 3 — Detection & filing (opt-in)**: run
  `bun scripts/detect-backport.ts --json > report`; read the report; file
  `within-cap` candidates through `upstream_request_create` per §5.4 routing
  (defects: layer + template-managed paths; assets: `[sync-detect:reusable-asset]`
  + unsure); update LOCAL-PATCH markers with returned ids; add one Notes line to
  the PR body/task log: `sync-detection: N candidates, M filed, K over-cap`.
  Then the warning step (§5.8): refine the report's `unresolved_template_defects`
  pending set by dropping U-ids whose `upstream.resolution = fixed`
  (`upstream_request_status`); when the refined count > 0, print the
  warning-only line (`sync-detection: N unresolved template defects (upgrade
  NOT blocked; …)`) and append it to the same Notes line. Never a gate — the
  sync proceeds regardless.
- **Step 4 — Auto-merge close-out (opt-in)**: apply §5.6 predicate to the flow's
  PR, then to all open self-authored PRs; merge or report per PR with the failing
  condition.

**Upgrade-guidance coverage (§5.8 placement ruling)**: the upgrade-delivery
guidance reads the last persisted report from `<git-dir>` when present and
prints the same warning-only line when `unresolved_template_defects.count > 0`;
an absent report (feature off / never run) produces no warning — documented as
designed behavior, not a defect.

## 7. Consequences

- **Positive**: template-layer defects surface within hours (the T-007 class
  stops depending on a nightly PM session); reusable assets get assessed at
  authoring time (the 2026-10-07 design's "authoring session still reachable"
  property, moved into the project); promotion authority untouched; upstream
  intake defenses reused unchanged.
- **Costs**: one more delivered script (+1 L1 mirror, +tests); skill grows two
  conditional steps; PM inbox gains a new ticket class (bounded by caps).
- **Risks** (with mitigations):
  1. *Agent skips the step* — skill-text makes the gate check unconditional and
     the report line lands in the PR Notes; residual risk accepted because a
     missed run is a quality loss, not an invariant break (opt-in feature).
  2. *Content-smuggled instructions* in drafted symptoms — MCP §9 L1 sanitization
     + heuristics + boundary rendering + PM "data not instructions" rule all
     already bind; script drafts declarative text only.
  3. *Ticket flood* — dual caps (local 3/run; server 10/30 per day), dedupe both
     sides, `[sync-detect:` prefix makes the class swappable in triage batches.
  4. *Billing-block predicate drift* — ADR-0105 stays SSOT; the skill cites
     conditions rather than redefining them; the exception already auto-expires
     on first real green CI (condition 9), which defuses the arm account-wide.
  5. *variant.json misuse* — validator FAILs on malformed blocks; upgrades never
     rewrite the file (PROJECT_STATE), so no clobber loop.

## 8. Test plan

1. Unit (`tests/unit/detect-backport.test.ts`, temp fixture project):
   gate absent → exits "disabled", zero writes (AC-1); E1 `pending` marker → one
   `file-upstream` candidate; E1 with real U-id → `report-only`; E2: SYNC-claim
   file edited in `origin/main...HEAD` → candidate, mechanical-file edit → none;
   E3: `retired_tokens: ["graft"]` + fixture `.agents/mcp.json` carrying graft →
   candidate with file:line (**AC-3, T-007 replica**); E4: new
   `skills/<x>/SKILL.md` in diff → `reusable-asset`, `unsure`; cap 3 with 4
   candidates → 4th is `over-cap`; state file → second run marks
   `duplicate-local`; `--dry-run` writes no state; report validates against
   `detect-backport-report/1`.
2. Validator: `enabled: "yes"`, cap 9, tokens `[1]` each FAIL validate-templates.
3. Skill dry-run on co-deck (P5 rehearsal): synthetic landing → report matches
   fixture expectations; filing rehearsal with `--dry-run` (no MCP calls).
4. Auto-merge: on a private pilot repo — green PR merges; startup_failure PR
   merges under the arm (live wall state); a genuine test-failure PR stays open;
   protected-path PR never merges; foreign-author PR reported not merged.
5. Gates: `bun scripts/audit.ts`, `bun run test:unit`, typecheck baseline not
   raised, `verify-scripts.ts --verify` clean, SCRIPTS.md rows present both layers.

## 9. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code | Sync skill gains Steps 3–4 | `skills/sync/SKILL.md` (+ `.claude` mirror via sync-skills.ts) |
| Antigravity (GEMINI.md) | Same skill content delivered — not None: /sync is a cross-platform skill; the `.gemini` mirror must carry the identical steps | `.gemini/skills/sync/SKILL.md` (mirror publish) |
| templates/common | Propagation required: scripts domain (new script + validator mirror) + skills domain (sync skill) + contract pin | listed in §6 |

Other mirrors (`.agents`, `.codex`, `.hermes`) receive the same skill via the
standing mirror-publish step; `docs/workspace-schema.json` is root+delivered
(SCHEMA_MERGE_FILE).

## 10. Accessibility / preview exemptions

- ADR-0065: exempt — backend automation and CLI tooling; no UI.
- ADR-0070: exempt — verification is command-exit and artifact-presence based (§8).

## 11. Acceptance criteria

- **AC-1**: with the gate absent/off, a project /sync produces byte-identical
  pipeline behavior and zero new artifacts (`dev-sync.ts` diff empty is the
  structural proof).
- **AC-2**: gate on + E1 `pending` marker → exactly one U-ticket filed, marker
  updated with the returned id, no duplicate on re-run.
- **AC-3**: the §4 worked example (graft replica fixture) yields a
  `template-defect` candidate with evidence `file:line` and `suspected_layer: L1`.
- **AC-4**: caps, local dedupe, and over-cap visibility behave per §5.5.
- **AC-5**: auto-merge honors the §5.6 predicate arms and the never-merge floor.
- **AC-6**: close-out merges qualifying open self-authored PRs; others reported
  with reasons, never force-merged.
- **AC-7**: an asset report lands inbox; the §3.12 conversion duty produces a
  `learning:` ticket and resolves the U-ticket without any project-side
  workspace-store write.
- **AC-8** (§5.8): unresolved template defects surface as the
  `unresolved_template_defects` summary block and the warning-only skill-step
  line — and a sync carrying them still completes end-to-end (PR opens, merge
  predicate applies normally, upgrade proceeds), proving the non-blocking
  invariant; a U-id whose upstream resolution has reached `fixed` drops out of
  the warning on the next run.

## 12. Open questions (owner decisions, defaults apply)

- **O-1** *(PM)*: default cap 3 and the E1>E2>E3>E4 allocation order — confirm or
  retune after the co-deck soak week.
- **O-2** *(user)*: fleet enablement pacing after the co-deck pilot (P5).
- **O-3** *(PM, workspace-side)*: whether the asset→`learning:` conversion should
  later gain a dedicated MCP tool (deferred per §5.4; revisit if inbox noise
  exceeds ~5/day sustained).
