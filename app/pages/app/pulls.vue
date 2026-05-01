<script setup lang="ts">
import type { SelectItem, TableColumn } from '@nuxt/ui'
import type { AggregateGithubPullRequest, GithubPullsResponse, Site } from '~/types'

type PullStateFilter = 'open' | 'closed' | 'all'
type DraftFilter = 'all' | 'draft' | 'ready'

const state = ref<PullStateFilter>('open')
const siteId = ref('all')
const draft = ref<DraftFilter>('all')
const search = ref('')

const stateItems: SelectItem[] = [{
  label: 'Open',
  value: 'open'
}, {
  label: 'Closed',
  value: 'closed'
}, {
  label: 'All',
  value: 'all'
}]

const draftItems: SelectItem[] = [{
  label: 'All PRs',
  value: 'all'
}, {
  label: 'Draft only',
  value: 'draft'
}, {
  label: 'Ready only',
  value: 'ready'
}]

const { data: sites } = await useFetch<Site[]>('/api/sites', {
  default: () => []
})

const siteItems = computed<SelectItem[]>(() => [{
  label: 'All sites',
  value: 'all'
}, ...sites.value
  .filter(site => site.github_connection && !site.github_connection.disconnected_at)
  .map(site => ({
    label: site.hostname,
    value: site.id
  }))])

const pullQuery = computed(() => ({
  state: state.value,
  siteId: siteId.value === 'all' ? undefined : siteId.value
}))

const {
  data: response,
  pending,
  refresh,
  error
} = await useFetch<GithubPullsResponse>('/api/github/pulls', {
  query: pullQuery,
  default: () => ({
    pulls: [],
    connection_count: 0,
    failures: []
  })
})

const pulls = computed(() => response.value?.pulls || [])
const failures = computed(() => response.value?.failures || [])
const connectedCount = computed(() => response.value?.connection_count || 0)

const filteredPulls = computed(() => {
  const query = search.value.trim().toLowerCase()

  return pulls.value.filter((pull) => {
    if (draft.value === 'draft' && !pull.draft) {
      return false
    }

    if (draft.value === 'ready' && pull.draft) {
      return false
    }

    if (!query) {
      return true
    }

    const searchable = [
      pull.title,
      String(pull.number),
      pull.user_login,
      pull.head_ref,
      pull.base_ref,
      pull.site_hostname,
      pull.repository_full_name
    ].join(' ').toLowerCase()

    return searchable.includes(query)
  })
})

const hasFilters = computed(() => Boolean(search.value.trim())
  || draft.value !== 'all'
  || state.value !== 'open'
  || siteId.value !== 'all')
const failureDescription = computed(() => failures.value
  .slice(0, 3)
  .map(failure => `${failure.site_hostname}: ${failure.message}`)
  .join('; '))

const columns: TableColumn<AggregateGithubPullRequest>[] = [{
  accessorKey: 'title',
  header: 'Pull request'
}, {
  accessorKey: 'site_hostname',
  header: 'Site'
}, {
  accessorKey: 'state',
  header: 'State'
}, {
  accessorKey: 'user_login',
  header: 'Author'
}, {
  accessorKey: 'updated_at',
  header: 'Updated'
}, {
  id: 'actions',
  header: ''
}]

function clearFilters() {
  state.value = 'open'
  siteId.value = 'all'
  draft.value = 'all'
  search.value = ''
}

async function refreshPulls() {
  await refresh()
}

function getErrorMessage(errorValue: unknown) {
  const fetchError = errorValue as { data?: { message?: string }, message?: string }
  return fetchError.data?.message || fetchError.message || 'Unexpected error'
}

function relativeTime(value: string) {
  const ms = Date.now() - new Date(value).getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}
</script>

<template>
  <UDashboardPanel id="pulls">
    <template #header>
      <UDashboardNavbar title="Pull requests">
        <template #right>
          <UButton
            color="neutral"
            variant="outline"
            label="Refresh"
            :loading="pending"
            @click="refreshPulls"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <PageIntro :description="connectedCount ? `Pull requests across the ${connectedCount} ${connectedCount === 1 ? 'repository' : 'repositories'} you've connected. Use the filters to narrow down by site, state, or draft status.` : 'Connect a GitHub repo on a site to start seeing pull requests here.'" />

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Couldn't load pull requests"
          :description="getErrorMessage(error)"
        />

        <UAlert
          v-if="!pending && !connectedCount"
          color="warning"
          variant="subtle"
          icon="i-simple-icons-github"
          title="No connected repositories"
          description="Connect a repository on one of your sites to see pull requests."
        />

        <UAlert
          v-if="failures.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Some repositories couldn't be loaded"
          :description="failureDescription"
        />

        <div v-if="connectedCount" class="grid items-end gap-3 border-b border-default pb-4 lg:grid-cols-[160px_220px_160px_1fr_auto]">
          <UFormField label="State" name="state" size="sm">
            <USelect v-model="state" :items="stateItems" class="w-full" />
          </UFormField>

          <UFormField label="Site" name="site" size="sm">
            <USelect v-model="siteId" :items="siteItems" class="w-full" />
          </UFormField>

          <UFormField label="Draft" name="draft" size="sm">
            <USelect v-model="draft" :items="draftItems" class="w-full" />
          </UFormField>

          <UFormField label="Search" name="search" size="sm">
            <UInput
              v-model="search"
              placeholder="Title, author, branch, or repo"
              class="w-full"
            />
          </UFormField>

          <UButton
            color="neutral"
            variant="ghost"
            label="Clear"
            :disabled="!hasFilters"
            @click="clearFilters"
          />
        </div>

        <UTable
          v-if="connectedCount"
          :data="filteredPulls"
          :columns="columns"
          :loading="pending"
          empty="No pull requests match these filters."
          :ui="{ root: '-mx-2' }"
        >
          <template #title-cell="{ row }">
            <a :href="row.original.html_url" target="_blank" class="block min-w-0 hover:underline">
              <p class="truncate text-sm font-medium text-default">
                #{{ row.original.number }} {{ row.original.title }}
              </p>
              <p class="truncate text-xs text-muted">
                {{ row.original.head_ref }} → {{ row.original.base_ref }}
              </p>
            </a>
          </template>

          <template #site_hostname-cell="{ row }">
            <NuxtLink :to="`/app/sites/${row.original.site_id}/pulls`" class="block min-w-0 hover:underline">
              <p class="truncate text-sm text-default">
                {{ row.original.site_hostname }}
              </p>
              <p class="truncate text-xs text-muted">
                {{ row.original.repository_full_name }}
              </p>
            </NuxtLink>
          </template>

          <template #state-cell="{ row }">
            <div class="flex items-center gap-2">
              <span v-if="row.original.merged_at" class="text-sm text-primary">Merged</span>
              <span v-else-if="row.original.state === 'open'" class="text-sm text-success">Open</span>
              <span v-else class="text-sm text-muted">Closed</span>
              <span v-if="row.original.draft" class="text-xs text-warning">draft</span>
            </div>
          </template>

          <template #user_login-cell="{ row }">
            <span class="text-sm text-muted">@{{ row.original.user_login }}</span>
          </template>

          <template #updated_at-cell="{ row }">
            <span class="text-sm tabular-nums text-muted">{{ relativeTime(row.original.updated_at) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                :to="`/app/sites/${row.original.site_id}/pulls`"
                color="neutral"
                variant="ghost"
                size="sm"
                label="Ask"
              />
              <UButton
                :to="row.original.html_url"
                target="_blank"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-external-link"
                aria-label="Open on GitHub"
              />
            </div>
          </template>
        </UTable>
      </div>
    </template>
  </UDashboardPanel>
</template>
