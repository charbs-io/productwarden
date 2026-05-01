<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { QaRun, Site } from '~/types'

const route = useRoute()
const siteId = computed(() => String(route.params.id))

const { data: site } = await useFetch<Site>(() => `/api/sites/${siteId.value}`, {
  default: () => null as unknown as Site
})
const { data: runs, refresh, pending } = await useFetch<QaRun[]>(() => `/api/sites/${siteId.value}/runs`, {
  default: () => []
})

useIntervalFn(() => refresh(), 5000)

const columns: TableColumn<QaRun>[] = [{
  accessorKey: 'goal',
  header: 'Test'
}, {
  accessorKey: 'status',
  header: 'Status'
}, {
  accessorKey: 'issue_count',
  header: 'Findings'
}, {
  accessorKey: 'created_at',
  header: 'Started'
}, {
  id: 'actions',
  header: ''
}]

function statusColor(status: QaRun['status']) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'blocked':
      return 'warning'
    case 'cancelled':
      return 'neutral'
    default:
      return 'info'
  }
}

function statusLabel(status: QaRun['status']) {
  switch (status) {
    case 'queued':
      return 'Queued'
    case 'running':
      return 'Running'
    case 'completed':
      return 'Done'
    case 'blocked':
      return 'Blocked'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Stopped'
    default:
      return status
  }
}

function relativeTime(value: string) {
  const ms = Date.now() - new Date(value).getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}
</script>

<template>
  <UDashboardPanel id="site-runs">
    <template #header>
      <SiteHeader :site-id="siteId" :title="site?.hostname || 'Site'">
        <template #right>
          <UButton :to="`/app/runs/new?site=${siteId}`" label="Run a test" />
        </template>
      </SiteHeader>
    </template>

    <template #body>
      <div class="space-y-8">
        <dl class="grid grid-cols-1 gap-x-8 gap-y-4 border-b border-default pb-6 sm:grid-cols-3">
          <div class="min-w-0">
            <dt class="text-xs font-medium text-muted uppercase tracking-wide">
              Base URL
            </dt>
            <dd class="mt-1.5 truncate text-sm text-default">
              {{ site?.base_url }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs font-medium text-muted uppercase tracking-wide">
              Ownership
            </dt>
            <dd class="mt-1.5 text-sm">
              <span v-if="site?.verified_at" class="text-success">Verified</span>
              <span v-else class="text-warning">Awaiting verification</span>
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs font-medium text-muted uppercase tracking-wide">
              Repository
            </dt>
            <dd class="mt-1.5 truncate text-sm text-default">
              {{ site?.github_connection && !site.github_connection.disconnected_at ? site.github_connection.full_name : '—' }}
            </dd>
          </div>
        </dl>

        <section class="space-y-4">
          <SectionHeader
            title="Tests"
            description="Every test ever run against this site, newest first."
          >
            <template #actions>
              <UButton
                :to="`/app/runs/new?site=${siteId}`"
                color="neutral"
                variant="outline"
                size="sm"
                label="Run a test"
              />
            </template>
          </SectionHeader>

          <UTable
            :data="runs"
            :columns="columns"
            :loading="pending"
            empty="No tests for this site yet."
            :ui="{ root: '-mx-2' }"
          >
            <template #goal-cell="{ row }">
              <NuxtLink :to="`/app/runs/${row.original.id}`" class="block min-w-0 hover:underline">
                <p class="line-clamp-1 text-sm font-medium text-default">
                  {{ row.original.goal }}
                </p>
                <p class="truncate text-xs text-muted">
                  {{ row.original.target_url }}
                </p>
              </NuxtLink>
            </template>

            <template #status-cell="{ row }">
              <UBadge :color="statusColor(row.original.status)" variant="subtle">
                {{ statusLabel(row.original.status) }}
              </UBadge>
            </template>

            <template #issue_count-cell="{ row }">
              <span class="text-sm tabular-nums text-default">{{ row.original.issue_count || 0 }}</span>
            </template>

            <template #created_at-cell="{ row }">
              <span class="text-sm tabular-nums text-muted">{{ relativeTime(row.original.created_at) }}</span>
            </template>

            <template #actions-cell="{ row }">
              <UButton
                :to="`/app/runs/${row.original.id}`"
                color="neutral"
                variant="ghost"
                size="sm"
                label="Open"
              />
            </template>
          </UTable>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
