<script setup lang="ts">
type Props = {
  eyebrow?: string
  title?: string
  lede?: string
}

defineProps<Props>()
</script>

<template>
  <section class="page-shell">
    <header v-if="$slots.header || title || eyebrow || lede" class="page-header">
      <slot name="header">
        <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
        <h1 v-if="title">{{ title }}</h1>
        <p v-if="lede" class="lede">{{ lede }}</p>
      </slot>
    </header>

    <slot />
  </section>
</template>

