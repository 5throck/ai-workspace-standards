# Scheduled Jobs Runtime Pattern

- **Version**: 1.1.0
- **Status**: Reference (promotion deferred - see Promotion-deferral)
- **Date**: 2026-11-04 (v1.1 operator-control layer; v1.0.0 dated 2026-10-31)
- **Provenance**: co-newbiz, ADR-0189 "Amend ADR-0019 - macOS launchd, a single
  minute-tick dispatcher, and the Docker production model" (Accepted
  2026-10-29, `Projects/co-newbiz/docs/adr/0189-amend-adr-0019-launchd-and-docker-scheduler-model.md`);
  v1.1 adds the P7 operator-control layer (admin API surface, design
  `2026-10-29-scheduled-jobs-design.md` §4-§6)
- **Genre**: pattern (see [README.md](README.md)) - a variant-proven runtime
  shape, not an operator guide and not a workspace decision

## When to Adopt

A variant needs periodic work (collection jobs, retention cleanup, scheduled
reports, watch evaluation) where:

- schedules must be **runtime-editable** (admin UI can change cron expressions
  and enable/disable jobs) with **no OS re-registration** on change;
- jobs run on the host's clock, not an in-app timer (in-process timers die with
  the web server and drift with deploys);
- overlapping or duplicated dispatch must not double-fire a job;
- job output can contain credentials and must never leak them into logs;
- operators need an admin surface over the jobs (run-now, health visibility,
  controlled creation) without giving the web container job-execution power.

If none of these hold (e.g. a single fixed cron with no admin surface), plain
OS scheduler entries are simpler - adopt the pattern for the DB-resident
schedule and fire-once guarantees, not for a one-liner crontab.

## The Pattern's Shape (7 mechanisms)

The OS fires the tick; the database owns the schedule; the application code
owns cron evaluation, fire-once, locking, and secret hygiene. The clock stays
with the OS; the truth stays in the DB.

### 1. One OS entry per environment, firing a minute-tick dispatcher

A single short-lived dispatcher process per environment, launched by the OS
every minute (launchd on macOS, systemd user timers on Linux, Task Scheduler on
Windows). The dispatcher reads due jobs, spawns them, and exits - it is not a
daemon. Cron evaluation happens in application code; per-job OS entries are not
used. In Docker production the entry runs the tick inside the container via
`docker exec`, so jobs execute against the container's DB and environment.
[ADR-0189 §2 Decision 2-3]

### 2. DB-resident schedule (runtime-editable cron)

Enabled flags and cron expressions live in a schedule table, not in OS config.
Admin toggles and cron edits take effect within one minute with no OS
re-registration and no privileged call from the web container. The web server
never executes jobs in-process: a "run now" action only enqueues a request row;
the next tick picks it up. [ADR-0189 §2 Decision 4, §Consequences]

### 3. CAS fire-once under overlap (`last_fire_minute`)

Each job row carries a fire cursor (the last minute it fired). Claiming a fire
is one compare-and-set UPDATE - the cursor advances only from its previously
read value, so two ticks (or two dispatchers) racing the same minute produce
exactly one fire; the loser reads a consumed cursor and skips.
[`Projects/co-newbiz/scripts/co-newbiz/scheduler-core.ts:9` (contract header), `:92-96`]

### 4. Atomic expired-lease takeover locks

Job execution is guarded by a lease lock acquired in a single atomic statement:
INSERT the lock row, or - only if the existing lease is EXPIRED - take it over.
No read-then-write race, no separate sweep required for correctness. Lease
length derives from the job's timeout and retry budget plus a margin, so a
lease outlives every legitimate attempt of the run it protects; the tick also
sweeps stale run rows and releases leftover locks on startup.
[`scheduler-core.ts:117-132` (lease length + `acquireLock`), `:126-128` for the
takeover predicate; ADR-0189 §Consequences for the schema]

### 5. Heartbeat liveness

Every tick upserts a heartbeat row (per environment). A stale heartbeat - not
the absence of recent job rows - is the primary did-it-fire signal and a
high-severity alert. A broken tick stops all jobs, so the heartbeat is the
required mitigation; per-run `job_run` rows remain the audit trail.
[`scheduler-core.ts:282-285` (`writeHeartbeat`); ADR-0189 §2 Decision 5]

### 6. Detached run-job child (no parent-side timeout)

The tick spawns each job runner **detached** - own process group, fire-and-forget
- with NO parent-side timeout: a parent-side timer dies with the tick process,
which by design exits immediately after dispatch. The runner therefore enforces
its own timeout plus a hard backstop at lease length (if everything, retries
included, outlives the lease, the backstop records the run as timed out and
exits non-zero - the backstop is the only enforcer left). The OS registration
must abandon the tick's process group (launchd `AbandonProcessGroup = true`),
otherwise launchd kills the tick's whole group - detached children included -
when the tick exits.
[`Projects/co-newbiz/scripts/co-newbiz/schedule-tick.ts:56-67` (spawn options,
H1/H2 contract)]

### 7. Exit-code contract (verified)

Every runner invocation resolves to one of four codes, so both the tick and a
human operator can distinguish outcomes without parsing logs:

| Code | Meaning |
|------|---------|
| `0` | success, skipped, or lock-held (all healthy non-runs included) |
| `1` | failed |
| `124` | timed out (runner's own timeout) |
| `125` | hard backstop (run exceeded its lease) |

[`Projects/co-newbiz/scripts/co-newbiz/run-job.ts:14` (contract comment), `:147`
(`exit(125)` backstop), `:212` (`exit(124)`), `:264` (CLI exit mapping)]

### Secret-scrubbed output (cross-cutting)

Everything a run writes - `stdout`, `stderr`, `job_run.error`, `detail_json` -
passes through a scrubber before it reaches logs or the DB: values of
secret-shaped env vars (`*_KEY`, `*_TOKEN`, `*_SECRET`, `*_PASSWORD`, `*_PASS`,
`DATABASE_URL`, ...), credential-bearing URL query parameters,
`Authorization: Bearer` headers, and userinfo passwords in URLs are redacted,
and output is truncated after scrubbing. Adapter-specific credential env names
are injected by the scheduler layer so the scrubber module stays dependency-free.
[`Projects/co-newbiz/db/lib/secret-scrubber.ts` (note: under `db/lib/` at the
project root, not under `scripts/co-newbiz/` - ticket-path correction recorded);
`run-job.ts` `installScrubbedOutput`]

## Operator-Control Layer (v1.1 - admin API surface)

P7 adds the admin-facing control plane over the runtime above. The dividing
line stays the same as mechanism 5's: the web container may WRITE schedule
rows, but never EXECUTES jobs or makes privileged OS calls. Three surfaces,
all admin-gated (authenticate + admin role, 401/403 before any body work):

### Run-now is enqueue-only, with still-queued-request reuse

The "run now" action only enqueues a schedule_job_request row - a pure DB
INSERT through the scheduler core's enqueue primitive; no jobs/ handler module
(registry or otherwise) is imported, so no code path exists for in-process
execution. Because the tick's claim loop would run every queued row, a second
run-now while a request for the same job is still queued REUSES that row
instead of stacking a duplicate (response notes `reused`), which caps
double-fires at the API layer. Manual runs are explicit operator actions: any
existing job is eligible regardless of its enabled flag (the tick dispatches
manual requests without an enabled check), unknown keys 404, and the action is
audited. The response is 202-shaped (request id + pickup note); the UI follows
confirm-then-poll - it polls the job's runs endpoint until a run row appears
for that request id. The no-in-process-execution boundary is pinned by a
static import-scan unit test: the test reads the route module's source,
extracts its import specifiers, and asserts none matches the handler-directory
shape while the enqueue primitive is present - so a future handler import
fails CI before it can ship.
[`Projects/co-newbiz/app/web-next/app/api/admin/schedule-jobs/[jobKey]/run/route.ts:23`;
`Projects/co-newbiz/tests/unit/schedule-jobs-api.test.ts:522`]

### Health semantics: 180 s heartbeat, timeout-derived overdue, 3-strike window

A read-only, admin-only health endpoint answers three questions per
environment (it resolves the scheduler environment marker and refuses without
it - no implicit environment, ever; being read-only it is not audited - audit
is for mutations):

- **Tick staleness**: show the health banner when the environment's tick
  heartbeat is older than 180 s (3 minutes). Stale heartbeat stays the primary
  did-it-fire alarm (mechanism 5); a missing heartbeat row reads as unhealthy
  too.
- **Overdue, timeout-derived**: an ENABLED job with a set fire cursor is
  overdue when `now > last_fire_minute + timeout_sec` AND no run row of the
  resolved environment started at/after that fire minute - i.e. a fire the
  tick dispatched never produced a run here. The rule is deliberately
  conservative: the cursor also advances on skip-missed catch-up, so a skipped
  fire reads as overdue until the next run; it never flags never-dispatched
  (NULL cursor) or disabled jobs - total scheduler stop is the tick
  heartbeat's job.
- **Consecutive failures**: a trailing window of the last 3 run rows per job
  feeds a consecutive-failure counter, so a job stuck in a failure loop
  surfaces without a per-run alert storm; a single failure stays at 0.
[`Projects/co-newbiz/app/web-next/app/api/admin/schedule-jobs/health/route.ts:24`
(`TICK_STALE_MS = 180_000`), `:27` (`CONSECUTIVE_FAILURE_WINDOW = 3`), and the
overdue rule in the route's documented header]

### Create accepts registered handler keys only

Job creation is the RCE boundary of the admin console: `job_key` must exist in
the scheduler's handler registry, and a create request naming an unregistered
key is refused with the key named in the error - a free-text command field
would be remote code execution from the admin console. The registry import is
metadata read at create time (key, display name, description, defaults), never
executed handler code - the same posture as seeding. Omitted fields fall back
to the registered defaults (cron/timeout/retries/display name/description);
registry defaults are not subject to the interactive-timeout floor; explicit
fields reuse the edit-path validation rules through a SHARED validator module
(create and PATCH cannot drift). `enabled` defaults to false - create-then-
enable is the safe flow, so enabling stays a separate, deliberate, audited
admin action. Duplicate keys 409; creation is audited with the full created
row.
[`Projects/co-newbiz/app/web-next/app/api/admin/schedule-jobs/route.ts:6-14`
(create contract header), `lib/schedule/job-validate.ts` (shared validator)]

## Provenance

- ADR: `Projects/co-newbiz/docs/adr/0189-amend-adr-0019-launchd-and-docker-scheduler-model.md` §2 (Decision), §3 (Consequences), §5 (Decision log) - Accepted 2026-10-29
- Dispatcher/lease/heartbeat code: `Projects/co-newbiz/scripts/co-newbiz/scheduler-core.ts`, `schedule-tick.ts`, `run-job.ts` (file:line pointers above, verified 2026-10-31)
- Operator-control layer (v1.1): `Projects/co-newbiz/app/web-next/app/api/admin/schedule-jobs/` (`route.ts` create, `[jobKey]/run/route.ts` run-now, `health/route.ts` health) + `lib/schedule/job-validate.ts` (shared validator) + `tests/unit/schedule-jobs-api.test.ts` §9 (import-scan boundary test) - verified 2026-11-04, T-20261103-005
- Design of record: `Projects/co-newbiz/docs/designs/2026-10-29-scheduled-jobs-design.md`

Rejected alternatives worth remembering (ADR-0189 §Alternatives): per-job OS
entries (re-registration on every edit; launchd calendar intervals cannot
express common cron patterns without enumeration); in-container cron daemon
(dies with the container, duplicates the host OS role); reusing the simulation
job queue as the scheduler (different resource-class contract; only its
stale-reclaim pattern was reused).

## Adoption Checklist

Seven decision points a variant must answer before implementing (derived from
ADR-0189's decision set; 6-7 added by the v1.1 operator-control layer):

1. **OS scheduler choice** - launchd (macOS) / systemd user timer (Linux) /
   Task Scheduler (Windows); in Docker production, the tick fires via
   `docker exec` inside the container. One entry per environment.
2. **Tick registration** - which environments register the tick (typically
   both dev and prod), and which job sets start enabled per environment.
3. **Environment marker** - the tick refuses to start without an explicit
   environment variable (co-newbiz: `CO_NEWBIZ_SCHEDULER_ENV`); every run and
   heartbeat records its environment.
4. **Heartbeat alerting** - who watches the heartbeat table and what severity
   a stale heartbeat raises (pattern requirement: high-severity; a broken tick
   stops all jobs).
5. **No in-process execution from the web server** - admin "run now" enqueues a
   request row consumed by the next tick; the web container never runs jobs
   in-process and never makes privileged OS calls.
6. **Run-now posture** - enqueue-only with still-queued-request reuse
   (duplicate cap), manual runs allowed on disabled jobs, 202 + confirm-then-
   poll UX, and a static import-scan unit test pinning the
   no-in-process-execution boundary.
7. **Health visibility and create boundary** - heartbeat staleness threshold
   (co-newbiz: 180 s), timeout-derived overdue rule, consecutive-failure
   window (co-newbiz: trailing 3); job creation accepts registered handler
   keys only via a shared create/edit validator, default-disabled.

Also decide up front: catch-up policy for missed fires after host sleep
(per-job-family: run-once vs skip), and the schema change governing the
schedule/lock/request/heartbeat tables.

## Promotion-deferral

This reference is documentation only - no `scripts/` primitive, no template
scaffold change, and no skill accompanies it; each variant implements against
its own stack. Promote to a shared primitive or scaffold asset when either
trigger fires:

- **(a) Second-variant demand**: a second variant independently requires
  periodic jobs with runtime-editable schedules; or
- **(b) P2+ stabilization**: the upstream co-newbiz rollout's later phases
  (OS registration tooling, notification fan-out) stabilize.

Whichever comes first. Until then, the provenance paths above are the reference
implementation. v1.1 (operator-control layer) extends the documented shape but
changes nothing here - it is deferred under the same trigger as v1.0.0
(T-20261103-005).
