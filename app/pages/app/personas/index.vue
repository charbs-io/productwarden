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
    toast.add({ title: wasEditing ? 'Persona template updated' : 'Persona template created', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: 'Persona template could not be saved', description: getErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function deleteTemplate(template: PersonaTemplate) {
  deletingId.value = template.id

  try {
    await $fetch(`/api/persona-templates/${template.id}`, {
      method: 'DELETE'
    })
    await refresh()
    if (editingId.value === template.id) {
      resetForm()
    }
    toast.add({ title: 'Persona template deleted', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: 'Persona template could not be deleted', description: getErrorMessage(error), color: 'error' })
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
      <UDashboardNavbar title="Persona templates">
        <template #right>
          <UButton to="/app/runs/new" icon="i-lucide-play" label="New run" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div class="space-y-4">
          <UCard>
            <template #header>
              <div>
                <h2 class="text-base font-semibold">
                  Starter templates
                </h2>
                <p class="text-sm text-muted">
                  These are available to every run and cannot be edited.
                </p>
              </div>
            </template>

            <div class="grid gap-3 md:grid-cols-2">
              <div v-for="template in starterTemplates" :key="template.id" class="rounded-lg border border-default p-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-medium">
                      {{ template.name }}
                    </p>
                    <p class="mt-1 text-sm text-muted">
                      {{ template.description }}
                    </p>
                  </div>
                  <UBadge color="neutral" variant="subtle">
                    Starter
                  </UBadge>
                </div>
                <ul class="mt-3 space-y-1 text-sm text-muted">
                  <li v-for="item in template.report_focus" :key="item">
                    {{ item }}
                  </li>
                </ul>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="text-base font-semibold">
                Custom templates
              </h2>
            </template>

            <div v-if="customTemplates.length" class="space-y-3">
              <div v-for="template in customTemplates" :key="template.id" class="rounded-lg border border-default p-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-sm font-medium">
                      {{ template.name }}
                    </p>
                    <p class="mt-1 text-sm text-muted">
                      {{ template.description || template.role }}
                    </p>
                  </div>
                  <div class="flex gap-1">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-pencil"
                      aria-label="Edit persona template"
                      @click="editTemplate(template)"
                    />
                    <UButton
                      color="error"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-trash-2"
                      aria-label="Delete persona template"
                      :loading="deletingId === template.id"
                      @click="deleteTemplate(template)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <UAlert
              v-else
              color="neutral"
              variant="subtle"
              icon="i-lucide-user-round-plus"
              title="No custom templates yet"
              description="Create one when you need a role that is specific to your product or team."
            />
          </UCard>
        </div>

        <UCard>
          <template #header>
            <div>
              <h2 class="text-base font-semibold">
                {{ editingTemplate ? 'Edit template' : 'Create template' }}
              </h2>
              <p class="text-sm text-muted">
                Define the role, responsibilities, and report focus used during runs.
              </p>
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="saveTemplate">
            <UFormField label="Name" name="name" required>
              <UInput v-model="form.name" required placeholder="Accessibility reviewer" />
            </UFormField>

            <UFormField label="Description" name="description">
              <UInput v-model="form.description" placeholder="Short summary shown in run setup" />
            </UFormField>

            <UFormField label="Role" name="role" required>
              <UTextarea
                v-model="form.role"
                required
                autoresize
                placeholder="You are an accessibility reviewer checking keyboard, screen reader, and contrast issues."
              />
            </UFormField>

            <UFormField label="Responsibilities" name="responsibilities" required>
              <UTextarea
                v-model="form.responsibilities"
                required
                autoresize
                placeholder="One responsibility per line"
              />
            </UFormField>

            <UFormField label="Report focus" name="reportFocus" required>
              <UTextarea
                v-model="form.reportFocus"
                required
                autoresize
                placeholder="One report focus area per line"
              />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton
                v-if="editingId"
                color="neutral"
                variant="outline"
                label="Cancel"
                @click="resetForm"
              />
              <UButton
                type="submit"
                icon="i-lucide-save"
                :label="editingId ? 'Save changes' : 'Create template'"
                :loading="saving"
                :disabled="pending || !readLines(form.responsibilities).length || !readLines(form.reportFocus).length"
              />
            </div>
          </form>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
