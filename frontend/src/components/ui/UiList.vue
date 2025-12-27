<script setup lang="ts">
import { computed } from "vue";

type Props = {
  as?: "ul" | "ol" | "div";
  variant?: "task" | "plain";
};

const props = defineProps<Props>();

const listClass = computed(() => {
  if (props.variant === "plain") return "ui-list";
  return "task-list";
});
</script>

<template>
  <component :is="as ?? 'ul'" :class="listClass">
    <slot />
  </component>
</template>

