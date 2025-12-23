import { computed, onMounted, onUnmounted, ref, type Ref } from "vue";

export function useFullscreen(targetEl: Ref<HTMLElement | null>) {
  const isFullscreen = ref(false);

  const isSupported = computed(() => {
    const el = targetEl.value;
    return Boolean(el?.requestFullscreen && document.exitFullscreen);
  });

  const update = () => {
    const el = targetEl.value;
    isFullscreen.value = Boolean(el && document.fullscreenElement === el);
  };

  const enter = async () => {
    const el = targetEl.value;
    if (!el || !el.requestFullscreen) return;
    await el.requestFullscreen();
  };

  const exit = async () => {
    if (!document.exitFullscreen) return;
    await document.exitFullscreen();
  };

  const toggle = async () => {
    update();
    if (isFullscreen.value) return exit();
    return enter();
  };

  onMounted(() => {
    update();
    document.addEventListener("fullscreenchange", update);
  });

  onUnmounted(() => {
    document.removeEventListener("fullscreenchange", update);
  });

  return { isSupported, isFullscreen, enter, exit, toggle };
}

