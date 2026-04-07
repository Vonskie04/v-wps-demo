import { createRouter, createWebHistory } from 'vue-router'
import { usePublicStore } from '@/stores/publicStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Main',
      component: () => import('../views/Main.vue'),
    },
    {
      path: '/gallery',
      name: 'Gallery',
      component: () => import('../views/Gallery.vue'),
    },
    {
      path: '/security',
      name: 'Security',
      component: () => import('../views/Security.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const { verifySession } = usePublicStore()

  if (to.name === 'Security') {
    // Already unlocked — skip the security page
    const valid = await verifySession()
    if (valid) return { name: 'Main' }
    return
  }

  // Protected route — verify session with server
  const valid = await verifySession()
  if (!valid) return { name: 'Security' }
})

export default router
