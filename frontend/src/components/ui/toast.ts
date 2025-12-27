import { computed, reactive } from "vue";

export type ToastTone = "info" | "success" | "warning" | "error";

export type ToastItem = {
  id: string;
  tone: ToastTone;
  message: string;
  title?: string;
  createdAt: number;
  timeoutMs: number;
};

type ToastPushInput = {
  tone: ToastTone;
  message: string;
  title?: string;
  timeoutMs?: number;
};

const state = reactive<{ items: ToastItem[] }>({ items: [] });
let counter = 0;
const timers = new Map<string, number>();

function remove(id: string) {
  state.items = state.items.filter((t) => t.id !== id);
  const timer = timers.get(id);
  if (timer) window.clearTimeout(timer);
  timers.delete(id);
}

function push(input: ToastPushInput): string {
  const id = `toast_${Date.now()}_${counter++}`;
  const item: ToastItem = {
    id,
    createdAt: Date.now(),
    timeoutMs: input.timeoutMs ?? 3500,
    tone: input.tone,
    title: input.title,
    message: input.message,
  };

  state.items = [...state.items, item];

  if (item.timeoutMs > 0) {
    const t = window.setTimeout(() => remove(id), item.timeoutMs);
    timers.set(id, t);
  }

  return id;
}

export function useToasts() {
  return {
    items: computed(() => state.items),
    push,
    remove,
    clear: () => {
      for (const it of state.items) remove(it.id);
    },
    info: (message: string, opts: Omit<ToastPushInput, "tone" | "message"> = {}) =>
      push({ ...opts, tone: "info", message }),
    success: (message: string, opts: Omit<ToastPushInput, "tone" | "message"> = {}) =>
      push({ ...opts, tone: "success", message }),
    warning: (message: string, opts: Omit<ToastPushInput, "tone" | "message"> = {}) =>
      push({ ...opts, tone: "warning", message }),
    error: (message: string, opts: Omit<ToastPushInput, "tone" | "message"> = {}) =>
      push({ ...opts, tone: "error", message, timeoutMs: opts.timeoutMs ?? 5000 }),
  };
}
