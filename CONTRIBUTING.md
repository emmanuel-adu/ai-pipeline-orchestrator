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

## Release Process

This project uses [release-please](https://github.com/googleapis/release-please) to automate versioning, changelog generation, and releases.

### How It Works

1. **Make changes and commit** using conventional commit format
2. **Merge to main** - release-please watches for conventional commits
3. **Release PR is auto-created** - includes version bump and CHANGELOG updates
4. **Review and merge the Release PR** - triggers automated release and npm publish

### Version Bumping

Release-please automatically determines version bumps based on commit types:

- `feat:` → **Minor version** (0.1.0 → 0.2.0)
- `fix:` → **Patch version** (0.1.0 → 0.1.1)
- `feat!:` or `BREAKING CHANGE:` → **Major version** (0.1.0 → 1.0.0)
- `docs:`, `chore:`, `style:`, etc. → No version bump

### What Happens Automatically

When you merge a Release PR:

1. ✅ Version in `package.json` is updated
2. ✅ `CHANGELOG.md` is updated with grouped changes
3. ✅ Git tag is created (e.g., `v0.2.0`)
4. ✅ GitHub release is published
5. ✅ Package is published to npm

### Manual Changelog (Optional)

For local development or testing, you can manually generate changelog entries:

```bash
# Generate changelog for new commits since last release
npm run changelog

# Regenerate entire changelog
npm run changelog:init
```

**Note:** Manual changelog updates are not needed for releases - release-please handles this automatically.
