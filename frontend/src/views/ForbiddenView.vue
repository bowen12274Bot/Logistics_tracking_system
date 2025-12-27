<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import UiCard from "../components/ui/UiCard.vue";
import UiPageShell from "../components/ui/UiPageShell.vue";
import { useAuthStore } from "../stores/auth";
import type { Role } from "../types/router";
import { useI18n } from "vue-i18n";
import { roleLabelKey } from "../services/roleLabels";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();

const blockedTarget = computed(() => {
  const raw = route.query.redirect;
  return typeof raw === "string" ? raw : "";
});

const reason = computed(() => {
  const raw = route.query.reason;
  return typeof raw === "string" ? raw : "";
});

const reasonText = computed(() => {
  if (reason.value === "role_forbidden") return "你的角色不具備存取此頁面的權限。";
  if (reason.value === "api_forbidden") return "後端拒絕此操作（403）。";
  return "你目前的帳號沒有權限瀏覽此頁面。";
});

const roleHome = computed(() => {
  const role = (auth.user?.user_class ?? "") as Role | "";
  if (!role) return "/";
  if (role === "contract_customer" || role === "non_contract_customer") return "/customer";
  if (role === "driver") return "/employee/driver";
  if (role === "warehouse_staff") return "/employee/warehouse";
  if (role === "customer_service") return "/employee/customer-service";
  if (role === "admin") return "/admin";
  return "/";
});

const roleLabel = computed(() => {
  const key = roleLabelKey((auth.user?.user_class ?? "") as Role | "");
  return key ? t(key) : "";
});

const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push("/");
};
</script>

<template>
  <UiPageShell eyebrow="403" title="無權限" :lede="reasonText">
    <UiCard>
      <p v-if="auth.isLoggedIn && roleLabel" class="hint" style="margin: 0 0 6px">
        目前角色：{{ roleLabel }}
      </p>
      <p v-if="blockedTarget" class="hint" style="margin: 0 0 12px">目標頁：{{ blockedTarget }}</p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap">
        <button class="ghost-btn" type="button" @click="goBack">返回上一頁</button>
        <button class="ghost-btn" type="button" @click="router.push('/')">回首頁</button>
        <button v-if="auth.isLoggedIn" class="primary-btn" type="button" @click="router.push(roleHome)">前往我的工作台</button>
        <button v-else class="primary-btn" type="button" @click="router.push({ path: '/login', query: blockedTarget ? { redirect: blockedTarget } : undefined })">
          前往登入
        </button>
      </div>
    </UiCard>
  </UiPageShell>
</template>
