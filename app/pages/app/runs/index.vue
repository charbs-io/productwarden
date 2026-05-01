<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { QaRun } from '~/types'

const toast = useToast()
const stoppingRunId = ref<string | null>(null)

const { data: runs, refresh, pending } = await useFetch<QaRun[]>('/api/runs', {
  default: () => []
})

useIntervalFn(() => refresh(), 5000)

const columns: TableColumn<QaRun>[] = [{
  accessorKey: 'goal',
  header: 'Test'
}, {
  accessorKey: 'target_hostname',
  header: 'Site'
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

function canStopRun(run: QaRun) {
  return ['queued', 'running'].includes(run.status)
}

async function stopRun(run: QaRun) {
  if (!canStopRun(run)) {
    return
  }

  stoppingRunId.value = run.id

  try {
    await $fetch(`/api/runs/${run.id}/stop`, {
      method: 'POST'
    })
    await refresh()
    toast.add({ title: 'Stopped', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't stop the test`, description: getErrorMessage(error), color: 'error' })
  } finally {
    stoppingRunId.value = null
  }
}

function getErrorMessage(error: unknown) {
  const fetchError = error as { data?: { message?: string }, message?: string }
  return fetchError.data?.message || fetchError.message || 'Unexpected error'
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
  <UDashboardPanel id="runs">
    <template #header>
      <UDashboardNavbar title="Tests">
        <template #right>
          <UButton to="/app/runs/new" label="Run a test" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <PageIntro description="Every browser test you've started, newest first. Open one to see the journey, screenshots, findings, and the report." />

        <UTable
          :data="runs"
          :columns="columns"
          :loading="pending"
          empty="No tests yet."
          :ui="{ root: '-mx-2' }"
        >
          <template #goal-cell="{ row }">
            <NuxtLink :to="`/app/runs/${row.original.id}`" class="block min-w-0 hover:underline">
              <p class="line-clamp-1 text-sm font-medium text-default">
                {{ row.original.goal }}
              </p>
            </NuxtLink>
          </template>

          <template #target_hostname-cell="{ row }">
            <span class="truncate text-sm text-muted">{{ row.original.target_hostname }}</span>
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
            <div class="flex justify-end gap-1">
              <UButton
                v-if="canStopRun(row.original)"
                color="neutral"
                variant="ghost"
                size="sm"
                label="Stop"
                :loading="stoppingRunId === row.original.id"
                @click="stopRun(row.original)"
              />
              <UButton
                :to="`/app/runs/${row.original.id}`"
                color="neutral"
                variant="ghost"
                size="sm"
                label="Open"
              />
            </div>
          </template>
        </UTable>
      </div>
    </template>
  </UDashboardPanel>
</template>
