<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description: string
  actionLabel?: string
}>()

defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center px-8 py-20 text-center">
    <!-- Icon -->
    <div class="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-overlay">
      <slot name="icon">
        <!-- Default download icon -->
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="text-text-tertiary">
          <path d="M12 3v12M7 12l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 19h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </slot>
    </div>

    <!-- Title -->
    <h3 class="mb-1.5 text-sm font-semibold text-text-primary">{{ title }}</h3>

    <!-- Description -->
    <p class="mb-6 max-w-[280px] text-[13px] leading-relaxed text-text-secondary">
      {{ description }}
    </p>

    <!-- Action button -->
    <button
      v-if="actionLabel"
      @click="$emit('action')"
      class="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white transition-default hover:bg-accent-hover active:scale-[0.98]"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      {{ actionLabel }}
    </button>
  </div>
</template>
