import fs from "node:fs/promises";
import path from "node:path";

/**
 * Resolves targetPath against rootDir and ensures the result stays inside rootDir.
 * Throws on traversal attempts (e.g., ../ outside root).
 */
export function resolveUnderRoot(rootDir: string, targetPath: string): string {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, targetPath);
  const inside = resolved === root || resolved.startsWith(root + path.sep);
  if (!inside) {
    throw new Error(`Refusing to access path outside rootDir: ${resolved}`);
  }
  return resolved;
}

/**
 * Checks if targetPath is inside rootDir (no filesystem access).
 */
export function isPathInsideRoot(rootDir: string, targetPath: string): boolean {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, targetPath);
  return resolved === root || resolved.startsWith(root + path.sep);
}

/**
 * Ensures a directory exists (mkdir -p behavior).
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Writes a file under rootDir safely (prevents directory traversal).
 * Creates parent directories as needed.
 */
export async function writeFileUnderRoot(
  rootDir: string,
  relativePath: string,
  data: string | Uint8Array,
  options?: Parameters<typeof fs.writeFile>[2]
): Promise<string> {
  const absPath = resolveUnderRoot(rootDir, relativePath);
  await ensureDir(path.dirname(absPath));
  await fs.writeFile(absPath, data, options);
  return absPath;
}
