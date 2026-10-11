# Agent-Shell Hardening Checklist

From co-abap's permission-integrity wave (SECURITY.md threat model; ADR-0006/0007,
PR #194; T-20261011-006). co-learning's output-encoding XSS fix (PR #13) is the
same genus — allowlist strictness plus a committed regression proof — cited as a
parallel instance, not a dependency: neither project covers the other's surface.

## Core principle: docs are guidance, not controls

A prompt rule ("wait for confirmation") is not a control — an agent can ignore
it and a prompt injection can make it ignore it. Only enforcement counts, and
enforcement has tiers:

1. **Server-side authorization** (strongest) — the backing system refuses what
   the agent is not allowed to do (least-privilege service user, scoped roles).
2. **Server feature flags** — whole tool categories stay unexposed; an agent
   cannot call a tool the server does not offer.
3. **Proxy / client gate** (weakest technical tier) — a local process classifies
   each call (allow / ask / deny) before it reaches the server.

Document residual risk per platform explicitly; "every platform gets as much
blocking as it supports" beats pretending parity.

## Approvals live outside the agent's reach

- Approval records are stored **outside the repo** (user config dir), never in
  the tree an agent can write.
- Each approval is **HMAC-signed** with a key outside the repo (mode 0600),
  **single-use**, **bound to the hash of the exact tool input**, short TTL, and
  **human-confirmed on /dev/tty** (no env-var approver, no non-TTY override).
- Agents must never run the approval tool, create approval files, or read the
  approval directory; deny rules block these where the platform allows.

## Integrity seal

A human signs the policy + enforcement scripts after review; until the seal
verifies, the enforcement point **drops to read-only** (fail-safe, not
fail-open). State the limit honestly: the seal is self-verified by the code it
protects — tamper-evidence, not tamper-prevention.

## Unknown tools fail closed

An unclassified tool call **asks** (never silently allows); a proxy internal
error or unreadable policy **asks** instead of allowing. Denying unknown things
is the only stance that survives tool churn.

## Deny-rule SSOT per platform, with parity validation

- One source file lists the protected paths/commands; per-platform configs are
  **rendered** from it, and a validator (CI-checked) fails when a platform
  config lacks an entry not documented as a manual step.
- Record per-platform capability honestly (e.g. prefix-only argv matching vs
  glob denies; wrappers and quote-splitting still evade shell-level denies —
  those are speed bumps, not barriers).
- Plain statement of limits in the threat model: what a shell can still do,
  what needs a separate OS user or container, and which rules are procedural.

## Checklist

- [ ] Enforcement tiers documented: server-authz > feature flags > proxy gate
- [ ] Approvals: outside-repo, HMAC-signed, single-use, input-hash-bound, TTY-confirmed
- [ ] Integrity seal drops enforcement to read-only on mismatch
- [ ] Unknown tool / proxy error => ask, never allow
- [ ] Deny rules single-sourced per platform set + parity validator in CI
- [ ] Residual-risk statement names what still gets through and the full-closure path
