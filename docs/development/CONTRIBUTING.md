# Contributing to Probe-Adjust

Thank you for your interest in contributing to the probe-adjust project! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- [List specific prerequisites]
- Git for version control
- [Your development environment requirements]

### Development Setup

1. **Fork the repository**
   ```bash
   git clone https://github.com/your-username/probe-adjust.git
   cd probe-adjust
   ```

2. **Set up development environment**
   ```bash
   # Install dependencies
   pip install -r requirements-dev.txt
   
   # Set up pre-commit hooks
   pre-commit install
   ```

3. **Run tests to verify setup**
   ```bash
   python -m pytest src/tests/
   ```

## 📝 Development Workflow

### Branch Naming Convention

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Making Changes

1. **Create a new branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the coding standards outlined below
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   # Run tests
   python -m pytest src/tests/
   
   # Check code formatting
   black --check src/
   isort --check-only src/
   
   # Type checking (if using mypy)
   mypy src/
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add descriptive commit message"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## 📋 Coding Standards

### Python Code Style

- Follow PEP 8 guidelines
- Use Black for code formatting
- Use isort for import sorting
- Maximum line length: 88 characters

### Documentation

- Write docstrings for all public functions and classes
- Use Google-style docstrings
- Update README files when adding new features
- Include code examples in documentation

### Testing

- Write unit tests for all new functions
- Aim for >80% test coverage
- Use descriptive test names
- Include integration tests for major features

### Example Code Style

```python
def process_probe_data(
    data: List[Dict[str, Any]], 
    threshold: float = 0.8
) -> ProcessedData:
    """
    Process probe data with the given threshold.
    
    Args:
        data: List of probe data dictionaries
        threshold: Processing threshold (default: 0.8)
        
    Returns:
        ProcessedData object containing results
        
    Raises:
        ValueError: If data is empty or invalid
    """
    if not data:
        raise ValueError("Data cannot be empty")
    
    # Process data here
    return ProcessedData(results)
```

## 🧪 Testing Guidelines

### Writing Tests

```python
import pytest
from src.core.probe_engine import ProbeEngine

def test_probe_engine_initialization():
    """Test that ProbeEngine initializes correctly."""
    engine = ProbeEngine(config={'threshold': 0.5})
    assert engine.threshold == 0.5

def test_probe_engine_process_data():
    """Test data processing functionality."""
    engine = ProbeEngine()
    result = engine.process([{'value': 1.0}])
    assert result is not None
```

### Running Tests

```bash
# Run all tests
python -m pytest

# Run with coverage
python -m pytest --cov=src

# Run specific test file
python -m pytest src/tests/test_probe_engine.py

# Run tests with verbose output
python -m pytest -v
```

## 📚 Documentation Updates

When making changes that affect documentation:

1. Update relevant README files
2. Update API documentation if applicable
3. Add examples for new features
4. Update architecture diagrams if needed

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Bug description** - Clear description of the issue
2. **Steps to reproduce** - How to reproduce the bug
3. **Expected behavior** - What should happen
4. **Actual behavior** - What actually happens
5. **Environment details** - OS, Python version, etc.

## 💡 Feature Requests

For new features:

1. **Use case** - Why is this feature needed?
2. **Proposed solution** - How should it work?
3. **Alternatives considered** - Other approaches you've considered

## 📋 Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style guidelines
- [ ] Tests pass (`python -m pytest`)
- [ ] New code has appropriate test coverage
- [ ] Documentation has been updated
- [ ] Commit messages are descriptive
- [ ] PR description explains the changes

## 🏷️ Release Process

The project follows semantic versioning:

- **Major** (X.0.0) - Breaking changes
- **Minor** (1.X.0) - New features, backward compatible
- **Patch** (1.0.X) - Bug fixes, backward compatible

## 📞 Getting Help

- **Documentation**: Check the [docs](../README.md) directory
- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Use GitHub discussions for questions

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to probe-adjust! 🎉