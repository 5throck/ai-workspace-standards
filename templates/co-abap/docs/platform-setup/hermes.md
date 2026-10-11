# Hermes Agent Onboarding

Set up NousResearch Hermes Agent to run this workspace with the same SAP safety enforcement as every other platform. Behavior rules live in [`HERMES.md`](../../HERMES.md); this page covers installation and wiring only.

## 1. Install

1. Install Hermes Agent per its upstream instructions and confirm `hermes --version` works.
2. Install Bun (`bun --version`); the SAP MCP proxy and all harness scripts run on Bun.
3. Clone this repository and run `bun install`.
4. Create `<repo>/.env` with `SAP_URL`, `SAP_USER`, `SAP_PASSWORD`, `SAP_CLIENT` (never commit it) and place the `vsp` binary at `<repo>/vsp` (`vsp.exe` on Windows).

## 2. Trust the project for skills

Project-local skills in `.hermes/skills/` load only when the project root is trusted. In `~/.hermes/cli-config.yaml` add the absolute repository path:

```yaml
skills:
  trusted_project_dirs:
    - /abs/path/to/co-abap
```

Do not bypass this gate; it is Hermes' prompt-injection defense.

## 3. Register the SAP MCP server (via the proxy)

Hermes reads MCP servers only from the user-level `~/.hermes/config.yaml` (key `mcp_servers.<name>`: `command`, `args`, `env`, `timeout`, `tools.include/exclude`) and has no `cwd` option, so the proxy path must be absolute.

1. Copy the `mcp_servers.abap` block from [`config/platforms/hermes-mcp.example.yaml`](../../config/platforms/hermes-mcp.example.yaml) into `~/.hermes/config.yaml`.
2. Replace `<ABS_PATH_TO_REPO>` with the absolute path of your clone.
3. Leave `env` empty. The proxy finds the repo root from its own location, reads `<repo>/.env`, applies safe `SAP_*` defaults and enforces the policy in `config/sap-action-policy.json`.
4. Never register `./vsp` directly: that bypasses the policy gate, approvals and audit.

## 4. Shell-hooks consent

If Hermes asks to consent to project shell hooks (for example `bun scripts/...` helpers), review the command and approve it once per project. SAP enforcement does not depend on hooks: it lives in the proxy and applies even if hooks are declined.

## 5. Approvals

An R3 action (for example `ReleaseTransport`) returns `APPROVAL_REQUIRED`. A human, not the agent, runs `bun scripts/sap-approve.ts <id>` in a separate terminal and types the first 6 characters of the id on `/dev/tty` (approvals expire after 15 minutes, are single use, and are stored outside the repo in `~/.config/co-abap/approvals/`), then the agent retries. Before first use a human runs `bun scripts/sap-integrity.ts init` (and `sign` after reviewed enforcement changes); until then the proxy is read-only. Hermes has no deny-rule equivalent for the approve command, so do not grant the agent permission to run `sap-approve.ts`.

## 5a. Agent-shell hardening (manual)

The canonical protected set is [`config/platforms/protected-paths.json`](../../config/platforms/protected-paths.json). Hermes has no user-configurable per-command or per-path deny list (assumed; `hermes` was not installed when this was written, so verify against your version):

1. Keep dangerous-command approval on manual: `approvals: mode: manual` (included in `hermes-mcp.example.yaml`). Never set it to `off`; reject, do not approve, any prompt for `./vsp`, `bun -e`, `script`, `git stash`, `git checkout --`, `git restore`, `git clean`, or edits to `.env`, `.mcp.json`, `config/**`, the proxy scripts, `scripts/sap-integrity.ts`, `scripts/dispatch-parallel.ts`, `memory/audit/**` or `~/.config/co-abap/**`.
2. Run Hermes in a container (terminal backend) or as a separate OS user so it cannot read `~/.config/co-abap/approval.key`; that is the only full closure.
3. One worktree per parallel agent; never `git stash`.

## 6. Verify

1. `hermes mcp list` (or the equivalent in your version) shows `abap` connected.
2. Read call: ask the agent to read a class source; it succeeds.
3. Write outside `Z*`/`$TMP`: denied with the policy message.
4. Transport release: returns `APPROVAL_REQUIRED`; after `sap-approve.ts` and a retry it succeeds once.
5. `memory/audit/sap-actions-YYYY-MM.jsonl` contains a line per call.
6. Manual proxy check from any directory (dummy SAP env is enough to reach vsp):
   `printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}\n' | bun /abs/path/to/co-abap/scripts/sap-mcp-proxy.ts -- --mode hyperfocused`
