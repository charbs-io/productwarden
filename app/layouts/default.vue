<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

useDashboard()

const open = ref(false)

const primaryLinks = [{
  label: 'Home',
  icon: 'i-lucide-home',
  to: '/app',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Sites',
  icon: 'i-lucide-globe',
  to: '/app/sites',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Tests',
  icon: 'i-lucide-activity',
  to: '/app/runs',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Personas',
  icon: 'i-lucide-user-round',
  to: '/app/personas',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Pull requests',
  icon: 'i-lucide-git-pull-request',
  to: '/app/pulls',
  onSelect: () => {
    open.value = false
  }
}] satisfies NavigationMenuItem[]

const secondaryLinks = [{
  label: 'Settings',
  icon: 'i-lucide-settings',
  to: '/app/setup'
}] satisfies NavigationMenuItem[]

const groups = computed(() => [{
  id: 'navigate',
  label: 'Navigate',
  items: [...primaryLinks, ...secondaryLinks]
}, {
  id: 'actions',
  label: 'Quick actions',
  items: [{
    id: 'new-run',
    label: 'Run a test',
    icon: 'i-lucide-play',
    to: '/app/runs/new'
  }, {
    id: 'add-site',
    label: 'Add a site',
    icon: 'i-lucide-plus',
    to: '/app/sites/new'
  }]
}])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="primaryLinks"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="secondaryLinks"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />
  </UDashboardGroup>
</template>
