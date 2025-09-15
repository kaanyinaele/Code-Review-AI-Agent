# Code-Review-AI-Agent

An AI-powered code review agent built with the Vercel AI SDK and Google Gemini. It streams constructive, actionable code review feedback for your local git changes and includes developer tools for generating Conventional Commit messages and creating Markdown documents.

## Contents
- Overview
- Features
- Requirements
- Installation
- Configuration (API keys)
- Environment variables
- Run
- How it works
- Security & safety
- Available tools
  - getFileChangesInDirectoryTool
  - generateCommitMessageTool
  - generateMarkdownFileTool
- Wire up additional tools
- Tips
- Examples
- Development

## Overview
This project uses the Vercel AI SDK to run a small agent that:
- Reads your system prompt from `prompts.ts` (a reviewer persona with clear focus areas).
- Streams text responses from the Google Gemini model.
- Can call local “tools” to read git diffs, draft commit messages, and generate Markdown files.

The default entry point is `index.ts`, which streams the agent’s response to your terminal.

## Features
- Streaming code reviews with a clear, supportive style.
- Git-aware file change inspection via `simple-git`.
- Tooling to:
  - Generate Conventional Commit messages from current changes.
  - Create Markdown files (e.g., notes, changelogs, docs) with optional front matter.
- Strict TypeScript configuration for safer development.

## Requirements
- Bun v1.2+ (project was created with Bun)
- A Google Generative AI API key for the `@ai-sdk/google` provider

## Installation
```bash
bun install
```

## Configuration (API keys)
The Google model is configured in `index.ts` via:
```ts
model: google("models/gemini-2.5-flash")
```
Provide your Google Generative AI API key via environment variable before running. The environment variable name depends on your setup and the `@ai-sdk/google` version; commonly:

```bash
# bash/zsh
export GOOGLE_API_KEY="<your-key>"
```

If your environment or library version expects a different variable name, see the `@ai-sdk/google` documentation and set the corresponding variable (e.g., `GOOGLE_GENERATIVE_AI_API_KEY`).

## Environment variables
- `GOOGLE_API_KEY` (or your environment’s expected variable for `@ai-sdk/google`). The project warns if it’s missing. Set it before running:

```bash
export GOOGLE_API_KEY="<your-key>"
```

Optional:
- `ROOT_DIR` – overrides the repository path the sample prompt asks the agent to review. Defaults to `../my-agent`.

## Run
```bash
bun run index.ts
```
The default call in `index.ts` asks the agent to review changes in the `../my-agent` directory. Adjust the prompt to point at the repository you want to review.

## How it works
- `index.ts` sets up `streamText` with:
  - Model: Google Gemini (flash) from `@ai-sdk/google`.
  - System prompt: `SYSTEM_PROMPT` from `prompts.ts`.
  - Tools: wired from `tools.ts`.
  - A simple `stopWhen(stepCountIs(10))` to keep generations focused.
- Output streams directly to stdout.

## Security & safety
- File writes are restricted: `generateMarkdownFileTool` refuses to write outside `rootDir`.
- Exclusions are broader to avoid noisy diffs: `.git/`, `node_modules/`, `dist/`, `build/`, `coverage/`, `.next/`, `.turbo/`, `out/`.
- Git operations provide clearer error messages when the target is not a repository.

## Available tools
All tools live in `tools.ts` and are created with the AI SDK’s `tool` helper.

### 1) getFileChangesInDirectoryTool
Reads the diff summary from a local git repository and returns a list of files with their patches.

Input schema:
- `rootDir` (string): Absolute or project-root path of the repository.

Example wiring in `index.ts` (already present):
```ts
import { getFileChangesInDirectoryTool } from "./tools";

const result = streamText({
  // ...
  tools: {
    getFileChangesInDirectoryTool,
  },
});
```

### 2) generateCommitMessageTool
Creates a Conventional Commit message based on current git changes.

Input schema:
- `rootDir` (string): Root of the git repository.
- `type` (enum, optional): One of `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`.
- `scope` (string, optional): Conventional Commit scope, e.g. a package or module.
- `summary` (string, optional): Subject override. If omitted, the tool derives one.
- `includeBody` (boolean, default: true): Whether to include a concise body listing files.
- `maxSubjectLength` (number, default: 72): Truncation for the subject line.

Derives sensible defaults:
- Infers `type` from the kinds of files changed (docs/tests/config/code, adds/deletes).
- Builds a subject from the changed files if not supplied.
- Optionally includes a concise bullet list of changed files grouped by kind.

To make it available to the agent, add it to `tools` in `index.ts`:
```ts
import { generateCommitMessageTool } from "./tools";

const result = streamText({
  // ...
  tools: {
    getFileChangesInDirectoryTool,
    generateCommitMessageTool,
  },
});
```

### 3) generateMarkdownFileTool
Writes a Markdown file to disk with optional front matter and sections.

Input schema:
- `rootDir` (string): Base directory to write into.
- `relativePath` (string): Path like `docs/notes.md` relative to `rootDir`.
- `title` (string, optional): H1 title to insert.
- `content` (string, optional): Freeform Markdown appended after sections.
- `sections` (array, optional): List of `{ heading: string; body?: string }`.
- `frontMatter` (object, optional): Key-value data serialized as simple YAML front matter.
- `overwrite` (boolean, default: false): If `false`, throws when the file exists.

To make it available to the agent, add it to `tools` in `index.ts`:
```ts
import { generateMarkdownFileTool } from "./tools";

const result = streamText({
  // ...
  tools: {
    getFileChangesInDirectoryTool,
    generateMarkdownFileTool,
  },
});
```

## Wire up additional tools
The sample `index.ts` already includes:
```ts
import { getFileChangesInDirectoryTool, generateCommitMessageTool, generateMarkdownFileTool } from "./tools";
```
If you remove or add tools, update the `tools` object passed to `streamText` accordingly.

## Tips
- You can set a different repository path via `ROOT_DIR`:
```bash
ROOT_DIR="/abs/path/to/repo" bun run index.ts
```
- If you need a longer or shorter response, adjust `stepCountIs(10)` in `index.ts`.

## Examples
Below are example natural-language prompts you can pass to the agent after wiring the tools in `index.ts`:

- Code review across a repo:
  - “Review the code changes in ‘./’ and provide actionable feedback per file.”
- Generate a Conventional Commit:
  - “Create a Conventional Commit for the repository at ‘./’. Use scope ‘tools’ and include a short body.”
- Create a Markdown release note:
  - “Create `docs/release-notes.md` in the current project with title ‘Release Notes’, a ‘Changes’ section summarizing today’s changes, and overwrite if it exists.”

Tip: When a tool needs parameters (like `rootDir`), include them clearly in the prompt. The agent will call the appropriate tool with those arguments.

## Development
- TypeScript is configured in `tsconfig.json` with `strict` mode.
- Libraries:
  - `ai` (Vercel AI SDK)
  - `@ai-sdk/google` for the Gemini model
  - `simple-git` for git operations
  - `zod` for input validation
- Run locally via Bun:
  ```bash
  bun run index.ts
  ```

---
If you run into issues or have suggestions, feel free to open an issue or PR.
