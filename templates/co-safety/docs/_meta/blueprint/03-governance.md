# Part III — Governance Architecture

## Document Control

| Property | Value |
|----------|-------|
| Document ID | 03-governance.md |
| Status | Active |
| Date | 2026-07-11 |
| Classification | Internal |

## 3.1 Hierarchy

The governance architecture of Safety OS is strictly hierarchical, ensuring that strategy dictates execution, and execution is continually monitored for compliance.

*   **Top Tier (Strategic)**: The PM Agent (acting as Chief Safety Officer).
*   **Middle Tier (Management)**: Safety Governance Manager (SGM) and Safety Workflow Manager (SWM).
*   **Execution Tier (Operational)**: Specialist Agents (Compliance, Risk, Emergency, Audit, etc.).

All requests flow from the user through the PM. The PM delegates strategic planning and objective setting to the SGM, while operational execution and daily task routing are handled by the SWM. Specialist agents operate under the direct supervision of the SWM or PM, executing specific tasks within defined boundaries.

## 3.2 PM as CSO (Chief Safety Officer)

In the Safety OS ecosystem, the PM agent assumes the critical role of Chief Safety Officer (CSO). The CSO is the ultimate gatekeeper for all system actions.

*   **Gateway Enforcement**: The CSO enforces the "PM Gateway" policy. No specialist agent can be invoked directly by a user.
*   **Legal Basis Verification**: Before any workflow is dispatched, the CSO must verify the presence of a valid `legal_basis` (e.g., OSHA-KR Article 36).
*   **Escalation Point**: The CSO handles all out-of-bounds requests, permission denials, and critical escalations from subordinate agents.
*   **Final Approver**: For high-risk operations or significant architecture changes, the CSO provides the final sign-off before execution.

## 3.3 Safety Governance Manager (SGM)

The Safety Governance Manager is responsible for the strategic alignment of the organization's EHS objectives with regulatory requirements.

*   **KPI Definition**: The SGM defines and tracks safety Key Performance Indicators (KPIs) such as Incident Frequency Rates and Audit Pass Rates. See `docs/governance/kpi-definitions.md` for the current KPI set: six core KPIs (LTIFR, Audit Pass Rate, Corrective Action Closure Rate, TRIR, LTIR, Near-Miss Reporting Rate) plus SAPA compliance metrics (SAPA-Qualifying Incident Count, `sapa_qualifying` Field Completeness).
*   **Compliance Strategy**: It translates abstract regulatory requirements (like SAPA's mandate for an occupational safety and health management system) into concrete objectives.
*   **Annual Planning**: The SGM assists in generating annual safety plans and distributing safety targets across different organizational units.
*   **Policy Output**: Approved policies are written to `policies/` per the naming convention documented in `policies/README.md`.

## 3.4 Safety Workflow Manager (SWM)

The Safety Workflow Manager translates the strategy set by the SGM into daily operational reality on the manufacturing floor.

*   **Workflow Orchestration**: The SWM coordinates complex, multi-agent workflows such as the Permit-to-Work (PTW) process.
*   **Resource Allocation**: It assigns tasks to appropriate specialist agents (e.g., routing a hazard report to the Risk Assessment Agent).
*   **Real-time Monitoring**: The SWM monitors the status of all active workflows, identifying bottlenecks and ensuring timely completion of safety-critical tasks.

## 3.5 Agent Team Assembly

Agent teams in Safety OS are assembled dynamically based on the requirements of the requested workflow, but always under the PM's orchestration.

*   **Task Decomposition**: The PM or SWM breaks down a high-level request into specific tasks requiring distinct skills.
*   **Specialist Selection**: Agents are selected from the roster based on their predefined capabilities (e.g., Compliance Agent for regulatory checks, Audit Agent for evidence verification).
*   **Parallel Execution**: When tasks have no sequential dependencies, multiple agents may be dispatched simultaneously to improve efficiency, communicating results back to the orchestrating manager.

## 3.6 Document Governance

Document governance is a critical component of regulatory compliance. Safety OS enforces strict rules on document creation, modification, and storage.

*   **Language Policy**: Documentation language follows the layered policy defined in the workspace `AGENTS.md` (§Language Policy): Layer A mandates English for system/governance/agent files consumed by AI tooling, while Layer C keeps human operational documents (e.g., approved policies in `policies/`) Korean-canonical; recognized locale translation zones (e.g., `ko/`) remain exceptions.
*   **Evidence Traceability**: All generated records (evidence models) must include a timestamp, agent ID, workflow ID, and the legal basis.
*   **Centralized Storage**: Documents are organized into designated directories (`docs/` for analysis, `memory/` for session logs and evidence), preventing fragmentation.
*   **Version Control**: Immutable audit trails are maintained by ensuring that approved documents are version-controlled and changes are tracked through automated QA gates.

## 3.7 Public Data Attribution

Whenever legal data from the `k-law` skill (법제처 Open API) or the `kr_safety` MCP is used, the system must automatically append the following text to outputs or UIs: "본 데이터는 대한민국 법제처/국가법령정보센터의 데이터를 기반으로 함". (The former `Legalize KR` and `mcp-kr-legislation` MCP servers were removed 2026-08-26 — superseded by k-law.)
