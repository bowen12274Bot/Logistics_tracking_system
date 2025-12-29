<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName } from '../icons/iconLibrary'

interface Props {
  name: IconName
  size?: number | string
}

const props = withDefaults(defineProps<Props>(), {
  size: 16,
})

const icon = computed(() => ICONS[props.name])
const sizeValue = computed(() => {
  const s = props.size
  return typeof s === 'number' ? `${s}px` : s
})
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="sizeValue"
    :height="sizeValue"
    :viewBox="icon.viewBox || '0 0 24 24'"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(path, index) in icon.paths" :key="index" :d="path" />
  </svg>
</template>
