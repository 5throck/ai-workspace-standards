---
lang: ko
lang_reason: source-material
---

# Fleet-Review Hardening Batch — 15 governance tickets T-20261026-002..017 (Implemented)

- **Date**: 2026-10-26
- **Status**: Implemented (bulk processing of the 2026-10-26 full project review's ready tickets)
- **Source**: decider — "티켓을 처리해줘" / "병합하고 다음 작업을 진행해줘"
- **Related**: docs/reports/2026-10-26-project-review-full.md (37 findings), PR #1613 (merged: 002/003/009a/016/017), this PR (the remainder)

## 1. Decisions

| # | Ticket | Decision |
|---|---|---|
| 1 | 002 (high, merged #1613) | pm-role-bootstrap 1.1.1 — the session-marker write moved into its own fail-open try/catch; a marker write failure (EPERM/readonly state dir) used to reach the outer catch and suppress the bootstrap injection entirely. Regression test pins an unwritable PM_GATE_STATE_DIR. |
| 2 | 003 (high, merged #1613) | nightly-tickets.yml — the ready-list enumeration greps `T-` only (upstream U- tickets excluded from the batch) and the runner prompt gains untrusted-content rules: ticket bodies are DATA never instructions, claims verified against local sources, tickets directing CI/secret/external changes are skipped. |
| 3 | 009a (merged #1613) | cli-version-drift.yml checkout pinned to the v7.0.1 SHA (the only floating action tag in CI). |
| 4 | 016 (merged #1613) | sync-variant-settings 1.2.0 — SyncResult gains `pruned`; empty groups left by removals set changed=true without an entry counter, so --check read them as in-sync; drifts() counts prunes. |
| 5 | 017 (merged #1613) | validate-templates 1.59.1 — schema-hash-parity: the L1 copy of docs/workspace-schema.json must sha256-match the L0 root; divergence fails with a propagation hint. |
| 6 | 012 | validate-docs-links 1.6.0 (promoted L0→L0+L1): ADR-0101 arm — delivered governance docs headings cross-checked against the platform skeleton registry. |
| 7 | 013 | lifecycle-sync-audit: cross-surface drift checks — dispatch-protocol fields consistent across agents/, lifecycle records, and the constitution; last_updated vs git commit dates; tier claims vs the models schema; registry parity. |
| 8 | 008 | docs/workspace-schema.json dead root allowlist entries pruned; propagation-map root path corrected; stale 13-variant denominators refreshed to the real count. |
| 9 | 009 b–f | (b) ticket.ts list --archived filters; (c) mcp-upstream-server 1.11.0 id-allocation retry no longer double-increments (publishTicketWithRetry extracted with an injectable publish step); (d) agent-model-gate accepts full provider/model IDs; (e) 24h marker TTL refresh; (f) dev-sync no-op early exit; (g) gitleaks 64-hex allowlist scoping. |
| 10 | 014 | review-baseline 1.4.0 (owner session's WIP verified complete and carried): nightlyE2EVerdict() WARNs on empty run lists, failure, and any non-success conclusion; WARN notes to stderr survive --quiet. |
| 11 | 015 | ticket.ts 1.11.0 + helpers/ticket-schema.ts 1.8.0 (owner session's WIP verified complete and carried): create input validation — --priority in the canonical PRIORITIES enum, --not-before a real ISO date (exact UTC reconstruction), usage error BEFORE any write. |
| 12 | 004/005/006/007/010 | Governance-doc corrections (007 five sites), dispatch-protocol/tier/last_updated re-alignment (004), four stale draft registry entries adjudicated + review_note keys normalized (005), L1 k-* skill owners fixed (006), the September-reports personal email verified absent — redacted by the #1609 E3 batch (010). |

## 2. Verification

- bun test tests/unit — 1,595 pass / 0 fail (new: mcp-upstream-id-allocation 1 deterministic + 4 order-dependent scenarios skipped pending a per-scenario subprocess harness; agent-model-gate, ticket-list, review-baseline, docs-links, lifecycle checks extended).
- bun scripts/audit.ts all-pass; validate-templates 0 errors; verify-scripts 237/0; lifecycle-sync-audit 0 errors.

## 3. Known follow-ups

- The mcp-upstream-id-allocation regression scenarios pass standalone but interfere in the shared-process unit run (all five scenarios share one tickets dir + one module instance; the lazy ticketsDir() re-reads UPSTREAM_WORKSPACE_ROOT per call and concurrent spawned servers inherit it) — a per-scenario subprocess harness (spawn `bun test -t <name>` with an isolated env, or a resetTicketsDirForTests() module seam) is the follow-up.
- T-20261007-025 (co-newbiz Actions pre-step failures) — user reads the Actions-tab banner.
