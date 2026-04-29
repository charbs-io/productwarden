import OpenAI from 'openai'
import { createError, type H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createInstallationAccessToken, githubInstallationRequest } from './github-app'
import { loadUserOpenAIConfig } from './openai-settings'

type RunRow = {
  id: string
  user_id: string
  site_id: string | null
  target_url: string
  target_hostname: string
  goal: string
}

type PersonaRow = {
  name: string
  role: string
} | null

type IssueRow = {
  id: string
  run_id: string
  persona_run_id: string | null
  step_number: number | null
  category: string
  severity: string
  title: string
  description: string
  evidence: string
  suggested_fix: string
  screenshot_path: string | null
  github_issue_url: string | null
  github_pr_url: string | null
}

type StepRow = {
  step_number: number
  url: string
  observation: string
  progress: string
  action: Record<string, unknown>
  result: Record<string, unknown>
}

type GithubConnectionRow = {
  installation_id: number
  repository_id: number
  owner: string
  repo: string
  full_name: string
  default_branch: string
  html_url: string
  allow_issue_creation: boolean
  allow_pr_creation: boolean
  disconnected_at: string | null
}

type GithubIssueResponse = {
  html_url: string
  number: number
}

type GithubRefResponse = {
  object: {
    sha: string
  }
}

type GithubTreeResponse = {
  tree?: Array<{
    path?: string
    type?: string
    size?: number
  }>
}

type GithubContentResponse = {
  content?: string
  encoding?: string
  sha?: string
}

type GithubPullResponse = {
  html_url: string
  number: number
}

export async function createGithubIssueFromFinding(event: H3Event, client: SupabaseClient, userId: string, runId: string, issueId: string) {
  const context = await loadIssueActionContext(client, userId, runId, issueId)
  const connection = context.connection

  if (!connection.allow_issue_creation) {
    throw createError({ statusCode: 403, statusMessage: 'GitHub issue creation is disabled for this site' })
  }

  const token = await createInstallationAccessToken(event, connection.installation_id, {
    repositoryIds: [connection.repository_id],
    permissions: {
      issues: 'write',
      metadata: 'read'
    }
  })
  const githubIssue = await githubInstallationRequest<GithubIssueResponse>(token.token, repoPath(connection, '/issues'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[Product Warden] ${context.issue.title}`,
      body: renderIssueBody(context)
    })
  })

  const { data, error } = await client
    .from('qa_issues')
    .update({
      github_issue_url: githubIssue.html_url,
      github_issue_number: githubIssue.number
    })
    .eq('id', issueId)
    .eq('run_id', runId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
}

export async function createGithubFixPullRequest(event: H3Event, client: SupabaseClient, userId: string, runId: string, issueId: string) {
  const context = await loadIssueActionContext(client, userId, runId, issueId)
  const connection = context.connection

  if (!connection.allow_pr_creation) {
    throw createError({ statusCode: 403, statusMessage: 'GitHub pull request creation is disabled for this site' })
  }

  const token = await createInstallationAccessToken(event, connection.installation_id, {
    repositoryIds: [connection.repository_id],
    permissions: {
      contents: 'write',
      metadata: 'read',
      pull_requests: 'write'
    }
  })
  const files = await generateFixFiles(event, client, token.token, connection, context)
  const baseRef = await githubInstallationRequest<GithubRefResponse>(token.token, repoPath(connection, `/git/ref/heads/${encodeURIComponent(connection.default_branch)}`))
  const branch = `productwarden/fix-${issueId.slice(0, 8)}-${Date.now().toString(36)}`

  await githubInstallationRequest<unknown>(token.token, repoPath(connection, '/git/refs'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: baseRef.object.sha
    })
  })

  for (const file of files) {
    await githubInstallationRequest<unknown>(token.token, repoPath(connection, `/contents/${encodePath(file.path)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Fix Product Warden finding: ${context.issue.title}`,
        branch,
        content: Buffer.from(file.content).toString('base64'),
        sha: file.sha
      })
    })
  }

  const pull = await githubInstallationRequest<GithubPullResponse>(token.token, repoPath(connection, '/pulls'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Fix Product Warden finding: ${context.issue.title}`,
      head: branch,
      base: connection.default_branch,
      body: renderPullRequestBody(context, files)
    })
  })

  const { data, error } = await client
    .from('qa_issues')
    .update({
      github_pr_url: pull.html_url,
      github_pr_number: pull.number,
      github_branch: branch
    })
    .eq('id', issueId)
    .eq('run_id', runId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data
}

async function loadIssueActionContext(client: SupabaseClient, userId: string, runId: string, issueId: string) {
  const { data: run, error: runError } = await client
    .from('qa_runs')
    .select('id, user_id, site_id, target_url, target_hostname, goal')
    .eq('id', runId)
    .eq('user_id', userId)
    .single()

  if (runError || !run) {
    throw createError({ statusCode: 404, statusMessage: 'Run not found' })
  }

  const { data: issue, error: issueError } = await client
    .from('qa_issues')
    .select('id, run_id, persona_run_id, step_number, category, severity, title, description, evidence, suggested_fix, screenshot_path, github_issue_url, github_pr_url')
    .eq('id', issueId)
    .eq('run_id', runId)
    .eq('user_id', userId)
    .single()

  if (issueError || !issue) {
    throw createError({ statusCode: 404, statusMessage: 'Issue not found' })
  }

  if (!run.site_id) {
    throw createError({ statusCode: 400, statusMessage: 'This run is not attached to a GitHub-connected site' })
  }

  const { data: connection, error: connectionError } = await client
    .from('site_github_connections')
    .select('installation_id, repository_id, owner, repo, full_name, default_branch, html_url, allow_issue_creation, allow_pr_creation, disconnected_at')
    .eq('site_id', run.site_id)
    .eq('user_id', userId)
    .is('disconnected_at', null)
    .single()

  if (connectionError || !connection) {
    throw createError({ statusCode: 400, statusMessage: 'This site is not connected to GitHub' })
  }

  const { data: persona } = issue.persona_run_id
    ? await client
        .from('qa_run_personas')
        .select('name, role')
        .eq('id', issue.persona_run_id)
        .eq('run_id', runId)
        .eq('user_id', userId)
        .maybeSingle()
    : { data: null }

  const { data: steps } = await client
    .from('qa_steps')
    .select('step_number, url, observation, progress, action, result')
    .eq('run_id', runId)
    .eq('user_id', userId)
    .eq(issue.persona_run_id ? 'persona_run_id' : 'run_id', issue.persona_run_id || runId)
    .order('step_number', { ascending: true })

  return {
    run: run as RunRow,
    issue: issue as IssueRow,
    persona: persona as PersonaRow,
    steps: (steps || []) as StepRow[],
    connection: connection as GithubConnectionRow
  }
}

async function generateFixFiles(event: H3Event, client: SupabaseClient, token: string, connection: GithubConnectionRow, context: Awaited<ReturnType<typeof loadIssueActionContext>>) {
  const tree = await githubInstallationRequest<GithubTreeResponse>(token, repoPath(connection, `/git/trees/${encodeURIComponent(connection.default_branch)}?recursive=1`)).catch(() => null)
  const candidates = (tree?.tree || [])
    .filter(item => item.type === 'blob' && item.path && isLikelyEditableCode(item.path) && (item.size || 0) < 90000)
    .map(item => item.path as string)
    .slice(0, 300)
  const selectedPaths = await chooseFixFiles(event, client, candidates, context)
  const sourceFiles = await Promise.all(selectedPaths.map(async (path) => {
    const content = await githubInstallationRequest<GithubContentResponse>(token, repoPath(connection, `/contents/${encodePath(path)}?ref=${encodeURIComponent(connection.default_branch)}`)).catch(() => null)
    return {
      path,
      sha: content?.sha,
      content: decodeGithubContent(content)
    }
  }))
  const viableSourceFiles = sourceFiles.filter(file => file.content)

  if (!viableSourceFiles.length) {
    throw createError({ statusCode: 422, statusMessage: 'Could not identify repository files for a safe code fix' })
  }

  const openai = await loadUserOpenAIConfig(client, context.run.user_id, event).catch(() => null)
  if (!openai) {
    throw createError({ statusCode: 400, statusMessage: 'OpenAI API key is required to generate a fix PR' })
  }

  const openaiClient = new OpenAI({ apiKey: openai.apiKey })
  const response = await openaiClient.responses.create({
    model: openai.model,
    instructions: [
      'You create small, safe code fixes for GitHub pull requests.',
      'Return full replacement file contents only. Preserve existing style and avoid unrelated refactors.',
      'If a confident code fix is not possible from the provided files, return an empty files array.'
    ].join('\n'),
    input: [{
      role: 'user',
      content: [{
        type: 'input_text',
        text: JSON.stringify({
          finding: renderFindingJson(context),
          files: viableSourceFiles.map(file => ({
            path: file.path,
            content: file.content.slice(0, 60000)
          }))
        })
      }]
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'productwarden_fix_files',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            files: {
              type: 'array',
              maxItems: 4,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' },
                  explanation: { type: 'string' }
                },
                required: ['path', 'content', 'explanation']
              }
            }
          },
          required: ['files']
        }
      }
    }
  })
  const parsed = JSON.parse(response.output_text) as {
    files: Array<{ path: string, content: string, explanation: string }>
  }
  const byPath = new Map(viableSourceFiles.map(file => [file.path, file]))
  const generated = parsed.files
    .map(file => ({
      ...file,
      sha: byPath.get(file.path)?.sha
    }))
    .filter(file => file.sha && byPath.has(file.path))

  if (!generated.length) {
    throw createError({ statusCode: 422, statusMessage: 'Could not generate a confident code fix for this finding' })
  }

  return generated
}

async function chooseFixFiles(event: H3Event, client: SupabaseClient, candidates: string[], context: Awaited<ReturnType<typeof loadIssueActionContext>>) {
  if (!candidates.length) {
    return []
  }

  const openai = await loadUserOpenAIConfig(client, context.run.user_id, event).catch(() => null)
  if (!openai) {
    return []
  }

  const openaiClient = new OpenAI({ apiKey: openai.apiKey })
  const response = await openaiClient.responses.create({
    model: openai.model,
    instructions: [
      'Choose the smallest set of repository files likely needed to fix the Product Warden finding.',
      'Only choose files from the provided candidate list. Return no files if the target is unclear.'
    ].join('\n'),
    input: [{
      role: 'user',
      content: [{
        type: 'input_text',
        text: JSON.stringify({
          finding: renderFindingJson(context),
          candidates
        })
      }]
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'productwarden_fix_file_selection',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            paths: {
              type: 'array',
              maxItems: 4,
              items: { type: 'string' }
            }
          },
          required: ['paths']
        }
      }
    }
  })
  const parsed = JSON.parse(response.output_text) as { paths: string[] }
  const allowed = new Set(candidates)

  return parsed.paths.filter(path => allowed.has(path)).slice(0, 4)
}

function renderIssueBody(context: Awaited<ReturnType<typeof loadIssueActionContext>>) {
  return `## Finding
${context.issue.description}

## Evidence
${context.issue.evidence}

## Suggested Fix
${context.issue.suggested_fix}

## Context
- Site: ${context.run.target_url}
- Goal: ${context.run.goal}
- Persona: ${context.persona?.name || 'Unknown'}
- Category: ${context.issue.category}
- Severity: ${context.issue.severity}
- Step: ${context.issue.step_number || 'Unknown'}

## Journey Trace
${context.steps.map(step => `- Step ${step.step_number}: ${step.observation}`).join('\n') || '- No steps recorded.'}
`
}

function renderPullRequestBody(context: Awaited<ReturnType<typeof loadIssueActionContext>>, files: Array<{ path: string, explanation: string }>) {
  return `${renderIssueBody(context)}

## Files Changed
${files.map(file => `- \`${file.path}\`: ${file.explanation}`).join('\n')}
`
}

function renderFindingJson(context: Awaited<ReturnType<typeof loadIssueActionContext>>) {
  return {
    title: context.issue.title,
    description: context.issue.description,
    evidence: context.issue.evidence,
    suggested_fix: context.issue.suggested_fix,
    category: context.issue.category,
    severity: context.issue.severity,
    target_url: context.run.target_url,
    goal: context.run.goal,
    persona: context.persona,
    steps: context.steps.slice(-8)
  }
}

function repoPath(connection: GithubConnectionRow, path: string) {
  return `/repos/${connection.owner}/${connection.repo}${path}`
}

function encodePath(path: string) {
  return path.split('/').map(part => encodeURIComponent(part)).join('/')
}

function decodeGithubContent(content: GithubContentResponse | null) {
  if (!content?.content || content.encoding !== 'base64') {
    return ''
  }

  return Buffer.from(content.content.replace(/\n/g, ''), 'base64').toString('utf8')
}

function isLikelyEditableCode(path: string) {
  return /\.(vue|tsx?|jsx?|svelte|astro|css|scss|mdx?)$/.test(path)
    && !path.includes('node_modules/')
    && !path.includes('dist/')
    && !path.includes('build/')
    && !path.includes('.nuxt/')
}
