export interface GitHubRepository {
  owner: string;
  repo: string;
  canonicalUrl: string;
}

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

export function parseGitHubRepositoryUrl(input: string): GitHubRepository {
  if (input.length === 0 || input.length > 2048 || input.trim() !== input) {
    throw new Error("Invalid GitHub repository URL");
  }

  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid GitHub repository URL");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("Only HTTPS GitHub repository URLs are supported");
  }

  // Require exactly /owner/repository, optionally followed by / or .git.
  const match = /^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url.pathname);
  if (!match) {
    throw new Error("URL must identify a GitHub repository");
  }

  const owner = match[1];
  const repo = match[2];

  if (
    !owner ||
    !repo ||
    !OWNER_PATTERN.test(owner) ||
    !REPO_PATTERN.test(repo) ||
    repo === "." ||
    repo === ".."
  ) {
    throw new Error("Invalid GitHub owner or repository name");
  }

  return {
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  };
}
