
<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UiCard from '../components/ui/UiCard.vue'
import UiList from '../components/ui/UiList.vue'
import UiPageShell from '../components/ui/UiPageShell.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const highlights = computed(() => [
  { title: t('home.highlights.virtualMap.title'), copy: t('home.highlights.virtualMap.copy') },
  { title: t('home.highlights.pricing.title'), copy: t('home.highlights.pricing.copy') },
  { title: t('home.highlights.lifecycle.title'), copy: t('home.highlights.lifecycle.copy') },
  { title: t('home.highlights.billing.title'), copy: t('home.highlights.billing.copy') },
])

const routes = computed(() => [
  t('home.routes.pickup'),
  t('home.routes.delivery'),
  t('home.routes.events'),
  t('home.routes.billing'),
])
</script>

<template>
  <UiPageShell class="page-hero">
    <div class="hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">{{ t('home.eyebrow') }}</p>
        <h1>{{ t('home.title') }}</h1>
        <p class="lede">{{ t('home.lede') }}</p>
        <div class="hero-actions">
          <RouterLink to="/map" class="primary-btn">{{ t('home.actions.map') }}</RouterLink>
          <RouterLink to="/track" class="ghost-btn">{{ t('home.actions.track') }}</RouterLink>
          <RouterLink to="/shipping/estimate" class="ghost-btn">{{ t('home.actions.estimate') }}</RouterLink>
        </div>
      </div>

      <UiCard class="highlight-card">
        <p class="eyebrow">{{ t('home.routes.title') }}</p>
        <UiList>
          <li v-for="route in routes" :key="route">{{ route }}</li>
        </UiList>
      </UiCard>
    </div>
  </UiPageShell>

  <UiPageShell>
    <header class="section-header">
      <h2>{{ t('home.pricing.title') }}</h2>
      <p class="hint">{{ t('home.pricing.hint') }}</p>
    </header>

    <UiCard>
      <div class="stack">
        <div>
          <p class="eyebrow">{{ t('home.pricing.input.title') }}</p>
          <p class="hint">{{ t('home.pricing.input.copy') }}</p>
        </div>
        <div>
          <p class="eyebrow">{{ t('home.pricing.rules.title') }}</p>
          <p class="hint">{{ t('home.pricing.rules.copy') }}</p>
        </div>
        <div>
          <p class="eyebrow">{{ t('home.pricing.output.title') }}</p>
          <p class="hint">{{ t('home.pricing.output.copy') }}</p>
        </div>
      </div>
    </UiCard>
  </UiPageShell>
</template>
