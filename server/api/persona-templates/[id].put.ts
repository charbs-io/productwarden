import { z } from 'zod'
import { getRouterParam, readValidatedBody } from 'h3'
import { createServiceSupabaseClient, requireUser } from '../../utils/supabase'
import { updatePersonaTemplate } from '../../utils/personas'

const schema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(240).optional(),
  role: z.string().min(10).max(1000),
  responsibilities: z.array(z.string().min(3).max(240)).min(1).max(12),
  reportFocus: z.array(z.string().min(3).max(160)).min(1).max(10)
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readValidatedBody(event, schema.parse)
  const client = createServiceSupabaseClient(event)

  return await updatePersonaTemplate(client, user.id, id, body)
})
