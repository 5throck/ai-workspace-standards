# MCP Integration Guide

> **Purpose**: How Safety OS connects to the Korean regulatory MCP server for index data.
>
> **2026-08-26**: The `legalize_kr` and `mcp_kr_legislation` MCP servers were removed (superseded by the `k-law` skill — 법제처 Open API is the sole live statute CONTENT source). Only `kr_safety` remains as an MCP server.

## 1. Available MCP Servers

Safety OS includes 1 Korean regulatory MCP server:

| Server | Location | Tools | Purpose |
|--------|----------|-------|---------|
| `kr_safety` | `mcp/kr-safety-regs/` | 5 tools | Korean safety regulations search (OSHA-KR, SAPA, CCA), compliance gap analysis |

Statute CONTENT (law text, article structure, amendment history) is retrieved live via the **`k-law` skill** (법제처 Open API), not via MCP.

## 2. Configuration

MCP server is configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "kr_safety": {
      "command": "bun",
      "args": ["run", "--env-file", ".env", "./mcp/kr-safety-regs/index.ts"]
    }
  }
}
```

## 3. Domain Integration Points

### PSM Domain
- `regulations/KR/OSHA-KR-*.yaml` — coordinate registries; article content fetched live via k-law skill

### MSDS Domain
- `regulations/KR/OSHA-KR-MSDS.yaml` — coordinate registry
- `regulations/KR/K-REACH.yaml` — coordinate registry
- kr_safety tools for compliance gap analysis (OSHA-KR, SAPA articles)

### Compliance Agent (cross-domain)
`agents/_shared/compliance-agent.md` (updated 2026-07-11) formalizes live-law verification as a standard step, not an ad hoc activity:
- `mcp__kr_safety__search_osha_regulations`, `mcp__kr_safety__check_compliance_gaps` — live OSHA-KR regulation lookup and gap checking
- `k-law` skill — live Korean statute verification (article numbers, amendment history)
- Used to verify article-number accuracy before citing in `legal_basis` fields — this project has a documented history of mis-citations (see `memory/findings/compliance-gap-2026-07-05-all-domains.md`) that live-law verification catches.

### GMP Domain
- `regulations/KR/MFDS-GDP.yaml` — coordinate registry

### All Domains
- v2 coordinate registries carry `source_verification` (method + checked_at); legacy `source_mcp` fields are no longer asserted
- Audit script validates `source_verification` on coordinate-mode files

## 4. Usage in Workflows

Agents query regulatory data during workflow execution:

```
1. Agent receives task
2. Agent queries the k-law skill for current law text (kr_safety for OSHA-KR/SAPA index lookups)
3. Agent verifies workflow legal_basis against current law
4. Agent generates evidence record with verified legal references
```

## 5. Environment Setup

```bash
# .env file
LAW_API_OC=...                 # 법제처 Open API OC key — required by the k-law skill
# kr-safety-regs uses cached data + live API (no token needed)
```

## 6. Future Integration (v2)

- Real-time law amendment notifications
- Automated legal_basis refresh when regulations change
- ML-powered regulation interpretation
- Cross-reference validation against actual law text
