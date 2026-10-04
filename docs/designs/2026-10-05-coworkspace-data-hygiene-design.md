# Co-workspace Data Hygiene — turn-config 0600 + voice-mode docs — Design

- **Date**: 2026-10-05
- **Status**: implemented
- **Spec id**: `2026-10-05-coworkspace-data-hygiene-design`
- **Tickets**: T-20261004-026 (normal), T-20261004-027 (low)
- **Owner**: automation-engineer scope, implemented by the 03:00 governance-ticket runner
- **Related**: `services/co-workspace/src/config.ts` (`persistTurnOverrides`), `services/co-workspace/web/index.html` (voice loop, read-only reference), PR #1399 (superseded ambient voice design), `2026-10-04-turn-runtime-hotswap-design` (turn-config origin), `2026-10-04-coworkspace-voice-conversation-design` (voice design)

## R1 — Problem

**T-20261004-026**: `persistTurnOverrides` wrote `data/turn-config.json` with
umask-derived permissions (typically 0644) while the file carries a plaintext
provider apiKey. The file is gitignored and admin-API-gated, but its file mode
must not depend on the deployer's umask — a world-readable credential file on
a shared host is a silent leak.

**T-20261004-027**: PR #1399 (ambient voice mode) removed the composer orb and
re-armed the microphone on page load for returning users — undocumented, and
surprising (a page load that starts listening). The ticket asked for a README
note. Premise check against current main: later voice revisions (one-button
hands-free loop, 2026-10-04/05) re-introduced the orb and made the loop
per-session; nothing auto-arms anymore. Documenting the stale ambient behavior
verbatim would document a behavior that no longer exists.

## R2 — Decision

1. **0600 persistence (026)**: `persistTurnOverrides` writes the tmp file with
   `{ mode: 0o600 }` and `chmodSync(path, 0o600)` after the rename — the chmod
   makes the mode unconditional (umask edge cases) and repairs a pre-existing
   looser file on every PUT. POSIX-gated regression test asserts the mode on a
   fresh persist and after re-persisting over a hand-loosened 0644 file. README
   gains a data-dir permissions note (preserve 0600 across copies/backups).
2. **Voice docs (027)**: a Web UI bullet documents the CURRENT behavior —
   capability toggled in the Account modal (persisted), orb in the composer,
   per-session loop (listen → auto-submit → speak ≤200-char summary → re-arm),
   permission-denied surfaces as an explicit status, page loads start silent —
   and records that the brief ambient auto-arm design (PR #1399) was superseded,
   which is the durable answer to the ticket's underlying complaint (undocumented
   surprising voice behavior).

## R3 — Alternatives Rejected

| Alternative | Why rejected |
|---|---|
| Restrict the data dir itself to 0700 instead of the file | The data dir holds lots of non-secret state; narrowing the whole dir changes tenant storage semantics, while the secret lives in exactly one file. |
| Encrypt the apiKey at rest | A real hardening candidate but a design decision with key-management implications (where does the encryption key live?) — out of mechanical scope for this ticket; filed as-is stays available for a future batch. |
| Document the ambient auto-arm behavior as the ticket literally requests | It would document removed behavior; the ticket's premise was stale by ~10 hours (superseded the same day). Documenting current behavior + the supersession note serves the ticket's intent (no undocumented surprises). |
| Re-add the dead `gw-voice-mode` read to restore ambient mode | Reverses a deliberate design decision (per-session loop) — explicitly out of scope for a docs ticket. |

## R4 — Verification

- `bun test tests/unit/co-workspace-turn-config.test.ts` — new 0600 test passes
  (fresh persist and re-persist-over-loose-file), POSIX-gated for Windows CI.
- README bullet cross-checked against `web/index.html` behavior (orb visibility
  follows `gw-voice-enabled`, loop per session, `not-allowed` → "Microphone
  permission denied", re-arm after TTS end).
- Full gates at PR landing.
