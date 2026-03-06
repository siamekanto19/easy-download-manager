<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Download04Icon,
  Cancel01Icon,
  FolderOpenIcon
} from '@hugeicons/core-free-icons'

const emit = defineEmits<{
  close: []
  submit: [{ url: string; fileName: string; outputDirectory: string }]
}>()

const props = defineProps<{
  visible: boolean
}>()

const url = ref('')
const fileName = ref('')
const outputDirectory = ref('')
const isSubmitting = ref(false)
const urlError = ref('')
const hasAutoExtractedName = ref(false)

const isValid = computed(() => {
  return url.value.trim().length > 0 && !urlError.value
})

function validateUrl(value: string): void {
  if (!value.trim()) {
    urlError.value = ''
    return
  }
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      urlError.value = 'Only HTTP and HTTPS URLs are supported'
      return
    }
    urlError.value = ''
  } catch {
    urlError.value = 'Please enter a valid URL'
  }
}

function extractFileNameFromUrl(value: string): void {
  if (hasAutoExtractedName.value || fileName.value) return
  try {
    const parsed = new URL(value)
    const segments = parsed.pathname.split('/')
    const last = segments[segments.length - 1]
    if (last && last.includes('.')) {
      fileName.value = decodeURIComponent(last)
      hasAutoExtractedName.value = true
    }
  } catch {
    // ignore
  }
}

watch(url, (value) => {
  validateUrl(value)
  extractFileNameFromUrl(value)
})

watch(fileName, (value) => {
  if (!value) {
    hasAutoExtractedName.value = false
  }
})

onMounted(async () => {
  try {
    const settings = await window.api.settings.getAll()
    outputDirectory.value = settings.downloadDirectory
  } catch {
    // use default
  }
})

async function selectDirectory(): Promise<void> {
  const dir = await window.api.shell.selectDirectory()
  if (dir) {
    outputDirectory.value = dir
  }
}

async function handleSubmit(): Promise<void> {
  if (!isValid.value || isSubmitting.value) return

  isSubmitting.value = true
  try {
    emit('submit', {
      url: url.value.trim(),
      fileName: fileName.value.trim(),
      outputDirectory: outputDirectory.value
    })
    resetForm()
    emit('close')
  } finally {
    isSubmitting.value = false
  }
}

function resetForm(): void {
  url.value = ''
  fileName.value = ''
  urlError.value = ''
  hasAutoExtractedName.value = false
}

function handleClose(): void {
  resetForm()
  emit('close')
}

function handleBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click="handleBackdropClick"
      >
        <div
          class="w-full max-w-[520px] rounded-2xl border border-border-default bg-surface-raised shadow-2xl"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-border-default px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
                <HugeiconsIcon :icon="Download04Icon" :size="16" class="text-accent" />
              </div>
              <h2 class="text-[15px] font-semibold text-text-primary">Add Download</h2>
            </div>

            <button
              @click="handleClose"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <HugeiconsIcon :icon="Cancel01Icon" :size="14" />
            </button>
          </div>

          <!-- Body -->
          <div class="space-y-5 px-6 py-5">
            <!-- URL Input -->
            <div>
              <label class="mb-1.5 block text-[12px] font-medium text-text-secondary">
                Download URL
              </label>
              <input
                v-model="url"
                type="text"
                placeholder="https://example.com/file.zip"
                class="w-full rounded-lg border bg-surface-base px-3.5 py-2.5 text-[13px] text-text-primary placeholder-text-tertiary outline-none transition-colors-fast"
                :class="[
                  urlError
                    ? 'border-status-error focus:border-status-error focus:ring-1 focus:ring-status-error/20'
                    : 'border-border-default focus:border-border-accent focus:ring-1 focus:ring-accent/20'
                ]"
                autofocus
                @keydown.enter="handleSubmit"
              />
              <p v-if="urlError" class="mt-1 text-[11px] text-status-error">{{ urlError }}</p>
            </div>

            <!-- File Name -->
            <div>
              <label class="mb-1.5 block text-[12px] font-medium text-text-secondary">
                File Name
                <span class="text-text-tertiary">(optional — auto-detected from URL)</span>
              </label>
              <input
                v-model="fileName"
                type="text"
                placeholder="Will be extracted from URL"
                class="w-full rounded-lg border border-border-default bg-surface-base px-3.5 py-2.5 text-[13px] text-text-primary placeholder-text-tertiary outline-none transition-colors-fast focus:border-border-accent focus:ring-1 focus:ring-accent/20"
              />
            </div>

            <!-- Output Directory -->
            <div>
              <label class="mb-1.5 block text-[12px] font-medium text-text-secondary">
                Save Location
              </label>
              <div class="flex gap-2">
                <div
                  class="flex flex-1 items-center overflow-hidden rounded-lg border border-border-default bg-surface-base px-3.5 py-2.5"
                >
                  <HugeiconsIcon :icon="FolderOpenIcon" :size="14" class="mr-2 shrink-0 text-text-tertiary" />
                  <span class="truncate text-[13px] text-text-secondary">
                    {{ outputDirectory || 'Default download directory' }}
                  </span>
                </div>
                <button
                  @click="selectDirectory"
                  class="shrink-0 rounded-lg border border-border-default bg-surface-base px-3 py-2.5 text-[12px] font-medium text-text-secondary transition-colors-fast hover:bg-surface-hover hover:text-text-primary"
                >
                  Browse
                </button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4">
            <button
              @click="handleClose"
              class="rounded-lg px-4 py-2 text-[13px] font-medium text-text-secondary transition-colors-fast hover:bg-surface-hover hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              @click="handleSubmit"
              :disabled="!isValid || isSubmitting"
              class="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-[13px] font-medium text-white transition-default hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HugeiconsIcon :icon="Download04Icon" :size="14" />
              Start Download
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}

.modal-leave-to > div {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}
</style>
