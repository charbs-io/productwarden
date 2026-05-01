<script setup lang="ts">
import type { QaIssue, QaRun, QaRunPersona, QaStep } from '~/types'

const route = useRoute()
const toast = useToast()
const stopPending = ref(false)
const selectedPersonaId = ref('all')
const creatingIssueId = ref<string | null>(null)
const creatingPrId = ref<string | null>(null)
const selectedScreenshot = ref<{ src: string, title: string, alt: string } | null>(null)

const { data, refresh, pending } = await useFetch<{
  run: QaRun
  personas: QaRunPersona[]
  steps: QaStep[]
  issues: QaIssue[]
  github: {
    full_name: string
    allow_issue_creation: boolean
    allow_pr_creation: boolean
    repository_index_status: string
  } | null
}>(() => `/api/runs/${route.params.id}`, {
  default: () => ({ run: null as unknown as QaRun, personas: [], steps: [], issues: [], github: null })
})

const terminal = computed(() => ['completed', 'blocked', 'failed', 'cancelled'].includes(data.value.run?.status))
const canStop = computed(() => ['queued', 'running'].includes(data.value.run?.status))
const selectedPersona = computed(() => data.value.personas.find(persona => persona.id === selectedPersonaId.value) || null)
const personaNameById = computed(() => new Map(data.value.personas.map(persona => [persona.id, persona.name])))
const visibleSteps = computed(() => selectedPersona.value
  ? data.value.steps.filter(step => step.persona_run_id === selectedPersona.value?.id)
  : data.value.steps)
const visibleIssues = computed(() => selectedPersona.value
  ? data.value.issues.filter(issue => issue.persona_run_id === selectedPersona.value?.id)
  : data.value.issues)
const visibleReport = computed(() => selectedPersona.value
  ? selectedPersona.value.report_md
  : data.value.run?.report_md)
const visibleVideoUrl = computed(() => selectedPersona.value?.video_url || (!selectedPersona.value ? data.value.run?.video_url : null))
const screenshotModalOpen = computed({
  get: () => Boolean(selectedScreenshot.value),
  set: (open) => {
    if (!open) {
      selectedScreenshot.value = null
    }
  }
})

useIntervalFn(() => {
  if (!terminal.value) {
    refresh()
  }
}, 2000)

const reportUrl = computed(() => {
  const base = `/api/runs/${route.params.id}/report`
  return selectedPersona.value ? `${base}?personaRunId=${selectedPersona.value.id}` : base
})

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

function severityColor(severity: QaIssue['severity']) {
  switch (severity) {
    case 'high': return 'text-error'
    case 'medium': return 'text-warning'
    default: return 'text-muted'
  }
}

function issuePersonaName(issue: QaIssue) {
  return issue.persona_run_id ? personaNameById.value.get(issue.persona_run_id) || 'Persona' : 'Run'
}

function canCreateGithubIssue(issue: QaIssue) {
  return Boolean(data.value.github?.allow_issue_creation && !issue.github_issue_url)
}

function canCreateGithubPullRequest(issue: QaIssue) {
  return Boolean(
    data.value.github?.allow_pr_creation
    && data.value.github.repository_index_status === 'ready'
    && !issue.github_pr_url
  )
}

function openScreenshot(step: QaStep) {
  if (!step.screenshot_url) {
    return
  }

  selectedScreenshot.value = {
    src: step.screenshot_url,
    title: `Step ${step.step_number} screenshot`,
    alt: `Screenshot captured during step ${step.step_number}`
  }
}

async function stopRun() {
  if (!data.value.run || !canStop.value) {
    return
  }

  stopPending.value = true

  try {
    data.value.run = await $fetch<QaRun>(`/api/runs/${route.params.id}/stop`, {
      method: 'POST'
    })
    await refresh()
    toast.add({ title: 'Stopped', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't stop the test`, description: getErrorMessage(error), color: 'error' })
  } finally {
    stopPending.value = false
  }
}

async function createGithubIssue(issue: QaIssue) {
  creatingIssueId.value = issue.id

  try {
    await $fetch(`/api/issues/${issue.id}/github/issue`, { method: 'POST' })
    await refresh()
    toast.add({ title: 'GitHub issue opened', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't create the issue`, description: getErrorMessage(error), color: 'error' })
  } finally {
    creatingIssueId.value = null
  }
}

async function createGithubPullRequest(issue: QaIssue) {
  creatingPrId.value = issue.id

  try {
    await $fetch(`/api/issues/${issue.id}/github/pull-request`, { method: 'POST' })
    await refresh()
    toast.add({ title: 'Pull request opened', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't open the pull request`, description: getErrorMessage(error), color: 'error' })
  } finally {
    creatingPrId.value = null
  }
}

function getErrorMessage(error: unknown) {
  const fetchError = error as { data?: { message?: string }, message?: string }
  return fetchError.data?.message || fetchError.message || 'Unexpected error'
}
</script>

<template>
  <div class="contents">
    <UDashboardPanel id="run-detail">
      <template #header>
        <UDashboardNavbar :title="data.run?.target_hostname || 'Test'">
          <template #right>
            <UButton
              v-if="canStop"
              color="neutral"
              variant="outline"
              label="Stop"
              :loading="stopPending"
              @click="stopRun"
            />
            <UButton
              :to="reportUrl"
              target="_blank"
              color="neutral"
              variant="outline"
              label="Open markdown"
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div v-if="pending && !data.run" class="p-8">
          <UProgress animation="carousel" />
        </div>

        <div v-else-if="data.run" class="space-y-10">
          <section>
            <p class="text-xs font-semibold tracking-wide text-muted uppercase">
              Goal
            </p>
            <p class="mt-2 max-w-3xl text-base leading-7 text-default">
              {{ data.run.goal }}
            </p>
          </section>

          <dl class="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-default py-5 sm:grid-cols-4">
            <div>
              <dt class="text-xs font-medium text-muted uppercase tracking-wide">
                Status
              </dt>
              <dd class="mt-1.5">
                <UBadge :color="statusColor(data.run.status)" variant="subtle">
                  {{ statusLabel(data.run.status) }}
                </UBadge>
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted uppercase tracking-wide">
                Personas
              </dt>
              <dd class="mt-1.5 text-2xl font-semibold tabular-nums text-default">
                {{ data.personas.length || 1 }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted uppercase tracking-wide">
                Steps
              </dt>
              <dd class="mt-1.5 text-2xl font-semibold tabular-nums text-default">
                {{ data.steps.length }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted uppercase tracking-wide">
                Findings
              </dt>
              <dd class="mt-1.5 text-2xl font-semibold tabular-nums text-default">
                {{ data.issues.length }}
              </dd>
            </div>
          </dl>

          <UAlert
            v-if="data.run.error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            title="Test ran into an error"
            :description="data.run.error"
          />

          <div v-if="data.personas.length" class="flex flex-wrap items-center gap-2 border-b border-default pb-3">
            <span class="mr-2 text-xs font-medium text-muted uppercase tracking-wide">View</span>
            <UButton
              color="neutral"
              :variant="selectedPersonaId === 'all' ? 'solid' : 'ghost'"
              size="sm"
              label="Combined"
              @click="selectedPersonaId = 'all'"
            />
            <UButton
              v-for="persona in data.personas"
              :key="persona.id"
              color="neutral"
              :variant="selectedPersonaId === persona.id ? 'solid' : 'ghost'"
              size="sm"
              :label="persona.name"
              @click="selectedPersonaId = persona.id"
            />
          </div>

          <section v-if="visibleVideoUrl" class="space-y-4">
            <SectionHeader
              :title="selectedPersona ? `${selectedPersona.name} — recording` : 'Recording'"
              description="The full browser session, captured as a video."
            />
            <video
              :src="visibleVideoUrl"
              controls
              preload="metadata"
              class="aspect-video w-full max-w-4xl rounded-md border border-default bg-black"
            />
          </section>

          <section class="space-y-4">
            <SectionHeader
              title="Journey"
              description="Each step is what the browser saw and what the persona decided to do."
            />

            <div v-if="visibleSteps.length" class="divide-y divide-default border-y border-default">
              <div v-for="step in visibleSteps" :key="step.id" class="grid gap-4 py-4 md:grid-cols-[240px_1fr]">
                <button
                  v-if="step.screenshot_url"
                  type="button"
                  class="block overflow-hidden rounded-md border border-default bg-elevated text-left transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  :aria-label="`Open step ${step.step_number} screenshot`"
                  @click="openScreenshot(step)"
                >
                  <img :src="step.screenshot_url" :alt="`Step ${step.step_number} screenshot`" class="aspect-video w-full object-cover">
                </button>
                <div v-else class="flex aspect-video items-center justify-center rounded-md border border-dashed border-default text-xs text-muted">
                  No screenshot
                </div>

                <div class="min-w-0 space-y-2">
                  <div class="flex flex-wrap items-baseline justify-between gap-2">
                    <p class="text-sm font-semibold text-default">
                      Step {{ step.step_number }}
                      <span v-if="!selectedPersona && step.persona_run_id" class="ml-2 text-xs font-normal text-muted">
                        {{ personaNameById.get(step.persona_run_id) }}
                      </span>
                    </p>
                    <span class="text-xs text-muted">
                      {{ (step.action as any).type || 'observe' }}
                    </span>
                  </div>
                  <p class="text-sm leading-6 text-muted">
                    <span class="font-medium text-default">Saw:</span> {{ step.observation }}
                  </p>
                  <p class="text-sm leading-6 text-default">
                    <span class="font-medium">Did:</span> {{ (step.action as any).reason || step.progress }}
                  </p>
                </div>
              </div>
            </div>

            <p v-else class="text-sm text-muted">
              Waiting for the first step. Screenshots and decisions will appear here as the test works through the goal.
            </p>
          </section>

          <section class="space-y-4">
            <SectionHeader
              title="Findings"
              :description="visibleIssues.length ? 'What the test thinks is broken, confusing, or wrong.' : ''"
            />

            <div v-if="visibleIssues.length" class="divide-y divide-default border-y border-default">
              <article v-for="issue in visibleIssues" :key="issue.id" class="space-y-3 py-5">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 class="text-base font-semibold text-default">
                    {{ issue.title }}
                  </h3>
                  <span class="text-xs uppercase tracking-wide" :class="severityColor(issue.severity)">
                    {{ issue.severity }} · {{ issue.category }}
                  </span>
                </div>
                <p class="text-xs text-muted">
                  Reported by {{ issuePersonaName(issue) }}
                </p>
                <p class="text-sm leading-6 text-muted">
                  {{ issue.description }}
                </p>
                <div v-if="issue.suggested_fix" class="rounded-md border-l-2 border-primary bg-elevated/40 p-3 text-sm">
                  <span class="font-medium text-default">Suggested fix &mdash; </span>{{ issue.suggested_fix }}
                </div>
                <div v-if="data.github" class="flex flex-wrap gap-2 pt-1">
                  <UButton
                    v-if="issue.github_issue_url"
                    :to="issue.github_issue_url"
                    target="_blank"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    label="Open issue"
                  />
                  <UButton
                    v-else
                    color="neutral"
                    variant="outline"
                    size="sm"
                    label="Create GitHub issue"
                    :loading="creatingIssueId === issue.id"
                    :disabled="!canCreateGithubIssue(issue)"
                    @click="createGithubIssue(issue)"
                  />
                  <UButton
                    v-if="issue.github_pr_url"
                    :to="issue.github_pr_url"
                    target="_blank"
                    color="primary"
                    variant="outline"
                    size="sm"
                    label="Open pull request"
                  />
                  <UButton
                    v-else
                    color="primary"
                    variant="outline"
                    size="sm"
                    label="Open a fix PR"
                    :loading="creatingPrId === issue.id"
                    :disabled="!canCreateGithubPullRequest(issue)"
                    @click="createGithubPullRequest(issue)"
                  />
                </div>
              </article>
            </div>

            <p v-else class="text-sm text-muted">
              {{ terminal ? 'Nothing flagged. The persona walked the journey without blockers.' : 'Findings will appear as the test discovers them.' }}
            </p>
          </section>

          <section class="space-y-4">
            <SectionHeader title="Report">
              <template #actions>
                <UButton
                  :to="reportUrl"
                  target="_blank"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  label="Open markdown"
                />
              </template>
            </SectionHeader>
            <pre class="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-md border border-default bg-elevated/40 p-4 text-sm leading-6 text-default">{{ visibleReport || (data.run.status === 'cancelled' ? 'No report — the test was stopped.' : 'The report will appear when the test finishes.') }}</pre>
          </section>
        </div>
      </template>
    </UDashboardPanel>

    <UModal v-model:open="screenshotModalOpen" fullscreen :title="selectedScreenshot?.title || 'Screenshot'">
      <template #body>
        <div class="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-black p-3">
          <img
            v-if="selectedScreenshot"
            :src="selectedScreenshot.src"
            :alt="selectedScreenshot.alt"
            class="max-h-[calc(100vh-10rem)] w-full object-contain"
          >
        </div>
      </template>
    </UModal>
  </div>
</template>
