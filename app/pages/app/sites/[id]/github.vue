<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui'
import type { Site } from '~/types'

type GithubRepositoryOption = {
  id: number
  full_name: string
  owner: string
  html_url: string
  default_branch: string
  permissions: Record<string, boolean>
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const siteId = computed(() => String(route.params.id))
const installationId = computed(() => Number(route.query.installation_id || 0))

const { data: site, refresh } = await useFetch<Site>(() => `/api/sites/${siteId.value}`, {
  default: () => null as unknown as Site
})

const repositories = ref<GithubRepositoryOption[]>([])
const repositoriesPending = ref(false)
const connecting = ref(false)
const saving = ref(false)
const disconnecting = ref(false)
const reindexing = ref(false)
const selectedRepositoryId = ref<number | null>(null)
const settings = reactive({
  useRepositoryContext: true,
  allowIssueCreation: false,
  allowPrCreation: false
})

const activeConnection = computed(() => {
  const connection = site.value?.github_connection
  return connection && !connection.disconnected_at ? connection : null
})
const repositoryItems = computed<SelectItem[]>(() => repositories.value.map(repository => ({
  label: repository.full_name,
  value: repository.id
})))

watchEffect(() => {
  if (!activeConnection.value) {
    return
  }

  selectedRepositoryId.value = activeConnection.value.repository_id
  settings.useRepositoryContext = activeConnection.value.use_repository_context
  settings.allowIssueCreation = activeConnection.value.allow_issue_creation
  settings.allowPrCreation = activeConnection.value.allow_pr_creation
})

watch(
  () => activeConnection.value?.repository_index_status,
  (status, _previousStatus, onCleanup) => {
    if (!import.meta.client || status !== 'indexing') {
      return
    }

    const timer = window.setInterval(() => {
      void refresh()
    }, 2500)
    onCleanup(() => window.clearInterval(timer))
  },
  { immediate: true }
)

onMounted(async () => {
  if (installationId.value) {
    await loadRepositories()
  }
})

async function connectGithub() {
  connecting.value = true

  try {
    const response = await $fetch<{ url: string }>(`/api/sites/${siteId.value}/github/connect`, { method: 'POST' })
    await navigateTo(response.url, { external: true })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't start GitHub setup`, description: getErrorMessage(error), color: 'error' })
  } finally {
    connecting.value = false
  }
}

async function loadRepositories() {
  repositoriesPending.value = true

  try {
    repositories.value = await $fetch<GithubRepositoryOption[]>(`/api/sites/${siteId.value}/github/repositories`, {
      query: { installationId: installationId.value }
    })
    selectedRepositoryId.value = repositories.value[0]?.id || selectedRepositoryId.value
  } catch (error: unknown) {
    toast.add({ title: `Couldn't load repositories`, description: getErrorMessage(error), color: 'error' })
  } finally {
    repositoriesPending.value = false
  }
}

async function saveConnection() {
  const repositoryId = selectedRepositoryId.value || activeConnection.value?.repository_id
  const targetInstallationId = installationId.value || activeConnection.value?.installation_id

  if (!repositoryId || !targetInstallationId) {
    toast.add({ title: 'Pick a repository first', color: 'warning' })
    return
  }

  saving.value = true

  try {
    await $fetch(`/api/sites/${siteId.value}/github`, {
      method: 'PUT',
      body: {
        installationId: targetInstallationId,
        repositoryId,
        useRepositoryContext: settings.useRepositoryContext,
        allowIssueCreation: settings.allowIssueCreation,
        allowPrCreation: settings.allowPrCreation
      }
    })
    await refresh()
    await router.replace(`/app/sites/${siteId.value}/github`)
    toast.add({ title: 'Saved', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't save`, description: getErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function disconnectGithub() {
  if (!window.confirm('Disconnect this repository? Tests will lose code context until you reconnect.')) {
    return
  }
  disconnecting.value = true

  try {
    await $fetch(`/api/sites/${siteId.value}/github`, { method: 'DELETE' })
    await refresh()
    selectedRepositoryId.value = null
    toast.add({ title: 'Disconnected', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't disconnect`, description: getErrorMessage(error), color: 'error' })
  } finally {
    disconnecting.value = false
  }
}

async function reindexRepository() {
  reindexing.value = true

  try {
    await $fetch(`/api/sites/${siteId.value}/github/reindex`, { method: 'POST' })
    await refresh()
    toast.add({ title: 'Re-indexing started', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't start indexing`, description: getErrorMessage(error), color: 'error' })
  } finally {
    reindexing.value = false
  }
}

function indexLabel(connection: NonNullable<Site['github_connection']>) {
  switch (connection.repository_index_status) {
    case 'ready': return 'Ready'
    case 'indexing': return 'Indexing'
    case 'failed': return 'Failed'
    default: return 'Not indexed'
  }
}

function indexLabelColor(connection: NonNullable<Site['github_connection']>) {
  switch (connection.repository_index_status) {
    case 'ready': return 'text-success'
    case 'indexing': return 'text-info'
    case 'failed': return 'text-error'
    default: return 'text-muted'
  }
}

function indexProgressText(connection: NonNullable<Site['github_connection']>) {
  if (connection.repository_index_status === 'ready') {
    return `${connection.repository_index_file_count} files indexed`
  }

  if (connection.repository_index_status === 'failed') {
    return 'Indexing hit an error'
  }

  if (connection.repository_index_status !== 'indexing') {
    return 'Run a full index to enable code context'
  }

  const processed = connection.repository_index_processed_file_count || 0
  const total = connection.repository_index_total_file_count || 0

  switch (connection.repository_index_stage) {
    case 'queued':
      return 'Waiting for a worker'
    case 'preparing':
      return 'Preparing repository'
    case 'fetching':
      return total ? `Fetching files (${processed}/${total})` : 'Finding files to index'
    case 'uploading':
      return total ? `Uploading files (${processed}/${total})` : 'Uploading files'
    case 'indexing':
      return total ? `Finalizing index (${processed}/${total})` : 'Finalizing index'
    default:
      return 'Indexing'
  }
}

function indexProgressPercent(connection: NonNullable<Site['github_connection']>) {
  if (connection.repository_index_status === 'ready') {
    return 100
  }

  if (connection.repository_index_status !== 'indexing') {
    return 0
  }

  const processed = connection.repository_index_processed_file_count || 0
  const total = connection.repository_index_total_file_count || 0
  const ratio = total > 0 ? Math.min(processed / total, 1) : 0

  switch (connection.repository_index_stage) {
    case 'queued':
      return 5
    case 'preparing':
      return 12
    case 'fetching':
      return Math.max(12, Math.round(12 + ratio * 28))
    case 'uploading':
      return Math.max(40, Math.round(40 + ratio * 35))
    case 'indexing':
      return Math.max(75, Math.round(75 + ratio * 20))
    default:
      return 18
  }
}

function getErrorMessage(error: unknown) {
  const fetchError = error as { data?: { message?: string }, message?: string }
  return fetchError.data?.message || fetchError.message || 'Unexpected error'
}
</script>

<template>
  <UDashboardPanel id="site-github">
    <template #header>
      <SiteHeader :site-id="siteId" :title="site?.hostname || 'GitHub'" />
    </template>

    <template #body>
      <div class="mx-auto max-w-3xl space-y-10">
        <PageIntro description="Connect the codebase behind this site. Once a repo is indexed, tests can reason about likely fix locations and — if you allow it — open issues or pull requests directly." />

        <UAlert
          v-if="!site?.verified_at"
          color="warning"
          variant="subtle"
          icon="i-lucide-shield-alert"
          title="Verify the site first"
          description="GitHub can be connected after ownership is verified."
        />

        <section class="space-y-4">
          <SectionHeader title="Repository">
            <template #actions>
              <span class="text-sm font-medium" :class="activeConnection ? 'text-success' : 'text-muted'">
                {{ activeConnection ? 'Connected' : 'Not connected' }}
              </span>
            </template>
          </SectionHeader>

          <div v-if="activeConnection" class="space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-default">
                  {{ activeConnection.full_name }}
                </p>
                <a :href="activeConnection.html_url" target="_blank" class="truncate text-xs text-muted hover:text-default hover:underline">
                  {{ activeConnection.html_url }}
                </a>
              </div>
              <UButton
                :to="activeConnection.html_url"
                target="_blank"
                color="neutral"
                variant="ghost"
                size="sm"
                label="Open on GitHub"
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3 text-sm">
                <span :class="indexLabelColor(activeConnection)">{{ indexLabel(activeConnection) }}</span>
                <span class="text-xs text-muted">
                  {{ indexProgressText(activeConnection) }}
                </span>
              </div>
              <div v-if="activeConnection.repository_index_status === 'indexing'" class="h-1 overflow-hidden rounded-full bg-elevated">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-500"
                  :style="{ width: `${indexProgressPercent(activeConnection)}%` }"
                />
              </div>
              <p v-if="activeConnection.repository_index_error" class="text-xs text-error">
                {{ activeConnection.repository_index_error }}
              </p>
              <p v-if="activeConnection.repository_indexed_at" class="text-xs text-muted">
                Last indexed {{ new Date(activeConnection.repository_indexed_at).toLocaleString() }}
              </p>
            </div>
          </div>

          <div v-if="installationId">
            <UFormField label="Pick a repository to connect" name="repository">
              <USelect
                v-model="selectedRepositoryId"
                :items="repositoryItems"
                :loading="repositoriesPending"
                placeholder="Choose repository"
                class="w-full"
              />
            </UFormField>
          </div>

          <UButton
            v-if="!activeConnection && !installationId"
            icon="i-simple-icons-github"
            label="Connect a repository"
            :loading="connecting"
            :disabled="!site?.verified_at"
            @click="connectGithub"
          />
        </section>

        <section v-if="activeConnection || installationId" class="space-y-4">
          <SectionHeader
            title="Permissions"
            description="What this connection is allowed to do."
          />

          <div class="space-y-3">
            <USwitch
              v-model="settings.useRepositoryContext"
              label="Use code context in tests"
              description="Tests can read indexed files to ground findings and suggested fixes."
            />
            <USwitch
              v-model="settings.allowIssueCreation"
              label="Allow opening GitHub issues"
              description="Tests can create issues for findings when you click Create issue."
            />
            <USwitch
              v-model="settings.allowPrCreation"
              label="Allow opening pull requests"
              description="Tests can open a draft PR with a suggested fix when you click Fix."
            />
          </div>
        </section>

        <section v-if="activeConnection || installationId" class="flex flex-wrap justify-end gap-2 border-t border-default pt-6">
          <UButton
            v-if="activeConnection && settings.useRepositoryContext"
            color="neutral"
            variant="outline"
            label="Re-index"
            :loading="reindexing || activeConnection.repository_index_status === 'indexing'"
            @click="reindexRepository"
          />
          <UButton
            v-if="activeConnection"
            color="neutral"
            variant="ghost"
            label="Disconnect"
            :loading="disconnecting"
            @click="disconnectGithub"
          />
          <UButton
            label="Save"
            :loading="saving"
            @click="saveConnection"
          />
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
