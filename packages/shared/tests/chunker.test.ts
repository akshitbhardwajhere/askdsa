import { describe, expect, it } from "vitest";
import { chunkCode } from "../src/chunker.js";

describe("chunkCode", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkCode("src/a.ts", "")).toEqual([]);
  });

  it("preserves file path and 1-based line ranges", () => {
    const chunks = chunkCode("src/a.ts", "one\ntwo\nthree", {
      maxLines: 2,
      overlapLines: 0,
    });

    expect(chunks).toEqual([
      {
        filePath: "src/a.ts",
        content: "one\ntwo",
        startLine: 1,
        endLine: 2,
        chunkIndex: 0,
      },
      {
        filePath: "src/a.ts",
        content: "three",
        startLine: 3,
        endLine: 3,
        chunkIndex: 1,
      },
    ]);
  });

  it("applies overlap without skipping lines", () => {
    const chunks = chunkCode("a.ts", "1\n2\n3\n4\n5", {
      maxLines: 3,
      overlapLines: 1,
    });

    expect(chunks.map((chunk) => chunk.content)).toEqual([
      "1\n2\n3",
      "3\n4\n5",
    ]);
    expect(chunks.map((chunk) => [chunk.startLine, chunk.endLine])).toEqual([
      [1, 3],
      [3, 5],
    ]);
  });

  it("splits on character limit where possible", () => {
    const chunks = chunkCode("a.ts", "abc\ndef\nghi", {
      maxLines: 10,
      overlapLines: 0,
      maxCharacters: 7,
    });

    expect(chunks.map((chunk) => chunk.content)).toEqual(["abc\ndef", "ghi"]);
  });

  it("does not truncate a single line longer than the character limit", () => {
    const chunks = chunkCode("a.ts", "a".repeat(20), {
      maxLines: 5,
      overlapLines: 0,
      maxCharacters: 5,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe("a".repeat(20));
  });

  it("rejects invalid options", () => {
    expect(() =>
      chunkCode("a.ts", "x", { maxLines: 0 }),
    ).toThrow("maxLines must be a positive integer");

    expect(() =>
      chunkCode("a.ts", "x", { maxLines: 3, overlapLines: 3 }),
    ).toThrow("overlapLines must be an integer >= 0 and < maxLines");

    expect(() =>
      chunkCode("a.ts", "x", { maxCharacters: 0 }),
    ).toThrow("maxCharacters must be a positive integer");
  });

  it("rejects an empty file path", () => {
    expect(() => chunkCode("  ", "code")).toThrow(
      "filePath must not be empty",
    );
  });
});
