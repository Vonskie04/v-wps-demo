<template>
  <main
    class="container mx-auto flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 py-10 text-center"
  >
    <div class="flex w-full max-w-sm flex-col items-center">
      <p class="mb-2 text-xs tracking-[0.32em] text-[#471417]/70">PAGE NOT FOUND</p>
      <h1 class="fg mb-3 text-6xl leading-none tracking-wide sm:text-7xl">404</h1>
      <h2 class="mb-6 text-sm tracking-widest">THE MOMENT YOU ARE LOOKING FOR ISN'T HERE</h2>

      <div class="relative mb-7 w-full overflow-hidden rounded-2xl bg-white p-2 shadow-md">
        <img
          src="@/assets/ficture.jpg"
          alt="Victor and Denise"
          class="aspect-2/3 w-full rounded-xl object-cover"
        />
        <div
          class="absolute inset-x-2 bottom-2 rounded-b-xl bg-white/85 px-4 py-3 backdrop-blur-sm"
        >
          <p class="fg text-3xl leading-none">Victor & Denise</p>
        </div>
      </div>

      <p class="mb-6 max-w-xs text-[12px] leading-relaxed tracking-wide text-[#471417]/80">
        THIS LINK MAY HAVE MOVED, EXPIRED, OR BEEN TYPED INCORRECTLY.
      </p>

      <div class="flex w-full gap-3">
        <button type="button" @click="goHome" class="btn flex-1 cursor-pointer py-3 text-sm">
          HOME
        </button>
        <button
          type="button"
          @click="goGallery"
          class="btn flex-1 cursor-pointer py-3 text-sm opacity-80"
        >
          GALLERY
        </button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push({ name: 'Main' })
}

function goGallery() {
  router.push({ name: 'Gallery' })
}
</script>

<style scoped>
.fg {
  font-family: var(--font-great-vibes);
  font-weight: 500;
}

.btn {
  border-radius: 9999px;
  color: #471417;
  font-weight: 700;
  letter-spacing: 0.12em;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease,
    background-color 0.15s ease;
}

.btn:hover {
  background: rgba(71, 20, 23, 0.08);
  transform: scale(1.04);
}

.btn:active {
  opacity: 0.75;
  transform: scale(0.94);
}
</style>
