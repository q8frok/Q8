/**
 * GitHub Direct API Tools
 * Direct integration with GitHub API for repository, issue, and PR operations
 * Assigned to: Coder Agent (Claude Opus 4.5)
 */

import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { createToolError, type ToolErrorResult } from '../utils/errors';
import { executeWithRetry } from '../utils/retry';
import type { ToolDefinition } from './default';

// =============================================================================
// Octokit Instance Management
// =============================================================================

let octokitInstance: Octokit | null = null;

/**
 * Clear cached Octokit instance (useful for testing)
 */
export function clearOctokitInstance(): void {
  octokitInstance = null;
}

/**
 * Get or create Octokit instance
 */
function getOctokit(): Octokit | null {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    return null;
  }

  if (!octokitInstance) {
    octokitInstance = new Octokit({
      auth: token,
    });
  }

  return octokitInstance;
}

/**
 * Check if GitHub token is configured
 */
function hasCredentials(): boolean {
  return !!process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
}

/**
 * Create a missing credentials error result
 */
function missingCredentialsError(): ToolErrorResult {
  return {
    success: false,
    message: 'GitHub credentials are not configured. Please set up your GitHub API token.',
    error: {
      code: 'MISSING_CREDENTIALS',
      recoverable: false,
      suggestion: 'Configure GITHUB_PERSONAL_ACCESS_TOKEN environment variable.',
    },
  };
}

// =============================================================================
// Types - Repository
// =============================================================================

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  url: string;
  cloneUrl: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  owner: {
    login: string;
    id: number;
    avatarUrl: string;
  };
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
}

export interface GitHubListReposSuccessResult {
  success: true;
  repos: GitHubRepository[];
}

export interface GitHubListReposErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type GitHubListReposResult = GitHubListReposSuccessResult | GitHubListReposErrorResult;

export interface GitHubGetRepoSuccessResult {
  success: true;
  repo: GitHubRepository;
}

export interface GitHubGetRepoErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type GitHubGetRepoResult = GitHubGetRepoSuccessResult | GitHubGetRepoErrorResult;

// =============================================================================
// Types - Issues
// =============================================================================

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  url: string;
  user: {
    login: string;
    id: number;
    avatarUrl: string;
  };
  labels: Array<{ id: number; name: string; color: string }>;
  assignees: Array<{ login: string; id: number }>;
  createdAt: string;
  updatedAt: string;
  comments: number;
}

export interface GitHubListIssuesSuccessResult {
  success: true;
  issues: GitHubIssue[];
}

export interface GitHubListIssuesErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type GitHubListIssuesResult = GitHubListIssuesSuccessResult | GitHubListIssuesErrorResult;

export interface GitHubCreateIssueSuccessResult {
  success: true;
  issue: {
    id: number;
    number: number;
    title: string;
    url: string;
  };
}

export interface GitHubCreateIssueErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type GitHubCreateIssueResult = GitHubCreateIssueSuccessResult | GitHubCreateIssueErrorResult;

// =============================================================================
// Types - Pull Requests
// =============================================================================

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  url: string;
  user: {
    login: string;
    id: number;
    avatarUrl: string;
  };
  head: string;
  base: string;
  headSha: string;
  baseSha: string;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubListPRsSuccessResult {
  success: true;
  pullRequests: GitHubPullRequest[];
}

export interface GitHubListPRsErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type GitHubListPRsResult = GitHubListPRsSuccessResult | GitHubListPRsErrorResult;

export interface GitHubGetPRSuccessResult {
  success: true;
  pullRequest: GitHubPullRequest;
}

export interface GitHubGetPRErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type GitHubGetPRResult = GitHubGetPRSuccessResult | GitHubGetPRErrorResult;

export interface GitHubCreatePRSuccessResult {
  success: true;
  pullRequest: {
    id: number;
    number: number;
    title: string;
    url: string;
  };
}

export interface GitHubCreatePRErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type GitHubCreatePRResult = GitHubCreatePRSuccessResult | GitHubCreatePRErrorResult;

// =============================================================================
// Types - Search
// =============================================================================

export interface GitHubSearchCodeItem {
  name: string;
  path: string;
  sha: string;
  url: string;
  repository: {
    id: number;
    name: string;
    fullName: string;
  };
}

export interface GitHubSearchCodeSuccessResult {
  success: true;
  totalCount: number;
  incompleteResults: boolean;
  items: GitHubSearchCodeItem[];
}

export interface GitHubSearchCodeErrorResult {
  success: false;
  message: string;
  error: {
    code: string;
    recoverable: boolean;
    suggestion: string;
    technical?: string;
  };
}

export type GitHubSearchCodeResult = GitHubSearchCodeSuccessResult | GitHubSearchCodeErrorResult;

// =============================================================================
// github_list_repos
// =============================================================================

const githubListReposParamsSchema = z.object({
  perPage: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(30)
    .describe('Number of results per page (default: 30, max: 100)'),
  page: z.number().min(1).optional().default(1).describe('Page number (default: 1)'),
  type: z
    .enum(['all', 'owner', 'public', 'private', 'member'])
    .optional()
    .describe('Filter by repository type'),
  sort: z
    .enum(['created', 'updated', 'pushed', 'full_name'])
    .optional()
    .default('updated')
    .describe('Sort field (default: updated)'),
  direction: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort direction (default: desc)'),
});

type GitHubListReposParamsInput = z.input<typeof githubListReposParamsSchema>;
type GitHubListReposParams = z.output<typeof githubListReposParamsSchema>;

/**
 * List repositories for the authenticated user
 */
export async function githubListRepos(
  params: GitHubListReposParamsInput
): Promise<GitHubListReposResult> {
  if (!hasCredentials()) {
    return missingCredentialsError() as GitHubListReposErrorResult;
  }

  const octokit = getOctokit();
  if (!octokit) {
    return missingCredentialsError() as GitHubListReposErrorResult;
  }

  try {
    const { perPage = 30, page = 1, type, sort = 'updated', direction = 'desc' } = params;

    const response = await executeWithRetry(
      () =>
        octokit.repos.listForAuthenticatedUser({
          per_page: perPage,
          page,
          sort,
          direction,
          ...(type && { type }),
        }),
      { maxRetries: 2 }
    );

    const repos: GitHubRepository[] = response.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      url: repo.html_url,
      cloneUrl: repo.clone_url ?? '',
      defaultBranch: repo.default_branch ?? 'main',
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      openIssues: repo.open_issues_count ?? 0,
      language: repo.language,
      owner: {
        login: repo.owner.login,
        id: repo.owner.id,
        avatarUrl: repo.owner.avatar_url,
      },
      createdAt: repo.created_at ?? '',
      updatedAt: repo.updated_at ?? '',
      pushedAt: repo.pushed_at ?? '',
    }));

    return {
      success: true,
      repos,
    };
  } catch (error) {
    const toolError = createToolError('github_list_repos', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const githubListReposDefinition: ToolDefinition<
  GitHubListReposParamsInput,
  GitHubListReposResult
> = {
  name: 'github_list_repos',
  description:
    'List repositories for the authenticated GitHub user. Supports pagination and filtering by type (all, owner, public, private, member).',
  parameters: githubListReposParamsSchema as z.ZodSchema<GitHubListReposParamsInput>,
  execute: githubListRepos as (args: GitHubListReposParamsInput) => Promise<GitHubListReposResult>,
};

// =============================================================================
// github_get_repo
// =============================================================================

const githubGetRepoParamsSchema = z.object({
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
});

type GitHubGetRepoParams = z.infer<typeof githubGetRepoParamsSchema>;

/**
 * Get details for a specific repository
 */
export async function githubGetRepo(params: GitHubGetRepoParams): Promise<GitHubGetRepoResult> {
  if (!hasCredentials()) {
    return missingCredentialsError() as GitHubGetRepoErrorResult;
  }

  const octokit = getOctokit();
  if (!octokit) {
    return missingCredentialsError() as GitHubGetRepoErrorResult;
  }

  try {
    const { owner, repo } = params;

    const response = await executeWithRetry(() => octokit.repos.get({ owner, repo }), {
      maxRetries: 2,
    });

    const repoData = response.data;

    return {
      success: true,
      repo: {
        id: repoData.id,
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        private: repoData.private,
        url: repoData.html_url,
        cloneUrl: repoData.clone_url ?? '',
        defaultBranch: repoData.default_branch ?? 'main',
        stars: repoData.stargazers_count ?? 0,
        forks: repoData.forks_count ?? 0,
        openIssues: repoData.open_issues_count ?? 0,
        language: repoData.language,
        owner: {
          login: repoData.owner.login,
          id: repoData.owner.id,
          avatarUrl: repoData.owner.avatar_url,
        },
        createdAt: repoData.created_at ?? '',
        updatedAt: repoData.updated_at ?? '',
        pushedAt: repoData.pushed_at ?? '',
      },
    };
  } catch (error) {
    const toolError = createToolError('github_get_repo', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const githubGetRepoDefinition: ToolDefinition<GitHubGetRepoParams, GitHubGetRepoResult> = {
  name: 'github_get_repo',
  description:
    'Get detailed information about a specific GitHub repository, including stats like stars, forks, and open issues.',
  parameters: githubGetRepoParamsSchema,
  execute: githubGetRepo,
};

// =============================================================================
// github_list_issues
// =============================================================================

const githubListIssuesParamsSchema = z.object({
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  state: z
    .enum(['open', 'closed', 'all'])
    .optional()
    .default('open')
    .describe('Filter by issue state (default: open)'),
  labels: z.array(z.string()).optional().describe('Filter by label names'),
  assignee: z.string().optional().describe('Filter by assignee username'),
  creator: z.string().optional().describe('Filter by issue creator username'),
  perPage: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(30)
    .describe('Number of results per page (default: 30, max: 100)'),
  page: z.number().min(1).optional().default(1).describe('Page number (default: 1)'),
});

type GitHubListIssuesParamsInput = z.input<typeof githubListIssuesParamsSchema>;

/**
 * List issues for a repository
 */
export async function githubListIssues(
  params: GitHubListIssuesParamsInput
): Promise<GitHubListIssuesResult> {
  if (!hasCredentials()) {
    return missingCredentialsError() as GitHubListIssuesErrorResult;
  }

  const octokit = getOctokit();
  if (!octokit) {
    return missingCredentialsError() as GitHubListIssuesErrorResult;
  }

  try {
    const {
      owner,
      repo,
      state = 'open',
      labels,
      assignee,
      creator,
      perPage = 30,
      page = 1,
    } = params;

    const response = await executeWithRetry(
      () =>
        octokit.issues.listForRepo({
          owner,
          repo,
          state,
          per_page: perPage,
          page,
          ...(labels && { labels: labels.join(',') }),
          ...(assignee && { assignee }),
          ...(creator && { creator }),
        }),
      { maxRetries: 2 }
    );

    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    const issues: GitHubIssue[] = response.data
      .filter((item) => !item.pull_request)
      .map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        state: issue.state,
        url: issue.html_url,
        user: {
          login: issue.user?.login ?? 'unknown',
          id: issue.user?.id ?? 0,
          avatarUrl: issue.user?.avatar_url ?? '',
        },
        labels: (issue.labels ?? [])
          .filter((label): label is { id: number; name: string; color: string } => {
            return typeof label === 'object' && label !== null && 'id' in label;
          })
          .map((label) => ({
            id: label.id ?? 0,
            name: typeof label.name === 'string' ? label.name : '',
            color: typeof label.color === 'string' ? label.color : '',
          })),
        assignees: (issue.assignees ?? []).map((a) => ({
          login: a.login,
          id: a.id,
        })),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        comments: issue.comments,
      }));

    return {
      success: true,
      issues,
    };
  } catch (error) {
    const toolError = createToolError('github_list_issues', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const githubListIssuesDefinition: ToolDefinition<
  GitHubListIssuesParamsInput,
  GitHubListIssuesResult
> = {
  name: 'github_list_issues',
  description:
    'List issues for a GitHub repository. Supports filtering by state (open, closed, all), labels, assignee, and creator.',
  parameters: githubListIssuesParamsSchema as z.ZodSchema<GitHubListIssuesParamsInput>,
  execute: githubListIssues as (args: GitHubListIssuesParamsInput) => Promise<GitHubListIssuesResult>,
};

// =============================================================================
// github_create_issue
// =============================================================================

const githubCreateIssueParamsSchema = z.object({
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  title: z.string().describe('Issue title'),
  body: z.string().optional().describe('Issue body/description'),
  labels: z.array(z.string()).optional().describe('Labels to add to the issue'),
  assignees: z.array(z.string()).optional().describe('Usernames to assign to the issue'),
  milestone: z.number().optional().describe('Milestone number to associate with the issue'),
});

type GitHubCreateIssueParams = z.infer<typeof githubCreateIssueParamsSchema>;

/**
 * Create a new issue in a repository
 */
export async function githubCreateIssue(
  params: GitHubCreateIssueParams
): Promise<GitHubCreateIssueResult> {
  if (!hasCredentials()) {
    return missingCredentialsError() as GitHubCreateIssueErrorResult;
  }

  const octokit = getOctokit();
  if (!octokit) {
    return missingCredentialsError() as GitHubCreateIssueErrorResult;
  }

  try {
    const { owner, repo, title, body, labels, assignees, milestone } = params;

    const response = await executeWithRetry(
      () =>
        octokit.issues.create({
          owner,
          repo,
          title,
          ...(body && { body }),
          ...(labels && { labels }),
          ...(assignees && { assignees }),
          ...(milestone && { milestone }),
        }),
      { maxRetries: 2 }
    );

    return {
      success: true,
      issue: {
        id: response.data.id,
        number: response.data.number,
        title: response.data.title,
        url: response.data.html_url,
      },
    };
  } catch (error) {
    const toolError = createToolError('github_create_issue', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const githubCreateIssueDefinition: ToolDefinition<
  GitHubCreateIssueParams,
  GitHubCreateIssueResult
> = {
  name: 'github_create_issue',
  description:
    'Create a new issue in a GitHub repository. Supports adding labels, assignees, and linking to a milestone.',
  parameters: githubCreateIssueParamsSchema,
  execute: githubCreateIssue,
};

// =============================================================================
// github_list_prs
// =============================================================================

const githubListPRsParamsSchema = z.object({
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  state: z
    .enum(['open', 'closed', 'all'])
    .optional()
    .default('open')
    .describe('Filter by PR state (default: open)'),
  head: z.string().optional().describe('Filter by head branch (format: user:ref-name or org:ref-name)'),
  base: z.string().optional().describe('Filter by base branch name'),
  sort: z
    .enum(['created', 'updated', 'popularity', 'long-running'])
    .optional()
    .default('created')
    .describe('Sort field (default: created)'),
  direction: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort direction (default: desc)'),
  perPage: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(30)
    .describe('Number of results per page (default: 30, max: 100)'),
  page: z.number().min(1).optional().default(1).describe('Page number (default: 1)'),
});

type GitHubListPRsParamsInput = z.input<typeof githubListPRsParamsSchema>;

/**
 * List pull requests for a repository
 */
export async function githubListPRs(params: GitHubListPRsParamsInput): Promise<GitHubListPRsResult> {
  if (!hasCredentials()) {
    return missingCredentialsError() as GitHubListPRsErrorResult;
  }

  const octokit = getOctokit();
  if (!octokit) {
    return missingCredentialsError() as GitHubListPRsErrorResult;
  }

  try {
    const {
      owner,
      repo,
      state = 'open',
      head,
      base,
      sort = 'created',
      direction = 'desc',
      perPage = 30,
      page = 1,
    } = params;

    const response = await executeWithRetry(
      () =>
        octokit.pulls.list({
          owner,
          repo,
          state,
          sort,
          direction,
          per_page: perPage,
          page,
          ...(head && { head }),
          ...(base && { base }),
        }),
      { maxRetries: 2 }
    );

    const pullRequests: GitHubPullRequest[] = response.data.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      url: pr.html_url,
      user: {
        login: pr.user?.login ?? 'unknown',
        id: pr.user?.id ?? 0,
        avatarUrl: pr.user?.avatar_url ?? '',
      },
      head: pr.head.ref,
      base: pr.base.ref,
      headSha: pr.head.sha,
      baseSha: pr.base.sha,
      draft: pr.draft ?? false,
      merged: pr.merged_at !== null,
      mergeable: null, // Not available in list endpoint
      additions: 0, // Not available in list endpoint
      deletions: 0, // Not available in list endpoint
      changedFiles: 0, // Not available in list endpoint
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    }));

    return {
      success: true,
      pullRequests,
    };
  } catch (error) {
    const toolError = createToolError('github_list_prs', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const githubListPRsDefinition: ToolDefinition<
  GitHubListPRsParamsInput,
  GitHubListPRsResult
> = {
  name: 'github_list_prs',
  description:
    'List pull requests for a GitHub repository. Supports filtering by state (open, closed, all), head branch, and base branch.',
  parameters: githubListPRsParamsSchema as z.ZodSchema<GitHubListPRsParamsInput>,
  execute: githubListPRs as (args: GitHubListPRsParamsInput) => Promise<GitHubListPRsResult>,
};

// =============================================================================
// github_get_pr
// =============================================================================

const githubGetPRParamsSchema = z.object({
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  pullNumber: z.number().describe('Pull request number'),
});

type GitHubGetPRParams = z.infer<typeof githubGetPRParamsSchema>;

/**
 * Get details for a specific pull request
 */
export async function githubGetPR(params: GitHubGetPRParams): Promise<GitHubGetPRResult> {
  if (!hasCredentials()) {
    return missingCredentialsError() as GitHubGetPRErrorResult;
  }

  const octokit = getOctokit();
  if (!octokit) {
    return missingCredentialsError() as GitHubGetPRErrorResult;
  }

  try {
    const { owner, repo, pullNumber } = params;

    const response = await executeWithRetry(
      () =>
        octokit.pulls.get({
          owner,
          repo,
          pull_number: pullNumber,
        }),
      { maxRetries: 2 }
    );

    const pr = response.data;

    return {
      success: true,
      pullRequest: {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        url: pr.html_url,
        user: {
          login: pr.user?.login ?? 'unknown',
          id: pr.user?.id ?? 0,
          avatarUrl: pr.user?.avatar_url ?? '',
        },
        head: pr.head.ref,
        base: pr.base.ref,
        headSha: pr.head.sha,
        baseSha: pr.base.sha,
        draft: pr.draft ?? false,
        merged: pr.merged,
        mergeable: pr.mergeable,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
      },
    };
  } catch (error) {
    const toolError = createToolError('github_get_pr', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const githubGetPRDefinition: ToolDefinition<GitHubGetPRParams, GitHubGetPRResult> = {
  name: 'github_get_pr',
  description:
    'Get detailed information about a specific pull request, including additions, deletions, changed files, and merge status.',
  parameters: githubGetPRParamsSchema,
  execute: githubGetPR,
};

// =============================================================================
// github_create_pr
// =============================================================================

const githubCreatePRParamsSchema = z.object({
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  title: z.string().describe('Pull request title'),
  head: z.string().describe('The branch containing changes (source branch)'),
  base: z.string().describe('The branch to merge into (target branch)'),
  body: z.string().optional().describe('Pull request description'),
  draft: z.boolean().optional().default(false).describe('Create as draft PR (default: false)'),
  maintainerCanModify: z
    .boolean()
    .optional()
    .default(true)
    .describe('Allow maintainers to modify the PR (default: true)'),
});

type GitHubCreatePRParamsInput = z.input<typeof githubCreatePRParamsSchema>;

/**
 * Create a new pull request
 */
export async function githubCreatePR(
  params: GitHubCreatePRParamsInput
): Promise<GitHubCreatePRResult> {
  if (!hasCredentials()) {
    return missingCredentialsError() as GitHubCreatePRErrorResult;
  }

  const octokit = getOctokit();
  if (!octokit) {
    return missingCredentialsError() as GitHubCreatePRErrorResult;
  }

  try {
    const {
      owner,
      repo,
      title,
      head,
      base,
      body,
      draft = false,
      maintainerCanModify = true,
    } = params;

    const response = await executeWithRetry(
      () =>
        octokit.pulls.create({
          owner,
          repo,
          title,
          head,
          base,
          draft,
          maintainer_can_modify: maintainerCanModify,
          ...(body && { body }),
        }),
      { maxRetries: 2 }
    );

    return {
      success: true,
      pullRequest: {
        id: response.data.id,
        number: response.data.number,
        title: response.data.title,
        url: response.data.html_url,
      },
    };
  } catch (error) {
    const toolError = createToolError('github_create_pr', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const githubCreatePRDefinition: ToolDefinition<
  GitHubCreatePRParamsInput,
  GitHubCreatePRResult
> = {
  name: 'github_create_pr',
  description:
    'Create a new pull request in a GitHub repository. Specify source (head) and target (base) branches.',
  parameters: githubCreatePRParamsSchema as z.ZodSchema<GitHubCreatePRParamsInput>,
  execute: githubCreatePR as (args: GitHubCreatePRParamsInput) => Promise<GitHubCreatePRResult>,
};

// =============================================================================
// github_search_code
// =============================================================================

const githubSearchCodeParamsSchema = z.object({
  query: z.string().describe('Search query (e.g., "useState", "class Component")'),
  repo: z.string().optional().describe('Limit search to a specific repository (format: owner/repo)'),
  extension: z.string().optional().describe('Filter by file extension (e.g., "ts", "tsx", "js")'),
  filename: z.string().optional().describe('Filter by filename (e.g., "index.ts")'),
  path: z.string().optional().describe('Filter by path (e.g., "src/components")'),
  perPage: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(30)
    .describe('Number of results per page (default: 30, max: 100)'),
  page: z.number().min(1).optional().default(1).describe('Page number (default: 1)'),
});

type GitHubSearchCodeParamsInput = z.input<typeof githubSearchCodeParamsSchema>;

/**
 * Search for code across GitHub repositories
 */
export async function githubSearchCode(
  params: GitHubSearchCodeParamsInput
): Promise<GitHubSearchCodeResult> {
  if (!hasCredentials()) {
    return missingCredentialsError() as GitHubSearchCodeErrorResult;
  }

  const octokit = getOctokit();
  if (!octokit) {
    return missingCredentialsError() as GitHubSearchCodeErrorResult;
  }

  try {
    const { query, repo, extension, filename, path, perPage = 30, page = 1 } = params;

    // Build query string with qualifiers
    let searchQuery = query;
    if (repo) searchQuery += ` repo:${repo}`;
    if (extension) searchQuery += ` extension:${extension}`;
    if (filename) searchQuery += ` filename:${filename}`;
    if (path) searchQuery += ` path:${path}`;

    const response = await executeWithRetry(
      () =>
        octokit.search.code({
          q: searchQuery,
          per_page: perPage,
          page,
        }),
      { maxRetries: 2 }
    );

    const items: GitHubSearchCodeItem[] = response.data.items.map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      url: item.html_url,
      repository: {
        id: item.repository.id,
        name: item.repository.name,
        fullName: item.repository.full_name,
      },
    }));

    return {
      success: true,
      totalCount: response.data.total_count,
      incompleteResults: response.data.incomplete_results,
      items,
    };
  } catch (error) {
    const toolError = createToolError('github_search_code', error);
    return {
      success: false,
      message: toolError.message,
      error: toolError.error,
    };
  }
}

export const githubSearchCodeDefinition: ToolDefinition<
  GitHubSearchCodeParamsInput,
  GitHubSearchCodeResult
> = {
  name: 'github_search_code',
  description:
    'Search for code across GitHub repositories. Supports filtering by repository, file extension, filename, and path.',
  parameters: githubSearchCodeParamsSchema as z.ZodSchema<GitHubSearchCodeParamsInput>,
  execute: githubSearchCode as (args: GitHubSearchCodeParamsInput) => Promise<GitHubSearchCodeResult>,
};

// =============================================================================
// Export all GitHub tools
// =============================================================================

export const githubTools: ToolDefinition[] = [
  githubListReposDefinition as ToolDefinition,
  githubGetRepoDefinition as ToolDefinition,
  githubListIssuesDefinition as ToolDefinition,
  githubCreateIssueDefinition as ToolDefinition,
  githubListPRsDefinition as ToolDefinition,
  githubGetPRDefinition as ToolDefinition,
  githubCreatePRDefinition as ToolDefinition,
  githubSearchCodeDefinition as ToolDefinition,
];
