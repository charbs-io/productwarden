import { createServiceSupabaseClient, requireUser } from '../../utils/supabase'
import { listAvailablePersonaTemplates } from '../../utils/personas'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const client = createServiceSupabaseClient(event)

  return await listAvailablePersonaTemplates(client, user.id)
})
