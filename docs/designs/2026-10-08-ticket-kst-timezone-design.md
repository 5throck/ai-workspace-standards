# 2026-10-08 Ticket Time Unification to Korea Standard Time — Design

- **Date**: 2026-10-08
- **Status**: implemented
- **Spec id**: `2026-10-08-ticket-kst-timezone-design`
- **Owner**: automation-engineer (user directive, 2026-10-08)
- **Related**: `scripts/helpers/kst-time.ts`, `scripts/helpers/ticket-store.ts`, `scripts/mcp-upstream-server.ts`, `docs/designs/2026-10-04-ticket-archive-design.md`, T-20261004-015 (UTC normalization, superseded here)

## 1. Context

Ticket ids and timestamps were generated from the UTC calendar:

- `scripts/helpers/ticket-store.ts` `todayPrefix()` built `T-YYYYMMDD` ids from `toISOString()`, and `today()` drove the `--ready` `not_before` filter. T-20261004-015 chose UTC so ids, `created_at` and `not_before` would agree with each other on one calendar.
- `scripts/mcp-upstream-server.ts` `todayStr()` built `U-YYYYMMDD` ids from the machine-local calendar, so the same ticket family used two different day boundaries depending on which producer wrote it.

The operator works in Korea Standard Time. A ticket created at 06:30 KST on 2026-10-08 (21:30Z on 2026-10-07) received the `T-20261007-…` id, so the id date was a day behind the wall-clock day the operator sees. Upstream ids on a machine set to another zone had the same class of mismatch.

A second, related defect: `nextServiceTicket` ordered candidates by `a.created_at.localeCompare(b.created_at)`. Once timestamps carry different offsets (`Z` and `+09:00`), lexical order does not follow the instant order, so an older ticket can sort after a newer one.

## 2. Decision

Use KST (UTC+09:00, no DST) for every ticket and upstream request id, `created_at`, `history[].at`, `not_before`, and the daily upstream audit log file name.

- `scripts/helpers/kst-time.ts` (new, v1.0.0) exports:
  - `kstDate(d = new Date())` returns `YYYY-MM-DD` in KST.
  - `kstIso(d = new Date())` returns ISO-8601 with milliseconds and an explicit `+09:00` offset.
  Both apply the +9 h offset arithmetically (`d.getTime() + 9h`) and read the UTC fields of the shifted value, so results do not depend on the machine time zone.
- `ticket-store.ts` (v1.12.0) replaces `nowIso()`/`today()` with `kstIso()`/`kstDate()`, and `todayPrefix()` uses `kstDate()`. The `nextServiceTicket` sort compares `Date.parse` values.
- `mcp-upstream-server.ts` (v1.10.0) replaces `todayStr()` with `kstDate()` for `U-` ids and the daily audit log file name, and uses `kstIso()` for the upstream ticket `created_at` and history `at`.

This supersedes the UTC choice recorded in T-20261004-015. The ids, `created_at`, `history.at` and `not_before` fields all read as KST dates from this change forward.

Audit-line `ts` fields (`appendFileSync` JSON lines) and intake/lock `at` owner stamps stay on `toISOString()` (UTC `Z`). They are machine diagnostics, not ticket data, and changing them gives no operator benefit.

## 3. Compatibility

- **Existing ids are untouched.** Files already on disk keep their `T-…`/`U-…` names. `nextSeqGuess` continues to count by prefix, so a KST prefix for the current day can coexist with earlier UTC-prefixed ids for the same calendar date. Ids are unique by sequence, not by date.
- **Existing timestamps remain valid.** `ticket-schema.ts` does not pattern-match `created_at` or `history[].at`; it only requires strings. Old `…Z` values stay valid, and the new `…+09:00` values are also valid strings.
- **Parsers accept both forms.** Every duration or age computation already uses `new Date(…).getTime()` or `Date.parse(…)` (`staleRunningTickets`, `doneAtOf`/archive dwell, `pruneOldLogs`). Those are instant-based and therefore offset-agnostic. The only string comparison that depended on the format was the `created_at` sort, now fixed.
- **`not_before` stays `YYYY-MM-DD`.** The `--ready` filter compares it lexically against `kstDate()`, which is the same format, so no schema change is needed.
- **Daily log file names roll at KST midnight.** `pruneOldLogs` parses the file date as UTC midnight. The skew is at most 9 hours, which is inside the 90-day retention window.
- **Downstream readers of the upstream `U-` prefix** (ticket-schema `U-YYYYMMDD-NNN` validation) accept any 8-digit date, so KST-prefixed upstream ids pass unchanged.

## 4. Alternatives Rejected

- **Keep UTC and display KST only.** Ids would still name the previous day for ~9 hours each morning, and the operator-facing id would disagree with the wall-clock date in the same listing.
- **Use the machine local zone.** That is what the upstream server did, and it made the id depend on where the server runs. Rejected.
- **Use `Intl.DateTimeFormat` with `timeZone: 'Asia/Seoul'`.** Correct, but it depends on ICU data available in the runtime. The fixed +9 h offset is exact for KST (no DST since 1988) and needs no runtime data.
- **Rewrite existing ids and timestamps.** Would break references in memory logs, commits and audit trails. Rejected; the change is forward-only.

## 5. Test Plan

- `tests/unit/kst-time.test.ts`
  - `2026-10-07T21:30:00Z` maps to `kstDate` `2026-10-08` and `kstIso` `2026-10-08T06:30:00.000+09:00`.
  - `2026-10-07T14:59:59Z` maps to `kstDate` `2026-10-07` (23:59:59 KST, still the same day).
  - `kstIso` keeps milliseconds and names the same instant (`Date.parse` round trip).
  - `nextServiceTicket` picks `2026-10-08T06:30:00.000+09:00` (instant 21:30Z) over `2026-10-07T22:00:00.000Z`, which a lexical comparison would have ranked first.
- `tests/unit/ticket-store.test.ts`: the id-prefix and `--ready` boundary helpers use `kstDate()` so they agree with the store.
- `tests/unit/mcp-upstream-server.test.ts`: the audit-log read uses `kstDate()` to match the server's KST log file name. The previous comment about pinning `TZ=UTC` is removed because the server no longer depends on the local zone.
- Gates: `bun run test:unit`, `bun scripts/typecheck.ts`, `bun scripts/verify-scripts.ts --verify`, `bun scripts/audit.ts`.
