<script setup lang="ts">
import { useToasts } from "./toast";

const { items, remove } = useToasts();
</script>

<template>
  <Teleport to="body">
    <div class="ui-toasts" aria-live="polite" aria-relevant="additions removals" role="status">
      <div v-for="t in items" :key="t.id" class="ui-toast" :class="t.tone">
        <div class="ui-toast-main">
          <p v-if="t.title" class="ui-toast-title">{{ t.title }}</p>
          <p class="ui-toast-message">{{ t.message }}</p>
        </div>
        <button class="ghost-btn small-btn ui-toast-close" type="button" @click="remove(t.id)">關閉</button>
      </div>
    </div>
  </Teleport>
</template>
