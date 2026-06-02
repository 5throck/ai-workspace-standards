---
name: test-driven-development
description: >
  Implements software using Test-Driven Development (TDD) methodology with red-green-refactor
  cycle. Use when: developing new features, fixing bugs with tests, or ensuring code
  reliability through test-first approach.
version: 1.0.0
gemini-parity: skip
metadata:
  type: process
  triggers:
    - tdd
    - test driven development
    - test first
    - write tests first
    - red green refactor
    - test coverage
---

## Overview

This skill provides systematic Test-Driven Development (TDD) workflow, ensuring code quality and reliability through the red-green-refactor cycle. It emphasizes writing tests before implementation, leading to more maintainable, better-designed code.

## When to Use This Skill

**Feature Development**:
- Trigger: "Implement feature using TDD" or "Test-first development"
- Use Case: Building new functionality with test coverage from the start

**Bug Fixing**:
- Trigger: "Fix bug with test" or "Add failing test for bug"
- Use Case: Ensuring bugs are fixed and don't regress

**Code Refactoring**:
- Trigger: "Refactor with test safety net" or "Improve code design"
- Use Case: Improving code structure while maintaining functionality

**Quality Assurance**:
- Trigger: "Ensure test coverage" or "Add test safety net"
- Use Case: Building confidence in code correctness and preventing regressions

---

## Step 1: Red - Write a Failing Test

**Purpose**: Start by defining what success looks like.

**Test Writing Process**:
1. **Understand Requirements**:
   - What should the code do?
   - What are the edge cases?
   - What should happen with invalid input?

2. **Write Test Specification**:
   - Test name describes the behavior
   - Arrange-Act-Assert (AAA) pattern
   - Clear test setup and teardown
   - Meaningful assertions

3. **Run Test - Verify Failure**:
   - Test should fail (Red)
   - Failure message should be meaningful
   - Confirms test is testing the right thing

**Test Quality Checklist**:
- [ ] Test describes behavior, not implementation
- [ ] Test has clear setup and teardown
- [ ] Assertions are specific and meaningful
- [ ] Test covers edge cases
- [ ] Test is independent and isolated

**Example Test Structure**:
```python
def test_calculator_adds_two_numbers():
    # Arrange
    calculator = Calculator()
    
    # Act
    result = calculator.add(2, 3)
    
    # Assert
    assert result == 5
```

---

## Step 2: Green - Make Test Pass

**Purpose**: Write minimal code to pass the test.

**Implementation Strategy**:
1. **Write Minimal Implementation**:
   - Just enough code to pass the test
   - Don't worry about perfect design yet
   - Hard-code values if needed (refactor later)

2. **Run Test - Verify Success**:
   - Test should pass (Green)
   - All assertions should succeed
   - No new tests should break

3. **Keep It Simple**:
   - Avoid over-engineering
   - Focus on passing the test
   - Don't add extra features
   - Defer optimization to refactor step

**Green Phase Principles**:
- Speed over perfection
- Working code over elegant code
- Passing tests over comprehensive design
- Implementation over abstraction

**Common Mistakes**:
- ❌ Writing too much code at once
- ❌ Implementing features not tested
- ❌ Optimizing prematurely
- ❌ Skipping the test run

---

## Step 3: Refactor - Improve Code

**Purpose**: Clean up code while keeping tests green.

**Refactoring Process**:
1. **Run All Tests**:
   - Ensure baseline: all tests pass
   - Confirm test coverage is adequate
   - Identify code smells and improvements

2. **Apply Refactoring**:
   - Remove duplication
   - Improve names and structure
   - Extract methods/classes
   - Simplify complex logic

3. **Run Tests After Each Change**:
   - Tests should still pass (Green)
   - Behavior is unchanged
   - Only implementation improves

**Refactoring Checklist**:
- [ ] Code is DRY (Don't Repeat Yourself)
- [ ] Names are descriptive and clear
- [ ] Methods/functions are focused
- [ ] Classes have single responsibility
- [ ] Code is easy to understand
- [ ] No unnecessary complexity
- [ ] Performance is adequate

**Refactoring Techniques**:
- Extract Method
- Extract Class
- Rename Variable/Method
- Introduce Parameter Object
- Replace Conditional with Polymorphism
- Decompose Conditional

**Safe Refactoring**:
- Small, incremental changes
- Run tests after each change
- Keep commits atomic
- Document refactoring rationale

---

## Step 4: Repeat the Cycle

**Purpose**: Build comprehensive test coverage incrementally.

**Iteration Strategy**:
1. **Next Test Case**:
   - Add another test for edge case
   - Test for error conditions
   - Test for boundary values

2. **Build Up Behavior**:
   - Start with simple case
   - Add complexity gradually
   - Ensure all tests pass
   - Refactor as needed

3. **Coverage Goals**:
   - Unit tests for individual functions
   - Integration tests for interactions
   - Edge case coverage
   - Error handling coverage

**Test Pyramid**:
```
    E2E Tests (few)
       /\
      /  \
     /    \
    /      \
   /        \
  / Integration \
 /   Tests     \
/______________\
Unit Tests (many)
```

---

## Step 5: Test Quality Standards

**Purpose**: Ensure tests provide long-term value.

**Good Test Characteristics**:
1. **Readability**:
   - Test name describes behavior
   - Test tells a story
   - Setup is clear and minimal
   - Assertions are meaningful

2. **Maintainability**:
   - Tests are independent
   - Tests are fast
   - Tests are reliable
   - Tests don't duplicate implementation

3. **Usefulness**:
   - Tests catch real bugs
   - Tests document behavior
   - Tests guide refactoring
   - Tests prevent regressions

**Test Organization**:
- Group related tests
- Use test fixtures for setup
- Follow naming conventions
- Separate unit/integration/e2e tests

**Anti-Patterns to Avoid**:
- Testing implementation details
- Brittle tests that break easily
- Slow tests that discourage running
- Tests that require specific environment setup
- Tests that don't assert meaningful behavior

---

## Step 6: TDD Best Practices

**Purpose**: Apply TDD effectively in real projects.

**Starting TDD**:
1. **Begin with Simple Cases**:
   - Start with new features
   - Practice with isolated code
   - Build confidence gradually

2. **Test First Mindset**:
   - Think about behavior before implementation
   - Design APIs from usage perspective
   - Consider edge cases upfront

3. **Keep Tests Fast**:
   - Use test doubles (mocks, stubs)
   - Avoid external dependencies
   - Parallelize test execution
   - Keep tests independent

**Common Challenges**:
- **"How do I test X?"**: Break down into smaller, testable pieces
- **"Tests take too long"**: Use mocks and avoid slow operations
- **"Code is hard to test"**: Refactor for better testability
- **"Too many tests to update"**: Better design reduces test duplication

**TDD in Legacy Code**:
1. Add tests around existing code (characterization tests)
2. Refactor in small steps with test safety net
3. Gradually improve test coverage
4. Use tests to guide refactoring

---

## Expected Outputs

**For Feature Development**:
- Comprehensive test suite for new feature
- Production code that passes all tests
- Clean, maintainable implementation
- Documentation of expected behavior

**For Bug Fixes**:
- Failing test that reproduces bug
- Minimal fix that makes test pass
- Confidence bug won't regress
- Documentation of bug behavior

**For Refactoring**:
- Test suite that protects behavior
- Improved code structure
- Confirmed functionality preserved
- Better maintainability

---

## Best Practices

**TDD Discipline**:
✅ **Do**:
- Write test before implementation
- Keep tests fast and independent
- Run tests frequently
- Refactor confidently with test safety net
- Treat test failures as first priority

❌ **Don't**:
- Write tests after code
- Let tests slow you down (keep them fast)
- Skip tests when "in a hurry"
- Comment out failing tests
- Make tests dependent on each other

**Test Quality**:
✅ **Do**:
- Test behavior, not implementation
- Use descriptive test names
- Keep tests simple and focused
- Update tests when requirements change
- Treat tests as documentation

❌ **Don't**:
- Test implementation details
- Use vague test names
- Write complex tests
- Let tests become outdated
- Duplicate implementation in tests

---

## Common Mistakes to Avoid

**TDD Anti-Patterns**:
1. **Fake TDD**: Writing tests after code ("green-red-refactor")
2. **Test-Induced Design**: Over-engineering for testability
3. **Coverage Obsession**: Focusing on metrics over value
4. **Testing Trivia**: Testing getters/setters or simple methods
5. **Fragile Tests**: Tests that break with implementation changes

**Process Anti-Patterns**:
1. **Skipping Red**: Not verifying test fails first
2. **Skipping Refactor**: Leaving code messy after green
3. **Big Steps**: Writing too much code between tests
4. **Test Dependencies**: Tests that require specific order
5. **Slow Tests**: Tests that discourage frequent running

---

## Related Skills

- **code-review**: For evaluating test quality and coverage
- **refactoring**: For improving code design with test safety net
- **testing-qa**: For comprehensive testing strategy beyond TDD
- **continuous-integration**: For automating test runs in CI/CD

---

## TDD Tools and Frameworks

**Popular Testing Frameworks**:
- **JavaScript**: Jest, Mocha, Jasmine, Vitest
- **Python**: pytest, unittest, nose2
- **Java**: JUnit, TestNG
- **C#**: NUnit, xUnit
- **Ruby**: RSpec, Minitest

**Test Doubles Libraries**:
- **JavaScript**: sinon.js, testdouble.js, jest.fn()
- **Python**: unittest.mock, pytest-mock
- **Java**: Mockito, PowerMock
- **C#**: Moq, NSubstitute

**Coverage Tools**:
- **JavaScript**: Istanbul, nyc, c8
- **Python**: pytest-cov, coverage.py
- **Java**: JaCoCo, Cobertura
- **General**: sonar-scanner, Codecov

---

## Testing Strategies

**Unit Testing**:
- Test individual functions/methods in isolation
- Use test doubles for external dependencies
- Focus on business logic and algorithms
- Keep tests fast and simple

**Integration Testing**:
- Test interactions between components
- Use real dependencies (or realistic fakes)
- Test database operations, API calls
- Ensure components work together

**E2E Testing**:
- Test complete user workflows
- Use real browser/environment
- Test critical user paths
- Keep E2E tests minimal (slow, brittle)

**Property-Based Testing**:
- Generate random test inputs
- Verify invariants hold true
- Find edge cases human testing misses
- Tools: QuickCheck, Hypothesis, fast-check
