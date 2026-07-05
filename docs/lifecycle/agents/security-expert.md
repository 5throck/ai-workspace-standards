# Security-Expert Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial security-expert agent established | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Security specialist
- [x] Tier assignment: Medium-tier (claude-sonnet-4-6)
- [x] Security responsibilities specified: Git hooks, .gitleaks, credential management
- [x] Successfully validated in security workflows

## Dependencies

- pm (for security dispatch)
- automation-engineer (for security script implementation)

## Domain

**Security Specialist** - Git hooks enforcement and credential management

**Phases Supported**: 4 (Implementation), 5 (QA)

**Key Responsibilities**:
- Git hooks enforcement
- .gitleaks configuration and secret scanning
- Credential management and security
- Security review for code changes
- Vulnerability assessment

## Dispatch Protocol

**Can Lead Phases**: [4, 5]
**Can Support In**: [0, 2]
**Tier**: medium
**Communication Style**: sync (security gates require validation)

## Security Scope

1. **Git Hooks**:
   - Pre-commit hooks for secret scanning
   - Pre-push hooks for security validation
   - .gitleaks integration

2. **Credential Management**:
   - .env file protection
   - API key security
   - Password policies

3. **Code Security**:
   - Vulnerability scanning
   - Security review for PRs
   - OWASP Top 10 compliance

## Metadata

- **Current Phase**: production
- **Owner**: security-expert
- **Last Updated**: 2026-05-29
- **Last Reviewer**: lifecycle-manager
