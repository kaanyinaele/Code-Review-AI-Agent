import { tool } from "ai";
import { simpleGit } from "simple-git";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveUnderRoot, ensureDir } from "./lib/path";

const excludeFiles = ["dist", "bun.lock", ".git", "node_modules", "build", "coverage", ".next", ".turbo", "out"];

const fileChange = z.object({
  rootDir: z.string().min(1).describe("The root directory"),
});

// Helpers
export function shouldExclude(filePath: string) {
  const p = filePath.replace(/\\/g, "/");
  return (
    excludeFiles.includes(p) ||
    p.startsWith("dist/") ||
    p.startsWith("node_modules/") ||
    p.startsWith(".git/") ||
    p.startsWith("build/") ||
    p.startsWith("coverage/") ||
    p.startsWith(".next/") ||
    p.startsWith(".turbo/") ||
    p.startsWith("out/") ||
    p === "dist" ||
    p === "node_modules" ||
    p === ".git" ||
    p === "build" ||
    p === "coverage" ||
    p === ".next" ||
    p === ".turbo" ||
    p === "out"
  );
}

export function isDocFile(filePath: string) {
  const p = filePath.toLowerCase();
  return (
    p.endsWith(".md") ||
    p.endsWith(".mdx") ||
    p.includes("docs/") ||
    path.basename(p) === "readme.md"
  );
}

export function isTestFile(filePath: string) {
  const p = filePath.toLowerCase();
  return (
    p.includes("/__tests__/") ||
    p.endsWith(".test.ts") ||
    p.endsWith(".test.tsx") ||
    p.endsWith(".spec.ts") ||
    p.endsWith(".spec.tsx") ||
    p.endsWith(".test.js") ||
    p.endsWith(".spec.js")
  );
}

export function isConfigFile(filePath: string) {
  const base = path.basename(filePath).toLowerCase();
  const configNames = new Set([
    "package.json",
    "tsconfig.json",
    "bun.lock",
    "pnpm-lock.yaml",
    "yarn.lock",
    ".eslintrc.json",
    ".eslintrc.js",
    ".prettierrc",
    ".prettierrc.json",
    ".npmrc",
    ".nvmrc",
    ".editorconfig",
    "dockerfile",
  ]);
  return (
    configNames.has(base) ||
    filePath.includes(".github/workflows/") ||
    base.endsWith(".config.js") ||
    base.endsWith(".config.ts") ||
    base.endsWith("rc")
  );
}

export function topLevelScope(files: string[]): string | undefined {
  for (const f of files) {
    const parts = f.split("/").filter(Boolean);
    if (parts.length > 1) return parts[0];
  }
  if (files.length === 1) {
    const f = files[0];
    if (!f) return undefined;
    const parts = f.split("/").filter(Boolean);
    return parts.length > 1 ? parts[0] : undefined;
  }
  return undefined;
}

export function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1).trimEnd() + "…" : str;
}

function isSubPath(childAbs: string, parentAbs: string) {
  const rel = path.relative(parentAbs, childAbs);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

type FileChange = z.infer<typeof fileChange>;

async function getFileChangesInDirectory({ rootDir }: FileChange) {
  const git = simpleGit(rootDir);
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error(`Not a git repository: ${rootDir}`);
    }

    const summary = await git.diffSummary();
    const diffs: { file: string; diff: string }[] = [];

    for (const file of summary.files) {
      if (shouldExclude(file.file)) continue;
      const diff = await git.diff(["-U0", "--", file.file]);
      diffs.push({ file: file.file, diff });
    }

    return diffs;
  } catch (err: any) {
    throw new Error(`Failed to get file changes: ${err?.message ?? String(err)}`);
  }
}

export const getFileChangesInDirectoryTool = tool({
  description: "Gets the code changes made in given directory",
  inputSchema: fileChange,
  execute: getFileChangesInDirectory,
});

// Commit message generation tool
const generateCommitMessageInput = z.object({
  rootDir: z.string().min(1).describe("The root git repository directory"),
  type: z
    .enum(["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"]) // Conventional Commit types
    .optional()
    .describe("Optional override for the Conventional Commit type"),
  scope: z.string().optional().describe("Optional scope, e.g. module or package name"),
  summary: z.string().optional().describe("Optional subject line override"),
  includeBody: z.boolean().optional().default(true),
  maxSubjectLength: z.number().int().positive().max(100).optional().default(72),
});

export type GenerateCommitMessageInput = z.infer<typeof generateCommitMessageInput>;

async function generateCommitMessage({ rootDir, type, scope, summary, includeBody = true, maxSubjectLength = 72, }: GenerateCommitMessageInput) {
  const git = simpleGit(rootDir);
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error(`Not a git repository: ${rootDir}`);
    }

    const status = await git.status();
    const diffSummary = await git.diffSummary();

    const renamed = status.renamed
      .map((r) => (typeof r === "string" ? r : r.to))
      .filter((x): x is string => !!x);

    const changedFiles: string[] = [
      ...status.created,
      ...status.modified,
      ...status.deleted,
      ...renamed,
    ].filter((f): f is string => !!f && !shouldExclude(f));

    // Derive type if not provided
    let inferredType: NonNullable<GenerateCommitMessageInput["type"]> = "refactor";
    const nonExcludedSummaryFiles = diffSummary.files
      .map((f: { file: string }) => f.file)
      .filter((f: string) => !shouldExclude(f));

    const onlyDocs = nonExcludedSummaryFiles.length > 0 && nonExcludedSummaryFiles.every(isDocFile);
    const onlyTests = nonExcludedSummaryFiles.length > 0 && nonExcludedSummaryFiles.every(isTestFile);
    const onlyConfig = nonExcludedSummaryFiles.length > 0 && nonExcludedSummaryFiles.every(isConfigFile);
    const anyAdded = status.created.some((f) => !shouldExclude(f));
    const anyDeleted = status.deleted.some((f) => !shouldExclude(f));

    if (type) {
      inferredType = type;
    } else if (onlyDocs) {
      inferredType = "docs";
    } else if (onlyTests) {
      inferredType = "test";
    } else if (onlyConfig) {
      inferredType = "chore";
    } else if (anyAdded) {
      inferredType = "feat";
    } else if (anyDeleted) {
      inferredType = "chore";
    } else {
      // Default to refactor for code-only changes without adds/deletes
      inferredType = "refactor";
    }

    // Derive scope if not provided
    const derivedScope = scope || topLevelScope(nonExcludedSummaryFiles);

    // Build subject
    let subject: string;
    if (summary) {
      subject = summary;
    } else if (changedFiles.length === 1) {
      const file = changedFiles[0]!;
      const base = path.basename(file);
      if (status.created.includes(file)) subject = `add ${base}`;
      else if (status.deleted.includes(file)) subject = `remove ${base}`;
      else if (status.modified.includes(file)) subject = `update ${base}`;
      else subject = `update ${base}`;
    } else if (changedFiles.length > 1) {
      const s = topLevelScope(nonExcludedSummaryFiles);
      if (s) subject = `update ${s} files`;
      else subject = `update ${changedFiles.length} files`;
    } else {
      subject = "update project files";
    }

    const header = `${inferredType}${derivedScope ? `(${derivedScope})` : ""}: ${truncate(subject, maxSubjectLength)}`;

    if (!includeBody) return header;

    // Build body with a concise changelist
    const lines: string[] = [];
    const showFiles = nonExcludedSummaryFiles.slice(0, 20); // cap list
    for (const f of showFiles) {
      const base = path.basename(f);
      const prefix = isDocFile(f)
        ? "docs"
        : isTestFile(f)
        ? "test"
        : isConfigFile(f)
        ? "config"
        : "code";
      lines.push(`- ${prefix}: ${f}`);
    }
    if (nonExcludedSummaryFiles.length > showFiles.length) {
      lines.push(`- …and ${nonExcludedSummaryFiles.length - showFiles.length} more file(s)`);
    }

    return [header, "", ...lines].join("\n");
  } catch (err: any) {
    throw new Error(`Failed to generate commit message: ${err?.message ?? String(err)}`);
  }
}

export const generateCommitMessageTool = tool({
  description: "Generate a Conventional Commit message from current git changes.",
  inputSchema: generateCommitMessageInput,
  execute: generateCommitMessage,
});

// Markdown file generation tool
const generateMarkdownFileInput = z.object({
  rootDir: z.string().min(1).describe("The root directory to write the file in"),
  relativePath: z
    .string()
    .min(1)
    .describe("Relative path (from rootDir) for the markdown file, e.g. docs/notes.md"),
  title: z.string().optional(),
  content: z.string().optional(),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        body: z.string().optional(),
      })
    )
    .optional(),
  frontMatter: z.record(z.string(), z.any()).optional(),
  overwrite: z.boolean().optional().default(false),
});

export type GenerateMarkdownFileInput = z.infer<typeof generateMarkdownFileInput>;

function toSimpleYaml(data: Record<string, any>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const v of value) {
        lines.push(`  - ${String(v)}`);
      }
    } else if (value && typeof value === "object") {
      lines.push(`${key}:`);
      for (const [k, v] of Object.entries(value)) {
        lines.push(`  ${k}: ${JSON.stringify(v)}`);
      }
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  return ["---", ...lines, "---"].join("\n");
}

async function generateMarkdownFile({ rootDir, relativePath, title, content, sections, frontMatter, overwrite = false, }: GenerateMarkdownFileInput) {
  const fullPath = resolveUnderRoot(rootDir, relativePath);

  await ensureDir(path.dirname(fullPath));

  const exists = await fs
    .stat(fullPath)
    .then(() => true)
    .catch(() => false);

  if (exists && !overwrite) {
    throw new Error(`File already exists at ${relativePath}. Pass overwrite=true to replace.`);
  }

  const parts: string[] = [];
  if (frontMatter && Object.keys(frontMatter).length > 0) {
    parts.push(toSimpleYaml(frontMatter));
  }
  if (title) {
    parts.push(`# ${title}`);
  }
  if (sections && sections.length > 0) {
    for (const s of sections) {
      parts.push(`\n## ${s.heading}`);
      if (s.body) parts.push(s.body);
    }
  }
  if (content) {
    parts.push(content);
  }

  const finalContent = parts.join("\n\n").trim() + "\n";
  await fs.writeFile(fullPath, finalContent, "utf8");

  return {
    path: fullPath,
    bytesWritten: Buffer.byteLength(finalContent, "utf8"),
    created: !exists,
    overwritten: exists && overwrite,
  };
}

export const generateMarkdownFileTool = tool({
  description: "Create a Markdown file with optional front matter, title, and sections.",
  inputSchema: generateMarkdownFileInput,
  execute: generateMarkdownFile,
});