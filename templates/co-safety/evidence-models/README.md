# evidence-models/

JSON Schema evidence-record models bound by Safety OS workflows via the
`evidence_model:` field in each workflow's `schema.yaml`. Orphan detection
and disposition of unbound models is owned by the audit-agent.

## Layout

- `_shared/base/` — base schemas (`common.schema.json`, `finding.schema.json`,
  `corrective-action.schema.json`) extended by all record models
- `_shared/` — cross-industry records (LOTO, TBM, confined space)
- `domains/functional/` — functional-agent records (PSM, MSDS, training,
  incident investigation, risk assessment, occupational health, contractor
  safety, asset integrity)
- `domains/industry/` — industry-domain records
- `emergency/` — emergency-response records

## Unwired / Reserved Models

Models below are quality-complete (versioned; `legal_basis` minItems >= 3) but
are not referenced by any agent, workflow, skill, doc, or policy file as of the
2026-08-23 orphan re-scan (189 schemas total, 11 unbound). They are **reserved**:
wire only when a covering workflow is authored or an existing workflow's scope
is confirmed to match (additive single-field change to the workflow's
`evidence_model:` binding). Never edit these schemas to force a fit.

| Model | Domain | Intended Owner Agent | Disposition Rationale | Suggested Wiring Milestone |
|-------|--------|----------------------|----------------------|----------------------------|
| battery-electrolyte-nmp-exposure-record | battery | battery-agent | Candidate host `battery-thermal-runaway-prevent` binds its own thermal-runaway record and has no workflow body confirming NMP exposure-monitoring scope; electrolyte/filling/recovery IH monitoring may warrant a dedicated workflow | Dedicated electrolyte handling / NMP recovery exposure-control workflow |
| biotech-bsc-certification-record | biotech | biotech-agent | `biotech-bsl-lab-aerosol-control` already binds its own aerosol-control record; annual BSC field certification is equipment-level and host overlap is not explicit | Additive binding on BSL-lab workflow after specialist scope review |
| datacenter-clean-agent-suppression-record | datacenter | datacenter-agent | `datacenter-ups-fire-safety` covers UPS/ESS fire response but binds its own record; suppression-system function testing is a distinct fire-protection activity | IT-room fire-suppression system inspection workflow |
| defense-test-range-blastoverpressure-record | defense | defense-agent | No existing workflow covers live-fire / static detonation test-range operations | New test-range blast-overpressure & hearing-conservation workflow |
| food-foreign-material-detection-record | food | food-agent | `haccp-ccp-monitoring` binds its own CCP record; metal-detector / X-ray verification overlaps HACCP prerequisites but host coverage is unconfirmed | HACCP prerequisite-program extension or new foreign-material control workflow |
| logistics-yard-rack-collapse-prevention-record | logistics | logistics-agent | No existing workflow covers selective-pallet-rack structural integrity or stacking collapse prevention | New yard rack-collapse prevention workflow |
| railway-thermite-welding-hot-work-record | railway | railway-agent | Thermite rail welding hot work is not covered by catenary, confined-space, bridge-fall, or rolling-stock LOTO workflows | New rail-welding hot-work workflow with track possession closure |
| semicon-waste-neutralization-record | semicon | semicon-agent | `semicon-scrubber-maintenance` covers abatement equipment, not effluent neutralization / discharge-quality verification | New fab waste-neutralization inspection workflow |
| shipbuilding-pre-hot-work-gas-free-record | shipbuilding | shipbuilding-agent | Two plausible hosts (`shipbuilding-welding-fume-gas-safety`, `ship-tank-confined-space`) each already bind their own records; gas-free certificate legally precedes both activities | Resolve host during hot-work permit integration, then wire additively |
| steelmaking-continuous-casting-cooling-water-record | steelmaking | steelmaking-agent | No existing workflow covers continuous-casting machine mold/strand cooling-water integrity checks | New CCM pre-cast cooling-water integrity workflow |
| waste-designated-waste-manifest-record | waste | waste-agent | `waste-designated-hazardous-chemical-treatment` binds its own treatment record; e-manifest chain-of-custody spans generator/transporter/treatment roles beyond that scope | Manifest chain-of-custody workflow, or additive binding after scope confirmation |
