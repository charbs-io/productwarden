<script setup lang="ts">
defineProps<{
  items: Array<{ label: string, value: string | number, hint?: string }>
}>()
</script>

<template>
  <dl class="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-default py-5 sm:grid-cols-4">
    <div v-for="item in items" :key="item.label" class="min-w-0">
      <dt class="text-xs font-medium text-muted uppercase tracking-wide">
        {{ item.label }}
      </dt>
      <dd class="mt-1.5 text-2xl font-semibold tabular-nums text-default">
        {{ item.value }}
      </dd>
      <dd v-if="item.hint" class="mt-0.5 text-xs text-muted">
        {{ item.hint }}
      </dd>
    </div>
  </dl>
</template>
