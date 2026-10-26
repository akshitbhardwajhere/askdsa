import { describe, expect, it } from "vitest";
import { parseGitHubRepositoryUrl } from "../../src/github/repository-url.js";

describe("parseGitHubRepositoryUrl", () => {
  it("parses a standard GitHub repository URL", () => {
    expect(
      parseGitHubRepositoryUrl("https://github.com/facebook/react"),
    ).toEqual({
      owner: "facebook",
      repo: "react",
      canonicalUrl: "https://github.com/facebook/react",
    });
  });

  it("accepts a trailing slash", () => {
    expect(
      parseGitHubRepositoryUrl("https://github.com/owner/project/"),
    ).toEqual({
      owner: "owner",
      repo: "project",
      canonicalUrl: "https://github.com/owner/project",
    });
  });

  it("accepts a .git suffix and normalizes the repository URL", () => {
    expect(
      parseGitHubRepositoryUrl("https://github.com/owner/repo.git"),
    ).toEqual({
      owner: "owner",
      repo: "repo",
      canonicalUrl: "https://github.com/owner/repo",
    });
  });

  it.each([
    "",
    " https://github.com/owner/repo",
    "http://github.com/owner/repo",
    "https://github.com.evil.example/owner/repo",
    "https://user:pass@github.com/owner/repo",
    "https://github.com:8443/owner/repo",
    "https://github.com/owner/repo?tab=readme",
    "https://github.com/owner/repo#readme",
    "https://github.com/owner",
    "https://github.com/owner/repo/tree/main",
    "https://github.com/owner/%2e%2e",
    "https://github.com/owner/repo/extra",
    "https://example.com/owner/repo",
  ])("rejects invalid URL: %s", (url) => {
    expect(() => parseGitHubRepositoryUrl(url)).toThrow();
  });

  it("rejects inputs longer than 2048 characters", () => {
    expect(() =>
      parseGitHubRepositoryUrl(`https://github.com/${"a".repeat(2048)}`),
    ).toThrow("Invalid GitHub repository URL");
  });
});
