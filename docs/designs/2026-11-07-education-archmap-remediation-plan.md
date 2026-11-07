# Plan: Handbook currency + architecture-map hub-and-spoke remediation

- **Spec ID**: `2026-11-07-education-archmap-remediation-plan`
- **Date**: 2026-11-07
- **Status**: Proposed (execution pending user go)
- **Origin**: 2026-11-07 handbook freshness audit (both handbooks @ merged edu-sync 2026-11-07: intro `6767029`, MAH `78aeee6`) + 2026-11-07 architecture-map gap check (`docs/architecture/` workspace-architecture.svg is dated 2026-10-02 with a basis line pinning template VERSION 0.9.0 vs current `templates/VERSION` 0.28.0, zero hub-and-spoke in all 4 locales)
- **Tracking tickets**: T-20261107-002 (rows 0-1), T-20261107-003 (row 2), T-20261107-004 (row 3)

## Findings (verified)

### Workspace changes postdating the handbook sync cut

Both education handbooks (`multi-agent-harness-handbook`, `intro-to-ai-harness`) were synced from workspace content at their merged edu-sync commits of 2026-11-07 (intro `6767029`, MAH `78aeee6`). Four workspace changes postdate that cut and are therefore absent from both handbooks:

- **Per-session worktree convention** — `docs/designs/2026-11-07-session-worktree-convention-design.md` (T-20261106-010, PM decision: ADOPT with hybrid scope), codified as the per-session worktree convention in `docs/governance/agents/workflows.md` §4.1: concurrent write sessions isolate in `git worktree`s (branch `pr/<YYYYMMDD>-<slug>` from `origin/main`), plus the checkout-recovery convention for foreign-session flips.
- **External-deps machinery** — `docs/designs/2026-11-07-external-deps-machinery-design.md`: `external-deps.json` manifest + `scripts/lib/external-deps.ts` loader, with "never vendor external repos into template trees" as the settled distribution rule and an EXTERNAL DEPS pass added to the upgrade-project flow.
- **Pre-commit zero-delta SCRIPTS.md gate fix** — `docs/designs/2026-11-07-precommit-zero-delta-gate-design.md` (U-20261107-001): the pre-commit Lifecycle Compliance Check (check 6) keyed off a staged-file-set proxy that could not observe a zero-content-delta `scripts/SCRIPTS.md`, hard-failing retries of an already-satisfied invariant; fixed to read content deltas.
- **Deck emitter ppt-master rebase** — `docs/designs/2026-11-06-deck-emitter-ppt-master-rebase-design.md`: the co-work deck pipeline rebased onto external ppt-master v6.8.0 behind a `ppt-master-adapter.ts` boundary (Phase 1+2).

### Handbook audit verdicts

- MAH upgrade chapter describes `upgrade-project` in depth **without the EXTERNAL DEPS pass** (introduced by the external-deps machinery above).
- **Both handbooks lack the worktree convention** (§4.1 per-session isolated worktree + checkout recovery).
- MAH PM-row coverage is partial — it does not carry the **"PM running on:" header requirement** (execution-plan §5.1 rule: every plan starts with that line; PM rows are mandatory with every column filled).
- Intro misses the **hub-and-spoke** topology and **destructive-file-ops** What's-new entries (AGENTS.md Hub-and-Spoke Topology section; §7 Destructive File Operations baseline behavior).
- Intro Appendix E nav label still reads graft-era (pre-hub-and-spoke wording).
- The architecture diagram (`docs/architecture/workspace-architecture{,.en,.es,.ja}.svg`, 4 locales) has **zero hub-and-spoke** content and a **stale basis line** (dated 2026-10-02, basis pinning template VERSION 0.9.0; current `templates/VERSION` is 0.28.0).

## Execution plan

PM running on: inherit (glm-5.3-flash)

| # | Task | Agent | Tier | Model | Platform |
|---|------|-------|------|-------|----------|
| 0 | Architecture-map design amendment (hub-and-spoke plane, basis-line + VERSION refresh) → amend `docs/designs/2026-10-02-workspace-architecture-diagram-design.md`, spec-register | architect | High | inherit (glm-5.3-flash) | zcode |
| 1 | Architecture SVG hub-and-spoke: 4 locale files (ko base + en/es/ja) per amended design + companion md check | automation-engineer | Low | inherit (glm-5.3-flash) | zcode |
| 2 | MAH edu-sync next PR: P1 external-deps (intro/10 + appendix/E flow legend), P1 worktree convention (workflows/11 + appendix/E), P2 PM-row header (intro/08) | docs-writer | Medium | inherit (glm-5.3-flash) | zcode |
| 3 | Intro edu-sync next PR: P1 external-deps (appendix/G + ch05 context), P1 worktree convention (ch14), P2 hub-and-spoke + destructive-file-ops parity (appendix/G / ch05 scope decision), P3 nav-label wording | docs-writer | Medium | inherit (glm-5.3-flash) | zcode |
| 4 | QA + merges + handbook PR merges (`bun run ci` per repo, workspace audit) | automation-engineer | Low | inherit (glm-5.3-flash) | zcode |
| 5 | `/sync "docs(governance): handbook + architecture-map remediation (plan 2026-11-07-education-archmap-remediation-plan)"` — lifecycle + audit + commit + push + PR | pm | Medium | inherit (glm-5.3-flash) | zcode |

**Execution Order**: Sequential 0 → 1; rows 2 and 3 in parallel after row 1 lands; row 4 last; `/sync` final.

### Sequencing

- Rows 0 → 1 serial: the SVG work (row 1) must follow the amended design (row 0).
- Rows 2 and 3 run in parallel after row 1 lands, so handbook text can cite the amended map.
- Row 4 last: QA + merges only after all content rows land. When a plan spans more than one PR, merge each PR before branching for the next row's work (sequential branch dependency rule, CONSTITUTION.md §3.3).

### Acceptance

- Map SVGs carry the hub-and-spoke plane in all 4 locales, with a fresh basis line (current template VERSION + date).
- Both handbooks cover the 4 post-sync-cut changes, each with a What's-new (2026-11) note.
- All CI green (workspace audit + both handbook repos' CI).

### Out of scope

- MAB bun.lock/package.json drift — pre-existing; separate ticket if ever pursued.
- Zero-delta gate — N/A for both handbooks (workspace-side fix already implemented).
