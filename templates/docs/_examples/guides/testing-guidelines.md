# Testing Guidelines

This document provides standards for writing tests within the project. The **QA Engineer** agent should refer to this guide when creating or updating tests.

---

## 1. Test Structure

All tests should follow the standard testing framework definitions for the language.

### Required Test Structure

```python
# Python (pytest) example
class TestFeature:
    def setup_method(self):
        """Run before each test method"""
        self.cut = MyFeature()  # Class Under Test

    def teardown_method(self):
        """Run after each test method"""
        pass

    def test_method_name(self):
        """Clear description of what is being tested"""
        # Arrange, Act, Assert
        pass
```

```javascript
// JavaScript (Jest/Vitest) example
describe('Feature', () => {
  let cut;

  beforeEach(() => {
    cut = new MyFeature(); // Class Under Test
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something when condition', () => {
    // Arrange, Act, Assert
  });
});
```

---

## 2. Test Isolation & Mocking

Tests must not depend on external services or real database records unless running an integration test. Use mocking frameworks to isolate dependencies.

### Using Mocks

```python
# Python with pytest-mock
def test_feature_with_mock(mocker):
    # Arrange: Mock external dependency
    mock_api = mocker.patch('module.api_call')
    mock_api.return_value = {"status": "ok"}

    # Act: Call the method under test
    result = cut.get_data()

    # Assert: Verify the result
    assert result["status"] == "ok"
    mock_api.assert_called_once()
```

```javascript
// JavaScript with vi.mock
import { vi } from 'vitest';

test('feature with mock', () => {
  // Arrange: Mock external dependency
  vi.mock('./api', () => ({
    fetch: vi.fn().mockResolvedValue({ status: 'ok' })
  }));

  // Act & Assert...
});
```

---

## 3. Best Practices

- **Naming Conventions**: Test methods should clearly describe what is being tested (e.g., `test_calculate_discount_with_valid_input`).
- **Setup Method**: Always initialize the `cut` (Component Under Test) inside the setup method to ensure a fresh instance for every test.
- **Assertions**: Use framework-specific assertion methods. Provide meaningful messages for assertions to help diagnose failures quickly.
- **Coverage**: Aim to test both positive (happy path) and negative (error handling/exceptions) scenarios.
- **Test Independence**: Each test should be able to run independently. Do not depend on execution order.

---

## 4. Test Categories

| Category | Purpose | Example |
|----------|---------|---------|
| **Unit Test** | Test individual functions/methods in isolation | `test_calculate_total()` |
| **Integration Test** | Test multiple components together | `test_api_to_database_flow()` |
| **E2E Test** | Test full user workflows | `test_user_login_to_dashboard()` |

---

## 5. Arrange–Act–Assert Pattern

All test methods must follow AAA:

1. **Arrange**: Set up input data and mocks
2. **Act**: Call the method under test
3. **Assert**: Verify the result

```python
def test_calculate_price_with_discount(self):
    # Arrange
    price = 100
    discount = 0.2  # 20%
    expected = 80

    # Act
    result = self.cut.calculate_price(price, discount)

    # Assert
    assert result == expected, f"Expected {expected}, got {result}"
```

---

## 6. Method Naming Convention

```
test_<method_name>_<scenario>_<expected_result>
```

Examples:
- `test_calculate_price_with_discount_returns_reduced_amount`
- `test_get_user_with_invalid_id_raises_exception`
- `test_post_document_with_locked_period_returns_error`

---

## 7. Test Quality Standards

### Coverage Goals

| Component | Target Coverage |
|-----------|:---------------:|
| Core business logic | 80%+ |
| API endpoints | 70%+ |
| Utility functions | 90%+ |
| UI components | 50%+ |

### Quality Checks

Before marking a task as complete, ensure:

- [ ] All new code has corresponding tests
- [ ] All tests pass locally
- [ ] Linter reports no errors
- [ ] Coverage threshold met (if configured)

---

## 8. Common Testing Pitfalls

| Pitfall | Why It's Bad | Fix |
|---------|--------------|-----|
| Testing implementation details | Tests break on refactoring | Test behavior, not internals |
| Brittle mocks | Tests fail on unrelated changes | Use minimal, focused mocks |
| No negative test cases | Miss edge cases | Add error scenario tests |
| Slow tests | Discourages running tests | Mock external I/O |
| Shared state between tests | Flaky, order-dependent tests | Isolate each test |

---

*Maintained by the Engineering Team | Last Updated: 2026-05-25*
