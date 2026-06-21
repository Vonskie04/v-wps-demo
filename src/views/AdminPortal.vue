<template>
  <div class="min-h-screen bg-[#f7f4ef] px-4 py-6 text-[#471417] sm:px-6">
    <section
      v-if="!isAdmin"
      class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-sm flex-col items-center justify-center text-center"
    >
      <p class="text-xs tracking-[0.28em] text-[#8f7d75]">ADMIN PORTAL</p>
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
          {{ loading ? 'CHECKING...' : 'OPEN ADMIN' }}
        </button>
      </div>
    </section>

    <section v-else class="mx-auto max-w-7xl">
      <header class="flex flex-col gap-4 border-b border-[#d8cec7] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs tracking-[0.28em] text-[#8f7d75]">ADMIN PORTAL</p>
          <h1 class="fg mt-2 text-5xl sm:text-6xl">Media Approval</h1>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="rounded-md border border-[#471417]/25 px-3 py-2 text-xs tracking-widest transition hover:bg-white"
            :disabled="isSyncing"
            @click="loadMedia"
          >
            {{ isSyncing ? 'REFRESHING' : 'REFRESH' }}
          </button>
          <RouterLink
            to="/live-feed"
            class="rounded-md border border-[#471417]/25 px-3 py-2 text-xs tracking-widest transition hover:bg-white"
          >
            LIVE FEED
          </RouterLink>
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
        <button
          v-for="tab in tabs"
          :key="tab.status"
          type="button"
          class="rounded-lg border p-4 text-left transition"
          :class="
            activeStatus === tab.status
              ? 'border-[#471417] bg-white'
              : 'border-transparent bg-white/65 hover:bg-white'
          "
          @click="activeStatus = tab.status"
        >
          <p class="text-xs tracking-widest text-[#8f7d75]">{{ tab.label }}</p>
          <p class="mt-2 text-3xl">{{ tab.count }}</p>
        </button>
      </div>

      <div v-if="isLoading" class="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="n in 6" :key="n" class="h-80 animate-pulse rounded-lg bg-white" />
      </div>

      <div v-else-if="visibleMedia.length" class="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="item in visibleMedia"
          :key="item.id"
          class="overflow-hidden rounded-lg bg-white shadow-sm"
        >
          <div class="relative">
            <button type="button" class="block w-full text-left" @click="selectedMedia = item">
              <img
                v-if="item.type === 'image'"
                :src="item.src"
                :alt="item.name"
                class="h-64 w-full object-cover"
              />
              <video
                v-else
                :src="item.src"
                :poster="getVideoPoster(item.src)"
                muted
                playsinline
                preload="metadata"
                class="h-64 w-full object-cover"
              />
            </button>
            <button
              v-if="item.status === 'rejected'"
              type="button"
              class="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#8b1f2d] text-white shadow-md transition hover:bg-[#a62939] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isBusy(item.id)"
              aria-label="Delete rejected media"
              @click.stop="deleteRejectedMedia(item)"
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
                  d="M6 7h12M10 11v6M14 11v6M9 7l1-3h4l1 3M8 7l1 13h6l1-13"
                />
              </svg>
            </button>
          </div>
          <div class="space-y-3 p-4">
            <div>
              <p class="truncate text-sm">{{ item.name }}</p>
              <p class="mt-1 text-xs uppercase tracking-widest text-[#8f7d75]">
                {{ item.type }} · {{ formatDate(item.createdAt) }}
              </p>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span
                class="rounded-md px-2 py-1 text-[11px] uppercase tracking-widest"
                :class="statusClass(item.status)"
              >
                {{ item.status }}
              </span>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="rounded-md bg-[#245b3c] px-3 py-2 text-xs tracking-widest text-white transition hover:bg-[#2f744d] disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isBusy(item.id) || item.status === 'approved'"
                  @click="moderate(item, 'approve')"
                >
                  APPROVE
                </button>
                <button
                  type="button"
                  class="rounded-md bg-[#8b1f2d] px-3 py-2 text-xs tracking-widest text-white transition hover:bg-[#a62939] disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isBusy(item.id) || item.status === 'rejected'"
                  @click="moderate(item, 'reject')"
                >
                  REJECT
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <p v-else class="py-16 text-center text-sm text-[#8f7d75]">
        No {{ activeStatus }} media.
      </p>
    </section>

    <Transition name="fade">
      <div v-if="selectedMedia" class="fixed inset-0 z-50 flex items-center justify-center">
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
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
        <div class="relative z-10 w-full max-w-6xl px-4">
          <img
            v-if="selectedMedia.type === 'image'"
            :src="selectedMedia.src"
            :alt="selectedMedia.name"
            class="mx-auto max-h-[88vh] rounded-lg object-contain"
          />
          <video
            v-else
            :src="selectedMedia.src"
            controls
            autoplay
            class="mx-auto max-h-[88vh] w-full rounded-lg"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAdminStore } from '@/stores/adminStore'

type AdminMediaType = 'image' | 'video'
type ModerationStatus = 'pending' | 'approved' | 'rejected'
type ModerationAction = 'approve' | 'reject'

interface AdminMedia {
  id: string
  name: string
  type: AdminMediaType
  src: string
  createdAt: string
  status: ModerationStatus
}

const { isAdmin, makeAdmin, lockAdmin, verifyAdminSession, getAdminSessionToken } = useAdminStore()
const tokenInput = ref('')
const error = ref('')
const mediaError = ref('')
const loading = ref(false)
const isLoading = ref(false)
const isSyncing = ref(false)
const activeStatus = ref<ModerationStatus>('pending')
const media = ref<AdminMedia[]>([])
const selectedMedia = ref<AdminMedia | null>(null)
const busyIds = ref<Set<string>>(new Set())

const pendingCount = computed(() => countByStatus('pending'))
const approvedCount = computed(() => countByStatus('approved'))
const rejectedCount = computed(() => countByStatus('rejected'))

const tabs = computed(() => [
  { status: 'pending' as const, label: 'PENDING', count: pendingCount.value },
  { status: 'approved' as const, label: 'APPROVED', count: approvedCount.value },
  { status: 'rejected' as const, label: 'REJECTED', count: rejectedCount.value },
])

const visibleMedia = computed(() => media.value.filter((item) => item.status === activeStatus.value))

function countByStatus(status: ModerationStatus) {
  return media.value.filter((item) => item.status === status).length
}

function clearError() {
  error.value = ''
}

function isAdminMedia(item: unknown): item is AdminMedia {
  if (!item || typeof item !== 'object') return false
  const candidate = item as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.type === 'image' || candidate.type === 'video') &&
    typeof candidate.src === 'string' &&
    typeof candidate.createdAt === 'string' &&
    (candidate.status === 'pending' ||
      candidate.status === 'approved' ||
      candidate.status === 'rejected')
  )
}

async function unlock() {
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
    await loadMedia()
  } catch {
    error.value = 'Could not reach server. Try again.'
  } finally {
    loading.value = false
  }
}

async function loadMedia() {
  if (!isAdmin.value || isSyncing.value) return

  isLoading.value = media.value.length === 0
  isSyncing.value = true
  mediaError.value = ''

  try {
    const token = getAdminSessionToken()
    if (!token) throw new Error('Missing admin session.')

    const res = await fetch('/api/admin/media-list?max=500', {
      cache: 'no-store',
      headers: { 'X-Session-Token': token },
    })

    if (!res.ok) throw new Error('Failed to load media.')

    const payload = (await res.json()) as { media?: unknown }
    media.value = Array.isArray(payload.media) ? payload.media.filter(isAdminMedia) : []
  } catch {
    mediaError.value = 'Admin access is active, but media could not be loaded. Check Cloudinary settings and refresh.'
  } finally {
    isLoading.value = false
    isSyncing.value = false
  }
}

async function moderate(item: AdminMedia, action: ModerationAction) {
  if (isBusy(item.id)) return

  setBusy(item.id, true)

  try {
    const token = getAdminSessionToken()
    if (!token) throw new Error('Missing admin session.')

    const res = await fetch('/api/admin/media-moderation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token,
      },
      body: JSON.stringify({ id: item.id, type: item.type, action }),
    })

    if (!res.ok) throw new Error('Failed to moderate media.')

    item.status = action === 'approve' ? 'approved' : 'rejected'
  } catch {
    await loadMedia()
  } finally {
    setBusy(item.id, false)
  }
}

async function deleteRejectedMedia(item: AdminMedia) {
  if (isBusy(item.id) || item.status !== 'rejected') return

  setBusy(item.id, true)

  try {
    const token = getAdminSessionToken()
    if (!token) throw new Error('Missing admin session.')

    const res = await fetch('/api/admin/media-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token,
      },
      body: JSON.stringify({ id: item.id, type: item.type }),
    })

    if (!res.ok) throw new Error('Failed to delete media.')

    media.value = media.value.filter((mediaItem) => mediaItem.id !== item.id)
    if (selectedMedia.value?.id === item.id) selectedMedia.value = null
  } catch {
    await loadMedia()
  } finally {
    setBusy(item.id, false)
  }
}

function isBusy(id: string) {
  return busyIds.value.has(id)
}

function setBusy(id: string, busy: boolean) {
  const next = new Set(busyIds.value)
  if (busy) next.add(id)
  else next.delete(id)
  busyIds.value = next
}

function closeAdmin() {
  lockAdmin()
  media.value = []
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getVideoPoster(src: string): string {
  return src.replace(/\.[^./?#]+(\?.*)?$/, '.jpg')
}

function statusClass(status: ModerationStatus) {
  if (status === 'approved') return 'bg-[#dfeee5] text-[#245b3c]'
  if (status === 'rejected') return 'bg-[#f2d7dc] text-[#8b1f2d]'
  return 'bg-[#f5ead2] text-[#7a5520]'
}

onMounted(async () => {
  if (await verifyAdminSession()) {
    await loadMedia()
  }
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
</style>
