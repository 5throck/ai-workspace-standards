# Domain Classification Guide

> **Purpose**: Clarify the functional/industrial domain mix in Safety OS, and guide users in selecting the appropriate domain (or multi-domain dispatch) at request time.

## 1. Why This Guide Exists

Safety OS has 30 active domains (8 functional + 22 industry). Historically, two natures have been mixed together:

- **Functional domains**: Industry-agnostic; methodology- or data-driven (PSM, MSDS, Training, contractor-safety, occupational-health)
- **Industry domains**: Centered on a specific industry's operations (ehsconst, gasterm, powergen, ehschem, meddevice, GxP family — gmp/gdp/glp/gcp/gvp)

Consequences of the mixed layout:
- Chemical-plant users were unsure whether to invoke `psm`, `msds`, `ehschem`, or `emergency`.
- Within the same industry, multiple agencies' regulations apply simultaneously, yet it was unclear which domain acts as the integrating coordinator.
- For large facilities such as LNG terminals and power plants, PSM also applies, but where it is handled was ambiguous.

This guide organizes the domains into a **3-tier classification system**.

---

## 2. 3-Tier Domain Classification

### Tier 1: Functional Domains
**Characteristic**: Industry-agnostic. Centered on methodology, data, and system management. Referenced by multiple industry domains.

| Domain | Function | Example applicable industries |
|--------|----------|-------------------------------|
| `psm` | Process safety management methodology (PHA, MOC, PSSR, MI, PSI, SOP, LOTO) | Chemicals, refining, **LNG/LPG bases**, large-scale power generation, semiconductors (specialty gases) |
| `msds` | Chemical substance data management (16 sections) | All industries (whenever chemicals are handled) |
| `training` | Safety training management (OSHA-KR Art 29 incl. §3 special education /31/32/114) | All industries |
| `contractor-safety` | Contractor safety management (TAR/Major Turnaround surge scenarios) | Chemical plants, gas terminals, power generation during scheduled turnarounds |
| `occupational-health` | Occupational health surveillance (TAR/Major Turnaround health screening) | Chemical plants, gas terminals, power generation during scheduled turnarounds |
| `risk-assessment` | Workplace risk assessment methodology (OSHA-KR Art 36 위험성평가; daily/change risk assessment, job-safety-analysis, risk register) | All industries (mandatory baseline) |
| `incident-investigation` | Incident investigation & root-cause analysis (5-Why, bow-tie, CAPA, lessons-learned dissemination) | All industries (post-incident) |
| `asset-integrity` | Equipment integrity & inspection methodology (preventive maintenance, statutory inspection scheduling, aging-equipment assessment, failure analysis) | Asset-intensive industries (chemicals, power, semicon, gas terminals, etc.) |

### Tier 2: Industry Domains
**Characteristic**: Centered on a specific industry's operations. Integrates the multi-agency regulations for that industry.

| Domain | Industry | Integrated regulations |
|--------|----------|------------------------|
| `gmp` | Pharmaceutical manufacturing quality | 약사법 (Pharmaceutical Affairs Act) Art 37, PIC/S, ICH Q7/Q9/Q10 |
| `gdp` | Pharmaceutical distribution quality | 약사법 Art 47, EU GDP Guidelines |
| `glp` | Non-clinical study management | 비임상시험관리기준 (Non-clinical Study Management Standards), OECD GLP |
| `gcp` | Clinical trial management | 약사법 Art 34의2, ICH E6(R3) |
| `gvp` | Post-market pharmacovigilance | 약사법 Art 73의2/73의3, KGVP, ICH E2 |
| `ehsconst` | Construction | 산안법 (OSHA-KR), 중대재해처벌법 (SAPA, construction-industry special provisions), 건설기술진흥법 (Construction Technology Promotion Act) |
| `gasterm` | Gas terminals / filling stations | 고압가스법 (High-Pressure Gas Safety Act), LPG법 (LPG Act), 수소법 (Hydrogen Act) |
| `powergen` | Power generation facilities (excluding nuclear) | 전기사업법 (Electricity Business Act), 전기안전관리법 (Electrical Safety Management Act), 신재생에너지법 (New and Renewable Energy Act) |
| `ehschem` | Chemical plants (refining / petrochemical / fine chemicals) | 산안법 (OSHA-KR), 화학물질관리법 (Chemical Substances Control Act), K-REACH, 위험물안전관리법 (Hazardous Materials Safety Control Act) |
| `meddevice` | Medical devices | KGMP-MD, ISO 13485, ISO 14971 |
| `food` | Food & beverage manufacturing | 식품위생법 (Food Sanitation Act), MFDS HACCP Notice |
| `cosmetics` | Cosmetics manufacturing | 화장품법 (Cosmetics Act), MFDS CGMP Notice, ISO 22716 |
| `semicon` | Semiconductor & display manufacturing | 고압가스안전관리법 (HPGSCA), 화학물질관리법 (CCA), SEMI S2/S8 |
| `battery` | Secondary battery manufacturing & recycling | 위험물안전관리법 (HMSCA), 화학물질관리법 (CCA), NFPA 855 |
| `shipbuilding` | Shipbuilding & offshore engineering | 산안법 (OSHA-KR Art 38/39/63), 중대재해처벌법 (SAPA Art 5) |
| `steelmaking` | Steelmaking & heavy metal smelting | 산안법 (OSHA-KR Art 92), 고압가스안전관리법 (HPGSCA) |
| `datacenter` | Data centers & IT infrastructure | 전기안전관리법 (ESMA), 전기사업법, NFPA 855 |
| `logistics` | Port logistics & automated warehouses | 항만안전특별법 (PSSA), 산안법 (OSHA-KR Art 38/63), 고압가스안전관리법 |
| `railway` | Railway & transit infrastructure | 철도안전법 (RSA), 산안법 (OSHA-KR Art 38/39), 전기안전관리법 |
| `waste` | Environmental waste & water treatment | 폐기물관리법 (WCA), 하수도법 (SA), 산안법 (OSHA-KR Art 618) |
| `defense` | Defense & explosives manufacturing | 총포화약법 (FSESA), 방위사업법 (DAA), 고압가스안전관리법 |
| `biotech` | Biopharmaceutical CDMO & bio-labs | LMO법 (LMO Act), 약사법 (PA), 산안법 (OSHA-KR) |

### Tier 3: Cross-Cutting Services
**Characteristic**: Referenced by all domains. Emergency response, routine inspections, and the like.

| Service | Role |
|---------|------|
| `emergency/` (9 workflows) | Fire, natural disasters, medical, chemical release, explosion, confined-space / high-angle rescue, electrocution, mechanical accidents |
| `daily/` workflows | Routine EHS such as risk assessment, permit-to-work, and safety inspections |

---

## 3. Multi-Domain Dispatch Guide

### Principle: Industry domains are the integrating coordinator (Tier 2-led)

```
User (worker in a specific industry)
  ↓
Tier 2 industry domain (integrating coordinator)
  ├── Dispatches to Tier 1 functional domains as needed
  └── Dispatches to Tier 3 emergency on incident
```

### Example: LNG terminal operator

```
[Routine operations]
→ gasterm-agent (Tier 2, integrating coordinator)
  ├── Gas storage tank inspection (gasterm itself)
  ├── Chemical handling (MEA/MDEA) data needed → msds-agent (Tier 1)
  └── Large-scale facility risk assessment → psm-agent (Tier 1)

[Emergency]
→ emergency-agent (Tier 3)
  ├── Runs explosion-gas-response directly
  ├── msds Section 6 data needed → provided by gasterm or msds-agent
  └── Evacuation / access control / notification
```

### Example: Chemical plant operator

```
[Routine operations]
→ ehschem-agent (Tier 2, integrating coordinator, planned)
  ├── Chemical plant routine operations (ehschem itself)
  ├── Chemical substance handling → msds-agent (Tier 1)
  ├── Large-scale hazardous processes → psm-agent (Tier 1)
  └── Hazardous materials storage → msds + ehschem collaboration

[Emergency]
→ emergency-agent (Tier 3)
  ├── Runs chemical-release directly
  ├── msds Section 6 data → msds-agent
  └── psm-psi (process safety information) → psm-agent
```

### Example: Power plant (LNG thermal) operator

```
[Routine operations]
→ powergen-agent (Tier 2, integrating coordinator)
  ├── Power generation facility operations (powergen itself)
  ├── LNG gas supply → gasterm-agent (Tier 2, industry collaboration)
  ├── Large-scale gas process (PSM mandatory) → psm-agent (Tier 1)
  └── Chemical treatment (e.g., ammonia for NOx removal) → msds-agent (Tier 1)
```

---

## 4. PSM Applicability Scenarios (reflecting the LNG terminal question)

PSM (산업안전보건법 제44조) applies to facilities with a "covered process." It is not limited to chemical plants; the following facilities are also mandatorily subject to PSM:

| Facility type | PSM mandatory | Owning industry domain | Interface |
|---------------|---------------|------------------------|-----------|
| Refinery | ✓ | `ehschem` | `psm_record_ref` bidirectional |
| Petrochemical plant | ✓ | `ehschem` | `psm_record_ref` bidirectional |
| **LNG terminal (large-scale)** | ✓ | `gasterm` | `psm_applicable: true` field |
| **LPG base (large-scale)** | ✓ | `gasterm` | `psm_applicable: true` field |
| LNG thermal power plant (large-scale gas) | ✓ | `powergen` | `psm_applicable` field (to be added) |
| Hydrogen filling station (large-scale) | Partial | `gasterm` | `psm_applicable` conditional |
| Semiconductor (specialty gases) | Partial | (semicon, planned) | - |
| Pharmaceutical (large-scale chemical) | Partial | `gmp` | gmp and psm collaboration |

**Implementation principles**:
- `psm-agent` is the functional coordinator (provides PSM methodology).
- An industry domain's evidence model flags applicability via a `psm_applicable: boolean` field.
- When `psm_applicable: true`, the facility collaborates in parallel with psm-agent.

### PSM interface in `gasterm` (already implemented)

```yaml
# gasterm evidence model
psm_applicable: true  # for large-scale LNG/LPG facilities
psm_record_ref: "PSM-..."  # psm-record ID
```

### `powergen` PSM interface (already implemented)

The `psm_applicable` field has been added to the powergen evidence model (reflected across 7 records):
- LNG thermal power plant (large-scale gas handling) — PSM mandatory
- Thermal power boiler (large-scale, high-pressure) — PSM mandatory

---

## 5. Dispatch Decision Tree

```
[User request]
       ↓
[Worker in a specific industry?]
   ├── Yes → dispatch to Tier 2 industry domain
   │   ├── Chemical plant → ehschem-agent
   │   ├── Construction site → ehsconst-agent
   │   ├── Gas terminal → gasterm-agent
   │   ├── Power plant → powergen-agent
   │   └── Pharmaceutical (quality / surveillance) → gmp/gdp/glp/gcp/gvp-agent (Tier 2 — pharmaceutical industry domains)
   │
   └── No → dispatch to Tier 1 functional domain
       ├── Process hazard (covered process) → psm-agent
       ├── Chemical substance data → msds-agent
       └── Emergency → emergency-agent
```

---

## 6. Implementation Status

### Phase 1 (complete)
- [x] Author this classification guide
- [x] Add `tier` field to the Active Domains Registry
- [x] Implement `psm_applicable` field in gasterm

### Phase 1.1 (complete)
- [x] Add `psm_applicable` field to powergen (LNG / thermal large-scale facilities — 7 evidence models)
- [x] Add `psm_applicable` field to ehschem (6 evidence models)

### Phase 2 (complete)
- [x] 2-tier directory grouping (functional/ vs industry/) — GxP family (gmp/gdp/glp/gcp/gvp) reclassified to the industry tier
- [ ] Dispatch automation (tier-aware)

### Phase 3 (v3+, if user confusion grows)
- [ ] Full structural reorganization (Option C — pure industry integration)

---

## 7. Legal Disclaimer

This guide is a dispatch aid for users. Final domain selection is at the discretion of the PM (CSO). When multi-domain collaboration is required, the PM coordinates it.
