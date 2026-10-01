# Design: upstream installer vendor re-check (T-20261001-019)

- **Spec ID**: 2026-10-01-upstream-vendor-recheck
- **Date**: 2026-10-01
- **Status**: implemented
- **Source**: manual (governance backlog T-20261001-019; ADR-0097 Appendix B follow-up)

## Problem

Two installer choices were open: whether the undocumented Codex `mcp get
--json`/`remove` subcommands remain safe to depend on, and whether the
installer may create the Antigravity registry when absent.

## Decision (recorded in design Appendix B + ADR-0097 follow-ups)

1. Codex subcommands CONFIRMED against the CLI source (MCP CLI handlers cover
   add|login|list|get|remove; community references agree); the vendor page
   still lists only list|add|login. Keep `get --json`/`remove` with the
   existing loud-fail for older CLIs; re-check on the next Codex major.
2. Antigravity create-if-absent: NO. The official docs document
   `~/.gemini/config/mcp_config.json` for IDE+CLI, but a vendor-repo issue
   (google-antigravity/antigravity-cli#60) reports the CLI reading
   `~/.gemini/antigravity-cli/mcp_config.json` — creating the file when absent
   risks registering into a file a CLI version never reads. Edit-only posture
   and the `graft init --agents antigravity` pointer stay.
3. Claude Desktop paths (macOS/Windows only) and Hermes `$HERMES_HOME`
   re-verified against vendor docs — unchanged. No installer change needed.

Sources: https://antigravity.google/docs/mcp ;
https://github.com/google-antigravity/antigravity-cli/issues/60 ;
https://deepwiki.com/openai/codex/6.3-mcp-cli-commands ; openai/codex#16439.

## Accessibility

Documentation-only change — no accessibility impact (per ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (per ADR-0070).

## Verification

- design Appendix B "Vendor re-check (2026-10-01, T-20261001-019)" entry present
- ADR-0097 Follow-ups updated with the settled decisions
