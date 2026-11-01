# Project Context Card (PCC) v1.1 — Template

> **What this is**: A single Markdown file that carries the project's essential context from one AI agent to the next. The PCC is the **single source of truth** for the project. When every agent (Intake, Research, Review, QA, Communication) reads and updates the same PCC, no requirement is lost, no regulation is skipped, and no decision is forgotten.
>
> **Lifecycle**: One PCC per project. Created at intake, maintained through every phase, archived at handover.

---

## How to Use This Template

1. **Copy** this file into your project folder and rename it using the project ID, e.g. `PCC-2026-018.md`.
2. **Fill in every `[PLACEHOLDER]` and `<...>` field.** Do not leave a placeholder visible once the project is live — replace it with real content or write `N/A` with a one-line reason.
3. **Read the section rules below** before editing each section. Several sections are **immutable** (locked after first approval) or **cumulative** (append-only).
4. **Update the `Next Responsible Agent` field every time you hand off** — this tells the next agent it is their turn.
5. **Add a row to `Change History` for every edit** that changes meaning (not for typo fixes). Bump the version: patch for small edits, minor for new decisions, major for phase transitions.
6. **Never delete** from an immutable or cumulative section. If something must change, supersede it in the cumulative section and explain why in `Change History`.

### Section rules at a glance

| Section | Edit rule | Who writes it |
|---|---|---|
| Header (metadata) | Edit on every handoff | All agents |
| Client Requirements | **Immutable** after sign-off | Intake Agent, then locked |
| Current Design Decisions | **Cumulative** (append, never overwrite) | Review / QA Agents |
| DrawingSummaries | **Optional**; populate when drawings exist for the phase; refresh on each revision | Review Agent / architect (via Vision on PDF/image exports, or architect-authored description) |
| Open Issues List | Add when raised, remove when resolved | Any agent |
| Applied Regulations List | Populated by Research; verified by QA | Research Agent (QA verifies) |
| Next Responsible Agent | Update on every handoff | Outgoing agent |
| Change History | **Append-only** | All agents |

---

## Header — Project Metadata

| Field | Value |
|---|---|
| **Project ID** | `[PROJECT-YYYY-NNN]` |
| **Project Name** | `<project name, e.g. Hong Residence>` |
| **Phase** | `<SD \| DD \| CD \| CA \| PR \| Other>` |
| **PCC Version** | `<MAJOR.MINOR.PATCH, e.g. 1.2.0>` |
| **Date (this version)** | `<YYYY-MM-DD>` |
| **Client** | `<client name>` |
| **Site Address** | `<site address>` |
| **Lead Architect (human)** | `<name>` |
| **PCC Created** | `<YYYY-MM-DD>` |
| **PCC Last Updated** | `<YYYY-MM-DD>` |

> **Phase codes**: SD = Schematic Design, DD = Design Development, CD = Construction Documents, CA = Construction Administration, PR = Permit/Regulatory. Adjust to your firm's phase names if different.

---

## Client Requirements

> **⚠️ IMMUTABLE SECTION.** Set once at intake and approved by the client. Do not edit after sign-off. Any change to a requirement is a *new decision* and must be recorded in **Current Design Decisions** with a reference back to the requirement it changes, plus a note in **Change History**. Treat this section as the contract.

### Functional Requirements

| ID | Requirement | Source | Confirmed |
|---|---|---|---|
| FR-01 | `<e.g. 3 bedrooms, master on ground floor>` | `<intake interview \| brief \| email>` | `<Yes \| Pending>` |
| FR-02 | `<...>` | `<...>` | `<...>` |

### Site & Context Requirements

| ID | Requirement | Source | Confirmed |
|---|---|---|---|
| SR-01 | `<e.g. preserve existing oak tree on north boundary>` | `<site visit \| survey>` | `<Yes \| Pending>` |

### Budget & Schedule Requirements

| ID | Requirement | Target / Value | Confirmed |
|---|---|---|---|
| BR-01 | Target construction budget | `<currency and amount>` | `<Yes \| Pending>` |
| BR-02 | Target permit submission date | `<YYYY-MM-DD>` | `<Yes \| Pending>` |

### Quality / Performance Requirements

| ID | Requirement | Target | Confirmed |
|---|---|---|---|
| QR-01 | `<e.g. energy performance tier>` | `<e.g. net-zero ready>` | `<Yes \| Pending>` |

**Client sign-off**: `<name, role, date>` — or `Pending sign-off`.

---

## Current Design Decisions

> **CUMULATIVE SECTION.** Append-only. Each decision is dated and stays in the list forever. If a decision is later changed or reversed, add a *new* row with the new date and a `Supersedes` reference; never delete or overwrite the old row.

| ID | Date | Decision | Rationale | Supersedes | Author (Agent) |
|---|---|---|---|---|---|
| DD-001 | `<YYYY-MM-DD>` | `<e.g. two-storey massing with flat roof>` | `<why this was chosen>` | `—` | `<agent name>` |
| DD-002 | `<YYYY-MM-DD>` | `<...>` | `<...>` | `<— \| DD-00x>` | `<...>` |

---

## DrawingSummaries

> **OPTIONAL SECTION.** Populate only when drawings exist for the current phase (typically from SD onward). Omit the entire section if no drawings have been produced yet.
>
> This section holds **text summaries of drawings** so that text-based agents (e.g. Communication Agent) can consume drawing context without reading binary drawing files directly. Summaries are populated by the **Review Agent** (using Vision on exported PDF or image files) or **authored directly by the architect**.
>
> **⚠️ Authoritative source note**: These summaries are **text representations only** — a bridge for text agents. The **actual drawing files remain the authoritative source**. Always defer to the source file when a summary and drawing disagree. When a drawing is revised, refresh its summary row and bump the `Last Updated` date.

| Drawing ID | Type | Phase | Summary | Source File | Last Updated |
|---|---|---|---|---|---|
| DR-01 | `<e.g. plan / elevation / section / axonometric>` | `<SD \| DD \| CD \| ...>` | `<plain-text description of the drawing: scope, key dimensions, notable features, decisions referenced (DD-0xx)>` | `<filename.ext or path>` | `<YYYY-MM-DD>` |
| DR-02 | `<...>` | `<...>` | `<...>` | `<...>` | `<YYYY-MM-DD>` |

---

## Open Issues List

> Any unresolved question, conflict, missing input, or risk. Add a row when an issue is raised. Remove (or mark `Resolved`) when closed — and record the resolution in **Current Design Decisions** if it produced a decision.

| ID | Date Raised | Issue | Affects | Owner | Status | Resolution Ref |
|---|---|---|---|---|---|---|
| OI-01 | `<YYYY-MM-DD>` | `<e.g. setback conflict with neighbor's existing easement>` | `<FR/SR/regulation IDs>` | `<agent or human>` | `<Open \| In Progress \| Resolved>` | `<DD-0xx or N/A>` |

---

## Applied Regulations List

> Populated by the **Research Agent** from the relevant building code, zoning bylaw, and standards. Verified by the **QA Agent**. Every applicable article must carry a verification status before the project advances past DD.

| ID | Regulation / Code | Article | Requirement Summary | Applies To | Verified By | Verification Status | Notes |
|---|---|---|---|---|---|---|---|
| REG-01 | `<e.g. International Building Code 2021>` | `<§ 1203.2>` | `<one-line summary>` | `<FR/SR/DD IDs>` | `<QA Agent, date>` | `<Verified \| Pending \| N/A>` | `<...>` |
| REG-02 | `<e.g. Local Zoning Bylaw>` | `<Article 4.3>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |

**Verification legend**: `Verified` = QA confirmed the design satisfies the article. `Pending` = Research cited it but QA has not yet checked. `N/A` = Cited but confirmed not applicable to this project (keep the row; explain why).

---

## Next Responsible Agent

> Updated on every handoff. Names exactly one agent. The named agent owns the PCC until the next handoff.

| Field | Value |
|---|---|
| **Next Agent** | `<Intake \| Research \| Review \| QA \| Communication>` |
| **Handoff Reason** | `<one sentence: what the next agent must do>` |
| **Handoff Date** | `<YYYY-MM-DD>` |
| **Handoff From** | `<agent name>` |
| **Linked Open Issues** | `<OI-xx, OI-yy, or None>` |

---

## Change History

> **APPEND-ONLY.** Every meaningful change gets a row. Version follows semantic versioning: MAJOR on phase change, MINOR on new decision or resolved issue, PATCH on small edits.

| Version | Date | Change Summary | Author (Agent) |
|---|---|---|---|
| 1.0.0 | `<YYYY-MM-DD>` | `<e.g. PCC created at intake; client requirements locked>` | `<Intake Agent>` |
| 1.1.0 | `<YYYY-MM-DD>` | `<e.g. added DD-002 after SD review>` | `<Review Agent>` |
| 1.1.0 (template) | 2026-06-15 | Added DrawingSummaries field (optional) — bridges text agents to drawing context; resolves Analyst open question from Communication Agent design | Technical Writer |

---
---

# Worked Example — Hong Residence (DD Phase)

> The example below is **fictional**. It demonstrates how a completed PCC looks at the start of Design Development, after Schematic Design has produced two decisions and the Research Agent has cited applicable regulations. Read it as a model, not a checklist — your real PCC will have more rows in every table.

---

## Header — Project Metadata

| Field | Value |
|---|---|
| **Project ID** | `ARCH-2026-018` |
| **Project Name** | Hong Residence |
| **Phase** | DD |
| **PCC Version** | 1.3.0 |
| **Date (this version)** | 2026-06-15 |
| **Client** | Mr. & Mrs. Hong |
| **Site Address** | 142 Maple Ridge Lane, Riverside |
| **Lead Architect (human)** | J. Park |
| **PCC Created** | 2026-04-02 |
| **PCC Last Updated** | 2026-06-15 |

---

## Client Requirements

### Functional Requirements

| ID | Requirement | Source | Confirmed |
|---|---|---|---|
| FR-01 | 3 bedrooms; master suite on ground floor | Intake interview, 2026-04-02 | Yes |
| FR-02 | Open-plan kitchen / dining / living | Intake interview, 2026-04-02 | Yes |
| FR-03 | Home office with separate entrance | Client email, 2026-04-10 | Yes |
| FR-04 | Two-car garage with EV charging ready | Intake interview, 2026-04-02 | Yes |

### Site & Context Requirements

| ID | Requirement | Source | Confirmed |
|---|---|---|---|
| SR-01 | Preserve existing 80-year-old oak on north boundary | Site visit, 2026-04-05 | Yes |
| SR-02 | Maximum building height 9 m (zoning limit) | Survey + zoning check | Yes |

### Budget & Schedule Requirements

| ID | Requirement | Target / Value | Confirmed |
|---|---|---|---|
| BR-01 | Target construction budget | USD 850,000 (hard costs) | Yes |
| BR-02 | Target permit submission date | 2026-11-30 | Yes |

### Quality / Performance Requirements

| ID | Requirement | Target | Confirmed |
|---|---|---|---|
| QR-01 | Energy performance | Net-zero ready (Passive House tier) | Yes |
| QR-02 | Daylighting | Daylight factor ≥ 2% in all regularly occupied rooms | Pending |

**Client sign-off**: Mr. & Mrs. Hong, 2026-04-12.

---

## Current Design Decisions

| ID | Date | Decision | Rationale | Supersedes | Author (Agent) |
|---|---|---|---|---|---|
| DD-001 | 2026-05-10 | Two-storey massing with flat roof, set back 6 m from north boundary | Protects oak root zone (SR-01); maximizes south glazing for QR-01 | — | Review Agent |
| DD-002 | 2026-05-22 | Structural grid of 7.2 m bays in cross-laminated timber (CLT) | CLT lowers embodied carbon and supports net-zero target (QR-01); 7.2 m bay suits open-plan layout (FR-02) | — | Review Agent |
| DD-003 | 2026-06-01 | Ground-floor master suite located at southeast corner | Meets FR-01; captures morning light; keeps garage wall as acoustic buffer | — | Review Agent |

---

## DrawingSummaries

| Drawing ID | Type | Phase | Summary | Source File | Last Updated |
|---|---|---|---|---|---|
| DR-01 | Plan — Ground Floor | DD | Ground-floor plan showing open-plan kitchen/dining/living (FR-02), southeast master suite (DD-003), home office with separate entrance (FR-03), and two-car garage with EV rough-in (FR-04). North wall set back 6 m from boundary (DD-001) to protect oak root zone. | A-101_GroundFloor_DD_r02.pdf | 2026-06-10 |
| DR-02 | Elevation — South + North | DD | South elevation: full-height glazing across living wing for passive solar and daylight (QR-01/QR-02). North elevation: minimal punched openings, CLT rainscreen over insulated wall. Overall height 7.8 m, below 9 m zoning limit (REG-03). | A-201_Elevations_DD_r01.pdf | 2026-06-08 |
| DR-03 | Section — Longitudinal | DD | Longitudinal section through two-storey CLT volume (DD-002); 7.2 m structural bays; flat roof with parapet; indicates root protection zone at north boundary and south overhang depth for summer shading. | A-301_Section_DD_r01.pdf | 2026-06-12 |

---

## Open Issues List

| ID | Date Raised | Issue | Affects | Owner | Status | Resolution Ref |
|---|---|---|---|---|---|---|
| OI-01 | 2026-05-12 | Evacuation route from home office (FR-03) crosses utility easement — confirm clearance | FR-03, REG-02 | Research Agent | In Progress | N/A |
| OI-02 | 2026-05-28 | CLT supplier lead time (DD-002) may push permit date (BR-02) | DD-002, BR-02 | Communication Agent | Open | N/A |
| OI-03 | 2026-06-08 | Daylight simulation for QR-02 not yet run | QR-02 | Review Agent | Open | N/A |

---

## Applied Regulations List

| ID | Regulation / Code | Article | Requirement Summary | Applies To | Verified By | Verification Status | Notes |
|---|---|---|---|---|---|---|---|
| REG-01 | International Building Code 2021 | § 1006.3 | Two independent means of egress for R-3 with accessory office | FR-03 | QA Agent, 2026-06-14 | Pending | Pending OI-01 clearance confirmation |
| REG-02 | Riverside Zoning Bylaw | Article 4.3(c) | Side setback ≥ 3 m for lots < 1,000 m² | SR-02 | QA Agent, 2026-06-14 | Verified | DD-001 setback (6 m) satisfies |
| REG-03 | Riverside Zoning Bylaw | Article 5.1 | Max height 9 m; max lot coverage 35% | SR-02 | QA Agent, 2026-06-14 | Verified | Proposed height 7.8 m; coverage 31% |
| REG-04 | Local Energy Code 2024 | § 402.1 | New dwellings ≥ net-zero ready by 2027 | QR-01 | — | Pending | Awaiting QA verification of CLT detail |
| REG-05 | Tree Protection Ordinance | § 7-12 | Root protection zone = 1.5 × canopy radius for heritage trees | SR-01 | QA Agent, 2026-06-14 | Verified | DD-001 north setback protects root zone |

---

## Next Responsible Agent

| Field | Value |
|---|---|
| **Next Agent** | QA |
| **Handoff Reason** | Verify REG-01 (egress) and REG-04 (energy) once OI-01 clearance and CLT detail are resolved |
| **Handoff Date** | 2026-06-15 |
| **Handoff From** | Review Agent |
| **Linked Open Issues** | OI-01, OI-02, OI-03 |

---

## Change History

| Version | Date | Change Summary | Author (Agent) |
|---|---|---|---|
| 1.0.0 | 2026-04-12 | PCC created at intake; client requirements locked after sign-off | Intake Agent |
| 1.1.0 | 2026-05-10 | Added DD-001 (massing and north setback) after SD review | Review Agent |
| 1.1.1 | 2026-05-22 | Added DD-002 (CLT structural grid); raised OI-02 on supplier lead time | Review Agent |
| 1.2.0 | 2026-06-01 | Phase transition SD → DD; added DD-003 (master suite); Research added REG-01 through REG-05; QA verified REG-02/03/05 | Research + QA Agents |
| 1.3.0 | 2026-06-15 | Added DrawingSummaries (DR-01/02/03) populated from DD drawings via Vision so text agents can consume drawing context | Review Agent (Vision) |
