---
name: transport
description: Manage SAP Transport Requests (CTS) — list, create, add objects, release, and check status of transport requests. Runs pre-release quality gate before releasing.
argument-hint: "<action> [arguments]  (actions: list, create, add, release, status)"
allowed-tools: ["mcp__abap__ListTransports", "mcp__abap__CreateTransport", "mcp__abap__GetTransport", "mcp__abap__AddToTransport", "mcp__abap__ReleaseTransport", "mcp__abap__SyntaxCheck", "mcp__abap__RunUnitTests", "mcp__abap__RunATCCheck"]
---

# Transport

Manage SAP Transport Requests (CTS) for the current task.

Supported actions:

## `list` — Show open transports
```
/transport list
```
Calls `ListTransports` and displays all open transport requests in a table:
| Transport | Description | Owner | Status | Objects |

## `create` — Create a new transport request
```
/transport create <description>
```
Calls `CreateTransport` with the provided description.
Reports the new transport number (e.g. `NPL K000001`).

## `add` — Add an object to a transport
```
/transport add <transport_number> <object_url>
```
Calls `AddToTransport` with the given transport number and ADT object URL.
Confirms the object is listed in the transport after the call.

## `release` — Release a transport for import
```
/transport release <transport_number>
```
**Before releasing**, automatically verifies:
1. `SyntaxCheck` passes on all objects in the transport (0 errors)
2. `RunUnitTests` passes (0 failures)
3. `RunATCCheck` has 0 Priority-1 findings

If all checks pass, calls `ReleaseTransport`.
If any check fails, reports the failure and **does not release**.

## `status` — Show details of a specific transport
```
/transport status <transport_number>
```
Calls `GetTransport` and displays object list, status, and timestamps.

## Notes

- Transport operations affect the shared SAP system — always confirm with the user before `release`.
- After release, remind the user to run `/sync` to log the transport number in today's memory file.
- If $ARGUMENTS is provided without a sub-action keyword, treat it as `list`.
