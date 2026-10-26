import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createGitHubClient } from "../../src/github/client.js";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

const repositoryResponse = {
  name: "react",
  default_branch: "main",
  private: false,
  archived: false,
  owner: { login: "facebook" },
};

function createGitBlob(content: string) {
  const bytes = Buffer.from(content, "utf8");
  const sha = createHash("sha1")
    .update(`blob ${bytes.byteLength}\0`, "utf8")
    .update(bytes)
    .digest("hex");

  return {
    sha,
    size: bytes.byteLength,
    content: bytes.toString("base64"),
    encoding: "base64",
  };
}

describe("GitHub API client", () => {
  it("fetches and validates repository metadata", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(repositoryResponse));

    const client = createGitHubClient({ fetchImpl: fetchMock });
    const result = await client.getRepository("facebook", "react");

    expect(result).toEqual({
      owner: "facebook",
      name: "react",
      defaultBranch: "main",
      private: false,
      archived: false,
    });

    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.github.com/repos/facebook/react");
    expect(init?.redirect).toBe("manual");
    expect(init?.headers).toMatchObject({
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    });
  });

  it("encodes owner and repository path segments", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(repositoryResponse));
    const client = createGitHubClient({ fetchImpl: fetchMock });

    await client.getRepository("owner name", "repo/name");

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.github.com/repos/owner%20name/repo%2Fname",
    );
  });

  it("reports 404 without exposing private repository details", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 404 }));
    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getRepository("owner", "missing"),
    ).rejects.toMatchObject({
      name: "GitHubApiError",
      code: "not_found",
      status: 404,
    });
  });

  it("detects rate limiting", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 403,
        headers: { "x-ratelimit-remaining": "0" },
      }),
    );
    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(client.getRepository("owner", "repo")).rejects.toMatchObject({
      code: "rate_limit",
      status: 403,
    });
  });

  it("handles network failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network details"));
    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(client.getRepository("owner", "repo")).rejects.toMatchObject({
      code: "network",
    });
  });

  it("rejects malformed JSON", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{invalid", { status: 200 }));
    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(client.getRepository("owner", "repo")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("rejects responses larger than the configured limit", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(repositoryResponse));

    const client = createGitHubClient({
      fetchImpl: fetchMock,
      maxResponseBytes: 10,
    });

    await expect(client.getRepository("owner", "repo")).rejects.toMatchObject({
      code: "response_too_large",
    });
  });

  it("rejects an unexpected repository response shape", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ name: "repo" }));
    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(client.getRepository("owner", "repo")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("rejects invalid timeout configuration", () => {
    expect(() => createGitHubClient({ timeoutMs: 0 })).toThrow(
      "timeoutMs must be a positive integer",
    );
  });

  it("classifies timeout errors", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new DOMException("The operation timed out", "TimeoutError"),
      );

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(client.getRepository("owner", "repo")).rejects.toMatchObject({
      name: "GitHubApiError",
      code: "timeout",
    });
  });

  it("enforces the response limit while streaming", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(100)));
        controller.close();
      },
    });

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(body));

    const client = createGitHubClient({
      fetchImpl: fetchMock,
      maxResponseBytes: 10,
    });

    await expect(client.getRepository("owner", "repo")).rejects.toMatchObject({
      name: "GitHubApiError",
      code: "response_too_large",
    });
  });

  it("classifies a timeout while reading the response body", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_input, init) => {
        const signal = init?.signal;

        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            signal?.addEventListener(
              "abort",
              () =>
                controller.error(
                  new DOMException("The operation timed out", "TimeoutError"),
                ),
              { once: true },
            );
          },
        });

        return new Response(body, { status: 200 });
      });

    const client = createGitHubClient({
      fetchImpl: fetchMock,
      timeoutMs: 20,
    });

    await expect(client.getRepository("owner", "repo")).rejects.toMatchObject({
      name: "GitHubApiError",
      code: "timeout",
    });
  });

  it("follows a redirect only within the GitHub API origin", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: {
            location: "https://api.github.com/repositories/10270250",
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(repositoryResponse));

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getRepository("facebook", "react"),
    ).resolves.toMatchObject({
      owner: "facebook",
      name: "react",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      "https://api.github.com/repositories/10270250",
    );
    expect(fetchMock.mock.calls[0]![1]?.redirect).toBe("manual");
  });

  it("rejects a redirect to an external origin", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/steal" },
      }),
    );

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getRepository("facebook", "react"),
    ).rejects.toMatchObject({
      name: "GitHubApiError",
      code: "invalid_response",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fetches nested directories and reconstructs full paths", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [
            {
              path: "src",
              mode: "040000",
              type: "tree",
              sha: "a".repeat(40),
            },
            {
              path: "README.md",
              mode: "100644",
              type: "blob",
              sha: "b".repeat(40),
              size: 50,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [
            {
              path: "index.ts",
              mode: "100644",
              type: "blob",
              sha: "c".repeat(40),
              size: 120,
            },
          ],
        }),
      );

    const client = createGitHubClient({ fetchImpl: fetchMock });
    const result = await client.getRepositoryTree("facebook", "react", "main");

    expect(result.truncated).toBe(false);
    expect(result.entries).toHaveLength(3);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "src",
          type: "tree",
        }),
        expect.objectContaining({
          path: "README.md",
          type: "blob",
        }),
        expect.objectContaining({
          path: "src/index.ts",
          type: "blob",
        }),
      ]),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://api.github.com/repos/facebook/react/git/trees/main",
    );
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      `https://api.github.com/repos/facebook/react/git/trees/${"a".repeat(40)}`,
    );
  });

  it("rejects a truncated subdirectory tree", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [
            {
              path: "src",
              mode: "040000",
              type: "tree",
              sha: "a".repeat(40),
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: true,
          tree: [],
        }),
      );

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getRepositoryTree("facebook", "react", "main"),
    ).rejects.toMatchObject({ code: "tree_truncated" });
  });

  it("rejects when the combined entry limit is exceeded", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        truncated: false,
        tree: [
          {
            path: "a.ts",
            mode: "100644",
            type: "blob",
            sha: "d".repeat(40),
          },
          {
            path: "b.ts",
            mode: "100644",
            type: "blob",
            sha: "e".repeat(40),
          },
        ],
      }),
    );

    const client = createGitHubClient({
      fetchImpl: fetchMock,
      maxTreeEntries: 1,
    });

    await expect(
      client.getRepositoryTree("facebook", "react", "main"),
    ).rejects.toMatchObject({ code: "too_many_files" });
  });

  it("rejects a repository tree exceeding the maximum depth", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = String(input);
        const isRoot = url.endsWith("/git/trees/main");
        const treeNumber = isRoot ? 0 : Number(url.split("/git/trees/").at(-1));

        const nextTreeNumber = treeNumber + 1;

        return jsonResponse({
          truncated: false,
          tree: [
            {
              path: `dir${nextTreeNumber}`,
              mode: "040000",
              type: "tree",
              sha: String(nextTreeNumber).padStart(40, "0"),
            },
          ],
        });
      });

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getRepositoryTree("facebook", "react", "main"),
    ).rejects.toMatchObject({
      name: "GitHubApiError",
      code: "too_many_files",
    });
  });

  it("rejects a truncated repository tree", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ truncated: true, tree: [] }));

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getRepositoryTree("facebook", "react", "main"),
    ).rejects.toMatchObject({ code: "tree_truncated" });
  });

  it("rejects a tree exceeding the configured entry limit", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        truncated: false,
        tree: [
          {
            path: "a.ts",
            mode: "100644",
            type: "blob",
            sha: "d".repeat(40),
          },
          {
            path: "b.ts",
            mode: "100644",
            type: "blob",
            sha: "e".repeat(40),
          },
        ],
      }),
    );

    const client = createGitHubClient({
      fetchImpl: fetchMock,
      maxTreeEntries: 1,
    });

    await expect(
      client.getRepositoryTree("facebook", "react", "main"),
    ).rejects.toMatchObject({ code: "too_many_files" });
  });

  it.each([
    {
      name: "missing required fields",
      entry: { path: "index.ts", type: "blob" },
    },
    {
      name: "path containing a slash",
      entry: {
        path: "src/index.ts",
        mode: "100644",
        type: "blob",
        sha: "a".repeat(40),
      },
    },
    {
      name: "parent path segment",
      entry: {
        path: "..",
        mode: "100644",
        type: "blob",
        sha: "a".repeat(40),
      },
    },
    {
      name: "backslash in path",
      entry: {
        path: "src\\index.ts",
        mode: "100644",
        type: "blob",
        sha: "a".repeat(40),
      },
    },
    {
      name: "invalid SHA",
      entry: {
        path: "index.ts",
        mode: "100644",
        type: "blob",
        sha: "not-a-sha",
      },
    },
  ])("rejects malformed tree entries: $name", async ({ entry }) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        truncated: false,
        tree: [entry],
      }),
    );

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getRepositoryTree("facebook", "react", "main"),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("does not fetch the same tree SHA twice", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [
            { path: "one", mode: "040000", type: "tree", sha: "f".repeat(40) },
            { path: "two", mode: "040000", type: "tree", sha: "f".repeat(40) },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [
            {
              path: "index.ts",
              mode: "100644",
              type: "blob",
              sha: "1".repeat(40),
            },
          ],
        }),
      );

    const client = createGitHubClient({ fetchImpl: fetchMock });
    const result = await client.getRepositoryTree("facebook", "react", "main");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.entries.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(["one", "two", "one/index.ts", "two/index.ts"]),
    );
  });

  it("stops when the tree request limit is reached", async () => {
    let requestNumber = 0;

    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      requestNumber += 1;

      return jsonResponse({
        truncated: false,
        tree:
          requestNumber === 1
            ? Array.from({ length: 500 }, (_, index) => ({
                path: `dir${index}`,
                mode: "040000",
                type: "tree",
                sha: (index + 1).toString(16).padStart(40, "0"),
              }))
            : [],
      });
    });

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getRepositoryTree("facebook", "react", "main"),
    ).rejects.toMatchObject({ code: "too_many_tree_requests" });

    expect(fetchMock).toHaveBeenCalledTimes(500);
  });

  it("fetches a blob and verifies its Git SHA", async () => {
    const expectedContent = "export const answer = 42;\n";
    const blob = createGitBlob(expectedContent);

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(blob));

    const client = createGitHubClient({ fetchImpl: fetchMock });
    const result = await client.getBlob("facebook", "react", blob.sha);

    expect(Buffer.from(result.content).toString("utf8")).toBe(expectedContent);
    expect(result.sha).toBe(blob.sha);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `https://api.github.com/repos/facebook/react/git/blobs/${blob.sha}`,
    );
  });

  it("rejects a blob whose content does not match its Git SHA", async () => {
    const blob = createGitBlob("trusted content");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ...blob,
        content: Buffer.from("tampered content").toString("base64"),
      }),
    );

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getBlob("facebook", "react", blob.sha),
    ).rejects.toMatchObject({ code: "invalid_blob" });
  });

  it("rejects invalid Base64 blob content", async () => {
    const blob = createGitBlob("hello");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ...blob,
        content: "not-valid-base64!",
      }),
    );

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getBlob("facebook", "react", blob.sha),
    ).rejects.toMatchObject({ code: "invalid_blob" });
  });

  it("rejects a blob exceeding the configured size limit", async () => {
    const blob = createGitBlob("this file is too large");

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(blob));

    const client = createGitHubClient({
      fetchImpl: fetchMock,
      maxBlobBytes: 5,
    });

    await expect(
      client.getBlob("facebook", "react", blob.sha),
    ).rejects.toMatchObject({ code: "blob_too_large" });
  });

  it("rejects maxBlobBytes exceeding the response limit", () => {
    expect(() =>
      createGitHubClient({
        maxBlobBytes: 400 * 1024,
      }),
    ).toThrow("maxBlobBytes is too large for the configured response limit");
  });

  it("rejects a blob whose declared size differs from decoded content", async () => {
    const blob = createGitBlob("hello");

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        ...blob,
        size: blob.size + 1,
      }),
    );

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(
      client.getBlob("facebook", "react", blob.sha),
    ).rejects.toMatchObject({ code: "invalid_blob" });
  });

  it("rejects a response with a missing body", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));

    const client = createGitHubClient({ fetchImpl: fetchMock });

    await expect(client.getRepository("owner", "repo")).rejects.toMatchObject({
      name: "GitHubApiError",
      code: "invalid_response",
    });
  });
});
