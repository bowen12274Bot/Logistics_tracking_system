<script setup lang="ts">
type UiNoticeTone = "info" | "success" | "warning" | "error";

withDefaults(
  defineProps<{
    tone?: UiNoticeTone;
    title?: string;
    role?: "status" | "alert" | "none";
  }>(),
  { tone: "info", role: "status" },
);
</script>

<template>
  <div class="ui-notice" :class="`ui-notice--${tone}`" :role="role === 'none' ? undefined : role">
    <strong v-if="title" class="ui-notice__title">{{ title }}</strong>
    <div class="ui-notice__body">
      <slot />
    </div>
  </div>
</template>

