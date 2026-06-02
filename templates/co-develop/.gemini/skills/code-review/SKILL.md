---
name: code-review
description: >
  Conducts thorough code reviews focusing on correctness, maintainability, security, and
  best practices. Use when: reviewing pull requests, evaluating code quality, providing
  constructive feedback, or ensuring code standards compliance.
version: 1.0.0
metadata:
  type: process
  triggers:
    - code review
    - review pr
    - evaluate code
    - check code quality
    - pull request review
    - code inspection
---

## Overview

This skill provides systematic code review capabilities, ensuring code changes are correct, maintainable, secure, and follow best practices. It balances thoroughness with efficiency, providing actionable feedback while maintaining team velocity.

## When to Use This Skill

**Pull Request Reviews**:
- Trigger: "Review this PR" or "Check pull request"
- Use Case: Evaluating proposed code changes before merging

**Code Quality Assessment**:
- Trigger: "Evaluate code quality" or "Review codebase"
- Use Case: Assessing overall code health and identifying improvements

**Security Reviews**:
- Trigger: "Security review" or "Check for vulnerabilities"
- Use Case: Identifying security issues and potential exploits

**Best Practices Compliance**:
- Trigger: "Check if code follows standards" or "Review against guidelines"
- Use Case: Ensuring code follows project conventions and best practices

---

## Step 1: Review Preparation

**Purpose**: Understand context and scope of the code review.

**Preparation Steps**:
1. **Understand the Purpose**:
   - What problem does this code solve?
   - What are the requirements or acceptance criteria?
   - What changes are being made?

2. **Review Context**:
   - Related issues or tickets
   - Design documents or specifications
   - Previous discussions or decisions
   - Dependencies and related code

3. **Review Scope**:
   - Files changed and lines affected
   - Complexity of changes
   - Risk level (high-risk areas need more scrutiny)
   - Testing coverage included

**Preparation Checklist**:
- [ ] Understand the purpose and requirements
- [ ] Review related documentation
- [ ] Identify high-risk areas
- [ ] Check test coverage
- [ ] Set review focus areas

---

## Step 2: Code Quality Assessment

**Purpose**: Evaluate code for correctness and maintainability.

**Quality Criteria**:
1. **Correctness**:
   - Does the code solve the intended problem?
   - Are there obvious bugs or logic errors?
   - Are edge cases handled?
   - Is error handling appropriate?

2. **Readability**:
   - Is the code easy to understand?
   - Are variable and function names descriptive?
   - Is the logic clear and straightforward?
   - Are comments helpful and accurate?

3. **Maintainability**:
   - Is the code modular and well-organized?
   - Are functions/classes focused on single responsibilities?
   - Is the code DRY (Don't Repeat Yourself)?
   - Is it easy to modify or extend?

4. **Performance**:
   - Are there obvious performance issues?
   - Are algorithms and data structures appropriate?
   - Are there unnecessary computations or allocations?
   - Is database access optimized?

**Review Focus Areas**:
- High-risk code (security, data handling, payments)
- Complex logic or algorithms
- Error handling and edge cases
- Database queries and I/O operations
- Resource management (memory, connections, files)

---

## Step 3: Security Review

**Purpose**: Identify security vulnerabilities and potential exploits.

**Security Checklist**:
1. **Input Validation**:
   - Are user inputs validated and sanitized?
   - Is there protection against injection attacks (SQL, XSS, command injection)?
   - Are file uploads properly validated?

2. **Authentication & Authorization**:
   - Are authentication checks properly implemented?
   - Are authorization checks enforced consistently?
   - Are sensitive operations protected?

3. **Data Protection**:
   - Are sensitive data properly handled?
   - Are secrets/credentials properly stored?
   - Is data encrypted at rest and in transit?
   - Is logging free of sensitive information?

4. **Dependencies**:
   - Are dependencies up-to-date and secure?
   - Are there known vulnerabilities in dependencies?
   - Are dependencies from trusted sources?

**Common Security Issues**:
- SQL injection
- Cross-site scripting (XSS)
- Authentication bypass
- Authorization flaws
- Sensitive data exposure
- Cryptographic weaknesses
- Injection vulnerabilities
- Insecure dependencies

---

## Step 4: Testing Assessment

**Purpose**: Evaluate test coverage and quality.

**Testing Review**:
1. **Test Coverage**:
   - Are new features tested?
   - Are edge cases covered?
   - Is error handling tested?
   - Are there integration tests?

2. **Test Quality**:
   - Are tests clear and focused?
   - Do tests have good assertions?
   - Are test cases realistic?
   - Are tests maintainable?

3. **Test Gaps**:
   - What scenarios aren't tested?
   - What edge cases are missing?
   - What error conditions aren't covered?
   - What integration points aren't tested?

**Testing Recommendations**:
- Add unit tests for untested functions
- Add integration tests for API endpoints
- Add tests for edge cases
- Add tests for error conditions
- Improve test assertions and clarity

---

## Step 5: Standards Compliance

**Purpose**: Ensure code follows project conventions and best practices.

**Standards Checklist**:
1. **Code Style**:
   - Does code follow project style guide?
   - Is formatting consistent (indentation, spacing)?
   - Are naming conventions followed?
   - Is file organization consistent?

2. **Architecture Patterns**:
   - Are design patterns used appropriately?
   - Is the code consistent with existing architecture?
   - Are separation of concerns maintained?
   - Are dependencies managed properly?

3. **Documentation**:
   - Is complex code documented?
   - Are public APIs documented?
   - Are comments helpful and accurate?
   - Is README or CHANGELOG updated?

4. **Best Practices**:
   - Are language/framework best practices followed?
   - Are anti-patterns avoided?
   - Is code idiomatic for the language?
   - Are performance considerations addressed?

---

## Step 6: Feedback Delivery

**Purpose**: Provide constructive, actionable feedback.

**Feedback Principles**:
1. **Be Specific**:
   - Point to exact code locations
   - Explain why something is problematic
   - Provide concrete examples
   - Suggest specific improvements

2. **Be Constructive**:
   - Focus on the code, not the coder
   - Explain the reasoning behind feedback
   - Offer solutions, not just problems
   - Acknowledge good parts of the code

3. **Prioritize Issues**:
   - **Must Fix**: Critical bugs, security issues, breaking changes
   - **Should Fix**: Important improvements, maintainability issues
   - **Nice to Have**: Minor optimizations, style improvements
   - **Future Consideration**: Ideas for future improvements

4. **Balance Feedback**:
   - Start with positive observations
   - Group related issues together
   - Provide explanations for suggestions
   - End constructively

**Feedback Structure**:
```markdown
## Summary
[Brief overview of the review]

## Strengths
- [What's done well]
- [Good patterns or practices]

## Issues to Address

### Must Fix
1. [Critical issue with explanation and suggestion]

### Should Fix  
1. [Important improvement with explanation]

### Nice to Have
1. [Minor optimization with explanation]

## Approval Status
[Approved / Approved with changes / Request changes]
```

---

## Expected Outputs

**For Pull Request Reviews**:
- Comprehensive code review feedback
- Security vulnerability identification
- Test coverage assessment
- Standards compliance evaluation
- Actionable improvement suggestions

**For Code Quality Assessment**:
- Overall code quality score
- Specific improvement areas
- Best practices recommendations
- Refactoring suggestions
- Technical debt inventory

---

## Best Practices

**Review Quality**:
✅ **Do**:
- Be thorough but efficient
- Provide specific, actionable feedback
- Explain the "why" behind suggestions
- Acknowledge good code and patterns
- Prioritize issues by severity
- Follow project review guidelines

❌ **Don't**:
- Be overly nitpicky about style
- Provide vague feedback without specifics
- Focus only on problems without solutions
- Use harsh or dismissive language
- Block PRs for trivial issues
- Ignore context or requirements

**Communication Quality**:
✅ **Do**:
- Start with positive observations
- Group related feedback together
- Use clear section headers
- Provide code examples for suggestions
- Offer to discuss in person if needed
- Be respectful and collaborative

❌ **Don't**:
- Use sarcasm or humor that could be misinterpreted
- Make it personal ("you should have...")
- Overwhelm with too many comments
- Comment on every minor issue
- Be dismissive of approach or effort
- Assume malice for mistakes

---

## Common Mistakes to Avoid

**Review Anti-Patterns**:
1. **Style Police**: Focusing only on formatting rather than substance
2. **Approval Yea-Saying**: Not providing critical feedback when needed
3. **Context Ignoring**: Reviewing code without understanding requirements
4. **Solution Forcing**: Suggesting preferred approach without considering trade-offs
5. **Delay Tactics**: Holding up reviews for minor issues

**Feedback Anti-Patterns**:
1. **Vague Criticism**: "This is bad" without explanation
2. **Negativity Bias**: Only commenting on problems, not strengths
3. **Overwhelming**: Too many comments that drown out important issues
4. **Inconsistency**: Different standards for different people
5. **Timing**: Waiting until last minute to review

---

## Related Skills

- **security-review**: For specialized security auditing
- **testing-qa**: For evaluating test coverage and quality
- **refactoring**: For suggesting code improvements
- **performance-optimization**: For identifying performance issues

---

## Code Review Tools

**Automated Tools**:
- Linters (ESLint, Pylint, RuboCop)
- Static analysis tools (SonarQube, CodeQL)
- Security scanners (Snyk, Dependabot)
- Code coverage tools (Istanbul, JaCoCo)

**Review Platforms**:
- GitHub pull requests
- GitLab merge requests
- Bitbucket pull requests
- Code review tools (Review Board, Phabricator)

**Productivity Tips**:
- Use keyboard shortcuts for navigation
- Batch related comments together
- Use templates for common feedback
- Leverage automated tools first
- Focus review time on high-risk areas
