import { createError, getRouterParam } from 'h3'
import { createServiceSupabaseClient, requireUser } from '../../../../../utils/supabase'
import { createGithubFixPullRequest } from '../../../../../utils/github-actions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const runId = getRouterParam(event, 'id')
  const issueId = getRouterParam(event, 'issueId')

  if (!runId || !issueId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing run or issue id' })
  }

  const client = createServiceSupabaseClient(event)
  return await createGithubFixPullRequest(event, client, user.id, runId, issueId)
})
