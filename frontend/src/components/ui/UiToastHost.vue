<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useToasts } from "./toast";

const { t } = useI18n();
const { items, remove } = useToasts();
</script>

<template>
  <Teleport to="body">
    <div class="ui-toasts" aria-live="polite" aria-relevant="additions removals" role="status">
      <div v-for="toast in items" :key="toast.id" class="ui-toast" :class="toast.tone">
        <div class="ui-toast-main">
          <p v-if="toast.title" class="ui-toast-title">{{ toast.title }}</p>
          <p class="ui-toast-message">{{ toast.message }}</p>
        </div>
        <button class="ghost-btn small-btn ui-toast-close" type="button" @click="remove(toast.id)">{{ t("common.close") }}</button>
      </div>
    </div>
  </Teleport>
</template>

