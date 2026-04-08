<template>
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import { usePublicStore } from '@/stores/publicStore'

const router = useRouter()
const { verifySession } = usePublicStore()

let pollInterval: ReturnType<typeof setInterval> | null = null
let handleVisibility: (() => void) | null = null

onMounted(() => {
  const checkSession = async () => {
    if (router.currentRoute.value.name === 'Security') return
    const valid = await verifySession()
    if (!valid) {
      router.push({ name: 'Security' })
    }
  }

  pollInterval = setInterval(checkSession, 60_000)

  handleVisibility = () => {
    if (document.visibilityState === 'visible') checkSession()
  }
  document.addEventListener('visibilitychange', handleVisibility)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  if (handleVisibility) document.removeEventListener('visibilitychange', handleVisibility)
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
