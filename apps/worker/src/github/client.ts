import "dotenv/config";

import { createHash } from "node:crypto";

const GITHUB_API_ORIGIN = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_TREE_ENTRIES = 20_000;
const MAX_TREE_REQUESTS = 500;
const MAX_REDIRECTS = 3;
const MAX_TREE_DEPTH = 100;

export type GitHubApiErrorCode =
  | "timeout"
  | "network"
  | "rate_limit"
  | "not_found"
  | "http_error"
  | "response_too_large"
  | "tree_truncated"
  | "too_many_files"
  | "too_many_tree_requests"
  | "invalid_blob"
  | "blob_too_large"
  | "invalid_response";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly code: GitHubApiErrorCode,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export interface GitHubRepositoryMetadata {
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
  archived: boolean;
}

export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  size?: number;
  sha: string;
}

export interface GitHubRepositoryTree {
  entries: GitHubTreeEntry[];
  truncated: false;
}

export interface GitHubBlob {
  sha: string;
  content: Uint8Array;
}

export interface GitHubClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxTreeEntries?: number;
  maxBlobBytes?: number;
}

interface GitHubClient {
  getRepository(
    owner: string,
    repo: string,
    signal?: AbortSignal,
  ): Promise<GitHubRepositoryMetadata>;

  getRepositoryTree(
    owner: string,
    repo: string,
    defaultBranch: string,
    signal?: AbortSignal,
  ): Promise<GitHubRepositoryTree>;

  getBlob(
    owner: string,
    repo: string,
    sha: string,
    signal?: AbortSignal,
  ): Promise<GitHubBlob>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Request aborted", "AbortError");
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function getGitHubToken(): string | undefined {
  const token = process.env.GITHUB_TOKEN?.trim();
  return token || undefined;
}

export function calculateGitBlobSha(content: Uint8Array): string {
  const header = Buffer.from(`blob ${content.byteLength}\0`, "utf8");
  return createHash("sha1").update(header).update(content).digest("hex");
}

async function readBoundedJson(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  const contentLength = response.headers.get("content-length");

  if (contentLength !== null) {
    const declaredLength = Number(contentLength);

    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      try {
        await response.body?.cancel();
      } catch {
        // The response is already being rejected.
      }

      throw new GitHubApiError(
        "GitHub response exceeds the configured size limit",
        "response_too_large",
      );
    }
  }

  if (!response.body) {
    throw new GitHubApiError(
      "GitHub response body is missing",
      "invalid_response",
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size limit has already been exceeded.
        }

        throw new GitHubApiError(
          "GitHub response exceeds the configured size limit",
          "response_too_large",
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    totalBytes,
  );

  try {
    return JSON.parse(body.toString("utf8")) as unknown;
  } catch {
    throw new GitHubApiError(
      "GitHub returned invalid JSON",
      "invalid_response",
    );
  }
}

function getApiError(response: Response, payload: unknown): GitHubApiError {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const retryAfter = response.headers.get("retry-after");

  if (
    response.status === 429 ||
    (response.status === 403 && (remaining === "0" || retryAfter !== null))
  ) {
    return new GitHubApiError(
      "GitHub API rate limit reached",
      "rate_limit",
      response.status,
    );
  }

  if (response.status === 404) {
    return new GitHubApiError(
      "GitHub resource not found or inaccessible",
      "not_found",
      404,
    );
  }

  const message =
    isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : "GitHub API request failed";

  return new GitHubApiError(message, "http_error", response.status);
}

function validateTreeEntry(value: unknown): GitHubTreeEntry {
  if (!isRecord(value)) {
    throw new GitHubApiError(
      "GitHub returned a malformed tree entry",
      "invalid_response",
    );
  }

  const { path, mode, type, sha, size } = value;

  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path === "." ||
    path === ".." ||
    path.includes("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    typeof mode !== "string" ||
    (type !== "blob" && type !== "tree" && type !== "commit") ||
    typeof sha !== "string" ||
    !/^[a-f0-9]{40}$/i.test(sha)
  ) {
    throw new GitHubApiError(
      "GitHub returned a malformed tree entry",
      "invalid_response",
    );
  }

  if (
    size !== undefined &&
    (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0)
  ) {
    throw new GitHubApiError(
      "GitHub returned an invalid tree entry size",
      "invalid_response",
    );
  }

  return {
    path,
    mode,
    type,
    sha,
    ...(size === undefined ? {} : { size }),
  };
}

export function createGitHubClient(
  options: GitHubClientOptions = {},
): GitHubClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? MAX_RESPONSE_BYTES;
  const maxTreeEntries = options.maxTreeEntries ?? MAX_TREE_ENTRIES;
  const maxBlobBytes = options.maxBlobBytes ?? 256 * 1024;

  if (!isPositiveSafeInteger(timeoutMs)) {
    throw new Error("timeoutMs must be a positive integer");
  }

  if (!isPositiveSafeInteger(maxResponseBytes)) {
    throw new Error("maxResponseBytes must be a positive safe integer");
  }

  if (!isPositiveSafeInteger(maxTreeEntries)) {
    throw new Error("maxTreeEntries must be a positive safe integer");
  }

  if (!isPositiveSafeInteger(maxBlobBytes)) {
    throw new Error("maxBlobBytes must be a positive safe integer");
  }

  if (Math.ceil((maxBlobBytes * 4) / 3) + 16 * 1024 > 512 * 1024) {
    throw new Error(
      "maxBlobBytes is too large for the configured response limit",
    );
  }

  const token = getGitHubToken();

  async function getJson(
    path: string,
    responseLimit = maxResponseBytes,
    externalSignal?: AbortSignal,
  ): Promise<unknown> {
    const url = new URL(path, GITHUB_API_ORIGIN);

    if (url.origin !== GITHUB_API_ORIGIN || !url.pathname.startsWith("/")) {
      throw new GitHubApiError(
        "Unsupported GitHub API endpoint",
        "invalid_response",
      );
    }

    throwIfAborted(externalSignal);

    const controller = new AbortController();

    const abortFromExternal = (): void => {
      controller.abort(
        externalSignal?.reason ??
          new DOMException("Request aborted", "AbortError"),
      );
    };

    externalSignal?.addEventListener("abort", abortFromExternal, {
      once: true,
    });

    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      let currentUrl = url;
      let redirects = 0;

      while (true) {
        throwIfAborted(externalSignal);

        let response: Response;

        try {
          response = await fetchImpl(currentUrl, {
            method: "GET",
            headers: {
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "User-Agent": "AskDSA",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
            redirect: "manual",
          });
        } catch (error) {
          if (externalSignal?.aborted) {
            throw (
              externalSignal.reason ??
              new DOMException("Request aborted", "AbortError")
            );
          }

          if (timedOut || isAbortError(error)) {
            throw new GitHubApiError("GitHub request timed out", "timeout");
          }

          throw new GitHubApiError("Unable to reach GitHub API", "network");
        }

        throwIfAborted(externalSignal);

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");

          if (!location || redirects >= MAX_REDIRECTS) {
            throw new GitHubApiError(
              "GitHub returned an unsupported redirect",
              "http_error",
              response.status,
            );
          }

          let nextUrl: URL;

          try {
            nextUrl = new URL(location, currentUrl);
          } catch {
            throw new GitHubApiError(
              "GitHub returned an invalid redirect",
              "invalid_response",
            );
          }

          if (
            nextUrl.protocol !== "https:" ||
            nextUrl.origin !== GITHUB_API_ORIGIN ||
            nextUrl.username !== "" ||
            nextUrl.password !== ""
          ) {
            throw new GitHubApiError(
              "GitHub redirect target is not allowed",
              "invalid_response",
            );
          }

          currentUrl = nextUrl;
          redirects += 1;
          continue;
        }

        if (!response.ok) {
          let payload: unknown;

          try {
            payload = await readBoundedJson(
              response,
              Math.min(responseLimit, 32 * 1024),
            );
          } catch (error) {
            if (externalSignal?.aborted) {
              throw (
                externalSignal.reason ??
                new DOMException("Request aborted", "AbortError")
              );
            }

            if (timedOut) {
              throw new GitHubApiError("GitHub request timed out", "timeout");
            }

            // Error-body parsing is best-effort. HTTP status still matters.
            if (
              error instanceof GitHubApiError &&
              error.code === "response_too_large"
            ) {
              throw error;
            }

            payload = undefined;
          }

          throw getApiError(response, payload);
        }

        try {
          return await readBoundedJson(response, responseLimit);
        } catch (error) {
          if (externalSignal?.aborted) {
            throw (
              externalSignal.reason ??
              new DOMException("Request aborted", "AbortError")
            );
          }

          if (timedOut) {
            throw new GitHubApiError("GitHub request timed out", "timeout");
          }

          if (error instanceof GitHubApiError) {
            throw error;
          }

          throw new GitHubApiError("Unable to read GitHub response", "network");
        }
      }
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    }
  }

  async function getRepository(
    owner: string,
    repo: string,
    signal?: AbortSignal,
  ): Promise<GitHubRepositoryMetadata> {
    const data = await getJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      maxResponseBytes,
      signal,
    );

    if (
      !isRecord(data) ||
      !isRecord(data.owner) ||
      typeof data.owner.login !== "string" ||
      typeof data.name !== "string" ||
      typeof data.default_branch !== "string" ||
      typeof data.private !== "boolean" ||
      typeof data.archived !== "boolean"
    ) {
      throw new GitHubApiError(
        "GitHub returned an unexpected repository response",
        "invalid_response",
      );
    }

    return {
      owner: data.owner.login,
      name: data.name,
      defaultBranch: data.default_branch,
      private: data.private,
      archived: data.archived,
    };
  }

  async function getRepositoryTree(
    owner: string,
    repo: string,
    defaultBranch: string,
    signal?: AbortSignal,
  ): Promise<GitHubRepositoryTree> {
    const entries: GitHubTreeEntry[] = [];
    const treeCache = new Map<string, GitHubTreeEntry[]>();
    let treeRequests = 0;

    async function fetchTree(treeish: string): Promise<GitHubTreeEntry[]> {
      const cached = treeCache.get(treeish);
      if (cached) return cached;

      throwIfAborted(signal);

      if (treeRequests >= MAX_TREE_REQUESTS) {
        throw new GitHubApiError(
          "Repository exceeds the maximum tree request count",
          "too_many_tree_requests",
        );
      }

      treeRequests += 1;

      const data = await getJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeish)}`,
        maxResponseBytes,
        signal,
      );

      if (
        !isRecord(data) ||
        typeof data.truncated !== "boolean" ||
        !Array.isArray(data.tree)
      ) {
        throw new GitHubApiError(
          "GitHub returned an invalid repository tree",
          "invalid_response",
        );
      }

      if (data.truncated) {
        throw new GitHubApiError(
          "GitHub returned a truncated repository tree",
          "tree_truncated",
        );
      }

      const children = data.tree.map(validateTreeEntry);
      treeCache.set(treeish, children);
      return children;
    }

    async function walkTree(
      treeish: string,
      prefix: string,
      ancestors: Set<string>,
      depth: number,
    ): Promise<void> {
      throwIfAborted(signal);

      if (depth > MAX_TREE_DEPTH) {
        throw new GitHubApiError(
          "Repository exceeds the maximum tree depth",
          "too_many_files",
        );
      }

      if (ancestors.has(treeish)) {
        throw new GitHubApiError(
          "GitHub repository tree contains a cycle",
          "invalid_response",
        );
      }

      const nextAncestors = new Set(ancestors);
      nextAncestors.add(treeish);

      const children = await fetchTree(treeish);

      for (const entry of children) {
        throwIfAborted(signal);

        const fullPath = prefix ? `${prefix}/${entry.path}` : entry.path;

        entries.push({ ...entry, path: fullPath });

        if (entries.length > maxTreeEntries) {
          throw new GitHubApiError(
            "Repository exceeds the maximum tree entry count",
            "too_many_files",
          );
        }

        if (entry.type === "tree") {
          await walkTree(entry.sha, fullPath, nextAncestors, depth + 1);
        }
      }
    }

    await walkTree(defaultBranch, "", new Set(), 0);

    return { entries, truncated: false };
  }

  async function getBlob(
    owner: string,
    repo: string,
    sha: string,
    signal?: AbortSignal,
  ): Promise<GitHubBlob> {
    if (!/^[a-f0-9]{40}$/i.test(sha)) {
      throw new GitHubApiError("Invalid Git blob SHA", "invalid_blob");
    }

    const maxBlobResponseBytes = Math.ceil((maxBlobBytes * 4) / 3) + 16 * 1024;

    const data = await getJson(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(sha)}`,
      Math.min(maxBlobResponseBytes, 512 * 1024),
      signal,
    );

    if (
      !isRecord(data) ||
      typeof data.sha !== "string" ||
      typeof data.encoding !== "string" ||
      data.encoding !== "base64" ||
      typeof data.content !== "string" ||
      typeof data.size !== "number" ||
      !Number.isSafeInteger(data.size) ||
      data.size < 0
    ) {
      throw new GitHubApiError(
        "GitHub returned an invalid blob response",
        "invalid_blob",
      );
    }

    if (data.size > maxBlobBytes) {
      throw new GitHubApiError(
        "Git blob exceeds the configured size limit",
        "blob_too_large",
      );
    }

    const base64 = data.content.replace(/\s/g, "");

    if (
      base64.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        base64,
      )
    ) {
      throw new GitHubApiError(
        "GitHub returned invalid Base64 blob content",
        "invalid_blob",
      );
    }

    const content = Buffer.from(base64, "base64");

    if (content.byteLength !== data.size) {
      throw new GitHubApiError(
        "Git blob size does not match its declared size",
        "invalid_blob",
      );
    }

    if (content.byteLength > maxBlobBytes) {
      throw new GitHubApiError(
        "Git blob exceeds the configured size limit",
        "blob_too_large",
      );
    }

    const calculatedSha = calculateGitBlobSha(content);

    if (
      calculatedSha.toLowerCase() !== data.sha.toLowerCase() ||
      calculatedSha.toLowerCase() !== sha.toLowerCase()
    ) {
      throw new GitHubApiError(
        "Git blob SHA verification failed",
        "invalid_blob",
      );
    }

    return {
      sha: calculatedSha,
      content: new Uint8Array(content),
    };
  }

  return {
    getRepository,
    getRepositoryTree,
    getBlob,
  };
}
