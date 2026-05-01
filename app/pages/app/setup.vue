<script setup lang="ts">
import type { OpenAISettingsStatus } from '~/types'

const toast = useToast()
const savingOpenAIKey = ref(false)
const clearingOpenAIKey = ref(false)

const openAIForm = reactive({
  apiKey: ''
})

const emptyOpenAISettings: OpenAISettingsStatus = {
  configured: false,
  updated_at: null
}

const { data: openAISettings } = await useFetch<OpenAISettingsStatus>('/api/settings/openai', {
  default: () => emptyOpenAISettings
})
const openAIStatus = computed(() => openAISettings.value || emptyOpenAISettings)

async function saveOpenAIKey() {
  savingOpenAIKey.value = true

  try {
    openAISettings.value = await $fetch<OpenAISettingsStatus>('/api/settings/openai', {
      method: 'PUT',
      body: {
        apiKey: openAIForm.apiKey
      }
    })

    openAIForm.apiKey = ''
    toast.add({ title: 'API key saved', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't save the key`, description: getErrorMessage(error), color: 'error' })
  } finally {
    savingOpenAIKey.value = false
  }
}

async function clearOpenAIKey() {
  if (!window.confirm('Remove the saved API key? Tests will stop working until you add a new one.')) return
  clearingOpenAIKey.value = true

  try {
    openAISettings.value = await $fetch<OpenAISettingsStatus>('/api/settings/openai', {
      method: 'DELETE'
    })

    openAIForm.apiKey = ''
    toast.add({ title: 'API key removed', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't remove the key`, description: getErrorMessage(error), color: 'error' })
  } finally {
    clearingOpenAIKey.value = false
  }
}

function getErrorMessage(error: unknown) {
  const fetchError = error as { data?: { message?: string }, message?: string }
  return fetchError.data?.message || fetchError.message || 'Unexpected error'
}
</script>

<template>
  <UDashboardPanel id="setup">
    <template #header>
      <UDashboardNavbar title="Settings" />
    </template>

    <template #body>
      <div class="mx-auto max-w-2xl space-y-10">
        <PageIntro description="Account-level settings for your workspace. Right now that's just your OpenAI API key — Product Warden uses it to drive each test." />

        <section class="space-y-4">
          <SectionHeader title="OpenAI API key">
            <template #actions>
              <span class="text-sm font-medium" :class="openAIStatus.configured ? 'text-success' : 'text-warning'">
                {{ openAIStatus.configured ? 'Saved' : 'Not set' }}
              </span>
            </template>
          </SectionHeader>

          <p class="text-sm leading-6 text-muted">
            Your key is encrypted server-side and never shown again after saving. Tests fail with a clear error if it's missing or revoked.
          </p>

          <p v-if="openAIStatus.configured && openAIStatus.updated_at" class="text-xs text-muted">
            Last saved {{ new Date(openAIStatus.updated_at).toLocaleString() }}
          </p>

          <form class="space-y-4" @submit.prevent="saveOpenAIKey">
            <UFormField :label="openAIStatus.configured ? 'Replace the key' : 'API key'" name="apiKey" required>
              <UInput
                v-model="openAIForm.apiKey"
                type="password"
                autocomplete="off"
                placeholder="sk-..."
                required
                class="w-full"
              />
            </UFormField>

            <div class="flex flex-wrap justify-end gap-2">
              <UButton
                v-if="openAIStatus.configured"
                type="button"
                label="Remove key"
                color="neutral"
                variant="ghost"
                :loading="clearingOpenAIKey"
                @click="clearOpenAIKey"
              />
              <UButton
                type="submit"
                :label="openAIStatus.configured ? 'Replace key' : 'Save key'"
                :loading="savingOpenAIKey"
              />
            </div>
          </form>
        </section>

        <section class="space-y-4">
          <SectionHeader
            title="What you need to run Product Warden"
            description="If you're self-hosting, this is the operator checklist."
          />
          <ul class="space-y-3 text-sm leading-6 text-muted">
            <li class="grid gap-3 sm:grid-cols-[20px_1fr]">
              <span class="text-default">·</span>
              <span>A Supabase project with GitHub OAuth enabled.</span>
            </li>
            <li class="grid gap-3 sm:grid-cols-[20px_1fr]">
              <span class="text-default">·</span>
              <span>A GitHub App with contents-write, issues-write, and pull-request-write permissions.</span>
            </li>
            <li class="grid gap-3 sm:grid-cols-[20px_1fr]">
              <span class="text-default">·</span>
              <span>The Supabase migration applied and the private screenshot bucket created.</span>
            </li>
            <li class="grid gap-3 sm:grid-cols-[20px_1fr]">
              <span class="text-default">·</span>
              <span>An encryption secret on the server so saved API keys can be stored safely.</span>
            </li>
            <li class="grid gap-3 sm:grid-cols-[20px_1fr]">
              <span class="text-default">·</span>
              <span>A deploy that includes the Playwright Dockerfile so the browser can launch.</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
