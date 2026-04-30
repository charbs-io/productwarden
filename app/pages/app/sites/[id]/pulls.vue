<script setup lang="ts">
import type { SelectItem, TableColumn } from '@nuxt/ui'
import type { GithubPullRequest, Site } from '~/types'

const route = useRoute()
const toast = useToast()
const siteId = computed(() => String(route.params.id))
const state = ref<'open' | 'closed' | 'all'>('open')
const selectedPull = ref<GithubPullRequest | null>(null)
const question = ref('')
const answer = ref('')
const asking = ref(false)

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

const { data: site } = await useFetch<Site>(() => `/api/sites/${siteId.value}`, {
  default: () => null as unknown as Site
})
const { data: pulls, refresh, pending } = await useFetch<GithubPullRequest[]>(() => `/api/sites/${siteId.value}/github/pulls`, {
  query: computed(() => ({ state: state.value })),
  default: () => []
})

const activeConnection = computed(() => {
  const connection = site.value?.github_connection
  return connection && !connection.disconnected_at ? connection : null
})
const indexReady = computed(() => activeConnection.value?.repository_index_status === 'ready')

const columns: TableColumn<GithubPullRequest>[] = [{
  accessorKey: 'title',
  header: 'Pull request'
}, {
  accessorKey: 'state',
  header: 'State'
}, {
  accessorKey: 'updated_at',
  header: 'Updated'
}, {
  id: 'actions',
  header: ''
}]

watch(state, async () => {
  await refresh()
})

function choosePull(pull: GithubPullRequest) {
  selectedPull.value = pull
  answer.value = ''
  question.value = ''
}

async function askQuestion() {
  if (!selectedPull.value || !question.value.trim()) {
    return
  }

  asking.value = true
  answer.value = ''

  try {
    const response = await $fetch<{ answer: string }>(`/api/sites/${siteId.value}/github/pulls/${selectedPull.value.number}/question`, {
      method: 'POST',
      body: {
        question: question.value
      }
    })
    answer.value = response.answer
  } catch (error: unknown) {
    toast.add({ title: `Couldn't ask the question`, description: getErrorMessage(error), color: 'error' })
  } finally {
    asking.value = false
  }
}

function getErrorMessage(error: unknown) {
  const fetchError = error as { data?: { message?: string }, message?: string }
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
  <UDashboardPanel id="site-pulls">
    <template #header>
      <SiteHeader :site-id="siteId" :title="site?.hostname || 'Pull requests'" />
    </template>

    <template #body>
      <div class="space-y-8">
        <PageIntro
          :description="`Pull requests on ${activeConnection ? activeConnection.full_name : 'the connected repository'}. Pick one to ask a question grounded in the actual diff and indexed code.`"
        />

        <UAlert
          v-if="!activeConnection"
          color="warning"
          variant="subtle"
          icon="i-simple-icons-github"
          title="No repository connected"
          description="Connect a repo on this site before pull requests show up here."
        />

        <div v-else class="grid gap-8 xl:grid-cols-[1fr_400px]">
          <section class="space-y-4">
            <SectionHeader title="Pull requests">
              <template #actions>
                <USelect
                  v-model="state"
                  :items="stateItems"
                  size="sm"
                  class="w-32"
                />
              </template>
            </SectionHeader>

            <UTable
              :data="pulls"
              :columns="columns"
              :loading="pending"
              empty="No pull requests match this filter."
              :ui="{ root: '-mx-2' }"
            >
              <template #title-cell="{ row }">
                <button
                  type="button"
                  class="block min-w-0 text-left hover:underline"
                  @click="choosePull(row.original)"
                >
                  <p class="truncate text-sm font-medium text-default">
                    #{{ row.original.number }} {{ row.original.title }}
                  </p>
                  <p class="truncate text-xs text-muted">
                    {{ row.original.head_ref }} → {{ row.original.base_ref }}
                  </p>
                </button>
              </template>

              <template #state-cell="{ row }">
                <div class="flex items-center gap-2">
                  <span v-if="row.original.merged_at" class="text-sm text-primary">Merged</span>
                  <span v-else-if="row.original.state === 'open'" class="text-sm text-success">Open</span>
                  <span v-else class="text-sm text-muted">Closed</span>
                  <span v-if="row.original.draft" class="text-xs text-warning">draft</span>
                </div>
              </template>

              <template #updated_at-cell="{ row }">
                <span class="text-sm tabular-nums text-muted">{{ relativeTime(row.original.updated_at) }}</span>
              </template>

              <template #actions-cell="{ row }">
                <div class="flex justify-end gap-1">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    label="Ask"
                    @click="choosePull(row.original)"
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
          </section>

          <aside class="space-y-4">
            <SectionHeader title="Ask about this PR" />

            <div v-if="!indexReady" class="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
              The index isn't ready yet ({{ activeConnection.repository_index_status }}). AI Q&A needs an indexed repo.
            </div>

            <p class="text-sm text-muted">
              {{ selectedPull ? `#${selectedPull.number} · ${selectedPull.title}` : 'Pick a pull request from the list to ask about it.' }}
            </p>

            <form class="space-y-3" @submit.prevent="askQuestion">
              <UTextarea
                v-model="question"
                autoresize
                placeholder="What changed, what should I review, where might this break?"
                :disabled="!selectedPull || !indexReady"
                class="w-full"
              />
              <div class="flex justify-end">
                <UButton
                  type="submit"
                  label="Ask"
                  :loading="asking"
                  :disabled="!selectedPull || !question.trim() || !indexReady"
                />
              </div>
            </form>

            <pre v-if="answer" class="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-default bg-elevated/40 p-3 text-sm text-default">{{ answer }}</pre>
          </aside>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
