# Antigravity (IDE and CLI) Onboarding

SAP safety lives in the SAP MCP proxy (`scripts/sap-mcp-proxy.ts`), registered through `.agents/mcp.json`. Antigravity reads no repo-level command or path deny file, so the agent-shell protections below are **manual, per-user steps**. The canonical protected set is [`config/platforms/protected-paths.json`](../../config/platforms/protected-paths.json); `bun scripts/validate-abap-platform-parity.ts` (check `deny-rules`) records that these steps are documented, not that they were applied on your machine.

## Manual steps (assumed from the IDE settings UI; not verifiable from the repo)

1. Terminal command execution policy: set it to the most restrictive mode (request review / `Off`), never `Auto`/`Turbo`.
2. Terminal deny list: add every `commands[].gemini` entry without the `run_shell_command(...)` wrapper from `protected-paths.json` (`./vsp`, `bun scripts/sap-approve.ts`, `bun -e`, `script`, `git stash`, `git checkout --`, `git restore`, `git clean`, `rm/mv/cp vsp`).
3. MCP tool approval: keep it on manual. Register only the proxied `abap` server (`.agents/mcp.json`); never `./vsp`.
4. Use one worktree per parallel agent; do not allow `git stash`.
5. Antigravity CLI: pending V8 verification (see [tooling matrix](../tooling-matrix.md)); apply the same steps once its settings surface is confirmed.

## Residual risk

No per-path read/write deny exists: an Antigravity agent can edit `.mcp.json`, `config/sap-action-policy.json`, the proxy or `.env`, and a same-UID shell can read `~/.config/co-abap/approval.key`. Full closure requires running the agent as a separate OS user. See [SECURITY.md](../../SECURITY.md#agent-shell-hardening-all-platforms).
