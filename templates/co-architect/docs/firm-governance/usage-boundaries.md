# Agent Usage Boundaries Document

**Project**: co-architect — AI Agent Team for Architecture Firms
**Authority**: Project Management Office (PM) / Firm Governance
**Document Class**: Binding Governance — Mandatory Compliance
**Status**: Approved
**Effective Date**: 2026-06-15

---

## 1. Purpose & Scope

### 1.1 Purpose

This document defines the **non-negotiable operational boundaries** for the five (5) AI agents deployed by the firm: **Intake, Research, Review, QA, and Communication**. It exists to:

1. Protect the firm, its licensed architects, its clients, and the public from harm caused by unaccountable automated decisions.
2. Preserve the **legal integrity** of the architectural design process under the **Architects Act**, under which legal responsibility for design is borne exclusively by the licensed architect of record.
3. Establish a single, authoritative reference that all staff consult before delegating any task to an agent.
4. Prevent misuse — both intentional and accidental — that could expose the firm to regulatory penalties, civil liability, or reputational damage.

### 1.2 Scope

This document governs:

- All five named agents and any future agent added to the team.
- All firm staff who interact with the agents, directly or indirectly.
- All client-facing and internal deliverables produced, summarized, or drafted by the agents.
- All data ingested by the agents, including drawings, contracts, financial information, and regulatory text.

### 1.3 Who Must Read This

> ⚠️ **Mandatory reading.** Every individual below must read, acknowledge, and comply with this document before being granted access to any agent:

| Audience | Requirement |
|----------|-------------|
| Licensed Architects of Record | Read, acknowledge, and enforce the two Human-in-the-Loop gates. |
| Project Managers | Read, acknowledge, and route tasks correctly to agents. |
| Junior Staff / Drafters | Read, acknowledge, and understand what they may NOT ask agents to do. |
| Administrative / Communications Staff | Read, acknowledge, and understand the Communication agent's boundaries. |
| Contractors & External Collaborators | Read and acknowledge before any agent output is shared with them. |

Acknowledgement is recorded by the PM and renewed annually, or upon any material revision to this document (see §9).

---

## 2. Core Principle: Human-in-the-Loop

### 2.1 The Foundational Rule

> ⚠️ **Agents are ASSISTANTS, never decision-makers.**
>
> Under the Architects Act, legal responsibility for every design decision rests with the **licensed architect of record**. No agent — regardless of capability, confidence, or apparent correctness — may make, finalize, or imply a binding decision. The architect reviews, decides, and signs. The agent only prepares, summarizes, checks, and communicates.

This principle is not a recommendation. It is a **regulatory and legal boundary**. Violating it voids the firm's liability protections and may constitute professional misconduct.

### 2.2 The Two Mandatory Review Gates

The agent workflow contains **two non-skippable Human-in-the-Loop gates**. Work cannot advance past either gate without the architect's explicit, recorded approval.

| Gate | Position | Pre-conditions for opening | Architect's sign-off means |
|------|----------|----------------------------|----------------------------|
| **Gate 1 — Requirements & Regulations Confirmed** | After **Intake + Research** | Intake summary delivered; Research regulatory summary delivered with cited sources. | "I have verified the client requirements and the applicable regulatory references. Proceed to design review." |
| **Gate 2 — Final Design Approval** | After **Review + QA** | Review design-coherence report delivered; QA compliance checklist delivered. | "I have reviewed the design and verified QA findings against my professional judgment. This output is approved for the next stage." |

If either gate is bypassed, attempted, or forged, the work product is **invalid** and must be restarted from the most recent approved gate. See §8 for the detailed procedure at each gate.

---

## 3. Agent Capability Matrix

Legend: ✅ **CAN** (agent performs autonomously) · ❌ **CANNOT** (never permitted, regardless of request) · ⚠️ **REQUIRES ARCHITECT CONFIRMATION** (agent prepares; architect approves before use)

### 3.1 Intake Agent

| Action | Permission | Notes |
|--------|:----------:|-------|
| Collect and structure client requirements from forms, briefs, and meeting notes. | ✅ CAN | Source documents are archived verbatim. |
| Draft an initial project scope and budget estimate outline. | ⚠️ Confirm | Architect must approve scope and budget before sharing with the client. |
| Identify missing information and generate a clarification questionnaire. | ✅ CAN | |
| Interpret ambiguous or contradictory client requirements into a fixed scope. | ❌ CANNOT | Ambiguity is escalated to the architect. |
| Make commitments to the client (timeline, fee, deliverables). | ❌ CANNOT | All commitments are made by the architect or authorized PM. |

### 3.2 Research Agent

| Action | Permission | Notes |
|--------|:----------:|-------|
| Retrieve and summarize applicable zoning, building code, and regulatory articles. | ✅ CAN | Output is a **reference summary**, never a legal determination (see §4). |
| Cite the exact source article, clause number, and retrieval date for every claim. | ✅ CAN | Mandatory; uncited claims are rejected at Gate 1. |
| Flag apparent conflicts between code clauses. | ✅ CAN | Conflict is flagged, never resolved by the agent. |
| Make a final determination of code compliance. | ❌ CANNOT | Regulatory determination is the architect's legal act. |
| Track real-time amendments to laws, codes, or local ordinances. | ❌ CANNOT | The agent does not watch the gazette in real time; the architect verifies currency before any permit submission. |

### 3.3 Review Agent

| Action | Permission | Notes |
|--------|:----------:|-------|
| Review drawings and documents for internal consistency, completeness, and design coherence. | ✅ CAN | |
| Compare the design against Research agent's regulatory summary and flag deviations. | ⚠️ Confirm | Deviation flags are advisory; the architect resolves each one. |
| Propose design alternatives or revisions. | ⚠️ Confirm | All design changes require architect approval before incorporation. |
| Override or countermand an architect's design decision. | ❌ CANNOT | |
| Approve a design as final or permit-ready. | ❌ CANNOT | Only the licensed architect may approve. |

### 3.4 QA Agent

| Action | Permission | Notes |
|--------|:----------:|-------|
| Run automated compliance checklists against the design and produce a findings report. | ✅ CAN | |
| Verify that Gate 1 conditions (requirements, cited regulations) are reflected in the deliverables. | ✅ CAN | |
| Generate a traceability matrix linking requirements → regulations → design elements. | ✅ CAN | |
| Perform structural, load-bearing, or life-safety calculations. | ❌ CANNOT | See §7. Calculations are performed by qualified licensed engineers. |
| Certify that the design is free of defects or regulatory non-compliance. | ❌ CANNOT | Certification is a legal act reserved for licensed professionals. |

### 3.5 Communication Agent

| Action | Permission | Notes |
|--------|:----------:|-------|
| Draft client-facing updates, reports, and meeting summaries. | ✅ CAN | |
| Draft responses to routine client inquiries. | ⚠️ Confirm | The architect or PM approves before sending. |
| Format and package approved deliverables for transmission. | ✅ CAN | Only approved content is transmitted. |
| Send any communication on the architect's behalf without explicit approval. | ❌ CANNOT | |
| Negotiate, amend, or execute contracts with clients, contractors, or authorities. | ❌ CANNOT | |

---

## 4. Regulatory Interpretation Limits

> ⚠️ **Critical.** This section overrides any apparent capability described elsewhere in this document. Read it twice.

### 4.1 Reference Summary Only — Never a Legal Determination

All output from the **Research Agent** (and any regulatory reference produced by Review or QA) is a **reference summary** provided for the architect's convenience. It is **never**, under any circumstance, a legal determination of:

- Whether the design complies with applicable codes;
- Which code edition governs a given project;
- How an ambiguous clause should be interpreted in the architect's specific jurisdiction;
- Whether a permit will or will not be granted.

A legal determination can only be made by the **licensed architect of record**, who bears the regulatory and civil consequences.

### 4.2 Mandatory Source Citation

Every regulatory claim must be accompanied by:

1. The **exact article, section, or clause number**;
2. The **issuing authority** (e.g., national building code, municipal zoning ordinance);
3. The **edition or amendment reference**;
4. The **date the source was retrieved**.

Any regulatory output lacking these four elements is treated as **defective** and returned to the Research agent before Gate 1 may open.

### 4.3 Architect's Verification Duty Before Permit Submission

Before **any** permit, application, or regulatory filing is submitted by the firm, the licensed architect must:

1. Obtain the official gazette text (or equivalent authoritative publication) of each cited article;
2. Confirm that the text matches the Research agent's summary;
3. Confirm that no amendment, repeal, or superseding regulation has taken effect since the agent's retrieval date;
4. Record the verification in the project file.

> ⚠️ **The agent does not track real-time law amendments.** A summary retrieved on Day 1 may be stale by Day 30. The architect's verification is the only mechanism that protects the firm against acting on outdated law.

### 4.4 Conflict Between Agent Summary and Official Text

Where the agent's summary conflicts with the official gazette text, **the official text governs**. The conflict is logged, the Research agent's summary is corrected, and the project is re-verified. No deliverable may rely on the agent's summary in the face of a contradictory official text.

---

## 5. Data Handling & Confidentiality

### 5.1 Classes of Data

The agents will encounter, and must handle according to, the following data classes:

| Class | Examples | Handling rule |
|-------|----------|---------------|
| **Client Confidential** | Client identity, contact details, business plans, internal briefs. | Internal use only. Not transmitted to any external service without client consent and architect approval. |
| **Design Intellectual Property** | Drawings, models, specifications, design narratives. | Firm-owned (see §5.3). Stored in firm-controlled systems only. |
| **Financial** | Fees, budgets, payment terms, contractor pricing. | Restricted to authorized firm personnel. Never summarized into client-facing documents without architect approval. |
| **Regulatory / Public** | Published codes, ordinances, public records. | May be freely retrieved and summarized, subject to §4. |
| **Personally Identifiable Information (PII)** | Names, signatures, personal addresses of individuals. | Minimized at intake; redacted before any external transmission. |

### 5.2 Prohibited External Transmissions

> ⚠️ The following **must never** be sent to external services, third-party APIs, public models, or any system outside the firm's controlled environment:

1. Unredacted client PII.
2. Unapproved design drawings in their final or near-final form.
3. Contract terms, fees, or financial negotiations.
4. Any document stamped or signed by the architect (the artifact itself, not references to it).
5. Internal firm correspondence discussing client strategy or risk assessment.

If an agent's function inherently requires external processing, that function must be explicitly authorized by the PM and the architect, and the data must be sanitized to the permitted classes above.

### 5.3 Intellectual Property Ownership of Agent Outputs

1. **All outputs produced by the agents are the property of the firm.** The agents generate work product; they do not hold authorship or rights.
2. **No agent output is final** until it has been reviewed and approved by the licensed architect at the applicable gate. Unapproved output is an internal draft, not a deliverable.
3. The architect's approval stamp (signature, seal, or equivalent electronic attestation) is the act that converts an internal draft into a firm-issued deliverable.
4. Client deliverables inherit the firm's standard IP and licensing terms, which take precedence over any boilerplate the agent may have drafted.

---

## 6. Liability Framework

### 6.1 Where Legal Responsibility Resides

> ⚠️ **Legal responsibility for every design decision remains, at all times, with the licensed architect of record.**

The deployment of AI agents does not transfer, dilute, or share that responsibility. The agents are **tools**, comparable in legal character to CAD software or a code-checklist template. A mistake made by the tool is borne by the professional who relied on it without adequate verification.

### 6.2 Agent Errors Are the Firm's Responsibility

When an agent produces an incorrect, incomplete, or misleading output:

1. **The firm is responsible** for the consequences of having used that output, because the firm chose to deploy the agent and is responsible for its supervision.
2. **The agent is not a legal person** and cannot be sued, sanctioned, or held accountable. Do not attribute fault to "the AI" in client communications; attribute it to the firm's process failure.
3. **The architect is responsible** for not having caught the error at the relevant review gate (§8). This is why the gates are mandatory and non-skippable.

### 6.3 Documentation & Archival Requirement

> ⚠️ Every agent output that contributes to a deliverable or decision must be **archived alongside the architect's approval stamp**, including:

1. The agent's original output (intact, unredacted internally);
2. The architect's review notes and any corrections;
3. The final approved version;
4. The date and identity of the approving architect;
5. The gate (Gate 1 or Gate 2) at which approval was granted.

This archive is the firm's **primary defense** in the event of a regulatory inquiry, audit, or dispute. Failure to archive is, by itself, a process violation under this document.

### 6.4 No Reliance by Third Parties

Contractors, authorities, and clients may not rely on agent output as a professional certification. The firm communicates only the **architect-approved** deliverable as the binding artifact. Internal agent outputs are not to be shared in their raw form with any external party.

---

## 7. Prohibited Uses

> ⚠️ The following uses are **expressly prohibited**, regardless of urgency, client request, or apparent convenience. Violation is a disciplinary matter and may constitute professional misconduct.

1. **Stamping or signing official documents.** No agent may apply, simulate, or recommend the application of the architect's seal, signature, or electronic attestation.
2. **Making a final regulatory determination without architect verification.** No agent may declare a design compliant, non-compliant, or permit-ready. See §4.
3. **Performing structural, load-bearing, geotechnical, or life-safety calculations.** These are reserved for licensed professional engineers and the architect's coordination with them.
4. **Executing, amending, or terminating contracts.** No agent may bind the firm to any agreement with a client, contractor, consultant, or authority.
5. **Committing to fees, timelines, or deliverables to a client.** All commitments are made by the architect or an explicitly authorized PM.
6. **Overriding an architect's decision.** An agent may flag disagreement; it may not countermand.
7. **Transmitting prohibited data externally.** See §5.2.
8. **Bypassing or skipping a review gate.** See §2.2 and §8.
9. **Representing the agent as a licensed professional.** No communication may imply that an agent holds a license, registration, or professional standing.
10. **Acting on agent output after the architect has rejected it.** A rejected output is dead. It must not be revived, paraphrased, or routed forward.

---

## 8. Review Gate Procedures

### 8.1 General Gate Rules

- A gate is **open** only when all pre-conditions are met and the architect has recorded explicit approval.
- A gate is **closed** by default. Work cannot proceed past a closed gate.
- Approval must be **recorded** (timestamp, architect identity, gate identifier). Verbal or implied approval is insufficient.
- If a gate fails (the architect rejects), work returns to the upstream agent(s) for correction. The cycle repeats until the gate opens, up to a maximum of three iterations before escalation to the PM.

### 8.2 Gate 1 — Requirements & Regulations Confirmed

**Position**: After **Intake + Research**, before design work begins in earnest.

**What the architect must check:**

1. **Requirements integrity** — The Intake summary accurately reflects the client's brief; no requirements have been silently dropped, merged, or invented.
2. **Ambiguity resolution** — Every ambiguous requirement has been explicitly resolved by the architect, not by the agent.
3. **Regulatory source completeness** — Every regulatory claim from the Research agent carries the four mandatory citation elements (§4.2).
4. **Conflict flags** — Every flagged code conflict has been reviewed and a position taken by the architect.
5. **Scope & budget** — The draft scope and budget outline have been approved or corrected.
6. **Verification sampling** — The architect has spot-checked at least one cited regulatory source against the official text (full verification per §4.3 occurs before permit submission, not at Gate 1).

**Approval record**: "Gate 1 approved — requirements and regulatory references confirmed. Proceeding to design review." (Architect name, timestamp, gate ID.)

### 8.3 Gate 2 — Final Design Approval

**Position**: After **Review + QA**, before the design is released as a firm deliverable (e.g., for permit submission, client handover, or contractor issue).

**What the architect must check:**

1. **Design coherence** — The Review agent's consistency findings have been addressed or consciously accepted.
2. **Compliance findings** — Every QA checklist item is either satisfied or explicitly waived by the architect with recorded justification.
3. **Traceability** — The traceability matrix links each requirement and each cited regulation to a design element, with no orphans.
4. **Deviation resolution** — Every regulatory deviation flagged between Research and Review has been resolved.
5. **Professional judgment** — The architect has applied independent professional judgment beyond the agents' findings. The agents check what they were told to check; the architect is responsible for what they were not.
6. **Archive readiness** — The archival package (§6.3) is complete.

**Approval record**: "Gate 2 approved — design reviewed and QA findings verified against professional judgment. Output approved for the next stage." (Architect name, timestamp, gate ID.)

### 8.4 Gate Failure and Escalation

- On failure, the architect records the specific deficiency and the work returns to the responsible agent.
- After **three failed iterations** at a single gate, the matter is escalated to the PM for triage (agent reconfiguration, scope adjustment, or human takeover of the task).
- No gate may be "force-passed" under time pressure. If a deadline is at risk, the PM is notified and the deadline — not the gate — is renegotiated.

---

## 9. Revision History

| Version | Date | Author / Authority | Summary of Change |
|:-------:|:----------|--------------------|-------------------|
| 1.0 | 2026-06-15 | PM Office (co-architect) | Initial issue. Established purpose, scope, Human-in-the-Loop principle, five-agent capability matrix, regulatory interpretation limits, data handling, liability framework, prohibited uses, and the two-gate review procedure. |

---

> **End of Document.**
> This document is binding on all firm staff and contractors who interact with the agent team. Questions of interpretation are resolved by the PM Office in consultation with the licensed architect of record. No agent is permitted to interpret this document on its own behalf.
