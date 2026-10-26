import type { GitHubTreeEntry } from "./client.js";

export interface SourceFileOptions {
  maxFiles?: number;
  maxFileBytes?: number;
}

export interface SourceFile {
  path: string;
  sha: string;
  size: number;
}

const DEFAULT_MAX_FILES = 5_000;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".java", ".go", ".rs", ".c", ".h",
  ".cpp", ".hpp", ".cc", ".hh", ".cs", ".php",
  ".rb", ".swift", ".kt", ".kts", ".scala",
  ".sql", ".json", ".md", ".mdx", ".html",
  ".css", ".scss", ".sh", ".yaml", ".yml",
  ".toml", ".xml", ".vue", ".svelte",
]);

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  "__generated__",
  "generated",
  "target",
]);

const EXCLUDED_FILENAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "cargo.lock",
  "poetry.lock",
  "composer.lock",
  "gemfile.lock",
]);

function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

function isSafeSourcePath(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    return false;
  }

  const segments = path.split("/");

  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

function isExcludedPath(path: string): boolean {
  const segments = path.split("/");
  const filename = segments[segments.length - 1]?.toLowerCase();

  if (!filename || EXCLUDED_FILENAMES.has(filename)) return true;

  if (
    segments.some((segment) =>
      EXCLUDED_DIRECTORIES.has(segment.toLowerCase()),
    )
  ) {
    return true;
  }

  if (
    filename.endsWith(".min.js") ||
    filename.endsWith(".min.css") ||
    filename.endsWith(".map") ||
    filename.endsWith(".d.ts.map")
  ) {
    return true;
  }

  return false;
}

export function selectSourceFiles(
  entries: GitHubTreeEntry[],
  options: SourceFileOptions = {},
): SourceFile[] {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;

  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1) {
    throw new Error("maxFiles must be a positive integer");
  }

  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1) {
    throw new Error("maxFileBytes must be a positive integer");
  }

  const selected: SourceFile[] = [];

  for (const entry of entries) {
    if (entry.type !== "blob") continue;
    if (!isSafeSourcePath(entry.path)) continue;
    if (!/^[a-f0-9]{40}$/i.test(entry.sha)) continue;
    if (
      entry.size === undefined ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      entry.size > maxFileBytes
    ) {
      continue;
    }
    if (isExcludedPath(entry.path)) continue;
    if (!ALLOWED_EXTENSIONS.has(extensionOf(entry.path))) continue;

    selected.push({
      path: entry.path,
      sha: entry.sha,
      size: entry.size,
    });

    if (selected.length >= maxFiles) break;
  }

  return selected;
}
