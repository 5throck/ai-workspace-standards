
# Hot Work Permit

## Overview
This workflow defines the permit-to-work procedure for hot work operations conducted in or near a covered process, in compliance with OSHA-KR Article 44. Hot work includes welding, cutting, grinding, brazing, and any other operation that generates sparks, flames, or heat sufficient to ignite flammable or combustible materials.

## Scope
All hot work performed within or adjacent to a covered process area requires a Hot Work Permit issued by an authorized supervisor. The permit must be issued before work begins and remains valid only for the duration and location specified.

## Procedure

### 1. Pre-Work Hazard Assessment
- Identify all flammable gas, vapor, or combustible dust hazards in the work area and surrounding zones.
- Conduct a gas-free verification by measuring flammable gas concentration using a calibrated gas detector.
- Record the gas concentration in ppm in the evidence model under `fire_hazard_assessment`.
- Work may only proceed when `safe_to_proceed` is confirmed true (concentration below 10% LEL or per site standard).

### 2. Permit Issuance
- Assign a unique permit number and specify the exact work location and description.
- The authorized supervisor signs the permit, confirming that all pre-work hazard controls are in place.
- Set and record the permit expiry time; work must stop at expiry unless the permit is renewed through a fresh assessment.

### 3. Fire Watch
- Determine whether a fire watch is required based on the proximity of flammable materials and the nature of the hot work.
- If required, assign and record the name of the fire watch attendant.
- The fire watch must remain in position throughout the hot work and for a minimum of 30 minutes after work completion.

### 4. Work Execution Controls
- Remove or protect all flammable and combustible materials within a safe radius before ignition.
- Ensure fire extinguishing equipment is immediately accessible at the work site.
- Stop work immediately if gas readings change or if conditions deviate from the permit.

### 5. Permit Closure
- Upon completion of hot work, the authorized person records the closure signature and time.
- Retain completed permits as evidence records for PSM compliance audits.
