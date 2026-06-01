# Harness Engineering: Agent Registry & Orchestration Contract

> **⚠️ For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles (PM, Architect, DBA, etc.) for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI), or `.codex/config.toml` (Codex).

> **Scope**: Agent role definitions live in [`agents/*.md`](agents/) — this file is the registry index and orchestration contract only.
> Shared engineering rules (memory logging, language, file isolation, post-write chain, git) live in [docs/context.md](docs/context.md#project-wide-rules-all-tools).
> Tool-specific overrides live in [CLAUDE.md](CLAUDE.md), [GEMINI.md](GEMINI.md), and [.codex/](.codex/).

This file indexes the agent roles and defines the orchestration workflow for the ABAP development ecosystem, organized into Business and Technical groups.

## 🏢 Business Group (Project Governance & Analysis)

### 1. 👑 Global Project Manager (PM)
- **Entry point**: All user requests go through PM first — no agent is dispatched without PM triage
- **Key Tools**: `ListTransports`, `GrepPackages`, `SearchObject`, `RunUnitTests`, `RunATCCheck`
- **Workflow**: 6-step harness lifecycle — Triage → Business Analysis → Governance → Tech Design → Implementation → Finalization (see `agents/pm.md`)
- **Triage shortcut**: `/triage <request>` auto-classifies, creates the task file, and generates the §0-A parallel dispatch block
- **Subagent prompt**: [`agents/pm.md`](agents/pm.md)

### Business Analysts

Each analyst activates on matching trigger keywords, queries SAP directly via read-only MCP tools, produces a structured PRD/AC output, and hands off to the Technical Group.
Load the matching `agents/<module>-analyst.md` file at activation for tools, output format, and domain knowledge.

---

#### 2. 📦 SD Analyst (Sales & Distribution)

- **Trigger keywords**: Sales Order, Delivery, Billing, Shipping, Pricing, Quote, SD, VA*, VL*, VF*, VK*, VBAK, VBAP, LIKP, VBRK
- **Subagent prompt**: [`agents/sd-analyst.md`](agents/sd-analyst.md)
- **Handoff out**: AC List → Architect, Key Tables → DBA

---

#### 3. 🚛 LE Analyst (Logistics Execution)

- **Trigger keywords**: Shipment Processing, Transport, Route Determination, Warehouse, WM, EWM, Handling Unit, Shipment, Route, LE, LT*, HU, VEKP, VEPO, VTTP, LIKP
- **Subagent prompt**: [`agents/le-analyst.md`](agents/le-analyst.md)
- **Handoff out**: Logistics Flow → Architect, Interface Requirements → Interface Expert

---

#### 4. 🏭 PP Analyst (Production Planning)

- **Trigger keywords**: Production Order, BOM, Routing, MRP, Capacity Planning, Work Center, PP, CO*, MAST, STKO, AFKO, PLKO
- **Subagent prompt**: [`agents/pp-analyst.md`](agents/pp-analyst.md)
- **Handoff out**: BOM/Routing Structure → Architect, MRP Logic → DBA

---

#### 5. 🛒 MM Analyst (Materials Management)

- **Trigger keywords**: Purchasing, Goods Receipt, Material Master, Inventory, Inspection, MM, ME*, MARA, MARC, EKKO, EKPO, MKPF, MSEG
- **Subagent prompt**: [`agents/mm-analyst.md`](agents/mm-analyst.md)
- **Handoff out**: Table Structure → DBA, Validation Scenario → QA Engineer

---

#### 6. 💰 FI Analyst (Financial Accounting)

- **Trigger keywords**: Journal Entry, Account, GL, AR, AP, Fixed Asset, Settlement, Compliance, Fiscal Year, FI, FB*, F-*, BKPF, BSEG, ACDOCA, SKA1
- **Subagent prompt**: [`agents/fi-analyst.md`](agents/fi-analyst.md)
- **Handoff out**: Account Determination Logic → Architect, Balance Query → DBA

---

#### 7. 📊 CO Analyst (Controlling)

- **Trigger keywords**: Cost Center, Internal Order, Profitability Analysis, CO-PA, Allocation, CO, KS*, KO*, CSKS, CSKB, COEP, COSP, CE1*
- **Subagent prompt**: [`agents/co-analyst.md`](agents/co-analyst.md)
- **Handoff out**: Allocation Logic → Architect, CO-PA Mapping → DBA

---

## 🛠️ Technical Group (System Execution & Implementation)

Technical agents are dispatched by the PM in Phase 2 (serial execution) or Phase 1 (read-only research).
The **Architect acts as Technical Execution Lead** — it owns Pattern selection, sequences the execution team (code-writer → test-runner), and coordinates DBA/Interface Expert involvement.
Full behavioral rules, tool contracts, and output formats live in the linked `agents/*.md` files.

### 1. 🏗️ Architect _(Technical Execution Lead)_
- **When to dispatch**: After §1 Business Analysis; PM hands off PRD + AC list for technical design
- **Technical Lead responsibilities**: Select Pattern A/B/C; sequence code-writer → test-runner; coordinate DBA and Interface Expert as needed; produce §5 Finalization block for PM
- **Key Tools**: `AnalyzeCallGraph`, `GetCDSDependencies`, `GetCDSImpactAnalysis`, `GrepPackages`, `GetSource`
- **Output**: Execution plan (pattern + object list + serial steps) + §5 Finalization block
- **Subagent prompt**: [`agents/architect.md`](agents/architect.md)

### 2. 💻 ABAP Developer
- **When to dispatch**: After Architect delivers execution plan; serial write phase
- **Key Tools**: `WriteSource`, `EditSource`, `SyntaxCheck`, `GetSource`
- **Output**: Code Writer Report — implemented objects, syntax check status
- **Subagent prompt**: [`agents/code-writer.md`](agents/code-writer.md)

### 3. 🧪 QA Engineer
- **When to dispatch**: After code-writer completes all writes in the execution plan
- **Key Tools**: `RunUnitTests`, `RunATCCheck`, `SyntaxCheck`, `GetSource`
- **Output**: Unit test pass/fail + ATC Priority-1/2/3 findings; P2 requires PM disposition
- **Subagent prompt**: [`agents/test-runner.md`](agents/test-runner.md)

### 4. 🗄️ DBA (Database Agent)
- **When to dispatch**: Task involves table/CDS/index design or complex SQL performance tuning
- **Key Tools**: `RunQuery`, `GetTable`, `GetTableContents`, `SearchObject`
- **Output**: ERD, normalization review, index recommendations, optimized SQL
- **Subagent prompt**: [`agents/dba.md`](agents/dba.md)

### 5. 🚀 DevOps / Admin
- **When to dispatch**: Transport management, infrastructure install (`ZADT_VSP`, abapGit), system audit
- **Key Tools**: `InstallZADTVSP`, `InstallAbapGit`, `GetSystemInfo`, `CreateTransport`, `ReleaseTransport`
- **Output**: Transport CTS report, install status, environment audit
- **Subagent prompt**: [`agents/devops-admin.md`](agents/devops-admin.md)

### 6. 🔍 Intelligence Investigator
- **When to dispatch**: Phase 1 parallel research; codebase pattern scan, historical design extraction
- **Key Tools**: `GrepPackages`, `GrepObjects`, `SearchObject`, `GetSource`
- **Output**: Investigator Report — matched objects, pattern summary, recommended action
- **Subagent prompt**: [`agents/sap-investigator.md`](agents/sap-investigator.md)

### 7. 🔌 Interface Expert
- **When to dispatch**: OData/RFC/IDoc interface design required; external system integration
- **Key Tools**: `GetODataMetadata`, `TestODataService`, `GetCDSExposure`, `GetCDSDependencies`
- **Output**: Interface design spec, BAPI/API mapping, connectivity validation
- **Subagent prompt**: [`agents/interface-expert.md`](agents/interface-expert.md)

### 8. 🎨 Fiori Developer / UX Designer
- **When to dispatch**: UI5/Fiori screen design or BSP implementation required
- **Key Tools**: `UI5ListApps`, `UI5GetApp`, `UI5GetFileContent`, `GetODataMetadata`, `EditSource`
- **Output**: UI design artifacts (HTML/SVG mockups) + implemented UI5 source
- **Subagent prompt**: [`agents/fiori-developer.md`](agents/fiori-developer.md)

---

### 9. 📑 Form Expert
- **When to dispatch**: SAP Script, Smart Forms, or Adobe Forms design; print program development
- **Key Tools**: `GetSource`, `EditSource`, `GrepObjects`, `SearchObject`, `SyntaxCheck`
- **Output**: Form layout design + print program implementation
- **Subagent prompt**: [`agents/form-expert.md`](agents/form-expert.md)

---

### 11. 🛡️ Security Monitor
- **When to dispatch**: Phase 1 triage or prior to writes; enforces security policies and safe dependencies.
- **Key Tools**: `GrepObjects`, `GetSource`
- **Output**: Security assessment
- **Subagent prompt**: [`agents/security-monitor.md`](agents/security-monitor.md)

---

### 10. 🤖 SAP GUI Scripting Expert
- **When to dispatch**: ⚠️ LAST RESORT — only when no BAPI/OData/RFC alternative exists; BDC or VBS automation required
- **Key Tools**: `GetSource`, `GrepObjects`, `SearchObject`, `RunQuery`
- **Output**: BDC program + screen flow documentation (DYNPRO numbers, field IDs)
- **Subagent prompt**: [`agents/gui-scripter.md`](agents/gui-scripter.md)

---

## Agent Coordination & Orchestration Rules

### 🔄 Agent Coordination Workflow (Harness Advanced)

1.  **Triage & Initial Research (PM & Subagents)**:
    *   The **Global PM** receives and classifies the request.
    *   Immediate research is dispatched (Parallel: `sap-investigator` + `read-only-analyst` + `schema-inspector`) to gather technical and business data before any discussion.

2.  **Business Analysis & AC Definition (Biz Group)**:
    *   Module analysts (SD, MM, etc.) discuss the request based on research data.
    *   **Output**: PRD (Product Requirements Document) and clear **Acceptance Criteria (AC)**.

3.  **Governance & Implementation Approval (PM & User)**:
    *   PM Agent reviews the PRD/AC and confirms the scope.
    *   **User Approval Required**: For high-risk changes (Core BAPI/CDS modification, Schema changes, cross-module refactors).

4.  **Technical Design & Impact Analysis (Tech Group)**:
    *   Technical agents (Architect, DBA, Developer) design the implementation.
    *   **Impact Analysis**: Use `sap:impact-architecture` to identify side effects. Architect defines OOP structure; DBA reviews indexing.

5.  **Implementation & Verification Chain (Assigned Agents)**:
    *   Implementation is delegated to `code-writer` and verification to `test-runner`.
    *   **Mandatory Chain**: Must pass `SyntaxCheck` → `RunUnitTests` → `RunATCCheck` (Zero P1 findings).

6.  **Finalization, Sync & Reporting (PM)**:
    *   **Memory Logging**: Record key decisions and issues in `memory/YYYY-MM-DD.md`.
    *   **Git Sync**: Execute `vsp-sync` to commit artifacts and update index.
    *   **Final Report**: PM summarizes the outcome and test results for the user.

### 🤖 PM Subagent Dispatch Protocol

This protocol defines **when and how** PM dispatches parallel subagents.
Agent definitions live in `agents/`.

#### Dispatch Decision Tree

```
Request received
  │
  ├─ Read-only? (analyze, search, query, inspect)
  │    └─► PARALLEL SKILLS — Primary Agent dispatches research subagents
  │          ├── sap-investigator   → codebase scan (Skills: memory-intelligence, bapi-explorer)
  │          ├── read-only-analyst  → business data queries (Module analyst contexts)
  │          └── schema-inspector   → table/CDS structure (Skill: impact-architecture)
  │
  └─ Write? (EditSource, WriteSource, SyntaxCheck)
       └─► SERIAL SUBAGENTS — delegate to specialized execution subagents
             ├── code-writer  → ABAP implementation (EditSource/WriteSource/SyntaxCheck)
             └── test-runner  → Stability verification (RunUnitTests/RunATCCheck)
```

#### Subagent Roster

##### 1. Parallel Research & Design Agents (Read-Only)
These subagents can be run simultaneously during initial triage and design phases. They must never perform write actions.

| Subagent | Prompt file | Parallelizable | Design/Read Allowed Tools |
|----------|-------------|:--------------:|---------------------------|
| `sap-investigator` | `agents/sap-investigator.md` | ✅ Always | `GrepPackages`, `GrepObjects`, `SearchObject` |
| `read-only-analyst` | `agents/read-only-analyst.md` | ✅ Always | `RunQuery`, `GetTable`, `GetTableContents` |
| `schema-inspector` | `agents/schema-inspector.md` | ✅ Always | `GetTable`, `GetCDSDependencies`, `GetSource` (read) |
| `security-monitor` | `agents/security-monitor.md` | ✅ Always | `GrepObjects`, `GetSource` (read) |
| `fiori-dev` (Design Mode) | `agents/fiori-developer.md` | ✅ Design only | `UI5ListApps`, `UI5GetApp`, `UI5GetFileContent`, `GetODataMetadata`, `GetCDSExposure` |
| `form-expert` (Design Mode) | `agents/form-expert.md` | ✅ Design only | `GrepObjects` |

##### 2. Serial Execution & Verification Agents (Write-Capable)
These subagents are run sequentially because they execute write operations (lock management) or verification sequences.

| Subagent | Prompt file | Parallelizable | Write/Execution Allowed Tools |
|----------|-------------|:--------------:|------------------------------|
| `code-writer` | `agents/code-writer.md` | ❌ Never | `EditSource`, `WriteSource`, `SyntaxCheck` |
| `fiori-dev` (Write Mode) | `agents/fiori-developer.md` | ❌ Serial Write | `EditSource`, `SyntaxCheck` |
| `form-expert` (Write Mode) | `agents/form-expert.md` | ❌ Serial Write | `EditSource` |
| `test-runner` | `agents/test-runner.md` | ❌ After write | `RunUnitTests`, `RunATCCheck` (verification) |
| `gui-scripter` | `agents/gui-scripter.md` | ❌ Never | `GetSource`, `GrepObjects`, `SearchObject`, `RunQuery` |

#### Parallel Dispatch Rules

1. **Single message, multiple Agent() calls** — all parallel subagents must be dispatched in one turn.
2. **Serial write execution** — `EditSource`, `WriteSource`, `SyntaxCheck` are executed by the ABAP Developer in serial to prevent lock conflicts.
3. **Merge before proceeding** — PM waits for ALL parallel subagents to return before moving to the next serial step.
4. **Error handling** — if any parallel subagent fails, PM resolves the failure before proceeding. Do not skip.
5. **Context passing** — PM includes the relevant `agents/<module>-analyst.md` path in each subagent prompt so the subagent has domain context without reading all files.

#### Typical Dispatch Sequences by Task Type

| Task type | Phase 1 (parallel research) | Phase 2 (serial execution) |
|-----------|-----------------------------|----------------------------|
| New ABAP object | investigator + analyst + schema | code-writer → test-runner |
| Bug fix | investigator + schema | code-writer → test-runner |
| Data analysis report | analyst + schema | — (read-only task ends here) |
| Refactor across package | investigator + schema | code-writer per object → test-runner |
| Interface design | analyst + schema + investigator | Interface Expert designs → code-writer implements |
| Fiori / UX design | analyst + fiori-dev (Design Phase — Design Mode) | fiori-dev (Write Phase) → test-runner |
| Form / Output design | analyst + schema (Design Phase) | form-expert (Write Phase) → test-runner |
| Automation Scripting | analyst + investigator | gui-scripter develops → code-writer integrates |

---

### 🗺️ Agent Role Boundary Matrix

Use this matrix to resolve ambiguity when multiple agents could handle a request.

#### Research Agents — When to Use Which

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Search for objects by name pattern across packages | `sap-investigator` | `read-only-analyst`, `schema-inspector` |
| Query business data from SAP tables (VBAK, EKKO, BKPF…) | `read-only-analyst` | `sap-investigator` |
| Inspect a CDS view's dependencies or a table's field structure | `schema-inspector` | `read-only-analyst` |
| Trace which programs call a specific function module | `sap-investigator` (`GrepObjects`) | `schema-inspector` |
| Analyse existing ABAP source logic | `architect` (`GetSource` + `AnalyzeCallGraph`) | `read-only-analyst` |
| Check if a column/index exists on a DB table | `schema-inspector` (`GetTable`) | `read-only-analyst` |

#### Technical Agents — When to Use Which

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Design the DB/CDS schema (ERD, normalization, indexing) | `dba` | `architect` |
| Design the implementation pattern (A/B/C) and execution plan | `architect` | `dba` |
| Write or modify ABAP source code | `code-writer` | `architect` |
| Run SyntaxCheck → RunUnitTests → RunATCCheck | `test-runner` | `code-writer` |
| Create / release a Transport Request | `devops-admin` | `code-writer` |
| Design OData / RFC / IDoc interfaces | `interface-expert` | `architect` |
| Design Fiori / UI5 screens | `fiori-developer` | `interface-expert` |
| Automate SAP GUI transactions (BDC, scripting) | `gui-scripter` | `code-writer` |

#### Business Analyst Selection

| Trigger keywords | Activate |
|------------------|---------|
| Sales Order, Delivery, Billing, Pricing, VA\*, VL\*, VF\*, VBAK | `sd-analyst` |
| Purchase Order, Goods Receipt, Material Master, ME\*, EKKO, MARA | `mm-analyst` |
| Shipment, Transport Route, Warehouse, WM, EWM, VTTP | `le-analyst` |
| Production Order, BOM, MRP, Routing, CO\*, AFKO | `pp-analyst` |
| Journal Entry, GL, AR, AP, Fixed Asset, FB\*, BKPF, ACDOCA | `fi-analyst` |
| Cost Center, Internal Order, CO-PA, Allocation, KS\*, COEP | `co-analyst` |

#### Escalation Rules

- If **both** `dba` and `schema-inspector` are needed: run `schema-inspector` first (read-only research), then dispatch `dba` with findings.
- If **both** `architect` and `dba` are needed: architect defines the pattern, dba validates the data model — always in that order.
- If a task spans multiple business modules: activate **all relevant analysts in parallel**, then PM synthesizes their ACs before proceeding to `architect`.

---

### 🔀 Cross-Module Integration Orchestration

Use this section when a request spans two or more SAP modules (e.g., SD billing → FI posting, MM goods receipt → FI accounting).

#### Activation Rule

If a user request contains trigger keywords matching **two or more modules**, activate both analysts **in parallel** (same dispatch message). Do not wait for one to finish before starting the other.

#### PRD Ownership

- **PM is the PRD owner** when the request is cross-module.
- Each analyst contributes their own AC section (prefixed with their module: `SD-AC-01`, `FI-AC-01`, etc.).
- PM synthesizes the combined AC list and confirms with the user before proceeding to Technical Design.

#### Primary Analyst Rule

The module where the **symptom originates** is the primary analyst:
- "FI document not posted after billing" → SD is primary (symptom is in SD billing flow)
- "Stock value wrong after GR" → MM is primary (symptom is in goods receipt)
- Primary analyst leads the handoff to Architect.

#### Standard Cross-Module Scenario Templates

| Scenario | Primary | Secondary | Key Link Tables |
|----------|---------|-----------|-----------------|
| SD Billing → FI Posting | SD Analyst | FI Analyst | VBRK↔BKPF via VBRK.BELNR, VKOA (account determination) |
| MM Goods Receipt → FI Accounting | MM Analyst | FI Analyst | MKPF/MSEG↔BKPF via RE_BELNR, T030/OBYC (account determination) |
| SD Order → LE Delivery | SD Analyst | LE Analyst | VBAK/VBAP↔LIKP/LIPS via VBFA document flow |
| PP Production → MM Material Consumption | PP Analyst | MM Analyst | AFKO↔MKPF/MSEG via AUFNR, RESB (component reservation) |

#### Escalation

If the cross-module analysis reveals conflicting ACs (e.g., SD wants field X, FI constraint blocks it), PM escalates to the user for resolution before proceeding to Architect.

---

*Last Updated: 2026-06-01 (rev 2)*


## Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:
- **Core Principles**: Always follow SOLID principles and write unit tests when creating functional code.
- **Security Boundaries**: Never expose or log secrets (API keys, tokens). Do not modify CI/CD pipelines without explicit permission.
- **Communication Style**: Keep explanations concise and use markdown formatting. Always explain "why", not just "what".
- **Conflicting Instructions**: If a user request violates project rules (e.g., bypassing tests), warn the user and request explicit confirmation before proceeding.
- **Anti-Patterns to Avoid**: Do not apply overly restrictive logical rules (e.g., "never use loops") or repeat basic knowledge.


## Error Recovery

When a subagent fails or returns unexpected results:

1. **Analyze the error**: Check if it's a tool error, context issue, or logic problem
2. **Retry with clarification**: Provide more specific instructions
3. **Escalate to human**: If 3 retries fail, surface the issue to the user
4. **Document the pattern**: Add to memory/ for future reference

### Error Recovery Implementation

The project includes `scripts/retry-handler.ts` which provides:

- **3-retry limit** with exponential backoff
- **Error classification** (tool, context, logic, external)
- **Recovery suggestions** based on error type
- **Human escalation** after retries exhausted

**Usage in dispatch scripts:**

```typescript
import { withRetry, escalateToHuman } from "./retry-handler";

const result = await withRetry(
  () => dispatchSubagent(task),
  { maxRetries: 3, initialDelay: 1000, backoffMultiplier: 2, maxDelay: 10000 },
  "Task Description"
);

if (!result.success) {
  escalateToHuman("Task Description", result.lastError!, result.attempts);
  process.exit(1);
}
```

---

## Dynamic Roster Updates
**Note on Phase 0 Kickoff:** The PM agent is explicitly authorized to assess project requirements during kickoff and dynamically expand this AGENTS.md registry by creating new specialist agents or skills.

---

## Phase 2: Orchestration Layer

### Dispatch Automation

The project includes automated dispatch scripts for coordinating multi-agent workflows:

- `scripts/dispatch.ts` - Main CLI dispatcher with parallel/serial modes
- `scripts/dispatch-parallel.ts` - Parallel agent dispatcher for read-only tasks
- `scripts/dispatch-serial.ts` - Serial pipeline executor for write operations

**Usage:**
```bash
bun scripts/dispatch.ts parallel   # Multiple read-only agents
bun scripts/dispatch.ts serial     # Sequential workflow
```

### Error Recovery Protocol

The orchestration layer includes automated error recovery:

1. **Automatic retry** - Up to 3 attempts with exponential backoff
2. **Error classification** - Tool, context, logic, or external errors
3. **Recovery suggestions** - Targeted guidance per error type
4. **Human escalation** - Formatted output after retries exhausted

See `scripts/retry-handler.ts` for implementation details.

**Integration with dispatch:**
```typescript
import { withRetry, escalateToHuman } from "./retry-handler";

const result = await withRetry(
  () => dispatchSubagent(task),
  { maxRetries: 3, initialDelay: 1000, backoffMultiplier: 2, maxDelay: 10000 },
  "Task Description"
);

if (!result.success) {
  escalateToHuman("Task Description", result.lastError!, result.attempts);
  process.exit(1);
}
```

### Skill Auto-Discovery

Skills are automatically discovered from `skills/` directory with metadata extraction:

- **Frontmatter extraction** - Parses name, description, and metadata.type
- **Trigger detection** - Extracts trigger phrases from skill content
- **Auto-generated index** - Creates `skills/SKILLS.md` with catalog

Run `bun scripts/verify-skills.ts` to verify all skills and regenerate the index.

**Metadata structure:**
```typescript
interface SkillMetadata {
  name: string;
  description: string;
  type: string;
  triggers: string[];
}
```

### Orchestration Patterns

**Parallel Dispatch (Read-Only):**
- Use for: Initial research, schema inspection, business analysis
- Agents: `sap-investigator`, `read-only-analyst`, `schema-inspector`
- Command: `bun scripts/dispatch.ts parallel`

**Serial Execution (Write):**
- Use for: Code implementation, testing, transport management
- Agents: `code-writer` → `test-runner` (ordered sequence)
- Command: `bun scripts/dispatch.ts serial`
