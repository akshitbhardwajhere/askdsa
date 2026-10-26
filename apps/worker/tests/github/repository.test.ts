
import { afterEach, describe, expect, it, vi } from "vitest";

const { getRepositoryMock } = vi.hoisted(() => ({
  getRepositoryMock: vi.fn(),
}));

vi.mock("../../src/github/client.js", () => ({
  createGitHubClient: () => ({
    getRepository: getRepositoryMock,
  }),
}));

import { fetchGitHubRepository } from "../../src/github/repository.js";

describe("fetchGitHubRepository", () => {
  afterEach(() => {
    getRepositoryMock.mockReset();
  });

  it("parses the URL and returns repository metadata", async () => {
    const metadata = {
      owner: "facebook",
      name: "react",
      defaultBranch: "main",
      private: false,
      archived: false,
    };

    getRepositoryMock.mockResolvedValue(metadata);

    await expect(
      fetchGitHubRepository("https://github.com/facebook/react"),
    ).resolves.toEqual(metadata);

    expect(getRepositoryMock).toHaveBeenCalledOnce();
    expect(getRepositoryMock).toHaveBeenCalledWith("facebook", "react");
  });

  it("rejects an invalid URL without calling the API client", async () => {
    await expect(
      fetchGitHubRepository("https://example.com/owner/repo"),
    ).rejects.toThrow();

    expect(getRepositoryMock).not.toHaveBeenCalled();
  });
});
