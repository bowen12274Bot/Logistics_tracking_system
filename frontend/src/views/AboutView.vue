<script setup lang="ts">
import { useI18n } from "vue-i18n";
import UiCard from "../components/ui/UiCard.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";

const { t } = useI18n();
</script>

<template>
  <UiPageShell style="margin-top: 28px">
    <header class="section-header">
      <h2>{{ t("about.title") }}</h2>
      <p class="hint">
        {{ t("about.lede") }}
      </p>
    </header>

    <div class="card-grid">
      <UiCard>
        <p class="eyebrow">{{ t("about.purpose.title") }}</p>
        <p>{{ t("about.purpose.body") }}</p>
      </UiCard>
      <UiCard>
        <p class="eyebrow">{{ t("about.roles.title") }}</p>
        <p>{{ t("about.roles.body") }}</p>
      </UiCard>
      <UiCard>
        <p class="eyebrow">{{ t("about.learning.title") }}</p>
        <p>{{ t("about.learning.body") }}</p>
      </UiCard>
    </div>
  </UiPageShell>
</template>
