<script setup lang="ts">
defineProps<{
  description: string
}>()
</script>

<template>
  <p class="max-w-3xl text-sm leading-6 text-muted">
    {{ description }}
  </p>
</template>
