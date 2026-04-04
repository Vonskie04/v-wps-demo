<template>
  <div class="container bg-gray-100 mx-auto min-h-screen">
    <div class="container mx-auto text-center py-10 flex flex-col items-center justify-center">
      <h2 class="text-sm">THE WEDDING OF</h2>
      <h1 class="fg text-4xl tracking-wide my-5">Victor & Denise</h1>
      <h3 class="text-sm mb-5">MARCH 29, 2027</h3>

      <div
        class="w-full max-w-sm rounded-2xl bg-gray-300 aspect-2/3 flex items-center justify-center"
      >
        <img src="@/assets/ficture.jpg" alt="" class="object-cover w-full h-full rounded-2xl" />
      </div>

      <!-- Upload Section -->
      <div
        class="w-full max-w-sm mx-auto my-5 text-center py-6 px-4 flex flex-col items-center justify-center"
      >
        <h3 class="fc text-[12px] wrap-break-word">
          HELP US CHERISH EVERY MOMENT - UPLOAD THE PHOTOS AND VIDEOS YOU CAPTURE ON OUR SPECIAL
          DAY.
        </h3>
      </div>
      <div class="flex gap-8 sm:gap-16">
        <button
          @click="openFilePicker"
          :disabled="isUploading"
          class="btn cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        >
          <img src="@/assets/add-image.svg" class="size-9 inline-block" alt="" />
          {{ isUploading ? 'UPLOADING...' : 'UPLOAD' }}
        </button>
        <button @click="goToGallery" class="btn cursor-pointer">
          <img src="@/assets/gallery-icon.png" class="size-10 inline-block" alt="" />
          GALLERY
        </button>
      </div>

      <p v-if="uploadError" class="mt-3 text-sm text-red-700">{{ uploadError }}</p>

      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept="image/*,video/*"
        multiple
        @change="handleFileUpload"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="isUploading"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      >
        <div class="bg-white rounded-2xl p-6 w-full max-w-xs mx-4 text-center shadow-xl">
          <p class="text-sm font-semibold tracking-wide">
            {{
              uploadProgress.total <= 1
                ? 'Uploading your file...'
                : `Uploading file ${uploadProgress.current} of ${uploadProgress.total}...`
            }}
          </p>
          <div v-if="uploadProgress.total >= 2" class="mt-4 w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-indigo-500 h-2 rounded-full transition-all duration-300"
              :style="{
                width: `${uploadProgress.current > 0 ? ((uploadProgress.current - 1) / uploadProgress.total) * 100 : 0}%`,
              }"
            ></div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMediaStore } from '@/stores/mediaStore'

const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref('')
const uploadProgress = ref({ current: 0, total: 0 })
const { addFiles } = useMediaStore()

const lockHistoryState = { mainLock: true }

function lockBrowserNavigation() {
  window.history.pushState(lockHistoryState, '', window.location.href)
}

function handlePopState() {
  // Keep user on this route when browser back/forward is pressed.
  lockBrowserNavigation()
}

onMounted(() => {
  lockBrowserNavigation()
  window.addEventListener('popstate', handlePopState)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState)
})

function openFilePicker() {
  fileInput.value?.click()
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement

  if (!target.files || target.files.length === 0) {
    return
  }

  uploadError.value = ''
  uploadProgress.value = { current: 0, total: target.files.length }
  isUploading.value = true

  try {
    await addFiles(target.files, (current, total) => {
      uploadProgress.value = { current, total }
    })
    router.push('/gallery')
  } catch {
    uploadError.value = 'Upload failed. Please try again.'
  } finally {
    target.value = ''
    isUploading.value = false
  }
}

function goToGallery() {
  router.push('/gallery')
}
</script>

<style scoped>
.fg {
  font-family: var(--font-great-vibes);
  font-weight: 500;
}

.btn {
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;
}

.btn:hover {
  transform: scale(1.05);
}

.btn:active {
  transform: scale(0.88);
  opacity: 0.75;
}
</style>
