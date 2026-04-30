<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-3 border-b border-default pb-3">
    <div class="min-w-0">
      <h2 class="text-sm font-semibold tracking-wide text-default uppercase">
        {{ title }}
      </h2>
      <p v-if="description" class="mt-1 text-sm text-muted">
        {{ description }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
