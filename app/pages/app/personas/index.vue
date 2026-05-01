<script setup lang="ts">
import type { PersonaTemplate } from '~/types'

const toast = useToast()
const saving = ref(false)
const deletingId = ref<string | null>(null)
const editingId = ref<string | null>(null)

const form = reactive({
  name: '',
  description: '',
  role: '',
  responsibilities: '',
  reportFocus: ''
})

const { data: templates, refresh, pending } = await useFetch<PersonaTemplate[]>('/api/persona-templates', {
  default: () => []
})

const starterTemplates = computed(() => templates.value.filter(template => template.is_starter))
const customTemplates = computed(() => templates.value.filter(template => !template.is_starter))
const editingTemplate = computed(() => templates.value.find(template => template.id === editingId.value) || null)

function editTemplate(template: PersonaTemplate) {
  editingId.value = template.id
  form.name = template.name
  form.description = template.description
  form.role = template.role
  form.responsibilities = template.responsibilities.join('\n')
  form.reportFocus = template.report_focus.join('\n')
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.description = ''
  form.role = ''
  form.responsibilities = ''
  form.reportFocus = ''
}

async function saveTemplate() {
  saving.value = true

  try {
    const wasEditing = Boolean(editingId.value)
    const body = {
      name: form.name,
      description: form.description || undefined,
      role: form.role,
      responsibilities: readLines(form.responsibilities),
      reportFocus: readLines(form.reportFocus)
    }
    await $fetch(editingId.value ? `/api/persona-templates/${editingId.value}` : '/api/persona-templates', {
      method: editingId.value ? 'PUT' : 'POST',
      body
    })
    await refresh()
    resetForm()
    toast.add({ title: wasEditing ? 'Persona updated' : 'Persona created', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't save the persona`, description: getErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function deleteTemplate(template: PersonaTemplate) {
  if (!window.confirm(`Delete the "${template.name}" persona?`)) return
  deletingId.value = template.id

  try {
    await $fetch(`/api/persona-templates/${template.id}`, {
      method: 'DELETE'
    })
    await refresh()
    if (editingId.value === template.id) {
      resetForm()
    }
    toast.add({ title: 'Persona deleted', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't delete the persona`, description: getErrorMessage(error), color: 'error' })
  } finally {
    deletingId.value = null
  }
}

function readLines(value: string) {
  return value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function getErrorMessage(error: unknown) {
  const fetchError = error as { data?: { message?: string }, message?: string }
  return fetchError.data?.message || fetchError.message || 'Unexpected error'
}
</script>

<template>
  <UDashboardPanel id="personas">
    <template #header>
      <UDashboardNavbar title="Personas">
        <template #right>
          <UButton to="/app/runs/new" label="Run a test" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid gap-10 xl:grid-cols-[1fr_400px]">
        <div class="min-w-0 space-y-10">
          <PageIntro description="Personas are who walks your site during a test. Pick from the starters or write your own to focus on a specific kind of user — an accessibility reviewer, a procurement lead, a power user." />

          <section class="space-y-4">
            <SectionHeader
              title="Starter personas"
              description="Available to every test. You can't edit these."
            />

            <div class="grid gap-2 md:grid-cols-2">
              <article v-for="template in starterTemplates" :key="template.id" class="space-y-2 rounded-md border border-default p-4">
                <div class="flex items-baseline justify-between gap-2">
                  <h3 class="text-sm font-semibold text-default">
                    {{ template.name }}
                  </h3>
                  <span class="text-xs uppercase tracking-wide text-muted">Starter</span>
                </div>
                <p class="text-sm leading-6 text-muted">
                  {{ template.description }}
                </p>
                <ul class="space-y-1 pt-1 text-xs text-muted">
                  <li v-for="item in template.report_focus" :key="item" class="flex gap-2">
                    <span class="text-default">·</span>
                    <span>{{ item }}</span>
                  </li>
                </ul>
              </article>
            </div>
          </section>

          <section class="space-y-4">
            <SectionHeader title="Your personas" />

            <div v-if="customTemplates.length" class="divide-y divide-default border-y border-default">
              <article v-for="template in customTemplates" :key="template.id" class="flex items-start justify-between gap-4 py-4">
                <div class="min-w-0">
                  <h3 class="text-sm font-semibold text-default">
                    {{ template.name }}
                  </h3>
                  <p class="mt-1 text-sm leading-6 text-muted">
                    {{ template.description || template.role }}
                  </p>
                </div>
                <div class="flex shrink-0 gap-1">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    label="Edit"
                    @click="editTemplate(template)"
                  />
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-trash-2"
                    aria-label="Delete persona"
                    :loading="deletingId === template.id"
                    @click="deleteTemplate(template)"
                  />
                </div>
              </article>
            </div>

            <p v-else class="text-sm text-muted">
              No custom personas yet. Use the form to create one — useful when the starter set doesn't quite match your audience.
            </p>
          </section>
        </div>

        <aside class="min-w-0 space-y-4">
          <SectionHeader
            :title="editingTemplate ? 'Edit persona' : 'Create a persona'"
            description="Give the test a clear role to play and what to focus on while reviewing."
          />

          <form class="space-y-4" @submit.prevent="saveTemplate">
            <UFormField label="Name" name="name" required>
              <UInput
                v-model="form.name"
                required
                placeholder="Accessibility reviewer"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Short description" name="description" hint="Shown when picking personas for a test.">
              <UInput v-model="form.description" placeholder="Checks keyboard, screen reader, and contrast." class="w-full" />
            </UFormField>

            <UFormField
              label="Role"
              name="role"
              required
              hint="The voice the persona uses while testing."
            >
              <UTextarea
                v-model="form.role"
                required
                autoresize
                placeholder="You are an accessibility reviewer checking keyboard, screen reader, and contrast issues."
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Responsibilities"
              name="responsibilities"
              required
              hint="One per line. What this persona pays attention to."
            >
              <UTextarea
                v-model="form.responsibilities"
                required
                autoresize
                placeholder="Try every interactive element with the keyboard&#10;Note any focus traps&#10;Flag color combinations that may fail contrast"
                class="w-full"
              />
            </UFormField>

            <UFormField
              label="Report focus"
              name="reportFocus"
              required
              hint="One per line. The findings to call out in the report."
            >
              <UTextarea
                v-model="form.reportFocus"
                required
                autoresize
                placeholder="Keyboard reachability gaps&#10;Screen reader misses&#10;Contrast violations"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-2 pt-2">
              <UButton
                v-if="editingId"
                color="neutral"
                variant="ghost"
                label="Cancel"
                @click="resetForm"
              />
              <UButton
                type="submit"
                :label="editingId ? 'Save changes' : 'Create persona'"
                :loading="saving"
                :disabled="pending || !readLines(form.responsibilities).length || !readLines(form.reportFocus).length"
              />
            </div>
          </form>
        </aside>
      </div>
    </template>
  </UDashboardPanel>
</template>
