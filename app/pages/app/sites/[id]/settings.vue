<script setup lang="ts">
import type { Site } from '~/types'

const route = useRoute()
const toast = useToast()
const siteId = computed(() => String(route.params.id))
const verifying = ref(false)

const { data: site, refresh } = await useFetch<Site>(() => `/api/sites/${siteId.value}`, {
  default: () => null as unknown as Site
})

async function verifySite() {
  verifying.value = true

  try {
    await $fetch<Site>(`/api/sites/${siteId.value}/verify`, { method: 'POST' })
    await refresh()
    toast.add({ title: 'Verified', description: `${site.value.hostname} is ready to test.`, color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't verify ownership`, description: getErrorMessage(error), color: 'error' })
  } finally {
    verifying.value = false
  }
}

function getErrorMessage(error: unknown) {
  const fetchError = error as { data?: { message?: string }, message?: string }
  return fetchError.data?.message || fetchError.message || 'Unexpected error'
}
</script>

<template>
  <UDashboardPanel id="site-settings">
    <template #header>
      <SiteHeader :site-id="siteId" :title="site?.hostname || 'Site settings'" />
    </template>

    <template #body>
      <div class="mx-auto max-w-3xl space-y-10">
        <section class="space-y-4">
          <SectionHeader title="Details" description="What we know about this site." />
          <dl class="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-medium text-muted uppercase tracking-wide">
                Base URL
              </dt>
              <dd class="mt-1.5 truncate text-sm text-default">
                {{ site?.base_url }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted uppercase tracking-wide">
                Hostname
              </dt>
              <dd class="mt-1.5 truncate text-sm text-default">
                {{ site?.hostname }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted uppercase tracking-wide">
                Verified with
              </dt>
              <dd class="mt-1.5 text-sm text-default">
                {{ site?.verification_method === 'meta' ? 'HTML meta tag' : site?.verification_method === 'txt' ? 'DNS TXT record' : 'Not verified' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted uppercase tracking-wide">
                Last checked
              </dt>
              <dd class="mt-1.5 text-sm text-default">
                {{ site?.last_checked_at ? new Date(site.last_checked_at).toLocaleString() : 'Never' }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="space-y-4">
          <SectionHeader
            title="Ownership"
            description="Tests run only against verified hostnames."
          >
            <template #actions>
              <span v-if="site?.verified_at" class="text-sm font-medium text-success">Verified</span>
              <span v-else class="text-sm font-medium text-warning">Awaiting verification</span>
            </template>
          </SectionHeader>
          <p class="text-sm text-muted">
            {{ site?.verified_at ? 'This site is good to go. Tests can run anytime.' : 'Re-add the verification token to your site, then check again.' }}
          </p>
          <UButton
            v-if="!site?.verified_at"
            label="Verify again"
            :loading="verifying"
            @click="verifySite"
          />
        </section>

        <section class="space-y-4">
          <SectionHeader
            title="Repository"
            description="Connect a GitHub repo so tests can use code context and turn findings into issues or pull requests."
          />
          <p class="text-sm text-muted">
            {{ site?.github_connection && !site.github_connection.disconnected_at ? `Connected: ${site.github_connection.full_name}` : 'No repository connected.' }}
          </p>
          <UButton
            :to="`/app/sites/${siteId}/github`"
            color="neutral"
            variant="outline"
            label="Manage repository"
          />
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
