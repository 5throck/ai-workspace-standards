> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §9 Operations Workflow
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 9. Operations Workflow {#operations-workflow}

This section defines the operational procedures for maintaining workspace health and lifecycle hygiene.

#### 9.1 Weekly Agent/Skill Health Check

**Frequency**: Every Friday
**Owner**: PM (Project Manager)
**Duration**: 15 minutes

**Procedure**:
```bash
# Run lifecycle audits
bun scripts/agent-lifecycle-audit.ts
bun scripts/skill-lifecycle-audit.ts

# Review deprecated items
bun scripts/sync-skill-status.ts

# Check for docs/designs/*.md files missing from the spec registry
bun scripts/spec-backfill.ts --check

# Check for ready governance-backlog items (deferred decisions whose soak/review date has passed)
bun scripts/ticket.ts list --ready --kind manual

# Ticket archive dry-run — surface done tickets past the 7-day dwell (AGENTS.md §3.7.5);
# the Weekly Health Check workflow runs the same report automatically (report-only)
bun scripts/ticket.ts archive
```

**Checklist**:
- [ ] All agents show `status: active` or intentionally `deprecated`
- [ ] All skills show `status: active` or intentionally `deprecated`
- [ ] No unexpected state mismatches between files and registry tables
- [ ] Deprecated items list is current
- [ ] No design docs missing from `docs/specs/registry.json` (or run `bun scripts/spec-backfill.ts` to close the gap)
- [ ] No ready governance-backlog tickets ignored — action them or explicitly defer (update `not_before`)
- [ ] Ticket archive dry-run reviewed — past-dwell done tickets applied (`bun scripts/ticket.ts archive --apply`) or consciously deferred

**Output**: Log findings to `memory/YYYY-MM-DD.md` with section "## Weekly Health Check"

---

#### 9.2 Monthly Lifecycle Review Meeting

**Frequency**: First Friday of every month
**Participants**: PM + Architect + Auditor
**Duration**: 60 minutes
**Trigger**: PM schedules via `/meeting "Monthly lifecycle review" --agents pm,architect,auditor`

**Agenda**:
1. **Review deprecated items** (15 min)
   - Agents/skills deprecated for ≥30 days
   - Determine: archive, delete, or extend deprecation period

2. **Archive cleanup** (20 min)
   - Move items to `agents/_archive/` or `skills/_archive/`
   - Update AGENTS.md and docs/context.md tables
   - Remove archived items from active rosters

3. **Template synchronization** (15 min)
   - Review L0 template (templates/common/) changes
   - Plan propagation to variants (co-develop, co-design, co-work)
   - Update templates/VERSION if breaking changes

4. **Action items** (10 min)
   - Create task list for next month
   - Assign owners and deadlines

**Output**:
- Meeting transcript saved to `memory/meeting-YYYY-MM-DD-monthly-lifecycle-review.md`
- Action items tracked via `/new-task` or project management tool

**Archive Criteria**:
- **30 days**: Move to `_archive/` directory
- **90 days**: Permanent deletion (after PM approval)

---

#### 9.3 Quarterly Template Sync

**Frequency**: Start of each quarter (Jan 1, Apr 1, Jul 1, Oct 1)
**Owner**: Template Architect + PM
**Duration**: 2-3 hours

**Procedure**:
```bash
# 1. Run template validator
bun scripts/validate-templates.ts

# 2. Compare L0 (common) with variants (all 13: co-abap, co-consult, co-deck,
#    co-design, co-develop, co-export, co-game, co-hr, co-news, co-price,
#    co-safety, co-security, co-work)
for v in templates/co-*/; do git diff templates/common/ "$v"; done

# 3. Sync changes
# Manual review and propagation of:
# - .claude/settings.json
# - .claude/commands/
# - scripts/audit.ts, dev-sync.ts, etc.
# - AGENTS.md structure
```

**Checklist**:
- [ ] All variants share common scripts from L0
- [ ] Version numbers in templates/VERSION are consistent
- [ ] Breaking changes documented in CHANGELOG.md
- [ ] AGENTS.md rosters are synchronized across variants
- [ ] docs/context.md immutable sections match L0

**Output**: Update `templates/VERSION` and document changes in workspace CHANGELOG.md

##### 9.3.1 Variant Enhancement Workflow

When adding a feature to an existing variant (new agent, skill, script, or docs), use the automated helper script instead of manually creating stubs:

```bash
# Add a feature to an existing variant (creates all relevant stubs at once)
bun scripts/variant-feature.ts --variant co-deck --feature slide-export [--type agent|skill|script|docs|all]
```

When promoting an existing `Projects/<name>/` project to a reusable `templates/<name>/` variant:

```bash
# Promote L3 project → L2 variant template (diffs against templates/common/, generates variant.json)
bun scripts/project-to-variant.ts --source Projects/co-legal --target co-legal [--dry-run]
```

Both commands auto-register a spec via `spec-register.ts`. Run `bun scripts/validate-templates.ts` after promotion to verify template integrity.

---

#### 9.4 On-Demand Synchronization

**Triggers**:
- New agent/skill created
- Agent/skill deprecated
- L0 template breaking change
- Critical bug fix in shared scripts

**Commands**:
```bash
# Sync skill status
bun scripts/sync-skill-status.ts

# Full workspace audit
bun scripts/audit.ts

# Spec-drift check only (relevance check Fails — see note below)
bun scripts/audit.ts --spec-check

# ADR→governance linkage check (warn-only, non-blocking)
bun scripts/audit.ts --governance-check

# Template validation
bun scripts/validate-templates.ts
```

> **`--spec-check` mode** (added v2.10.0): Runs three checks against `docs/specs/registry.json` —
> (1) code files changed with no linked spec → FAIL (since ADR-0055 Stage 2, 2026-08-23 — was WARN),
> (2) `approved` specs stale >14 days → WARN,
> (3) registry entries whose spec file is missing → WARN.
> This mode is automatically invoked by `dev-sync.ts` (step 3.9) before every `/sync` commit — as a **blocking gate** since ADR-0055 Stage 2: a relevance Fail aborts the sync before branch/commit (a manual `--spec-check` run exits 1). Escape hatch: `--spec-exempt=E1..E5` (or `SYNC_SPEC_EXEMPT` env), validated against the AGENTS.md §5.1.1 Design Gate exemption categories — invalid codes hard-Fail.

> **`--governance-check` mode** (added v2.20.0, ADR-0059): Runs `verify-adr-governance.ts` — Accepted ADRs dated
> on or after 2026-08-23 must be referenced from at least one governance doc (CONSTITUTION.md, `docs/constitution/`,
> `docs/governance/`) using the canonical `ADR-00NN` form; unlinked ADRs → WARN. Earlier ADRs are grandfathered.
> Since ADR-0059 Stage 2 (2026-08-23), `dev-sync.ts` step 3.97 runs `verify-adr-governance.ts --strict` as a blocking gate — an unlinked post-cutoff Accepted ADR aborts the sync before branch/commit; since ADR-0059 Stage 2b (2026-08-23), intentional-duplicate marker-hash drift also blocks under the same strict gate. Marker hashes are section-scoped (sha256-8 of the source section slice); the remedy is to review the flagged duplicate section, update it if stale, re-seed via `verify-adr-governance.ts --update-marker-hashes`, and re-run the sync. The `audit.ts --governance-check` flag itself remains a non-blocking diagnostic. New ADRs from the cutoff on require frontmatter `status:` + `date:`.

> **Typecheck gate** (added 2026-09-10, T-20260910-012): `dev-sync.ts` step 3.95b runs `scripts/typecheck.ts` — `tsc --noEmit` over `scripts/` against the zero-error baseline (`scripts/helpers/typecheck-baseline.json`) — as a **blocking gate** in the root context; L1+ contexts skip cleanly via the missing-baseline guard. Baseline policy: never raise the error count — fix the error instead.

**Responsibility**:
- **Agent/Skill changes**: Creator runs sync scripts immediately
- **L0 template changes**: Architect propagates to all variants within 1 week
- **Critical bugs**: Security & Git Expert patches immediately across all templates

---

#### 9.5 Operational Metrics

Track these metrics monthly to ensure operational health:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent health | 100% active or intentionally deprecated | `agent-lifecycle-audit.ts` |
| Skill health | 100% active or intentionally deprecated | `skill-lifecycle-audit.ts` |
| Deprecated backlog | <5 items | Count of `status: deprecated` |
| Archive age | <90 days | Oldest file in `*_archive/` |
| Template sync lag | <7 days | Days since L0 change propagated |

**Reporting**: Include metrics in monthly lifecycle review meeting

---

#### 9.6 Escalation Procedures

**Level 1: Routine issues** (audit failures, state mismatches)
- **Owner**: Any team member
- **Action**: Run sync scripts, fix mismatches, commit
- **Timeline**: Within 24 hours

**Level 2: Deprecated items ≥30 days**
- **Owner**: PM
- **Action**: Schedule monthly review, decide archive/delete
- **Timeline**: Within next monthly review

**Level 3: Template divergence**
- **Owner**: Template Architect
- **Action**: Run quarterly sync, propagate changes
- **Timeline**: Within 1 week of detection

**Level 4: Critical vulnerabilities**
- **Owner**: Security & Git Expert
- **Action**: Immediate patch across all templates
- **Timeline**: Within 24 hours

---

#### 9.7 Spec Registry & Design Gate

> **Added 2026-06-24** — Part of the 3-layer Workflow-Integrated Development Methodology.

##### Overview

The workspace uses a lightweight spec registry (`docs/specs/registry.json`) to track design decisions from inception through implementation. This enforces the principle that development never starts without a linked design artifact.

**Three workflow layers** (distinct from the L0/L1/L2/L3 *template* hierarchy):

| Layer | Name | Purpose |
|-------|------|---------|
| Layer 1 | Design Gate | Mandatory spec creation before any development begins |
| Layer 2 | Feature Automation | Scripted stub generation for variants (`variant-feature.ts`, `project-to-variant.ts`) |
| Layer 3 | Lifecycle Tracking | Drift detection in `audit.ts --spec-check`; status updates in `/sync` |

> **Terminology note**: "Layer 1/2/3" here refers to *workflow layers*, not template propagation tiers. Template tiers are always written as L0/L1/L2/L3 (uppercase L with digit) — see [CONSTITUTION.md §Terminology Definition](../../CONSTITUTION.md#terminology-definition).

##### Spec Registry Schema

File: `docs/specs/registry.json`

```json
{
  "specs": [{
    "id": "YYYY-MM-DD-topic-slug",
    "title": "...",
    "file": "docs/designs/YYYY-MM-DD-topic-design.md",
    "status": "draft | approved | implemented | drifted",
    "source": "brainstorming | meeting | manual",
    "meeting_ref": "memory/meeting-YYYY-MM-DD-slug.md",
    "created": "YYYY-MM-DD",
    "last_updated": "YYYY-MM-DD"
  }]
}
```

##### Three Design Gate Entry Points

| Entry Point | Command | Auto-status |
|-------------|---------|-------------|
| brainstorming skill | saves spec to `docs/designs/`, then `spec-register.ts --source brainstorming` | `approved` |
| `/meeting --spec` | after transcript is archived, generates spec draft + `spec-register.ts --source meeting --ref <file>` | `draft` |
| Variant A-1 manual | `spec-register.ts --file memory/[name]-plan.md --source manual` | `draft` |

##### CLI Reference

```bash
# Register a new spec
bun scripts/spec-register.ts --file <path> --source brainstorming|meeting|manual [--ref <meeting-file>]

# Update spec status
bun scripts/spec-register.ts --update <id> --status draft|approved|implemented|drifted

# List specs by status
bun scripts/spec-register.ts --list [--status approved]
```


#### 9.8 Projects End-of-Life Policy

Projects under `Projects/` have an explicit end-of-life path so promoted variants do not leave ambiguous live copies behind.

**States**:
- `active`: live project or seed used for current work.
- `deprecated`: no new feature work; security/critical fixes only while downstream users migrate.
- `archived`: moved under `Projects/_archive/<name>/` for historical reference; excluded from routine fleet validation unless explicitly requested.
- `removed`: deleted after the archive retention window and PM approval.

**After variant promotion**:
1. Record whether the source project remains active, is deprecated, or is archived.
2. If the project is only a seed for the new variant, move it to `Projects/_archive/<name>/` after promotion validation and PR merge.
3. Keep the promoted `templates/<variant>/` as the reusable source of truth; do not continue parallel template work in the archived project.

**Removal criteria**:
- The promoted variant has passed at least one post-promotion validation cycle.
- No open tickets, docs, or workflows reference the project as a live source.
- Required evidence, designs, and lifecycle records have been copied to the variant or retained in `memory/`.
- PM explicitly records the removal decision in a memory log or decision record.

#### 9.8 Nightly Unified Batch Runner (Local Runner)

Single local ZCode runner (automation-dfba3ff1, daily 03:00 KST) that executes the governance-ticket batch, the review+resync cycle, and merge sweeps in one pipeline. Normative decisions: [ADR-0105](../../docs/adr/0105-unified-batch-runner.md) (merge authority, billing-wall exception, protected paths, watchdog — supersedes ADR-0082's never-merge rule for THIS runner only); [ADR-0082](../../docs/adr/0082-local-only-governance-ticket-processing.md) (ticket-batch contract — four gates, state machine, human-only `review → done` — carried over unchanged; itself superseded [ADR-0071](../../docs/adr/0071-nightly-governance-ticket-automation.md)'s dual-runner cadence); [ADR-0089](../../docs/adr/0089-local-automation-cadence-and-unattended-merge-policy.md) (Decision 1/2 cadence and merge tables superseded by the unified runner; Decision 3 schedule-change rule stays in force). Historical records: ticket-batch automation `docs/designs/2026-09-11-nightly-ticket-batch-automation-design.md`; migration `docs/designs/2026-09-19-local-ticket-runner-migration-design.md`; fleet runner `docs/designs/2026-09-25-daily-fleet-review-resync-design.md`; unified runner `docs/designs/2026-11-12-unified-batch-runner-design.md`.

| Time (KST) | Runner | Batch |
|---|---|---|
| 03:00 daily | Local ZCode unified batch runner (workspace automation, automation-dfba3ff1) | Pipeline steps A–J: ticket batch → root open-PR merges → root review+fix+PR+merge → fleet open-PR merges → per-project reviews + upstream filing → fleet findings resolution → backporting → backport PR merge → upgrade waves (canary-first) → final CLEAN sweep; global wall 13:00 |
| 13:00 daily | Host watchdog (crontab → `scripts/watchdog-automation-stop.ts`) | Writes the `.pipeline-state/automation-stop` stop-file at the wall; the run stops at its next boundary (never mid-merge); past deadline + 15 min the automation lock is stamped dead for `--break-stale` recovery |
| manual | GitHub dispatch (`nightly-tickets.yml`) | emergency fallback only — schedule retired 2026-09-19 |
| 03:30 daily | GitHub-hosted schedule (`.github/workflows/fork-watch.yml`) | upstream fork watch + report — GitHub-hosted; its schedule changes follow the ADR-0089 schedule-change regime (registered T-20260927-004) |
| Sat 04:00 | GitHub-hosted schedule (`.github/workflows/edu-sync.yml`) | education-repo content sync via PR (patch allowlist, credential-free agent phase) — GitHub-hosted; its schedule changes follow the ADR-0089 schedule-change regime (registered T-20260927-004) |

**Pipeline step order and per-step deadlines** (design AC-2): STEP A ticket batch → 05:00; STEPS B–D root/fleet open-PR merges and root review+fix → 06:30; STEP E per-project reviews + upstream filing (review-and-file only — never claims tickets) → 08:30; STEP F findings resolution → 09:30; STEPS G–H backporting + backport PR merge → 10:30; STEP I upgrade waves (canary-first, per-project PR merges) → 12:00; STEP J final CLEAN sweep → 12:45. A step that hits its deadline stops at its boundary, records a SKIPPED-BUDGET row in the run manifest, and the skipped work carries to the next night (carried upgrade waves run first).

**Merge authority** ([ADR-0105](../../docs/adr/0105-unified-batch-runner.md)): the runner may merge a generic open PR only when the merge predicate passes — at least one completed check and zero failures (an empty status rollup is NOT CLEAN), the mechanical worktree check (`scripts/lib/repo-integrity.ts`) passes, no foreign-author rides, and a clean full-config gitleaks scan (`.github/gitleaks-full.toml`) on the exported changed-path contents. While the account-level Actions billing wall is active (`T-20261110-008`), exception merges require all nine ADR-0105 conditions (startup_failure-class evidence, compensation battery, author allowlist, cap 16 wave-atomic, manifest record, mechanical expiry). A PR touching any path in `docs/protected-paths.json` is hold-for-human-merge: the runner NEVER merges it — governance, authority, and gate files are outside its reach.

**First-fire precondition**: the governance PR carrying ADR-0105 must be merged by 02:00 KST on 2026-11-13; if not, the runner aborts no-op and re-arms its skip guard.

**Collision lock and kill-switch**: the runner holds the atomic lock `.pipeline-state/automation.lock` (gitignored) — defer, never skip, while held. The stop-file `.pipeline-state/automation-stop` (JSON: reason, timestamp, pid) is the single degraded-mode enforcement point: written by the watchdog at the 13:00 wall or by the runner on the >2-unexpected-gate-failures stop (`docs/expected-gate-failures.json` is the sanctioned-repairs list — repairs against it are logged, not escalated).

**Evidence**: the STEP-0 run manifest `.pipeline-state/run-manifest-<date>.json` (pre/post HEAD per repo, merged PR SHAs, sanctioned-repair log, billing-wall evidence) written before any merge; the end-of-run summary appends to `memory/YYYY-MM-DD.md` (steps executed, PR URLs, validation results, skipped-and-why).

**Missed-run rule**: the run is tied to the workstation being on at 03:00 KST. If the machine was off or the run failed, ready tickets simply wait — they remain visible to `bun scripts/ticket.ts list --ready --kind manual` at session start and in the Weekly Health Check (§9.1), and the next 03:00 run claims them. While a manual GitHub dispatch is in progress, the runner reports only and stops.

---

*operations-workflow.md version: 1.0 — created 2026-05-27*
