import { createError, getQuery, getRouterParam, setHeader } from 'h3'
import { createServiceSupabaseClient, requireUser } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const personaRunId = typeof query.personaRunId === 'string' ? query.personaRunId : ''
  const client = createServiceSupabaseClient(event)

  if (personaRunId) {
    const { data: persona, error: personaError } = await client
      .from('qa_run_personas')
      .select('report_md')
      .eq('id', personaRunId)
      .eq('run_id', id)
      .eq('user_id', user.id)
      .single()

    if (personaError || !persona) {
      throw createError({ statusCode: 404, statusMessage: 'Persona report not found' })
    }

    setHeader(event, 'content-type', 'text/markdown; charset=utf-8')
    return persona.report_md || '# Persona Report\n\nThe report is not ready yet.\n'
  }

  const { data: run, error } = await client
    .from('qa_runs')
    .select('report_md')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !run) {
    throw createError({ statusCode: 404, statusMessage: 'Run not found' })
  }

  setHeader(event, 'content-type', 'text/markdown; charset=utf-8')
  return run.report_md || '# Ghost Customer QA Report\n\nThe report is not ready yet.\n'
})
