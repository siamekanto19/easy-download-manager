<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'

interface SelectOption {
  value: string | number
  label: string
}

defineProps<{
  modelValue: string | number
  options: SelectOption[]
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

function toggle(): void {
  if (isOpen.value) {
    isOpen.value = false
    return
  }
  // Position the dropdown relative to the trigger
  if (triggerRef.value) {
    const rect = triggerRef.value.getBoundingClientRect()
    dropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 6}px`,
      right: `${window.innerWidth - rect.right}px`,
      minWidth: `${rect.width}px`,
      zIndex: '9999'
    }
  }
  isOpen.value = true
  nextTick(() => {
    document.addEventListener('click', handleClickOutside, { once: true, capture: true })
  })
}

function select(value: string | number): void {
  emit('update:modelValue', value)
  isOpen.value = false
}

function handleClickOutside(event: MouseEvent): void {
  if (triggerRef.value && triggerRef.value.contains(event.target as Node)) {
    return
  }
  isOpen.value = false
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="relative">
    <!-- Trigger button -->
    <button
      ref="triggerRef"
      @click.stop="toggle"
      class="flex items-center gap-2 rounded-lg px-3 py-[6px] text-[12px] font-medium transition-all duration-150"
      :class="[
        isOpen
          ? 'bg-white/12 text-white/80 shadow-[0_0_0_0.5px_rgba(var(--glass-rgb), 0.15)]'
          : 'bg-white/6 text-white/55 hover:bg-white/9 hover:text-white/70'
      ]"
    >
      <span>{{ options.find(o => o.value === modelValue)?.label || placeholder || 'Select' }}</span>
      <HugeiconsIcon
        :icon="ArrowDown01Icon"
        :size="12"
        class="transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <!-- Dropdown — teleported to body to avoid overflow clipping -->
    <Teleport to="body">
      <Transition name="dropdown">
        <div
          v-if="isOpen"
          :style="dropdownStyle"
          class="overflow-hidden rounded-xl py-1"
          style="
            background: rgba(20, 20, 24, 0.92);
            backdrop-filter: blur(50px) saturate(1.8);
            -webkit-backdrop-filter: blur(50px) saturate(1.8);
            box-shadow: 0 8px 40px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(var(--glass-rgb), 0.12);
          "
        >
          <button
            v-for="option in options"
            :key="option.value"
            @click.stop="select(option.value)"
            class="flex w-full items-center px-3 py-[6px] text-left text-[12px] font-medium transition-colors duration-100"
            :class="[
              modelValue === option.value
                ? 'bg-white/10 text-white/85'
                : 'text-white/55 hover:bg-white/6 hover:text-white/70'
            ]"
          >
            {{ option.label }}
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.dropdown-enter-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.dropdown-leave-active {
  transition: opacity 0.08s ease, transform 0.08s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}
</style>
