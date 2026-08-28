# User Scenarios — How to Use Safety OS

> **For first-time users**: Practical walkthroughs showing how to use the agent team and workflows for common EHS/GxP tasks.

---

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Verify system integrity
bun scripts/co-safety/safety-audit.ts    # 443+ files, 0 errors

# 3. Explore your domain
ls workflows/domains/functional/   # Functional services (PSM, MSDS, GxP)
ls workflows/domains/industry/     # Industry operations (construction, gas, power, etc.)
```

---

## Scenario 1: New Chemical Introduction (MSDS + PSM)

**Situation**: A new chemical (e.g., specialty solvent) needs to be introduced at your chemical plant.

### Step-by-Step

1. **MSDS Intake** — Receive the supplier MSDS
   ```
   User: "신규 화학물질 도입 — [화학물질명] MSDS 접수"
   → msds-agent dispatches msds-intake workflow
   ```

2. **GHS Classification** — Classify the hazard
   ```
   → msds-agent applies ghs-classifier skill
   → Generates H/P-statements, pictograms, signal word
   ```

3. **Chemical Approval** — Verify against Korean regulations
   ```
   → msds-agent runs chemical-approval workflow
   → Checks: prohibited substances (OSHA-KR Art 117), CCA, K-REACH
   ```

4. **PSM Impact** — If covered process, update PSI
   ```
   → ehschem-agent (chemical plant) coordinates
   → psm-agent updates Process Safety Information
   ```

5. **Worker Training** — Notify occupational health
   ```
   → msds-agent notifies occupational-health-agent
   → Special health examination targets updated (Section 11 toxicology)
   ```

### Evidence Generated
- `msds-record.json` (GHS 16 sections)
- `ghs-classification-record.json`
- `chemical-approval-record.json`

---

## Scenario 2: Clinical Trial SAE Reporting (GCP → GVP)

**Situation**: A serious adverse event occurs during a Phase 3 clinical trial.

### Step-by-Step

1. **SAE Identification** — Investigator reports event
   ```
   User: "임상시험 중증 이상반응 발생 — [참가자 ID]"
   → gcp-agent dispatches sae-reporting workflow
   ```

2. **Causality Assessment** — Apply ImPACT algorithm
   ```
   → gcp-agent applies sae-causality-assessor skill
   → Determines: related / possibly_related / not_related
   ```

3. **SUSAR Determination** — Check expectedness
   ```
   → If unexpected + related = SUSAR
   → 7-day (fatal) or 15-day (other) MFDS reporting timeline starts
   ```

4. **Emergency Dispatch** (if safety signal)
   ```
   → gcp-agent dispatches sae-reporting-reference → emergency-agent
   → emergency-agent coordinates medical response + regulatory notification
   ```

5. **Post-Market Link** — Flow to pharmacovigilance
   ```
   → SAE data feeds to GVP domain for post-market signal context
   ```

### Evidence Generated
- `gcp-sae-record.json` (with causality assessment, timelines)
- Updated `gcp-irb-approval-record.json` (continuing review)

---

## Scenario 3: Construction Site Daily Safety (ehsconst)

**Situation**: Daily safety management at a large construction project.

### Daily Routine

1. **Morning TBM** (Tool Box Meeting)
   ```
   User: "오늘 TBM — [공사현장]"
   → ehsconst-agent generates TBM agenda
   → Reviews previous day's findings, today's hazards, weather alerts
   ```

2. **Pre-Work Inspection**
   ```
   → ehsconst-agent runs daily-safety-inspection
   → Fall hazards, collapse risks, electrical checked
   ```

3. **Fall Hazard Assessment** (if work at height)
   ```
   → ehsconst-agent applies fall-hazard-assessor skill
   → Generates protection hierarchy: guardrail → safety net → harness
   → Recommends work suspension if wind >14m/s
   ```

4. **Permit-to-Work** (for hot work, confined space)
   ```
   → ehsconst-agent runs permit-to-work-construction
   → Risk assessment attached, controls verified
   ```

5. **End-of-Day Closeout**
   ```
   → All permits closed, findings documented
   → Safety budget execution updated
   ```

### Evidence Generated
- `ehsconst-tbm-record.json` (attendance, topics)
- `ehsconst-inspection-record.json` (findings, corrective actions)
- `ehsconst-fall-prevention-record.json` (protection measures)
- `ehsconst-ptw-record.json` (permit details)

---

## Scenario 4: Pharmaceutical Cold Chain (GMP → GDP → GVP)

**Situation**: A vaccine batch is manufactured, distributed, and monitored post-market.

### Lifecycle Flow

1. **GMP Batch Release**
   ```
   → gmp-agent runs batch-mfg workflow
   → QA review within 30 days
   → Batch disposition: approved
   ```

2. **GDP Distribution** — Cold chain maintained
   ```
   → gdp-agent receives goods (batch_disposition_approved_ref verified)
   → Temperature monitoring: 2-8°C cold chain
   → temperature-excursion-analyzer skill verifies no deviations
   ```

3. **DTS Tracking** — Each distribution stage scanned
   ```
   → gdp-agent runs traceability-dts workflow
   → MFDS DTS Center receives real-time data
   ```

4. **GVP Surveillance** — Post-market safety monitoring
   ```
   → gvp-agent collects ICSR reports
   → signal-detector skill runs disproportionality analysis (PRR/ROR)
   → Annual PBRER submitted to MFDS
   ```

5. **Recall** (if safety signal triggers)
   ```
   → gvp-agent dispatches urgent-safety-action-reference → emergency-agent
   → emergency-agent coordinates recall execution
   ```

---

## Scenario 5: Chemical Plant Turnaround (ehschem + PSM + Emergency)

**Situation**: Annual turnaround (TAR) at a petrochemical plant.

### Planning Phase
1. **TAR Planning**
   ```
   → ehschem-agent runs turnaround-shutdown-planning
   → References PSM MOC for all changes
   ```

2. **PSM Pre-Startup Review**
   ```
   → psm-agent runs PSSR workflow
   → All MOC items verified before startup
   ```

### Execution Phase
3. **Permit Coordination**
   ```
   → Multiple PTW issued (hot work, confined space, electrical)
   → ehschem-agent coordinates with psm-agent
   ```

4. **Emergency Preparedness**
   ```
   → ehschem-agent runs gas-emergency-preparedness
   → Chemical spill response ready (MSDS Section 6 data pre-loaded)
   ```

### Post-TAR
5. **PSSR Completion**
   ```
   → psm-agent verifies PSSR checklist
   → Process restarts with documented safety verification
   ```

---

## Scenario 6: Workplace Risk Assessment (Art 36 위험성평가)

**Situation**: A manufacturing site needs to conduct a mandatory risk assessment for a new non-routine maintenance task on a conveyor system, per OSHA-KR Article 36. The task involves confined space entry and LOTO procedures.

### Step-by-Step

1. **Initiate Risk Assessment**
   ```
   User: "위험성평가 실시 — 컨베이어 정비 작업 (confined space + LOTO)"
   → PM routes to SWM → SWM dispatches risk-assessment-agent
   → risk-assessment workflow loaded (workflows/daily/manufacturing/risk-assessment/)
   ```

2. **Hazard Identification**
   ```
   → risk-assessment-agent identifies hazards:
     - Confined space (oxygen deficiency, toxic atmosphere)
     - Hazardous energy (LOTO required for conveyor)
     - Mechanical (pinch points, rotating parts)
   → legal_basis: 산업안전보건법 제36조 (위험성평가 실시), 산업안전보건법 제38조 (안전조치), 중대재해처벌법 제4조 (안전보건관리체계 구축 의무)
   ```

3. **Risk Scoring & Control Measures**
   ```
   → Severity x Likelihood matrix applied to each hazard
   → Control hierarchy:
     - Engineering: Ventilation system, permanent LOTO devices
     - Administrative: Work permit, confined space entry permit
     - PPE: Gas detector, harness, rescue tripod
   → risk-assessment-record.json generated with all hazards
   ```

4. **LOTO Coordination**
   ```
   → psm-agent verifies LOTO procedure per KOSHA GUIDE Z-40-2022
   → Energy isolation points identified and locked out
   ```

5. **Worker Communication**
   ```
   → TBM scheduled to communicate risk assessment findings
   → training-agent notified for risk assessment training record
   → training_record_ref linked to risk-assessment-record.json
   ```

### Evidence Generated
- `risk-assessment-record.json` (Art 36 risk assessment with hazard scoring and control measures)
- `psm-loto-record.json` (LOTO procedure verification)
- `training-record.json` (Risk assessment result communication training)
- `ehsconst-tbm-record.json` (TBM with risk_assessment_ref linked)

---

## Scenario 7: High-Tech & New Industrial Hazard Operations (Port / Railway / Defense / Biotech)

**Situation**: High-risk specialized operations in port container terminals, 25kV electrification, munition mixing, or bio-reactors.

### Step-by-Step

1. **Port Logistics** — Crane Lifting & AGV Clearance
   ```
   User: "항만 갠트리 크레인 인양 및 AGV 정비 안전점검"
   → logistics-agent dispatches port-crane-agv-safety workflow
   → Generates port-crane-agv-record.json
   ```

2. **Railway Infrastructure** — 25kV Catenary LOTO
   ```
   User: "철도 25kV 전차선 단전 및 접지점검"
   → railway-agent dispatches catenary-high-voltage-safety workflow
   → Generates catenary-high-voltage-record.json
   ```

3. **Defense Munitions** — Propellant Static ESD Prevention
   ```
   User: "화약 추진제 혼합실 정전기 접지 점검"
   → defense-agent dispatches explosive-propellant-handling workflow
   → Generates explosive-propellant-record.json
   ```

4. **Biopharmaceutical CDMO** — Bioreactor SIP Sterilization
   ```
   User: "배양기 Bioreactor 고온/고압 증기 멸균 점검"
   → biotech-agent dispatches bioreactor-sterilization-safety workflow
   → Generates bioreactor-sterilization-record.json
   ```

---

## Agent Dispatch Pattern

```
User Request
    ↓
PM (Chief Safety Officer) receives
    ↓
PM dispatches to Industry Agent (coordinator)
    ↓
Industry Agent dispatches to Functional Agents (services)
    ↓
Evidence records generated in memory/
    ↓
Emergency/Compliance notified if escalation triggered
```

### Key Principle
- **Industry domains** (ehsconst, ehschem, gasterm, powergen, meddevice) = **coordinators**
- **Functional domains** (psm, msds, gmp/gdp/glp/gcp/gvp) = **service providers**
- **Emergency** = **cross-cutting responder** (receives dispatches from all reference workflows)

---

## Common Commands

```bash
# Audit (must pass before any sync)
bun scripts/co-safety/safety-audit.ts

# Domain-specific tests
bun scripts/co-safety/test-pharma-general-profile.ts        # GMP
bun scripts/co-safety/test-chemical-handling-profile.ts     # MSDS
bun scripts/co-safety/test-cross-domain-integration.ts      # All domains
bun scripts/co-safety/test-domain-scenarios.ts              # 5 real-world scenarios

# Skill execution (rule-based)
bun skills/domains/industry/gmp/qrm/fmea-scoring.ts        # FMEA risk scoring
bun skills/domains/functional/msds/ghs-classifier/ghs-classifier.ts  # GHS classification
bun skills/domains/industry/ehsconst/fall-hazard-assessor/fall-hazard-assessor.ts  # Fall hazard

# Sync (commit + push + PR)
bun scripts/dev-sync.ts "commit message"
```

---

## Document Navigation

| Document | Purpose |
|----------|---------|
| [Classification Guide](domain-classification-guide.md) | 3-tier dispatch + matrix |
| [Onboarding Guide](domain-onboarding-guide.md) | Adding new domains (SOP) |
| [Reference Pattern](reference-workflow-pattern.md) | Reference workflow design |
| [User Guide](user-guide.md) | Domain selection + dispatch patterns |
| [MCP Integration](mcp-integration-guide.md) | MCP server connection |
| [Architecture Overview](../_meta/architecture-overview.md) | 30-domain system architecture |
