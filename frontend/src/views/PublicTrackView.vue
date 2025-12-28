<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { api, type TrackingPublicResponse } from "../services/api";
import UiCard from "../components/ui/UiCard.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";
import { toastFromApiError } from "../services/errorToast";

const { t } = useI18n();

const trackingNumber = ref("");
const isLoading = ref(false);
const error = ref<string | null>(null);
const result = ref<TrackingPublicResponse | null>(null);

const simplifiedProgress = (status?: string | null) =>
  status === "delivered" ? t("publicTrack.progress.delivered") : t("publicTrack.progress.inTransit");

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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

      <p v-if="error" class="hint">{{ error }}</p>

      <div v-if="result" class="results">
        <div class="result-title">
          <strong>{{ result.tracking_number }}</strong>
          <span class="tag">{{ simplifiedProgress(result.current_status) }}</span>
        </div>
        <div class="result-meta">
          <span>{{ t("publicTrack.updatedAt", { time: formatDateTime(result.updated_at) }) }}</span>
        </div>
      </div>
    </UiCard>
  </UiPageShell>
</template>

<style scoped>
.results {
  margin-top: 16px;
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
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 13px;
  opacity: 0.9;
}
</style>
