Contributing to libts-csrfx-auth

Thank you for your interest in contributing to libts-csrfx-auth.
This project is built with TypeScript and distributed via npm. Contributions are welcome, including bug reports, feature proposals, documentation improvements, and code enhancements.

Requirements

Node.js (LTS recommended)
Bun
npm
Git

Verify environment:

node -v
npm -v
bun -v

Getting Started

Fork the repository
Clone your fork:

git clone https://github.com/your-username/libts-csrfx-auth.git
cd libts-csrfx-auth

Install dependencies:

npm install

Create a new branch:

git checkout -b feature/your-feature-name

Development

Run in development mode

bun run dev

Build

bun run rebuilf

The compiled output should be generated in the configured output directory (commonly dist/).

Code Standards

Written in TypeScript
Strict typing required (avoid any unless justified)
Prefer functional, predictable logic
Keep modules small and composable
Avoid unnecessary external dependencies
Maintain backward compatibility unless discussed

Formatting & linting:

bun run format

All lint errors must be resolved before submitting a PR.

Testing

All new features and bug fixes must include tests.

Run tests:

bun test

Guidelines:

Unit tests for core logic
Edge case coverage required
Do not reduce existing coverage

If adding a new feature:

Add tests first (recommended)
Ensure build passes
Ensure tests pass locally

Commit Message Convention

Follow Conventional Commits:

feat: new feature
fix: bug fix
refactor: internal change
docs: documentation
test: test updates
chore: maintenance

Example:

git commit -m "feat: add deterministic seed support"

For larger changes:

git commit -m "refactor: restructure random generator core

Improve modularity and isolate seed logic.
No breaking changes introduced."

Keep commits atomic. One logical change per commit.

Pull Request Guidelines

When opening a Pull Request:

Clearly describe what changed
Explain why the change is necessary
Reference related issues if applicable
Keep PRs focused
Ensure CI passes

Checklist before submitting:

Code builds
Tests pass
Lint passes
No unused dependencies added

Versioning

This project follows Semantic Versioning:

MAJOR → breaking changes
MINOR → new features (backward compatible)
PATCH → bug fixes

Do not modify version numbers directly unless instructed.

Reporting Issues

When reporting bugs, include:

Node version
npm version
Operating system
Minimal reproduction example
Expected vs actual behavior

Clear reproduction steps significantly reduce debugging time.

Security

If you discover a security vulnerability, please report it privately instead of creating a public issue.
