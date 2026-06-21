<template>
  <div
    ref="liveFeedRoot"
    class="text-[#471417]"
    :class="[
      isFullscreen
        ? 'h-dvh overflow-hidden bg-black p-0'
        : 'min-h-screen bg-[#f7f4ef] px-4 py-6 sm:px-6',
      isFullscreen && !isNativeFullscreen ? 'fixed inset-0 z-50' : '',
    ]"
  >
    <section
      v-if="isLiveFeedLocked"
      class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-sm flex-col items-center justify-center text-center"
    >
      <p class="text-xs tracking-[0.28em] text-[#8f7d75]">ADMIN LIVE FEED</p>
      <h1 class="fg my-5 text-5xl">Victor & Denise</h1>
      <div class="w-full rounded-lg bg-white p-6 shadow-sm">
        <p class="text-sm leading-6 text-[#471417]">
          Live Feed is locked. Please complete the purchase to activate this feature.
        </p>
      </div>
    </section>

    <section
      v-else-if="!isAdmin"
      class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-sm flex-col items-center justify-center text-center"
    >
      <p class="text-xs tracking-[0.28em] text-[#8f7d75]">ADMIN LIVE FEED</p>
      <h1 class="fg my-5 text-5xl">Victor & Denise</h1>
      <div class="w-full rounded-lg bg-white p-6 shadow-sm">
        <input
          v-model="tokenInput"
          type="password"
          placeholder="Admin token"
          class="w-full rounded-md border border-[#d8cec7] px-4 py-3 text-center text-sm tracking-widest outline-none transition focus:border-[#471417]"
          @keyup.enter="unlock"
          @input="clearError"
        />
        <p v-if="error" class="mt-3 text-xs text-[#8b1f2d]">{{ error }}</p>
        <button
          type="button"
          class="mt-4 w-full rounded-md bg-[#471417] px-4 py-3 text-xs tracking-[0.2em] text-white transition hover:bg-[#5a1f2a] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="unlock"
        >
          {{ loading ? 'CHECKING...' : 'OPEN LIVE FEED' }}
        </button>
      </div>
    </section>

    <section
      v-else-if="isFullscreen"
      class="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-black text-white"
    >
      <div class="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
        <p class="text-[10px] tracking-[0.28em] text-white/55">LIVE PRESENTATION</p>
        <h1 class="fg mt-1 text-4xl text-white sm:text-5xl">Victor & Denise</h1>
      </div>

      <button
        type="button"
        class="absolute right-4 top-4 z-20 rounded-md border border-white/25 bg-black/35 px-3 py-2 text-xs tracking-widest text-white transition hover:bg-white/10 sm:right-6 sm:top-6"
        @click="toggleFullscreen"
      >
        EXIT FULLSCREEN
      </button>

      <div class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <Transition name="presentation-fade" mode="out-in">
          <div
            v-if="currentPresentationItem"
            :key="currentPresentationItem.id"
            class="absolute inset-0 flex items-center justify-center"
          >
            <img
              v-if="currentPresentationItem.type === 'image'"
              :src="currentPresentationItem.src"
              :alt="currentPresentationItem.name"
              class="max-h-full max-w-full object-contain"
            />
            <video
              v-else
              :key="currentPresentationItem.id"
              :src="currentPresentationItem.src"
              autoplay
              muted
              loop
              playsinline
              class="max-h-full max-w-full object-contain"
            />
          </div>
          <div v-else key="empty" class="px-6 text-center">
            <p class="text-xs tracking-[0.28em] text-white/55">NO APPROVED MEDIA</p>
          </div>
        </Transition>
      </div>

      <div
        v-if="currentPresentationItem"
        class="absolute bottom-4 left-4 right-4 z-20 flex items-end justify-between gap-4 text-white/70 sm:bottom-6 sm:left-6 sm:right-6"
      >
        <div class="min-w-0">
          <p class="truncate text-sm">{{ currentPresentationItem.name }}</p>
          <p class="mt-1 text-[10px] uppercase tracking-[0.24em]">
            {{ presentationSlideIndex + 1 }} / {{ approvedMedia.length }}
          </p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-md border border-white/25 bg-black/35 text-white transition hover:bg-white/10"
            aria-label="Previous slide"
            @click="showPreviousSlide"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
                d="m15 18-6-6 6-6"
              />
            </svg>
          </button>
          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center rounded-md border border-white/25 bg-black/35 text-white transition hover:bg-white/10"
            aria-label="Next slide"
            @click="showNextSlide"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
                d="m9 18 6-6-6-6"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>

    <section v-else class="mx-auto max-w-7xl">
      <header
        class="flex flex-col gap-4 border-b border-[#d8cec7] pb-5 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p class="text-xs tracking-[0.28em] text-[#8f7d75]">ADMIN LIVE FEED</p>
          <h1 class="fg mt-2 text-5xl sm:text-6xl">Victor & Denise</h1>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="isSyncing" class="text-xs tracking-widest text-[#8f7d75]">UPDATING</span>
          <button
            type="button"
            class="rounded-md border border-[#471417]/25 px-3 py-2 text-xs tracking-widest transition hover:bg-white"
            :disabled="isSyncing"
            @click="syncFeed"
          >
            REFRESH
          </button>
          <button
            type="button"
            class="rounded-md border border-[#471417]/25 px-3 py-2 text-xs tracking-widest transition hover:bg-white"
            @click="toggleFullscreen"
          >
            {{ isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN' }}
          </button>
          <button
            type="button"
            class="rounded-md bg-[#471417] px-3 py-2 text-xs tracking-widest text-white transition hover:bg-[#5a1f2a]"
            @click="closeAdmin"
          >
            LOCK
          </button>
        </div>
      </header>

      <p v-if="mediaError" class="mt-4 rounded-md bg-[#f2d7dc] px-4 py-3 text-sm text-[#8b1f2d]">
        {{ mediaError }}
      </p>

      <div class="grid gap-4 border-b border-[#d8cec7] py-5 sm:grid-cols-3">
        <div class="rounded-lg bg-white p-4">
          <p class="text-xs tracking-widest text-[#8f7d75]">TOTAL FILES</p>
          <p class="mt-2 text-3xl">{{ visibleMedia.length }}</p>
        </div>
        <div class="rounded-lg bg-white p-4">
          <p class="text-xs tracking-widest text-[#8f7d75]">PHOTOS</p>
          <p class="mt-2 text-3xl">{{ photoCount }}</p>
        </div>
        <div class="rounded-lg bg-white p-4">
          <p class="text-xs tracking-widest text-[#8f7d75]">VIDEOS</p>
          <p class="mt-2 text-3xl">{{ videoCount }}</p>
        </div>
      </div>

      <div v-if="isLoading" class="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="n in 8" :key="n" class="h-56 animate-pulse rounded-lg bg-white" />
      </div>

      <div v-else-if="visibleMedia.length" class="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
        <button
          v-for="item in visibleMedia"
          :key="item.id"
          type="button"
          class="group overflow-hidden rounded-lg bg-white text-left shadow-sm transition hover:shadow-md"
          @click="selectedMedia = item"
        >
          <img
            v-if="item.type === 'image'"
            :src="item.src"
            :alt="item.name"
            class="h-56 w-full object-cover transition group-hover:scale-[1.02]"
          />
          <video
            v-else
            :src="item.src"
            :poster="getVideoPoster(item.src)"
            muted
            playsinline
            preload="metadata"
            class="h-56 w-full object-cover transition group-hover:scale-[1.02]"
          />
          <div class="p-3">
            <p class="truncate text-sm">{{ item.name }}</p>
            <p class="mt-1 text-xs uppercase tracking-widest text-[#8f7d75]">{{ item.type }}</p>
          </div>
        </button>
      </div>

      <p v-else class="py-16 text-center text-sm text-[#8f7d75]">No visible uploads yet.</p>
    </section>

    <Transition name="fade">
      <div v-if="selectedMedia" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          class="absolute inset-0 bg-black/85"
          aria-label="Close preview"
          @click="selectedMedia = null"
        />
        <button
          type="button"
          class="absolute right-4 top-4 z-50 rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Close preview"
          @click="selectedMedia = null"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
        <div
          class="relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl items-center justify-center"
        >
          <img
            v-if="selectedMedia.type === 'image'"
            :src="selectedMedia.src"
            :alt="selectedMedia.name"
            class="max-h-[calc(100dvh-2rem)] max-w-full rounded-lg object-contain"
          />
          <video
            v-else
            :src="selectedMedia.src"
            controls
            autoplay
            class="max-h-[calc(100dvh-2rem)] max-w-full rounded-lg object-contain"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAdminStore } from '@/stores/adminStore'

type FeedMediaType = 'image' | 'video'
type FeedModerationStatus = 'pending' | 'approved' | 'rejected'

interface FeedMedia {
  id: string
  name: string
  type: FeedMediaType
  src: string
  status?: FeedModerationStatus
}

const { isAdmin, makeAdmin, lockAdmin, verifyAdminSession, getAdminSessionToken } = useAdminStore()
const tokenInput = ref('')
const error = ref('')
const mediaError = ref('')
const loading = ref(false)
const isLoading = ref(false)
const isSyncing = ref(false)
const isFullscreen = ref(false)
const isNativeFullscreen = ref(false)
const isLiveFeedLocked = ref(false)
const media = ref<FeedMedia[]>([])
const selectedMedia = ref<FeedMedia | null>(null)
const liveFeedRoot = ref<HTMLElement | null>(null)
const presentationSlideIndex = ref(0)
let pollInterval: ReturnType<typeof setInterval> | null = null
let presentationInterval: ReturnType<typeof setInterval> | null = null

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

const visibleMedia = computed(() => media.value.filter((item) => item.status !== 'rejected'))
const photoCount = computed(() => visibleMedia.value.filter((item) => item.type === 'image').length)
const videoCount = computed(() => visibleMedia.value.filter((item) => item.type === 'video').length)
const approvedMedia = computed(() =>
  media.value.filter((item) => item.status === undefined || item.status === 'approved'),
)
const currentPresentationItem = computed(() => {
  if (approvedMedia.value.length === 0) return null
  return approvedMedia.value[presentationSlideIndex.value % approvedMedia.value.length]
})

function clearError() {
  error.value = ''
}

function isFeedMedia(item: unknown): item is FeedMedia {
  if (!item || typeof item !== 'object') return false
  const candidate = item as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.type === 'image' || candidate.type === 'video') &&
    typeof candidate.src === 'string' &&
    (candidate.status === undefined ||
      candidate.status === 'pending' ||
      candidate.status === 'approved' ||
      candidate.status === 'rejected')
  )
}

async function unlock() {
  if (isLiveFeedLocked.value) return

  if (!tokenInput.value.trim()) {
    error.value = 'Please enter an admin token.'
    return
  }

  loading.value = true
  clearError()

  try {
    const res = await fetch('/api/admin/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenInput.value }),
    })
    const data = await res.json()

    if (!res.ok) {
      error.value = data.error ?? 'Incorrect admin token.'
      tokenInput.value = ''
      return
    }

    makeAdmin(data.sessionToken, data.expiresAt ?? null)
    tokenInput.value = ''
    await loadFeed()
    startPolling()
  } catch {
    error.value = 'Could not reach server. Try again.'
  } finally {
    loading.value = false
  }
}

async function syncFeed() {
  if (isLiveFeedLocked.value || !isAdmin.value || isSyncing.value) return

  isSyncing.value = true
  mediaError.value = ''
  try {
    const token = getAdminSessionToken()
    if (!token) throw new Error('Missing admin session.')

    const res = await fetch('/api/admin/media-list?max=500', {
      cache: 'no-store',
      headers: { 'X-Session-Token': token },
    })

    if (!res.ok) throw new Error('Failed to load live feed.')

    const payload = (await res.json()) as { media?: unknown }
    media.value = Array.isArray(payload.media) ? payload.media.filter(isFeedMedia) : []
  } catch {
    stopPolling()
    mediaError.value =
      'Live Feed access is active, but media could not be loaded. Check Cloudinary settings and refresh.'
  } finally {
    isSyncing.value = false
  }
}

async function loadFeed() {
  if (isLiveFeedLocked.value) return

  isLoading.value = true
  try {
    await syncFeed()
  } finally {
    isLoading.value = false
  }
}

function startPolling() {
  if (isLiveFeedLocked.value) return

  stopPolling()
  pollInterval = setInterval(() => void syncFeed(), 10_000)
}

function stopPolling() {
  if (pollInterval !== null) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

function startPresentation() {
  stopPresentation()
  if (approvedMedia.value.length <= 1) return

  presentationInterval = setInterval(showNextSlide, 6_500)
}

function stopPresentation() {
  if (presentationInterval !== null) {
    clearInterval(presentationInterval)
    presentationInterval = null
  }
}

function showNextSlide() {
  if (approvedMedia.value.length === 0) {
    presentationSlideIndex.value = 0
    return
  }

  presentationSlideIndex.value = (presentationSlideIndex.value + 1) % approvedMedia.value.length
}

function showPreviousSlide() {
  if (approvedMedia.value.length === 0) {
    presentationSlideIndex.value = 0
    return
  }

  presentationSlideIndex.value =
    (presentationSlideIndex.value - 1 + approvedMedia.value.length) % approvedMedia.value.length
}

function closeAdmin() {
  lockAdmin()
  stopPolling()
  stopPresentation()
  media.value = []
  mediaError.value = ''
  void exitFullscreen()
}

function getVideoPoster(src: string): string {
  return src.replace(/\.[^./?#]+(\?.*)?$/, '.jpg')
}

async function enterFullscreen() {
  const target = liveFeedRoot.value as FullscreenElement | null
  if (!target) return

  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen()
      return
    }

    if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen()
      return
    }
  } catch {
    // Fall back to an app-level fullscreen layout when native fullscreen is blocked.
  }

  isFullscreen.value = true
  isNativeFullscreen.value = false
}

async function exitFullscreen() {
  const fullscreenDocument = document as FullscreenDocument

  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }

  if (fullscreenDocument.webkitFullscreenElement && fullscreenDocument.webkitExitFullscreen) {
    await fullscreenDocument.webkitExitFullscreen()
    return
  }

  isFullscreen.value = false
  isNativeFullscreen.value = false
}

async function toggleFullscreen() {
  if (isLiveFeedLocked.value) return

  try {
    if (isFullscreen.value || getFullscreenElement()) {
      await exitFullscreen()
    } else {
      await enterFullscreen()
    }
  } catch {
    isFullscreen.value = Boolean(getFullscreenElement())
  }
}

function getFullscreenElement() {
  const fullscreenDocument = document as FullscreenDocument
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null
}

function handleFullscreenChange() {
  const activeElement = getFullscreenElement()
  isNativeFullscreen.value = activeElement === liveFeedRoot.value
  isFullscreen.value = isNativeFullscreen.value
}

async function checkLiveFeedAccess() {
  try {
    const res = await fetch('/api/live-feed-access', { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to check live feed access.')

    const payload = (await res.json()) as { purchased?: unknown }
    isLiveFeedLocked.value = payload.purchased !== true
  } catch {
    isLiveFeedLocked.value = true
  }

  if (isLiveFeedLocked.value) {
    stopPolling()
    stopPresentation()
    media.value = []
    selectedMedia.value = null
    if (isFullscreen.value || getFullscreenElement()) void exitFullscreen()
  }
}

watch(isFullscreen, (fullscreen) => {
  if (fullscreen) {
    presentationSlideIndex.value =
      presentationSlideIndex.value % Math.max(approvedMedia.value.length, 1)
    startPresentation()
  } else {
    stopPresentation()
  }
})

watch(
  () => approvedMedia.value.length,
  (count) => {
    if (presentationSlideIndex.value >= count) presentationSlideIndex.value = 0
    if (isFullscreen.value) startPresentation()
  },
)

onMounted(async () => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  await checkLiveFeedAccess()
  if (isLiveFeedLocked.value) return

  if (await verifyAdminSession()) {
    await loadFeed()
    startPolling()
  }
})

onBeforeUnmount(() => {
  stopPolling()
  stopPresentation()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
})
</script>

<style scoped>
.fg {
  font-family: var(--font-great-vibes);
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.presentation-fade-enter-active,
.presentation-fade-leave-active {
  transition:
    opacity 1.2s ease,
    transform 1.2s ease;
}

.presentation-fade-enter-from {
  opacity: 0;
  transform: scale(1.015);
}

.presentation-fade-leave-to {
  opacity: 0;
  transform: scale(0.985);
}
</style>
