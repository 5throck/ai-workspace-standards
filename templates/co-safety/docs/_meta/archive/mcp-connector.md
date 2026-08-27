# MCP Connector Architecture

## Overview
This document details the Docker-less, lightweight local process isolation architecture for the MCP (Model Context Protocol) Connector in Safety OS.

## Architecture

### 1. Docker-less Process Isolation
Instead of relying on Docker containers which can be heavy and require daemon privileges, the MCP Connector uses native process isolation mechanisms:
- Spawns lightweight separate background processes for each MCP server.
- Uses standard I/O streams or local IPC (Inter-Process Communication) to communicate.
- In Windows, relies on Job Objects and strict ACLs to sandbox each connector process.

### 2. Lifecycle Management
- **Startup**: The main agent or orchestrator spawns the MCP processes on demand.
- **Monitoring**: Processes are monitored for resource utilization (CPU, memory).
- **Shutdown**: Graceful termination via SIGTERM, with fallback to SIGKILL for unresponsive processes.

### 3. Security Boundary
- Minimal file system access: Each MCP process only gets access to the directory it needs (e.g., specific `mcp/` server folder).
- Network isolation: Blocked from arbitrary outbound access. 

## Benefits
- Reduced overhead and faster startup times compared to full containers.
- Better local development experience without Docker dependencies.
- Simpler deployment for lightweight desktop or native edge environments.
