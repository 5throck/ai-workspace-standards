# signal-detection Workflow

## 1. Objective
Detect statistical signals in case database per ICH E2E and EU GVP Module 9.

## 2. Methods
- **Disproportionality analysis**: PRR (Proportional Reporting Ratio), ROR, BCPNN, EBGM
- **Time series analysis**: trend detection
- **Sequence signaling**: temporal pattern of reports
- **Clinical review**: case series analysis

## 3. Workflow Steps
1. **Database query**: Apply statistical methods (apply `skills/domains/gvp/signal-detector/`).
2. **Signal identification**: Threshold breach (e.g., PRR ≥2, chi-square ≥4).
3. **Signal triage**: Severity, novelty, clinical relevance.
4. **Signal validation**: Clinical review by Drug Safety Officer.
5. **Signal assessment**: Multi-disciplinary team.
6. **Action**: Update RMP, PBRER, labeling; possible MFDS notification.

## 4. Evidence Record
Generate `gvp-signal-record.json` with statistical analysis details.
