# icsr-intake Workflow

## 1. Objective
Receive and triage Individual Case Safety Reports (ICSR) per ICH E2B(R3) and KGVP.

## 2. Sources
- Healthcare professional mandatory reports (15-day expedited)
- Patient voluntary reports (KIDS)
- Literature alerts (scientific publications)
- Clinical trial SAE follow-up (from GCP domain)
- Foreign regulatory authority reports

## 3. Workflow Steps
1. **Receipt**: E2B(R3) electronic format preferred (HL7 message).
2. **Triage**: Initial assessment — validity, seriousness, expectedness.
3. **Causality assessment**: WHO-UMC algorithm.
4. **Coding**: MedDRA terminology (SOC → HLGT → HLT → PT → LLT).
5. **Database entry**: Within defined timeline (15 days for serious).
6. **Expedited reporting**: To MFDS within 15 days for serious/reaction.

## 4. Evidence Record
Generate `gvp-icsr-record.json` with `ich_e2_compliance` field.
