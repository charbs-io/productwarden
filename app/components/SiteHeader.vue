<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const props = defineProps<{
  siteId: string
  title: string
}>()

const route = useRoute()

const items = computed<NavigationMenuItem[][]>(() => [[{
  label: 'Tests',
  to: `/app/sites/${props.siteId}`,
  active: route.path === `/app/sites/${props.siteId}`
}, {
  label: 'Pull requests',
  to: `/app/sites/${props.siteId}/pulls`,
  active: route.path === `/app/sites/${props.siteId}/pulls`
}, {
  label: 'Repository',
  to: `/app/sites/${props.siteId}/github`,
  active: route.path === `/app/sites/${props.siteId}/github`
}, {
  label: 'Settings',
  to: `/app/sites/${props.siteId}/settings`,
  active: route.path === `/app/sites/${props.siteId}/settings`
}]])
</script>

<template>
  <UDashboardNavbar :title="title">
    <template #right>
      <slot name="right" />
    </template>
  </UDashboardNavbar>

  <UDashboardToolbar>
    <UNavigationMenu :items="items" highlight class="flex-1" />
  </UDashboardToolbar>
</template>
