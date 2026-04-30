<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Site } from '~/types'

const route = useRoute()
const toast = useToast()
const deletingSiteId = ref<string | null>(null)
const { data: sites, pending, refresh } = await useFetch<Site[]>('/api/sites', {
  default: () => []
})

onMounted(() => {
  if (route.query.github_error) {
    toast.add({
      title: 'GitHub connection failed',
      description: String(route.query.github_error),
      color: 'error'
    })
  }
})

const columns: TableColumn<Site>[] = [{
  accessorKey: 'hostname',
  header: 'Site'
}, {
  accessorKey: 'verified_at',
  header: 'Ownership'
}, {
  accessorKey: 'github_connection',
  header: 'Repository'
}, {
  accessorKey: 'created_at',
  header: 'Added'
}, {
  id: 'actions',
  header: ''
}]

async function deleteSite(site: Site) {
  if (!window.confirm(`Remove ${site.hostname}? Past test history is kept, but new tests can't run against it until you add it back.`)) {
    return
  }

  deletingSiteId.value = site.id

  try {
    await $fetch(`/api/sites/${site.id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Site removed', description: `${site.hostname} is gone.`, color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't remove site`, description: getErrorMessage(error), color: 'error' })
  } finally {
    deletingSiteId.value = null
  }
}

function getErrorMessage(error: unknown) {
  const fetchError = error as { data?: { message?: string }, message?: string }
  return fetchError.data?.message || fetchError.message || 'Unexpected error'
}

function relativeTime(value: string) {
  const ms = Date.now() - new Date(value).getTime()
  const days = Math.round(ms / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}
</script>

<template>
  <UDashboardPanel id="sites">
    <template #header>
      <UDashboardNavbar title="Sites">
        <template #right>
          <UButton to="/app/sites/new" label="Add a site" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <PageIntro description="Sites are the websites you've proven you own. Tests can only run against a verified hostname. Connect a GitHub repo to give tests code context and turn findings into issues or pull requests." />

        <UTable
          :data="sites"
          :columns="columns"
          :loading="pending"
          empty="No sites yet. Add one to get started."
          :ui="{
            root: '-mx-2',
            thead: '[&>tr]:border-default',
            tbody: '[&>tr]:border-default'
          }"
        >
          <template #hostname-cell="{ row }">
            <NuxtLink :to="`/app/sites/${row.original.id}`" class="block min-w-0 hover:underline">
              <p class="truncate text-sm font-medium text-default">
                {{ row.original.hostname }}
              </p>
              <p class="truncate text-xs text-muted">
                {{ row.original.base_url }}
              </p>
            </NuxtLink>
          </template>

          <template #verified_at-cell="{ row }">
            <span v-if="row.original.verified_at" class="text-sm text-success">Verified</span>
            <span v-else class="text-sm text-warning">Awaiting verification</span>
          </template>

          <template #github_connection-cell="{ row }">
            <span class="text-sm text-muted">
              {{ row.original.github_connection && !row.original.github_connection.disconnected_at ? row.original.github_connection.full_name : '—' }}
            </span>
          </template>

          <template #created_at-cell="{ row }">
            <span class="text-sm text-muted">{{ relativeTime(row.original.created_at) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                :to="`/app/sites/${row.original.id}`"
                color="neutral"
                variant="ghost"
                size="sm"
                label="Open"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                aria-label="Remove site"
                :loading="deletingSiteId === row.original.id"
                :disabled="Boolean(deletingSiteId)"
                @click="deleteSite(row.original)"
              />
            </div>
          </template>
        </UTable>
      </div>
    </template>
  </UDashboardPanel>
</template>
