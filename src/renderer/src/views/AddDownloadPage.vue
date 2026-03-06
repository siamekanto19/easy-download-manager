<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Download04Icon,
  FolderOpenIcon
} from '@hugeicons/core-free-icons'

const url = ref('')
const fileName = ref('')
const outputDirectory = ref('')
const isSubmitting = ref(false)
const urlError = ref('')
const submitError = ref('')
const hasAutoExtractedName = ref(false)
const submitSuccess = ref(false)

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
  submitError.value = ''
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
  submitError.value = ''
  try {
    const result = await window.api.downloads.add({
      url: url.value.trim(),
      fileName: fileName.value.trim() || undefined,
      outputDirectory: outputDirectory.value || undefined,
      startImmediately: true
    })

    if (result && !result.success) {
      submitError.value = result.error || 'Failed to add download'
      return
    }

    submitSuccess.value = true
    // Brief visual feedback before closing
    setTimeout(() => {
      window.api.window.closeSelf()
    }, 400)
  } catch (error) {
    console.error('Failed to add download:', error)
    submitError.value = error instanceof Error ? error.message : 'An unexpected error occurred'
  } finally {
    isSubmitting.value = false
  }
}

function handleClose(): void {
  window.api.window.closeSelf()
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Draggable title bar area -->
    <div class="drag-region flex h-[48px] shrink-0 items-center px-5">
      <div class="no-drag ml-auto" />
    </div>

    <!-- Header -->
    <div class="flex items-center gap-3 px-6 pb-5">
      <div class="flex h-9 w-9 items-center justify-center rounded-xl" style="background: rgba(var(--glass-rgb), 0.08)">
        <HugeiconsIcon :icon="Download04Icon" :size="18" class="text-white/60" />
      </div>
      <div>
        <h2 class="text-[15px] font-semibold text-white/90">Add Download</h2>
        <p class="text-[11px] text-white/35">Enter a URL to start downloading</p>
      </div>
    </div>

    <!-- Form -->
    <div class="flex flex-1 flex-col px-6">
      <div class="space-y-4">
        <!-- URL Input -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-white/55">
            Download URL
          </label>
          <input
            v-model="url"
            type="text"
            placeholder="https://example.com/file.zip"
            class="w-full rounded-lg px-3.5 py-2.5 text-[13px] text-white/85 placeholder-white/30 outline-none transition-all duration-150 focus:ring-1"
            :class="[
              urlError
                ? 'ring-1 ring-red-400/40 focus:ring-red-400/60'
                : 'focus:ring-white/15'
            ]"
            style="background: rgba(var(--glass-rgb), 0.06); border: 0.5px solid rgba(var(--glass-rgb), 0.08)"
            autofocus
            @keydown.enter="handleSubmit"
          />
          <p v-if="urlError" class="mt-1 text-[11px] text-red-400">{{ urlError }}</p>
        </div>

        <!-- File Name -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-white/55">
            File Name
            <span class="text-white/25">(optional)</span>
          </label>
          <input
            v-model="fileName"
            type="text"
            placeholder="Auto-detected from URL"
            class="w-full rounded-lg px-3.5 py-2.5 text-[13px] text-white/85 placeholder-white/30 outline-none transition-all duration-150 focus:ring-1 focus:ring-white/15"
            style="background: rgba(var(--glass-rgb), 0.06); border: 0.5px solid rgba(var(--glass-rgb), 0.08)"
          />
        </div>

        <!-- Output Directory -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-white/55">
            Save Location
          </label>
          <div class="flex gap-2">
            <div
              class="flex flex-1 items-center overflow-hidden rounded-lg px-3.5 py-2.5"
              style="background: rgba(var(--glass-rgb), 0.06); border: 0.5px solid rgba(var(--glass-rgb), 0.08)"
            >
              <HugeiconsIcon :icon="FolderOpenIcon" :size="14" class="mr-2 shrink-0 text-white/30" />
              <span class="truncate text-[13px] text-white/55">
                {{ outputDirectory || 'Default download directory' }}
              </span>
            </div>
            <button
              @click="selectDirectory"
              class="shrink-0 rounded-lg px-3 py-2.5 text-[12px] font-medium text-white/55 transition-all duration-150 hover:text-white/75"
              style="background: rgba(var(--glass-rgb), 0.06); box-shadow: 0 0 0 0.5px rgba(var(--glass-rgb), 0.1)"
            >
              Browse
            </button>
          </div>
        </div>
      </div>

      <!-- Error message -->
      <p v-if="submitError" class="mt-3 rounded-lg px-3 py-2 text-[11px] text-red-400" style="background: rgba(239,68,68,0.1)">
        {{ submitError }}
      </p>
    </div>

    <!-- Footer — fixed at bottom with proper spacing -->
    <div class="flex items-center justify-end gap-3 px-6 py-5" style="border-top: 0.5px solid rgba(var(--glass-rgb), 0.06)">
      <button
        @click="handleClose"
        class="rounded-lg px-4 py-2 text-[13px] font-medium text-white/50 transition-all duration-150 hover:bg-white/6 hover:text-white/70"
      >
        Cancel
      </button>
      <button
        @click="handleSubmit"
        :disabled="!isValid || isSubmitting || submitSuccess"
        class="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-[13px] font-semibold text-white/90 transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        :class="submitSuccess ? 'bg-emerald-500/60' : ''"
        :style="!submitSuccess ? 'background: rgba(255,255,255,0.10); box-shadow: 0 0 0 0.5px rgba(var(--glass-rgb), 0.14)' : ''"
      >
        <HugeiconsIcon v-if="!submitSuccess && !isSubmitting" :icon="Download04Icon" :size="14" />
        <span v-if="submitSuccess">✓ Added</span>
        <span v-else-if="isSubmitting">Adding...</span>
        <span v-else>Start Download</span>
      </button>
    </div>
  </div>
</template>
