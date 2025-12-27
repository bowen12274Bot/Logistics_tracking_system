<script setup lang="ts">
type Props = {
  as?: string
}

defineProps<Props>()
</script>

<template>
  <component :is="as ?? 'div'" class="card">
    <slot />
  </component>
</template>

