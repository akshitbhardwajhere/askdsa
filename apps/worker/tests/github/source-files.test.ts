import { describe, expect, it } from "vitest";
import type { GitHubTreeEntry } from "../../src/github/client.js";
import { selectSourceFiles } from "../../src/github/source-files.js";

function entry(
  path: string,
  options: Partial<GitHubTreeEntry> = {},
): GitHubTreeEntry {
  return {
    path,
    mode: "100644",
    type: "blob",
    sha: "a".repeat(40),
    size: 100,
    ...options,
  };
}

describe("selectSourceFiles", () => {
  it("selects supported source and documentation files", () => {
    const result = selectSourceFiles([
      entry("src/index.ts"),
      entry("components/Button.tsx"),
      entry("scripts/check.py"),
      entry("README.md"),
      entry("package.json"),
    ]);

    expect(result.map((file) => file.path)).toEqual([
      "src/index.ts",
      "components/Button.tsx",
      "scripts/check.py",
      "README.md",
      "package.json",
    ]);
  });

  it("ignores directories and unsupported file extensions", () => {
    const result = selectSourceFiles([
      entry("src", { type: "tree" }),
      entry("image.png"),
      entry("archive.zip"),
      entry("src/app.go"),
    ]);

    expect(result.map((file) => file.path)).toEqual(["src/app.go"]);
  });

  it("excludes generated directories, lockfiles and minified files", () => {
    const result = selectSourceFiles([
      entry("node_modules/pkg/index.js"),
      entry("dist/bundle.js"),
      entry("src/generated/schema.ts"),
      entry("package-lock.json"),
      entry("assets/app.min.js"),
      entry("src/app.ts"),
    ]);

    expect(result.map((file) => file.path)).toEqual(["src/app.ts"]);
  });

  it("skips missing-size and oversized files", () => {
    const result = selectSourceFiles(
      [
        entry("src/unknown.ts", { size: undefined }),
        entry("src/large.ts", { size: 500 }),
        entry("src/small.ts", { size: 200 }),
      ],
      { maxFileBytes: 256 },
    );

    expect(result.map((file) => file.path)).toEqual(["src/small.ts"]);
  });

  it("enforces the maximum selected-file count", () => {
    const result = selectSourceFiles(
      [
        entry("a.ts"),
        entry("b.ts"),
        entry("c.ts"),
      ],
      { maxFiles: 2 },
    );

    expect(result.map((file) => file.path)).toEqual(["a.ts", "b.ts"]);
  });

  it("rejects invalid limits", () => {
    const files = [entry("src/app.ts")];

    expect(() => selectSourceFiles(files, { maxFiles: 0 })).toThrow(
      "maxFiles must be a positive integer",
    );

    expect(() => selectSourceFiles(files, { maxFileBytes: -1 })).toThrow(
      "maxFileBytes must be a positive integer",
    );
  });

  it("skips unsafe paths and invalid Git blob SHAs", () => {
    const unsafePaths = [
      "../secret.ts",
      "/etc/passwd.ts",
      "src/../secret.ts",
      "src//app.ts",
      "src\\app.ts",
    ];

    const entries = [
      ...unsafePaths.map((path) => entry(path, { sha: "a".repeat(40) })),
      entry("src/invalid-sha.ts", { sha: "not-a-valid-sha" }),
      entry("src/safe.ts", { sha: "a".repeat(40) }),
    ];

    const result = selectSourceFiles(entries);

    expect(result.map((file) => file.path)).toEqual(["src/safe.ts"]);
  });
});
