# Learning extraction batch — design-token retrofit playbook + scheduled-jobs pattern reference (T-20261030-003, T-20261030-004)

- **Status**: Implemented (this PR)
- **Registry status**: `implemented` (docs/specs/registry.json) — flipped via `spec-register.ts --update` in this change set.
- **Date**: 2026-10-31
- **Owner**: docs-writer (0d-1 playbook) + docs-writer (0d-2 pattern reference),
  with the ADR-0080 skill-lifecycle hand-off in §4 (PM Gateway dispatch, after
  user approval)
- **Tickets**: T-20261030-003 (token retrofit playbook), T-20261030-004
  (scheduled-jobs pattern reference, deferred-extraction) — bundled: both are
  distillations of proven variant-side work into reusable fleet references,
  with no engine or template code changes
- **Tier**: L0 (workspace-root docs + `.agents/skills/` declarations)
- **Spec registry id**: `2026-10-31-learning-extraction-design` (registered: proposed)
- **Precedent**: docs/designs/2026-10-30-codeck-render-validation-batch-design.md
  (batch design format); ADR-0080 (skill changes flow through
  skill-lifecycle-manager after design approval)

## 0. Accessibility exemption statement

This design produces documentation and a skill-content outline: no user-facing
UI, no code. The ADR-0065 accessibility sections and the ADR-0070
preview-verification sections are **exempt** for every artifact in this
design.

## 1. Verified evidence

**0d-1 (token retrofit, T-20261030-003):**
- `Projects/co-price/docs/designs/2026-10-29-token-adoption-design.md` §5
  (Migration plan, ~:120): value-preserving staged method — Stage 0 foundation
  (tokens.css + `@theme inline` bridge, no UI change), then per-layer codemod
  stages, each stage ending lint-green with an allowlist delta. §7
  (Sequencing, ~:149): PR-sized stage table (PR-1 foundation → PR-2 type
  scale → PR-3 color/surface with onyx near-duplicate collapse + axe run).
- `Projects/co-price/src/app/tokens.css`: 3-layer token architecture
  (primitive → semantic → component) declared as Token SSOT.
- `Projects/co-price/scripts/design-lint.ts:286-319`: `DesignLintConfig` with
  `scanRoots` / `tokenSources` / `allowlist` — the machine-verified residue
  mechanism (allowlist entries exempt documented raw literals).
- **The gap**: `.agents/skills/design-foundation/SKILL.md` Stage 4 (line 84,
  "Token Architecture") covers greenfield instantiation only — copy
  `docs/design-tokens.template.css` into the project and fill placeholders.
  No retrofit/brownfield path exists. `.agents/skills/token-usage-lint/`
  (v1.1.0, scope common) is detection-only — it scans for raw hex/px/rgba
  literals and relates to `ui-ux-design-intelligence`, but prescribes no
  adoption method.
- **First fleet target verified**: `Projects/co-architect/docs/workspace-schema.json`
  `designLint.allowlist` carries exactly **122 entries**; `tokenSources` is
  absent (no token SSOT yet) — co-architect is pre-Stage-0 and matches the
  retrofit entry condition. Same Tailwind v4 + design-lint substrate as
  co-price.

**0d-2 (scheduled jobs, T-20261030-004):**
- `Projects/co-newbiz/docs/adr/0189-amend-adr-0019-launchd-and-docker-scheduler-model.md`
  (Accepted, 2026-10-29): one OS entry per environment firing a minute-tick
  dispatcher; schedule lives in the DB (runtime-editable cron, no OS
  re-registration); heartbeat liveness replaces job_run-first as the
  did-it-fire signal; Docker production model.
- `Projects/co-newbiz/scripts/co-newbiz/scheduler-core.ts:121-128`:
  `acquireLock` — single atomic INSERT-or-takeover statement; takeover only of
  an EXPIRED lease (CAS fire-once under overlap + expired-lease recovery in
  one statement).
- `Projects/co-newbiz/scripts/co-newbiz/schedule-tick.ts:56-65`: detached
  run-job child (own process group, no parent-side timeout; run-job enforces
  its own timeout plus a hard backstop — the H1/H2 contract).
- `Projects/co-newbiz/scripts/co-newbiz/run-job.ts`: exit contract verified at
  :14, :147, :212, :264 — 0 success/skipped/lock-held, 1 failed, 124 timeout,
  125 hard backstop.
- Secret scrubbing: `Projects/co-newbiz/db/lib/secret-scrubber.ts` EXISTS.
  Ticket cites `scripts/co-newbiz/db/lib/secret-scrubber.ts` — path
  correction recorded: the file lives at `db/lib/` under the project root,
  not under `scripts/co-newbiz/`.
- **Placement check**: `docs/patterns/` does not exist today. `docs/guides/`
  holds operator procedure; `docs/architecture/` holds workspace-structure
  notes. Neither is the honest genre for a reusable runtime shape.

## 2. Decision 0d-1 — playbook vehicle: new thin `design-token-adoption` skill

**Chosen**: a new thin skill `.agents/skills/design-token-adoption/`
(scope: common), related to `token-usage-lint` (extends: the lint detects,
the adoption skill prescribes) and `design-foundation` (prerequisite: a token
architecture exists per its Stage 4).

**Rejected**: extending `design-foundation` Stage 4 with a retrofit track.
Trade-offs: design-foundation is a greenfield stage pipeline (Stages 1-6,
copy-template instantiation); a brownfield track inside it bloats a skill
whose triggers say "new project design foundation", and retrofit has a
different workflow shape entirely (value-preserving codemods over existing
UI, allowlist-driven convergence). token-usage-lint stays detection-only —
giving it adoption duties would change its contract. A thin third skill
matches the granularity precedent (token-usage-lint itself is thin) and keeps
triggers clean ("token retrofit", "allowlist reduction", "adopt design tokens
in existing UI").

**Playbook outline** (skill content, distilled from the co-price source):

1. **Applicability gate**: brownfield project with existing raw-value UI and
   a design-lint substrate; greenfield projects follow design-foundation
   Stage 4 instead.
2. **Stage 0 — Foundation (no UI change)**: instantiate the token SSOT file
   (3-layer architecture), add the `@theme inline` bridge, truth-up
   `scanRoots`/`tokenSources` in the design-lint config. Verify: build green,
   lint green, allowlist count unchanged.
3. **Per-layer codemods, one stage per PR**: type scale → color (near-duplicate
   collapse only under a computed WCAG contrast proof for any value
   participating in a text/background pair) → radii/shadow/layout. Each
   stage: value-preserving mapping at the dominant current value; stage ends
   lint-green with an explicit allowlist delta; ADR-0070 evidence per
   user-facing stage.
4. **Machine-verified residue**: remove-entry-then-relint loop over the
   allowlist; full hex/px/rgba/hsla match collection; dead entries deleted
   (co-price: 158 → 131 entries through the live run).
5. **Exit condition**: allowlist holds only entries with a documented reason;
   `design-lint.ts --json` green.

Source citations embedded in the skill body: the co-price design doc (§5, §7),
tokens.css, design-lint.ts:286-319. First fleet target named in the skill:
co-architect (122-entry allowlist, pre-Stage-0).

**ADR-0080 hand-off**: this design fixes outline, placement, and
relationships only. After user approval, skill content creation routes
through the skill-lifecycle-manager procedure (structured create request →
PM triage → approved execution); the implementing dispatch does not write
the skill unilaterally.

## 3. Decision 0d-2 — scheduled-jobs pattern: `docs/patterns/` reference, promotion deferred

**Chosen**: create `docs/patterns/` at L0 with two files:

- `docs/patterns/README.md` — one-paragraph charter (a pattern = a reusable
  runtime/architecture shape proven in a variant, recorded for other variants;
  distinct from guides (operator procedure), ADRs (this workspace's decisions),
  and architecture notes (workspace structure)) plus the index.
- `docs/patterns/scheduled-jobs-runtime-pattern.md` (v1.0.0) — handbook-style
  reference distilling the co-newbiz P1 runtime pattern. Sections:
  1. **When to adopt**: a variant needs periodic work with runtime-editable
     schedules and no OS re-registration on change.
  2. **The pattern's shape** (7 mechanisms, each with source pointers):
     OS fires one minute-tick dispatcher per environment (launchd/systemd/
     Task Scheduler; Docker `exec` in production); schedule is DB-resident
     (runtime-editable cron); CAS fire-once under overlap; atomic
     expired-lease takeover locks; heartbeat liveness; detached run-job with
     the exit-code contract (0 success/skip/lock-held, 1 failed, 124 timeout,
     125 hard backstop); secret-scrubbed output.
  3. **Provenance**: co-newbiz ADR-0189 (§2-5) with the verified file:line
     citations (§1 above, including the secret-scrubber path correction).
  4. **Adoption checklist**: the five ADR-0189 decision points a variant must
     answer (OS scheduler choice, tick registration, environment marker,
     heartbeat alerting, no in-process execution from the web server).
- **Promotion-deferral boundary (binding)**: NO template/code promotion in
  this batch — no `scripts/` primitive, no template scaffold doc change, no
  skill. The reference is documentation only; each variant implements against
  its own stack. Promotion triggers, recorded in the pattern doc so the
  deferral is auditable: promote to a shared primitive or scaffold asset when
  (a) a SECOND variant demands periodic jobs, or (b) upstream P2+ concerns
  (OS registration tooling, notification fan-out) stabilize — whichever first.

**Rejected**: `docs/guides/` (operator-procedure genre mismatch) and
`docs/architecture/` (describes this workspace's own structure, not
variant-reusable shapes). A dedicated `docs/patterns/` gives the third genre
an honest home and a growth path.

## 4. Files to change

| File | Action | Description |
|------|--------|-------------|
| `.agents/skills/design-token-adoption/` | create (via skill-lifecycle-manager, post-approval) | Thin adoption playbook skill per §2; scope common; relates_to token-usage-lint, design-foundation |
| `docs/patterns/README.md` | create | Charter + index for the patterns genre |
| `docs/patterns/scheduled-jobs-runtime-pattern.md` | create | v1.0.0; the 7-mechanism reference per §3 |

Note: the skill directory is created through the ADR-0080 procedure, not by
this design's implementing docs dispatch directly; the design is its input.

## 5. Validation

Docs-only plus a lifecycle-managed skill creation: `bun scripts/audit.ts`,
`bun scripts/lifecycle-sync-audit.ts` (skill registry consistency once the
skill lands), link check on the new pattern files. No test suites are
affected.

## 6. Rollback

Delete the files. The co-price and co-newbiz sources are untouched upstream
evidence; nothing consumes the new artifacts programmatically.

## 7. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None (docs + `.agents/skills/` declarations; platform mirrors sync-managed if the skill is platform-scoped) | N/A |
| Antigravity (GEMINI.md) | None — same justification: `.agents/skills/` is the cross-platform skill surface; no platform config file changes | N/A |
| templates/common | None in this batch — promotion to `templates/common/skills/` is exactly what the deferral boundary defers; `.agents/skills/` at L0 is the delivery point for the skill content until an adoption demand materializes | N/A |

## 8. Open questions

None. Both vehicle decisions are made with recorded alternatives; the skill
content authoring route (skill-lifecycle-manager) is stated, not open.
