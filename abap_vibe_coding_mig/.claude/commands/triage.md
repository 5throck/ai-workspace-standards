---
name: triage
description: Automatically classify the incoming SAP ABAP request, create a task file, and generate the Phase 1 parallel dispatch block for sap-investigator, read-only-analyst, and schema-inspector agents.
argument-hint: "<user request text>"
allowed-tools: ["Bash"]
---

# /triage — Task Triage & Auto-Dispatch

Automatically classify the incoming request, create a task file, and generate the §0-A parallel dispatch block.

## Steps

### 1. Module Detection

Scan `$ARGUMENTS` for these keyword groups:

| Keywords found | Module |
|---------------|--------|
| Sales Order, Delivery, Billing, Pricing, SD, VA*, VL*, VF*, VBAK, VBAP, LIKP, VBRK | SD |
| Shipment, Transport, Route, Warehouse, WM, EWM, Handling Unit, LE, VTTP, VEKP | LE |
| Production Order, BOM, Routing, MRP, Work Center, PP, AUFK, AFKO, MAST, STKO | PP |
| Purchase Order, Goods Receipt, Material Master, Inventory, MM, ME*, EKKO, EKPO, MARA | MM |
| Journal Entry, Account, GL, AR, AP, Fixed Asset, FI, FB*, BKPF, BSEG, ACDOCA | FI |
| Cost Center, Internal Order, CO-PA, Allocation, CO, KS*, CSKS, COEP, COSP | CO |

If multiple modules match, select the one with the most keyword hits.  
If no module matches, assign `CROSS` and note it.

### 2. Classification

| Pattern in request | Classification |
|-------------------|----------------|
| fix, bug, error, dump, ABAP runtime | `Debug` |
| graph, call hierarchy, where-used, impact | `Graph Analysis` |
| API, OData, RFC, IDoc, interface, integration | `Interface` |
| install, transport, deploy, CTS, system | `Infra` |
| everything else | `ABAP Dev` |

### 3. Create Task File

Run the task creation script:

```bash
bash "${CLAUDE_PLUGIN_ROOT:-.}/scripts/vsp-task.sh" "$ARGUMENTS"
```

Note the generated filename (e.g., `scratch/tasks/task-2026-05-05-001.md`).

### 4. Pre-fill §0

Output the following block (filled with detected values) for the user to paste into the task file:

```markdown
## 0. Request

**Received by (PM)**: <TODAY YYYY-MM-DD HH:MM>
**User Request**:
> <$ARGUMENTS verbatim>

**Classification**: <detected classification>
**Package**: $TMP
**Affected Object Types**: <!-- fill after investigation -->

**Agents Selected**:
- Business: <detected module> Analyst
- Technical: Architect / ABAP Developer / DBA / QA
```

### 5. Generate §0-A Parallel Dispatch Block

Based on the detected module, output the ready-to-use dispatch block:

```markdown
## 0-A. PM Parallel Dispatch (Phase 1 — Read-Only)

Agent 1 — sap-investigator  (prompt: agents/sap-investigator.md)
  Task: Scan existing codebase for related objects
  Input:
  {
    "task": "Find objects related to: <$ARGUMENTS>",
    "packages": ["$TMP"],
    "patterns": ["<MODULE_TABLE_1>|<MODULE_TABLE_2>"],
    "object_type_filter": "PROG|CLAS",
    "max_results": 30
  }

Agent 2 — read-only-analyst  (prompt: agents/read-only-analyst.md)
  Task: Query SAP tables for AS-IS data
  Input:
  {
    "task": "<$ARGUMENTS>",
    "module": "<MODULE>",
    "context_file": "agents/<module>-analyst.md",
    "queries": [
      { "purpose": "Count affected records", "sql": "SELECT COUNT(*) FROM <MAIN_TABLE> WHERE <condition>", "max_rows": 50 }
    ],
    "tables_to_inspect": ["<MODULE_TABLE_1>", "<MODULE_TABLE_2>"]
  }

Agent 3 — schema-inspector  (prompt: agents/schema-inspector.md)
  Task: Inspect table structures
  Input:
  {
    "task": "Provide schema context for <$ARGUMENTS>",
    "tables": ["<MODULE_TABLE_1>", "<MODULE_TABLE_2>"],
    "cds_views": [],
    "focus": "key_fields"
  }
```

Replace `<MODULE_TABLE_N>` with the module's standard tables from `schema-inspector.md § Standard Table Groups`.

### 6. Next Step Reminder

```
✅ Task file created: scratch/tasks/task-YYYY-MM-DD-NNN.md
📋 Copy §0 and §0-A above into the task file.
▶  Dispatch all 3 agents IN A SINGLE MESSAGE (parallel).
⏳ Wait for all 3 results, then synthesize into §1 Business Analysis.
```

---

*Last Updated: 2026-06-01*
