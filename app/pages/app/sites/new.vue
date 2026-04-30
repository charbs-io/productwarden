<script setup lang="ts">
import type { Site } from '~/types'

const toast = useToast()
const url = ref('')
const pending = ref(false)
const verifying = ref(false)
const newSite = ref<Site | null>(null)
const verificationToken = ref('')

async function addSite() {
  pending.value = true
  newSite.value = null
  verificationToken.value = ''

  try {
    const response = await $fetch<{ site: Site, verification_token: string }>('/api/sites', {
      method: 'POST',
      body: { url: url.value }
    })

    newSite.value = response.site
    verificationToken.value = response.verification_token
    url.value = ''
    toast.add({ title: 'Site added', description: 'Now drop in the verification snippet and confirm ownership.', color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't add the site`, description: getErrorMessage(error), color: 'error' })
  } finally {
    pending.value = false
  }
}

async function verifySite() {
  if (!newSite.value) {
    return
  }

  verifying.value = true

  try {
    newSite.value = await $fetch<Site>(`/api/sites/${newSite.value.id}/verify`, { method: 'POST' })
    toast.add({ title: 'Verified', description: `${newSite.value.hostname} is ready to test.`, color: 'success' })
  } catch (error: unknown) {
    toast.add({ title: `Couldn't verify ownership`, description: getErrorMessage(error), color: 'error' })
  } finally {
    verifying.value = false
  }
}

function metaTag(token: string) {
  return `<meta name="productwarden-site-verification" content="${token}">`
}

function txtRecord(host: string, token: string) {
  return `_productwarden.${host} TXT "productwarden-site-verification=${token}"`
}

function getErrorMessage(error: unknown) {
  const fetchError = error as { data?: { message?: string }, message?: string }
  return fetchError.data?.message || fetchError.message || 'Unexpected error'
}
</script>

<template>
  <UDashboardPanel id="new-site">
    <template #header>
      <UDashboardNavbar title="Add a site" />
    </template>

    <template #body>
      <div class="mx-auto max-w-2xl space-y-10">
        <PageIntro description="Two short steps: tell us the URL, then prove the site is yours with a meta tag or DNS record. Once it's verified, you can run tests and connect the codebase behind it." />

        <section class="space-y-4">
          <SectionHeader title="Step 1 — Site URL" description="The exact public address tests should start from." />

          <form class="space-y-4" @submit.prevent="addSite">
            <UFormField label="Website URL" name="url" required>
              <UInput
                v-model="url"
                placeholder="https://example.com"
                required
                size="lg"
                class="w-full"
              />
            </UFormField>
            <div class="flex justify-end">
              <UButton
                type="submit"
                label="Add site"
                :loading="pending"
              />
            </div>
          </form>
        </section>

        <section v-if="newSite && verificationToken" class="space-y-4">
          <SectionHeader
            :title="`Step 2 — Verify ${newSite.hostname}`"
            description="Pick whichever is easier to deploy. Hit verify when it's live."
          >
            <template #actions>
              <span v-if="newSite.verified_at" class="text-sm font-medium text-success">Verified</span>
              <span v-else class="text-sm font-medium text-warning">Awaiting verification</span>
            </template>
          </SectionHeader>

          <div class="space-y-5">
            <div>
              <p class="mb-2 text-sm font-medium text-default">
                Option A — HTML meta tag
              </p>
              <p class="mb-2 text-xs text-muted">
                Paste this into the <code class="text-default">&lt;head&gt;</code> of your homepage.
              </p>
              <pre class="overflow-x-auto rounded-md border border-default bg-elevated/40 p-3 text-xs text-default"><code>{{ metaTag(verificationToken) }}</code></pre>
            </div>
            <div>
              <p class="mb-2 text-sm font-medium text-default">
                Option B — DNS TXT record
              </p>
              <p class="mb-2 text-xs text-muted">
                Add this TXT record at your DNS provider.
              </p>
              <pre class="overflow-x-auto rounded-md border border-default bg-elevated/40 p-3 text-xs text-default"><code>{{ txtRecord(newSite.hostname, verificationToken) }}</code></pre>
            </div>
            <div class="flex flex-wrap justify-end gap-2 pt-2">
              <UButton
                v-if="newSite.verified_at"
                :to="`/app/sites/${newSite.id}/github`"
                label="Connect a repository"
                color="neutral"
                variant="outline"
              />
              <UButton
                v-if="newSite.verified_at"
                :to="`/app/runs/new?site=${newSite.id}`"
                label="Run a test"
              />
              <UButton
                v-else
                label="Verify"
                :loading="verifying"
                @click="verifySite"
              />
            </div>
          </div>
        </section>

        <section v-else class="space-y-4">
          <SectionHeader title="What happens after this" />
          <ol class="space-y-4 text-sm">
            <li class="grid gap-3 sm:grid-cols-[28px_1fr]">
              <span class="font-semibold tabular-nums text-muted">01</span>
              <span><span class="font-medium text-default">We hand you a token.</span> Add it as a meta tag or DNS record so we know the site is yours.</span>
            </li>
            <li class="grid gap-3 sm:grid-cols-[28px_1fr]">
              <span class="font-semibold tabular-nums text-muted">02</span>
              <span><span class="font-medium text-default">Hit verify.</span> Tests can only run against verified hostnames; redirects outside the hostname stop the run.</span>
            </li>
            <li class="grid gap-3 sm:grid-cols-[28px_1fr]">
              <span class="font-semibold tabular-nums text-muted">03</span>
              <span><span class="font-medium text-default">Connect a repo (optional).</span> Tests can use code context and even open issues or pull requests when you allow it.</span>
            </li>
          </ol>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
