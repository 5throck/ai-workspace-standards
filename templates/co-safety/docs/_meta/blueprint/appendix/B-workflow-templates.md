# Appendix B: Workflow Templates

This appendix outlines the standard YAML/Markdown structures used for defining Safety OS workflows.

## Standard Workflow Template

All operational workflows in Safety OS must conform to the following schema to satisfy the Chief Safety Officer (CSO) gateway checks.

```markdown
# Workflow: [Workflow Name]

## Metadata
- **ID**: `WF-[CATEGORY]-[XXX]`
- **Owner Agent**: `[Primary Agent]`
- **Required Tier**: `[Low/Medium/High]`
- **Execution**: `[Sequential/Parallel/Event-Driven]`

## 1. Legal Basis (MANDATORY)
*Workflows without a valid legal basis will be rejected by the PM (CSO).*
- **Act**: [e.g., OSHA-KR / SAPA]
- **Article**: [e.g., Article 36]
- **Clause**: [Relevant Clause]

## 2. Trigger Conditions
- [Event or Schedule that initiates the workflow]

## 3. Execution Steps
1. **[Step 1 Name]**: Description of action.
2. **[Step 2 Name]**: Description of action.
3. **[Step 3 Name]**: Description of action.

## 4. Expected Output / Evidence Record
- Path: `memory/evidence/[YYYY-MM-DD]-[Type].json`
- Schema: `evidence-models/[Schema-Name].json`
```

## Example Workflows
- **WF-RISK-001**: Regular Risk Assessment
- **WF-EMERG-001**: Immediate Evacuation Protocol
- **WF-AUDIT-001**: Quarterly Compliance Check
