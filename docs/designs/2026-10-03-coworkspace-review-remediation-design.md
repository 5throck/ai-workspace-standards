# co-workspace Review-Remediation Design — 2026-10-03

**Date**: 2026-10-03
**Status**: Approved (Row 0 design; implementation lands in this wave)
**Spec id**: 2026-10-03-coworkspace-review-remediation-design
**Scope**: services/co-workspace, root validators/CI, co-workspace design-doc corpus
**Implements**: review `docs/reports/2026-10-03-project-review-co-workspace.md` → tickets T-20261003-012..022

## 1. Problem

The 2026-10-03 scoped project review found 0 Critical / 10 High / 22 Moderate findings across the co-workspace design corpus (the proposal documents) and service. This wave fixes or consciously disposes every ticketed item in one reviewed batch.

## 2. Requirements

- R1 (T-016): every runtime turn (hermes/antigravity/claude/codex) registers its live process in `activeProcs` and is bounded by an external watchdog; gateway shutdown kills children and closes stores.
- R2 (T-017): multi-user process-isolation posture is surfaced loudly at boot and honestly in the README (the `/proc/1/environ` + shared-`/data` boundary reality). The compose default stays `process` (changing it is a breaking deploy decision, explicitly deferred — recorded in the ticket).
- R3 (T-018): the composed plaintext-key + RW-mount + open-egress residual is documented as ONE known tradeoff with exit criteria (README + ticket cross-link).
- R4 (T-020): CSP header; `esc()` escapes `'`; donut aria-label escaped; login limiter resets on success; email-change verification bound to the session user; `bootstrapAdmin` promotion logs loudly and invalidates the promoted user's sessions; anon provisioning with unset quotas fails boot; 403 ownership detail replaced with a generic message; non-`HttpError` 500s return a generic body (full detail server-side); SSE error frames sanitize non-`HttpError` errors; `ensureReady` failures map to 409 (honoring the founding design's intent, superseding the dead 409 contract note explicitly).
- R5 (T-021): compose healthchecks + gateway restart policy; hourly interval reaper alongside the boot reap; volume compose requires `CO_WORKSPACE_BROKER_TOKEN`; non-regular `.env.keys` is warn-once (no `EISDIR` boot crash); a queued turn aborts when its tenant row is gone (delete race); the scaffold subprocess gets the allowlisted env plus `CI=1`, never the full gateway env.
- R6 (T-022): dead `listUsersPaged` / `tenantPaths` removed; key-file reads cached by mtime; `TenantRegistry.create` drops the redundant `dataDir` param; TurnStore single-process invariant documented; service AGENTS.md layout table refreshed.
- R7 (T-012): CI typechecks the service (`bun install --frozen-lockfile && bun run typecheck`) and validates every compose layering with `docker compose config -q`.
- R8 (T-013): `spec-register` accepts the legal status vocabulary (`draft|proposed|approved|planned|implemented|superseded|drifted|archived`), validates on write, requires `superseded_by` for `superseded`; the audit spec-check fails on out-of-vocabulary statuses; the 4 offending registry rows are normalized in this wave.
- R9 (T-014): the co-workspace env-parity test additionally asserts every `CO_WORKSPACE_*` variable read by `config.ts` appears in the README configuration table (README first brought to full coverage).
- R10 (T-015): docs-link lint also scans `CHANGELOG.md` for `docs/…` relative paths and fails on dead ones (the surviving `team-gateway` pointer is fixed in-wave).
- R11 (T-019): doc-hygiene batch — volume-subpath doc → implemented (+ deviations noted + CHANGELOG entry), founding docs get supersession banners + Implemented status, ADR-0092 Addendum 16 covers the three 2026-10-02 decisions, in-doc Spec IDs normalized to the registry id, dead CHANGELOG path fixed, a11y statements added to the two 10-02 designs, `memory/2026-10-02.md` interleaved block repaired, registry created-dates corrected, gate-anonymous `lang` frontmatter narrowed.

## 3. Design decisions

- D1 (R1): `runClaudeTurn`/`runCodexTurn`/`runAntigravityTurn` gain `onSpawn` and `timeoutMs` (kill timer; aborts read loops, exit code 124 on timeout). `chat.ts` passes `onProc` and the budget to all four runtimes so cancel/delete work uniformly. Graceful shutdown registers in the `import.meta.main` block: kill `activeProcs`, bounded-await `chatLocks` (10s), close the four SQLite handles (`close()` added to registry/turns/users/audit), then exit. Docker-mode stopContainer keeps its fire-and-forget semantics (the interval reaper is the backstop).
- D2 (R2): new `isolationPostureWarning()` in access.ts next to `openModeWarning()`: fires when `loginRequired || apiKeys.length > 0` AND `isolation=process`, naming `/proc/1/environ` and the shared data dir. README's process-mode paragraph names the bypass explicitly.
- D3 (R4): CSP is `default-src 'self'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. The app ships inline module scripts (index.html:212, login.html:81), so `'unsafe-inline'` is unavoidable today; the header still kills external-origin exfiltration, plugin content, framing, and base hijacking. Splitting the app's script out is the web-split plan's job, not this hardening wave's.
- D4 (R4): `verifyEmailChange(token, expectUserId?)` — when provided, a pending row for a different user aborts as `invalid`. The auth route passes the session user id. Old calls (none other exist) stay compatible.
- D5 (R4): quota fail-boot applies ONLY when `allowAnonProvisioning=true` and any of `TENANT_MAX_TURNS`/`TENANT_MAX_TOKENS`/`PRINCIPAL_MAX_TOKENS` is 0 — fail-closed with remediation text, consistent with the existing D5 fail-fast style.
- D6 (R5): image digest pins are DEFERRED (needs registry lookups at deploy time — cannot be verified offline in this wave); the volume-init image default stays a tag, compose comments keep the pinning guidance. Recorded in the ticket as the consciously deferred slice.
- D7 (R8): statuses `planned` (legal: approved-and-waiting-on-execution) and `superseded` (requires `superseded_by`) join the vocabulary; the lone `designed` row normalizes to `draft`.

## 4. Test plan

- Unit additions: limiter reset-on-success; email-change cross-user rejection; bootstrapAdmin promotion invalidates sessions; quota fail-boot; `readKeyEntries` non-regular file; esc `'` (web — skipped, DOM only); delete-race abort (chained task with removed tenant row); claude/codex onSpawn + timeout watchdog (fake sleep binary); keyPrincipals mtime cache rotation; spec-register enum + superseded_by; docs-links CHANGELOG scan; env-parity README coverage.
- Full battery: `bun test` (1988+ pass), service typecheck, root `audit.ts`, `validate-docs-links`.

## 5. Verification

Per-batch: service unit suites after each code batch; final: full battery + audit + typecheck + compose config in CI.
