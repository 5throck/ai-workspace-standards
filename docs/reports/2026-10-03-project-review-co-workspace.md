# Project Review — co-workspace (시안 + service) — 2026-10-03

**Date**: 2026-10-03
**Scope**: scoped — co-workspace domain: 13 design docs (`docs/designs/*co-workspace*`/`*coworkspace*`), the service (`services/co-workspace/` ~7,000 LOC, 6-file docker fleet), 29 root test suites
**Method**: machine battery + 4 parallel specialist agents (Architecture / Standards+Lifecycle / Automation / Documentation+Security), Explore read-only
**Note**: 시안 중심 요청에 따라 설계 문서를 1차 검토 대상으로 삼고, 구현 코드를 근거로 대조 검증했습니다.

> Analysis only — no code or governance files were modified in this review. All follow-ups are ticketed (see Action wiring).

## Baseline (Step 0)

| Validator | Result |
|---|---|
| `bun scripts/audit.ts` | PASS (exit 0) |
| `bun scripts/validate-templates.ts` | PASS — 0 errors / 25 warnings (all known WARN-only size budgets) |
| `bun scripts/verify-scripts.ts --verify` | PASS — 217 scripts, 0 warnings |
| `bun run agent-lifecycle-audit` | exit 0, 1 WARN — `agents/pm.md` frontmatter `last_updated` (2026-10-02) older than last content commit (2026-10-03) |
| `bun run skill-lifecycle-audit` | PASS — 42 skills healthy |
| `propagate-to-templates.ts --check-drift` | tolerated-overlay drift only (the documented gemini/root-settings overlay state) |

base-map MCP: not available (skipped per skill).

## Review Results — co-workspace — 2026-10-03

**Headline**: 🔴 Critical **0** · 🟡 High **10** · 🟢 Moderate **22** · ℹ️ Low **6**. The load-bearing security architecture held up: every hardening decision traced (auth exemptions, provisioning gate, broker policy, rotation semantics) matches its authoritative design doc, and 13 of 14 baseline security findings have verified code-level closure. The findings concentrate in **doc-lifecycle debt** (statuses, supersession, ADR addenda), **turn-lifecycle robustness** (claude/codex runtimes), and **deployment-posture honesty** (process isolation, README).

### 🔴 Critical (fix immediately)

None found by any of the four slots.

### 🟡 High (fix within 1 week)

| # | Issue | Agent(s) | File:Line | Class | Fix → Ticket |
|---|-------|----------|-----------|-------|--------------|
| H1 | Claude/Codex turns have no timeout and no kill hook: a hung turn wedges the tenant permanently (`chatLocks` never resolves, cancel/delete no-op), and the orphan host process survives gateway restart | Automation | `src/chat.ts:67-104`, `src/claude.ts:16`, `src/sse.ts:36-37`, `src/lifecycle.ts:265` | systemic | Uniform `onSpawn` registration + external watchdog + graceful shutdown → **T-20261003-016** |
| H2 | CI never typechecks the service: root tsconfig includes `scripts/**` only; zero references to the service in `.github/`, root `package.json`, or `scripts/` — a type-only regression ships green | Automation | `tsconfig.json`, `.github/workflows/test.yml:115`, `services/co-workspace/package.json` | script-gap | CI typecheck + `docker compose config` step → **T-20261003-012** |
| H3 | Default `process` isolation runs tenant agents as same-uid siblings inside the gateway container: they can read `/proc/1/environ` (gateway secrets incl. `CO_WORKSPACE_LLM_API_KEY`, `GOOGLE_CLIENT_SECRET`) and all tenants' `/data` (users.db, turns.db, live outbox tokens); the env allowlist is not the boundary; README headline sells multi-user identity | Security | `docker/docker-compose.yml:62`, `src/hermes.ts:216-236`, `src/registry-db.ts:127-137`, `README.md:290-291` | systemic | Posture decision (opt-in/default change + honest docs) → **T-20261003-017** |
| H4 | SEC-07 residual (operator `auth.json` copied into every tenant home each turn, RW-mounted, open egress) is accepted in three docs separately but the *composition* is tracked nowhere — no ticket, no owner, no exit criteria | Standards+Security+Architecture | QA review `:42`, `src/chat.ts:37-44`, provider-key design `:78-96`, `README.md:349-359` | systemic | One consolidated risk item → **T-20261003-018** |
| H5 | Volume-subpath design marked "Draft (design only)" and registry `draft`, with **zero CHANGELOG entries**, while fully shipped (ticket T-20260930-038 done, PR #1260, ADR-0092 A14) — the authoritative doc claims the security-relevant mode doesn't exist | Arch+Standards | volume-subpath doc `:4`, `docs/specs/registry.json:1749-1756`, `src/hermes.ts:188-189` | one-time | Status→implemented + registry + CHANGELOG → **T-20261003-019** |
| H6 | Both 2026-09-27 founding docs are stale in-place — wrong service path (`services/team-gateway/`), dead `TEAM_GATEWAY_*` env prefix, superseded no-auth posture — with no supersession banner (the record lives only in ADR-0092); Status still "Approved" vs registry "implemented" | Arch+Standards | service design `:7,67,93`; phase2 `:23,43`; QA review `:22` | one-time | Banners + status headers (broker-doc pattern) → **T-20261003-019** |
| H7 | Registry carries statuses outside the legal enum (`superseded` ×2, `planned`, `designed`); `registerSpec` only casts, audit spec-check never validates — a `planned` plan can sit forever with no staleness WARN, and superseded entries have no `superseded_by` pointer | Standards | `registry.json:1470,1725,1734,1770`, `scripts/spec-register.ts:46,104`, `scripts/audit.ts:3119-3215` | script-gap | Enum validation on write + audit check → **T-20261003-013** |
| H8 | ADR-0092 (co-workspace decision SSOT) ends at Addendum 15 (09-30) — the three highest-posture-impact 10-02 decisions (rotation-keeps-session, anon-provisioning gate, docker-redeploy) have no addendum, breaking the one-addendum-per-change practice | Standards | `docs/adr/0092-co-workspace-service.md:155` | systemic | Addendum 16 or explicit ownership declaration → **T-20261003-019** |
| H9 | README does not document `CO_WORKSPACE_ALLOW_ANON_PROVISIONING` (the key provisioning switch, real in `config.ts:265`), and the bare-metal quickstart sets no credential — the anonymous operator's likeliest "fix" for a 401 is flipping the dangerous flag | Security | `README.md:158-195` vs `docker/.env.sample:70` | script-gap | README fix + env-parity ratchet extension → **T-20261003-014** |
| H10 | `listUsersPaged` is dead code whose comment claims a delivered ticket (T-20260928-006) while its body is wrong (`total` = page size, search param unused, zero callers) — a latent one-page-forever pager if wired | Arch+Automation | `src/users.ts:455-463` | one-time | Delete or finish+wire → **T-20261003-022** |

### 🟢 Moderate (fix within 2 weeks)

| # | Issue | Agent(s) | Class | Ticket |
|---|-------|----------|-------|--------|
| M1 | 403/500/SSE error bodies disclose owner principal and raw exception strings (paths, provider errors) | Sec+Auto | one-time | T-20261003-020 |
| M2 | No Content-Security-Policy anywhere (`htmlHeaders()` sends content-type only) — one missed `esc()` is stored XSS with no backstop | Security | one-time | T-20261003-020 |
| M3 | Per-account login limiter enables permanent lockout DoS (bucket never resets on success) | Security | one-time | T-20261003-020 |
| M4 | Email-change verification not bound to the requesting session's user | Security | one-time | T-20261003-020 |
| M5 | `bootstrapAdmin` silently promotes an existing user to admin at boot, existing sessions keep working | Security | one-time | T-20261003-020 |
| M6 | Open-mode quota defaults all `0` — enabling anon provisioning yields unmetered provider spend | Security | one-time | T-20261003-020 |
| M7 | `esc()` misses `'`; donut-chart `aria-label` interpolates unescaped `sl.label` | Security | one-time | T-20261003-020 |
| M8 | Scaffold subprocess inherits the **full gateway env** (`{...process.env}`) — bypasses the P2-4 allowlist posture hermes turns enforce | Automation | one-time | T-20261003-021 |
| M9 | Missing `.env.keys` on host becomes a directory → `EISDIR` boot crash with an obscure error | Automation | one-time | T-20261003-021 |
| M10 | Delete-vs-queued-turn race: turn body re-inserts turn rows after tenant deletion when the lock chain exceeds the 30s bounded wait | Automation | one-time | T-20261003-021 |
| M11 | Docker fleet drift: no healthchecks in any of 6 compose files, gateway lacks restart policy while broker has one, floating image refs (`hermes-agent:latest`, untagged `docker:cli`, mutable `alpine:3.20`) | Automation | one-time | T-20261003-021 |
| M12 | Boot-only orphan reaper + fire-and-forget `docker kill` — one failed kill leaks a container until next restart | Automation | one-time | T-20261003-021 |
| M13 | Broker control-route token optional by default in the volume deployment surface (relies solely on the internal network) | Automation | one-time | T-20261003-021 |
| M14 | Founding design's "chat on non-ready tenant → 409" contract is dead (streams progress instead; `ensureReady` failures surface as 500) — no doc supersedes it explicitly | Architecture | one-time | T-20261003-019 |
| M15 | Web split plan's "current state" numbers drifted (index.html 1,184→1,221 lines; unplanned login.html/app-helpers.js mini-split) | Architecture | one-time | T-20261003-019 |
| M16 | Volume-mode helper deviates cosmetically from its design (helper name `vol-control` vs `volctl`; subpath interpolation into `sh -c`) — record when flipping doc status | Architecture | one-time | T-20261003-019 |
| M17 | Structural smells: `create()` re-takes `dataDir`; `<dataDir>/tenants/` now means "databases" while data moved to `storage/`; compose header still carries "Team Gateway" + a rejected alternative phrased as a live plan | Architecture | one-time | T-20261003-019 |
| M18 | Spec-id drift: in-doc "Spec id" ≠ registry id (= filename stem) in 5 docs; 4 docs carry no Spec ID header at all | Standards | one-time | T-20261003-019 |
| M19 | A11y statements missing in rotation-keeps-session and docker-redeploy designs (ADR-0065/0070) | Standards | one-time | T-20261003-019 |
| M20 | Evidence-trail corruption: `memory/2026-10-02.md:468-497` interleaves truncated fragments across unrelated sessions | Standards | one-time | T-20261003-019 |
| M21 | Registry created-date drift (qa-fair, usability-wave) | Standards | one-time | T-20261003-019 |
| M22 | Over-declared language exception on gate-anonymous design (body is English; one quoted utterance needs no declaration) | Standards | one-time | T-20261003-019 |

### ℹ️ Low / Improvements

Dead legacy `tenantPaths()` helper; per-request synchronous key-file reads (cache with mtime check); TurnStore `MAX(seq)+1` single-process invariant undocumented; stale `AGENTS.md` layout table (registry.json era); Windows case-sensitivity 404 quirk in `safeResolve` (fail-closed, harmless); `co-workspace`/`coworkspace` split spelling hurts grep discovery. → folded into **T-20261003-022** (code) / **T-20261003-019** (docs).

### ✅ Strengths (verified, not assumed)

1. **Baseline security closure is real**: 13 of 14 QA-fair findings verified closed at code level (SEC-01 IDOR → `requireTenantAccess` everywhere; SEC-02 → authenticated-principal keying; SEC-04 XSS → `esc()` discipline; SEC-05 quotas; SEC-06 cookie/rotation; SEC-09 CSRF; SEC-10 container caps re-validated by the broker; SEC-11 argv injection; SEC-12/13/14). Only SEC-07 remains, honestly documented (→ H4).
2. **The docker broker is a genuine security boundary**: canonical body rebuild from an exact key allowlist after duplicate-key JSON scans, ref resolution rewritten to 64-hex ids, lstat symlink walks at create AND start, mounts-equality re-check, fail-closed boot probes — each property pinned by a dedicated test suite.
3. **Path-traversal defense is layered**: `safeResolve` joins+denies+realpaths+re-checks containment; delete paths refuse escapes; the files API never reaches the secret-bearing hermes-home.
4. **Secrets discipline in the turn path**: keys never logged or echoed, `config.yaml` mode 0600, key passed as bare `-e NAME` (never argv), strict env allowlist with `CO_WORKSPACE_*`/`GOOGLE_CLIENT_*` deny regex.
5. **Provisioning gate implemented exactly per its design**: check-then-create reordering, audit on create and denial, lazy-path cap, pre-relocation rollback + boot sweep, 401 default with posture warning.
6. **Session/rotation semantics match their docs row-for-row** (named threads, run ceilings, rotation-keeps-session `keepToken` purge-others, 15-min temp passwords with ~70-bit alphabet).
7. **Test wiring is solid**: all 29 suites run in CI via the root unit glob; the compose/env parity ratchet is exactly the drift guard this fleet needs; Windows-portable fake binaries.
8. **Doc honesty artifacts**: README's not-verified list, the raw-proxy residual-risk table, and the isolation compose warnings all state what the code actually enforces — no doc promises an unimplemented control (the flagged gaps are omissions, H5/H9, not false claims).
9. **Design corpus coherence**: 13/13 docs registered in the spec registry, English-only throughout, supersession banners exemplarily applied where practiced (docker-broker doc, ADR-0092 inline annotations).

## Domain summary

| Slot | Critical | High | Moderate | Notable |
|---|---|---|---|---|
| A — Architecture | 0 | 4 | 4 | No design↔code contradiction in load-bearing paths; 10 verified strengths |
| B — Standards | 0 | 4 | 7 | 13/13 Design-Gate registration; lifecycle-record debt is the theme |
| C — Automation | 0 | 3 | 7 | Request path sound; turn-lifecycle + CI wiring are the gaps |
| D — Security | 0 | 3 | 7 | Baseline closure verified; posture-honesty gaps (isolation default, README) |

Dedup applied: SEC-07 (B-H3 + D-H3 + A-H4), volume-subpath status (A-H2 + B-H1), founding-doc staleness (A-H1 + B-M1), listUsersPaged (A-H3 + C-Low), error-body leaks (D-M-1 + C-M4), registry enum (B-H2 feeds H5/H7).

## Action wiring (Step 5)

No fix-now dispatch this session (analysis-only review; all items ticketed with precise fix instructions):

| Ticket | Priority | Covers | Class |
|---|---|---|---|
| T-20261003-012 | high | CI typecheck + compose config for the service | script-gap |
| T-20261003-013 | normal | Spec status enum validation | script-gap |
| T-20261003-014 | normal | README env-flag coverage via env-parity ratchet | script-gap |
| T-20261003-015 | normal | docs-link lint over CHANGELOG | script-gap |
| T-20261003-016 | high | Turn timeout/kill contract + graceful shutdown (H1) | systemic |
| T-20261003-017 | high | Process-isolation default posture (H3) | systemic |
| T-20261003-018 | high | SEC-07 composed-risk consolidation (H4) | systemic |
| T-20261003-019 | normal | Doc-hygiene batch (H5, H6, H8, M14–M22, Lows) | one-time |
| T-20261003-020 | normal | Security hardening batch (M1–M7) | one-time |
| T-20261003-021 | normal | Operational hardening batch (M8–M13) | one-time |
| T-20261003-022 | normal | Code hygiene + dead code (H10, Lows) | one-time |

## Verification

No fixes were applied in this session — nothing to re-verify. The baseline battery was green at review time and the report itself introduces no code or governance-doc changes. Ratchet note: the four `script-gap` tickets (T-012..015) are the ones that must convert agent-found classes into machine checks before the next quarterly review.
