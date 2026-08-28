# test-article-management Workflow

## 1. Objective
Manage test article (시험물질) lifecycle per OECD GLP Section 7 — receipt, characterization, storage, retention, disposal.

## 2. Applicability
All test articles used in GLP-regulated studies at MFDS/ME GLP-certified facilities.

## 3. Workflow Steps
1. **Receipt**: Receive test article from sponsor, verify identity.
2. **Characterization**: Confirm purity, stability, physical properties. Reference MSDS via `msds_record_ref`.
3. **Labeling**: Unique identifier, expiration, storage conditions.
4. **Storage**: Per specified conditions (typically room temp, refrigerated, frozen).
5. **Inventory tracking**: Receipt-to-disposition chain of custody.
6. **Retention sample**: Preserve per protocol (typically 5 years).
7. **Disposal**: Per safety/environmental protocols when no longer needed.

## 4. Cross-Domain
- **MSDS**: `msds_record_ref` for chemical/safety data
- **K-REACH**: Hazard assessment studies require chain-of-custody documentation

## 5. Evidence Record
Generate `glp-test-article-record.json` with `msds_record_ref` field.
