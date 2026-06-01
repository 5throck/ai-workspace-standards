# Antigravity MCP Setup Guide

Antigravity 2.0 (and the Antigravity CLI) now supports project-level configurations through the `.gemini/settings.json` file. This means the MCP servers and tools can be configured for the entire project and shared among the team. For legacy versions or user-specific overrides, MCP servers can still be registered manually at the **user level** in VS Code settings.

> **Important**:
> - Antigravity does **not** support `PostToolUse` hooks. You must run the Post-Write chain (`/post-write`) manually after every ABAP code change.

---

## 1. Prerequisites

- VS Code installed and running
- Antigravity extension installed and activated
- `vsp` binary present at `C:\Users\<your-username>\abap\vsp.exe` (Windows) or `~/abap/vsp` (macOS/Linux)
- `.env` file configured at the repository root (`C:\Users\<your-username>\abap\.env`)

---

## 2. Registering the MCP Servers

MCP servers for Antigravity are registered in VS Code's **user** `settings.json`.

**Open VS Code user settings (JSON):**
- Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → `Preferences: Open User Settings (JSON)`

**Add the following block:**

```json
{
  "antigravity.mcpServers": {
    "abap": {
      "command": "C:\\Users\\<your-username>\\abap\\vsp.exe",
      "args": ["--mode", "hyperfocused"],
      "env": {
        "SAP_MODE": "hyperfocused",
        "SAP_ALLOWED_PACKAGES": "Z*,$TMP,$ZADT_VSP,$VSP_ADT",
        "SAP_FEATURE_ABAPGIT": "on",
        "SAP_FEATURE_TRANSPORT": "on",
        "SAP_FEATURE_UI5": "on",
        "SAP_FEATURE_RAP": "on"
      }
    },
    "abap-docs": {
      "type": "http",
      "url": "https://mcp-abap.marianzeis.de/mcp"
    },
    "sap-docs": {
      "type": "http",
      "url": "https://mcp-sap-docs.marianzeis.de/mcp"
    }
  }
}
```

> **macOS / Linux**: Replace the `command` path with the absolute path to the `vsp` binary in your local clone, e.g. `/home/<username>/abap/vsp`.

---

## 3. Environment Variables

`vsp` reads SAP connection details from environment variables. If Antigravity does not automatically load the `.env` file, set these as system-level variables or add them directly inside the `env` block above.

**Windows (PowerShell — user scope):**
```powershell
[System.Environment]::SetEnvironmentVariable("SAP_URL",      "http://vhcalnplci:50000", "User")
[System.Environment]::SetEnvironmentVariable("SAP_USER",     "your-sap-user",           "User")
[System.Environment]::SetEnvironmentVariable("SAP_PASSWORD", "your-sap-password",       "User")
[System.Environment]::SetEnvironmentVariable("SAP_CLIENT",   "001",                     "User")
```

**macOS / Linux (`~/.bashrc` or `~/.zshrc`):**
```bash
export SAP_URL="http://vhcalnplci:50000"
export SAP_USER="your-sap-user"
export SAP_PASSWORD="your-sap-password"
export SAP_CLIENT="001"
```

Restart VS Code after setting environment variables.

---

## 4. Verification

After restarting VS Code, open the Antigravity chat panel and run:

```
Show SAP system info
```

A successful response displays the system ID, client number, and logged-in user. If you see an error, confirm the `vsp` binary path and that the environment variables are visible to VS Code's process.

---

## 5. No-Hook Workaround: Manual Post-Write Chain

Antigravity does not fire `PostToolUse` hooks. After any ABAP code change, **always run the following three steps manually** before considering the task complete:

| Step | Tool | Pass Condition |
|------|------|---------------|
| 1 | `SyntaxCheck` | 0 errors |
| 2 | `RunUnitTests` | 0 failures |
| 3 | `RunATCCheck` | 0 Priority-1 findings |

You can trigger these by asking Antigravity directly, or by switching to Claude Code CLI and running `/post-write <ObjectName>`.

For Git commit and memory sync, use the terminal manually:

```bash
# Cross-platform (requires Bun)
bun run scripts/vsp-sync.ts -m "feat: summary of change"
```

---

## 6. Platform Comparison

| Capability | Claude Code CLI | Claude Code App | Gemini CLI | Antigravity |
|------------|:---------------:|:---------------:|:----------:|:-----------:|
| MCP auto-connect | ✅ | ✅ | ✅ | ✅ (manual reg.) |
| PostToolUse hook | ✅ | ❌ | ❌ | ❌ |
| Post-Write chain | Automatic | Manual (`/post-write`) | Manual | Manual |
| Git commit | `/sync` | `/sync` | Manual | Manual |
| Project-level config | ✅ `.mcp.json` | ✅ `.mcp.json` | ✅ `.gemini/settings.json` | ✅ `.gemini/settings.json` |

---

*Last Updated: 2026-06-01*
