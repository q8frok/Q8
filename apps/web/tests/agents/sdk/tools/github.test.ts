/**
 * Tests for GitHub Direct API Tools
 * TDD tests for GitHub repository, issue, and PR operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock data
const mockRepoData = {
  id: 12345,
  name: 'test-repo',
  full_name: 'test-owner/test-repo',
  description: 'A test repository',
  private: false,
  html_url: 'https://github.com/test-owner/test-repo',
  clone_url: 'https://github.com/test-owner/test-repo.git',
  default_branch: 'main',
  stargazers_count: 100,
  forks_count: 25,
  open_issues_count: 10,
  language: 'TypeScript',
  owner: {
    login: 'test-owner',
    id: 1,
    avatar_url: 'https://avatars.githubusercontent.com/u/1',
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
  pushed_at: '2024-06-15T00:00:00Z',
};

const mockIssueData = {
  id: 1001,
  number: 42,
  title: 'Test Issue',
  body: 'This is a test issue',
  state: 'open',
  html_url: 'https://github.com/test-owner/test-repo/issues/42',
  user: {
    login: 'test-user',
    id: 2,
    avatar_url: 'https://avatars.githubusercontent.com/u/2',
  },
  labels: [{ id: 1, name: 'bug', color: 'ff0000' }],
  assignees: [{ login: 'assignee1', id: 3 }],
  created_at: '2024-05-01T00:00:00Z',
  updated_at: '2024-05-15T00:00:00Z',
  comments: 5,
};

const mockPRData = {
  id: 2001,
  number: 99,
  title: 'Test Pull Request',
  body: 'This is a test PR',
  state: 'open',
  html_url: 'https://github.com/test-owner/test-repo/pull/99',
  user: {
    login: 'test-user',
    id: 2,
    avatar_url: 'https://avatars.githubusercontent.com/u/2',
  },
  head: {
    ref: 'feature-branch',
    sha: 'abc123',
  },
  base: {
    ref: 'main',
    sha: 'def456',
  },
  draft: false,
  merged: false,
  merged_at: null,
  mergeable: true,
  additions: 100,
  deletions: 50,
  changed_files: 5,
  created_at: '2024-05-01T00:00:00Z',
  updated_at: '2024-05-15T00:00:00Z',
};

const mockSearchCodeResult = {
  total_count: 25,
  incomplete_results: false,
  items: [
    {
      name: 'test.ts',
      path: 'src/test.ts',
      sha: 'xyz789',
      html_url: 'https://github.com/test-owner/test-repo/blob/main/src/test.ts',
      repository: {
        id: 12345,
        name: 'test-repo',
        full_name: 'test-owner/test-repo',
      },
    },
  ],
};

// Create mock functions that will be reused
const mockFns = {
  listForAuthenticatedUser: vi.fn(),
  reposGet: vi.fn(),
  issuesListForRepo: vi.fn(),
  issuesCreate: vi.fn(),
  pullsList: vi.fn(),
  pullsGet: vi.fn(),
  pullsCreate: vi.fn(),
  searchCode: vi.fn(),
};

// Mock the Octokit module
vi.mock('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    repos = {
      listForAuthenticatedUser: mockFns.listForAuthenticatedUser,
      get: mockFns.reposGet,
    };
    issues = {
      listForRepo: mockFns.issuesListForRepo,
      create: mockFns.issuesCreate,
    };
    pulls = {
      list: mockFns.pullsList,
      get: mockFns.pullsGet,
      create: mockFns.pullsCreate,
    };
    search = {
      code: mockFns.searchCode,
    };
  },
}));

// Import after mock
import {
  githubListRepos,
  githubGetRepo,
  githubListIssues,
  githubCreateIssue,
  githubListPRs,
  githubGetPR,
  githubCreatePR,
  githubSearchCode,
  githubTools,
  clearOctokitInstance,
  type GitHubListReposResult,
  type GitHubGetRepoResult,
  type GitHubListIssuesResult,
  type GitHubCreateIssueResult,
  type GitHubListPRsResult,
  type GitHubGetPRResult,
  type GitHubCreatePRResult,
  type GitHubSearchCodeResult,
} from '@/lib/agents/sdk/tools/github';

// =============================================================================
// Type Guards
// =============================================================================

function isListReposSuccess(
  result: GitHubListReposResult
): result is GitHubListReposResult & { success: true } {
  return result.success === true;
}

function isGetRepoSuccess(
  result: GitHubGetRepoResult
): result is GitHubGetRepoResult & { success: true } {
  return result.success === true;
}

function isListIssuesSuccess(
  result: GitHubListIssuesResult
): result is GitHubListIssuesResult & { success: true } {
  return result.success === true;
}

function isCreateIssueSuccess(
  result: GitHubCreateIssueResult
): result is GitHubCreateIssueResult & { success: true } {
  return result.success === true;
}

function isListPRsSuccess(
  result: GitHubListPRsResult
): result is GitHubListPRsResult & { success: true } {
  return result.success === true;
}

function isGetPRSuccess(
  result: GitHubGetPRResult
): result is GitHubGetPRResult & { success: true } {
  return result.success === true;
}

function isCreatePRSuccess(
  result: GitHubCreatePRResult
): result is GitHubCreatePRResult & { success: true } {
  return result.success === true;
}

function isSearchCodeSuccess(
  result: GitHubSearchCodeResult
): result is GitHubSearchCodeResult & { success: true } {
  return result.success === true;
}

// =============================================================================
// github_list_repos Tests
// =============================================================================

describe('githubListRepos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOctokitInstance();
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', 'test-github-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lists repositories successfully', async () => {
    mockFns.listForAuthenticatedUser.mockResolvedValueOnce({
      data: [mockRepoData],
    });

    const result = await githubListRepos({});

    expect(result.success).toBe(true);
    if (isListReposSuccess(result)) {
      expect(result.repos).toHaveLength(1);
      expect(result.repos[0]!.name).toBe('test-repo');
      expect(result.repos[0]!.fullName).toBe('test-owner/test-repo');
    }
  });

  it('uses pagination parameters', async () => {
    mockFns.listForAuthenticatedUser.mockResolvedValueOnce({
      data: [mockRepoData],
    });

    await githubListRepos({ perPage: 50, page: 2 });

    expect(mockFns.listForAuthenticatedUser).toHaveBeenCalledWith({
      per_page: 50,
      page: 2,
      sort: 'updated',
      direction: 'desc',
    });
  });

  it('uses default pagination when not specified', async () => {
    mockFns.listForAuthenticatedUser.mockResolvedValueOnce({
      data: [mockRepoData],
    });

    await githubListRepos({});

    expect(mockFns.listForAuthenticatedUser).toHaveBeenCalledWith({
      per_page: 30,
      page: 1,
      sort: 'updated',
      direction: 'desc',
    });
  });

  it('filters by type (owner)', async () => {
    mockFns.listForAuthenticatedUser.mockResolvedValueOnce({
      data: [mockRepoData],
    });

    await githubListRepos({ type: 'owner' });

    expect(mockFns.listForAuthenticatedUser).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'owner' })
    );
  });

  it('returns error when token is missing', async () => {
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', '');

    const result = await githubListRepos({});

    expect(result.success).toBe(false);
    if (!isListReposSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });

  it('returns error on API failure', async () => {
    mockFns.listForAuthenticatedUser.mockRejectedValueOnce(
      new Error('API error: 403 Forbidden')
    );

    const result = await githubListRepos({});

    expect(result.success).toBe(false);
  });
});

// =============================================================================
// github_get_repo Tests
// =============================================================================

describe('githubGetRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOctokitInstance();
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', 'test-github-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('gets repository details successfully', async () => {
    mockFns.reposGet.mockResolvedValueOnce({
      data: mockRepoData,
    });

    const result = await githubGetRepo({ owner: 'test-owner', repo: 'test-repo' });

    expect(result.success).toBe(true);
    if (isGetRepoSuccess(result)) {
      expect(result.repo.name).toBe('test-repo');
      expect(result.repo.fullName).toBe('test-owner/test-repo');
      expect(result.repo.description).toBe('A test repository');
      expect(result.repo.stars).toBe(100);
      expect(result.repo.language).toBe('TypeScript');
    }
  });

  it('calls API with correct parameters', async () => {
    mockFns.reposGet.mockResolvedValueOnce({
      data: mockRepoData,
    });

    await githubGetRepo({ owner: 'octocat', repo: 'hello-world' });

    expect(mockFns.reposGet).toHaveBeenCalledWith({
      owner: 'octocat',
      repo: 'hello-world',
    });
  });

  it('returns error when repository not found', async () => {
    mockFns.reposGet.mockRejectedValueOnce(new Error('API error: 404 Not Found'));

    const result = await githubGetRepo({ owner: 'test-owner', repo: 'nonexistent' });

    expect(result.success).toBe(false);
    if (!isGetRepoSuccess(result)) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns error when token is missing', async () => {
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', '');

    const result = await githubGetRepo({ owner: 'test', repo: 'test' });

    expect(result.success).toBe(false);
    if (!isGetRepoSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });
});

// =============================================================================
// github_list_issues Tests
// =============================================================================

describe('githubListIssues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOctokitInstance();
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', 'test-github-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lists issues successfully', async () => {
    mockFns.issuesListForRepo.mockResolvedValueOnce({
      data: [mockIssueData],
    });

    const result = await githubListIssues({ owner: 'test-owner', repo: 'test-repo' });

    expect(result.success).toBe(true);
    if (isListIssuesSuccess(result)) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.number).toBe(42);
      expect(result.issues[0]!.title).toBe('Test Issue');
      expect(result.issues[0]!.state).toBe('open');
    }
  });

  it('filters by state', async () => {
    mockFns.issuesListForRepo.mockResolvedValueOnce({
      data: [mockIssueData],
    });

    await githubListIssues({ owner: 'test-owner', repo: 'test-repo', state: 'closed' });

    expect(mockFns.issuesListForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'closed' })
    );
  });

  it('filters by labels', async () => {
    mockFns.issuesListForRepo.mockResolvedValueOnce({
      data: [mockIssueData],
    });

    await githubListIssues({
      owner: 'test-owner',
      repo: 'test-repo',
      labels: ['bug', 'priority'],
    });

    expect(mockFns.issuesListForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ labels: 'bug,priority' })
    );
  });

  it('uses pagination parameters', async () => {
    mockFns.issuesListForRepo.mockResolvedValueOnce({
      data: [mockIssueData],
    });

    await githubListIssues({
      owner: 'test-owner',
      repo: 'test-repo',
      perPage: 50,
      page: 3,
    });

    expect(mockFns.issuesListForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ per_page: 50, page: 3 })
    );
  });

  it('returns error when token is missing', async () => {
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', '');

    const result = await githubListIssues({ owner: 'test', repo: 'test' });

    expect(result.success).toBe(false);
    if (!isListIssuesSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });

  it('returns error on API failure', async () => {
    mockFns.issuesListForRepo.mockRejectedValueOnce(
      new Error('API error: 500 Internal Server Error')
    );

    const result = await githubListIssues({ owner: 'test-owner', repo: 'test-repo' });

    expect(result.success).toBe(false);
  });
});

// =============================================================================
// github_create_issue Tests
// =============================================================================

describe('githubCreateIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOctokitInstance();
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', 'test-github-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates issue successfully', async () => {
    mockFns.issuesCreate.mockResolvedValueOnce({
      data: mockIssueData,
    });

    const result = await githubCreateIssue({
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Issue',
      body: 'This is a test issue',
    });

    expect(result.success).toBe(true);
    if (isCreateIssueSuccess(result)) {
      expect(result.issue.number).toBe(42);
      expect(result.issue.title).toBe('Test Issue');
      expect(result.issue.url).toBe('https://github.com/test-owner/test-repo/issues/42');
    }
  });

  it('creates issue with labels', async () => {
    mockFns.issuesCreate.mockResolvedValueOnce({
      data: mockIssueData,
    });

    await githubCreateIssue({
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Bug Report',
      body: 'Found a bug',
      labels: ['bug', 'high-priority'],
    });

    expect(mockFns.issuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ['bug', 'high-priority'] })
    );
  });

  it('creates issue with assignees', async () => {
    mockFns.issuesCreate.mockResolvedValueOnce({
      data: mockIssueData,
    });

    await githubCreateIssue({
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Task',
      body: 'Do something',
      assignees: ['user1', 'user2'],
    });

    expect(mockFns.issuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ assignees: ['user1', 'user2'] })
    );
  });

  it('returns error when token is missing', async () => {
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', '');

    const result = await githubCreateIssue({
      owner: 'test',
      repo: 'test',
      title: 'Test',
    });

    expect(result.success).toBe(false);
    if (!isCreateIssueSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });

  it('returns error on API failure', async () => {
    mockFns.issuesCreate.mockRejectedValueOnce(
      new Error('API error: 422 Validation Failed')
    );

    const result = await githubCreateIssue({
      owner: 'test-owner',
      repo: 'test-repo',
      title: '',
    });

    expect(result.success).toBe(false);
  });
});

// =============================================================================
// github_list_prs Tests
// =============================================================================

describe('githubListPRs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOctokitInstance();
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', 'test-github-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lists pull requests successfully', async () => {
    mockFns.pullsList.mockResolvedValueOnce({
      data: [mockPRData],
    });

    const result = await githubListPRs({ owner: 'test-owner', repo: 'test-repo' });

    expect(result.success).toBe(true);
    if (isListPRsSuccess(result)) {
      expect(result.pullRequests).toHaveLength(1);
      expect(result.pullRequests[0]!.number).toBe(99);
      expect(result.pullRequests[0]!.title).toBe('Test Pull Request');
      expect(result.pullRequests[0]!.head).toBe('feature-branch');
      expect(result.pullRequests[0]!.base).toBe('main');
    }
  });

  it('filters by state', async () => {
    mockFns.pullsList.mockResolvedValueOnce({
      data: [mockPRData],
    });

    await githubListPRs({ owner: 'test-owner', repo: 'test-repo', state: 'closed' });

    expect(mockFns.pullsList).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'closed' })
    );
  });

  it('filters by head branch', async () => {
    mockFns.pullsList.mockResolvedValueOnce({
      data: [mockPRData],
    });

    await githubListPRs({
      owner: 'test-owner',
      repo: 'test-repo',
      head: 'user:feature-branch',
    });

    expect(mockFns.pullsList).toHaveBeenCalledWith(
      expect.objectContaining({ head: 'user:feature-branch' })
    );
  });

  it('filters by base branch', async () => {
    mockFns.pullsList.mockResolvedValueOnce({
      data: [mockPRData],
    });

    await githubListPRs({
      owner: 'test-owner',
      repo: 'test-repo',
      base: 'develop',
    });

    expect(mockFns.pullsList).toHaveBeenCalledWith(
      expect.objectContaining({ base: 'develop' })
    );
  });

  it('uses pagination parameters', async () => {
    mockFns.pullsList.mockResolvedValueOnce({
      data: [mockPRData],
    });

    await githubListPRs({
      owner: 'test-owner',
      repo: 'test-repo',
      perPage: 25,
      page: 2,
    });

    expect(mockFns.pullsList).toHaveBeenCalledWith(
      expect.objectContaining({ per_page: 25, page: 2 })
    );
  });

  it('returns error when token is missing', async () => {
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', '');

    const result = await githubListPRs({ owner: 'test', repo: 'test' });

    expect(result.success).toBe(false);
    if (!isListPRsSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });
});

// =============================================================================
// github_get_pr Tests
// =============================================================================

describe('githubGetPR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOctokitInstance();
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', 'test-github-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('gets pull request details successfully', async () => {
    mockFns.pullsGet.mockResolvedValueOnce({
      data: mockPRData,
    });

    const result = await githubGetPR({
      owner: 'test-owner',
      repo: 'test-repo',
      pullNumber: 99,
    });

    expect(result.success).toBe(true);
    if (isGetPRSuccess(result)) {
      expect(result.pullRequest.number).toBe(99);
      expect(result.pullRequest.title).toBe('Test Pull Request');
      expect(result.pullRequest.additions).toBe(100);
      expect(result.pullRequest.deletions).toBe(50);
      expect(result.pullRequest.changedFiles).toBe(5);
    }
  });

  it('calls API with correct parameters', async () => {
    mockFns.pullsGet.mockResolvedValueOnce({
      data: mockPRData,
    });

    await githubGetPR({
      owner: 'octocat',
      repo: 'hello-world',
      pullNumber: 123,
    });

    expect(mockFns.pullsGet).toHaveBeenCalledWith({
      owner: 'octocat',
      repo: 'hello-world',
      pull_number: 123,
    });
  });

  it('returns error when PR not found', async () => {
    mockFns.pullsGet.mockRejectedValueOnce(new Error('API error: 404 Not Found'));

    const result = await githubGetPR({
      owner: 'test-owner',
      repo: 'test-repo',
      pullNumber: 9999,
    });

    expect(result.success).toBe(false);
    if (!isGetPRSuccess(result)) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns error when token is missing', async () => {
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', '');

    const result = await githubGetPR({
      owner: 'test',
      repo: 'test',
      pullNumber: 1,
    });

    expect(result.success).toBe(false);
    if (!isGetPRSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });
});

// =============================================================================
// github_create_pr Tests
// =============================================================================

describe('githubCreatePR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOctokitInstance();
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', 'test-github-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates pull request successfully', async () => {
    mockFns.pullsCreate.mockResolvedValueOnce({
      data: mockPRData,
    });

    const result = await githubCreatePR({
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Test Pull Request',
      head: 'feature-branch',
      base: 'main',
    });

    expect(result.success).toBe(true);
    if (isCreatePRSuccess(result)) {
      expect(result.pullRequest.number).toBe(99);
      expect(result.pullRequest.url).toBe('https://github.com/test-owner/test-repo/pull/99');
    }
  });

  it('creates PR with body', async () => {
    mockFns.pullsCreate.mockResolvedValueOnce({
      data: mockPRData,
    });

    await githubCreatePR({
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'New Feature',
      head: 'feature',
      base: 'main',
      body: 'This PR adds a new feature',
    });

    expect(mockFns.pullsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'This PR adds a new feature' })
    );
  });

  it('creates draft PR', async () => {
    mockFns.pullsCreate.mockResolvedValueOnce({
      data: { ...mockPRData, draft: true },
    });

    await githubCreatePR({
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'WIP Feature',
      head: 'wip-feature',
      base: 'main',
      draft: true,
    });

    expect(mockFns.pullsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true })
    );
  });

  it('returns error when token is missing', async () => {
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', '');

    const result = await githubCreatePR({
      owner: 'test',
      repo: 'test',
      title: 'Test',
      head: 'feature',
      base: 'main',
    });

    expect(result.success).toBe(false);
    if (!isCreatePRSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });

  it('returns error on validation failure', async () => {
    mockFns.pullsCreate.mockRejectedValueOnce(
      new Error('API error: 422 Unprocessable Entity - No commits between main and main')
    );

    const result = await githubCreatePR({
      owner: 'test-owner',
      repo: 'test-repo',
      title: 'Bad PR',
      head: 'main',
      base: 'main',
    });

    expect(result.success).toBe(false);
  });
});

// =============================================================================
// github_search_code Tests
// =============================================================================

describe('githubSearchCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOctokitInstance();
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', 'test-github-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('searches code successfully', async () => {
    mockFns.searchCode.mockResolvedValueOnce({
      data: mockSearchCodeResult,
    });

    const result = await githubSearchCode({ query: 'useState' });

    expect(result.success).toBe(true);
    if (isSearchCodeSuccess(result)) {
      expect(result.totalCount).toBe(25);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.path).toBe('src/test.ts');
    }
  });

  it('searches within specific repository', async () => {
    mockFns.searchCode.mockResolvedValueOnce({
      data: mockSearchCodeResult,
    });

    await githubSearchCode({ query: 'function', repo: 'test-owner/test-repo' });

    expect(mockFns.searchCode).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'function repo:test-owner/test-repo' })
    );
  });

  it('filters by file extension', async () => {
    mockFns.searchCode.mockResolvedValueOnce({
      data: mockSearchCodeResult,
    });

    await githubSearchCode({ query: 'interface', extension: 'ts' });

    expect(mockFns.searchCode).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'interface extension:ts' })
    );
  });

  it('filters by filename', async () => {
    mockFns.searchCode.mockResolvedValueOnce({
      data: mockSearchCodeResult,
    });

    await githubSearchCode({ query: 'export', filename: 'index.ts' });

    expect(mockFns.searchCode).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'export filename:index.ts' })
    );
  });

  it('filters by path', async () => {
    mockFns.searchCode.mockResolvedValueOnce({
      data: mockSearchCodeResult,
    });

    await githubSearchCode({ query: 'class', path: 'src/components' });

    expect(mockFns.searchCode).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'class path:src/components' })
    );
  });

  it('combines multiple qualifiers', async () => {
    mockFns.searchCode.mockResolvedValueOnce({
      data: mockSearchCodeResult,
    });

    await githubSearchCode({
      query: 'useState',
      repo: 'owner/repo',
      extension: 'tsx',
      path: 'src',
    });

    expect(mockFns.searchCode).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'useState repo:owner/repo extension:tsx path:src',
      })
    );
  });

  it('uses pagination parameters', async () => {
    mockFns.searchCode.mockResolvedValueOnce({
      data: mockSearchCodeResult,
    });

    await githubSearchCode({ query: 'test', perPage: 50, page: 2 });

    expect(mockFns.searchCode).toHaveBeenCalledWith(
      expect.objectContaining({ per_page: 50, page: 2 })
    );
  });

  it('returns error when token is missing', async () => {
    vi.stubEnv('GITHUB_PERSONAL_ACCESS_TOKEN', '');

    const result = await githubSearchCode({ query: 'test' });

    expect(result.success).toBe(false);
    if (!isSearchCodeSuccess(result)) {
      expect(result.error.code).toBe('MISSING_CREDENTIALS');
    }
  });

  it('returns error on API failure', async () => {
    mockFns.searchCode.mockRejectedValueOnce(
      new Error('Search API error: 500 Internal Server Error')
    );

    const result = await githubSearchCode({ query: 'test' });

    expect(result.success).toBe(false);
    if (!isSearchCodeSuccess(result)) {
      expect(result.error).toBeDefined();
    }
  });
});

// =============================================================================
// Tool Definitions Tests
// =============================================================================

describe('githubTools', () => {
  it('exports an array of all GitHub tools', () => {
    expect(Array.isArray(githubTools)).toBe(true);
    expect(githubTools.length).toBe(8);
  });

  it('all tools have required properties', () => {
    for (const tool of githubTools) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('parameters');
      expect(tool).toHaveProperty('execute');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('tool names are unique', () => {
    const names = githubTools.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('includes github_list_repos tool', () => {
    const tool = githubTools.find((t) => t.name === 'github_list_repos');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('repositories');
  });

  it('includes github_get_repo tool', () => {
    const tool = githubTools.find((t) => t.name === 'github_get_repo');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('repository');
  });

  it('includes github_list_issues tool', () => {
    const tool = githubTools.find((t) => t.name === 'github_list_issues');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('issues');
  });

  it('includes github_create_issue tool', () => {
    const tool = githubTools.find((t) => t.name === 'github_create_issue');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('issue');
  });

  it('includes github_list_prs tool', () => {
    const tool = githubTools.find((t) => t.name === 'github_list_prs');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('pull request');
  });

  it('includes github_get_pr tool', () => {
    const tool = githubTools.find((t) => t.name === 'github_get_pr');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('pull request');
  });

  it('includes github_create_pr tool', () => {
    const tool = githubTools.find((t) => t.name === 'github_create_pr');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('pull request');
  });

  it('includes github_search_code tool', () => {
    const tool = githubTools.find((t) => t.name === 'github_search_code');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('Search');
  });
});
