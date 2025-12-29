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

const formatEventTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const loc = locale.value === 'en-US' ? 'en-US' : 'zh-TW';
  const datePart = date.toLocaleDateString(loc);
  const timePart = date.toLocaleTimeString(loc, { hour12: false });
  return `${datePart}\n${timePart}`;
};

// Standardized route nodes
const routeNodes = computed(() => {
  const events = result.value?.events || [];
  
  // Initialize nodes individually to avoid TS array index errors
  const originNode = { type: 'origin', labelKey: 'track.route.stage.origin', location: '', timestamp: '', status: 'pending' };
  const hubNode = { type: 'hub', labelKey: 'track.route.stage.hub', location: '', timestamp: '', status: 'pending' };
  const regionNode = { type: 'region', labelKey: 'track.route.stage.region', location: '', timestamp: '', status: 'pending' };
  const destNode = { type: 'home', labelKey: 'track.route.stage.home', location: '', timestamp: '', status: 'pending' };

  // Helper to find relevant event (safe access)
  const findEvent = (predicate: (e: any) => boolean) => events.find(predicate);

  // 1. Origin: Usually the first event or specifically created/picked up
  const originEvent = events[0]; // Oldest event
  if (originEvent) {
    originNode.status = 'ok';
    originNode.location = originEvent.location || '-';
    originNode.timestamp = originEvent.timestamp;
  }

  // 2. Hub: Look for HUB_
  const hubEvent = findEvent(e => e.location?.startsWith('HUB_'));
  if (hubEvent) {
    hubNode.status = 'ok';
    hubNode.location = hubEvent.location || '';
    hubNode.timestamp = hubEvent.timestamp;
    
    // If we have hub, origin must be passed
    originNode.status = 'ok'; 
  }

  // 3. Region: Look for REG_
  const regEvent = findEvent(e => e.location?.startsWith('REG_'));
  if (regEvent) {
    regionNode.status = 'ok';
    regionNode.location = regEvent.location || '';
    regionNode.timestamp = regEvent.timestamp;
    
    // If we have region, previous steps must be passed
    originNode.status = 'ok';
    hubNode.status = 'ok';
  }

  // 4. Destination: Look for END_ or Delivered
  // Use safe chaining
  const destEvent = findEvent(e => 
    ((e.location?.startsWith('END_') || e.location?.startsWith('STORE_')) && e.location !== originEvent?.location) || 
    e.status === 'delivered'
  );
  
  // Determine destination type (Home vs Store)
  const isStore = (destEvent?.location && destEvent.location.startsWith('END_STORE_')) || events.some(e => e.location?.startsWith('END_STORE_'));
  if (isStore) {
    destNode.labelKey = 'track.route.stage.store';
    destNode.type = 'store';
  }

  if (destEvent) {
    destNode.status = 'ok';
    destNode.location = destEvent.location || '';
    destNode.timestamp = destEvent.timestamp;
    
    // If delivered, all passed
    originNode.status = 'ok';
    hubNode.status = 'ok';
    regionNode.status = 'ok';
  }

  const skeleton = [originNode, hubNode, regionNode, destNode];

  // Handle Exceptions: Check if globally in exception state
  const isGlobalException = result.value?.current_status === 'exception';
  if (isGlobalException) {
    // Find the last active step (manual reverse loop)
    let lastActiveIdx = -1;
    for (let i = skeleton.length - 1; i >= 0; i--) {
      const s = skeleton[i];
      if (s?.status === 'ok') {
        lastActiveIdx = i;
        break;
      }
    }

    if (lastActiveIdx !== -1) {
      const node = skeleton[lastActiveIdx];
      if (node) node.status = 'exception';
    } else {
      if (skeleton[0]) skeleton[0].status = 'exception'; // Fallback
    }
  }

  return skeleton;
});

// Determine current node index (last non-pending node)
const currentNodeIndex = computed(() => {
  let idx = -1;
  const nodes = routeNodes.value;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n?.status !== 'pending') {
      idx = i;
      break;
    }
  }
  return idx;
});

// Get node state
const getNodeState = (index: number) => {
  const node = routeNodes.value[index];
  return node?.status ?? 'pending';
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
        </div>

        <!-- Exception Alert -->
        <div v-if="isException" class="exception-alert" role="alert">
          <strong>⚠ {{ t("publicTrack.exceptionAlert.title") }}</strong>
          <p>{{ t("publicTrack.exceptionAlert.body") }}</p>
        </div>

        <!-- Detail Grid -->
        <div class="detail-grid">
          <div class="detail-item">
            <p class="detail-label">{{ t("publicTrack.labels.updated") }}</p>
            <p class="detail-value">{{ formatDateTime(result.updated_at) }}</p>
          </div>
          <div v-if="result.estimated_delivery" class="detail-item">
            <p class="detail-label">{{ t("publicTrack.labels.eta") }}</p>
            <p class="detail-value">{{ formatDateTime(result.estimated_delivery) }}</p>
          </div>
        </div>

        <!-- Event Timeline -->
        <div class="progress-wrap">
          <div class="progress-head">
            <span class="detail-label">{{ t("publicTrack.route.title") }}</span>
            <div class="route-legend">
              <span class="legend-pill ok">{{ t("track.status.ok") }}</span>
              <span class="legend-pill exception">{{ t("track.status.exception") }}</span>
              <span class="legend-pill pending">{{ t("track.status.pending") }}</span>
            </div>
          </div>

          <!-- Route Stepper -->
          <div v-if="routeNodes.length > 0" class="route-stepper" :aria-label="t('track.route.aria')">
            <template v-for="(node, idx) in routeNodes" :key="`node-${idx}`">
              <div class="route-step" :class="[getNodeState(idx), { current: idx === currentNodeIndex }]">
                <div class="route-stage">{{ t(node.labelKey) }}</div>
                <div class="route-circle"></div>
                <div class="route-time" :class="getNodeState(idx)">{{ formatEventTime(node.timestamp) }}</div>
              </div>

              <!-- Segment between nodes -->
              <div
                v-if="idx < routeNodes.length - 1"
                :key="`seg-${idx}`"
                class="route-seg"
                :class="idx < currentNodeIndex ? 'ok' : 'pending'"
              />
            </template>
          </div>

          <div v-else class="progress-hint">{{ t("publicTrack.route.empty") }}</div>

          <!-- Current Status Summary -->
          <p class="route-summary">
            <span class="summary-label">{{ t("track.summary.current") }}</span>
            <span class="summary-value">{{ result.current_location || '-' }}</span>
            <span class="summary-sep" aria-hidden="true">·</span>
            <span class="summary-label">{{ t("track.summary.status") }}</span>
            <span class="summary-value">{{ result.current_status }}</span>
          </p>
        </div>


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
  font-weight: 800;
  letter-spacing: 0.02em;
}

.tag--default {
  background: rgba(0, 0, 0, 0.06);
  color: #333;
}

.tag--success {
  background: rgba(34, 197, 94, 0.18);
  color: rgb(10, 11, 10);
  box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.22);
}

.tag--danger {
  background: rgba(255, 193, 7, 0.18);
  color: rgba(140, 105, 0, 1);
  box-shadow: inset 0 0 0 1px rgba(255, 193, 7, 0.25);
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
  background: rgba(120, 120, 120, 0.3);
  flex-shrink: 0;
  z-index: 1;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.08);
}

.timeline-dot--latest {
  background: rgba(46, 160, 67, 0.18);
  box-shadow:
    inset 0 0 0 1px rgba(46, 160, 67, 0.25),
    0 6px 16px rgba(46, 160, 67, 0.15);
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-status {
  font-weight: 700;
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
  opacity: 0.92;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 14px;
  margin-bottom: 12px;
}

.detail-item {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.03);
}

.detail-label {
  margin: 0 0 4px 0;
  font-size: 14px;
  opacity: 0.75;
}

.detail-value {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  word-break: break-word;
}

.progress-wrap {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.03);
}

.progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.route-legend {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.legend-pill {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
}

.legend-pill.ok {
  background: rgba(46, 160, 67, 0.18);
  color: rgba(28, 117, 48, 1);
}

.legend-pill.exception {
  background: rgba(255, 193, 7, 0.18);
  color: rgba(140, 105, 0, 1);
}

.legend-pill.pending {
  background: rgba(120, 120, 120, 0.16);
  color: rgba(60, 60, 60, 0.9);
}

.route-stepper {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  overflow-x: auto;
  padding: 8px 16px 8px;
  -webkit-overflow-scrolling: touch;
}

.route-step {
  flex: 0 0 auto;
  width: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.route-time {
  font-size: 11px;
  line-height: 1.15;
  opacity: 0.85;
  text-align: center;
  white-space: pre-line;
  min-height: 28px;
}

.route-stage {
  opacity: 0.95;
  text-align: center;
  word-break: break-word;
  font-size: 12px;
}

.route-seg {
  flex: 0 0 72px;
  height: 10px;
  border-radius: 999px;
  margin-top: 42px;
  background: rgba(120, 120, 120, 0.22);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.06),
    0 6px 16px rgba(0, 0, 0, 0.06);
  border: 0;
  padding: 0;
}

.route-seg.ok {
  background: linear-gradient(90deg, rgba(46, 160, 67, 0.9), rgba(66, 188, 90, 0.85));
}

.route-seg.exception {
  background: linear-gradient(90deg, rgba(255, 193, 7, 0.95), rgba(255, 214, 102, 0.9));
}

.route-seg.pending {
  background: rgba(120, 120, 120, 0.22);
}

.route-circle {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(120, 120, 120, 0.16);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.08),
    0 10px 26px rgba(0, 0, 0, 0.08);
  border: 0;
  padding: 0;
}

.route-step.ok .route-circle {
  background: rgba(46, 160, 67, 0.18);
  box-shadow:
    inset 0 0 0 1px rgba(46, 160, 67, 0.25),
    0 12px 30px rgba(46, 160, 67, 0.15);
}

.route-step.exception .route-circle {
  background: rgba(255, 193, 7, 0.2);
  box-shadow:
    inset 0 0 0 1px rgba(255, 193, 7, 0.32),
    0 12px 30px rgba(255, 193, 7, 0.12);
}

.route-step.pending .route-circle {
  background: rgba(120, 120, 120, 0.12);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.06),
    0 10px 26px rgba(0, 0, 0, 0.06);
}

.route-step.current .route-circle {
  transform: translateY(-1px) scale(1.03);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.08),
    0 16px 40px rgba(0, 0, 0, 0.12);
}

.progress-hint {
  font-size: 13px;
  opacity: 0.85;
}

.route-summary {
  margin: 10px 0 0 0;
  font-size: 13px;
  opacity: 0.92;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
}

.summary-label {
  opacity: 0.75;
}

.summary-value {
  font-weight: 600;
}

.summary-sep {
  opacity: 0.35;
}
</style>

