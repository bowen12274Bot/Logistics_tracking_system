<script setup lang="ts">
import { computed } from 'vue'
import UiIcon from './UiIcon.vue'
import type { IconName } from '../icons/iconLibrary'

interface Props {
  icon?: IconName
  iconPosition?: 'left' | 'right'
  iconOnly?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  iconPosition: 'left',
  iconOnly: false,
  variant: 'ghost',
  size: 'medium',
  disabled: false,
  type: 'button',
})

const classes = computed(() => {
  const base = ['ui-button']
  
  // Variant
  if (props.variant === 'primary') base.push('ui-button--primary')
  else if (props.variant === 'danger') base.push('ui-button--danger')
  else base.push('ui-button--ghost')
  
  // Size
  if (props.size === 'small') base.push('ui-button--small')
  else if (props.size === 'large') base.push('ui-button--large')
  
  // Icon only
  if (props.iconOnly) base.push('ui-button--icon-only')
  
  // Icon position
  if (props.icon && props.iconPosition === 'right') base.push('ui-button--icon-right')
  
  return base
})

const iconSize = computed(() => {
  if (props.size === 'small') return 14
  if (props.size === 'large') return 20
  return 16
})
</script>

<template>
  <button :class="classes" :disabled="disabled" :type="type">
    <UiIcon v-if="icon && iconPosition === 'left'" :name="icon" :size="iconSize" class="ui-button__icon" />
    <span v-if="!iconOnly" class="ui-button__text">
      <slot />
    </span>
    <UiIcon v-if="icon && iconPosition === 'right'" :name="icon" :size="iconSize" class="ui-button__icon" />
  </button>
</template>

<style scoped>
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 12px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  white-space: nowrap;
}

/* Variants */
.ui-button--primary {
  background: rgba(244, 182, 194, 0.55);
  border-color: rgba(0, 0, 0, 0.06);
  color: var(--text-main);
}

.ui-button--primary:hover:not(:disabled) {
  background: rgba(244, 182, 194, 0.7);
  transform: translateY(-1px);
}

.ui-button--ghost {
  background: transparent;
  border-color: rgba(0, 0, 0, 0.12);
  color: var(--text-main);
}

.ui-button--ghost:hover:not(:disabled) {
  background: rgba(244, 182, 194, 0.15);
  border-color: rgba(244, 182, 194, 0.35);
}

.ui-button--danger {
  background: rgba(220, 38, 38, 0.1);
  border-color: rgba(220, 38, 38, 0.3);
  color: #991b1b;
}

.ui-button--danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.2);
  border-color: rgba(220, 38, 38, 0.5);
}

/* Sizes */
.ui-button--small {
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 999px;
}

.ui-button {
  padding: 8px 12px;
  font-size: 14px;
}

.ui-button--large {
  padding: 12px 18px;
  font-size: 16px;
}

/* Icon only */
.ui-button--icon-only {
  padding: 8px;
  aspect-ratio: 1;
}

.ui-button--icon-only.ui-button--small {
  padding: 6px;
}

.ui-button--icon-only.ui-button--large {
  padding: 12px;
}

/* Icon position */
.ui-button--icon-right {
  flex-direction: row-reverse;
}

/* Disabled */
.ui-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui-button__icon {
  flex-shrink: 0;
}

.ui-button__text {
  flex: 1;
}
</style>
