---
name: cad-server-manager
description: "Manages the lifecycle of the local CAD Agent web server (starts, stops, restarts, or checks connection status). Use when the user requests to start, stop, restart, or check the status of the local server."
owner: pm
version: 1.2.0
status: active
last_reviewed: "2026-09-09"
gemini-parity: sync
scope: co-architect
metadata: 
  type: task
  triggers:
    - start cad server
    - stop cad server
    - restart cad server
    - check cad server status
    - cad server port
prerequisites: none
---

# CAD Server Manager Skill

This skill guides the agent to start, stop, restart, and check the status of the local CAD Agent web server.

## Context

The CAD Agent web server is the local bridge between the agent team and ZWCAD 2026: MCP-facing tools talk to it over HTTP while a ZWCAD-side listener executes LISP/COM calls in the drawing session. This skill owns that server's lifecycle so drawing skills never start or kill it ad hoc.

## When to Use

- The user asks to start, stop, restart, or check the status of the local CAD server.
- A drawing skill failed with a connection error and the server state must be verified before retrying.
- The workspace was just opened and the ZWCAD session needs its server brought up before any CAD work.

## Execution Steps

1. Check the current server status against the default port (see `## Default Port`).
2. Start, stop, or restart the server with the matching numbered procedure below (`## 1.` – `## 3.`).
3. Re-verify status and hand the running session to the drawing skills (`zwcad-ai-drawing`, `cad-svg-preview`).

## Output Format

Plain-text status confirmation naming the action taken (started / stopped / restarted / already-running), the port in use, and any error text returned by the ZWCAD session — suitable for pasting into the conversation.

## Related Skills

- `zwcad-ai-drawing` — consumes the running server via MCP tools.
- `cad-svg-preview` — renders previews through the same session.
- `cad-space-recognition` — reads DWG entities from the running session.

---

## Default Port
The default port for the CAD Agent server is **3333**.

---

## 1. Starting the CAD Server

When the user asks to start or run the CAD Agent web server:
1. Verify if the server is already running on the requested port (default: **3333**) by checking active listeners (see section 4).
2. If it is already listening, do not start a new process and notify the user.
3. If it is not running, execute the server command in the background:
   ```bash
   .venv/Scripts/python.exe src/agent/server.py --server --port 3333
   ```
4. Confirm that the server is up and listening before ending your turn.

---

## 2. Stopping the CAD Server

When the user asks to stop, kill, or turn off the CAD Agent web server:
1. Find the PID of the process listening on port **3333** (or custom port):
   * PowerShell: `netstat -aon | findstr 3333`
2. If a process is found (e.g. listening with PID `1234`), terminate it:
   ```bash
   taskkill /F /PID 1234
   ```
3. Verify that the port is no longer listening and inform the user.

---

## 3. Restarting the CAD Server

When the user asks to restart or refresh the CAD Agent web server:
1. Run the helper batch script `src/agent/start_server.bat` which automatically terminates any running process on port 3333 and starts a fresh server:
   ```bash
   cmd /c src\agent\start_server.bat
   ```
2. Verify that the new process is up and listening.

---

## 4. Checking CAD Server Status

When the user asks to check if the CAD server is running:
1. Query active network listeners on port **3333** (or custom port):
   ```bash
   netstat -aon | findstr 3333
   ```
2. If a line containing `LISTENING` is returned, the server is active. Report the status and PID to the user.
3. If no listeners are found, the server is stopped.

---

## 5. Platform Execution Notes

| Platform | Shell Tool | Command Syntax | Notes |
|----------|-----------|----------------|-------|
| Claude Code (CLI / Desktop) | `Bash` | Standard bash syntax | Use `run_in_background: true` for start command |
| Antigravity / Gemini CLI | `run_command` | PowerShell commands | Prepend `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` for non-ASCII output |

### Claude Code (Bash tool)

- **Start**: `Bash(command=".venv/Scripts/python.exe src/agent/server.py --server --port 3333", run_in_background=true)`
- **Stop**: `Bash(command="netstat -aon | findstr 3333")` → parse PID → `Bash(command="taskkill /F /PID <pid>")`
- **Restart**: `Bash(command="cmd /c src\\agent\\start_server.bat")`
- **Status**: `Bash(command="netstat -aon | findstr 3333")`

### Antigravity / Gemini CLI (run_command tool)

- **Start**: `run_command` with `.venv/Scripts/python.exe src/agent/server.py --server --port 3333` (returns task process ID)
- **Stop**: `run_command` with `netstat -aon | findstr 3333` → parse PID → `run_command` with `taskkill /F /PID <pid>`
- **Restart**: `run_command` with `cmd /c src\agent\start_server.bat`
- **Status**: `run_command` with `netstat -aon | findstr 3333`

> **Antigravity code page safeguard**: On Windows, prepend `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` before any command that may produce non-ASCII output (e.g., `netstat` results with Korean process names).

## Related Skills

<!-- Link related skills here -->
