# Security Policy — co-abap

The co-abap variant's security posture is the **SAP enforcement proxy** plus the
cross-platform **agent-shell hardening** discipline. This file anchors the
security-critical links from `docs/` (e.g.
`docs/platform-setup/antigravity.md`).

## Agent-Shell Hardening (all platforms)

The full checklist lives in the workspace guide
`docs/guides/agent-shell-hardening.md` (tiered enforcement: server-side
authorization > server feature flags > proxy/client gate; approvals stored
outside the repo, HMAC-signed, single-use, input-hash-bound, human-confirmed on
`/dev/tty`). Platform manuals apply it per surface:

- Claude/Codex/Gemini: `AGENTS.md` §SAP enforcement (deny rules from
  `config/platforms/protected-paths.json`, parity-checked by
  `scripts/validate-abap-platform-parity.ts`).
- Hermes: `HERMES.md` — proxy-only SAP access, approval and integrity gates,
  parallel-dispatch grant lifecycle.
- Antigravity: `docs/platform-setup/antigravity.md` — manual per-user steps
  (Antigravity reads no repo-level deny file); residual risk documented there.

## Reporting

Report vulnerabilities to the repository owner; do not open public issues for
exploitable details. The approval/integrity stores live outside the repo
(`~/.config/co-abap/`) — a leaked repo copy contains no secrets.
