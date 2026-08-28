# study-protocol Workflow

## 1. Objective
Design, approve, and amend study protocols per OECD GLP Section 8. Protocol is the master document for GLP study.

## 2. Applicability
All GLP-regulated studies. Protocol must be approved BEFORE study initiation.

## 3. Workflow Steps
1. **Drafting**: Study Director drafts per OECD format (apply `skills/domains/glp/glp-study-protocol-validator/`).
2. **Sponsor review**: Sponsor confirms scientific rationale.
3. **QAU review**: Quality Assurance Unit verifies GLP compliance.
4. **Approval**: Study Director signature, Test Facility Management approval.
5. **Amendment**: Any change requires formal amendment with rationale.
6. **Deviation**: Unplanned deviations documented, QAU notified.

## 4. Required Protocol Content (OECD GLP Section 8)
- Identification of test article/reference article
- Study objectives
- Test system justification
- Dose design and rationale
- Endpoints and observation schedule
- Statistical methods
- Records retention plan

## 5. Evidence Record
Generate `glp-study-protocol-record.json` with `study_director_id` field.
