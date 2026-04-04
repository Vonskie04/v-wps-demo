<template>
  <div class="px-4 py-10">
    <div class="relative flex flex-col items-center justify-center text-center pt-12 sm:pt-0">
      <!-- Sync status bar -->
      <div class="absolute left-0 top-0 sm:top-2 flex items-center gap-2 h-8 px-1">
        <template v-if="!isLoading && isSyncing">
          <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-[#471417]"></span>
          <span class="sync-status text-xs text-gray-400">Updating...</span>
        </template>
        <Transition name="fade">
          <span v-if="newFilesAdded > 0" class="sync-status text-xs text-[#471417]">
            +{{ newFilesAdded }} new {{ newFilesAdded === 1 ? 'file' : 'files' }} added
          </span>
        </Transition>
      </div>

      <!-- Back button -->
      <button
        type="button"
        @click="goToMain"
        class="absolute right-4 top-0 sm:top-2 flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
        aria-label="Go back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span class="hidden text-sm font-semibold tracking-wide sm:inline-block">BACK</span>
      </button>

      <h1 class="mb-10 text-xl sm:text-3xl">THE GALLERY OF</h1>
      <h1 class="fg text-4xl sm:text-5xl lg:text-6xl">
        Victor <span class="fg text-4xl sm:text-5xl lg:text-6xl mx-2 sm:mx-5">&</span> Denise
      </h1>
    </div>

    <div class="mt-8 relative flex items-center justify-center gap-10">
      <button
        @click="activeTab = 'photos'"
        class="cursor-pointer p-2 fc"
        :class="activeTab === 'photos' ? 'border-b-2 border-[#471417]' : 'opacity-70'"
      >
        PHOTOS
      </button>
      <button
        @click="activeTab = 'videos'"
        class="cursor-pointer p-2 fc"
        :class="activeTab === 'videos' ? 'border-b-2 border-[#471417]' : 'opacity-70'"
      >
        VIDEOS
      </button>

      <!-- View toggle — mobile only -->
      <button
        @click="viewMode = viewMode === 'grid' ? 'list' : 'grid'"
        class="absolute right-0 cursor-pointer rounded-md p-1.5 text-[#471417] transition-colors sm:hidden"
        :aria-label="viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'"
      >
        <!-- Grid icon — shown when in list mode (click to go to grid) -->
        <svg
          v-if="viewMode === 'list'"
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
        <!-- List icon — shown when in grid mode (click to go to list) -->
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      </button>
    </div>

    <!-- Skeleton loading grid -->
    <div
      v-if="isLoading"
      class="mt-8 mx-auto grid max-w-5xl gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="n in 6"
        :key="n"
        class="skeleton-card overflow-hidden rounded-xl bg-gray-200 h-40 sm:h-56"
      />
    </div>

    <div
      v-else-if="currentItems.length > 0"
      class="mt-8 mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
      :class="viewMode === 'grid' ? 'grid-cols-2' : 'grid-cols-1'"
    >
      <button
        v-for="item in currentItems"
        :key="item.id"
        type="button"
        @click="openPreview(item)"
        class="cursor-pointer overflow-hidden rounded-xl bg-gray-100 text-left shadow-sm transition-all duration-300 hover:shadow-md hover:brightness-80 active:brightness-60"
      >
        <!-- Grid layout -->
        <template v-if="viewMode === 'grid'">
          <img
            v-if="item.type === 'image'"
            :src="item.src"
            :alt="item.name"
            class="h-40 w-full object-cover sm:h-56"
          />
          <video
            v-else
            :src="item.src"
            muted
            playsinline
            class="pointer-events-none h-40 w-full object-cover sm:h-56"
            preload="metadata"
          />
        </template>

        <!-- List layout (mobile) -->
        <template v-else>
          <img
            v-if="item.type === 'image'"
            :src="item.src"
            :alt="item.name"
            class="h-40 w-full object-cover sm:h-56"
          />
          <video
            v-else
            :src="item.src"
            muted
            playsinline
            class="pointer-events-none h-40 w-full object-cover sm:h-56"
            preload="metadata"
          />
        </template>
      </button>
    </div>

    <p v-else class="mt-8 text-center text-sm text-gray-600">
      No {{ activeTab }} uploaded yet. Go back and tap upload.
    </p>

    <Transition name="fade">
      <div v-if="selectedMedia" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Blurred dark backdrop -->
        <button
          type="button"
          @click="closePreview"
          aria-label="Close preview"
          class="absolute inset-0 h-full w-full cursor-default bg-black/80 backdrop-blur-md transition-opacity"
        />

        <!-- Sleek close button top right -->
        <button
          type="button"
          @click="closePreview"
          class="absolute right-4 top-4 z-50 cursor-pointer rounded-full p-2 text-white/60 transition-all duration-300 hover:bg-white/10 hover:text-white sm:right-8 sm:top-8"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Media container with subtle shadow and border -->
        <div @click.stop class="relative z-10 w-full max-w-5xl px-4 sm:px-12">
          <img
            v-if="selectedMedia.type === 'image'"
            :src="selectedMedia.src"
            :alt="selectedMedia.name"
            class="mx-auto max-h-[85vh] w-auto rounded-lg object-contain shadow-2xl ring-1 ring-white/10"
          />

          <video
            v-else
            :src="selectedMedia.src"
            controls
            autoplay
            class="mx-auto max-h-[85vh] w-full rounded-lg shadow-2xl ring-1 ring-white/10"
          />
        </div>
      </div>
    </Transition>

    <button
      type="button"
      @click="handleManualRefresh"
      :disabled="isSyncing"
      :aria-label="isSyncing ? 'Refreshing gallery' : 'Refresh gallery'"
      :title="isSyncing ? 'Refreshing gallery' : 'Refresh gallery'"
      class="fixed bottom-5 right-5 z-40 cursor-pointer rounded-full border border-[#471417]/20 bg-white/95 p-3 text-[#471417] shadow-lg transition-all hover:scale-105 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5"
        :class="{ 'animate-spin': isSyncing }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M16.023 9.348h4.992v-4.992M20.477 9.348A8.25 8.25 0 105.106 16.82"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMediaStore } from '@/stores/mediaStore'
import type { UploadedMedia } from '@/stores/mediaStore'

const router = useRouter()
const activeTab = ref<'photos' | 'videos'>('photos')
const viewMode = ref<'grid' | 'list'>('grid')
const { uploadedMedia, syncUploadedMediaWithCloudinary } = useMediaStore()
const selectedMedia = ref<UploadedMedia | null>(null)
const isSyncing = ref(false)
const isLoading = ref(true)
const newFilesAdded = ref(0)
let newFilesTimer: ReturnType<typeof setTimeout> | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null

const lockHistoryState = { galleryLock: true }

function lockBrowserNavigation() {
  window.history.pushState(lockHistoryState, '', window.location.href)
}

function handlePopState() {
  // Keep user on this route when browser back/forward is pressed.
  lockBrowserNavigation()
}

async function syncGalleryMedia() {
  if (isSyncing.value) {
    return
  }

  isSyncing.value = true
  const prevCount = uploadedMedia.value.length

  try {
    await syncUploadedMediaWithCloudinary()
    if (!isLoading.value) {
      const added = uploadedMedia.value.length - prevCount
      if (added > 0) {
        newFilesAdded.value = added
        if (newFilesTimer !== null) clearTimeout(newFilesTimer)
        newFilesTimer = setTimeout(() => {
          newFilesAdded.value = 0
        }, 5000)
      }
    }
  } finally {
    isSyncing.value = false
  }
}

function handleManualRefresh() {
  window.location.reload()
}

function handleWindowFocus() {
  void syncGalleryMedia()
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void syncGalleryMedia()
  }
}

onMounted(async () => {
  lockBrowserNavigation()
  window.addEventListener('popstate', handlePopState)
  window.addEventListener('focus', handleWindowFocus)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  await syncGalleryMedia()
  isLoading.value = false
  pollInterval = setInterval(() => void syncGalleryMedia(), 30_000)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState)
  window.removeEventListener('focus', handleWindowFocus)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (pollInterval !== null) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  if (newFilesTimer !== null) {
    clearTimeout(newFilesTimer)
    newFilesTimer = null
  }
})

function goToMain() {
  router.push('/')
}

function openPreview(item: UploadedMedia) {
  selectedMedia.value = item
}

function closePreview() {
  selectedMedia.value = null
}

watch(uploadedMedia, (items) => {
  if (!selectedMedia.value) {
    return
  }

  const selectedStillExists = items.some((item) => item.id === selectedMedia.value?.id)

  if (!selectedStillExists) {
    selectedMedia.value = null
  }
})

const currentItems = computed(() => {
  if (activeTab.value === 'photos') {
    return uploadedMedia.value.filter((item) => item.type === 'image')
  }

  return uploadedMedia.value.filter((item) => item.type === 'video')
})
</script>

<style scoped>
.fg {
  font-family: var(--font-great-vibes);
  font-weight: 500;
}

.sync-status {
  font-family: var(--font-saira-stencil);
  letter-spacing: 0.04em;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.skeleton-card {
  position: relative;
  overflow: hidden;
}

.skeleton-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.55) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
