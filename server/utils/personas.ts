import { createError } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PersonaTemplateRow = {
  id: string
  user_id: string | null
  slug: string
  name: string
  description: string
  role: string
  responsibilities: string[]
  report_focus: string[]
  is_starter: boolean
  created_at: string
  updated_at: string
}

export type RunPersonaRow = {
  id: string
  run_id: string
  user_id: string
  persona_template_id: string | null
  position: number
  name: string
  role: string
  responsibilities: string[]
  report_focus: string[]
  goal: string
  status: string
  result: string | null
  error: string | null
  issue_count: number
  report_md: string | null
  video_path: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export type PersonaTemplateInput = {
  name: string
  description?: string
  role: string
  responsibilities: string[]
  reportFocus: string[]
}

export async function listAvailablePersonaTemplates(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from('persona_templates')
    .select('id, user_id, slug, name, description, role, responsibilities, report_focus, is_starter, created_at, updated_at')
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .order('is_starter', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data || []) as PersonaTemplateRow[]
}

export async function loadPersonaTemplatesById(client: SupabaseClient, userId: string, ids: string[]) {
  if (!ids.length) {
    return []
  }

  const { data, error } = await client
    .from('persona_templates')
    .select('id, user_id, slug, name, description, role, responsibilities, report_focus, is_starter, created_at, updated_at')
    .in('id', ids)
    .or(`user_id.is.null,user_id.eq.${userId}`)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const byId = new Map((data || []).map(row => [row.id, row as PersonaTemplateRow]))
  const ordered = ids.map(id => byId.get(id)).filter(Boolean) as PersonaTemplateRow[]

  if (ordered.length !== ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'One or more persona templates are unavailable' })
  }

  return ordered
}

export async function createPersonaTemplate(client: SupabaseClient, userId: string, input: PersonaTemplateInput) {
  const now = new Date().toISOString()
  const { data, error } = await client
    .from('persona_templates')
    .insert({
      user_id: userId,
      slug: createSlug(input.name),
      name: input.name,
      description: input.description || '',
      role: input.role,
      responsibilities: input.responsibilities,
      report_focus: input.reportFocus,
      is_starter: false,
      created_at: now,
      updated_at: now
    })
    .select('id, user_id, slug, name, description, role, responsibilities, report_focus, is_starter, created_at, updated_at')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return data as PersonaTemplateRow
}

export async function updatePersonaTemplate(client: SupabaseClient, userId: string, id: string, input: PersonaTemplateInput) {
  const { data, error } = await client
    .from('persona_templates')
    .update({
      slug: createSlug(input.name),
      name: input.name,
      description: input.description || '',
      role: input.role,
      responsibilities: input.responsibilities,
      report_focus: input.reportFocus,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_starter', false)
    .select('id, user_id, slug, name, description, role, responsibilities, report_focus, is_starter, created_at, updated_at')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Persona template not found' })
  }

  return data as PersonaTemplateRow
}

export async function deletePersonaTemplate(client: SupabaseClient, userId: string, id: string) {
  const { data, error } = await client
    .from('persona_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_starter', false)
    .select('id')
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Persona template not found' })
  }

  return { ok: true }
}

function createSlug(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return slug || 'persona'
}
