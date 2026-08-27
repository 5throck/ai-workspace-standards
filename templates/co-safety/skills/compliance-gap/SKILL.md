---
name: compliance-gap
description: Trigger compliance gap analysis against applicable EHS regulations
owner: compliance-agent
status: active
version: 1.0.0
metadata:
  triggers:
    - 컴플라이언스 갭
    - compliance gap
    - 준법 감시
    - 법률 검토
    - regulatory compliance
    - 규제 준수
    - 법적 요건
    - legal requirement review
  agents:
    - compliance-agent
  legal_basis:
    - 산업안전보건법 (Occupational Safety and Health Act — all articles)
    - 중대재해처벌법 (Serious Accidents Punishment Act — all articles)
    - 산업안전보건법 시행규칙 (OSHA-KR Enforcement Regulation)
scope: workspace
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Compliance Gap Analysis

## When to Use

Invoke this skill when: a new regulation is enacted or amended, a periodic compliance review is due, an audit finding references a legal requirement, management requests a gap assessment, or a new operational activity may trigger new regulatory obligations. Also invoke after any serious incident to assess whether legal obligations were met.

## Steps

1. **Regulation Identification** — Identify all applicable regulations based on the industry sector, workplace type, number of employees, and work activities. Key frameworks:
   - 산업안전보건법 (OSHA-KR) and subordinate regulations
   - 중대재해처벌법 (SAPA) — applies to workplaces with 5+ employees
   - 화학물질관리법 (Chemical Substances Control Act) — if applicable
   - 화학물질등록·평가 등에 관한 법률 (K-REACH) — if applicable (hazardous/toxic chemical management provisions formerly under 유해화학물질관리법 (TCCL), which K-REACH partially supersedes per `regulations/KR/K-REACH.yaml`)
   - Other sector-specific regulations as identified

2. **Live Regulation Verification** — Before gap analysis, verify article numbers and content are current using the `k-law` skill (법제처 Open API live lookup; `kr_safety` MCP as secondary) rather than static indexes alone, per the compliance-agent Workflow Pattern (`agents/_shared/compliance-agent.md` §Workflow Pattern, step 2). This project has a history of mis-citations that live verification catches.

3. **Current State Assessment** — For each applicable regulation, document the current compliance state: systems in place, records available, responsible persons assigned, training completed.

4. **Gap Identification** — Compare current state against regulatory requirements. For each gap, record:
   - Regulation article and requirement
   - Current state (what exists)
   - Required state (what the law mandates)
   - Gap description
   - Risk level (Critical / Major / Minor)

5. **Corrective Action Recommendation** — For each identified gap, recommend a corrective action with estimated effort, responsible party, and target completion date. Prioritize Critical gaps (those with potential criminal liability under 중대재해처벌법) first.

6. **Gap Report** — Produce a structured gap report and save to `memory/findings/`. Present findings to the CSO for review and approval of the corrective action plan.

## Output Format

Save gap report to `memory/findings/compliance-gap-YYYY-MM-DD-<scope>.md`:

```markdown
# Compliance Gap Report
date: YYYY-MM-DD
assessor: <name>
legal_basis:
  - <regulation 1 — article and topic>
  - <regulation 2 — article and topic>
  - <regulation 3 — article and topic (>= 3 sources required)>
status: draft | under_review | approved

## Regulatory Framework
- <list of applicable regulations>

## Gap Summary
| # | Article | Requirement | Current State | Gap | Risk Level |
|---|---------|-------------|---------------|-----|------------|
| 1 | 제9조 | Training records for all workers | Partial records only | Missing records for 15 workers | Major |

## Corrective Action Plan
| # | Gap Ref | Action | Owner | Due | Priority |
|---|---------|--------|-------|-----|----------|
| 1 | Gap-1   | Update training records | HR/Safety | YYYY-MM-DD | High |

## Approval
Reviewed by CSO: <name>
Date: YYYY-MM-DD
```

## Legal Notes

- 산업안전보건법 imposes duties on employers across all aspects of occupational safety and health. Violations can result in fines up to 50 million KRW or imprisonment.
- 중대재해처벌법 imposes criminal penalties when serious accidents (SAPA Article 2 thresholds) result from failure to meet safety obligations — individuals: 1년 이상 징역 또는 10억원 이하 벌금 for death cases, 7년 이하 징역 또는 1억원 이하 벌금 for injury·disease cases (Article 6); corporations face dual-liability fines up to 50억원 (death) / 10억원 (injury·disease) under the Article 7 양벌규정.
- **Disclaimer**: This skill provides workflow assistance to support compliance management. It does not constitute legal advice. Consult a qualified legal professional for specific legal interpretations or enforcement matters.
