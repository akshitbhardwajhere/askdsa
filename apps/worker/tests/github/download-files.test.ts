import { describe, expect, it, vi } from "vitest";
import type { GitHubBlob } from "../../src/github/client.js";
import {
  downloadSourceFiles,
  type BlobFetcher,
} from "../../src/github/download-files.js";
import type { SourceFile } from "../../src/github/source-files.js";
import { createHash } from "node:crypto";

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

function sourceFile(path: string, content: string): SourceFile {
  const bytes = Buffer.from(content, "utf8");

  return {
    path,
    sha: bytesToGitSha(bytes),
    size: bytes.byteLength,
  };
}

function bytesToGitSha(bytes: Uint8Array): string {
  return createHash("sha1")
    .update(`blob ${bytes.byteLength}\0`, "utf8")
    .update(bytes)
    .digest("hex");
}

function blob(content: string): GitHubBlob {
  const bytes = Buffer.from(content, "utf8");

  return {
    sha: bytesToGitSha(bytes),
    content: new Uint8Array(bytes),
  };
}

function fakeClient(contents: Record<string, string>): BlobFetcher {
  return {
    getBlob: vi.fn(async (_owner, _repo, sha) => {
      const content = Object.entries(contents).find(
        ([, value]) => bytesToGitSha(Buffer.from(value, "utf8")) === sha,
      )?.[1];

      if (content === undefined) {
        throw new Error("Unexpected SHA");
      }

      return blob(content);
    }),
  };
}

describe("downloadSourceFiles", () => {
  it("downloads files and preserves input order", async () => {
    const files = [
      sourceFile("a.ts", "const a = 1;"),
      sourceFile("b.ts", "const b = 2;"),
    ];
    const client = fakeClient({
      "a.ts": "const a = 1;",
      "b.ts": "const b = 2;",
    });

    const result = await downloadSourceFiles(client, "owner", "repo", files);

    expect(result.map((file) => file.path)).toEqual(["a.ts", "b.ts"]);
    expect(result.map((file) => file.content)).toEqual([
      "const a = 1;",
      "const b = 2;",
    ]);
  });

  it("rejects duplicate paths before fetching", async () => {
    const file = sourceFile("a.ts", "hello");
    const client = fakeClient({ "a.ts": "hello" });

    await expect(
      downloadSourceFiles(client, "owner", "repo", [file, file]),
    ).rejects.toThrow("Duplicate source file path");

    expect(client.getBlob).not.toHaveBeenCalled();
  });

  it("rejects files exceeding the total byte limit before fetching", async () => {
    const files = [sourceFile("a.ts", "12345"), sourceFile("b.ts", "67890")];
    const client = fakeClient({
      "a.ts": "12345",
      "b.ts": "67890",
    });

    await expect(
      downloadSourceFiles(client, "owner", "repo", files, {
        maxTotalBytes: 9,
      }),
    ).rejects.toThrow("total download size limit");

    expect(client.getBlob).not.toHaveBeenCalled();
  });

  it("rejects invalid UTF-8 content", async () => {
    const content = new Uint8Array([0xc3, 0x28]);

    const file: SourceFile = {
      path: "a.ts",
      sha: bytesToGitSha(content),
      size: content.byteLength,
    };

    const client: BlobFetcher = {
      getBlob: vi.fn(
        async (): Promise<GitHubBlob> => ({
          sha: file.sha,
          content,
        }),
      ),
    };

    await expect(
      downloadSourceFiles(client, "owner", "repo", [file]),
    ).rejects.toThrow("not valid UTF-8");
  });

  it("rejects invalid concurrency settings", async () => {
    const client = fakeClient({});

    await expect(
      downloadSourceFiles(client, "owner", "repo", [], {
        concurrency: 9,
      }),
    ).rejects.toThrow("concurrency must be between 1 and 8");
  });

  it("never exceeds the configured concurrency", async () => {
    const files = Array.from({ length: 5 }, (_, index) =>
      sourceFile(`file-${index}.ts`, `content-${index}`),
    );

    let active = 0;
    let maxActive = 0;

    const client: BlobFetcher = {
      getBlob: vi.fn(async (_owner, _repo, sha) => {
        active += 1;
        maxActive = Math.max(maxActive, active);

        try {
          const file = files.find((item) => item.sha === sha);

          if (!file) throw new Error("Unexpected SHA");

          // Yield control so simultaneous requests can overlap.
          await new Promise((resolve) => setTimeout(resolve, 5));

          return blob(`content-${files.indexOf(file)}`);
        } finally {
          active -= 1;
        }
      }),
    };

    const result = await downloadSourceFiles(client, "owner", "repo", files, {
      concurrency: 2,
    });

    expect(result).toHaveLength(5);
    expect(maxActive).toBe(2);
    expect(active).toBe(0);
  });

  it.each([
    "../secret.ts",
    "/etc/passwd.ts",
    "src/../secret.ts",
    "src//app.ts",
    "src\\app.ts",
  ])("rejects unsafe source path: %s", async (path) => {
    const file = sourceFile(path, "hello");
    const client = fakeClient({ [path]: "hello" });

    await expect(
      downloadSourceFiles(client, "owner", "repo", [file]),
    ).rejects.toThrow("Invalid source file metadata");

    expect(client.getBlob).not.toHaveBeenCalled();
  });
});
