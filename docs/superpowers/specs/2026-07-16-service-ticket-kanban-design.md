# Design: Local Service Ticket + Kanban (Phase A)

**Date**: 2026-07-16
**Status**: Approved (post-review, includes full replacement of the 2026-05-28 Kanban design)
**Scope**: Workspace root (L0) only — `services.yaml`, `tickets/`, `scripts/ticket.ts`, `scripts/helpers/ticket-schema.ts`, `skills/ticket-run/`
**Related**: `docs/designs/ai-workspace-service-platform-roadmap.md` (long-term direction this is Phase A of), `memory/meeting-2026-07-16-ticket-kanban-design-review.md` (4-agent design review), superseded: `memory/archive/meeting-2026-05-28-kanban-process-design.md`

---

## 1. Problem

Two previously separate needs converge here:

1. **Repeated/routine work** (translate a doc, run an audit, produce a CAD analysis) should be requestable as a discrete, trackable unit of work — a "service ticket" — rather than an ad-hoc chat request, so it can be queued, prioritized, and later scheduled or delegated to a hosted worker (see the platform roadmap).
2. **General task tracking** (the workspace has event-driven pipelines — `/sync`, `/changelog`, `/memlog` — but no visual state-machine for "what's in progress right now"). A Kanban design for this was proposed 2026-05-28 but never implemented.

On 2026-07-16 the user decided to **fully replace** the unimplemented 2026-05-28 Kanban design with a single unified schema, rather than run two parallel systems. General human tasks are folded into the same ticket schema as a non-executable ticket kind.

## 2. Solution

A single file-based ticket queue with a service catalog, covering both AI-executed service requests and plain human tasks, distinguished by a `kind` field that gates whether execution is permitted at all.

### 2.1 Architecture

```
services.yaml (catalog, root)          tickets/T-<date>-<seq>.yaml (queue)
┌────────────────────────────┐         ┌─────────────────────────────┐
│ id / name / run{type,ref}  │ ◄────── │ kind: service → run.ref must │
│ inputs[] declarations      │  refs   │   match a services.yaml id   │
│ schedule: (schema only,    │  only   │ kind: manual  → no run field │
│  Phase 2 — no runtime)     │         │   permitted at all           │
└────────────────────────────┘         └─────────────────────────────┘
                                                     │
                            scripts/ticket.ts  create/list/next/move/board
                                                     │
                            scripts/helpers/ticket-schema.ts (validation,
                            transition enforcement, schemaVersion check)
                                                     │
                            skills/ticket-run/SKILL.md
                            (kind: service only — pulls next, executes,
                             success→review, fail→failed+attempts++)
```

### 2.2 Ticket kinds (supersedes the 2026-05-28 design's separate board.md)

| Kind | Purpose | `run` field | Auto-pulled by `next`? |
|---|---|---|---|
| `service` | AI executes a catalog service against declared inputs | Required; `ref` must resolve to a `services.yaml` entry via the allowlist (§2.5) | Yes |
| `manual` | Plain human task (the old Kanban design's use case — bug fix, doc write, review) | **Forbidden** — schema rejects any `run` key on a `manual` ticket | No — `next` only considers `kind: service` tickets |

This is the schema-level separation the security review requires: a human free-text ticket can never carry an executable reference, because the field doesn't validate if present at all on that kind.

### 2.3 Schemas

`services.yaml` (root):
```yaml
schemaVersion: 1
services:
  - id: translate-readme
    name: README Translation
    description: Translate README to Korean
    run: { type: skill, ref: translate }
    inputs: [target_file]
  - id: audit
    name: Workspace Audit
    run: { type: script, ref: scripts/audit.ts }
schedule:            # schema only — no runtime in Phase A (roadmap §3.5)
  - service: audit
    cron: "0 2 * * *"
```

`tickets/T-<YYYYMMDD>-<seq>.yaml` (one file per ticket):
```yaml
schemaVersion: 1
id: T-20260716-001
kind: service                # service | manual
service: translate-readme    # present only when kind: service
inputs: { target_file: README.md }
priority: normal              # low | normal | high | urgent
status: waiting                # backlog | waiting | running | review | done | failed
attempts: 0
created_at: 2026-07-16T10:00:00+09:00
history:
  - { at: 2026-07-16T10:00:00+09:00, from: null, to: backlog }
result: null
error: null
```

### 2.4 State machine

```
backlog → waiting → running → review → done
                        │         │
                        └─→ failed ┘ (failed → waiting is a manual retry, increments attempts)
```

- `backlog → waiting`: manual `move` in Phase A (a Phase 2 scheduler would trigger this automatically for scheduled services — reserved, not built).
- `waiting → running`: only via `ticket.ts next`, and only for `kind: service` tickets.
- `running → review | failed`: set by `skills/ticket-run` after executing (or by the human directly for `kind: manual`, which skips `running` entirely and goes `waiting → review` on manual `move`).
- `review → done`: always a human `move` — this gate is never automated (roadmap invariant #4).
- `failed → waiting`: manual `move --force`, increments `attempts`. No automatic retry.
- All other transitions are rejected by `ticket-schema.ts`'s single exported `TRANSITIONS` table.

### 2.5 Execution safety (`kind: service` only)

- `run.ref` is read **only from `services.yaml`**, never from ticket content — a ticket only carries a `service` id, which is looked up in the catalog.
- Catalog `run.ref` must match an allowlist: `^scripts/[a-z0-9-]+\.ts$` for `type: script`, `^[a-z0-9-]+$` resolved under `skills/` for `type: skill`. The resolved path is asserted to remain under the workspace root.
- `ticket-run` invokes execution via array-form spawn (`Bun.spawn([...argv])`), never shell-string interpolation. Ticket `inputs` are passed as a single JSON argument, validated beforehand against the service's declared `inputs[]` names (allowlist pattern `^[a-z0-9_-]+$`, length-capped).
- YAML is parsed with `js-yaml`'s `JSON_SCHEMA` (no arbitrary tags), with a file-size cap before parsing.
- `error` field content (stdout tail on failure) should avoid echoing raw secrets; document "no secrets in ticket inputs — reference environment variable names instead" in the skill's usage notes.

### 2.6 CLI (`scripts/ticket.ts`)

```
bun scripts/ticket.ts create <service-id|--manual "title">  [--priority ...] [--inputs '{"k":"v"}']
bun scripts/ticket.ts list [--status waiting] [--json]
bun scripts/ticket.ts next                      # kind:service only, waiting→running, highest priority first
bun scripts/ticket.ts move <id> <status> [--force]   # --force required for non-adjacent transitions
bun scripts/ticket.ts board [--html]             # console kanban, or static single-file HTML board
bun scripts/ticket.ts doctor                     # flags stale `running` tickets (age > N minutes)
```

- Ticket file creation uses `{ flag: 'wx' }` (fails on existing path) with seq computed from a directory scan, retrying on `EEXIST` — prevents ID collisions from near-simultaneous creates without needing a lock file.
- Status updates are written via temp-file + `renameSync` (atomic on the same volume, including Windows) — never in-place partial writes.
- `board --html` escapes all ticket-derived text before embedding it in HTML and includes a restrictive CSP meta tag (`default-src 'none'; style-src 'unsafe-inline'`).

### 2.7 `skills/ticket-run/SKILL.md`

- `scope: local` (not `common` — this is L0-only for Phase A).
- Frontmatter includes `metadata.triggers`; must not collide with existing skill triggers (checked against `new-task`, `memlog`, etc. at implementation time).
- Behavior: `ticket.ts next` → if a `kind: service` ticket is returned, resolve its `service` against `services.yaml`, execute per §2.5, move to `review` on success or `failed` (with `error` + `attempts++`) on failure. Does not touch `kind: manual` tickets. One invocation processes exactly one ticket and exits (no internal polling loop); repeated processing is the caller's responsibility (Phase C, roadmap §3.5 covers Human/pull invocation).
- Relationship to `scripts/dispatch.ts`: `dispatch.ts` is the existing session-scoped, ad-hoc multi-agent fan-out tool with no persistent state. It is **not superseded** by this design and is not the same layer. If a ticket's referenced service itself requires multi-agent work, `ticket-run` may invoke `dispatch.ts` as an implementation detail of executing that one ticket — the ticket queue is the new persistent layer that `dispatch.ts` never had.

## 3. Workspace boundary (L0-only)

- `services.yaml`, `tickets/`, `scripts/ticket.ts`, `scripts/helpers/ticket-schema.ts`, `skills/ticket-run/` must not propagate into projects scaffolded via `new-project.ts`. Add explicit entries to `WORKSPACE_ONLY_FILES` in `scripts/new-project.ts:315` (verify the copy-exclusion logic actually covers directories, not only single files) and/or use the `@l2-propagate:false` header / `l2_propagate: false` frontmatter mechanisms already used elsewhere in this repo.
- `scripts/ticket.ts` is registered in the script registry via the script-lifecycle-manager skill, not by hand-editing.

## 4. Git tracking policy

- **`tickets/*.yaml` is gitignored.** Each ticket's `history[]` field is itself the audit trail; tracking every status-transition rewrite in git would force a `/sync` cycle (changelog + PR) per ticket move, which is disproportionate under this repo's commit policy.
- **`services.yaml` and the schema/validator code are tracked normally** — they are project configuration, not transient queue state.
- Ticket-state transitions are explicitly exempted from the CHANGELOG `[Unreleased]` obligation. This exemption does not extend to `kind: manual` tickets representing real completed work (e.g., a bug fix) — those still get a normal changelog entry for the actual change, independent of the ticket's own lifecycle.

## 5. Error handling

- Invalid transitions are rejected with an error listing the allowed target states for that ticket's current status.
- `running` tickets older than a configurable threshold are flagged (not auto-failed) by `ticket.ts doctor` / `list`, for human triage.
- No automatic retry: `failed → waiting` is always an explicit human `move --force`, which also increments `attempts`. Unbounded automatic retries are out of scope.

## 6. Testing

- `ticket-schema.ts`: exhaustive transition-matrix test over all `(status, target)` pairs, for both `service` and `manual` kinds (confirming `manual` tickets reject `running` entirely).
- ID generation: concurrent-create simulation confirms no collision (via the `wx`-flag retry loop).
- `next`: priority-ordering test (urgent > high > normal > low, then creation order) and kind-filtering test (never returns a `manual` ticket).
- Schema validation: rejects tickets/catalog entries missing `schemaVersion`, rejects `run` present on a `manual`-kind ticket, rejects `run.ref` outside the allowlist pattern.

## 7. Out of scope (Phase A)

Central server, authentication, billing, multi-worker concurrency/locking, a workflow DSL (multi-step services stay expressible as a single skill instead), a resident scheduler process (the `schedule:` catalog field is schema-only), propagation to `templates/common/`, GitHub Projects sync (retired from the 2026-05-28 design, not carried forward), ticket provenance/signing and per-service `zod` input schemas (noted for Phase B/C in the roadmap).

## 8. Migration note (from the 2026-05-28 design)

No migration code is needed — the prior design was never implemented (no `kanban/` directory, no `scripts/kanban.ts` exist in the repo). This section exists only so a future reader does not go looking for one. See `memory/archive/meeting-2026-05-28-kanban-process-design.md` for the retired transcript.
