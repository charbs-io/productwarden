<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui'
import type { PersonaTemplate, Site } from '~/types'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const submitting = ref(false)

const form = reactive({
  siteId: String(route.query.site || ''),
  url: '',
  personaTemplateIds: [] as string[],
  goal: '',
  username: '',
  password: '',
  maxSteps: 20
})

const { data: sites } = await useFetch<Site[]>('/api/sites', {
  default: () => []
})
const { data: personaTemplates } = await useFetch<PersonaTemplate[]>('/api/persona-templates', {
  default: () => []
})

const verifiedSites = computed(() => sites.value.filter(site => site.verified_at))
const siteItems = computed<SelectItem[]>(() => verifiedSites.value.map(site => ({
  label: `${site.hostname} (${site.base_url})`,
  value: site.id
})))
const selectedSite = computed(() => verifiedSites.value.find(site => site.id === form.siteId) || null)
const starterTemplates = computed(() => personaTemplates.value.filter(template => template.is_starter))
const customTemplates = computed(() => personaTemplates.value.filter(template => !template.is_starter))

watchEffect(() => {
  if (!form.siteId && verifiedSites.value[0]) {
    form.siteId = verifiedSites.value[0].id
  }

  if (!form.personaTemplateIds.length && personaTemplates.value.length) {
    const customer = personaTemplates.value.find(template => template.slug === 'customer')
    const fallback = personaTemplates.value[0]
    const templateId = customer?.id || fallback?.id
    if (templateId) {
      form.personaTemplateIds = [templateId]
    }
  }
})

async function startRun() {
  if (!form.siteId) {
    toast.add({ title: 'Choose a verified site', color: 'warning' })
    return
  }

  submitting.value = true

  try {
    const response = await $fetch<{ id: string }>('/api/runs', {
      method: 'POST',
      body: {
        siteId: form.siteId,
        url: form.url || undefined,
        personaTemplateIds: form.personaTemplateIds,
        goal: form.goal,
        maxSteps: Number(form.maxSteps),
        credentials: {
          username: form.username || undefined,
          password: form.password || undefined
        }
      }
    })

    await router.push(`/app/runs/${response.id}`)
  } catch (error: unknown) {
    toast.add({ title: 'Run could not start', description: getErrorMessage(error), color: 'error' })
  } finally {
    submitting.value = false
  }
}

function getErrorMessage(error: unknown) {
  const fetchError = error as { data?: { message?: string }, message?: string }
  return fetchError.data?.message || fetchError.message || 'Unexpected error'
}
</script>

<template>
  <UDashboardPanel id="new-run">
    <template #header>
      <UDashboardNavbar title="New run" />
    </template>

    <template #body>
      <div class="grid gap-4 xl:grid-cols-[1fr_380px]">
        <UCard>
          <template #header>
            <div>
              <h2 class="text-base font-semibold">
                Customer simulation
              </h2>
              <p class="text-sm text-muted">
                Product Warden will visually inspect the site, act through Playwright, and produce persona reports plus an overarching report.
              </p>
            </div>
          </template>

          <form class="space-y-4" @submit.prevent="startRun">
            <UFormField label="Site" name="siteId" required>
              <USelect
                v-model="form.siteId"
                :items="siteItems"
                placeholder="Choose a verified site"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Start URL" name="url">
              <UInput v-model="form.url" :placeholder="selectedSite?.base_url || 'https://app.example.com/signup'" />
            </UFormField>

            <UFormField label="Personas" name="personaTemplateIds" required>
              <div class="grid gap-3 md:grid-cols-2">
                <label
                  v-for="template in starterTemplates"
                  :key="template.id"
                  class="flex cursor-pointer gap-3 rounded-lg border border-default p-3 transition hover:bg-elevated/50"
                  :class="form.personaTemplateIds.includes(template.id) ? 'bg-primary/5 ring-1 ring-primary' : ''"
                >
                  <input
                    v-model="form.personaTemplateIds"
                    type="checkbox"
                    :value="template.id"
                    class="mt-1 size-4"
                  >
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">{{ template.name }}</span>
                    <span class="mt-1 block text-sm text-muted">{{ template.description }}</span>
                  </span>
                </label>
              </div>
              <div v-if="customTemplates.length" class="mt-3 grid gap-3 md:grid-cols-2">
                <label
                  v-for="template in customTemplates"
                  :key="template.id"
                  class="flex cursor-pointer gap-3 rounded-lg border border-default p-3 transition hover:bg-elevated/50"
                  :class="form.personaTemplateIds.includes(template.id) ? 'bg-primary/5 ring-1 ring-primary' : ''"
                >
                  <input
                    v-model="form.personaTemplateIds"
                    type="checkbox"
                    :value="template.id"
                    class="mt-1 size-4"
                  >
                  <span class="min-w-0">
                    <span class="block text-sm font-medium">{{ template.name }}</span>
                    <span class="mt-1 block text-sm text-muted">{{ template.description || template.role }}</span>
                  </span>
                </label>
              </div>
              <div class="mt-3 flex justify-between gap-3">
                <p class="text-sm text-muted">
                  Select one or more personas. Each selected persona gets its own report.
                </p>
                <UButton
                  to="/app/personas"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-settings-2"
                  label="Manage"
                />
              </div>
            </UFormField>

            <UFormField label="Goal" name="goal" required>
              <UTextarea
                v-model="form.goal"
                placeholder="Sign up, create a workspace, invite a teammate, and upgrade plan"
                required
                autoresize
              />
            </UFormField>

            <div class="grid gap-4 md:grid-cols-2">
              <UFormField label="Test username" name="username">
                <UInput v-model="form.username" autocomplete="off" placeholder="Optional" />
              </UFormField>

              <UFormField label="Test password" name="password">
                <UInput
                  v-model="form.password"
                  type="password"
                  autocomplete="off"
                  placeholder="Optional"
                />
              </UFormField>
            </div>

            <UFormField label="Max steps" name="maxSteps">
              <UInput
                v-model.number="form.maxSteps"
                type="number"
                min="3"
                max="40"
              />
            </UFormField>

            <div class="flex justify-end">
              <UButton
                type="submit"
                icon="i-lucide-play"
                label="Start QA run"
                :loading="submitting"
                :disabled="!verifiedSites.length || !form.personaTemplateIds.length"
              />
            </div>
          </form>
        </UCard>

        <div class="space-y-4">
          <UAlert
            icon="i-lucide-shield-check"
            color="primary"
            variant="subtle"
            title="Only verified sites can be tested"
            description="If the target URL redirects outside the selected site hostname, the run stops."
          />

          <UCard>
            <template #header>
              <h2 class="text-base font-semibold">
                Ready sites
              </h2>
            </template>
            <div v-if="verifiedSites.length" class="space-y-2">
              <div v-for="site in verifiedSites" :key="site.id" class="flex items-center gap-2 text-sm">
                <UIcon name="i-lucide-check" class="size-4 text-success" />
                <span>{{ site.hostname }}</span>
              </div>
            </div>
            <UAlert
              v-else
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              title="No verified sites"
              description="Add and verify a site before starting a run."
            />
            <UButton
              v-if="!verifiedSites.length"
              to="/app/sites/new"
              color="neutral"
              variant="outline"
              icon="i-lucide-plus"
              label="Add site"
              block
              class="mt-3"
            />
          </UCard>

          <UCard v-if="selectedSite?.github_connection && !selectedSite.github_connection.disconnected_at">
            <template #header>
              <h2 class="text-base font-semibold">
                Repository context
              </h2>
            </template>
            <p class="text-sm text-muted">
              {{ selectedSite.github_connection.use_repository_context ? selectedSite.github_connection.full_name : 'Repository context is disabled for this site.' }}
            </p>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
