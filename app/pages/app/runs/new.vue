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
    toast.add({ title: 'Pick a verified site first', color: 'warning' })
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
    toast.add({ title: `Couldn't start the test`, description: getErrorMessage(error), color: 'error' })
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
      <UDashboardNavbar title="Run a test" />
    </template>

    <template #body>
      <div class="mx-auto max-w-3xl">
        <PageIntro description="Tell us which site to test, who's pretending to be a customer, and what they're trying to do. We'll launch a real browser, walk through the goal, and write up what's broken." />

        <UAlert
          v-if="!verifiedSites.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-shield-alert"
          title="No verified sites yet"
          description="Add and verify a site before you can run a test."
          class="mt-6"
        >
          <template #actions>
            <UButton to="/app/sites/new" label="Add a site" size="sm" />
          </template>
        </UAlert>

        <form class="mt-10 space-y-10" @submit.prevent="startRun">
          <section class="space-y-4">
            <SectionHeader title="What to test" />

            <UFormField label="Site" name="siteId" required>
              <USelect
                v-model="form.siteId"
                :items="siteItems"
                placeholder="Pick a verified site"
                size="lg"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Start URL (optional)" name="url" hint="Defaults to the site's base URL.">
              <UInput
                v-model="form.url"
                :placeholder="selectedSite?.base_url || 'https://app.example.com/signup'"
                size="lg"
                class="w-full"
              />
            </UFormField>
          </section>

          <section class="space-y-4">
            <SectionHeader
              title="Who's testing it"
              description="Each persona writes its own report. Pick one or several."
            >
              <template #actions>
                <UButton
                  to="/app/personas"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  label="Manage personas"
                />
              </template>
            </SectionHeader>

            <div class="grid gap-2 md:grid-cols-2">
              <label
                v-for="template in starterTemplates"
                :key="template.id"
                class="flex cursor-pointer gap-3 rounded-md border border-default p-3 transition hover:border-primary/40"
                :class="form.personaTemplateIds.includes(template.id) ? 'border-primary bg-primary/5' : ''"
              >
                <input
                  v-model="form.personaTemplateIds"
                  type="checkbox"
                  :value="template.id"
                  class="mt-0.5 size-4 accent-primary"
                >
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-default">{{ template.name }}</span>
                  <span class="mt-1 block text-xs leading-5 text-muted">{{ template.description }}</span>
                </span>
              </label>
            </div>

            <div v-if="customTemplates.length" class="grid gap-2 md:grid-cols-2">
              <label
                v-for="template in customTemplates"
                :key="template.id"
                class="flex cursor-pointer gap-3 rounded-md border border-default p-3 transition hover:border-primary/40"
                :class="form.personaTemplateIds.includes(template.id) ? 'border-primary bg-primary/5' : ''"
              >
                <input
                  v-model="form.personaTemplateIds"
                  type="checkbox"
                  :value="template.id"
                  class="mt-0.5 size-4 accent-primary"
                >
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-default">{{ template.name }}</span>
                  <span class="mt-1 block text-xs leading-5 text-muted">{{ template.description || template.role }}</span>
                </span>
              </label>
            </div>
          </section>

          <section class="space-y-4">
            <SectionHeader
              title="What they're trying to do"
              description="Write it like you'd describe it to a teammate. The more specific, the better the test."
            />

            <UFormField label="Goal" name="goal" required>
              <UTextarea
                v-model="form.goal"
                placeholder="Sign up, create a workspace, invite a teammate, and upgrade to the paid plan."
                required
                autoresize
                size="lg"
                class="w-full"
              />
            </UFormField>
          </section>

          <section class="space-y-4">
            <SectionHeader
              title="Optional credentials"
              description="If the journey needs a login, give the test something to use. Otherwise we'll generate a throwaway account."
            />
            <div class="grid gap-4 md:grid-cols-2">
              <UFormField label="Email or username" name="username">
                <UInput
                  v-model="form.username"
                  autocomplete="off"
                  placeholder="Auto-generate if blank"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Password" name="password">
                <UInput
                  v-model="form.password"
                  type="password"
                  autocomplete="off"
                  placeholder="Auto-generate if blank"
                  class="w-full"
                />
              </UFormField>
            </div>
          </section>

          <section class="space-y-4">
            <SectionHeader
              title="Cap on steps"
              description="The test stops if it can't finish in this many steps. 20 is usually enough for most journeys."
            />
            <UFormField label="Max steps" name="maxSteps">
              <UInput
                v-model.number="form.maxSteps"
                type="number"
                min="3"
                max="40"
                class="w-32"
              />
            </UFormField>
          </section>

          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-6">
            <p class="text-xs text-muted">
              Tests stop if the browser leaves the verified hostname.
            </p>
            <UButton
              type="submit"
              label="Start the test"
              size="lg"
              :loading="submitting"
              :disabled="!verifiedSites.length || !form.personaTemplateIds.length"
            />
          </div>
        </form>
      </div>
    </template>
  </UDashboardPanel>
</template>
