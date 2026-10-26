
import { createGitHubClient } from "./client.js";
import { parseGitHubRepositoryUrl } from "./repository-url.js";

export async function fetchGitHubRepository(input: string) {
  const repository = parseGitHubRepositoryUrl(input);
  const client = createGitHubClient();

  return client.getRepository(repository.owner, repository.repo);
}
