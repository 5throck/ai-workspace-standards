# Testing Guidelines

This document outlines the standards and best practices for creating, organizing, and managing test code and resources within the `co-architect` project. Following these guidelines ensures that testing environments remain clean, reproducible, and free of persistent side effects.

---

## 1. Directory Structure

All testing files must be contained within the `tests/` directory at the project root.

```
tests/
├── test_data/          # Static input files and persistent test assets (DWG templates, sample excels)
├── fixtures/           # Test fixture files (LISP security samples, DWG/LSP files)
├── .temp/              # Ignored local directory for manual temp files (configured in gitignore)
└── test_*.py           # Python test suites (e.g., test_config.py, test_excel_sync.py)
```

- **No test resources in the root**: Do not place mock data, output logs, or test-specific environment files in the project root directory.
- **Shared fixtures**: Put shared test data inside `tests/test_data/` instead of polluting the workspace root.

---

## 2. Temporary Resource & Lifecycle Management

Tests that perform file write operations must clean up after themselves. Persistent test clutter is not allowed.

### Rule 1: Use Python's standard `tempfile` module or pytest fixtures
Always create temporary files or directories using `tempfile` or the pytest `tmp_path` fixture.

*Example (pytest tmp_path):*
```python
def test_temp_file_creation(tmp_path):
    temp_file = tmp_path / "output.dwg"
    temp_file.write_text("dummy data")
    assert temp_file.exists()
    # pytest automatically cleans up tmp_path directories after execution
```

*Example (tempfile context manager / yield):*
```python
import tempfile
import pytest
import os

@pytest.fixture
def temp_workspace():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    # Cleanup guarantee
    try:
        for root, dirs, files in os.walk(temp_dir, topdown=False):
            for name in files:
                os.remove(os.path.join(root, name))
            for name in dirs:
                os.rmdir(os.path.join(root, name))
        os.rmdir(temp_dir)
    except Exception:
        pass
```

### Rule 2: Exception-safe Cleanup
Ensure that cleanup runs even if assertions fail or exceptions are raised. Wrap cleanups in `finally` blocks or handle them via pytest fixtures using `yield`.

---

## 3. Environment Variables & Configurations

### Rule 3: Maintain isolated environment files
- Never commit active `.env` or `test.env` files with real keys.
- Use `test.env` (which is gitignored) for local customization.
- Provide examples using `.env.sample` at the root.

---

## 4. Execution & Artifact Preservation

- **Logs**: Do not commit log files (`*.log`) generated during test runs. These are globally ignored under `.gitignore`.
- **Temp files**: Any temporary DWG drawings, CAD output tables, or XML files generated during a test must be targeted to a temporary directory or to the gitignored `tests/.temp/` folder.
