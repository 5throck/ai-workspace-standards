# Fleet Membership SSOT — Design (Row 0)

- **Spec id**: `2026-11-07-fleet-membership-ssot-design`
- **Date**: 2026-11-07
- **Status**: proposed
- **Author**: architect (PM-dispatched, Design Gate Row 0 — design + registration only)
- **Related**: DEC-20261107-01 (drafted here, written by the implementer), ADR-0089 (01:30 fleet runner cadence), ADR-0061 (gate-moment decision records), `docs/designs/2026-09-25-daily-fleet-review-resync-design.md` (R19 glob rule — amended by this design), `docs/designs/2026-09-25-daily-fleet-learning-extraction-design.md`, `docs/designs/2026-11-07-handbook-archmap-drift-check-design.md` (architecture-map drift guard, context only), PR #1893 (archmap drift check, merged 2026-11-07)

## 1. Problem and user decision

**User decision (2026-11-07)**: `Projects/co-abap-plugin` is a **separate project, not a member of the template fleet**. It is a Claude Code plugin distribution (`plugin.json` + `commands/`), it has **no `variant.json`**, and its last template sync (2026-10-03, template 0.10.0) is historical residue, not an open obligation. The canonical architecture map (`docs/architecture/workspace-architecture{,.en,.es,.ja}.svg`) already depicts the L3 fleet as **16 projects without it**.

**Problem**: operations do not match the decision. There is no machine-readable fleet-membership record, and ~20 scripts independently discover fleet members by enumerating `Projects/co-*` directories. Every fleet automation surface therefore treats `co-abap-plugin` as a member today:

- the 01:30 fleet runner (ADR-0089) drives `project-resync` over "ALL `Projects/co-*`", with its prompt rule R19 — *"Derive the project set with the glob `Projects/co-*`. Never hardcode the fleet count."* (`docs/designs/2026-09-25-daily-fleet-review-resync-design.md:79`);
- resync/audit tooling (`resync-audit.ts`, `backport-diff.ts`, `evidence-backport-scan.ts`) enumerates the same glob as its default project set;
- fleet analytics (`skill-graph-fleet-report.ts`, `fleet-script-parity.ts`) count it in fleet denominators;
- template-drift checks (`audit.ts` marker drift, `validate-templates.ts` identity placeholders) sweep it.

Left as-is, the next resync window, upgrade wave, or learning-extraction run will re-impose template obligations the user has explicitly removed. This design makes membership an explicit, machine-readable fact with one enforcement point.

## 2. Scope and non-goals

**In scope (Row 0)**: the design below — inventory of every `Projects/co-*` consumer, the membership SSOT, the shared helper, exclusion semantics, the runner-prompt wording, the DEC record draft, the test plan. Registration only; **no script edits in this PR**.

**Non-goals**:

- Do **not** relocate, rename, or delete `Projects/co-abap-plugin`. It keeps its repo, its CI, and its release cadence.
- Do **not** delete or "clean up" its stale `template-version.txt` / resync residue — that is the project's own call, made in its own repo.
- Do **not** change `hub_topology` in `docs/workspace-schema.json` — hub membership is a separate registry with its own semantics; `co-abap-plugin` has no hub row and none is added.
- Do **not** rewrite CHANGELOG history entries that count "16 Projects/co-\*" — historical records stay frozen.
- Do **not** touch `mcp-upstream-server.ts` identity rules (decision in §6).

## 3. Inventory — how every script uses `Projects/`

Verified by grep over `origin/main` at `0c18b2f49` (2026-11-07). Classes: **(a) FLEET ITERATION** — loops over `Projects/co-*` as fleet members, must honor membership; **(b) SINGLE-PROJECT tool** — operates on one explicitly given path; **(c) UNRELATED** — path guards, scaffolding destinations, comments, non-project enumeration. L2-variant enumeration (`templates/co-*`) is never fleet iteration and is called out to prevent false-positive refactors.

### 3.1 Class (a) — FLEET ITERATION (must honor membership)

| # | Script (file:line) | Site | Notes |
|---|--------------------|------|-------|
| A1 | `scripts/resync-audit.ts:279-287` | `defaultProjects()` — `readdirSync(resolve("Projects"))`, `co-` filter at :285 | Default set for the whole audit; `--project` accepts explicit paths |
| A2 | `scripts/backport-diff.ts:199-206` | `defaultProjects()` — same shape, `co-` filter at :203 | `resolveProjects()` (:209-215) accepts explicit bare names/paths |
| A3 | `scripts/evidence-backport-scan.ts:98-104` | `defaultProjects()` — same shape, `co-` filter at :102 | Learning/evidence extraction; `--project` accepted |
| A4 | `scripts/skill-graph-fleet-report.ts:299-310` | `defaultProjects()` — same shape, `co-` filter at :303, then `filterTransientCheckouts` (:307, `scripts/lib/git-aware-scan.ts:67`) | Fleet convergence denominators; only caller that already filters transient PR working checkouts (T-20261103-004) |
| A5 | `scripts/fleet-script-parity.ts:94-97` | `main()` — `readdirSync(projectsDir)` :96, `.filter(d => d.startsWith('co-'))` :97 | Canonical-vs-project script tree parity |
| A6 | `scripts/audit.ts:2238-2263` | `checkProjectDocMarkerDrift()` — `readdirSync('Projects')` loop :2261, `co-` filter :2262 | COMMON-CLAUDE/GEMINI/CODEX managed-block drift (WARN-only, local-only; Projects/ absent in CI) |
| A7 | `scripts/validate-templates.ts:6296-6324` | `checkProjectCountryConfigDeclarations()` — loop :6299, **variant.json gate at :6304** ("projects without a variant.json are out of scope") | `co-abap-plugin` (no variant.json) is **already out of scope here** — keep the gate; helper routing optional, zero behavior delta |
| A8 | `scripts/validate-templates.ts:6327-6349` | `checkProjectIdentityPlaceholders()` — loop :6331, **no `co-` filter at all** — sweeps every `Projects/*` directory (minus `isTransientTestFixture`) | Today this includes `co-abap-plugin` and any other non-`co-` directory; helper routing narrows it to actual members (intended semantic alignment, see §6) |

### 3.2 Class (b) — SINGLE-PROJECT tools (explicit path; decisions in §6)

| # | Script (file:line) | Path surface | Decision |
|---|--------------------|--------------|----------|
| B1 | `scripts/upgrade-project.ts:1355-1379` | explicit target arg; root refusal :1355, outside-`Projects/` WARN :1369, refusal with `--yes` override :1379. Variant discovery enumerates `templates/` :1478 — **L2, not fleet** | **Refuse non-member targets by default; `--allow-non-member` override** (§6.2) |
| B2 | `scripts/adopt-project.ts:249-252` | target guard (`projectsRoot` :249, outside-Projects refusal + `--yes` :251-252); variant enumeration is `templates/` :219 | **Refuse an excluded name without explicit `--yes`** (§6.3) |
| B3 | `scripts/new-project.ts:406,431` | scaffold destination `Projects/<name>` :406; root refusal :431 | No membership gate for creation (a scaffold is a new member by definition); **refuse a name that matches an exclusion record** (§6.4) |
| B4 | `scripts/create-l3-scaffold.ts:1058,1074` | destination `Projects/<variant>` :1058, collision fail :1074 | Same rule as B3 (§6.4) |
| B5 | `scripts/generate-l3-readme.ts:16-17,113` | `--l3-path` / cwd | No gate — generic single-project dev utility (§6.5) |
| B6 | `scripts/regenerate-agents-md.ts:24` | `--source` (e.g. `Projects/co-hr`) | No gate — same rationale (§6.5) |
| B7 | `scripts/route-audit-scan.ts:446-476` | `--dir <project-root>` / cwd; `walkRouteFiles` :316 walks only the target's `app/`/`src/` | No gate — same rationale (§6.5) |
| B8 | `scripts/mcp-upstream-server.ts:183-184,337-355` | registration rule :183 (`^co-[a-z0-9-]{1,40}$` direct child of `Projects/` + `template-version.txt`), `PROJECTS_DIR` :184, cwd walk :337-355 | **No change** — identity gate, not membership (§6.6) |
| B9 | `scripts/project-to-variant.ts:264` | prints adoption instructions into `Projects/<target>` | No gate — migration utility; the resulting project becomes a member by the default rule |

### 3.3 Class (c) — UNRELATED path handling (no change)

| # | Script (file:line) | Why unrelated |
|---|--------------------|---------------|
| C1 | `scripts/hub-probe.ts:82,192` | Hub roster comes from the `hub_topology` registry (`registryHubs()`), not a glob; `PROJECTS_DIR` :82 only resolves `Projects/<hub>` :192. `co-abap-plugin` has no hub row — hub probes never touched it |
| C2 | `scripts/hub-bootstrap.ts:167,526,636-670` | `PROJECTS_DIR` :167 = bootstrap destination + stale `.bootstrap-*` temp-dir sweep :643 — scaffolding/temp hygiene, not membership |
| C3 | `scripts/dev-sync.ts:123,180,348,1084,2081` | Comments only; its `readdirSync` at :1478 enumerates `templates/` (L2) |
| C4 | `scripts/lifecycle-sync-audit.ts:183,1334` | Comments only (references audit.ts's Projects guard) |
| C5 | `scripts/promote-context-section.ts:26,193` | Log text only; operates on `templates/` |
| C6 | `scripts/propagate-to-templates.ts:388` | `ENCODING_SKIP_DIRS` contains `'Projects'` — an exclusion from an encoding sweep, not membership |
| C7 | `scripts/audit.ts:970,1296,1350,1395,1467,1521,2105,2308,2396,2582,2983,3186,2797` | All `co-` filters here enumerate `templates/` (L2 variants via `isCoVariantTracked`) or `LINT_SKIP_DIRS` — **not fleet; do not refactor these** |
| C8 | `scripts/upgrade-project.ts:1478`, `scripts/dev-sync.ts:1478`, `scripts/new-project.ts:471`, `scripts/adopt-project.ts:219` | `templates/` enumeration for variant selection — not fleet |
| C9 | `scripts/check-handbook-archmap-drift.ts:104,119` (new in PR #1893) | Compares `Handbooks/` copies against `docs/architecture/workspace-architecture*.svg` only; no `Projects/` enumeration |
| C10 | `scripts/test-l3-to-variant-promotion.ts:103` | E2E fixture path |
| C11 | `scripts/helpers/scan-l3-project.ts:26`, `scripts/helpers/skills-registry.ts:9`, `scripts/lib/upgrade-policy.ts` (comments) | Comments; explicit-path or pattern logic |
| C12 | `scripts/test-new-project.ts` | Test harness for B3 |

**Prompt/doc surfaces that derive the fleet by glob** (wording edits land in the implementation PR; exact wording in §7):

- `docs/designs/2026-09-25-daily-fleet-review-resync-design.md:79` — rule R19 (the binding runner-prompt rule)
- `.agents/skills/project-resync/SKILL.md:39,169,248` (+ `.claude/`, `.codex/`, `.gemini/` mirrors — hash-synced, edit all four)
- `.agents/skills/skill-graph-analytics/SKILL.md:51,54` (+ three mirrors)
- `docs/constitution/09-operations-workflow.md:308` — cadence table row
- `docs/adr/0089-local-automation-cadence-and-unattended-merge-policy.md:21,38` — historical ADR; amendment footnote only, no rewrite

## 4. SSOT choice — `docs/fleet-membership.json`

**Decision**: a dedicated registry file `docs/fleet-membership.json`, L0-only, with the default rule *"every directory under `Projects/` whose name starts with `co-`"* minus explicit exclusions.

**Options considered**:

| Option | Pro | Con | Verdict |
|--------|-----|-----|---------|
| **A. Dedicated `docs/fleet-membership.json`** | Tiny, append-mostly, carries decision provenance; L0-only by construction; absent file = today's behavior | One more registry file | **Chosen** |
| B. `fleet_membership` block in `docs/workspace-schema.json` | Reuses an existing registry (+ its shape validator) | `workspace-schema.json` is **merge-aware-delivered to L1/L2 projects** (`scripts/lib/upgrade-policy.ts` delivery notes) — workspace-root operational state must not propagate into every template and project; also couples schema governance versioning to ops decisions | Rejected |
| C. Derive membership from `variant.json` presence (the A7 gate) | Zero new files; already partially true | No decision provenance (reason/date/ref); cannot express "exclude a variant.json-bearing project" (a realistic future case: a fork kept side-by-side, or an archived project mid-wind-down); R19 explicitly forbids hardcoding, and an implicit convention is harder for a prompt-driven runner to state and verify | Rejected (kept as a corroborating signal only) |

**Schema**:

```json
{
  "version": 1,
  "_comment": "Template-fleet membership exclusions. Default rule: every directory under Projects/ whose name starts with 'co-' is a fleet member, minus the ids listed in excluded[]. L0-only — never propagated to templates/ or scaffolded projects, never added to any propagation map. Consumers: scripts/lib/fleet.ts (sole code path) and scripts/fleet-list.ts. Design: docs/designs/2026-11-07-fleet-membership-ssot-design.md",
  "excluded": [
    {
      "id": "co-abap-plugin",
      "reason": "Claude Code plugin distribution project (plugin.json + commands/), not a template-derived variant project: no variant.json, no template sync obligation; last template sync (2026-10-03, template 0.10.0) is historical residue, not an open obligation. Architecture map depicts the L3 fleet as 16 projects without it.",
      "decided": "2026-11-07",
      "decision_ref": "DEC-20261107-01"
    }
  ]
}
```

**Validation rules** (enforced by `loadFleetRegistry`): `version === 1`; `excluded` is an array; each row has `id` matching `^co-[a-z0-9-]{1,40}$` (same shape as the upstream-server requester rule, `mcp-upstream-server.ts:183`), non-empty `reason` string, `decided` = `YYYY-MM-DD`, `decision_ref` = `DEC-YYYYMMDD-NN`; duplicate `id`s are an error; unknown keys are ignored forward-compatibly.

**Failure semantics**: file **absent** → zero exclusions, historical glob behavior (backward-compatible rollout; the default rule already matches the architecture map). File **malformed** → the helper throws; every fleet-iteration tool hard-fails rather than guessing (fail-closed, mirroring the hub-topology loader's fail-closed stance in `scripts/helpers/hub-topology.ts`). The runner prompt (§7) turns that failure into a stop + urgent ticket, never a silent fallback to the raw glob.

**Genericity**: any future separate project is excluded by appending one row with its own DEC ref — no code change. Reversal (rejoining the fleet) = removing the row; the record is the reversal path.

## 5. Shared helper — `scripts/lib/fleet.ts` (+ `scripts/fleet-list.ts`)

One pure module in `scripts/lib/` (the deterministic pure-helper convention of `lib/git-aware-scan.ts`, `lib/upgrade-policy.ts`; file reads injected via `root`, every function deterministic given inputs — the same one-derivation discipline as `helpers/hub-topology.ts`, whose docstring states the rule plainly: consumers restate nothing).

```ts
// scripts/lib/fleet.ts — sole membership-derivation path (design
// docs/designs/2026-11-07-fleet-membership-ssot-design.md §5).

export interface FleetExclusion {
  id: string;          // directory name under Projects/, ^co-[a-z0-9-]{1,40}$
  reason: string;
  decided: string;     // YYYY-MM-DD
  decision_ref: string; // DEC-YYYYMMDD-NN
}

export interface FleetRegistry { version: number; excluded: FleetExclusion[] }

export type LoadFleetRegistryResult =
  | { ok: true; registry: FleetRegistry }
  | { ok: false; error: "absent-file" }                 // zero exclusions — historical behavior
  | { ok: false; error: "malformed"; detail: string };  // callers hard-fail, never guess

/** Read + validate docs/fleet-membership.json. Throws on malformed when used via fleetExclusions(). */
export function loadFleetRegistry(root: string): LoadFleetRegistryResult;

/** Exclusion rows ([] when the file is absent; throws "malformed" with detail). */
export function fleetExclusions(root: string): FleetExclusion[];

/** Set of excluded ids (convenience for hot loops). */
export function excludedFleetIds(root: string): Set<string>;

/** Membership test for a directory NAME under Projects/ (not a path):
 * starts with 'co-' and not excluded. */
export function isFleetMember(name: string, exclusions?: ReadonlySet<string>): boolean;

/** Fleet member paths, sorted: Projects/<name> for every co-* directory minus
 * exclusions. Does NOT filter transient PR working checkouts — compose with
 * lib/git-aware-scan.ts filterTransientCheckouts() where that behavior already
 * exists (skill-graph-fleet-report.ts:307); do not change transient semantics
 * in this work. */
export function listFleetProjects(root: string): string[];

/** Path-form guard for single-project tools: true when <path> resolves to a
 * fleet member directory (used by the B-class refusals in §6). */
export function isFleetProjectPath(path: string, root?: string): boolean;
```

**Wrapper CLI** `scripts/fleet-list.ts` (L0, trivial, testable):

```
bun scripts/fleet-list.ts          # one member path per line (sorted)
bun scripts/fleet-list.ts --json   # {"root":…,"count":N,"projects":[…],"excluded":[{id,decided,decision_ref},…]}
```

**The routing rule**: every FLEET ITERATION site (§3.1, A1–A8) derives its default set exclusively through `listFleetProjects()` / `isFleetMember()`. No script outside `scripts/lib/fleet.ts` may filter a `Projects/` readdir by the `co-` prefix. A structural regression test (§9.3) enforces this mechanically, and the same test pins the enumerator list so a *new* unregistered `Projects/` enumerator fails CI instead of silently re-creating today's problem.

## 6. Semantics of "excluded"

### 6.1 What SKIPS an excluded project

| Operation | Surface | Effect for `co-abap-plugin` |
|-----------|---------|------------------------------|
| Resync cycle (Steps 0–6, incl. 2d domain-model diff, 2e learning extraction) | 01:30 runner Phase II, `project-resync` skill | Never targeted; not in the derived set |
| Provenance audit default set | `resync-audit.ts` (A1) | Excluded from default set. Explicit `--project Projects/co-abap-plugin`: **one-line WARN, proceed** — read-only, operator-invoked (§6.7) |
| Backport diff default set | `backport-diff.ts` (A2) | Same policy as A1 |
| Evidence/learning extraction default set | `evidence-backport-scan.ts` (A3) | Same policy as A1 — no learning rows are extracted from it |
| Upgrade waves / preflight sweeps | runner Step 5, `upgrade-project.ts` (B1) | Never included in any wave; individual invocation refused by default (§6.2) |
| Fleet skill-graph report | `skill-graph-fleet-report.ts` (A4) | No snapshot row, no convergence denominator participation |
| Script parity | `fleet-script-parity.ts` (A5) | Not compared against `templates/common/scripts` |
| Managed-block drift | `audit.ts` `checkProjectDocMarkerDrift` (A6) | Skipped — no COMMON-CLAUDE/GEMINI/CODEX managed-block obligation |
| Identity-placeholder sweep | `validate-templates.ts` `checkProjectIdentityPlaceholders` (A8) | Skipped via helper routing (today it sweeps every `Projects/*` dir; narrowing to actual members is the intended alignment) |
| Country-config declaration | `validate-templates.ts` A7 | Unchanged — the variant.json gate (:6304) already scopes it out |
| Hub probes | `hub-probe.ts --all` (C1) | Vacuously unchanged — hub rosters come from `hub_topology`, which has no row for it |
| Fleet counts | reports, architecture map, runner summaries | Count = 16, matching `docs/architecture/workspace-architecture*.svg` |

### 6.2 What still applies — and the B-class decisions

1. **Its own repo, CI, and release cadence — untouched.** Exclusion is an operations-automation boundary, not a demotion of the project.
2. **`upgrade-project.ts` (B1): refuse by default, `--allow-non-member` override.** Rationale: a silent upgrade would re-impose exactly the template obligations the user removed; a hard refusal makes the boundary visible at the moment of risk (the only fleet tool that *writes* into a project). The override keeps operator agency for exceptional one-offs (e.g. a sanctioned manual cleanup of resync residue) without a code change per exception. The refusal message names `docs/fleet-membership.json` and the override flag. Implementation: at the existing target-validation block (`:1355-1379`), after the outside-`Projects/` checks, resolve membership via `isFleetProjectPath()`; refuse non-members unless `--allow-non-member` (which emits a WARN row for the run log).
3. **`adopt-project.ts` (B2): refuse an excluded name without explicit `--yes`.** Adopting `co-abap-plugin` back into the fleet directly contradicts the DEC; `--yes` is the escape hatch, and the operator must also remove the exclusion row first (the check reads the registry, so the row is the gate).
4. **`new-project.ts` / `create-l3-scaffold.ts` (B3/B4): refuse a project name matching an existing exclusion record** (cheap name-collision guard — a scaffold named like an excluded id would resurrect the exact confusion this design removes). Creating genuinely new members stays friction-free: every scaffold is a member by the default rule and carries `variant.json` from day one.
5. **Generic single-project dev utilities (B5–B7): no gate, no warning.** `generate-l3-readme`, `regenerate-agents-md --source`, `route-audit-scan --dir` are not fleet operations; gating or warning on every explicit use trains operators to ignore warnings and adds friction with zero protection (they are single-target, operator-invoked, and harmless on a non-member).
6. **`mcp-upstream-server.ts` (B8): no change — the filing channel stays open.** The registration rule (:183) is an **identity** gate (direct `co-*` child of `Projects/` + `template-version.txt` at root), not a fleet-membership gate. Upstream requests are how a co-resident but separate project escalates workspace-side problems — severing the channel would leave a workspace-tree resident with no escalation path, and would have blocked the very intake that produced this design (the misclassification surfaced through project-side observation). If `co-abap-plugin` lacks `template-version.txt` it cannot file today under the existing v1 rule; that is the current rule's own semantics, unchanged either way. Fleet membership and upstream standing are deliberately orthogonal.
7. **Read-only inspection with an explicit `--project` (A1–A3): WARN and proceed.** Default sets honor membership; an operator who names a target gets a one-line notice (`co-abap-plugin is not a fleet member (docs/fleet-membership.json) — proceeding read-only`) and full results. Refusing read-only diagnostics adds friction without protecting anything.

## 7. Automation prompt change — exact wording

The binding rule today is R19 of the daily fleet runner design (`docs/designs/2026-09-25-daily-fleet-review-resync-design.md:79`), restated in the live 01:30 runner prompt maintained in the local ZCode automation config outside this repo (ADR-0089 as-deployed record). **The PM applies the following wording to the live runner prompt**; the implementation PR adds an amendment footnote to the design doc's R19 line and updates the skill/cadence-doc wording listed in §3.

**REPLACE** (current R19 wording):

> Derive the project set with the glob `Projects/co-*`. Never hardcode the fleet count.

**WITH**:

> Derive the project set by running `bun scripts/fleet-list.ts --json` — the fleet SSOT: `Projects/co-*` directories minus the exclusions recorded in `docs/fleet-membership.json`. Never hardcode the fleet count. Never fall back to a raw `Projects/co-*` glob, even as a fallback when the helper fails. If `scripts/fleet-list.ts` fails to run or the registry fails to load, STOP Phase II (project-resync) entirely, file one urgent ticket describing the failure, and continue with Phase I / Phase 1b only — do not guess membership.

**Phase 1b (per-variant review, R43)** is unaffected: `templates/co-*` is L2-variant enumeration, not fleet membership.

**Variant-side note**: R43 ("Derive the variant set with the glob `templates/co-*`") stays verbatim. Template variants and fleet members are different sets; this design deliberately does not unify them (a variant can exist without a live project and vice versa — `co-abap-plugin` itself nearly proves the point).

## 8. Decision record (draft — implementer writes `docs/decisions/DEC-20261107-01.md`)

Per ADR-0061 the membership exclusion is a gate-moment decision; the DEC record is written at implementation time from this draft (PM re-dates/renumbers if the gate moment shifts):

```markdown
---
id: DEC-20261107-01
date: 2026-11-07
lang: en
agent: pm
status: accepted
decision: >-
  Gate-moment decision for the Design Gate Row 0 deliverable
  docs/designs/2026-11-07-fleet-membership-ssot-design.md
  (spec 2026-11-07-fleet-membership-ssot-design): adopt the user ruling of
  2026-11-07 that Projects/co-abap-plugin is a SEPARATE project, not a
  member of the template fleet — it is a Claude Code plugin distribution
  (plugin.json + commands/) with no variant.json, whose last template sync
  (2026-10-03, template 0.10.0) is historical residue rather than an open
  obligation, and whose absence the architecture map
  (docs/architecture/workspace-architecture*.svg) already depicts (L3
  fleet = 16 projects). Fleet membership becomes an explicit SSOT:
  docs/fleet-membership.json (L0-only, never propagated to templates/ or
  scaffolded projects) records exclusions as
  {id, reason, decided, decision_ref} rows over the default rule
  "Projects/co-* directories"; scripts/lib/fleet.ts is the only code path
  allowed to derive membership, and every fleet-iteration site (resync-
  audit, backport-diff, evidence-backport-scan, skill-graph-fleet-report,
  fleet-script-parity, audit.ts checkProjectDocMarkerDrift,
  validate-templates.ts checkProjectIdentityPlaceholders, the 01:30
  runner) routes through it, enforced by a structural regression test.
  Excluded projects are skipped by resync, backport, learning extraction,
  upgrade waves, fleet reports, drift counts, and hub rosters; they keep
  their own repo, CI, and the mcp-upstream-server filing channel (the
  identity gate is deliberately not coupled to membership);
  upgrade-project refuses non-member targets by default with an explicit
  --allow-non-member override; adopt-project refuses an excluded name
  without explicit --yes; new-project/create-l3-scaffold refuse an
  excluded name. The 01:30 runner prompt replaces the R19 glob rule with
  the fleet-list.ts derivation (exact wording: design §7); the raw-glob
  fallback is banned. Reversal path: remove the exclusion row from the
  registry (the record is the reversal path).
```

## 9. Test plan

### 9.1 Helper unit tests — `tests/unit/fleet-membership.test.ts`

`mkdtempSync` fixtures; no real `Projects/` dependency.

- `loadFleetRegistry`: absent file → `{ok:true}` with zero exclusions; valid file parses all four fields; malformed cases each → `{ok:false, error:"malformed"}` with a useful detail: bad `version`, non-array `excluded`, bad `id` shape (`foo`, `CO-X`, over-long), empty `reason`, bad `decided` (`2026/11/07`), bad `decision_ref` (`T-…`), duplicate `id`, invalid JSON.
- `listFleetProjects` / `isFleetMember`: member included; excluded id dropped; non-`co-` directory dropped; plain file (not directory) dropped; output sorted; `Projects/` absent → `[]`.
- `isFleetProjectPath`: absolute path, repo-relative path, trailing separator, bare name rejection (it is a path guard, not a name guard).
- `fleetExclusions` on a malformed file throws (the fail-closed contract of §4).

### 9.2 Wrapper behavioral test — `tests/unit/fleet-list.test.ts`

Fixture workspace (`process.chdir`): `Projects/co-real/` + `Projects/co-excluded-tool/` + `docs/fleet-membership.json` excluding the latter. `bun scripts/fleet-list.ts` prints only `Projects/co-real`; `--json` reports `count: 1` and the exclusion row. A malformed-registry fixture exits non-zero with the malformed detail.

### 9.3 Structural routing guard — `tests/unit/fleet-iteration-routing.test.ts`

Two-layer guard so both drift directions fail CI:

1. **Pinned consumers route through the helper**: for each of A1–A8 (paths pinned in a list in the test), the file's source (a) imports from `scripts/lib/fleet.ts` (or `../../lib/fleet.ts` equivalent) and (b) contains **no** `startsWith("co-")` / `startsWith('co-')` filter on a `Projects/` readdir — the literal-prefix pattern is allowed only in `scripts/lib/fleet.ts` and the test itself.
2. **New enumerators cannot sneak in**: scan `scripts/**/*.ts` for `Projects/` directory enumerations (`resolve("Projects")`, `join(…, 'Projects')` feeding `readdirSync`) and assert each hit is either in the pinned A-list, in `scripts/lib/fleet.ts`, or in an explicit allowlist (C-class sites with justifying comments). An unregistered hit fails with "classify this Projects/ enumerator — fleet iteration or not? (design 2026-11-07-fleet-membership-ssot-design §3)".

This mirrors the workspace's existing structural-guard style (source-level pins over brittle behavioral mocks) and is the regression test that "each fleet-iteration script skips an excluded fixture project" at the derivation layer — the scripts' own suites continue to cover their per-project behavior.

### 9.4 Existing suites

All current suites stay green; if a `validate-templates` identity-placeholder test exists, add an excluded-project fixture case. `bun scripts/verify-scripts.ts --verify`, `audit.ts`, and `validate-templates.ts` must pass locally with `Projects/co-abap-plugin` present (it is on disk in the dev checkout).

## 10. Rollout and acceptance

**One implementation PR** (automation-engineer, after user approval of this design):

1. `scripts/lib/fleet.ts` + `scripts/fleet-list.ts` + `docs/fleet-membership.json` (schema of §4, single `co-abap-plugin` row).
2. Refactor A1–A8 to the helper (A7: keep the variant.json gate; helper routing optional). A8 additionally narrows to actual members (§6.1).
3. B-class guards: `upgrade-project.ts` `--allow-non-member` refusal (§6.2), `adopt-project.ts` excluded-name refusal (§6.3), `new-project.ts`/`create-l3-scaffold.ts` excluded-name guard (§6.4); A1–A3 explicit-`--project` WARN (§6.7).
4. Tests of §9 + SCRIPTS.md / VERSION_MANIFEST rows for the two new scripts + `fleet.ts`.
5. Wording edits (§3 list): R19 amendment footnote in the 2026-09-25 design, `project-resync` + `skill-graph-analytics` SKILL.md (all four mirrors each), constitution `09-operations-workflow.md:308` row gains "per `docs/fleet-membership.json` SSOT"; ADR-0089 amendment footnote.
6. Implementer writes `docs/decisions/DEC-20261107-01.md` from §8.
7. **PM applies the §7 wording to the live 01:30 runner prompt** (outside the repo) in the same window the PR lands.

**Acceptance criteria**:

- [ ] With `Projects/co-abap-plugin` present on disk, `bun scripts/fleet-list.ts --json` reports 16 projects and does not list it; `excluded` carries the DEC-referenced row.
- [ ] Every A1–A8 site derives its default set from `lib/fleet.ts`; the structural guard passes and fails when a `co-`-filtered `Projects/` readdir is reintroduced outside the helper.
- [ ] `bun scripts/upgrade-project.ts Projects/co-abap-plugin --preflight` (and any non-`--preflight` form) refuses with the membership message; `--allow-non-member` proceeds with a WARN row. `adopt-project`/`new-project` refuse the excluded name without `--yes`.
- [ ] `resync-audit.ts` / `backport-diff.ts` / `evidence-backport-scan.ts` with no `--project` list 16 projects; `--project Projects/co-abap-plugin` prints the one-line WARN and completes read-only.
- [ ] `skill-graph-fleet-report.ts` and `fleet-script-parity.ts` outputs contain no `co-abap-plugin` row; `audit.ts` and `validate-templates.ts` produce no finding referencing it.
- [ ] The upstream-request channel is untouched: `mcp-upstream-server.ts` registration rule byte-identical (no diff in the PR for that file).
- [ ] Registry absent-file behavior verified: renaming the JSON away makes every fleet tool behave exactly as today (16+1 glob), and restoring it re-applies exclusions — the backward-compatible rollout proof.
- [ ] All §9 tests green; `audit.ts` / `validate-templates.ts` / `verify-scripts.ts --verify` / `bun test` green in CI.

## 11. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None beyond the mirror-synced SKILL.md wording (`.claude/skills/project-resync`, `.claude/skills/skill-graph-analytics` — same text as the other mirrors) | Those two SKILL.md mirrors |
| Antigravity (GEMINI.md) | None — no `.gemini`-specific logic changes; the `.gemini/skills/` mirrors receive the identical SSOT wording applied uniformly to all four mirror trees, so there is no Antigravity-only delta to declare beyond the shared mirror sync | `.gemini/skills/project-resync/SKILL.md`, `.gemini/skills/skill-graph-analytics/SKILL.md` (mirror-sync only) |
| templates/common | None — and this is a hard rule, not an oversight: `Projects/` membership is an L0 workspace-root fact over a gitignored, dev-machine-only directory. `docs/fleet-membership.json`, `lib/fleet.ts`, and `fleet-list.ts` must NOT enter any propagation map, the common-contract delivery, or L1/L2 deliveries | N/A — validated by the structural guard's allowlist (§9.3) which treats any `templates/common` appearance of the fleet helper as a failure |

## 12. Open questions

None blocking. Two recorded non-blocking notes: (1) if `co-abap-plugin` ever wants back in, the reversal is "remove the exclusion row" — no code change; (2) the structural guard's allowlist (§9.3 layer 2) will initially carry the C-class sites; if that list grows unwieldy, a follow-up can fold C-class sweeps into shared scanners, deliberately out of scope here.

## 13. References

- Inventory grep: `origin/main @ 0c18b2f49`, 2026-11-07 (`grep -rn "Projects" scripts/` + per-file verification; line numbers pinned from that revision)
- `docs/designs/2026-09-25-daily-fleet-review-resync-design.md` (R19/R43, runner contract)
- `docs/adr/0089-local-automation-cadence-and-unattended-merge-policy.md` (01:30 cadence, live-prompt custody)
- `docs/adr/0061` (gate-moment DEC records), `docs/decisions/DEC-20261029-01.md` (format exemplar)
- `scripts/helpers/hub-topology.ts` (pure-registry-helper precedent, fail-closed malformed handling), `scripts/lib/git-aware-scan.ts:67` (`filterTransientCheckouts`)
- `scripts/mcp-upstream-server.ts:183` (identity rule), `scripts/validate-templates.ts:6304` (variant.json out-of-scope gate)
- `docs/designs/2026-11-07-handbook-archmap-drift-check-design.md` + PR #1893 (architecture-map canonicality context)
