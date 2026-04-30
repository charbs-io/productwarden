<script setup lang="ts">
import type { QaRun, Site } from '~/types'

const { data: sites } = await useFetch<Site[]>('/api/sites', { default: () => [] })
const { data: runs } = await useFetch<QaRun[]>('/api/runs', { default: () => [] })

const verifiedCount = computed(() => sites.value.filter(site => site.verified_at).length)
const connectedCount = computed(() => sites.value.filter(site => site.github_connection && !site.github_connection.disconnected_at).length)
const runningCount = computed(() => runs.value.filter(run => ['queued', 'running'].includes(run.status)).length)
const issueCount = computed(() => runs.value.reduce((total, run) => total + (run.issue_count || 0), 0))
const recentRuns = computed(() => runs.value.slice(0, 5))
const visibleSites = computed(() => sites.value.slice(0, 6))

const stats = computed(() => [
  { label: 'Sites', value: sites.value.length, hint: `${verifiedCount.value} verified` },
  { label: 'Connected repos', value: connectedCount.value, hint: 'with GitHub' },
  { label: 'Tests in flight', value: runningCount.value, hint: runningCount.value ? 'running now' : 'none right now' },
  { label: 'Findings', value: issueCount.value, hint: 'across all tests' }
])

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
  <UDashboardPanel id="overview">
    <template #header>
      <UDashboardNavbar title="Home">
        <template #right>
          <UButton
            to="/app/runs/new"
            label="Run a test"
            color="primary"
            :disabled="!verifiedCount"
          />
          <UButton
            to="/app/sites/new"
            label="Add a site"
            color="neutral"
            variant="outline"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="!sites.length" class="mx-auto max-w-2xl py-12">
        <p class="text-xs font-semibold tracking-wide text-primary uppercase">
          Welcome to Product Warden
        </p>
        <h1 class="mt-3 text-3xl font-semibold leading-tight text-default">
          Point us at a site you own. We'll send AI customers through it and tell you what's broken.
        </h1>
        <p class="mt-4 text-base leading-7 text-muted">
          Each test opens a real browser, walks through a goal you describe, captures the screen at every step, and writes up the friction, dead ends, and broken behavior it sees. You'll get screenshots, a step-by-step trace, a list of findings, and a markdown report you can hand to your team.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <UButton
            to="/app/sites/new"
            label="Add your first site"
            color="primary"
            size="lg"
          />
          <UButton
            to="/app/setup"
            label="Configure your API key"
            color="neutral"
            variant="ghost"
            size="lg"
          />
        </div>
        <ol class="mt-12 space-y-5 border-t border-default pt-8 text-sm">
          <li class="grid gap-3 sm:grid-cols-[24px_1fr]">
            <span class="font-semibold tabular-nums text-muted">01</span>
            <span><span class="font-medium text-default">Add and verify a site.</span> Drop in a meta tag or DNS record so we know it's yours.</span>
          </li>
          <li class="grid gap-3 sm:grid-cols-[24px_1fr]">
            <span class="font-semibold tabular-nums text-muted">02</span>
            <span><span class="font-medium text-default">Pick a persona and describe a journey.</span> Sign up, check out, invite a teammate &mdash; whatever your customers actually do.</span>
          </li>
          <li class="grid gap-3 sm:grid-cols-[24px_1fr]">
            <span class="font-semibold tabular-nums text-muted">03</span>
            <span><span class="font-medium text-default">Review the evidence.</span> Open the trace, watch the video, read the report, and ship the fixes.</span>
          </li>
        </ol>
      </div>

      <div v-else class="space-y-10">
        <section>
          <p class="text-xs font-semibold tracking-wide text-primary uppercase">
            Product Warden
          </p>
          <h1 class="mt-2 max-w-3xl text-2xl font-semibold leading-snug text-default">
            AI customers, walking your site, telling you what's broken.
          </h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Start a test from a verified site, watch the browser work through the goal, and review screenshots, a step trace, findings, and a written report when it's done.
          </p>
        </section>

        <StatStrip :items="stats" />

        <section class="space-y-4">
          <SectionHeader
            title="Recent tests"
            description="The most recent runs across every site you own."
          >
            <template #actions>
              <UButton
                to="/app/runs"
                label="See all"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </template>
          </SectionHeader>

          <div v-if="recentRuns.length" class="divide-y divide-default border-b border-default">
            <NuxtLink
              v-for="run in recentRuns"
              :key="run.id"
              :to="`/app/runs/${run.id}`"
              class="grid grid-cols-[1fr_auto] items-center gap-4 py-3 transition hover:bg-elevated/40 sm:grid-cols-[1fr_120px_120px_100px]"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-default">
                  {{ run.target_hostname }}
                </p>
                <p class="line-clamp-1 text-xs text-muted">
                  {{ run.goal }}
                </p>
              </div>
              <UBadge :color="statusColor(run.status)" variant="subtle" class="hidden sm:inline-flex">
                {{ statusLabel(run.status) }}
              </UBadge>
              <span class="hidden text-sm tabular-nums text-muted sm:inline-block">
                {{ run.issue_count || 0 }} {{ run.issue_count === 1 ? 'finding' : 'findings' }}
              </span>
              <span class="text-right text-xs tabular-nums text-muted">
                {{ relativeTime(run.created_at) }}
              </span>
            </NuxtLink>
          </div>
          <p v-else class="text-sm text-muted">
            No tests yet. <NuxtLink to="/app/runs/new" class="font-medium text-primary hover:underline">Start your first one.</NuxtLink>
          </p>
        </section>

        <section class="space-y-4">
          <SectionHeader
            title="Sites"
            description="Verified hostnames you can run tests against."
          >
            <template #actions>
              <UButton
                to="/app/sites"
                label="See all"
                color="neutral"
                variant="ghost"
                size="sm"
              />
            </template>
          </SectionHeader>

          <div class="divide-y divide-default border-b border-default">
            <NuxtLink
              v-for="site in visibleSites"
              :key="site.id"
              :to="`/app/sites/${site.id}`"
              class="grid grid-cols-[1fr_auto] items-center gap-4 py-3 transition hover:bg-elevated/40 sm:grid-cols-[1fr_140px_160px]"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-default">
                  {{ site.hostname }}
                </p>
                <p class="truncate text-xs text-muted">
                  {{ site.base_url }}
                </p>
              </div>
              <span class="hidden text-sm sm:inline-block">
                <span v-if="site.verified_at" class="text-success">Verified</span>
                <span v-else class="text-warning">Awaiting verification</span>
              </span>
              <span class="hidden truncate text-sm text-muted sm:inline-block">
                {{ site.github_connection && !site.github_connection.disconnected_at ? site.github_connection.full_name : 'No repo connected' }}
              </span>
            </NuxtLink>
          </div>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
