import type { GitHubBlob } from "./client.js";
import type { SourceFile } from "./source-files.js";

export interface DownloadedSourceFile extends SourceFile {
  content: string;
}

export interface DownloadOptions {
  concurrency?: number;
  maxTotalBytes?: number;
  signal?: AbortSignal;
}

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 8;
const DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

function isSafeSourcePath(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    return false;
  }

  return path
    .split("/")
    .every(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    );
}

export interface BlobFetcher {
  getBlob(
    owner: string,
    repo: string,
    sha: string,
    signal?: AbortSignal,
  ): Promise<GitHubBlob>;
}

export async function downloadSourceFiles(
  client: BlobFetcher,
  owner: string,
  repo: string,
  files: SourceFile[],
  options: DownloadOptions = {},
): Promise<DownloadedSourceFile[]> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;

  if (
    !Number.isSafeInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > MAX_CONCURRENCY
  ) {
    throw new Error(`concurrency must be between 1 and ${MAX_CONCURRENCY}`);
  }

  if (!Number.isSafeInteger(maxTotalBytes) || maxTotalBytes < 1) {
    throw new Error("maxTotalBytes must be a positive integer");
  }

  const seenPaths = new Set<string>();
  let expectedTotalBytes = 0;

  for (const file of files) {
    if (seenPaths.has(file.path)) {
      throw new Error(`Duplicate source file path: ${file.path}`);
    }

    seenPaths.add(file.path);

    if (
      !isSafeSourcePath(file.path) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      !/^[a-f0-9]{40}$/i.test(file.sha)
    ) {
      throw new Error(`Invalid source file metadata: ${file.path}`);
    }

    expectedTotalBytes += file.size;

    if (
      !Number.isSafeInteger(expectedTotalBytes) ||
      expectedTotalBytes > maxTotalBytes
    ) {
      throw new Error("Selected files exceed the total download size limit");
    }
  }

  if (options.signal?.aborted) {
    throw (
      options.signal.reason ??
      new DOMException("Download aborted", "AbortError")
    );
  }

  const controller = new AbortController();
  const externalSignal = options.signal;

  const abortFromExternal = () => {
    controller.abort(
      externalSignal?.reason ??
        new DOMException("Download aborted", "AbortError"),
    );
  };

  externalSignal?.addEventListener("abort", abortFromExternal, {
    once: true,
  });

  const results: DownloadedSourceFile[] = new Array(files.length);
  let nextIndex = 0;
  let firstError: unknown;

  async function worker(): Promise<void> {
    while (!controller.signal.aborted) {
      const index = nextIndex++;

      if (index >= files.length) return;

      const file = files[index];

      try {
        if (!file) {
          throw new Error("Internal file queue error");
        }
        const downloaded = await client.getBlob(
          owner,
          repo,
          file.sha,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        if (downloaded.sha.toLowerCase() !== file.sha.toLowerCase()) {
          throw new Error(`Blob SHA mismatch: ${file.path}`);
        }

        if (downloaded.content.byteLength !== file.size) {
          throw new Error(`Blob size mismatch: ${file.path}`);
        }

        let content: string;

        try {
          content = new TextDecoder("utf-8", { fatal: true }).decode(
            downloaded.content,
          );
        } catch {
          throw new Error(`Source file is not valid UTF-8: ${file.path}`);
        }

        results[index] = { ...file, content };
      } catch (error) {
        if (!controller.signal.aborted) {
          firstError = error;
          controller.abort(error);
        }

        return;
      }
    }
  }

  try {
    const workers = Array.from(
      { length: Math.min(concurrency, files.length) },
      () => worker(),
    );

    const settled = await Promise.allSettled(workers);

    const rejectedWorker = settled.find(
      (result) => result.status === "rejected",
    );

    if (rejectedWorker?.status === "rejected") {
      if (firstError === undefined) {
        firstError = rejectedWorker.reason;
      }

      controller.abort(rejectedWorker.reason);
    }

    if (firstError !== undefined) {
      throw firstError;
    }

    if (controller.signal.aborted) {
      throw (
        controller.signal.reason ??
        new DOMException("Download aborted", "AbortError")
      );
    }

    return results;
  } finally {
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}
