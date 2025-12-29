import { computed, onMounted, onUnmounted, ref, type Ref } from "vue";

export function useFullscreen(targetEl: Ref<HTMLElement | null>) {
  const isFullscreen = ref(false);

  const isSupported = computed(() => {
    const el = targetEl.value;
    if (!el) return false;
    const anyEl = el as unknown as {
      requestFullscreen?: () => Promise<void> | void;
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };
    const anyDoc = document as unknown as {
      exitFullscreen?: () => Promise<void> | void;
    };
    return Boolean(
      (typeof anyEl.requestFullscreen === "function" ||
        typeof anyEl.webkitRequestFullscreen === "function" ||
        typeof anyEl.msRequestFullscreen === "function") &&
        typeof anyDoc.exitFullscreen === "function",
    );
  });

  const update = () => {
    const el = targetEl.value;
    isFullscreen.value = Boolean(el && document.fullscreenElement === el);
  };

  const enter = async () => {
    const el = targetEl.value;
    if (!el) return;
    const anyEl = el as unknown as {
      requestFullscreen?: () => Promise<void> | void;
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };

    if (typeof anyEl.requestFullscreen === "function") return await anyEl.requestFullscreen();
    if (typeof anyEl.webkitRequestFullscreen === "function") return await anyEl.webkitRequestFullscreen();
    if (typeof anyEl.msRequestFullscreen === "function") return await anyEl.msRequestFullscreen();
  };

  const exit = async () => {
    const anyDoc = document as unknown as { exitFullscreen?: () => Promise<void> | void };
    if (typeof anyDoc.exitFullscreen !== "function") return;
    await anyDoc.exitFullscreen();
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

