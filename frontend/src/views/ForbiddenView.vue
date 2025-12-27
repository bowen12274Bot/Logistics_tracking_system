<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import UiCard from '../components/ui/UiCard.vue'
import UiPageShell from '../components/ui/UiPageShell.vue'
import { useAuthStore } from '../stores/auth'
import type { Role } from '../types/router'
import { roleLabelKey } from '../services/roleLabels'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()

const blockedTarget = computed(() => {
  const raw = route.query.redirect
  return typeof raw === 'string' ? raw : ''
})

const reason = computed(() => {
  const raw = route.query.reason
  return typeof raw === 'string' ? raw : ''
})

const reasonText = computed(() => {
  if (reason.value === 'role_forbidden') return t('forbidden.reason.roleForbidden')
  if (reason.value === 'api_forbidden') return t('forbidden.reason.apiForbidden')
  return t('forbidden.reason.default')
})

const roleHome = computed(() => {
  const role = (auth.user?.user_class ?? '') as Role | ''
  if (!role) return '/'
  if (role === 'contract_customer' || role === 'non_contract_customer') return '/customer'
  if (role === 'driver') return '/employee/driver'
  if (role === 'warehouse_staff') return '/employee/warehouse'
  if (role === 'customer_service') return '/employee/customer-service'
  if (role === 'admin') return '/admin'
  return '/'
})

const roleLabel = computed(() => {
  const key = roleLabelKey((auth.user?.user_class ?? '') as Role | '')
  return key ? t(key) : ''
})

const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/')
}
</script>

<template>
  <UiPageShell eyebrow="403" :title="t('forbidden.title')" :lede="reasonText">
    <UiCard>
      <p v-if="auth.isLoggedIn && roleLabel" class="hint" style="margin: 0 0 6px">
        {{ t('forbidden.currentRole', { role: roleLabel }) }}
      </p>
      <p v-if="blockedTarget" class="hint" style="margin: 0 0 12px">
        {{ t('forbidden.target', { target: blockedTarget }) }}
      </p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap">
        <button class="ghost-btn" type="button" @click="goBack">{{ t('forbidden.actions.back') }}</button>
        <button class="ghost-btn" type="button" @click="router.push('/')">{{ t('forbidden.actions.home') }}</button>
        <button v-if="auth.isLoggedIn" class="primary-btn" type="button" @click="router.push(roleHome)">
          {{ t('forbidden.actions.goRoleHome') }}
        </button>
        <button
          v-else
          class="primary-btn"
          type="button"
          @click="router.push({ path: '/login', query: blockedTarget ? { redirect: blockedTarget } : undefined })"
        >
          {{ t('forbidden.actions.login') }}
        </button>
      </div>
    </UiCard>
  </UiPageShell>
</template>
