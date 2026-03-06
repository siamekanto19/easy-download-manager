<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { Alert02Icon } from '@hugeicons/core-free-icons'

defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  dangerousAction?: boolean
  showDeleteFileOption?: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm', deleteFile: boolean): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="visible"
        class="fixed inset-0 z-[9999] flex items-center justify-center"
        style="background: rgba(0,0,0,0.5)"
        @click.self="emit('cancel')"
      >
        <div
          class="w-[380px] overflow-hidden rounded-2xl"
          style="
            background: rgba(30, 30, 34, 0.95);
            backdrop-filter: blur(40px);
            -webkit-backdrop-filter: blur(40px);
            box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(var(--glass-rgb), 0.1);
          "
        >
          <!-- Content -->
          <div class="px-6 pt-6 pb-5">
            <div class="mb-4 flex items-center gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                :style="dangerousAction
                  ? 'background: rgba(239,68,68,0.12)'
                  : 'background: rgba(var(--glass-rgb), 0.08)'"
              >
                <HugeiconsIcon
                  :icon="Alert02Icon"
                  :size="18"
                  :class="dangerousAction ? 'text-red-400' : 'text-white/60'"
                />
              </div>
              <h3 class="text-[14px] font-semibold text-white/90">{{ title }}</h3>
            </div>
            <p class="text-[12px] leading-relaxed text-white/50">{{ message }}</p>
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2 px-6 pb-5">
            <!-- Remove + delete file option -->
            <button
              v-if="showDeleteFileOption"
              @click="emit('confirm', true)"
              class="w-full rounded-lg py-2.5 text-[12px] font-semibold text-red-400 transition-all duration-150 hover:bg-red-500/12"
              style="background: rgba(239,68,68,0.08); box-shadow: 0 0 0 0.5px rgba(239,68,68,0.2)"
            >
              Remove &amp; Delete File
            </button>

            <!-- Remove only -->
            <button
              @click="emit('confirm', false)"
              class="w-full rounded-lg py-2.5 text-[12px] font-semibold transition-all duration-150"
              :class="dangerousAction && !showDeleteFileOption
                ? 'text-red-400 hover:bg-red-500/12'
                : 'text-white/70 hover:bg-white/8'"
              :style="dangerousAction && !showDeleteFileOption
                ? 'background: rgba(239,68,68,0.08); box-shadow: 0 0 0 0.5px rgba(239,68,68,0.2)'
                : 'background: rgba(var(--glass-rgb), 0.06); box-shadow: 0 0 0 0.5px rgba(var(--glass-rgb), 0.1)'"
            >
              {{ showDeleteFileOption ? 'Remove from List Only' : (confirmText || 'Confirm') }}
            </button>

            <!-- Cancel -->
            <button
              @click="emit('cancel')"
              class="w-full rounded-lg py-2.5 text-[12px] font-medium text-white/40 transition-all duration-150 hover:bg-white/5 hover:text-white/60"
            >
              {{ cancelText || 'Cancel' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active {
  transition: opacity 0.15s ease;
}
.dialog-enter-active > div {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dialog-leave-active {
  transition: opacity 0.1s ease;
}
.dialog-leave-active > div {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.dialog-enter-from {
  opacity: 0;
}
.dialog-enter-from > div {
  opacity: 0;
  transform: scale(0.95);
}
.dialog-leave-to {
  opacity: 0;
}
.dialog-leave-to > div {
  opacity: 0;
  transform: scale(0.95);
}
</style>
