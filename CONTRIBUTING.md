# Contributing to ai-pipeline-orchestrator

## Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to automate changelog generation and semantic versioning.

### Commit Message Format

Each commit message consists of a **type**, optional **scope**, and **subject**:

```
<type>(<scope>): <subject>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (formatting, semicolons, etc)
- **refactor**: Code refactoring (neither fixes a bug nor adds a feature)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks (dependencies, build config, etc)
- **ci**: CI/CD configuration changes
- **build**: Build system or external dependency changes

### Examples

```bash
# Adding a new feature
git commit -m "feat(intent): add support for multi-language classification"

# Fixing a bug
git commit -m "fix(streaming): resolve token counting issue with Ollama"

# Documentation update
git commit -m "docs(readme): add Ollama setup instructions"

# Breaking change (adds BREAKING CHANGE footer)
git commit -m "feat(handlers)!: change handler signature to async

BREAKING CHANGE: All handlers must now return Promises"

# Chore task
git commit -m "chore(deps): upgrade ai-sdk to v6.1.0"
```

### Scopes

Common scopes:
- `core` - orchestration pipeline
- `intent` - intent classification
- `context` - context optimization
- `handlers` - handler functions
- `providers` - AI provider integration
- `examples` - example code
- `deps` - dependencies
- `ci` - CI/CD

### Commit Linting

Commits are automatically validated using commitlint. Invalid commits will be rejected.

### Changelog Generation

The CHANGELOG is auto-generated from commits:

```bash
# Generate changelog for new commits since last release
npm run changelog

# Regenerate entire changelog
npm run changelog:init
```

The changelog is automatically updated during the publish process.
