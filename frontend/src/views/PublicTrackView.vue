<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { api, type TrackingPublicResponse } from "../services/api";
import UiCard from "../components/ui/UiCard.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";
import { toastFromApiError } from "../services/errorToast";

const { t, locale } = useI18n();

const trackingNumber = ref("");
const isLoading = ref(false);
const error = ref<string | null>(null);
const result = ref<TrackingPublicResponse | null>(null);

const isException = computed(() => result.value?.current_status === "exception");
const isDelivered = computed(() => result.value?.current_status === "delivered");

const statusLabel = computed(() => {
  if (!result.value) return "";
  if (isDelivered.value) return t("publicTrack.progress.delivered");
  if (isException.value) return t("publicTrack.progress.exception");
  return t("publicTrack.progress.inTransit");
});

const statusClass = computed(() => {
  if (isDelivered.value) return "tag--success";
  if (isException.value) return "tag--danger";
  return "tag--default";
});

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const targetLocale = locale.value === 'en-US' ? 'en-US' : 'zh-TW';
  return date.toLocaleString(targetLocale);
};

const lookup = async () => {
  if (!trackingNumber.value.trim()) return;

  isLoading.value = true;
  error.value = null;
  result.value = null;
  try {
    result.value = await api.getTrackingPublic(trackingNumber.value.trim());
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    toastFromApiError(err, error.value ?? t("publicTrack.error.searchFailed"));
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <UiPageShell :eyebrow="t('publicTrack.eyebrow')" :title="t('publicTrack.title')" :lede="t('publicTrack.lede')">
    <UiCard>
      <form class="form-grid" @submit.prevent="lookup">
        <label class="form-field span-2">
          <span>{{ t("publicTrack.trackingLabel") }}</span>
          <input
            v-model="trackingNumber"
            name="trackingNumber"
            type="text"
            :placeholder="t('publicTrack.placeholder')"
          />
        </label>

        <button class="primary-btn" type="submit" :disabled="isLoading || !trackingNumber.trim()">
          {{ isLoading ? t("publicTrack.submitting") : t("publicTrack.submit") }}
        </button>
      </form>

      <p v-if="error" class="hint error-hint">{{ error }}</p>

      <div v-if="result" class="results">
        <div class="result-header">
          <div class="result-title">
            <strong>{{ result.tracking_number }}</strong>
            <span class="tag" :class="statusClass">{{ statusLabel }}</span>
          </div>
          <div class="result-meta">
            <span>{{ t("publicTrack.updatedAt", { time: formatDateTime(result.updated_at) }) }}</span>
            <span v-if="result.estimated_delivery">
              {{ t("publicTrack.eta", { time: formatDateTime(result.estimated_delivery) }) }}
            </span>
          </div>
        </div>

        <!-- Exception Alert -->
        <div v-if="isException" class="exception-alert" role="alert">
          <strong>⚠ {{ t("publicTrack.exceptionAlert.title") }}</strong>
          <p>{{ t("publicTrack.exceptionAlert.body") }}</p>
        </div>

        <!-- Event Timeline -->
        <section v-if="result.events?.length" class="timeline-section">
          <h3 class="timeline-title">{{ t("publicTrack.timeline.title") }}</h3>
          <ol class="timeline">
            <li v-for="(event, idx) in [...result.events].reverse()" :key="idx" class="timeline-item">
              <div class="timeline-dot" :class="{ 'timeline-dot--latest': idx === 0 }" />
              <div class="timeline-content">
                <div class="timeline-status">{{ event.status }}</div>
                <div v-if="event.description" class="timeline-desc">{{ event.description }}</div>
                <div class="timeline-meta">
                  <span v-if="event.location">📍 {{ event.location }}</span>
                  <span>🕐 {{ formatDateTime(event.timestamp) }}</span>
                </div>
              </div>
            </li>
          </ol>
        </section>

        <p v-else class="hint">{{ t("publicTrack.timeline.empty") }}</p>
      </div>
    </UiCard>
  </UiPageShell>
</template>

<style scoped>
.results {
  margin-top: 16px;
}

.result-header {
  margin-bottom: 16px;
}

.result-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.tag {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 500;
}

.tag--default {
  background: rgba(0, 0, 0, 0.06);
  color: #333;
}

.tag--success {
  background: #d4edda;
  color: #155724;
}

.tag--danger {
  background: #f8d7da;
  color: #721c24;
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 13px;
  opacity: 0.9;
}

.error-hint {
  color: #d9534f;
}

.exception-alert {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.exception-alert strong {
  display: block;
  margin-bottom: 4px;
  color: #856404;
}

.exception-alert p {
  margin: 0;
  font-size: 14px;
  color: #856404;
}

.timeline-section {
  margin-top: 8px;
}

.timeline-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.timeline {
  list-style: none;
  padding: 0;
  margin: 0;
  position: relative;
}

.timeline::before {
  content: "";
  position: absolute;
  left: 7px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: #e0e0e0;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
  position: relative;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ccc;
  flex-shrink: 0;
  z-index: 1;
}

.timeline-dot--latest {
  background: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-status {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 2px;
}

.timeline-desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.timeline-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: #888;
}
</style>

