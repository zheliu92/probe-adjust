# Source Code

This directory contains the main source code for the probe-adjust system.

## 📁 Structure

- **`core/`** - Core system functionality
  - Main business logic
  - System interfaces
  - Core algorithms

- **`utils/`** - Utility functions and helpers
  - Common utilities
  - Helper functions
  - Shared constants

- **`tests/`** - Test suites
  - Unit tests
  - Integration tests
  - Test utilities

## 🏗️ Code Organization

### Core Module (`core/`)

The core module contains the essential functionality:

```
core/
├── probe_engine.py      # Main probing logic
├── adjustment_controller.py  # Adjustment algorithms
├── data_processor.py    # Data processing utilities
└── interfaces.py        # System interfaces
```

### Utils Module (`utils/`)

Utility functions and shared components:

```
utils/
├── config.py           # Configuration management
├── logging.py          # Logging utilities
├── validation.py       # Input validation
└── constants.py        # System constants
```

### Tests (`tests/`)

Comprehensive test suite:

```
tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
├── fixtures/          # Test fixtures
└── conftest.py        # Pytest configuration
```

## 🧪 Testing

Run tests from the project root:

```bash
# Run all tests
python -m pytest src/tests/

# Run unit tests only
python -m pytest src/tests/unit/

# Run with coverage
python -m pytest src/tests/ --cov=src/core --cov=src/utils
```

## 📝 Coding Standards

- Follow PEP 8 style guidelines
- Use type hints for function signatures
- Write docstrings for all public functions
- Maintain test coverage above 80%

## 🔧 Development Setup

1. Install development dependencies:
   ```bash
   pip install -r requirements-dev.txt
   ```

2. Set up pre-commit hooks:
   ```bash
   pre-commit install
   ```

3. Run code formatting:
   ```bash
   black src/
   isort src/
   ```

---

*For detailed API documentation, see the [docs/api](../docs/api/) directory.*