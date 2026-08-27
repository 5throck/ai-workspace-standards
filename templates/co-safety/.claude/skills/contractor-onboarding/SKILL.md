---
name: contractor-onboarding
version: 1.0.0
owner: contractor-safety-agent
scope: workspace
status: active
description: Manage EHS onboarding and compliance verification for contractors
metadata:
  triggers:
    - 협력업체 온보딩
    - contractor onboarding
    - 도급업체 안전교육
    - 협력업체 자격심사
    - site access approval
    - 안전교육 이수확인
    - 도급 안전관리
  legal_basis:
    - 중대재해처벌법 제5조 (도급·하도급 안전보건 확보의무)
    - 산업안전보건법 제38조 (안전조치)
    - 산업안전보건법 제36조 (위험성평가)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema
# Contractor Onboarding Skill

## Overview
This skill ensures that all contractors and third-party vendors meet mandatory EHS requirements and receive appropriate safety training before commencing work on-site.

## Operational Steps
1. **Information Collection**: Receive contractor details, scope of work, and hazard profiles.
2. **Qualification Verification**: Review contractor safety records, insurance, and past EHS performance.
3. **Training Assignment**: Automatically assign mandatory site-specific safety training based on work scope.
4. **Certification Check**: Validate that required licenses and certifications are current.
5. **Issue Access Credentials**: Approve site access once all EHS onboarding criteria are successfully met.
6. **Continuous Monitoring**: Track contractor compliance throughout the duration of the project.

