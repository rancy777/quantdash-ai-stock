import type { GithubUpdateStatus } from '../types';
import { resolveScreenerApiBase } from './apiConfig';

const GITHUB_UPDATES_STATUS_ENDPOINT = `${resolveScreenerApiBase()}/github/updates/status`;
const GITHUB_UPDATES_CHECK_ENDPOINT = `${resolveScreenerApiBase()}/github/updates/check`;

const EMPTY_STATUS: GithubUpdateStatus = {
  checkedAt: null,
  currentBranch: null,
  currentCommitSha: null,
  currentCommitShort: null,
  currentVersion: null,
  defaultBranch: null,
  error: null,
  hasCommitUpdate: false,
  hasReleaseUpdate: false,
  hasUpdate: false,
  latestCommit: null,
  latestRelease: null,
  repoFullName: 'rancy777/quantdash-ai-stock',
  repoUrl: 'https://github.com/rancy777/quantdash-ai-stock',
  source: 'none',
};

const readJsonOrThrow = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const loadGithubUpdateStatus = async (): Promise<GithubUpdateStatus> => {
  try {
    const response = await fetch(GITHUB_UPDATES_STATUS_ENDPOINT, {
      cache: 'no-store',
    });
    return await readJsonOrThrow<GithubUpdateStatus>(response);
  } catch {
    return EMPTY_STATUS;
  }
};

export const checkGithubUpdates = async (): Promise<GithubUpdateStatus> => {
  const response = await fetch(GITHUB_UPDATES_CHECK_ENDPOINT, {
    method: 'POST',
  });
  return readJsonOrThrow<GithubUpdateStatus>(response);
};

export const warmGithubUpdateCheck = async (): Promise<void> => {
  try {
    await checkGithubUpdates();
  } catch {
    // App startup warm-up should never interrupt UI.
  }
};

export const getEmptyGithubUpdateStatus = (): GithubUpdateStatus => EMPTY_STATUS;
