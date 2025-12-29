<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { i18n } from "../../i18n";

type Props = {
  modelValue: boolean;
  title?: string;
  ariaLabel?: string;
  closeText?: string;
  closeOnEsc?: boolean;
  closeOnBackdrop?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  closeText: i18n.global.t("common.close"),
  closeOnEsc: true,
  closeOnBackdrop: true,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "close"): void;
}>();

const cardEl = ref<HTMLElement | null>(null);
const titleId = `ui-modal-title-${Math.random().toString(16).slice(2)}`;
let lastFocusedEl: Element | null = null;

type TeleportTarget = string | HTMLElement;
const teleportTo = ref<TeleportTarget>("body");

function getFullscreenElement(): HTMLElement | null {
  const anyDoc = document as unknown as {
    fullscreenElement?: Element | null;
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return (
    (anyDoc.fullscreenElement as HTMLElement | null) ??
    (anyDoc.webkitFullscreenElement as HTMLElement | null) ??
    (anyDoc.msFullscreenElement as HTMLElement | null) ??
    null
  );
}

function updateTeleportTarget() {
  teleportTo.value = getFullscreenElement() ?? "body";
}

function close() {
  emit("update:modelValue", false);
  emit("close");
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
  );
  return Array.from(nodes).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
}

function focusFirst() {
  const root = cardEl.value;
  if (!root) return;
  const focusables = getFocusable(root);
  (focusables[0] ?? root).focus?.();
}

function trapTab(e: KeyboardEvent) {
  const root = cardEl.value;
  if (!root) return;
  const focusables = getFocusable(root);
  if (focusables.length === 0) return;
  const active = document.activeElement as HTMLElement | null;
  const currentIndex = active ? focusables.indexOf(active) : -1;
  const forward = !e.shiftKey;
  const nextIndex = forward ? currentIndex + 1 : currentIndex - 1;
  const wrappedIndex = forward
    ? nextIndex >= focusables.length
      ? 0
      : nextIndex
    : nextIndex < 0
      ? focusables.length - 1
      : nextIndex;
  e.preventDefault();
  focusables[wrappedIndex]?.focus();
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return;
  if (e.key === "Escape" && props.closeOnEsc) {
    e.preventDefault();
    close();
    return;
  }
  if (e.key === "Tab") {
    trapTab(e);
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      updateTeleportTarget();
      lastFocusedEl = document.activeElement;
      document.addEventListener("keydown", onDocumentKeydown, true);
      await nextTick();
      focusFirst();
    } else {
      document.removeEventListener("keydown", onDocumentKeydown, true);
      (lastFocusedEl as HTMLElement | null)?.focus?.();
      lastFocusedEl = null;
    }
  },
);

onMounted(() => {
  updateTeleportTarget();
  document.addEventListener("fullscreenchange", updateTeleportTarget);
  document.addEventListener("webkitfullscreenchange", updateTeleportTarget);
  document.addEventListener("MSFullscreenChange", updateTeleportTarget);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onDocumentKeydown, true);
  document.removeEventListener("fullscreenchange", updateTeleportTarget);
  document.removeEventListener("webkitfullscreenchange", updateTeleportTarget);
  document.removeEventListener("MSFullscreenChange", updateTeleportTarget);
});

function onBackdropClick() {
  if (!props.closeOnBackdrop) return;
  close();
}
</script>

<template>
  <Teleport :to="teleportTo">
    <div
      v-if="modelValue"
      class="ui-modal"
      role="dialog"
      :aria-label="ariaLabel"
      :aria-labelledby="title ? titleId : undefined"
      @click.self="onBackdropClick"
    >
      <div ref="cardEl" class="ui-modal-card" tabindex="-1">
        <header class="ui-modal-header">
          <div>
            <p v-if="title" :id="titleId" class="ui-modal-title">{{ title }}</p>
            <slot name="subtitle" />
          </div>
          <button class="ghost-btn small-btn" type="button" @click="close">{{ closeText }}</button>
        </header>

        <div class="ui-modal-body">
          <slot />
        </div>

        <footer v-if="$slots.actions" class="ui-modal-actions">
          <slot name="actions" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
