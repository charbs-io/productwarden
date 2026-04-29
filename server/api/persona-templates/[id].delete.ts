import { getRouterParam } from 'h3'
import { createServiceSupabaseClient, requireUser } from '../../utils/supabase'
import { deletePersonaTemplate } from '../../utils/personas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id') || ''
  const client = createServiceSupabaseClient(event)

  return await deletePersonaTemplate(client, user.id, id)
})
