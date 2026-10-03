---
status: Accepted
date: 2026-10-01
author: PM
owner: architect
---

# ADR-0097: Supported-surface registry and multi-surface registration of machine-global tools

## Context

The upstream-request MCP server (design `docs/designs/2026-10-01-upstream-request-mcp-design.md`) shipped with an installer that wrote only `~/.claude.json`. The PM rule that tells project agents to call `upstream_request_create` is shared text in `agents/pm.md`, which Gemini, Codex and Hermes sessions also load through their instruction files. On those platforms the rule had no tool to call.

The workspace already supports several surfaces, and each was added by its own ADR (ADR-0077 Codex, ADR-0088 Hermes Agent, ADR-0093 `HERMES.md`). No document held one authoritative list. CONSTITUTION §11 said "7 supported surfaces", §11.1 tabled four of them, and the skill-availability sentence in CONSTITUTION and in `templates/common/docs/context.md` each listed a different set. Antigravity CLI and Hermes CLI were missing from the counted list.

Two facts found while fixing this changed the design:

- Config paths and formats differ per client, and the local file on one machine is not proof of the documented format. Antigravity's registry path is documented by the vendor, while `docs/graft-platform-integration.md` warns that it varies by version.
- Launching the `hermes` CLI starts a self-update and a desktop-app rebuild (observed in a throwaway `HERMES_HOME`, 2026-10-01). A script cannot use it to edit config.

## Decision

1. **One registry of supported surfaces.** CONSTITUTION §11.0 lists eight surfaces: Claude Code, Claude Desktop App, Antigravity, Antigravity CLI, Codex CLI, Codex Desktop App, Hermes Agent, Hermes CLI. Gemini CLI stays supported as the legacy Google path. `templates/common/docs/context.md` carries the same registry in plain text, without a CONSTITUTION link. Counts and tables elsewhere derive from §11.0.
2. **Coverage rule.** Every new or changed rule, instruction text, skill, command, hook, script or tool registration works on all eight surfaces. A capability that cannot reach a surface is recorded as a gap (surface, reason, fallback, ticket) in the design document or PR. The rule applies to the workspace root and to all templates (L1 and L2).
3. **Single source.** Shared behavior lives in one source (`agents/pm.md`, `skills/`, `AGENTS.md`). Platform instruction files point to it.
4. **Machine-global registrations use an idempotent, user-run installer** with `--dry-run` and `--uninstall`. There is one target per config file, and a target covers every client that reads that file. The installer skips a client that is not installed, exits 1 for an explicit target that is absent, and never creates a config that the client owns (Claude Desktop chat and Antigravity configs are edited only if they exist).
5. **Verify against the vendor.** Before an installer or a template writes a client config, the author confirms the path and the format in the vendor's official documentation and records the URL in the design document. A local config file alone is not evidence.
6. **First application.** `scripts/install-upstream-mcp.ts` 2.0.0 registers `ai-workspace-upstream` for all surfaces. Codex goes through `codex mcp get|add|remove`. Hermes is edited as text in `config.yaml` (only the `mcp_servers:` block), and a YAML parse must prove that only that entry changed before the file is written. The `hermes` CLI is never run. Targets, formats and sources are in design Appendix B.
7. **Fallback while a tool is absent.** When a surface has no registration yet, the project PM marks the patch `LOCAL-PATCH(upstream-request: pending)` and records the facts in the task log (`templates/common/agents/pm.md`, "Upstream Reporting Duty"). It reports when the tool becomes available.
8. **Client-attested identity tier.** The upstream-request MCP server (v1.9.0; design `2026-10-01-upstream-request-mcp-design.md` Appendix E) treats an MCP client's `roots/list` as an attestation surface. Identity resolution prefers `cwd`, then a single registered project among the client roots, then the model-supplied `project_root` (lowest trust). A `project_root` that conflicts with the attested root files with `identity: client_roots_untrusted` until the project has a PM-resolved `cwd`/`client_roots`-attested ticket. UNC and remote-host paths are rejected on the raw string before any filesystem call, in every tier (T-20261003-004).

## Consequences

- **Positive**: one list answers "which surfaces do we support"; a platform gap is visible in review instead of discovered later; the upstream-request channel reaches every surface after one user-run command; the Hermes edit cannot damage unrelated settings.
- **Cost**: each new machine-global tool needs a per-surface adapter and a source check against vendor documentation. The installer depends on three undocumented Codex subcommands (`get --json`, `remove`), which exist in the installed CLI but not in the vendor's page; an older Codex fails that target loudly and writes nothing.
- **Enforcement honesty**: the coverage rule is enforced by review and by the installer tests, not by a validator. A validator that checks the §11.0 list against platform directories and instruction files is a follow-up.
- **Out of scope**: project-level configs (`.agents/mcp_config.json`, `.gemini/settings.json`, `.codex/config.toml`, `.mcp.json`); the server is machine-global by design.
- **Follow-ups**: a registry validator (§11.0 vs. instruction files and platform directories; tracked as T-20261001-018); re-check the Antigravity path and the Codex subcommands when either vendor ships a new major version. Settled 2026-10-01 (T-20261001-019, design Appendix B): the Codex `get --json`/`remove` subcommands are confirmed against the CLI source (vendor page still lists only `list|add|login`) and the installer keeps its loud-fail for older CLIs; the installer does **not** create the Antigravity registry when absent — a vendor-repo issue reports the CLI reading `~/.gemini/antigravity-cli/mcp_config.json`, so the edit-only posture stands until the path question is settled upstream.

## References

- Design: `docs/designs/2026-10-01-upstream-request-mcp-design.md` (§11, Appendix B)
- CONSTITUTION §11.0, `templates/common/docs/context.md` (Supported Surfaces), `templates/common/agents/pm.md` (Upstream Reporting Duty), `docs/governance/agents/pm-gateway-workflow.md` §3.12, `docs/graft-platform-integration.md`
- ADR-0077 (Codex platform support), ADR-0088 (Hermes Agent platform support), ADR-0093 (`HERMES.md` instruction file)
- Vendor documentation (checked 2026-10-01): https://code.claude.com/docs/en/mcp, https://modelcontextprotocol.io/docs/develop/connect-local-servers, https://antigravity.google/docs/mcp, https://geminicli.com/docs/tools/mcp-server/, https://learn.chatgpt.com/docs/extend/mcp?surface=cli, https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
