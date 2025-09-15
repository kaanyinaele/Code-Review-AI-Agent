# Naming Conventions

Guiding principles
- Prefer clarity over brevity; avoid ambiguous abbreviations.
- Use American English; write names in the present/imperative.
- Consistency beats perfection; match existing code when in doubt.

Files and folders
- Folders and non-component files: kebab-case (e.g., git-utils.ts, commit-rules.md).
- Tests: same name + .test.ts|.spec.ts next to source or under __tests__/.
- Docs: docs/ with kebab-case filenames.
- Avoid deep nesting; prefer 3 levels max under src/.

Variables and constants
- Variables: camelCase.
- Booleans: is/has/should/can prefixes (e.g., isValid, hasChanges).
- Numbers/units: suffix units (timeoutMs, sizeBytes).
- Constants:
  - Module-local constants: camelCase.
  - Global or shared constants: UPPER_SNAKE_CASE.

Functions
- Names are verb-first and specific (computeDiff, generateMessage).
- Async suffix:
  - Omit Async by default (types convey Promise).
  - Use Async only when both sync and async variants exist.
- Getters returning boolean use is/has (isCleanRepo).

Types and interfaces
- Type aliases and interfaces: PascalCase (FileChange, CommitMessage).
- Do not prefix with I; prefer semantic suffixes: Params, Options, Result, Error.
- Enums: PascalCase name; members UPPER_SNAKE_CASE.

Classes
- PascalCase; methods follow function rules.

Imports and exports
- Prefer named exports; avoid default unless ergonomics demand it.
- Import order: node core -> third-party -> local, grouped and alphabetized within groups.

Commits (Conventional Commits)
- Format: type(scope): subject (imperative, lower-case, no period).
- Common types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
- Body: what/why; Footer: BREAKING CHANGE: and issue refs.

Comments and docs
- Use TSDoc for public APIs (/** ... */).
- Keep comments high-signal; avoid restating the obvious.
